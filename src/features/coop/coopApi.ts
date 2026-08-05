import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { firebase } from '@/lib/firebase';
import type { LatLng } from '@/lib/geo';

export type CoopState = 'waiting' | 'joined' | 'verified' | 'solving' | 'complete' | 'expired';

export interface CoopSession {
  id: string;
  code: string;
  hostUid: string;
  guestUid: string | null;
  state: CoopState;
  separationM: number | null;
  puzzleState: { hostReady?: boolean; guestReady?: boolean };
}

const call = <T, R>(name: string) => httpsCallable<T, R>(firebase().functions, name);

export async function openCoop(
  fractureId: string,
  position: LatLng,
): Promise<{ sessionId: string; code: string }> {
  return (await call<{ fractureId: string; position: LatLng }, { sessionId: string; code: string }>(
    'openCoopSession',
  )({ fractureId, position })).data;
}

export async function joinCoop(
  code: string,
  position: LatLng,
): Promise<{ sessionId: string; separationM: number }> {
  return (await call<{ code: string; position: LatLng }, { sessionId: string; separationM: number }>(
    'joinCoopSession',
  )({ code, position })).data;
}

export async function completeCoop(sessionId: string): Promise<{ awarded: number }> {
  return (await call<{ sessionId: string }, { awarded: number }>('completeCoopSession')({ sessionId }))
    .data;
}

/** Signal ready on the shared puzzle (the only client write, allowed post-verify). */
export async function setReady(sessionId: string, role: 'host' | 'guest'): Promise<void> {
  await updateDoc(doc(firebase().db, 'coopSessions', sessionId), {
    [`puzzleState.${role}Ready`]: true,
  });
}

export function watchSession(sessionId: string, cb: (s: CoopSession | null) => void): () => void {
  return onSnapshot(doc(firebase().db, 'coopSessions', sessionId), (d) => {
    if (!d.exists()) return cb(null);
    const data = d.data();
    cb({
      id: d.id,
      code: String(data.code ?? ''),
      hostUid: String(data.hostUid ?? ''),
      guestUid: (data.guestUid as string | null) ?? null,
      state: (data.state as CoopState) ?? 'waiting',
      separationM: (data.separationM as number | null) ?? null,
      puzzleState: (data.puzzleState as CoopSession['puzzleState']) ?? {},
    });
  });
}
