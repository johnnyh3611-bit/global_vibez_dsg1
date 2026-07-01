// Firebase Cloud Messaging Service Worker
//
// HISTORY:
//   - Earlier version shipped with __FIREBASE_*__ placeholders that the
//     build pipeline was meant to replace. The pipeline never substituted
//     them, which made `initializeApp()` throw and froze the React event
//     loop on the login page.
//   - 2026-02 polish pass: Firebase **client/web** config is intentionally
//     public (security is enforced server-side via Firestore rules + FCM
//     admin keys), so we bake the production values directly. This is the
//     same pattern Firebase docs recommend for service workers, which
//     can't read process.env at runtime.
//
// If you ever rotate the Firebase project, update FIREBASE_CONFIG below
// AND the matching REACT_APP_FIREBASE_* values in `/app/frontend/.env`.
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCy6128GnnznO_vO0-Kbtcx60DDaJBUUIA",
  authDomain: "global-vibez-dsg.firebaseapp.com",
  projectId: "global-vibez-dsg",
  storageBucket: "global-vibez-dsg.firebasestorage.app",
  messagingSenderId: "855242106787",
  appId: "1:855242106787:web:61b698146881cc902d1c16",
  measurementId: "G-XT93NJJX8B"
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
      icon: payload.notification?.icon || '/global-vibez-logo.png',
      badge: '/global-vibez-logo.png',
      tag: payload.data?.tag || 'default',
      data: payload.data || {},
      requireInteraction: false,
      vibrate: [200, 100, 200],
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

  // Take control of any already-open clients on activate, so the very
  // first push after permission grant is delivered without a refresh.
  self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
  });
  self.addEventListener('install', () => self.skipWaiting());
} else {
  // No real config — install a no-op SW that immediately self-unregisters
  // on activate, so a future deploy with real keys gets a clean slate.
  self.addEventListener('install', () => self.skipWaiting());
  self.addEventListener('activate', (e) => {
    e.waitUntil(self.registration.unregister());
  });
}
