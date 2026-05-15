/**
 * Media Master Pulse — founder analytics dashboard.
 *
 * Single-pane real-time view of where attention and money are flowing
 * across the Media Master ecosystem. Read-only — refreshes every 10s.
 *
 * Sections:
 *   • Top hottest rooms (by Hype Score)
 *   • Vibe Radio stations (skip/keep pool size, most-pressured first)
 *   • DSG TV channel revenue (lifetime ₵ deposited)
 *   • Affiliate Chair sponsor leaderboard
 *   • Active break-in alerts
 *   • Recent auto-clips strip
 */
import { useEffect, useState } from 'react';
import { Flame, Radio, Tv, Trophy, Zap, Film } from 'lucide-react';
import BackButton from '@/components/BackButton';

const API_URL = process.env.REACT_APP_BACKEND_URL;
const POLL_MS = 10_000;

type Snapshot = {
  generated_at: string;
  hottest_rooms: Array<{ room_id: string; hype_score: number; verdict: string; updated_at: string }>;
  station_bid_pools: Array<{ station_id: string; name: string; skip_pool: number; keep_pool: number; track_id: string | null }>;
  channel_revenue: Array<{ channel_id: string; name: string; lifetime_coins: number; paywall: boolean; coin_price?: number }>;
  sponsor_leaderboard: Array<{ chair_user_id: string; sponsorship_count: number; lifetime_payouts_coins: number }>;
  active_break_ins: Array<{ alert_id: string; room_id: string; hype_score: number }>;
  recent_clips: Array<{ clip_id: string; room_id: string; hype_score: number; duration_seconds: number; created_at: string; verdict: string; cf_status?: string; playback_url?: string | null }>;
  totals: { total_lifetime_channel_coins: number; active_sponsorships: number; active_break_in_count: number };
};

const VERDICT_THEME: Record<string, string> = {
  ambient: 'text-white/60',
  auto_clip: 'text-amber-300',
  break_in: 'text-rose-300',
};

