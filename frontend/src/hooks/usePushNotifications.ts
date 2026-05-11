/**
 * usePushNotifications — thin wrapper around the browser's Notification API.
 *
 * Strategy:
 *  - Foreground/local notifications fire via `new Notification(...)`. We
 *    trigger these from the existing order/ride status pollers — that gives
 *    us "your food is ready", "driver accepted", etc. without needing a
 *    backend push server.
 *  - Background/push notifications (when the tab is closed) are delivered
 *    by the existing Firebase Cloud Messaging service worker at
 *    `/firebase-messaging-sw.js`. That path is only active once the build
 *    pipeline substitutes the FCM API key placeholders.
 *
 * Preference is persisted in `localStorage.gv_push_pref` so we don't pester
 * users who've denied OR explicitly opted in already.
 */
import { useCallback, useEffect, useState } from "react";

export type PushPermissionState = "default" | "granted" | "denied" | "unsupported";

const STORAGE_KEY = "gv_push_pref";

function detectPermission(): PushPermissionState {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  return Notification.permission as PushPermissionState;
}

export function usePushNotifications() {
  const [permission, setPermission] = useState<PushPermissionState>(() => detectPermission());

  useEffect(() => {
    setPermission(detectPermission());
  }, []);

  const request = useCallback(async (): Promise<PushPermissionState> => {
    if (permission === "unsupported") return "unsupported";
    if (permission === "denied") return "denied";
    if (permission === "granted") {
      localStorage.setItem(STORAGE_KEY, "granted");
      return "granted";
    }
    try {
      const result = await Notification.requestPermission();
      setPermission(result as PushPermissionState);
      localStorage.setItem(STORAGE_KEY, result);
      return result as PushPermissionState;
    } catch {
      return "denied";
    }
  }, [permission]);

  /**
   * Fire a local browser notification. Safe no-op when permission isn't
   * granted (so callers don't have to gate every call).
   */
  const notify = useCallback(
    (title: string, opts: NotificationOptions & { url?: string } = {}) => {
      if (typeof window === "undefined") return;
      if (!("Notification" in window)) return;
      if (Notification.permission !== "granted") return;
      try {
        const n = new Notification(title, {
          icon: "/global-vibez-logo.png",
          badge: "/global-vibez-logo.png",
          ...opts,
        });
        if (opts.url) {
          n.onclick = (event) => {
            event.preventDefault();
            window.focus();
            window.location.href = opts.url as string;
            n.close();
          };
        }
      } catch {
        // Some browsers throw on legacy Notification args — best effort only.
      }
    },
    []
  );

  return { permission, request, notify };
}
