import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
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
