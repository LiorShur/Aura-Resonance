import { addDoc, collection, doc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { ref, uploadBytes } from 'firebase/storage';
import { firebase } from '@/lib/firebase';
import { AppError } from '@/lib/errors';
import type { LatLng } from '@/lib/geo';
import type { Fracture } from '@/features/map/types';

export type CheckInResult =
  | { status: 'checked_in'; distanceM: number }
  | { status: 'rejected'; radiusM: number; distanceM: number; remainingM: number };

export interface VerifyResult {
  status: 'verified';
  awarded: number;
  balanceAfter: number;
  level: number;
  capped: boolean;
}

/** Create the attempt in the only state the client is allowed to write. */
export async function createAttempt(fracture: Fracture): Promise<string> {
  const uid = firebase().auth.currentUser?.uid;
  if (!uid) throw new AppError('auth/required', 'Sign in first');
  const ref = await addDoc(collection(firebase().db, 'questAttempts'), {
    uid,
    fractureId: fracture.id,
    templateId: fracture.templateId,
    state: 'started',
    checkInGeo: null,
    checkInDistanceM: null,
    mediaId: null,
    breathingCyclesCompleted: null,
    coopSessionId: null,
    startedAt: serverTimestamp(),
    completedAt: null,
  });
  return ref.id;
}

export async function callCheckIn(attemptId: string, position: LatLng): Promise<CheckInResult> {
  const fn = httpsCallable<{ attemptId: string; position: LatLng }, CheckInResult>(
    firebase().functions,
    'submitCheckIn',
  );
  return (await fn({ attemptId, position })).data;
}

export async function callVerify(attemptId: string): Promise<VerifyResult> {
  const fn = httpsCallable<{ attemptId: string }, VerifyResult>(
    firebase().functions,
    'submitVerification',
  );
  return (await fn({ attemptId })).data;
}

/**
 * Upload a quest photo to the player's own pending path. The Storage-triggered
 * `moderateMedia` function does SafeSearch + face blur, discards this original,
 * and advances the attempt — the client never writes the outcome. `simVerdict`
 * is honoured only by the emulator (sim mode), to exercise the flag/block paths.
 */
export async function uploadQuestPhoto(
  attemptId: string,
  blob: Blob,
  simVerdict?: 'pass' | 'flag' | 'block',
): Promise<void> {
  const uid = firebase().auth.currentUser?.uid;
  if (!uid) throw new AppError('auth/required', 'Sign in first');
  const target = ref(firebase().storage, `uploads/${uid}/${attemptId}`);
  await uploadBytes(target, blob, {
    contentType: 'image/jpeg',
    ...(simVerdict ? { customMetadata: { simVerdict } } : {}),
  });
}

export type AttemptState =
  | 'started'
  | 'checked_in'
  | 'submitted'
  | 'verified'
  | 'rejected'
  | 'abandoned';

export interface AttemptSnapshot {
  state: AttemptState;
  awardedRp: number | null;
  awardCapped: boolean;
  heldForReview: boolean;
}

/** Live-watch an attempt so the UI can react when moderation resolves it. */
export function watchAttempt(
  attemptId: string,
  cb: (snap: AttemptSnapshot) => void,
): () => void {
  return onSnapshot(doc(firebase().db, 'questAttempts', attemptId), (d) => {
    if (!d.exists()) return;
    const data = d.data();
    cb({
      state: (data.state as AttemptState) ?? 'started',
      awardedRp: data.awardedRp ?? null,
      awardCapped: Boolean(data.awardCapped ?? false),
      heldForReview: Boolean(data.heldForReview ?? false),
    });
  });
}
