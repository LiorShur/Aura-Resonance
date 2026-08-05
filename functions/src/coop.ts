import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { z } from 'zod';
import { distanceM } from './geo.js';
import {
  computeAward,
  computeLevel,
  dayKey,
  DEFAULT_DAILY_RP_CAP,
  DEFAULT_LEVEL_THRESHOLDS,
} from './quest-core.js';
import { bothReady, checkJoin, COOP_CODE_TTL_MS, COOP_REWARD, formatCode } from './coop-core.js';

const Position = z.object({ lat: z.number(), lng: z.number() });

/**
 * Host opens a co-op Fracture and gets a 4-digit code (10-minute expiry). The
 * host's position is captured now; the guest's is checked at join.
 */
export const openCoopSession = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in first');

  const parsed = z.object({ fractureId: z.string().min(1), position: Position }).safeParse(request.data);
  if (!parsed.success) throw new HttpsError('invalid-argument', 'Bad request');
  const { fractureId, position } = parsed.data;

  const db = getFirestore();
  const fractureSnap = await db.doc(`fractures/${fractureId}`).get();
  if (!fractureSnap.exists) throw new HttpsError('not-found', 'fracture');

  // Pick a code not currently held by another waiting session.
  let code = '';
  for (let i = 0; i < 8; i++) {
    const candidate = formatCode(Math.floor(Math.random() * 10000));
    const clash = await db
      .collection('coopSessions')
      .where('code', '==', candidate)
      .where('state', '==', 'waiting')
      .limit(1)
      .get();
    if (clash.empty) {
      code = candidate;
      break;
    }
  }
  if (!code) throw new HttpsError('resource-exhausted', 'no-code-available');

  const ref = await db.collection('coopSessions').add({
    code,
    fractureId,
    hostUid: uid,
    guestUid: null,
    state: 'waiting',
    hostGeo: position,
    guestGeo: null,
    separationM: null,
    puzzleState: {},
    createdAt: FieldValue.serverTimestamp(),
    expiresAt: Timestamp.fromMillis(Date.now() + COOP_CODE_TTL_MS),
  });
  return { sessionId: ref.id, code };
});

/**
 * Guest joins with the code. Verifies both players are inside the Fracture radius
 * and within 30m of each other (GDD 3.5) before flipping the session to
 * `verified`, after which the shared puzzle opens.
 */
export const joinCoopSession = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in first');

  const parsed = z.object({ code: z.string().length(4), position: Position }).safeParse(request.data);
  if (!parsed.success) throw new HttpsError('invalid-argument', 'Bad request');
  const { code, position } = parsed.data;

  const db = getFirestore();
  const found = await db
    .collection('coopSessions')
    .where('code', '==', code)
    .where('state', '==', 'waiting')
    .limit(1)
    .get();
  if (found.empty) throw new HttpsError('not-found', 'bad-code');

  const sessionRef = found.docs[0]!.ref;
  const session = found.docs[0]!.data();
  if ((session.expiresAt as Timestamp).toMillis() < Date.now()) {
    throw new HttpsError('failed-precondition', 'code-expired');
  }
  if (session.hostUid === uid) throw new HttpsError('failed-precondition', 'own-session');

  const fractureSnap = await db.doc(`fractures/${session.fractureId}`).get();
  if (!fractureSnap.exists) throw new HttpsError('not-found', 'fracture');
  const f = fractureSnap.data()!;
  const fractureGeo = { lat: f.geo.lat, lng: f.geo.lng };
  const radius = Number(f.radiusM ?? 70);

  const separationM = Math.round(distanceM(session.hostGeo, position));
  const check = checkJoin({
    hostInRadius: distanceM(session.hostGeo, fractureGeo) <= radius,
    guestInRadius: distanceM(position, fractureGeo) <= radius,
    separationM,
  });
  if (!check.ok) throw new HttpsError('failed-precondition', check.reason ?? 'join-rejected');

  await sessionRef.update({
    guestUid: uid,
    guestGeo: position,
    separationM,
    state: 'verified',
  });
  return { sessionId: sessionRef.id, status: 'verified' as const, separationM };
});

