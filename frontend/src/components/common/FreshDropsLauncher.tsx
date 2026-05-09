/**
 * FreshDropsLauncher — floating top-right pill + mega-menu, globally mounted.
 *
 * Gives users a persistent doorway into every recently-shipped feature from
 * any page in the app, plus a subtle dot when there are drops they haven't
 * seen yet (synced with localStorage `fresh_drops_seen_version`).
 *
 * Hidden on: landing (`/`), auth pages, the HUD (fullscreen driver UX),
 * and any route under `/vibe-vault-admin` (god-mode isolation).
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import useCornerDockTrigger from "@/hooks/useCornerDockTrigger";
import {
  Sparkles,
  X,
  Swords,
  Trophy,
  Car,
  Gauge,
  Mic,
  Coins,
  Music,
  Moon,
  ArrowRight,
} from "lucide-react";

type Feature = {
  id: string;
  title: string;
  tagline: string;
  route: string;
  icon: React.ReactNode;
  accent: string;
  badge?: string;
};

// Bump this string when you ship a new "drop" worth a notification dot.
export const CURRENT_DROP_VERSION = "2026-02-22-drop-4";
const SEEN_KEY = "fresh_drops_seen_version";

const FEATURES: Feature[] = [
  { id: "find-player-2", title: "Find Your Player 2", tagline: "Match by games + skill", route: "/find-player-2", icon: <Sparkles className="w-5 h-5" />, accent: "from-fuchsia-500 to-cyan-400", badge: "NEW" },
  { id: "my-vibez-profile", title: "MyVibez Profile", tagline: "Stats, wins, cosmetics, gifts", route: "/me", icon: <Trophy className="w-5 h-5" />, accent: "from-pink-500 to-amber-400", badge: "NEW" },
  { id: "just-for-the-night", title: "Just for the Night", tagline: "Paid late-night rooms, vanishing chat + voice", route: "/just-for-the-night", icon: <Moon className="w-5 h-5" />, accent: "from-indigo-500 to-fuchsia-500", badge: "NEW" },
  { id: "card-royale", title: "Daily Card Royale", tagline: "5-game gauntlet tournament + Heckle chat", route: "/card-royale", icon: <Swords className="w-5 h-5" />, accent: "from-fuchsia-500 to-pink-500", badge: "NEW" },
  { id: "leaderboard", title: "Top 100 $DSG", tagline: "Live mining leaderboard", route: "/vibez-leaderboard", icon: <Trophy className="w-5 h-5" />, accent: "from-amber-400 to-orange-500", badge: "LIVE" },
  { id: "vibe-drive", title: "Vibe Drive", tagline: "Drive + stream → earn $DSG", route: "/vibe-drive", icon: <Car className="w-5 h-5" />, accent: "from-cyan-400 to-fuchsia-500", badge: "BETA" },
  { id: "vibe-drive-hud", title: "Driver HUD", tagline: "Dashboard-mount big-font HUD", route: "/vibe-drive/hud", icon: <Gauge className="w-5 h-5" />, accent: "from-emerald-400 to-cyan-500", badge: "NEW" },
  { id: "voice-mirror", title: "Voice Mirror", tagline: "Real-time voice translation", route: "/voice-mirror", icon: <Mic className="w-5 h-5" />, accent: "from-violet-500 to-fuchsia-500" },
  { id: "voice-mirror-pair", title: "Voice Mirror · Pair", tagline: "Two-way real-time translation", route: "/voice-mirror/pair", icon: <Mic className="w-5 h-5" />, accent: "from-fuchsia-500 to-cyan-400", badge: "NEW" },
  { id: "marathon", title: "Marathon Mode", tagline: "Leaderboards for TTT XL + Connect 4 XL", route: "/marathon", icon: <Trophy className="w-5 h-5" />, accent: "from-amber-300 to-rose-400", badge: "NEW" },
  { id: "tge", title: "$DSG TGE Opt-In", tagline: "Secure your Solana SPL drop allocation", route: "/tge", icon: <Coins className="w-5 h-5" />, accent: "from-yellow-400 to-pink-500", badge: "SOON" },
  { id: "spotify", title: "Connect Spotify", tagline: "Unlocks Vibe Drive bonus $DSG", route: "/spotify", icon: <Music className="w-5 h-5" />, accent: "from-emerald-500 to-emerald-400" },
];

const HIDDEN_PREFIXES = ["/login", "/signup", "/forgot-password", "/reset-password", "/vibe-drive/hud", "/vibe-vault-admin"];

const FreshDropsLauncher: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const triggerHidden = useCornerDockTrigger("fresh_drops", setOpen);
  const [seenVersion, setSeenVersion] = useState<string | null>(null);

  useEffect(() => {
    try {
      setSeenVersion(localStorage.getItem(SEEN_KEY));
    } catch {
      setSeenVersion(null);
    }
  }, []);

  const markSeen = useCallback(() => {
    try {
      localStorage.setItem(SEEN_KEY, CURRENT_DROP_VERSION);
    } catch {
      // localStorage unavailable (SSR / privacy mode) — just no-op
    }
    setSeenVersion(CURRENT_DROP_VERSION);
  }, []);

  const hasNew = seenVersion !== CURRENT_DROP_VERSION;

  const hidden = useMemo(() => {
    const p = location.pathname;
    if (p === "/") return true;
    return HIDDEN_PREFIXES.some((pre) => p.startsWith(pre));
  }, [location.pathname]);

  const go = useCallback(
    (route: string) => {
      markSeen();
      setOpen(false);
      navigate(route);
    },
    [navigate, markSeen]
  );

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (hidden) return null;

  return (
    <>
      {/* Floating pill — bottom-right to avoid overlapping any page
          header's top-right action buttons. Voice Mirror lives in the
          bottom-left, so the two docks don't collide. */}
      {!triggerHidden && (
        <button
          onClick={() => { setOpen(true); markSeen(); }}
          className="fixed bottom-4 right-4 z-[60] flex items-center gap-2 px-4 py-2.5 rounded-full bg-black/80 backdrop-blur-xl border border-fuchsia-500/40 hover:border-fuchsia-400 shadow-[0_0_30px_rgba(236,72,153,0.25)] text-white font-bold text-xs uppercase tracking-widest transition-all hover:scale-[1.03]"
          data-testid="fresh-drops-launcher-btn"
          aria-label="Open fresh drops menu"
        >
          <Sparkles className="w-4 h-4 text-fuchsia-400" />
          Fresh Drops
          {hasNew && (
            <span className="relative flex h-2 w-2" data-testid="fresh-drops-new-dot">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-fuchsia-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-fuchsia-500" />
            </span>
          )}
        </button>
      )}

      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-md flex items-start justify-center pt-20 px-4 animate-in fade-in"
          onClick={() => setOpen(false)}
          data-testid="fresh-drops-overlay"
        >
          <div
            className="relative w-full max-w-3xl bg-neutral-950 border border-fuchsia-500/30 rounded-3xl shadow-2xl p-6 md:p-8"
            onClick={(e) => e.stopPropagation()}
            data-testid="fresh-drops-menu"
          >
            <button
              onClick={() => setOpen(false)}
              className="absolute top-4 right-4 p-2 rounded-full text-neutral-400 hover:text-white hover:bg-white/5"
              data-testid="fresh-drops-close-btn"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 text-fuchsia-400 font-mono text-[10px] uppercase tracking-[0.4em] mb-2">
              <Sparkles className="w-3.5 h-3.5" /> Fresh Drops · v{CURRENT_DROP_VERSION}
            </div>
            <h2 className="text-3xl font-black italic tracking-tighter leading-none mb-1">
              Every new feature,
            </h2>
            <h2 className="text-3xl font-black italic tracking-tighter leading-none text-transparent bg-gradient-to-r from-fuchsia-500 to-cyan-400 bg-clip-text mb-6">
              one tap away.
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" data-testid="fresh-drops-grid">
              {FEATURES.map((f) => (
                <button
                  key={f.id}
                  onClick={() => go(f.route)}
                  className="group relative text-left flex items-start gap-3 p-4 rounded-2xl bg-neutral-900/60 border border-white/10 hover:border-fuchsia-500/50 transition-all hover:-translate-y-0.5"
                  data-testid={`fresh-drops-item-${f.id}`}
                >
                  <div className={`shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br ${f.accent}`}>
                    {f.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-sm truncate">{f.title}</span>
                      {f.badge && (
                        <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-fuchsia-500/20 border border-fuchsia-400/40 text-fuchsia-300 uppercase tracking-widest">
                          {f.badge}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-neutral-400 mt-0.5 leading-snug">{f.tagline}</div>
                    <div className="text-[9px] font-mono text-neutral-600 mt-1">{f.route}</div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-neutral-600 group-hover:text-fuchsia-300 group-hover:translate-x-0.5 transition-all self-center" />
                </button>
              ))}
            </div>

            <div className="mt-5 text-center text-[10px] font-mono text-neutral-600 uppercase tracking-widest">
              Press Esc to close
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default FreshDropsLauncher;
