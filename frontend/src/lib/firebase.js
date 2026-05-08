// Firebase SDK initialization for Global Vibez DSG
import { initializeApp, getApps } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

// NOTE: We intentionally do NOT import 'firebase/analytics'. Firebase
// Analytics auto-registers a global init hook on import, which throws
// `TypeError: e is not a function` in sandboxed preview iframes (no
// gtag/dataLayer access). We don't actually use Firebase Analytics
// anywhere; if/when we do, re-add the import and call getAnalytics()
// inside a try/catch.

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase (singleton pattern)
let app;
let messaging;
let analytics;

export function getFirebaseApp() {
  if (!app) {
    app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
  }
  return app;
}

export function getFirebaseMessaging() {
  if (!messaging) {
    const app = getFirebaseApp();
    
    // Check if browser supports messaging
    if (!('Notification' in window)) {
      // console.error('❌ This browser does not support notifications');
      return null;
    }
    
    if (!('serviceWorker' in navigator)) {
      // console.error('❌ This browser does not support service workers');
      return null;
    }
    
    try {
      messaging = getMessaging(app);
    } catch (error) {
      // console.error('❌ Error initializing Firebase Messaging:', error);
      return null;
    }
  }
  return messaging;
}

export function getFirebaseAnalytics() {
  // Disabled — see header note. Returns null so any caller no-ops cleanly.
  return null;
}

// Request notification permission and get FCM token
export async function requestNotificationPermission() {
  try {
    
    const permission = await Notification.requestPermission();
    
    if (permission === 'granted') {
      // Skip FCM registration entirely if the service worker file ships
      // with unreplaced "__FIREBASE_API_KEY__" placeholders. Some build
      // pipelines (and our preview env) don't substitute these, which
      // causes Firebase to throw `Failed to execute 'postMessage' on
      // 'Window': Request object could not be cloned` and freezes the
      // page. Cheap probe: fetch the SW file and check for placeholders.
      try {
        const swProbe = await fetch('/firebase-messaging-sw.js', { cache: 'no-store' });
        const swBody = await swProbe.text();
        if (swBody.includes('__FIREBASE_API_KEY__')) {
          // Unregister any previously-registered broken instance + bail.
          if ('serviceWorker' in navigator) {
            const regs = await navigator.serviceWorker.getRegistrations();
            for (const r of regs) {
              if ((r.active?.scriptURL || '').includes('firebase-messaging-sw')) {
                await r.unregister();
              }
            }
          }
          return null;
        }
      } catch {
        // If we can't probe, fail closed — better no push than a broken page.
        return null;
      }

      const messaging = getFirebaseMessaging();

      if (!messaging) {
        return null;
      }

      const vapidKey = process.env.REACT_APP_FIREBASE_VAPID_KEY;

      // Register service worker first
      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');

      // Get FCM token
      const token = await getToken(messaging, {
        vapidKey: vapidKey,
        serviceWorkerRegistration: registration
      });
      
      if (token) {
        return token;
      } else {
        return null;
      }
    } else {
      return null;
    }
  } catch (error) {
    // console.error('❌ Error getting notification permission:', error);
    return null;
  }
}

// Listen for foreground messages
export function onMessageListener() {
  return new Promise((resolve) => {
    const messaging = getFirebaseMessaging();
    
    if (!messaging) {
      // console.error('❌ Messaging not available for listener');
      return;
    }
    
    onMessage(messaging, (payload) => {
      resolve(payload);
    });
  });
}
