/**
 * VIP Crown Badge — floats a small crown indicator in the bottom-right
 * of the screen for any user with an active High Roller VIP window.
 *
 * Visible across every authed page (mounted globally in App.js). Taps
 * deep-link to /casino/high-roller. Hover shows tier + days-left.
 *
 * Self-hides:
 *   • when user is not VIP (returns null silently)
 *   • when no auth_token in localStorage
 *   • when already on a /casino/high-roller* page (avoid redundant UI)
 *
 * Re-polls eligibility every 60s so a freshly-granted VIP sees the
 * badge appear without a hard refresh.
 */
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Crown } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;
const POLL_MS = 60_000;

type Eligibility = {
  is_vip: boolean;
  tier: string | null;
  vip_until: string | null;
};

const TIER_LABEL: Record<string, string> = {
  genius: 'GENIUS',
  genesis: 'GENESIS',
  apex: 'APEX',
};

export default function VipCrownBadge() {
  const navigate = useNavigate();
  const location = useLocation();
  const [el, setEl] = useState<Eligibility | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | null = null;

    async function check() {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        if (!cancelled) setEl(null);
        return;
      }
      try {
        const meRes = await fetch(`${API_URL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!meRes.ok) {
          if (!cancelled) setEl(null);
          return;
        }
        const me = await meRes.json();
        const uid = me.user_id || me.id || me._id;
        if (!uid) return;
        const r = await fetch(`${API_URL}/api/high-roller/eligibility/${uid}`);
        const data = await r.json();
        if (!cancelled) setEl(data);
      } catch {
        if (!cancelled) setEl(null);
      }
    }
    void check();
    interval = setInterval(check, POLL_MS);
    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, []);

  // Hide on the High Roller pages themselves — redundant chrome
  if (location.pathname.startsWith('/casino/high-roller')) return null;
  if (!el?.is_vip) return null;

  const daysLeft = el.vip_until
    ? Math.max(0, Math.ceil((new Date(el.vip_until).getTime() - Date.now()) / 86_400_000))
    : 0;
  const tierLabel = TIER_LABEL[el.tier || 'genius'] || 'VIP';

  return (
    <div
      data-testid="vip-crown-badge"
      className="fixed bottom-24 right-4 z-[60] sm:bottom-6 sm:right-6"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, x: 10 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.9, x: 10 }}
            className="absolute bottom-full right-0 mb-2 whitespace-nowrap rounded-xl bg-black/85 ring-1 ring-amber-300/40 px-4 py-2.5 text-sm text-amber-100 shadow-2xl"
          >
            <div className="font-semibold tracking-wide">{tierLabel} VIP</div>
            <div className="text-amber-200/70 text-xs">{daysLeft} day{daysLeft === 1 ? '' : 's'} remaining</div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        data-testid="vip-crown-badge-button"
        onClick={() => navigate('/casino/high-roller')}
        aria-label={`${tierLabel} VIP — ${daysLeft} days remaining`}
        className="relative w-14 h-14 rounded-full bg-gradient-to-br from-amber-300 via-yellow-400 to-amber-600 ring-2 ring-amber-200/60 shadow-[0_0_30px_rgba(251,191,36,0.6)] flex items-center justify-center hover:scale-110 active:scale-95 transition-transform"
      >
        {/* Gold pulse halo */}
        <span className="absolute inset-0 rounded-full bg-amber-400/40 animate-ping" />
        <Crown className="relative w-7 h-7 text-black/85 drop-shadow" />
      </button>
    </div>
  );
}
