/**
 * EvolutionCountdown — orange-band countdown banner that pumps every chair's
 * multiplier by +1.0 and opens the Apex bracket the moment the timer hits.
 *
 * Reads `/api/apex/status` on mount + every 30s. Hides itself if:
 *   • no `evolution_at` is configured (env var unset → no event)
 *   • the event has already fired (`apex_unlocked === true`)
 *
 * Once the seconds counter ticks under 5 minutes the banner switches into
 * a tighter "imminent" state with bigger numbers + faster pulse.
 */
import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Flame, Zap, Users } from "lucide-react";
import ApexWishlistOptIn from "./ApexWishlistOptIn";

const API = process.env.REACT_APP_BACKEND_URL;

type ApexStatus = {
  evolution_at: string | null;
  seconds_until_evolution: number | null;
  apex_unlocked: boolean;
  pump_applied: boolean;
  race_started_at: string | null;
  activated_at: string | null;
  next_pump: Record<string, { old: number | null; new: number | null }>;
};

const splitTime = (totalSec: number) => {
  const days = Math.floor(totalSec / 86_400);
  const hours = Math.floor((totalSec % 86_400) / 3_600);
  const mins = Math.floor((totalSec % 3_600) / 60);
  const secs = totalSec % 60;
  return { days, hours, mins, secs };
};

export default function EvolutionCountdown() {
  const [status, setStatus] = useState<ApexStatus | null>(null);
  const [now, setNow] = useState<number>(Date.now());
  const [wishlist, setWishlist] = useState<{ count: number; chairs_reserved: number } | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/apex/status`);
      if (r.ok) setStatus(await r.json());
    } catch {
      /* silent */
    }
    try {
      const r2 = await fetch(`${API}/api/apex/wishlist/count`);
      if (r2.ok) setWishlist(await r2.json());
    } catch {
      /* silent */
    }
  }, []);

  // Server-state poll every 30s.
  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [load]);

  // Local 1-Hz tick for the visible countdown.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(t);
  }, []);

  if (!status || !status.evolution_at || status.apex_unlocked) return null;

  const targetMs = new Date(status.evolution_at).getTime();
  const remainingSec = Math.max(0, Math.floor((targetMs - now) / 1_000));
  const { days, hours, mins, secs } = splitTime(remainingSec);
  const imminent = remainingSec <= 300; // last 5 min
  const fired = remainingSec <= 0;

  return (
    <motion.div
      initial={{ y: -50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      data-testid="evolution-countdown"
      className={`relative w-full bg-gradient-to-r from-purple-900 via-rose-900 to-black border-b-2 ${
        imminent ? "border-yellow-300" : "border-yellow-500/70"
      } shadow-[0_10px_24px_rgba(234,179,8,0.28)] overflow-hidden`}
    >
      {/* Flicker grain */}
      <div className="absolute inset-0 opacity-15 pointer-events-none [background:radial-gradient(circle_at_30%_30%,rgba(252,211,77,0.18),transparent_60%)]" />

      <div className="relative max-w-6xl mx-auto px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <motion.div
            animate={imminent ? { scale: [1, 1.18, 1] } : { rotate: [0, 8, -8, 0] }}
            transition={{ duration: imminent ? 0.6 : 2.4, repeat: Infinity }}
          >
            <Flame className="w-6 h-6 text-yellow-300 drop-shadow-[0_0_8px_rgba(252,211,77,0.7)]" />
          </motion.div>
          <h2
            className={`font-black italic tracking-widest uppercase ${
              imminent ? "text-yellow-200 text-base sm:text-lg" : "text-yellow-300 text-sm sm:text-base"
            }`}
          >
            {fired ? "Escape Velocity firing…" : "Escape Velocity incoming"}
          </h2>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 text-white font-mono">
          {[
            { label: "d", v: days },
            { label: "h", v: hours },
            { label: "m", v: mins },
            { label: "s", v: secs, accent: true },
          ].map((cell) => (
            <div
              key={cell.label}
              data-testid={`evolution-cell-${cell.label}`}
              className={`min-w-[3rem] text-center px-2 py-1 rounded-md backdrop-blur-md ${
                cell.accent
                  ? imminent
                    ? "bg-yellow-300/20 text-yellow-200 border border-yellow-300/60 shadow-[0_0_15px_rgba(252,211,77,0.4)]"
                    : "bg-black/45 text-yellow-300"
                  : "bg-black/45"
              } ${imminent ? "text-xl sm:text-2xl" : "text-sm sm:text-lg"} font-black`}
            >
              {String(cell.v).padStart(2, "0")}
              <span className="text-[9px] uppercase tracking-widest text-white/60 ml-0.5">
                {cell.label}
              </span>
            </div>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-1 text-[10px] uppercase tracking-widest text-yellow-200/90">
          <Zap className="w-3 h-3" />
          <span>Genius sells out · Equity Master live-pricing activates</span>
        </div>
      </div>

      <p className="relative text-[10px] sm:text-[11px] text-white/75 text-center pb-2 px-3 leading-snug">
        At zero, chair price flips from the flat $20 Genius floor to{" "}
        <span className="text-yellow-300 font-black">live revenue-driven valuation</span>{" "}
        — climbing through the Floor / Genesis / Diamond / Platinum milestones as
        monthly app revenue scales.{" "}
        <span className="text-yellow-300 font-bold">
          Final $20 seats remaining before live pricing.
        </span>
      </p>

      {wishlist && wishlist.count > 0 && (
        <p
          data-testid="evolution-wishlist-social-proof"
          className="relative text-[10px] text-amber-200/90 text-center pb-1 px-3 flex items-center justify-center gap-1.5"
        >
          <Users className="w-3 h-3" />
          <span className="font-black text-amber-200">
            {wishlist.count.toLocaleString()}
          </span>
          founder{wishlist.count === 1 ? "" : "s"} already on the wishlist —{" "}
          <span className="text-amber-200 font-bold">
            {wishlist.chairs_reserved.toLocaleString()}
          </span>
          Apex chairs reserved.
        </p>
      )}

      <div className="relative flex justify-center pb-3">
        <ApexWishlistOptIn />
      </div>
    </motion.div>
  );
}
