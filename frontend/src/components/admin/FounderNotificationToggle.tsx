/**
 * FounderNotificationToggle — small "Enable alerts" button mounted on
 * the God-Mode dashboard. One click → asks for browser permission →
 * polling kicks in and the founder gets native push-style alerts the
 * moment a milestone fires or the Apex wishlist surges.
 */
import { useFounderNotifications } from "@/hooks/useFounderNotifications";
import { Bell, BellOff, BellRing } from "lucide-react";

export default function FounderNotificationToggle() {
  const { permission, requestPermission, supported } = useFounderNotifications();

  if (!supported) {
    return (
      <p className="text-[11px] text-slate-500" data-testid="founder-notif-unsupported">
        Browser notifications not supported on this device.
      </p>
    );
  }

  if (permission === "granted") {
    return (
      <div
        data-testid="founder-notif-active"
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-400/40 text-emerald-200 text-[11px] font-black uppercase tracking-widest"
      >
        <BellRing className="w-3.5 h-3.5 animate-pulse" />
        Alerts on — auto-poll every 60 s
      </div>
    );
  }

  if (permission === "denied") {
    return (
      <div
        data-testid="founder-notif-denied"
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-rose-500/15 border border-rose-400/40 text-rose-200 text-[11px] font-black uppercase tracking-widest"
      >
        <BellOff className="w-3.5 h-3.5" />
        Alerts blocked — re-enable in browser settings
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={requestPermission}
      data-testid="founder-notif-enable"
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-300 text-black text-[11px] font-black uppercase tracking-widest hover:bg-amber-200"
    >
      <Bell className="w-3.5 h-3.5" />
      Enable founder alerts
    </button>
  );
}
