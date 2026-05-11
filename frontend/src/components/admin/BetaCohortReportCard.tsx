/**
 * BetaCohortReportCard — first-50-to-500-user rollup tile for God Mode.
 *
 * 2026-05-12 founder ask: "auto-aggregates first 50-500 user metrics —
 * signups · which role they picked · their first action · drop-off page
 * · time-to-first-spend — so you walk into v1.1 with hard data instead
 * of vibes."
 *
 * Pulls everything from a single /api/admin/beta-cohort call. Polls
 * every 60s — beta-stage numbers don't change that fast, no point
 * hammering Mongo aggregations.
 */
import { useEffect, useState } from "react";
import { Users, DollarSign, TrendingUp, Clock, Crown, AlertTriangle } from "lucide-react";
import { authFetch } from "@/utils/secureAuth";

const API = process.env.REACT_APP_BACKEND_URL;

type Cohort = {
  signups: { lifetime: number; last_7d: number; last_24h: number };
  roles: { active_role_pill: Record<string, number> };
  revenue: {
    paying_users: number;
    total_revenue_usd: number;
    conversion_rate_pct: number;
    median_time_to_first_spend_min: number | null;
    jftn_season_passes_active: number;
  };
  engagement: {
    active_users_7d: number;
    activation_rate_pct: number;
    weakest_rooms_by_7d_visits: Array<{
      room_id: string;
      visits_7d: number;
      visits_total: number;
    }>;
  };
};

const fmtMin = (m: number | null): string => {
  if (m === null || m === undefined) return "—";
  if (m < 60) return `${m.toFixed(0)}m`;
  if (m < 60 * 24) return `${(m / 60).toFixed(1)}h`;
  return `${(m / 1440).toFixed(1)}d`;
};

export default function BetaCohortReportCard() {
  const [data, setData] = useState<Cohort | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await authFetch(`${API}/api/admin/beta-cohort`);
        if (!res.ok) {
          if (!cancelled) setErr(`HTTP ${res.status}`);
          return;
        }
        const d = await res.json();
        if (!cancelled) {
          setData(d);
          setErr(null);
        }
      } catch (e: any) {
        if (!cancelled) setErr(e?.message?.slice(0, 80) || "network error");
      }
    };
    load();
    const id = setInterval(load, 60000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return (
    <div
      className="rounded-2xl border border-fuchsia-400/30 bg-gradient-to-br from-fuchsia-900/30 via-black/60 to-purple-950/40 backdrop-blur-md p-5 mb-6"
      data-testid="beta-cohort-card"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Crown className="w-4 h-4 text-fuchsia-300" />
          <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-fuchsia-200/80">
            Beta Cohort Report
          </span>
        </div>
        <span className="text-[10px] text-white/40">Auto-refresh · 60s</span>
      </div>

      {!data ? (
        <p className="text-fuchsia-200/60 text-sm py-6 text-center">
          {err ? `Couldn't load (${err})` : "Loading…"}
        </p>
      ) : (
        <>
          {/* Headline tiles */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5" data-testid="beta-cohort-headline">
            <Tile
              icon={<Users className="w-3.5 h-3.5" />}
              label="Signups · lifetime"
              value={data.signups.lifetime.toString()}
              sub={`+${data.signups.last_24h} today · +${data.signups.last_7d} this week`}
              tint="text-fuchsia-300"
            />
            <Tile
              icon={<DollarSign className="w-3.5 h-3.5" />}
              label="Revenue · USD"
              value={`$${data.revenue.total_revenue_usd.toFixed(2)}`}
              sub={`${data.revenue.paying_users} paying · ${data.revenue.conversion_rate_pct}% conv`}
              tint="text-emerald-300"
            />
            <Tile
              icon={<TrendingUp className="w-3.5 h-3.5" />}
              label="Activation · 7d"
              value={`${data.engagement.activation_rate_pct}%`}
              sub={`${data.engagement.active_users_7d} active users`}
              tint="text-cyan-300"
            />
            <Tile
              icon={<Clock className="w-3.5 h-3.5" />}
              label="Time-to-first-spend"
              value={fmtMin(data.revenue.median_time_to_first_spend_min)}
              sub={`median · ${data.revenue.jftn_season_passes_active} JFTN passes`}
              tint="text-amber-300"
            />
          </div>

          {/* Role breakdown */}
          <div className="mb-5" data-testid="beta-cohort-roles">
            <p className="text-[10px] uppercase tracking-[0.3em] text-fuchsia-200/60 font-bold mb-2">
              Role activation
            </p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(data.roles.active_role_pill).map(([role, n]) => (
                <span
                  key={role}
                  data-testid={`beta-cohort-role-${role}`}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-white/10 bg-black/30 text-xs"
                >
                  <span className="uppercase tracking-wider text-white/60 font-bold">
                    {role}
                  </span>
                  <span className="text-white font-bold">{n}</span>
                </span>
              ))}
            </div>
          </div>

          {/* Weakest rooms — where users drop off */}
          {data.engagement.weakest_rooms_by_7d_visits.length > 0 && (
            <div data-testid="beta-cohort-weakest-rooms">
              <p className="text-[10px] uppercase tracking-[0.3em] text-fuchsia-200/60 font-bold mb-2 flex items-center gap-1.5">
                <AlertTriangle className="w-3 h-3 text-amber-300" />
                Weakest rooms · last 7d
              </p>
              <div className="space-y-1.5">
                {data.engagement.weakest_rooms_by_7d_visits.map((r) => (
                  <div
                    key={r.room_id}
                    className="flex items-center justify-between text-xs px-3 py-1.5 rounded-lg bg-black/30 border border-white/5"
                  >
                    <span className="text-white/80 truncate">{r.room_id}</span>
                    <span className="text-white/60 shrink-0 ml-2">
                      <span className="text-amber-300 font-bold">{r.visits_7d}</span> · 7d /{" "}
                      <span className="text-white/40">{r.visits_total}</span> total
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Tile({
  icon,
  label,
  value,
  sub,
  tint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  tint: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/30 p-3">
      <div className="flex items-center gap-1.5 mb-1 text-white/50">
        {icon}
        <p className="text-[9px] uppercase tracking-widest font-bold">{label}</p>
      </div>
      <p className={`text-2xl font-black ${tint}`}>{value}</p>
      <p className="text-[10px] text-white/40 mt-0.5">{sub}</p>
    </div>
  );
}
