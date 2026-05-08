/**
 * WinnerTicker — live marquee of recent platform-wide $DSG wins.
 *
 * Polls GET /api/mining/recent-wins every 6s and seamlessly slides the feed
 * across the viewport. Empty state shows a "be the first to win" nudge so
 * the band never looks broken on a fresh install.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Trophy, Sparkles } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

type Win = { username: string; mined: number; game_type: string; at: string };

const GAME_EMOJI: Record<string, string> = {
  spades: "♠️", hearts: "♥️", uno: "🌈", war: "⚔️", crazy_eights: "8️⃣",
  gin_rummy: "🃏", rummy: "🃏", go_fish: "🐟", poker: "🎰", blackjack: "🂡",
  bid_whist: "👑", chess: "♟️", trivia: "🧠", checkers: "🟢", connect4: "🔴",
  ludo: "🎲", backgammon: "🎯", mahjong: "🀄", carrom: "🟡",
};

const prettyGame = (gt: string) => {
  const label = gt.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return `${GAME_EMOJI[gt] || "🎮"} ${label}`;
};

const sinceShort = (iso: string) => {
  try {
    const sec = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
    if (sec < 60) return `${sec}s ago`;
    if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
    if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
    return `${Math.floor(sec / 86400)}d ago`;
  } catch {
    return "";
  }
};

interface Props {
  limit?: number;
  windowHours?: number;
  className?: string;
  compact?: boolean;
}

export const WinnerTicker: React.FC<Props> = ({ limit = 20, windowHours = 24, className = "", compact = false }) => {
  const [wins, setWins] = useState<Win[]>([]);
  const [hovered, setHovered] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    const poll = async () => {
      try {
        const r = await fetch(`${API}/api/mining/recent-wins?limit=${limit}&window_hours=${windowHours}`);
        if (!r.ok) return;
        const data = await r.json();
        if (mounted.current) setWins((data.rows || []) as Win[]);
      } catch {
        /* silent — ticker is cosmetic */
      }
    };
    poll();
    const id = setInterval(poll, 6000);
    return () => {
      mounted.current = false;
      clearInterval(id);
    };
  }, [limit, windowHours]);

  // Duplicate the list so the CSS animation loops seamlessly.
  const rendered = useMemo(() => (wins.length > 0 ? [...wins, ...wins] : wins), [wins]);

  return (
    <div
      className={`relative overflow-hidden bg-gradient-to-r from-black via-fuchsia-950/40 to-black border-y border-fuchsia-500/20 ${className}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      data-testid="winner-ticker"
    >
      <div className={`flex items-center ${compact ? "h-9" : "h-11"} text-white`}>
        {/* Left label pill */}
        <div className="flex-shrink-0 flex items-center gap-2 pl-4 pr-5 font-mono text-[10px] uppercase tracking-[0.3em] text-fuchsia-300 border-r border-fuchsia-500/20 bg-black/60">
          <Trophy className="w-3.5 h-3.5 text-amber-300" />
          {compact ? "Wins" : "Live Wins"}
        </div>

        {/* Scrolling strip */}
        <div className="flex-1 relative overflow-hidden">
          {wins.length === 0 ? (
            <div className="flex items-center h-full px-4 text-xs text-white/40">
              <Sparkles className="w-3 h-3 mr-2 text-fuchsia-400" />
              Nobody's won a round in the last {windowHours}h — be the first.
            </div>
          ) : (
            <div
              className="flex gap-10 whitespace-nowrap"
              style={{
                animation: `winner-ticker-scroll ${Math.max(30, rendered.length * 3)}s linear infinite`,
                animationPlayState: hovered ? "paused" : "running",
              }}
            >
              {rendered.map((w, i) => (
                <TickerItem key={`${w.at}-${w.username}-${i}`} w={w} />
              ))}
            </div>
          )}
        </div>

        {/* Fade edge gradient */}
        <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-black to-transparent" />
      </div>

      {/* Inline keyframes so this component is self-contained */}
      <style>{`
        @keyframes winner-ticker-scroll {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
};

const TickerItem: React.FC<{ w: Win }> = ({ w }) => (
  <motion.div
    className="flex items-center gap-2 text-sm"
    initial={{ opacity: 0.7 }}
    animate={{ opacity: 1 }}
    data-testid="winner-ticker-item"
  >
    <span className="font-bold text-white">{w.username}</span>
    <span className="text-white/40">just won</span>
    <span className="text-white/90">{prettyGame(w.game_type)}</span>
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-fuchsia-500/15 border border-fuchsia-400/30 text-fuchsia-200 text-xs font-bold tabular-nums">
      +{w.mined.toFixed(2)} $DSG
    </span>
    <span className="text-[10px] text-white/30">· {sinceShort(w.at)}</span>
  </motion.div>
);

export default WinnerTicker;
