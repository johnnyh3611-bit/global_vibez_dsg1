/**
 * PublicHealthBadge — small public trust badge for the landing page.
 *
 * Pulls anonymized stats from `/api/economy/health` + `/api/chairs/phase`
 * and renders a single-line live status pill: "🟢 Platform health: Healthy
 * · 4 chairs sold today". Builds visible social proof during launch.
 */
import { useEffect, useState } from "react";
import { motion } from "framer-motion";

const API = process.env.REACT_APP_BACKEND_URL;

type Health = {
  zone: string;
  ratio: number;
  payout_multiplier: number;
  emergency_lock: boolean;
};

type Phase = {
  phase: string;
  total_sold: number;
};

const ZONE_DOT: Record<string, { color: string; emoji: string }> = {
  Healthy: { color: "text-cyan-300", emoji: "🟢" },
  Caution: { color: "text-amber-300", emoji: "🟡" },
  Critical: { color: "text-rose-300", emoji: "🔴" },
  Locked: { color: "text-rose-400", emoji: "🔒" },
};

export default function PublicHealthBadge() {
  const [health, setHealth] = useState<Health | null>(null);
  const [phase, setPhase] = useState<Phase | null>(null);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const [h, p] = await Promise.all([
          fetch(`${API}/api/economy/health`).then((r) => (r.ok ? r.json() : null)),
          fetch(`${API}/api/chairs/phase`).then((r) => (r.ok ? r.json() : null)),
        ]);
        if (cancelled) return;
        if (h) setHealth(h);
        if (p) setPhase(p);
      } catch {
        /* silent — landing page must never break */
      }
    };
    tick();
    const id = setInterval(tick, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (!health || !phase) return null;

  const dot = ZONE_DOT[health.zone] || ZONE_DOT.Healthy;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      data-testid="public-health-badge"
      className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/40 backdrop-blur-xl px-4 py-1.5 text-[11px] font-bold tracking-wider"
    >
      <motion.span
        animate={
          health.zone === "Healthy"
            ? { opacity: [1, 0.6, 1] }
            : { opacity: [1, 0.3, 1] }
        }
        transition={{ repeat: Infinity, duration: 2 }}
        className="text-base leading-none"
      >
        {dot.emoji}
      </motion.span>
      <span className={`uppercase tracking-widest ${dot.color}`}>
        Platform · {health.zone}
      </span>
      <span className="text-slate-500">·</span>
      <span className="text-amber-200">
        {phase.total_sold.toLocaleString()} chairs parked
      </span>
      <span className="text-slate-500">·</span>
      <span className="text-cyan-300">{phase.phase} phase</span>
    </motion.div>
  );
}
