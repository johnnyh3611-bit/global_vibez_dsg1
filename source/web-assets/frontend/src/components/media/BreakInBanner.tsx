/**
 * Network Break-In Banner — global overlay surfaced when the AI Scout
 * fires a network-wide break-in alert (Hype Score ≥ 10,000 in any room).
 *
 * Renders only on /casino*, /dating*, /games*, /media-master* paths so
 * the founder-defined break-in moments interrupt the highest-traffic
 * surfaces without spamming the rest of the app.
 *
 * Polls /api/media-master/scout/break-ins/active every 30s. When any
 * alert is unexpired, mounts a slim animated bar across the top of the
 * viewport with a tap-through CTA to the hot room.
 */
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, X } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;
const POLL_MS = 30_000;
const DISMISS_TTL_MS = 5 * 60 * 1000; // dismissed alerts re-appear after 5 min

// Paths where the break-in banner should render. Tap matched against
// `startsWith` so subpaths inherit (e.g. /casino/blackjack triggers).
const TRIGGER_PATHS = ['/casino', '/dating', '/games', '/media-master'];

type Alert = {
  alert_id: string;
  room_id: string;
  hype_score: number;
  expires_at: string;
};

export default function BreakInBanner() {
  const location = useLocation();
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [dismissed, setDismissed] = useState<Record<string, number>>({});

  useEffect(() => {
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | null = null;

    async function load() {
      try {
        const res = await fetch(`${API_URL}/api/media-master/scout/break-ins/active`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setAlerts(data.alerts || []);
      } catch { /* silent */ }
    }

    // Only poll on trigger paths — saves cycles everywhere else.
    const isTriggerPath = TRIGGER_PATHS.some((p) => location.pathname.startsWith(p));
    if (!isTriggerPath) { setAlerts([]); return; }

    void load();
    interval = setInterval(load, POLL_MS);
    return () => { cancelled = true; if (interval) clearInterval(interval); };
  }, [location.pathname]);

  const isTriggerPath = TRIGGER_PATHS.some((p) => location.pathname.startsWith(p));
  if (!isTriggerPath) return null;

  // Filter out alerts the user dismissed within the last 5 min.
  const now = Date.now();
  const visible = alerts.filter(
    (a) => !dismissed[a.alert_id] || (now - dismissed[a.alert_id]) > DISMISS_TTL_MS,
  );
  if (visible.length === 0) return null;

  // Show only the highest-hype alert at a time — too many banners stacked
  // up at once would crowd the play surface.
  const top = [...visible].sort((a, b) => b.hype_score - a.hype_score)[0];

  return (
    <div
      data-testid="break-in-banner"
      className="fixed top-0 left-0 right-0 z-[70] pointer-events-none"
    >
      <AnimatePresence>
        <motion.div
          key={top.alert_id}
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -50, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 240, damping: 22 }}
          className="pointer-events-auto"
        >
          <div className="bg-gradient-to-r from-rose-600 via-amber-500 to-fuchsia-600 px-4 py-2.5 shadow-2xl">
            <div className="max-w-7xl mx-auto flex items-center gap-3">
              <Zap className="w-5 h-5 text-white animate-pulse flex-shrink-0" />
              <div className="flex-1 text-white text-sm font-semibold tracking-wide flex items-center gap-3 min-w-0">
                <span className="uppercase tracking-widest text-xs bg-black/30 px-2 py-0.5 rounded">BREAK-IN</span>
                <span className="truncate">
                  Room <strong>{top.room_id}</strong> is on fire — Hype Score {top.hype_score.toFixed(0)}
                </span>
              </div>
              <button
                data-testid="break-in-banner-jump"
                onClick={() => navigate(`/media-master`)}
                className="text-xs px-3 py-1 rounded-full bg-black/30 hover:bg-black/45 text-white font-semibold flex-shrink-0"
              >
                Watch
              </button>
              <button
                data-testid="break-in-banner-dismiss"
                onClick={() => setDismissed((d) => ({ ...d, [top.alert_id]: Date.now() }))}
                className="text-white/85 hover:text-white flex-shrink-0"
                aria-label="Dismiss break-in"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
