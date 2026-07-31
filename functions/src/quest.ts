import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { z } from 'zod';
import {
  computeAward,
  computeLevel,
  dayKey,
  DEFAULT_DAILY_RP_CAP,
  DEFAULT_LEVEL_THRESHOLDS,
  evaluateCheckIn,
} from './quest-core.js';

const Position = z.object({ lat: z.number(), lng: z.number() });

const CheckInInput = z.object({
  attemptId: z.string().min(1),
  position: Position,
});

const VerifyInput = z.object({
  attemptId: z.string().min(1),
});

// Reward used only if a Fracture references a template that isn't seeded; keeps
// the loop from dead-ending during development.
const FALLBACK_REWARD = 20;

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
 * Complete a checked-in quest: heal the Fracture, award Resonance Points (subject
 * to the daily cap), and write the ledger entry — all in one transaction so
 * points, level, and the Fracture stay consistent. Per-verification-type proof
 * (photo/breathing/session code) is layered on in M5/M6/M8; here the checked-in
 * attempt is trusted so the loop closes end to end.
 */
export const submitVerification = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in first');

  const parsed = VerifyInput.safeParse(request.data);
  if (!parsed.success) throw new HttpsError('invalid-argument', 'Bad verification');
  const { attemptId } = parsed.data;

  const db = getFirestore();
  const now = new Date();
  const today = dayKey(now);

  // Read config once (read-only content) before the transaction.
  const cfg = (await db.doc('config/progression').get()).data() ?? {};
  const cap = Number(cfg.dailyRpCap ?? DEFAULT_DAILY_RP_CAP);
  const thresholds: number[] = Array.isArray(cfg.levels) ? cfg.levels : DEFAULT_LEVEL_THRESHOLDS;

  const attemptRef = db.doc(`questAttempts/${attemptId}`);
  const userRef = db.doc(`users/${uid}`);

  return db.runTransaction(async (tx) => {
    const attemptSnap = await tx.get(attemptRef);
    if (!attemptSnap.exists) throw new HttpsError('not-found', 'attempt');
    const attempt = attemptSnap.data()!;
    if (attempt.uid !== uid) throw new HttpsError('permission-denied', 'not-owner');
    if (attempt.state !== 'checked_in') {
      throw new HttpsError('failed-precondition', 'attempt-not-checked-in');
    }

    const fractureRef = db.doc(`fractures/${attempt.fractureId}`);
    const templateRef = db.doc(`questTemplates/${attempt.templateId}`);
    const [fractureSnap, templateSnap, userSnap] = await Promise.all([
      tx.get(fractureRef),
      tx.get(templateRef),
      tx.get(userRef),
    ]);
    if (!fractureSnap.exists) throw new HttpsError('not-found', 'fracture');
    if (!userSnap.exists) throw new HttpsError('not-found', 'user');

    const reward = Number(templateSnap.data()?.rpReward ?? FALLBACK_REWARD);
    const user = userSnap.data()!;

    const daily =
      user.dailyRp && user.dailyRp.day === today
        ? { day: today, points: Number(user.dailyRp.points ?? 0) }
        : { day: today, points: 0 };

    const awarded = computeAward(reward, cap, daily.points);
    const balanceAfter = Number(user.resonancePoints ?? 0) + awarded;
    const level = computeLevel(balanceAfter, thresholds);
    const activeDayBump = user.lastActiveDay === today ? 0 : 1;

    tx.update(attemptRef, { state: 'verified', completedAt: FieldValue.serverTimestamp() });
    tx.update(fractureRef, {
      status: 'healed',
      healCount: FieldValue.increment(1),
      healedBy: FieldValue.arrayUnion(uid),
      healedAt: FieldValue.serverTimestamp(),
    });
    tx.set(userRef.collection('ledger').doc(), {
      delta: awarded,
      reason: 'quest_complete',
      refId: attemptId,
      balanceAfter,
      createdAt: FieldValue.serverTimestamp(),
    });
    tx.update(userRef, {
      resonancePoints: balanceAfter,
      auraLevel: level,
      dailyRp: { day: today, points: daily.points + awarded },
      lastActiveDay: today,
      lastActiveAt: FieldValue.serverTimestamp(),
      'stats.questsCompleted': FieldValue.increment(1),
      'stats.distinctActiveDays': FieldValue.increment(activeDayBump),
    });

    return { status: 'verified' as const, awarded, balanceAfter, level, capped: awarded < reward };
  });
});
