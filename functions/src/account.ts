import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

/**
 * Self-service account deletion (SAFETY §6 / M10). Removes the player's account,
 * all their UGC, and their location records, then deletes the auth user. This is
 * intentionally thorough and irreversible — it is the real "delete", not a flag.
 * Other people's content (e.g. advice written on a since-deleted submission) is
 * left intact; only the requesting user's own records are removed.
 */
export const deleteAccount = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in first');

  const db = getFirestore();

  // Delete every doc a query returns, in batches (v0 volumes are small).
  const purge = async (
    collection: string,
    field: string,
  ): Promise<number> => {
    const snap = await db.collection(collection).where(field, '==', uid).get();
    let n = 0;
    // Chunk into batches of 400 (well under the 500-write limit).
    for (let i = 0; i < snap.docs.length; i += 400) {
      const batch = db.batch();
      for (const d of snap.docs.slice(i, i + 400)) batch.delete(d.ref);
      await batch.commit();
      n += Math.min(400, snap.docs.length - i);
    }
    return n;
  };

  // The user's own UGC + activity, keyed by the various author fields.
  await purge('questAttempts', 'uid');
  await purge('empathySubmissions', 'authorUid');
  await purge('empathyAdvice', 'authorUid');
  await purge('echoes', 'authorUid');
  await purge('media', 'uid');
  await purge('analytics_events', 'uid');
  await purge('reports', 'reporterUid');
  await purge('coopSessions', 'hostUid');
  await purge('coopSessions', 'guestUid');

  // The user doc + its ledger subcollection.
  const ledger = await db.collection('users').doc(uid).collection('ledger').get();
  for (let i = 0; i < ledger.docs.length; i += 400) {
    const batch = db.batch();
    for (const d of ledger.docs.slice(i, i + 400)) batch.delete(d.ref);
    await batch.commit();
  }
  await db.doc(`users/${uid}`).delete();

  // Storage: the player's processed media and any stray raw uploads.
  const bucket = getStorage().bucket();
  await Promise.all([
    bucket.deleteFiles({ prefix: `media/${uid}/` }).catch(() => undefined),
    bucket.deleteFiles({ prefix: `uploads/${uid}/` }).catch(() => undefined),
  ]);

  // Finally the auth user — after this the caller's token is invalid.
  await getAuth().deleteUser(uid);

  return { ok: true };
});
