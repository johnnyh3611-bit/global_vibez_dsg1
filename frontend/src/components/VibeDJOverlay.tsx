/**
 * VibeDJOverlay — Glassmorphism right-side panel for in-game music
 * interaction. Implements the Master Media Engine "Vibe DJ" UI from
 * the v2 blueprint with our counter-proposal economics (80 / 15 / 5,
 * no in-app burn, ₵ everywhere).
 *
 * Mount this inside any room (card table, dice table, lounge) and
 * pass the room_id prop. Auto-loads the audio-unlock-nodes when the
 * queue is empty so artists ALWAYS rotate.
 */
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Disc3, Heart, Zap, Gift, Loader2, ChevronDown, ChevronUp, Music2 } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

type Track = {
  track_id: string;
  artist_id: string;
  artist_name: string;
  track_title: string;
  cover_art_url?: string;
  weekly_chart_points?: number;
};

const TIP_AMOUNTS = [500, 2500, 10000];      // ₵
const BOOST_AMOUNTS = [1000, 5000, 25000];   // ₵
const GIFT_AMOUNTS = [2500, 10000, 50000];   // ₵

export default function VibeDJOverlay({ roomId }: { roomId: string }) {
  const [now, setNow] = useState<Track | null>(null);
  const [busy, setBusy] = useState<'tip' | 'boost' | 'gift' | null>(null);
  const [collapsed, setCollapsed] = useState<boolean>(false);

  const fetchUnlock = async () => {
    try {
      const r = await fetch(`${API}/api/media/discovery/unlock-nodes`);
      const d = await r.json();
      const first: Track | undefined = d?.rows?.[0];
      if (first) setNow(first);
    } catch {
      /* offline-tolerant */
    }
  };

  useEffect(() => {
    fetchUnlock();
  }, []);

  const send = async (kind: 'tip' | 'boost' | 'gift', coins: number) => {
    if (!now) return;
    const token = localStorage.getItem('auth_token');
    if (!token) {
      toast.error('Sign in first to tip artists.');
      return;
    }
    const endpoint =
      kind === 'tip'
        ? 'tip'
        : kind === 'boost'
        ? 'vote-boost'
        : 'visual-gift';
    setBusy(kind);
    try {
      const res = await fetch(`${API}/api/media/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          track_id: now.track_id,
          room_id: roomId,
          coins,
        }),
      });
      const data = await res.json();
      if (res.ok && data?.ok) {
        const artistTake = data.split?.artist ?? Math.floor(coins * 0.8);
        toast.success(
          `${kind === 'tip' ? 'Tipped' : kind === 'boost' ? 'Boosted' : 'Gifted'} ${now.artist_name}`,
          {
            description: `${coins.toLocaleString()} ₵ sent · ${artistTake.toLocaleString()} ₵ to artist (80%)`,
          },
        );
      } else if (data?.reason === 'insufficient_funds') {
        toast.error('Not enough ₵ — top up your wallet.');
      } else {
        toast.error(data?.reason || data?.detail || 'Transaction failed.');
      }
    } catch {
      toast.error('Network error.');
    } finally {
      setBusy(null);
    }
  };

  if (!now) return null;

  return (
    <div
      data-testid="vibe-dj-overlay"
      className={`fixed right-4 z-30 transition-all duration-300 ${
        collapsed ? 'bottom-4 w-56' : 'top-24 w-72'
      }`}
    >
      <div className="rounded-2xl border border-fuchsia-400/30 bg-black/70 backdrop-blur-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          data-testid="vibe-dj-toggle"
          className="w-full flex items-center justify-between px-4 py-2 bg-gradient-to-r from-fuchsia-500/30 to-purple-700/30 border-b border-fuchsia-400/30 text-white"
        >
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest">
            <Disc3 className="w-3.5 h-3.5 animate-spin-slow" />
            Vibe DJ
          </div>
          {collapsed ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {!collapsed && (
          <div className="p-4 space-y-3">
            {/* Now playing */}
            <div className="flex items-center gap-3" data-testid="vibe-dj-now-playing">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-fuchsia-500 via-purple-600 to-indigo-700 flex items-center justify-center shadow-lg">
                <Music2 className="w-6 h-6 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-black text-white truncate">{now.track_title}</p>
                <p className="text-[11px] text-fuchsia-200 truncate">{now.artist_name}</p>
              </div>
            </div>

            {/* Tip row */}
            <div data-testid="vibe-dj-tip-row">
              <p className="text-[9px] uppercase tracking-widest text-fuchsia-300 mb-1 flex items-center gap-1">
                <Heart className="w-3 h-3" /> Tip artist
              </p>
              <div className="grid grid-cols-3 gap-1">
                {TIP_AMOUNTS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    disabled={busy !== null}
                    onClick={() => send('tip', c)}
                    data-testid={`vibe-dj-tip-${c}`}
                    className="text-[10px] font-bold px-2 py-1.5 rounded-md bg-pink-500/10 border border-pink-400/40 text-pink-200 hover:bg-pink-500/20 disabled:opacity-40"
                  >
                    {busy === 'tip' ? <Loader2 className="w-3 h-3 animate-spin mx-auto" /> : `${c.toLocaleString()} ₵`}
                  </button>
                ))}
              </div>
            </div>

            {/* Vote boost row */}
            <div data-testid="vibe-dj-boost-row">
              <p className="text-[9px] uppercase tracking-widest text-amber-300 mb-1 flex items-center gap-1">
                <Zap className="w-3 h-3" /> Vote boost
              </p>
              <div className="grid grid-cols-3 gap-1">
                {BOOST_AMOUNTS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    disabled={busy !== null}
                    onClick={() => send('boost', c)}
                    data-testid={`vibe-dj-boost-${c}`}
                    className="text-[10px] font-bold px-2 py-1.5 rounded-md bg-amber-500/10 border border-amber-400/40 text-amber-200 hover:bg-amber-500/20 disabled:opacity-40"
                  >
                    {busy === 'boost' ? <Loader2 className="w-3 h-3 animate-spin mx-auto" /> : `${c.toLocaleString()} ₵`}
                  </button>
                ))}
              </div>
            </div>

            {/* Visual gift row */}
            <div data-testid="vibe-dj-gift-row">
              <p className="text-[9px] uppercase tracking-widest text-cyan-300 mb-1 flex items-center gap-1">
                <Gift className="w-3 h-3" /> 3D visual gift
              </p>
              <div className="grid grid-cols-3 gap-1">
                {GIFT_AMOUNTS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    disabled={busy !== null}
                    onClick={() => send('gift', c)}
                    data-testid={`vibe-dj-gift-${c}`}
                    className="text-[10px] font-bold px-2 py-1.5 rounded-md bg-cyan-500/10 border border-cyan-400/40 text-cyan-200 hover:bg-cyan-500/20 disabled:opacity-40"
                  >
                    {busy === 'gift' ? <Loader2 className="w-3 h-3 animate-spin mx-auto" /> : `${c.toLocaleString()} ₵`}
                  </button>
                ))}
              </div>
            </div>

            {/* Footer — economics transparency */}
            <p className="text-[9px] text-white/40 text-center pt-2 border-t border-white/10">
              80% to artist · 15% Treasury · 5% Tournament Pool · 0% burn
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
