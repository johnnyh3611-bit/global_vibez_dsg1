import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";

const API = process.env.REACT_APP_BACKEND_URL;

type ChairStatus = {
  status: "BOUGHT" | "EARNED" | "HYBRID" | "NONE";
  purchased_chairs: number;
  earned_chair_level: number;
  perks: string[];
};

/**
 * HybridStatusBadge — manifesto: visualize the 3-tier chair-holder
 * status (Bought / Earned / Hybrid) per user.
 *
 *   - BOUGHT  → static cyan glow
 *   - EARNED  → animated particle pulse
 *   - HYBRID  → reactive cyan→purple gradient ring
 */
export function HybridStatusBadge({ userId }: { userId: string }) {
  const [data, setData] = useState<ChairStatus | null>(null);

  useEffect(() => {
    if (!userId) return;
    fetch(`${API}/api/users/${userId}/chair-status`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setData);
  }, [userId]);

  if (!data || data.status === "NONE") return null;

  const visuals: Record<ChairStatus["status"], { ring: string; label: string; tooltip: string }> = {
    BOUGHT: {
      ring: "shadow-[0_0_20px_rgba(34,211,238,0.6)] border-cyan-400",
      label: "Founder Chair",
      tooltip: "Static Celestial aura — purchased chair holder",
    },
    EARNED: {
      ring: "shadow-[0_0_15px_rgba(168,85,247,0.6)] border-purple-400 animate-pulse",
      label: `Veteran ${data.earned_chair_level > 0 ? `Lv${data.earned_chair_level}` : ""}`,
      tooltip: "Particle FX — earned through gameplay",
    },
    HYBRID: {
      ring: "shadow-[0_0_25px_rgba(34,211,238,0.7)] border-2 bg-gradient-to-r from-cyan-500/20 to-purple-500/20",
      label: "Hybrid Founder",
      tooltip: "Reactive aura — bought + earned (VIP Room access)",
    },
    NONE: { ring: "", label: "", tooltip: "" },
  };

  const v = visuals[data.status];
  return (
    <Badge
      data-testid={`hybrid-status-${data.status.toLowerCase()}`}
      title={v.tooltip}
      className={`px-3 py-1 text-xs uppercase tracking-widest text-white border ${v.ring} bg-black/60`}
    >
      {v.label}
    </Badge>
  );
}
