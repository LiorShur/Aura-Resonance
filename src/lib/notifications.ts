import { getMessaging, getToken, isSupported } from 'firebase/messaging';
import { httpsCallable } from 'firebase/functions';
import { firebase } from './firebase';

// FCM quest reminders (v0: one per day, opt-in). Web push needs a VAPID key
// (Firebase console → Cloud Messaging → Web Push certificates) exposed as
// VITE_FCM_VAPID_KEY, and the public/firebase-messaging-sw.js service worker.

const VAPID_KEY = import.meta.env.VITE_FCM_VAPID_KEY as string | undefined;

export type EnableResult = 'enabled' | 'denied' | 'unsupported';

export async function enableReminders(): Promise<EnableResult> {
  if (!VAPID_KEY || !(await isSupported()) || !('Notification' in window)) return 'unsupported';

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return 'denied';

  const messaging = getMessaging(firebase().app);
  const token = await getToken(messaging, { vapidKey: VAPID_KEY }).catch(() => null);
  if (!token) return 'denied';

  await httpsCallable<{ token: string }, { ok: boolean }>(
    firebase().functions,
    'registerPushToken',
  )({ token });
  return 'enabled';
}

export async function disableReminders(): Promise<void> {
  await httpsCallable<{ enabled: boolean }, { ok: boolean }>(
    firebase().functions,
    'setReminders',
  )({ enabled: false });
}
