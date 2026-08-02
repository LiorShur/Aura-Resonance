import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { z } from 'zod';
import {
  adviserAward,
  MAX_ADVICE_PER_SUBMISSION,
  validateAdvice,
  validateDilemma,
} from './empathy-core.js';
import { computeLevel, DEFAULT_LEVEL_THRESHOLDS } from './quest-core.js';

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

/** The Empathy Engine is only open to accounts past the age gate (SAFETY §1). */
async function assertAgeGate(db: FirebaseFirestore.Firestore, uid: string) {
  const snap = await db.doc(`users/${uid}`).get();
  if (!snap.exists || snap.data()?.ageConfirmed !== true) {
    throw new HttpsError('failed-precondition', 'age-gate');
  }
}

const DilemmaInput = z.object({
  bodyText: z.string(),
  category: z.string(),
});

/**
 * Create a dilemma. The client cannot write `empathySubmissions` directly (rules
 * deny it) — this is the only door in, so the crisis screen (`screenDilemma`,
 * an onCreate trigger) is unbypassable. Enters as `pending`; never visible until
 * the screen flips it to `open` (SAFETY §2).
 */
export const submitDilemma = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in first');

  const parsed = DilemmaInput.safeParse(request.data);
  if (!parsed.success) throw new HttpsError('invalid-argument', 'Bad submission');
  const { bodyText, category } = parsed.data;

  const v = validateDilemma(bodyText, category);
  if (!v.ok) throw new HttpsError('invalid-argument', v.reason ?? 'invalid');

  const db = getFirestore();
  await assertAgeGate(db, uid);

  const ref = await db.collection('empathySubmissions').add({
    authorUid: uid,
    bodyText: bodyText.trim(),
    category,
    safetyScreen: { status: 'pending', flaggedCategories: [], screenedAt: null },
    state: 'pending',
    adviceCount: 0,
    reportCount: 0,
    hidden: false,
    createdAt: FieldValue.serverTimestamp(),
    closedAt: null,
    // TTL floor: cleaned up 90 days after creation even if never closed; the
    // close path below tightens this to closedAt + 90d (SAFETY §6).
    deleteAt: Timestamp.fromMillis(Date.now() + NINETY_DAYS_MS),
  });
  return { submissionId: ref.id };
});

const AdviceInput = z.object({
  submissionId: z.string().min(1),
  text: z.string(),
});

/**
 * Offer advice on an open submission. Enforces the pool rules the client can't be
 * trusted with: the submission must be screened+open, not your own, and capped at
 * five pieces of advice (the fifth closes the pool). Advice enters `pending` and
 * is moderated by the `moderateAdvice` trigger before it's visible.
 */
export const submitAdvice = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in first');

  const parsed = AdviceInput.safeParse(request.data);
  if (!parsed.success) throw new HttpsError('invalid-argument', 'Bad advice');
  const { submissionId, text } = parsed.data;

  const v = validateAdvice(text);
  if (!v.ok) throw new HttpsError('invalid-argument', v.reason ?? 'invalid');

  const db = getFirestore();
  await assertAgeGate(db, uid);

  const subRef = db.doc(`empathySubmissions/${submissionId}`);
  const adviceRef = db.collection('empathyAdvice').doc();

  await db.runTransaction(async (tx) => {
    const sub = await tx.get(subRef);
    if (!sub.exists) throw new HttpsError('not-found', 'submission');
    const s = sub.data()!;
    if (s.safetyScreen?.status !== 'passed' || s.state !== 'open') {
      throw new HttpsError('failed-precondition', 'not-open');
    }
    if (s.authorUid === uid) throw new HttpsError('failed-precondition', 'own-submission');
    const count = Number(s.adviceCount ?? 0);
    if (count >= MAX_ADVICE_PER_SUBMISSION) {
      throw new HttpsError('failed-precondition', 'advice-full');
    }

    tx.set(adviceRef, {
      submissionId,
      authorUid: uid,
      text: text.trim(),
      moderation: { status: 'pending', labels: [] },
      rating: null,
      ratedAt: null,
      reportCount: 0,
      hidden: false,
      createdAt: FieldValue.serverTimestamp(),
    });

    const newCount = count + 1;
    const patch: Record<string, unknown> = { adviceCount: newCount };
    if (newCount >= MAX_ADVICE_PER_SUBMISSION) {
      patch.state = 'closed';
      patch.closedAt = FieldValue.serverTimestamp();
      patch.deleteAt = Timestamp.fromMillis(Date.now() + NINETY_DAYS_MS);
    }
    tx.update(subRef, patch);
  });

  await db.doc(`users/${uid}`).update({ 'stats.adviceGiven': FieldValue.increment(1) });
  return { adviceId: adviceRef.id };
});

const RateInput = z.object({
  adviceId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
});

/**
 * The submission author rates a piece of advice 1–5. Only the author may rate,
 * and the adviser is paid (once) for genuinely helpful advice. All reads happen
 * before any writes, per Firestore transaction rules.
 */
export const rateAdvice = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in first');

  const parsed = RateInput.safeParse(request.data);
  if (!parsed.success) throw new HttpsError('invalid-argument', 'Bad rating');
  const { adviceId, rating } = parsed.data;

  const db = getFirestore();
  const cfg = (await db.doc('config/progression').get()).data() ?? {};
  const thresholds: number[] = Array.isArray(cfg.levels) ? cfg.levels : DEFAULT_LEVEL_THRESHOLDS;

  const adviceRef = db.doc(`empathyAdvice/${adviceId}`);

  return db.runTransaction(async (tx) => {
    const adv = await tx.get(adviceRef);
    if (!adv.exists) throw new HttpsError('not-found', 'advice');
    const a = adv.data()!;

    const sub = await tx.get(db.doc(`empathySubmissions/${a.submissionId}`));
    if (!sub.exists || sub.data()?.authorUid !== uid) {
      throw new HttpsError('permission-denied', 'not-author');
    }

    const alreadyRated = a.rating != null;
    const award = alreadyRated ? 0 : adviserAward(rating);

    // Read the adviser BEFORE any write (all-reads-first).
    const adviserRef = db.doc(`users/${a.authorUid}`);
    const adviserSnap = award > 0 ? await tx.get(adviserRef) : null;

    tx.update(adviceRef, { rating, ratedAt: FieldValue.serverTimestamp() });

    if (award > 0 && adviserSnap?.exists) {
      const u = adviserSnap.data()!;
      const balanceAfter = Number(u.resonancePoints ?? 0) + award;
      const level = computeLevel(balanceAfter, thresholds);
      tx.set(adviserRef.collection('ledger').doc(), {
        delta: award,
        reason: 'advice_rated',
        refId: adviceId,
        balanceAfter,
        createdAt: FieldValue.serverTimestamp(),
      });
      tx.update(adviserRef, { resonancePoints: balanceAfter, auraLevel: level });
    }

    return { rating, awarded: award };
  });
});
