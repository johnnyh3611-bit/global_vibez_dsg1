/**
 * PushForegroundBridge — runs once at app root. Whenever an FCM message
 * arrives while the tab is in the foreground, FCM's SW deliberately
 * suppresses the OS notification (so we don't double-fire). This bridge
 * picks up the foreground `onMessage` event and surfaces it via the
 * native Notification API — same look, same click-through behaviour.
 *
 * No-op if:
 *  - the browser doesn't support Notifications, OR
 *  - permission isn't granted, OR
 *  - Firebase Messaging fails to initialize (preview env without keys).
 */
import { useEffect } from "react";
import { getFirebaseMessaging } from "@/lib/firebase";
import { onMessage } from "firebase/messaging";

export default function PushForegroundBridge() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) return;
    if (Notification.permission !== "granted") return;

    let unsub: (() => void) | null = null;
    try {
      const messaging = getFirebaseMessaging();
      if (!messaging) return;
      unsub = onMessage(messaging, (payload) => {
        const title = payload.notification?.title || "Global Vibez DSG";
        const body = payload.notification?.body || "";
        const url = (payload.data as Record<string, string> | undefined)?.url;
        try {
          const n = new Notification(title, {
            body,
            icon: payload.notification?.icon || "/global-vibez-logo.png",
            badge: "/global-vibez-logo.png",
            tag: (payload.data as Record<string, string> | undefined)?.tag || "default",
            data: payload.data || {},
          });
          if (url) {
            n.onclick = (event) => {
              event.preventDefault();
              window.focus();
              window.location.href = url;
              n.close();
            };
          }
        } catch {
          /* legacy Notification quirks — best effort */
        }
      });
    } catch {
      /* messaging not ready — silent */
    }

    return () => {
      try {
        unsub?.();
      } catch {
        /* ignore */
      }
    };
  }, []);

  return null;
}
