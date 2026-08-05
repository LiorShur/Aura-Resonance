import { getFirestore, FieldValue, type Firestore } from 'firebase-admin/firestore';
import {
  computeAward,
  computeLevel,
  dayKey,
  DEFAULT_DAILY_RP_CAP,
  DEFAULT_LEVEL_THRESHOLDS,
} from './quest-core.js';

// Reward used only if a Fracture references a template that isn't seeded; keeps
// the loop from dead-ending during development.
const FALLBACK_REWARD = 20;

/** States from which an attempt may still be finalised (heal + award). */
const FINALIZABLE = new Set(['checked_in', 'submitted']);

export interface AwardOutcome {
  status: 'verified';
  awarded: number;
  balanceAfter: number;
  level: number;
  capped: boolean;
  /** True when the attempt was already verified — this call was a no-op. */
  alreadyVerified: boolean;
}

/**
 * Heal a checked-in (or submitted-for-review) attempt's Fracture and award
 * Resonance Points, in one transaction so points, level, and the Fracture stay
 * consistent. Shared by `submitVerification` (trusted, non-photo) and the
 * Storage-triggered `moderateMedia` (photo passed moderation).
 *
 * Idempotent: a storage trigger can fire more than once, so a second call on an
 * already-verified attempt is a no-op that returns the recorded award rather
 * than paying out twice.
 */
export async function finalizeVerifiedAttempt(
  db: Firestore,
  attemptId: string,
  mediaId: string | null = null,
  extra: Record<string, unknown> = {},
): Promise<AwardOutcome> {
  const now = new Date();
  const today = dayKey(now);

  const cfg = (await db.doc('config/progression').get()).data() ?? {};
  const cap = Number(cfg.dailyRpCap ?? DEFAULT_DAILY_RP_CAP);
  const thresholds: number[] = Array.isArray(cfg.levels) ? cfg.levels : DEFAULT_LEVEL_THRESHOLDS;

  const attemptRef = db.doc(`questAttempts/${attemptId}`);

  return db.runTransaction(async (tx) => {
    const attemptSnap = await tx.get(attemptRef);
    if (!attemptSnap.exists) throw new Error('attempt-not-found');
    const attempt = attemptSnap.data()!;

    if (attempt.state === 'verified') {
      return {
        status: 'verified' as const,
        awarded: Number(attempt.awardedRp ?? 0),
        balanceAfter: Number(attempt.balanceAfter ?? 0),
        level: Number(attempt.awardedLevel ?? 1),
        capped: Boolean(attempt.awardCapped ?? false),
        alreadyVerified: true,
      };
    }
    if (!FINALIZABLE.has(attempt.state)) throw new Error('attempt-not-finalizable');

    const userRef = db.doc(`users/${attempt.uid}`);
    const fractureRef = db.doc(`fractures/${attempt.fractureId}`);
    const templateRef = db.doc(`questTemplates/${attempt.templateId}`);
    const [fractureSnap, templateSnap, userSnap] = await Promise.all([
      tx.get(fractureRef),
      tx.get(templateRef),
      tx.get(userRef),
    ]);
    if (!fractureSnap.exists) throw new Error('fracture-not-found');
    if (!userSnap.exists) throw new Error('user-not-found');

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

    tx.update(attemptRef, {
      state: 'verified',
      mediaId: mediaId ?? attempt.mediaId ?? null,
      awardedRp: awarded,
      awardCapped: awarded < reward,
      awardedLevel: level,
      balanceAfter,
      completedAt: FieldValue.serverTimestamp(),
      ...extra,
    });
    tx.update(fractureRef, {
      status: 'healed',
      healCount: FieldValue.increment(1),
      healedBy: FieldValue.arrayUnion(attempt.uid),
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

    return {
      status: 'verified' as const,
      awarded,
      balanceAfter,
      level,
      capped: awarded < reward,
      alreadyVerified: false,
    };
  });
}

/**
 * Terminal outcomes written by the moderation trigger for a photo attempt that
 * did not pass. `reject` — the photo was blocked (a strike is recorded
 * separately); `hold` — moderation failed closed and a human must review, so the
 * attempt waits in `submitted` rather than spinning forever on the client.
 */
export async function markAttemptOutcome(
  db: Firestore,
  attemptId: string,
  outcome: 'reject' | 'hold',
  mediaId: string | null,
): Promise<void> {
  const attemptRef = db.doc(`questAttempts/${attemptId}`);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(attemptRef);
    if (!snap.exists) return;
    const state = snap.data()!.state;
    // Never override an already-resolved attempt (idempotent on re-fire).
    if (state === 'verified' || state === 'rejected') return;

    if (outcome === 'reject') {
      tx.update(attemptRef, {
        state: 'rejected',
        mediaId,
        completedAt: FieldValue.serverTimestamp(),
      });
    } else {
      tx.update(attemptRef, { state: 'submitted', mediaId, heldForReview: true });
    }
  });
}

export { getFirestore };
