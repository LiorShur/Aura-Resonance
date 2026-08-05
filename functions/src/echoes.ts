import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { z } from 'zod';
import { validateEcho } from './coop-core.js';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const DAILY_ECHO_LIMIT = 3; // GDD 3.4

const EchoInput = z.object({
  text: z.string(),
  geo: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    geohash: z.string().min(1).max(12),
  }),
});

/**
 * Create a geo-anchored Echo (GDD 3.4). Enters `pending` and is moderated by the
 * moderateEcho trigger before it is ever visible (rules require moderation.status
 * == pass). Rate-limited to 3 per day. The geohash is client-computed (same
 * geofire scheme as Fractures) so the map's proximity query can find it; position
 * is the player's claimed location, which is all a geo-anchored message can be.
 */
export const createEcho = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in first');

  const parsed = EchoInput.safeParse(request.data);
  if (!parsed.success) throw new HttpsError('invalid-argument', 'Bad echo');
  const { text, geo } = parsed.data;

  const v = validateEcho(text);
  if (!v.ok) throw new HttpsError('invalid-argument', v.reason ?? 'invalid');

  const db = getFirestore();

  // Rate limit: at most DAILY_ECHO_LIMIT in the last 24h.
  const since = Timestamp.fromMillis(Date.now() - DAY_MS);
  const recent = await db
    .collection('echoes')
    .where('authorUid', '==', uid)
    .where('createdAt', '>=', since)
    .count()
    .get();
  if (recent.data().count >= DAILY_ECHO_LIMIT) {
    throw new HttpsError('resource-exhausted', 'daily-echo-limit');
  }

  const ref = await db.collection('echoes').add({
    authorUid: uid,
    text: text.trim(),
    geo,
    moderation: { status: 'pending', labels: [] },
    reportCount: 0,
    hidden: false,
    createdAt: FieldValue.serverTimestamp(),
    expiresAt: Timestamp.fromMillis(Date.now() + THIRTY_DAYS_MS),
  });
  return { echoId: ref.id };
});