/**
 * Complete a co-op quest once both players signal ready on the shared puzzle.
 * Heals the Fracture and awards both participants — the only place co-op RP is
 * written. Idempotent: a second call on a completed session is a no-op.
 */
export const completeCoopSession = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in first');

  const parsed = z.object({ sessionId: z.string().min(1) }).safeParse(request.data);
  if (!parsed.success) throw new HttpsError('invalid-argument', 'Bad request');
  const { sessionId } = parsed.data;

  const db = getFirestore();
  const today = dayKey(new Date());
  const cfg = (await db.doc('config/progression').get()).data() ?? {};
  const cap = Number(cfg.dailyRpCap ?? DEFAULT_DAILY_RP_CAP);
  const thresholds: number[] = Array.isArray(cfg.levels) ? cfg.levels : DEFAULT_LEVEL_THRESHOLDS;

  const sessionRef = db.doc(`coopSessions/${sessionId}`);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(sessionRef);
    if (!snap.exists) throw new HttpsError('not-found', 'session');
    const s = snap.data()!;
    if (s.hostUid !== uid && s.guestUid !== uid) {
      throw new HttpsError('permission-denied', 'not-participant');
    }
    if (s.state === 'complete') return { status: 'complete' as const, awarded: 0, alreadyDone: true };
    if (s.state !== 'verified' && s.state !== 'solving') {
      throw new HttpsError('failed-precondition', 'not-verified');
    }
    if (!bothReady(s.puzzleState)) throw new HttpsError('failed-precondition', 'not-ready');

    const fractureRef = db.doc(`fractures/${s.fractureId}`);
    const hostRef = db.doc(`users/${s.hostUid}`);
    const guestRef = db.doc(`users/${s.guestUid}`);
    const [fractureSnap, hostSnap, guestSnap] = await Promise.all([
      tx.get(fractureRef),
      tx.get(hostRef),
      tx.get(guestRef),
    ]);
    if (!fractureSnap.exists) throw new HttpsError('not-found', 'fracture');

    const award = (ref: FirebaseFirestore.DocumentReference, snapshot: FirebaseFirestore.DocumentSnapshot) => {
      if (!snapshot.exists) return;
      const u = snapshot.data()!;
      const daily =
        u.dailyRp && u.dailyRp.day === today
          ? { day: today, points: Number(u.dailyRp.points ?? 0) }
          : { day: today, points: 0 };
      const awarded = computeAward(COOP_REWARD, cap, daily.points);
      const balanceAfter = Number(u.resonancePoints ?? 0) + awarded;
      const level = computeLevel(balanceAfter, thresholds);
      const activeDayBump = u.lastActiveDay === today ? 0 : 1;
      tx.set(ref.collection('ledger').doc(), {
        delta: awarded,
        reason: 'coop_complete',
        refId: sessionId,
        balanceAfter,
        createdAt: FieldValue.serverTimestamp(),
      });
      tx.update(ref, {
        resonancePoints: balanceAfter,
        auraLevel: level,
        dailyRp: { day: today, points: daily.points + awarded },
        lastActiveDay: today,
        lastActiveAt: FieldValue.serverTimestamp(),
        'stats.questsCompleted': FieldValue.increment(1),
        'stats.distinctActiveDays': FieldValue.increment(activeDayBump),
      });
    };

    award(hostRef, hostSnap);
    award(guestRef, guestSnap);

    tx.update(fractureRef, {
      status: 'healed',
      healCount: FieldValue.increment(1),
      healedBy: FieldValue.arrayUnion(s.hostUid, s.guestUid),
      healedAt: FieldValue.serverTimestamp(),
    });
    tx.update(sessionRef, { state: 'complete', completedAt: FieldValue.serverTimestamp() });

    return { status: 'complete' as const, awarded: COOP_REWARD, alreadyDone: false };
  });
});
