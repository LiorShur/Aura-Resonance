import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { firebase } from './firebase';

// Thin, append-only funnel instrumentation (GDD §6). The client may write these
// but never read them back; the metrics function aggregates them server-side.
// Fire-and-forget: analytics must never block or break a user action.

export type AnalyticsEvent =
  | 'app_open'
  | 'quest_view'
  | 'quest_checkin'
  | 'quest_verified'
  | 'empathy_submit'
  | 'coop_complete'
  | 'echo_create';

export function logEvent(event: AnalyticsEvent, params: Record<string, unknown> = {}): void {
  const uid = firebase().auth.currentUser?.uid;
  if (!uid) return;
  void addDoc(collection(firebase().db, 'analytics_events'), {
    uid,
    event,
    params,
    ts: serverTimestamp(),
  }).catch(() => undefined);
}
