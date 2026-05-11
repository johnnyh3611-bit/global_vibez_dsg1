/**
 * PushNotificationsPrompt — discreet inline banner that asks for browser
 * notification permission. Auto-hides on `denied`, `granted`, `unsupported`,
 * or if the user dismissed it this session.
 *
 * Designed to mount under the customer-side order tracking + ride tracking
 * pages where notifications materially improve UX (food ready, driver
 * arriving). Avoids the dark pattern of asking at app boot.
 */
import { useState } from "react";
import { Bell, X } from "lucide-react";
import { usePushNotifications } from "@/hooks/usePushNotifications";

const SESSION_DISMISS_KEY = "gv_push_prompt_dismissed";

export default function PushNotificationsPrompt({ context }: { context: string }) {
  const { permission, request } = usePushNotifications();
  const [dismissed, setDismissed] = useState<boolean>(() =>
    typeof window !== "undefined" && sessionStorage.getItem(SESSION_DISMISS_KEY) === "1"
  );

  if (
    permission === "granted" ||
    permission === "denied" ||
    permission === "unsupported" ||
    dismissed
  ) {
    return null;
  }

  const onEnable = async () => {
    const result = await request();
    if (result === "granted") {
      // Confirmation ping
      try {
        new Notification("Notifications enabled", {
          body: `We'll ping you for ${context} updates.`,
          icon: "/global-vibez-logo.png",
        });
      } catch {
        // ignore
      }
    }
  };

  const onDismiss = () => {
    sessionStorage.setItem(SESSION_DISMISS_KEY, "1");
    setDismissed(true);
  };

  return (
    <div
      className="relative rounded-xl border border-amber-300/30 bg-gradient-to-r from-amber-500/10 via-fuchsia-500/10 to-amber-500/10 backdrop-blur-md p-3 mb-4 flex items-start gap-3"
      data-testid="push-notifications-prompt"
    >
      <div className="flex-shrink-0 w-9 h-9 rounded-full bg-amber-500/20 flex items-center justify-center">
        <Bell className="w-4 h-4 text-amber-300" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-amber-100">
          Get pinged for {context} updates
        </p>
        <p className="text-xs text-amber-100/70 mt-0.5">
          Browser notifications fire when the status changes — even if you switch tabs.
        </p>
        <div className="flex items-center gap-2 mt-2">
          <button
            type="button"
            onClick={onEnable}
            className="px-3 py-1 rounded-full bg-amber-400 hover:bg-amber-300 text-[#1a0d05] text-xs font-bold"
            data-testid="push-notifications-enable"
          >
            Enable
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="text-[10px] uppercase tracking-widest text-amber-100/60 hover:text-white"
            data-testid="push-notifications-not-now"
          >
            Not now
          </button>
        </div>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="text-amber-100/40 hover:text-white"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
