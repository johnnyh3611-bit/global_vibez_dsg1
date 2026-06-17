/**
 * Media Master Hub — landing page for the entire DSG ecosystem:
 *   • DSG TV Network — 5 channels (2 gated)
 *   • Vibe Radio — 3 stations + skip-bidding
 *   • DSG Music Group — Studios + Artist Rolodex + Affiliate Chairs
 *   • AI Scout — Hype Score live tile + auto-generated highlights
 *
 * Lives at /media-master. Each section is a self-contained card so we
 * can promote any of them into a full dedicated page later.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Tv, Radio, Music, Sparkles, Lock, Clock3, ArrowRight, Zap } from 'lucide-react';
import BackButton from '@/components/BackButton';

const API_URL = process.env.REACT_APP_BACKEND_URL;

type TvChannel = {
  channel_id: string;
  name: string;
  tagline: string;
  category: string;
  requires_18_plus: boolean;
  requires_paywall: boolean;
  requires_secondary_pin: boolean;
  coin_price: number;
};
type Station = { station_id: string; name: string; genre: string; tagline: string };
type Studio = { studio_id: string; name: string; environment: string; hourly_rate_coins: number };
type Clip = { clip_id: string; room_id: string; hype_score: number; duration_seconds: number; created_at: string; verdict: string };
type BreakIn = { alert_id: string; room_id: string; hype_score: number };

const CATEGORY_ACCENT: Record<string, string> = {
  arena: 'from-emerald-400 to-cyan-500',
  dating: 'from-pink-400 to-rose-500',
  radio: 'from-amber-400 to-orange-500',
  adult: 'from-rose-500 to-red-700',
  horror: 'from-violet-600 to-fuchsia-700',
};

export default function MediaMasterHub() {
  const navigate = useNavigate();
  const [channels, setChannels] = useState<TvChannel[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [studios, setStudios] = useState<Studio[]>([]);
  const [clips, setClips] = useState<Clip[]>([]);
  const [breakIns, setBreakIns] = useState<BreakIn[]>([]);

  useEffect(() => { void loadAll(); }, []);

  async function loadAll() {
    const [c, s, st, recent, alerts] = await Promise.all([
      fetch(`${API_URL}/api/media-master/tv/channels`).then((r) => r.json()).catch(() => ({ channels: [] })),
      fetch(`${API_URL}/api/media-master/radio/stations`).then((r) => r.json()).catch(() => ({ stations: [] })),
      fetch(`${API_URL}/api/media-master/music/studios`).then((r) => r.json()).catch(() => ({ studios: [] })),
      fetch(`${API_URL}/api/media-master/scout/clips/recent?limit=6`).then((r) => r.json()).catch(() => ({ clips: [] })),
      fetch(`${API_URL}/api/media-master/scout/break-ins/active`).then((r) => r.json()).catch(() => ({ alerts: [] })),
    ]);
    setChannels(c.channels || []);
    setStations(s.stations || []);
    setStudios(st.studios || []);
    setClips(recent.clips || []);
    setBreakIns(alerts.alerts || []);
  }

  return (
    <div
      data-testid="media-master-hub"
      className="min-h-screen bg-[#06050a] text-white relative overflow-hidden"
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-amber-500/8 blur-[140px]" />
        <div className="absolute bottom-[-15%] right-[-10%] w-[55%] h-[55%] rounded-full bg-fuchsia-500/8 blur-[140px]" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-5 py-8">
        <BackButton to="/dashboard" label="Back" />

        <header className="mt-6 mb-12">
          <div className="flex items-center gap-3 mb-3">
            <Sparkles className="w-6 h-6 text-amber-300" />
            <span className="uppercase tracking-[0.35em] text-xs text-amber-200/80">Media Master · Network</span>
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-light leading-[1.05]">
            <span className="block text-white/95">The Network</span>
            <span className="block bg-gradient-to-r from-amber-200 via-amber-400 to-fuchsia-400 bg-clip-text text-transparent">
              Always live.
            </span>
          </h1>
          <p className="mt-5 max-w-xl text-white/70 text-base">
            Five TV channels, three radio stations, a music studio booking floor, and an AI Scout
            that surfaces the hottest moments in the network in real time.
          </p>
        </header>

        {breakIns.length > 0 && (
          <div
            data-testid="media-master-break-in-banner"
            className="mb-8 rounded-2xl bg-gradient-to-r from-rose-500/25 via-fuchsia-500/25 to-amber-400/25 ring-1 ring-amber-300/40 p-4 text-amber-100 flex items-center gap-3 animate-pulse"
          >
            <Zap className="w-5 h-5 text-amber-300" />
            <span className="text-sm font-semibold uppercase tracking-widest">
              BREAK-IN · {breakIns.length} channel{breakIns.length === 1 ? '' : 's'} on fire
            </span>
          </div>
        )}

        {/* ───── DSG TV Network ───── */}
        <section className="mb-14" data-testid="media-master-section-tv">
          <div className="flex items-baseline justify-between mb-5">
            <div className="flex items-center gap-2">
              <Tv className="w-5 h-5 text-emerald-300" />
              <h2 className="text-lg md:text-lg font-medium text-white/85">DSG TV Network</h2>
            </div>
            <span className="text-xs text-white/40">{channels.length} channels</span>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {channels.map((ch, idx) => (
              <motion.button
                key={ch.channel_id}
                data-testid={`media-master-channel-${ch.channel_id}`}
                onClick={() => navigate(`/dsg-tv/${ch.channel_id}`)}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className={`text-left rounded-2xl p-5 bg-gradient-to-br ${CATEGORY_ACCENT[ch.category] || 'from-slate-700 to-slate-900'} hover:scale-[1.02] active:scale-[0.98] transition-transform`}
              >
                <div className="flex items-center justify-between mb-3">
                  {ch.requires_paywall ? <Lock className="w-4 h-4 text-black/70" /> : <Tv className="w-4 h-4 text-black/70" />}
                  {ch.requires_18_plus && (
                    <span className="text-[10px] font-bold bg-black/40 text-amber-200 px-1.5 py-0.5 rounded">21+</span>
                  )}
                </div>
                <div className="text-black/90 font-semibold">{ch.name}</div>
                <div className="text-black/60 text-xs mt-1 min-h-[2.5rem]">{ch.tagline}</div>
                {ch.requires_paywall && (
                  <div className="mt-3 text-[11px] bg-black/30 text-amber-100 inline-block px-2 py-0.5 rounded">
                    ₵{ch.coin_price.toLocaleString()} · 24h
                  </div>
                )}
              </motion.button>
            ))}
          </div>
        </section>

        {/* ───── Vibe Radio ───── */}
        <section className="mb-14" data-testid="media-master-section-radio">
          <div className="flex items-baseline justify-between mb-5">
            <div className="flex items-center gap-2">
              <Radio className="w-5 h-5 text-amber-300" />
              <h2 className="text-lg md:text-lg font-medium text-white/85">Vibe Radio</h2>
            </div>
            <span className="text-xs text-white/40">{stations.length} stations</span>
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            {stations.map((s) => (
              <button
                key={s.station_id}
                data-testid={`media-master-station-${s.station_id}`}
                onClick={() => navigate(`/vibe-radio/${s.station_id}`)}
                className="text-left rounded-2xl p-5 bg-gradient-to-br from-[#0c0a14] to-[#100a05] ring-1 ring-amber-300/20 hover:ring-amber-300/50 transition-all"
              >
                <Radio className="w-4 h-4 text-amber-300 mb-3" />
                <div className="text-white font-semibold text-lg">{s.name}</div>
                <div className="text-amber-200/70 text-xs mt-1">{s.genre}</div>
                <div className="text-white/55 text-xs mt-2 min-h-[2.5rem]">{s.tagline}</div>
                <div className="mt-3 inline-flex items-center gap-1.5 text-xs text-amber-200">
                  Open station <ArrowRight className="w-3 h-3" />
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* ───── DSG Music Group ───── */}
        <section className="mb-14" data-testid="media-master-section-music">
          <div className="flex items-baseline justify-between mb-5">
            <div className="flex items-center gap-2">
              <Music className="w-5 h-5 text-fuchsia-300" />
              <h2 className="text-lg md:text-lg font-medium text-white/85">DSG Music Group</h2>
            </div>
            <button
              data-testid="media-master-music-open"
              onClick={() => navigate('/music-group')}
              className="text-xs text-fuchsia-200 hover:text-amber-200 inline-flex items-center gap-1"
            >
              Studio booking floor <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            {studios.map((st) => (
              <div
                key={st.studio_id}
                data-testid={`media-master-studio-${st.studio_id}`}
                className="rounded-2xl p-5 bg-gradient-to-br from-[#15071a] to-[#0c0a14] ring-1 ring-fuchsia-400/20"
              >
                <Music className="w-4 h-4 text-fuchsia-300 mb-3" />
                <div className="text-white font-semibold">{st.name}</div>
                <div className="text-white/55 text-xs mt-1">{st.environment} · per hour</div>
                <div className="text-2xl text-amber-200 mt-2">₵{st.hourly_rate_coins.toLocaleString()}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ───── AI Scout ───── */}
        <section data-testid="media-master-section-scout">
          <div className="flex items-baseline justify-between mb-5">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-300" />
              <h2 className="text-lg md:text-lg font-medium text-white/85">AI Scout · Recent Highlights</h2>
            </div>
            <span className="text-xs text-white/40">Auto-clipped 30s peaks</span>
          </div>
          {clips.length === 0 ? (
            <div className="rounded-2xl p-8 bg-white/5 ring-1 ring-white/10 text-white/60 text-sm text-center">
              No highlights yet. AI Scout will surface them as the network heats up.
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {clips.map((c) => (
                <div
                  key={c.clip_id}
                  data-testid={`media-master-clip-${c.clip_id}`}
                  className={`rounded-2xl p-5 ring-1 ${c.verdict === 'break_in' ? 'bg-gradient-to-br from-rose-500/15 to-amber-400/15 ring-amber-300/40' : 'bg-white/5 ring-white/10'}`}
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="uppercase tracking-widest text-amber-200/80">{c.verdict.replace('_', ' ')}</span>
                    <span className="inline-flex items-center gap-1 text-white/50">
                      <Clock3 className="w-3 h-3" />
                      {c.duration_seconds}s
                    </span>
                  </div>
                  <div className="text-white text-sm mt-2 truncate">Room · {c.room_id}</div>
                  <div className="text-amber-200 text-xl mt-1">Hype {c.hype_score.toFixed(0)}</div>
                  <div className="text-white/40 text-[11px] mt-1">{new Date(c.created_at).toLocaleString()}</div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
