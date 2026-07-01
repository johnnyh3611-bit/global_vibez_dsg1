/**
 * SmartStackOpsTab — admin live ops dispatch panel.
 *
 * Renders inside the GodMode dashboard. Polls /api/admin/smartstack/overview
 * every 6 seconds. Shows:
 *   • Stat strip (active rides / open offers / stacks 24h / bonus profit)
 *   • Top-drivers leaderboard (last 24h bonus profit)
 *   • Live "open offer" queue
 *   • Recent acceptance feed
 */
import { useCallback, useEffect, useState } from "react";
import { Card, Title, Text, Badge } from "@tremor/react";
import { Loader2, MapPin, RefreshCw, TrendingUp, Truck, Zap } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;
const POLL_MS = 6000;

interface Overview {
  stats: {
    active_rides: number;
    open_offers: number;
    pending_orders: number;
    stacks_24h: number;
    bonus_profit_24h_usd: number;
    avg_profit_boost: number;
    avg_detour_mi: number;
    max_detour_mi: number;
    min_profit_boost: number;
  };
  active_rides: Array<{ ride_id: string; driver_user_id: string; ride_payout_usd: number; pickup: { lat: number; lng: number }; dropoff: { lat: number; lng: number }; started_at: string }>;
  open_offers: Array<{ offer_id: string; driver_user_id: string; added_distance_mi: number; added_minutes: number; added_profit_usd: number; profit_boost: number; expires_at: string }>;
  leaderboard: Array<{ driver_user_id: string; stacks: number; bonus_profit_usd: number }>;
  recent_acceptances: Array<{ acceptance_id: string; driver_user_id: string; added_profit_usd: number; added_distance_mi: number; profit_boost: number; accepted_at: string }>;
}

export default function SmartStackOpsTab() {
  const [data, setData] = useState<Overview | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const res = await fetch(`${API}/api/admin/smartstack/overview`, {
      });
      if (res.ok) setData((await res.json()) as Overview);
    } finally { setBusy(false); }
  }, []);

  useEffect(() => {
    void load();
    const t = window.setInterval(load, POLL_MS);
    return () => window.clearInterval(t);
  }, [load]);

  if (!data) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
      </div>
    );
  }

  const s = data.stats;

  return (
    <div className="space-y-5" data-testid="vault-smartstack-ops-tab">
      <Card>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <Title>Smart Logistics · Live Ops</Title>
            <Text className="mt-1">
              Real-time dispatch view. Detour cap <strong>{s.max_detour_mi}mi</strong> · Min profit boost <strong>{s.min_profit_boost}x</strong>.
            </Text>
          </div>
          <button
            onClick={load}
            disabled={busy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 text-xs font-bold uppercase tracking-wider disabled:opacity-50"
            data-testid="vault-smartstack-refresh"
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Refresh
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-4">
          <Stat icon={<Truck />} label="Active rides" value={s.active_rides.toString()} />
          <Stat icon={<Zap />} label="Open offers" value={s.open_offers.toString()} />
          <Stat icon={<TrendingUp />} label="Stacks · 24h" value={s.stacks_24h.toString()} />
          <Stat icon={<MapPin />} label="Bonus · 24h" value={`$${s.bonus_profit_24h_usd.toFixed(2)}`} highlight />
        </div>
        <div className="grid grid-cols-2 gap-2 mt-2">
          <Stat label="Avg profit boost" value={`${s.avg_profit_boost}x`} />
          <Stat label="Avg detour" value={`${s.avg_detour_mi} mi`} />
        </div>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <Title>Top Drivers · 24h</Title>
          {data.leaderboard.length === 0 ? (
            <Text className="text-slate-500 mt-3">No stacks yet today.</Text>
          ) : (
            <div className="mt-3 space-y-1.5" data-testid="vault-smartstack-leaderboard">
              {data.leaderboard.map((d, i) => (
                <div key={d.driver_user_id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/50 text-xs">
                  <Badge color="cyan">#{i + 1}</Badge>
                  <span className="flex-1 font-mono text-slate-200 truncate">{d.driver_user_id}</span>
                  <span className="text-emerald-300 font-black tabular-nums">${d.bonus_profit_usd.toFixed(2)}</span>
                  <span className="text-slate-400 tabular-nums">{d.stacks} stacks</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <Title>Open Offers · Live Queue</Title>
          {data.open_offers.length === 0 ? (
            <Text className="text-slate-500 mt-3">No live offers right now.</Text>
          ) : (
            <div className="mt-3 space-y-1.5" data-testid="vault-smartstack-offers">
              {data.open_offers.map((o) => (
                <div key={o.offer_id} className="px-3 py-2 rounded-lg bg-slate-800/50 text-xs">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge color="amber">+${o.added_profit_usd.toFixed(2)}</Badge>
                    <Badge color="emerald">{o.profit_boost}x</Badge>
                    <span className="text-slate-300 font-mono truncate flex-1">{o.driver_user_id}</span>
                  </div>
                  <p className="text-slate-400 text-[11px] tabular-nums">+{o.added_distance_mi}mi · +{o.added_minutes}min · expires {new Date(o.expires_at).toLocaleTimeString()}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card>
        <Title>Recent Acceptances</Title>
        {data.recent_acceptances.length === 0 ? (
          <Text className="text-slate-500 mt-3">No stacks accepted today.</Text>
        ) : (
          <div className="mt-3 space-y-1.5" data-testid="vault-smartstack-acceptances">
            {data.recent_acceptances.map((a) => (
              <div key={a.acceptance_id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/50 text-xs">
                <span className="font-mono text-slate-300 truncate flex-1">{a.driver_user_id}</span>
                <span className="text-emerald-300 font-black tabular-nums">+${a.added_profit_usd.toFixed(2)}</span>
                <span className="text-slate-400 tabular-nums">{a.profit_boost}x · +{a.added_distance_mi}mi</span>
                <span className="text-slate-500 text-[10px]">{new Date(a.accepted_at).toLocaleTimeString()}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function Stat({ icon, label, value, highlight = false }: { icon?: React.ReactNode; label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`p-3 rounded-lg border ${highlight ? "bg-emerald-500/10 border-emerald-400/40" : "bg-slate-800/50 border-slate-700"}`}>
      <div className={`flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-bold mb-0.5 ${highlight ? "text-emerald-300" : "text-slate-400"}`}>
        {icon ? <span className="w-3 h-3">{icon}</span> : null} {label}
      </div>
      <p className="text-xl font-black tabular-nums text-white">{value}</p>
    </div>
  );
}
