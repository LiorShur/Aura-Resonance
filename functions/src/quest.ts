import { getFirestore } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { z } from 'zod';
import { evaluateCheckIn } from './quest-core.js';
import { finalizeVerifiedAttempt } from './award.js';

const Position = z.object({ lat: z.number(), lng: z.number() });

const CheckInInput = z.object({
  attemptId: z.string().min(1),
  position: Position,
});

const VerifyInput = z.object({
  attemptId: z.string().min(1),
  // Breathing quests self-report completed cycles (no sensor — same trust model
  // as any non-photo completion; RP is capped regardless). Optional so other
  // non-photo verifications can call without it.
  breathingCyclesCompleted: z.number().int().min(0).max(50).optional(),
  breathingSkipped: z.boolean().optional(),
});

/**
 * Verify the player is physically within a Fracture's radius and advance the
 * attempt to `checked_in`. The client supplies its coordinates (GPS games cannot
 * prevent spoofing — verification is deliberately soft, see GDD 3.1), but the
 * range check is done HERE and the state transition is server-only, so a client
 * cannot mark itself checked-in from across town.
 */
export const submitCheckIn = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in first');

  const parsed = CheckInInput.safeParse(request.data);
  if (!parsed.success) throw new HttpsError('invalid-argument', 'Bad check-in');
  const { attemptId, position } = parsed.data;

  const db = getFirestore();
  const attemptRef = db.doc(`questAttempts/${attemptId}`);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(attemptRef);
    if (!snap.exists) throw new HttpsError('not-found', 'attempt');
    const attempt = snap.data()!;
    if (attempt.uid !== uid) throw new HttpsError('permission-denied', 'not-owner');
    if (attempt.state !== 'started') {
      throw new HttpsError('failed-precondition', 'attempt-not-started');
    }

    const fractureSnap = await tx.get(db.doc(`fractures/${attempt.fractureId}`));
    if (!fractureSnap.exists) throw new HttpsError('not-found', 'fracture');
    const f = fractureSnap.data()!;
    if (f.status !== 'active') throw new HttpsError('failed-precondition', 'fracture-inactive');

    const ev = evaluateCheckIn(
      { lat: f.geo.lat, lng: f.geo.lng },
      Number(f.radiusM),
      position,
    );
    if (!ev.withinRange) {
      // Leave the attempt as 'started'; the player can move closer and retry.
      return { status: 'rejected' as const, radiusM: Number(f.radiusM), ...ev };
    }

    tx.update(attemptRef, {
      state: 'checked_in',
      checkInGeo: position,
      checkInDistanceM: ev.distanceM,
    });
    return { status: 'checked_in' as const, distanceM: ev.distanceM };
  });
});

/**
 * Complete a checked-in quest whose proof does NOT need an upload
 * (breathing/session_code — trusted for now until M6/M8). Photo quests are
 * deliberately refused here: their only path to `verified` is the
 * Storage-triggered `moderateMedia`, so a client cannot self-award by calling
 * this without a photo that passed moderation.
 */
export const submitVerification = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in first');

  const parsed = VerifyInput.safeParse(request.data);
  if (!parsed.success) throw new HttpsError('invalid-argument', 'Bad verification');
  const { attemptId, breathingCyclesCompleted, breathingSkipped } = parsed.data;

  const db = getFirestore();
  const attemptSnap = await db.doc(`questAttempts/${attemptId}`).get();
  if (!attemptSnap.exists) throw new HttpsError('not-found', 'attempt');
  const attempt = attemptSnap.data()!;
  if (attempt.uid !== uid) throw new HttpsError('permission-denied', 'not-owner');
  if (attempt.state !== 'checked_in') {
    throw new HttpsError('failed-precondition', 'attempt-not-checked-in');
  }

  const templateSnap = await db.doc(`questTemplates/${attempt.templateId}`).get();
  const verification = String(templateSnap.data()?.verification ?? 'photo');
  if (verification === 'photo') {
    // The photo path advances the attempt via moderateMedia, never here.
    throw new HttpsError('failed-precondition', 'photo-requires-upload');
  }

  const extra: Record<string, unknown> = {};
  if (breathingCyclesCompleted !== undefined) {
    extra.breathingCyclesCompleted = breathingCyclesCompleted;
  }
  if (breathingSkipped !== undefined) extra.breathingSkipped = breathingSkipped;

  try {
    const outcome = await finalizeVerifiedAttempt(db, attemptId, null, extra);
    return {
      status: outcome.status,
      awarded: outcome.awarded,
      balanceAfter: outcome.balanceAfter,
      level: outcome.level,
      capped: outcome.capped,
    };
  } catch (err) {
    const code = err instanceof Error ? err.message : 'verify-failed';
    throw new HttpsError('failed-precondition', code);
  }
});
