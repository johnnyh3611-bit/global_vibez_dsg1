/**
 * useFounderNotifications — polls the admin endpoints every 60s and fires
 * native browser notifications when:
 *   • A new MilestoneQueue card appears (status=queued, never seen before)
 *   • The Apex wishlist gains 25+ new members since last seen
 *
 * Click on a notification opens the relevant X intent / God-Mode tab so
 * the founder can post in one tap from their phone or laptop.
 *
 * Auth: piggybacks on the existing admin_session cookie. If the founder
 * isn't logged into God-Mode, polling silently returns 401 — no notif.
 *
 * Why poll vs real push:
 *   Real PWA push requires VAPID keys + service worker + a backend
 *   service that stores subscription endpoints. That's overkill for a
 *   founder-only tool. Polling works on every device the founder can
 *   keep one tab open on (Chromebook, phone PWA, desktop) and ships
 *   without any new infra.
 */
import { useCallback, useEffect, useRef, useState } from "react";

const API = process.env.REACT_APP_BACKEND_URL;
const POLL_MS = 60_000;
const SEEN_KEY = "founder_notif_seen_v1";
const WISHLIST_THRESHOLD_KEY = "founder_notif_wishlist_seen_v1";

type SeenSet = Set<string>;

const loadSeen = (): SeenSet => {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
};

const saveSeen = (set: SeenSet) => {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(Array.from(set)));
  } catch {
    /* silent */
  }
};

export function useFounderNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "default",
  );
  const seenRef = useRef<SeenSet>(loadSeen());
  const lastWishlistRef = useRef<number>(
    Number(localStorage.getItem(WISHLIST_THRESHOLD_KEY) || "0"),
  );

  const requestPermission = useCallback(async () => {
    if (typeof Notification === "undefined") return;
    const p = await Notification.requestPermission();
    setPermission(p);
  }, []);

  const fire = useCallback(
    (title: string, body: string, url?: string) => {
      if (typeof Notification === "undefined" || Notification.permission !== "granted") {
        return;
      }
      const n = new Notification(title, {
        body,
        icon: "/favicon.ico",
        badge: "/favicon.ico",
        tag: title.slice(0, 60),
      });
      if (url) {
        n.onclick = () => {
          window.open(url, "_blank");
          n.close();
        };
      }
    },
    [],
  );

  const tick = useCallback(async () => {
    if (Notification.permission !== "granted") return;
    try {
      const [qR, wR] = await Promise.all([
        fetch(`${API}/api/admin/milestones/queue?status=queued`, {
          credentials: "include",
        }),
        fetch(`${API}/api/apex/wishlist/count`),
      ]);
      if (qR.ok) {
        const q = await qR.json();
        const rows: Array<{
          milestone_id: string;
          phase: string;
          threshold: number;
          twitter_intent?: string;
          share_text_short?: string;
        }> = q.rows || [];
        for (const m of rows) {
          if (seenRef.current.has(m.milestone_id)) continue;
          seenRef.current.add(m.milestone_id);
          fire(
            `${m.phase} ${m.threshold}% milestone ready`,
            m.share_text_short
              ? m.share_text_short.slice(0, 140)
              : "A new milestone card is queued. Tap to post on X.",
            m.twitter_intent,
          );
        }
        saveSeen(seenRef.current);
      }
      if (wR.ok) {
        const w = await wR.json();
        const last = lastWishlistRef.current;
        const cur = w.count || 0;
        if (cur >= last + 25) {
          // 25-member step alerts so the founder gets a "milestone moment"
          // for every chunk of social proof, not a notif per signup.
          lastWishlistRef.current = cur;
          localStorage.setItem(WISHLIST_THRESHOLD_KEY, String(cur));
          fire(
            "Apex Wishlist surge",
            `${cur.toLocaleString()} founders now reserved · ${w.chairs_reserved.toLocaleString()} chairs`,
            "/admin",
          );
        }
        // Initialise the floor on first observation so we don't spam alerts
        // for legacy signups.
        if (last === 0 && cur > 0) {
          lastWishlistRef.current = cur;
          localStorage.setItem(WISHLIST_THRESHOLD_KEY, String(cur));
        }
      }
    } catch {
      /* silent */
    }
  }, [fire]);

  useEffect(() => {
    if (typeof Notification === "undefined") return;
    if (Notification.permission !== "granted") return;
    tick();
    const t = setInterval(tick, POLL_MS);
    return () => clearInterval(t);
  }, [tick, permission]);

  return {
    permission,
    requestPermission,
    supported: typeof Notification !== "undefined",
  };
}
