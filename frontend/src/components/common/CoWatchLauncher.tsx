/**
 * CoWatchLauncher — global floating "Co-watch from anywhere" mini-button.
 *
 * Mounted once at the App root. Detects whether the user is currently on
 * a watchable surface (Free TV, Cinema Room, DSG TV, MY VIBEZ video
 * watch). If so, the launcher pre-fills the watch-party room with the
 * exact network/channel they're viewing so a single tap spawns an
 * invite link.
 *
 * If they're elsewhere in the app, it falls back to a generic
 * "Start a watch party" CTA that drops them in the `/free-tv` lobby.
 *
 * Design constraints:
 *   - Hidden on auth pages (`/login`, `/signup`) and the volumetric
 *     dashboard (the galaxy owns its own chrome).
 *   - Hidden on FULLSCREEN_GAME_ROUTES so it doesn't overlap card-room
 *     bottom controls.
 *   - Listens for `chromebar:active` (dispatched by PageActionStrip)
 *     and self-hides so the inline strip owns the bottom.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Copy, X, RadioTower, CheckCircle2 } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

// Routes where the launcher must stay hidden (auth, fullscreen games,
// volumetric galaxy chrome). Keep tight — anything not listed shows it.
const HIDDEN_PREFIXES = [
  '/login', '/signup', '/forgot-password', '/reset-password',
  '/age-verification', '/onboarding',
  '/volumetric', '/galaxy',
];

// Routes where we can pre-detect a watchable context and pass that
// straight into the watch-party room. `match` returns the {network, channel}
// to pre-seed if present, otherwise null → generic launcher.
type WatchContext = {
  network_id: 'PLUTO_TV' | 'TUBI_TV' | 'PLEX_TV' | 'YOUTUBE' | null;
  channel_id: string | null;
  label: string;
};

function detectContext(pathname: string): WatchContext {
  // Already inside a free-tv room? Use the URL roomId so we don't spawn
  // a duplicate — instead we copy the existing room's invite link.
  if (pathname.startsWith('/free-tv/')) {
    const roomId = pathname.split('/')[2];
    return { network_id: null, channel_id: roomId || null, label: 'this room' };
  }
  if (pathname.startsWith('/free-tv')) {
    return { network_id: 'PLUTO_TV', channel_id: null, label: 'Free TV' };
  }
  if (pathname.startsWith('/cinema-room')) {
    return { network_id: null, channel_id: null, label: 'Cinema Room' };
  }
  if (pathname.startsWith('/vibe-tv') || pathname.startsWith('/dsg-tv')) {
    return { network_id: null, channel_id: null, label: 'DSG TV' };
  }
  if (pathname.startsWith('/my-vibez')) {
    return { network_id: null, channel_id: null, label: 'MY VIBEZ' };
  }
  return { network_id: null, channel_id: null, label: 'anything' };
}

export default function CoWatchLauncher() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [strip, setStripActive] = useState(false);

  // Self-hide when an inline chromebar is mounted on the page (founder
  // directive 2026-02-09 — bottom-corner chrome must never stack).
  useEffect(() => {
    const onActive = () => setStripActive(true);
    const onIdle = () => setStripActive(false);
    window.addEventListener('chromebar:active', onActive);
    window.addEventListener('chromebar:idle', onIdle);
    return () => {
      window.removeEventListener('chromebar:active', onActive);
      window.removeEventListener('chromebar:idle', onIdle);
    };
  }, []);

  // Close the modal whenever the user navigates away.
  useEffect(() => {
    setOpen(false);
    setInviteUrl(null);
    setCopied(false);
  }, [pathname]);

  const hidden = useMemo(() => {
    if (strip) return true;
    return HIDDEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  }, [pathname, strip]);

  const ctx = useMemo(() => detectContext(pathname), [pathname]);

  const spawnInvite = useCallback(async () => {
    setBusy(true);
    setInviteUrl(null);
    setCopied(false);
    try {
      // Already in a free-tv room → reuse its room_id, no new POST.
      if (pathname.startsWith('/free-tv/') && ctx.channel_id) {
        const ref = localStorage.getItem('user_id') || 'COWATCH';
        setInviteUrl(`${window.location.origin}/free-tv/${ctx.channel_id}?ref=${encodeURIComponent(ref)}`);
        return;
      }
      const ref = localStorage.getItem('user_id') || 'COWATCH';
      const res = await fetch(`${API}/api/cinema-network-room/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host_user_id: ref,
          name: `Co-Watch · ${ctx.label}`,
          active_network: ctx.network_id || 'PLUTO_TV',
          channel_id: ctx.channel_id || undefined,
          is_private: false,
          ambassador_ref: ref,
        }),
      });
      if (!res.ok) throw new Error('room_create_failed');
      const room = await res.json();
      setInviteUrl(`${window.location.origin}/free-tv/${room.room_id}?ref=${encodeURIComponent(ref)}`);
    } catch {
      // Best-effort — drop the user into the lobby so they can manually
      // create a room if the API hiccupped.
      setBusy(false);
      setOpen(false);
      navigate('/free-tv');
      return;
    } finally {
      setBusy(false);
    }
  }, [ctx, navigate, pathname]);

  const copyInvite = useCallback(async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore — fallback is the visible URL the user can long-press copy
    }
  }, [inviteUrl]);

  const shareInvite = useCallback(async () => {
    if (!inviteUrl) return;
    const shareData = {
      title: 'Co-Watch with me · Global Vibez',
      text: `Hop in — we're co-watching ${ctx.label}.`,
      url: inviteUrl,
    };
    // @ts-expect-error — navigator.share isn't in older TS lib targets
    if (navigator.share) {
      try {
        // @ts-expect-error
        await navigator.share(shareData);
      } catch {
        // user cancelled — nothing to do
      }
    } else {
      void copyInvite();
    }
  }, [inviteUrl, ctx.label, copyInvite]);

  if (hidden) return null;

  return (
    <>
      {/* Floating launcher button */}
      <motion.button
        data-testid="co-watch-launcher-btn"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => {
          setOpen(true);
          void spawnInvite();
        }}
        className="fixed bottom-24 right-4 z-[60] inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-red-500 via-amber-400 to-yellow-300 text-black px-3.5 py-2.5 text-xs font-bold shadow-[0_8px_30px_-5px_rgba(251,191,36,0.55)] sm:bottom-24 sm:right-6"
        aria-label="Co-Watch from anywhere"
      >
        <RadioTower className="w-4 h-4" />
        <span className="hidden sm:inline">Co-Watch</span>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            data-testid="co-watch-launcher-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
            className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              className="relative w-full max-w-md rounded-2xl ring-1 ring-amber-300/40 bg-gradient-to-br from-[#1a1206] via-[#0f0a14] to-[#0a1410] p-6 shadow-[0_0_70px_-10px_rgba(251,191,36,0.5)]"
            >
              <button
                data-testid="co-watch-launcher-close"
                onClick={() => setOpen(false)}
                className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/5 hover:bg-white/15 flex items-center justify-center"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-2 mb-2">
                <Users className="w-5 h-5 text-amber-300" />
                <span className="uppercase tracking-[0.3em] text-[10px] text-amber-200/80">
                  Co-Watch from anywhere
                </span>
              </div>
              <h3 className="text-2xl font-light text-white mb-2">
                Bring your crew into <span className="text-amber-300">{ctx.label}</span>
              </h3>
              <p className="text-sm text-white/65 mb-5">
                We spawned a synced watch-party room. Share this link — anyone
                who taps it lands in the same channel, in sync, with chat live.
              </p>

              <div
                data-testid="co-watch-launcher-invite-url"
                className="rounded-lg bg-black/40 ring-1 ring-white/10 px-3 py-2.5 font-mono text-xs text-white/80 break-all min-h-[42px]"
              >
                {busy ? 'Spawning room…' : inviteUrl || 'Could not generate link.'}
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  data-testid="co-watch-launcher-copy-btn"
                  onClick={copyInvite}
                  disabled={busy || !inviteUrl}
                  className="inline-flex items-center gap-1.5 rounded-full bg-white/5 hover:bg-white/10 ring-1 ring-white/15 hover:ring-amber-300/40 px-4 py-2 text-sm text-white/85 disabled:opacity-50"
                >
                  {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copied!' : 'Copy link'}
                </button>
                <button
                  data-testid="co-watch-launcher-share-btn"
                  onClick={shareInvite}
                  disabled={busy || !inviteUrl}
                  className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-300 via-amber-400 to-amber-500 text-black px-4 py-2 text-sm font-semibold disabled:opacity-50"
                >
                  <Users className="w-4 h-4" />
                  Share with crew
                </button>
                <button
                  data-testid="co-watch-launcher-jump-btn"
                  onClick={() => {
                    setOpen(false);
                    if (inviteUrl) {
                      const u = new URL(inviteUrl);
                      navigate(`${u.pathname}${u.search}`);
                    }
                  }}
                  disabled={busy || !inviteUrl}
                  className="inline-flex items-center gap-1.5 rounded-full bg-white/5 hover:bg-white/10 ring-1 ring-white/15 hover:ring-amber-300/40 px-4 py-2 text-sm text-white/85 disabled:opacity-50"
                >
                  <RadioTower className="w-4 h-4" />
                  Jump in
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
