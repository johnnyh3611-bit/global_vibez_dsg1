/**
 * /marketplace/license — DSG Music Licensing Marketplace
 *
 * Surfaces tracks the artist has explicitly opted into licensing for
 * a given context (TV sync / casino background / commercial use).
 * Built on top of `tracks_rights_ledger` so artists control supply
 * and ad-buyers / broadcasters see only legally-cleared catalog.
 *
 * Funnel:
 *   • Broadcaster lands here → toggles context (TV / casino / ad).
 *   • Browses momentum-ranked catalog of licensable tracks.
 *   • Clicks "License this Track" → opens the MME tip flow at
 *     1× rate (default), which routes 80% to the collaborator
 *     collective and 15/5 to treasury/tournament — same recirc rule.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft, Tv, Dice5, Megaphone, Music, Coins, Award,
} from 'lucide-react';
import { toast } from 'sonner';

type Context = 'tv_sync' | 'casino_background' | 'commercial_use';

type LicensableTrack = {
  track_id: string;
  title: string;
  artist_id: string;
  artist_name: string;
  cover_art_url?: string;
  momentum_score: number;
  lifetime_chart_points: number;
  rights: {
    allow_tv_sync: boolean;
    allow_casino_background: boolean;
    allow_commercial_use: boolean;
  };
};

const API = process.env.REACT_APP_BACKEND_URL || '';
const token = () => localStorage.getItem('auth_token') || '';
const fmt = (n: number) => (n ?? 0).toLocaleString('en-US');

const CONTEXTS: { key: Context; label: string; Icon: any; price: number }[] = [
  { key: 'tv_sync', label: 'TV Sync', Icon: Tv, price: 5_000 },
  { key: 'casino_background', label: 'Casino BG', Icon: Dice5, price: 2_500 },
  { key: 'commercial_use', label: 'Commercial', Icon: Megaphone, price: 15_000 },
];

export default function LicenseMarketplace() {
  const navigate = useNavigate();
  const [context, setContext] = useState<Context>('tv_sync');
  const [rows, setRows] = useState<LicensableTrack[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyTrack, setBusyTrack] = useState<string | null>(null);

  const auth = useMemo(() => ({ Authorization: `Bearer ${token()}` }), []);

  const fetchRows = useCallback(async (ctx: Context) => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/music-group/marketplace/licensable?context=${ctx}&limit=50`);
      const d = await r.json();
      setRows(d?.rows || []);
    } catch (e) {
      toast.error('Failed to load marketplace');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchRows(context); }, [context, fetchRows]);

  const licenseTrack = async (t: LicensableTrack) => {
    const price = CONTEXTS.find(c => c.key === context)?.price ?? 1000;
    setBusyTrack(t.track_id);
    try {
      // Re-use the MME's existing tip endpoint — it runs the same
      // 80/15/5 recirculation + auto-splits the 80% across collaborators.
      const r = await fetch(`${API}/api/media/tip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...auth },
        body: JSON.stringify({
          track_id: t.track_id,
          coins: price,
          room_id: `license_${context}`,
        }),
      });
      const d = await r.json();
      if (d?.ok) {
        const breakdown = d.split
          ? `· artist ${fmt(d.split.artist)} ₵ · treasury ${fmt(d.split.treasury)} ₵ · tournament ${fmt(d.split.tournament)} ₵`
          : '';
        toast.success(`Licensed "${t.title}" for ${fmt(price)} ₵ ${breakdown}`);
      } else {
        toast.error(d?.reason || 'License failed');
      }
    } catch {
      toast.error('Network error');
    } finally { setBusyTrack(null); }
  };

  const activeCtx = CONTEXTS.find(c => c.key === context)!;

  return (
    <div className="min-h-screen bg-[#06080f] text-white" data-testid="license-marketplace-page">
      <header className="sticky top-0 z-20 px-5 py-4 border-b border-purple-400/20 backdrop-blur-md bg-[#06080f]/95">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <button
            onClick={() => navigate('/explore')}
            className="text-sm flex items-center gap-2 text-white/70 hover:text-white"
            data-testid="marketplace-back"
          >
            <ChevronLeft className="w-4 h-4" /> Explore
          </button>
          <h1 className="text-base sm:text-lg font-black tracking-widest text-purple-300">
            LICENSE MARKETPLACE
          </h1>
          <span className="text-[10px] uppercase font-bold text-purple-400/70">
            80/15/5 · NO BURN
          </span>
        </div>
        <div className="max-w-5xl mx-auto mt-3 flex gap-2 overflow-x-auto" data-testid="marketplace-tabs">
          {CONTEXTS.map(({ key, label, Icon, price }) => (
            <button
              key={key}
              onClick={() => setContext(key)}
              data-testid={`marketplace-tab-${key}`}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] uppercase tracking-widest font-bold border transition-colors ${
                context === key
                  ? 'bg-purple-500/30 border-purple-400/60 text-purple-100'
                  : 'bg-white/5 border-white/10 text-white/60'
              }`}
            >
              <Icon className="w-3 h-3" /> {label} · {fmt(price)} ₵
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-5 py-6">
        <div className="rounded-2xl border border-purple-400/30 bg-purple-950/15 p-4 mb-5"
              data-testid="marketplace-context-info">
          <div className="flex items-center gap-2 mb-1">
            <activeCtx.Icon className="w-4 h-4 text-purple-300" />
            <h2 className="text-sm font-black uppercase tracking-widest text-purple-200">
              {activeCtx.label} catalog
            </h2>
          </div>
          <p className="text-[11px] text-white/60">
            Tracks below are explicitly opted-in by the artist for{' '}
            <span className="text-purple-200 font-bold">{activeCtx.label}</span>{' '}
            use. License flat rate: <span className="text-amber-200">{fmt(activeCtx.price)} ₵</span>.
            Routes 80% to the collaborator collective (auto-split via basis points), 15% treasury, 5% tournament. Burn 0.
          </p>
        </div>

        {loading ? (
          <p className="text-center text-xs text-white/40 py-8" data-testid="marketplace-loading">
            Loading licensable catalog…
          </p>
        ) : rows.length === 0 ? (
          <p className="text-center text-xs text-white/40 py-10 rounded-2xl border border-white/10 bg-white/5"
              data-testid="marketplace-empty">
            <Music className="w-6 h-6 mx-auto mb-2 text-white/30" />
            No tracks opted in for <span className="text-white/60">{activeCtx.label}</span> yet.
            Artists can enable this at <code className="font-mono text-purple-300">/artist/music-group</code>.
          </p>
        ) : (
          <ul className="grid sm:grid-cols-2 gap-3" data-testid="marketplace-grid">
            {rows.map(t => (
              <li
                key={t.track_id}
                data-testid={`license-card-${t.track_id}`}
                className="rounded-2xl border border-white/10 bg-white/5 p-4 flex gap-3"
              >
                <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-purple-500/40 to-fuchsia-500/40 flex-shrink-0 flex items-center justify-center overflow-hidden">
                  {t.cover_art_url ? (
                    <img src={t.cover_art_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Music className="w-6 h-6 text-white/70" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white truncate">{t.title}</p>
                  <p className="text-[11px] text-white/60 truncate">{t.artist_name}</p>
                  <div className="flex items-center gap-3 mt-1 text-[10px] text-white/40">
                    <span className="flex items-center gap-1">
                      <Award className="w-3 h-3 text-amber-300" /> {fmt(t.momentum_score)}
                    </span>
                    <span>· {fmt(t.lifetime_chart_points)} pts</span>
                  </div>
                  <button
                    onClick={() => licenseTrack(t)}
                    disabled={busyTrack === t.track_id}
                    data-testid={`license-btn-${t.track_id}`}
                    className="mt-2 w-full px-2 py-1.5 rounded-lg bg-purple-400 hover:bg-purple-300 text-black text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
                  >
                    <Coins className="w-3 h-3 inline mr-1" />
                    {busyTrack === t.track_id ? 'Processing…' : `License · ${fmt(activeCtx.price)} ₵`}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
