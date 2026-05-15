/**
 * Network Pulse Mini-Widget — ambient signal of the hottest room +
 * latest auto-clip, surfaced on every authed page (except the Pulse
 * dashboard itself).
 *
 * Renders as a slim floating chip bottom-left so it doesn't collide
 * with the VipCrownBadge/VipConcierge (bottom-right). Polls the
 * existing /api/media-master-pulse/snapshot endpoint every 30s.
 *
 * Self-hides when:
 *   • user is not authed
 *   • no auto-clips and no hot rooms yet (no signal to share)
 *   • on the Pulse page itself (redundant)
 *   • on /login or /register pages (anti-noise)
 */
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Flame, Film } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;
const POLL_MS = 30_000;
const HIDE_PATHS = ['/login', '/register', '/auth', '/admin/media-master-pulse'];

type Snapshot = {
  hottest_rooms: Array<{ room_id: string; hype_score: number; verdict: string }>;
  recent_clips: Array<{ clip_id: string; room_id: string; hype_score: number; verdict: string; created_at: string }>;
};

export default function NetworkPulseMiniWidget() {
  const location = useLocation();
  const navigate = useNavigate();
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [authed, setAuthed] = useState<boolean>(false);

  useEffect(() => {
    setAuthed(!!localStorage.getItem('auth_token'));
  }, [location.pathname]);

  useEffect(() => {
    if (!authed) return;
    if (HIDE_PATHS.some((p) => location.pathname.startsWith(p))) return;
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`${API_URL}/api/media-master-pulse/snapshot?hot_limit=1&clip_limit=1`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setSnap(data);
      } catch { /* silent */ }
    }
    void load();
    const t = setInterval(load, POLL_MS);
    return () => { cancelled = true; clearInterval(t); };
  }, [authed, location.pathname]);

  const ticker = useMemo(() => {
    if (!snap) return null;
    const hot = snap.hottest_rooms?.[0];
    const clip = snap.recent_clips?.[0];
    if (!hot && !clip) return null;
    // Prefer the hot room if its score beats the latest clip — that's
    // the live signal; clips are historical.
    if (hot && (!clip || hot.hype_score >= clip.hype_score)) {
      return {
        kind: 'hot' as const,
        text: `Hot · ${hot.room_id.slice(0, 16)}`,
        score: hot.hype_score,
        verdict: hot.verdict,
      };
    }
    if (clip) {
      return {
        kind: 'clip' as const,
        text: `Clip · ${clip.room_id.slice(0, 16)}`,
        score: clip.hype_score,
        verdict: clip.verdict,
      };
    }
    return null;
  }, [snap]);

  if (!authed) return null;
  if (HIDE_PATHS.some((p) => location.pathname.startsWith(p))) return null;
  if (!ticker) return null;
  // Don't show ambient signal when hype is genuinely cold — feels noisy.
  if (ticker.score < 50) return null;

  const isBreakIn = ticker.verdict === 'break_in';
  const themeRing = isBreakIn ? 'ring-rose-400/50' : 'ring-amber-300/40';
  const themeGlow = isBreakIn ? 'shadow-[0_0_24px_-8px_rgba(244,63,94,0.6)]' : 'shadow-[0_0_24px_-8px_rgba(251,191,36,0.4)]';

  return (
    <div
      data-testid="network-pulse-mini-widget"
      className="fixed bottom-24 left-4 sm:bottom-6 sm:left-6 z-[55]"
    >
      <AnimatePresence>
        <motion.button
          key={ticker.text}
          onClick={() => navigate('/admin/media-master-pulse')}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -10 }}
          aria-label="Open Media Master Pulse dashboard"
          className={`flex items-center gap-2 rounded-full bg-black/85 ring-1 ${themeRing} ${themeGlow} backdrop-blur px-3 py-2 text-xs text-amber-100 hover:scale-105 active:scale-95 transition-transform`}
        >
          {ticker.kind === 'hot' ? (
            <Flame className="w-3.5 h-3.5 text-rose-300" />
          ) : (
            <Film className="w-3.5 h-3.5 text-fuchsia-300" />
          )}
          <span className="font-medium tracking-wide">{ticker.text}</span>
          <span className="text-amber-200 font-semibold">{ticker.score.toFixed(0)}</span>
        </motion.button>
      </AnimatePresence>
    </div>
  );
}
