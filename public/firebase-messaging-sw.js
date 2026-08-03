/* FCM background message handler (M10 quest reminders).
 *
 * This runs as its own service worker, separate from the PWA/Workbox one. It
 * needs the LIVE Firebase web config below — fill in the two values marked TODO
 * from your firebaseConfig (Firebase console → Project settings → Your apps).
 * These are non-secret client identifiers, safe to commit.
 */
importScripts('https://www.gstatic.com/firebasejs/10.14.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyCbCBC7nKNIcS0y8wYKrVSPUXx7yvPkxjA',
  projectId: 'aura-resonance-dev',
  messagingSenderId: 'TODO_MESSAGING_SENDER_ID', // TODO: from firebaseConfig
  appId: 'TODO_APP_ID', // TODO: from firebaseConfig
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title ?? 'Aura Resonance';
  self.registration.showNotification(title, {
    body: payload.notification?.body ?? 'A Fracture is waiting nearby.',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: payload.data ?? {},
  });
});
