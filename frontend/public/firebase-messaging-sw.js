// Firebase Cloud Messaging Service Worker
//
// SAFETY GUARD (Apr 27 2026):
// This file ships with `__FIREBASE_*__` placeholders that are meant to
// be replaced at build time. If they aren't (and they aren't on this
// preview pipeline), `firebase.initializeApp()` throws and that throw
// surfaces in the parent window as:
//   "Failed to execute 'postMessage' on 'Window': Request object could
//    not be cloned"
// which freezes the React event loop on the login page.
//
// We early-bail when placeholders are detected so the SW becomes a
// harmless no-op until real keys are wired into the build pipeline.
const FIREBASE_CONFIG = {
  apiKey: "__FIREBASE_API_KEY__",
  authDomain: "__FIREBASE_AUTH_DOMAIN__",
  projectId: "__FIREBASE_PROJECT_ID__",
  storageBucket: "__FIREBASE_STORAGE_BUCKET__",
  messagingSenderId: "__FIREBASE_MESSAGING_SENDER_ID__",
  appId: "__FIREBASE_APP_ID__",
  measurementId: "__FIREBASE_MEASUREMENT_ID__"
};

const HAS_REAL_CONFIG =
  FIREBASE_CONFIG.apiKey && !FIREBASE_CONFIG.apiKey.startsWith("__");

if (HAS_REAL_CONFIG) {
  importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
  importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

  firebase.initializeApp(FIREBASE_CONFIG);
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    const notificationTitle = payload.notification?.title || 'Global Vibez DSG';
    const notificationOptions = {
      body: payload.notification?.body || 'You have a new notification',
      icon: payload.notification?.icon || '/logo192.png',
      badge: '/logo192.png',
      tag: payload.data?.tag || 'default',
      data: payload.data,
      requireInteraction: false,
      vibrate: [200, 100, 200]
    };
    return self.registration.showNotification(notificationTitle, notificationOptions);
  });

  self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const urlToOpen = event.notification.data?.url || '/';
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true })
        .then((clientList) => {
          for (const client of clientList) {
            if (client.url === urlToOpen && 'focus' in client) {
              return client.focus();
            }
          }
          if (clients.openWindow) {
            return clients.openWindow(urlToOpen);
          }
        })
    );
  });
} else {
  // No real config — install a no-op SW that immediately self-unregisters
  // on activate, so a future deploy with real keys gets a clean slate.
  self.addEventListener('install', (e) => self.skipWaiting());
  self.addEventListener('activate', (e) => {
    e.waitUntil(self.registration.unregister());
  });
}