export default function MediaMasterPulsePage() {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, []);

  async function load() {
    try {
      const res = await fetch(`${API_URL}/api/media-master-pulse/snapshot`);
      if (!res.ok) { setError(`Snapshot failed (HTTP ${res.status})`); return; }
      const data: Snapshot = await res.json();
      setSnap(data);
      setError(null);
    } catch (e: any) {
      setError(e?.message || 'Snapshot failed');
    }
  }

  return (
    <div
      data-testid="media-master-pulse-page"
      className="min-h-screen bg-[#06050a] text-white relative overflow-hidden"
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-[-15%] left-[-5%] w-[55%] h-[55%] rounded-full bg-amber-500/10 blur-[140px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-cyan-500/10 blur-[140px]" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-5 py-8">
        <BackButton to="/admin" label="Back to admin" />

        <header className="mt-6 mb-10">
          <div className="flex items-center gap-2 text-amber-300/80 text-xs uppercase tracking-widest mb-2">
            <Flame className="w-4 h-4" /> Founder Ops · Media Master Pulse
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-light">Where the network is hot.</h1>
          {snap?.generated_at && (
            <p className="text-white/45 text-xs mt-2">
              Generated {new Date(snap.generated_at).toLocaleTimeString()} · refreshes every 10s
            </p>
          )}
        </header>

        {error && (
          <div data-testid="pulse-error" className="mb-6 rounded-lg bg-red-500/10 ring-1 ring-red-400/40 text-red-200 px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {/* Top KPI strip */}
        {snap && (
          <div data-testid="pulse-kpis" className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
            <KPI label="Lifetime channel ₵" value={snap.totals.total_lifetime_channel_coins.toLocaleString()} icon={<Tv className="w-4 h-4 text-emerald-300" />} />
            <KPI label="Active sponsorships" value={snap.totals.active_sponsorships.toString()} icon={<Trophy className="w-4 h-4 text-amber-300" />} />
            <KPI label="Break-ins live" value={snap.totals.active_break_in_count.toString()} icon={<Zap className="w-4 h-4 text-rose-300" />} />
            <KPI label="Recent clips" value={(snap.recent_clips || []).length.toString()} icon={<Film className="w-4 h-4 text-fuchsia-300" />} />
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Hottest rooms */}
          <Card title="Hottest rooms" icon={<Flame className="w-5 h-5 text-rose-300" />} testId="pulse-hottest-rooms">
            {!snap || snap.hottest_rooms.length === 0 ? (
              <EmptyRow>Nothing hot yet. Once a room crosses 100 hype it'll show here.</EmptyRow>
            ) : (
              <div className="space-y-2">
                {snap.hottest_rooms.map((r, i) => (
                  <div key={r.room_id} className="flex items-center justify-between rounded-lg px-3 py-2 bg-white/4 ring-1 ring-white/8">
                    <div className="flex items-center gap-3">
                      <span className="text-amber-200/80 text-xs w-5">#{i + 1}</span>
                      <span className="text-white text-sm truncate max-w-[14rem]">{r.room_id}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-amber-200 text-sm font-semibold">{r.hype_score.toFixed(0)}</div>
                      <div className={`text-[10px] uppercase tracking-widest ${VERDICT_THEME[r.verdict] || 'text-white/40'}`}>{r.verdict.replace('_', ' ')}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Station bid pools */}
          <Card title="Radio bid pools" icon={<Radio className="w-5 h-5 text-amber-300" />} testId="pulse-station-pools">
            <div className="space-y-2">
              {snap?.station_bid_pools.map((s) => (
                <div key={s.station_id} className="rounded-lg px-3 py-2 bg-white/4 ring-1 ring-white/8">
                  <div className="flex justify-between items-center">
                    <span className="text-white text-sm">{s.name}</span>
                    <span className="text-white/40 text-[10px]">{s.track_id || 'no bid'}</span>
                  </div>
                  <div className="mt-1 flex gap-2 text-xs">
                    <span className="px-2 py-0.5 rounded bg-rose-500/15 text-rose-200">Skip ₵{s.skip_pool.toLocaleString()}</span>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-200">Keep ₵{s.keep_pool.toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Channel revenue */}
          <Card title="DSG TV channel revenue" icon={<Tv className="w-5 h-5 text-emerald-300" />} testId="pulse-channel-revenue">
            <div className="space-y-2">
              {snap?.channel_revenue.map((c) => (
                <div key={c.channel_id} className="rounded-lg px-3 py-2 bg-white/4 ring-1 ring-white/8 flex justify-between items-center">
                  <div>
                    <div className="text-white text-sm">{c.name}</div>
                    <div className="text-white/40 text-[11px]">
                      {c.paywall ? `gated · ₵${c.coin_price?.toLocaleString()} / 24h` : 'free channel'}
                    </div>
                  </div>
                  <div className="text-amber-200 text-sm font-semibold">
                    ₵{c.lifetime_coins.toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Sponsor leaderboard */}
          <Card title="Affiliate Chair leaderboard" icon={<Trophy className="w-5 h-5 text-amber-300" />} testId="pulse-sponsor-leaderboard">
            {!snap || snap.sponsor_leaderboard.length === 0 ? (
              <EmptyRow>No Affiliate Chair sponsorships yet.</EmptyRow>
            ) : (
              <div className="space-y-2">
                {snap.sponsor_leaderboard.map((s, i) => (
                  <div key={s.chair_user_id} className="rounded-lg px-3 py-2 bg-white/4 ring-1 ring-white/8 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <span className="text-amber-200/80 text-xs w-5">#{i + 1}</span>
                      <span className="text-white text-sm truncate max-w-[12rem]">{s.chair_user_id}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-amber-200 text-sm font-semibold">₵{s.lifetime_payouts_coins.toLocaleString()}</div>
                      <div className="text-[10px] text-white/40">{s.sponsorship_count} sponsorship{s.sponsorship_count === 1 ? '' : 's'}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Recent clips strip */}
        <section className="mt-10" data-testid="pulse-recent-clips">
          <h2 className="text-lg font-medium text-white/85 mb-4 flex items-center gap-2">
            <Film className="w-5 h-5 text-fuchsia-300" />
            Recent AI Scout clips
          </h2>
          {!snap?.recent_clips?.length ? (
            <EmptyRow>AI Scout hasn't minted any highlights yet.</EmptyRow>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {snap.recent_clips.map((c) => (
                <div
                  key={c.clip_id}
                  className={`rounded-xl p-4 ring-1 ${c.verdict === 'break_in' ? 'bg-rose-500/10 ring-rose-400/40' : 'bg-white/5 ring-white/10'}`}
                >
                  <div className="text-[10px] uppercase tracking-widest text-amber-200/80">{c.verdict.replace('_', ' ')}</div>
                  <div className="text-white text-sm mt-2 truncate">{c.room_id}</div>
                  <div className="text-amber-200 text-lg mt-1">Hype {c.hype_score.toFixed(0)}</div>
                  <div className="text-white/40 text-[10px] mt-1">{new Date(c.created_at).toLocaleTimeString()}</div>
                  {c.cf_status && c.cf_status !== 'rendered' && (
                    <div className="text-white/30 text-[10px] mt-1">cf: {c.cf_status}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Card({ title, icon, children, testId }: { title: string; icon: React.ReactNode; children: React.ReactNode; testId: string }) {
  return (
    <div data-testid={testId} className="rounded-2xl p-5 bg-gradient-to-br from-[#0c0a14] to-[#10081a] ring-1 ring-white/10">
      <div className="flex items-center gap-2 mb-4">
        {icon}
        <h2 className="text-white/85 font-medium text-sm uppercase tracking-widest">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function KPI({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl px-4 py-3 bg-white/5 ring-1 ring-white/10">
      <div className="flex items-center gap-2 text-xs text-white/55">{icon} {label}</div>
      <div className="text-2xl text-white mt-1">{value}</div>
    </div>
  );
}

function EmptyRow({ children }: { children: React.ReactNode }) {
  return <div className="text-white/45 text-sm py-2">{children}</div>;
}
