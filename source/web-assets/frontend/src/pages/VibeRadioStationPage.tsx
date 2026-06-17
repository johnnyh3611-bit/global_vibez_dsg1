/**
 * Vibe Radio station player — now-playing strip + skip-bid + keep-bid
 * + instant-buy. Polls now-playing every 6s.
 */
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Radio, FastForward, Pause, ShoppingBag } from 'lucide-react';
import BackButton from '@/components/BackButton';

const API_URL = process.env.REACT_APP_BACKEND_URL;
const POLL_MS = 6_000;

type Track = { track_id: string; title: string; artist: string; started_at: string };
type SkipBid = { bid_id: string; skip_pool: number; keep_pool: number };
type NowPlaying = { station_id: string; now_playing: Track; skip_bid: SkipBid | null };

export default function VibeRadioStationPage() {
  const navigate = useNavigate();
  const { stationId } = useParams<{ stationId: string }>();
  const [userId, setUserId] = useState<string>('');
  const [station, setStation] = useState<{ name: string; genre: string; tagline: string } | null>(null);
  const [now, setNow] = useState<NowPlaying | null>(null);
  const [skipAmount, setSkipAmount] = useState<number>(25);
  const [keepAmount, setKeepAmount] = useState<number>(10);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void initStation();
    void poll();
    const t = setInterval(poll, POLL_MS);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stationId]);

  async function initStation() {
    const token = localStorage.getItem('auth_token');
    if (!token) { navigate('/login'); return; }
    const me = await fetch(`${API_URL}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json()).catch(() => null);
    if (!me) { navigate('/login'); return; }
    setUserId(me.user_id || me.id || me._id);
    const all = await fetch(`${API_URL}/api/media-master/radio/stations`).then((r) => r.json());
    const s = (all.stations || []).find((x: { station_id: string }) => x.station_id === stationId);
    setStation(s || null);
  }

  async function poll() {
    if (!stationId) return;
    const data = await fetch(`${API_URL}/api/media-master/radio/now-playing/${stationId}`).then((r) => r.json()).catch(() => null);
    if (data) setNow(data);
  }

  async function skipBid() {
    if (!userId || !stationId) return;
    setBusy(true); setMessage(null);
    try {
      const res = await fetch(`${API_URL}/api/media-master/radio/skip-bid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, station_id: stationId, amount: skipAmount }),
      });
      const json = await res.json();
      if (!res.ok) { setMessage(json?.detail?.message || 'Skip bid failed'); return; }
      setMessage(`Skip pool now ₵${json.skip_pool.toLocaleString()}`);
      await poll();
    } finally { setBusy(false); }
  }

  async function keepBid() {
    if (!userId || !stationId) return;
    setBusy(true); setMessage(null);
    try {
      const res = await fetch(`${API_URL}/api/media-master/radio/keep-bid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, station_id: stationId, amount: keepAmount }),
      });
      const json = await res.json();
      if (!res.ok) { setMessage(json?.detail?.message || 'Keep bid failed'); return; }
      setMessage(`Keep pool now ₵${json.keep_pool.toLocaleString()}`);
      await poll();
    } finally { setBusy(false); }
  }

  async function buyTrack() {
    if (!userId || !now?.now_playing?.track_id) return;
    setBusy(true); setMessage(null);
    try {
      const res = await fetch(`${API_URL}/api/media-master/radio/buy-track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, track_id: now.now_playing.track_id, price_coins: 100 }),
      });
      const json = await res.json();
      if (!res.ok) { setMessage(json?.detail?.message || 'Purchase failed'); return; }
      setMessage('Added to your library.');
    } finally { setBusy(false); }
  }

  if (!station) {
    return (
      <div className="min-h-screen bg-[#06050a] text-white grid place-items-center">
        <div className="text-white/60">Loading station…</div>
      </div>
    );
  }

  return (
    <div data-testid="vibe-radio-station-page" className="min-h-screen bg-[#06050a] text-white">
      <div className="max-w-4xl mx-auto px-5 py-8">
        <BackButton to="/media-master" label="Back to Network" />
        <header className="mt-6 mb-8">
          <div className="flex items-center gap-2 text-amber-300/80 text-xs uppercase tracking-widest mb-2">
            <Radio className="w-4 h-4" /> Vibe Radio
          </div>
          <h1 className="text-3xl sm:text-4xl font-light">{station.name}</h1>
          <p className="text-amber-200/70 text-sm mt-1">{station.genre}</p>
          <p className="text-white/55 text-sm mt-2">{station.tagline}</p>
        </header>

        {/* Now playing */}
        <div className="rounded-3xl p-7 bg-gradient-to-br from-[#1a1410] to-[#0a0712] ring-1 ring-amber-300/30 mb-6">
          <div className="text-xs uppercase tracking-widest text-amber-200/80 mb-3">Now playing</div>
          <AnimatePresence mode="wait">
            <motion.div
              key={now?.now_playing?.track_id || 'empty'}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
            >
              <div data-testid="vibe-radio-track-title" className="text-2xl text-white">
                {now?.now_playing?.title || '—'}
              </div>
              <div className="text-white/65 text-sm mt-1">{now?.now_playing?.artist}</div>
            </motion.div>
          </AnimatePresence>

          {now?.skip_bid && (
            <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-rose-500/10 ring-1 ring-rose-400/30 px-4 py-3 text-rose-100">
                Skip pool · <span className="font-semibold">₵{now.skip_bid.skip_pool.toLocaleString()}</span>
              </div>
              <div className="rounded-xl bg-emerald-500/10 ring-1 ring-emerald-400/30 px-4 py-3 text-emerald-100">
                Keep pool · <span className="font-semibold">₵{now.skip_bid.keep_pool.toLocaleString()}</span>
              </div>
            </div>
          )}

          {message && (
            <div data-testid="vibe-radio-message" className="mt-4 text-xs text-amber-200/80">{message}</div>
          )}
        </div>

        {/* Controls */}
        <div className="grid sm:grid-cols-3 gap-4">
          <div className="rounded-2xl p-5 bg-white/5 ring-1 ring-rose-400/30">
            <FastForward className="w-5 h-5 text-rose-300 mb-2" />
            <div className="text-white font-semibold mb-3">Skip bid</div>
            <input
              data-testid="vibe-radio-skip-input"
              type="number"
              min={25}
              value={skipAmount}
              onChange={(e) => setSkipAmount(parseInt(e.target.value || '25', 10))}
              className="bg-black/40 ring-1 ring-rose-300/30 rounded-lg px-3 py-2 text-rose-100 w-full mb-2"
            />
            <button
              data-testid="vibe-radio-skip-btn"
              disabled={busy}
              onClick={skipBid}
              className="w-full rounded-full py-2 bg-gradient-to-r from-rose-400 to-red-500 text-white text-sm font-semibold disabled:opacity-60"
            >
              Skip for ₵{skipAmount.toLocaleString()}
            </button>
          </div>

          <div className="rounded-2xl p-5 bg-white/5 ring-1 ring-emerald-400/30">
            <Pause className="w-5 h-5 text-emerald-300 mb-2" />
            <div className="text-white font-semibold mb-3">Keep bid</div>
            <input
              data-testid="vibe-radio-keep-input"
              type="number"
              min={10}
              value={keepAmount}
              onChange={(e) => setKeepAmount(parseInt(e.target.value || '10', 10))}
              className="bg-black/40 ring-1 ring-emerald-300/30 rounded-lg px-3 py-2 text-emerald-100 w-full mb-2"
            />
            <button
              data-testid="vibe-radio-keep-btn"
              disabled={busy}
              onClick={keepBid}
              className="w-full rounded-full py-2 bg-gradient-to-r from-emerald-400 to-teal-500 text-black text-sm font-semibold disabled:opacity-60"
            >
              Keep for ₵{keepAmount.toLocaleString()}
            </button>
          </div>

          <div className="rounded-2xl p-5 bg-white/5 ring-1 ring-amber-400/30">
            <ShoppingBag className="w-5 h-5 text-amber-300 mb-2" />
            <div className="text-white font-semibold mb-3">Buy this track</div>
            <div className="text-white/60 text-xs mb-2">₵100 · instant purchase</div>
            <button
              data-testid="vibe-radio-buy-btn"
              disabled={busy}
              onClick={buyTrack}
              className="w-full rounded-full py-2 bg-gradient-to-r from-amber-300 to-amber-500 text-black text-sm font-semibold disabled:opacity-60"
            >
              Buy for ₵100
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
