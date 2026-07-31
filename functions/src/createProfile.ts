import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { z } from 'zod';
import { computeAge, MIN_AGE } from './age.js';

const InputSchema = z.object({
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  homeRegion: z.string().length(2),
  displayName: z.string().trim().min(2).max(40),
  avatarSeed: z.string().min(1).max(64),
});

// Drop control characters (code < 32 or DEL). Real display-name moderation
// (Claude) lands in M4 via a moderateText trigger on update; this is only basic
// sanitation. Done by code point to avoid embedding control literals in source.
function sanitizeName(name: string): string {
  let out = '';
  for (const ch of name) {
    const code = ch.codePointAt(0) ?? 0;
    if (code >= 32 && code !== 127) out += ch;
  }
  return out.trim();
}

/**
 * Create a player's profile after the age gate (SAFETY §1). The age check is
 * authoritative HERE — never trust a client "I am 16" flag. Under-16 blocks
 * account creation and deletes the just-created auth user so nothing lingers.
 * The birth date is used to compute age and then discarded: we store only the
 * `ageConfirmed` boolean + timestamp (data minimisation, SAFETY §6).
 */
export const createProfile = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in first');

  const parsed = InputSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', 'Invalid profile details');
  }
  const { birthDate, homeRegion, displayName, avatarSeed } = parsed.data;

  const age = computeAge(birthDate);
  if (age === null) {
    throw new HttpsError('invalid-argument', 'Invalid date of birth');
  }
  if (age < MIN_AGE) {
    // Block account creation: remove the auth user so there is no lingering
    // account, and signal the client to show the plain under-age explanation.
    await getAuth().deleteUser(uid).catch(() => undefined);
    throw new HttpsError('failed-precondition', 'under_minimum_age');
  }

  const db = getFirestore();
  const ref = db.collection('users').doc(uid);

  // Idempotent: never overwrite an existing profile (would reset points/level).
  const existing = await ref.get();
  if (existing.exists) return { ok: true, alreadyExists: true };

  await ref.set({
    uid,
    displayName: sanitizeName(displayName),
    avatarSeed,
    auraLevel: 1,
    resonancePoints: 0,
    ageConfirmed: true,
    ageConfirmedAt: FieldValue.serverTimestamp(),
    homeRegion: homeRegion.toUpperCase(),
    strikes: 0,
    suspendedUntil: null,
    createdAt: FieldValue.serverTimestamp(),
    lastActiveAt: FieldValue.serverTimestamp(),
    stats: {
      questsCompleted: 0,
      distinctActiveDays: 0,
      echoesCreated: 0,
      adviceGiven: 0,
    },
  });

  return { ok: true, alreadyExists: false };
});
