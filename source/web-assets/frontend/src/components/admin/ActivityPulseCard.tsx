/**
 * ActivityPulseCard — founder-only live business pulse.
 *
 * Drops into /vibe-vault-admin (GodModeDashboard). Polls
 * /api/live-activity/admin-pulse every 15s. Shows:
 *   • 4 summary tiles (72h events, gross ₵, gross $, top-ups)
 *   • Live feed list (newest 10 events, UN-anonymized + dollar amounts)
 *
 * 2026-05-12 founder ask: "see my business breathe in real time."
 */
import { useEffect, useState } from "react";
import { Activity, DollarSign, TrendingUp, Coins, RefreshCw } from "lucide-react";
import { authFetch } from "@/utils/secureAuth";

const API = process.env.REACT_APP_BACKEND_URL;

type Event = {
  ts: string;
  kind: string;
  emoji: string;
  text: string;
  user?: string;
  amount_vibe?: number;
  amount_usd?: number;
};

type Totals = {
  events_72h: number;
  gross_vibe_72h: number;
  gross_usd_72h: number;
  topups_72h: number;
  season_passes_72h: number;
  jftn_gifts_72h: number;
};

export default function ActivityPulseCard() {
  const [events, setEvents] = useState<Event[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const fetchPulse = async () => {
    try {
      const r = await authFetch(`${API}/api/live-activity/admin-pulse?limit=20`);
      if (!r.ok) {
        setErr(r.status === 403 ? "Admin only" : `HTTP ${r.status}`);
        return;
      }
      const d = await r.json();
      setEvents(d?.events || []);
      setTotals(d?.totals || null);
      setErr(null);
    } catch (e: any) {
      setErr(e?.message || "Network error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPulse();
    const id = setInterval(fetchPulse, 15_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      data-testid="admin-activity-pulse"
      className="rounded-2xl border border-fuchsia-500/30 bg-gradient-to-br from-black/60 via-fuchsia-950/30 to-black/60 backdrop-blur-md p-5 mb-6"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-fuchsia-300" />
          <h3 className="text-sm uppercase tracking-[0.3em] font-black text-fuchsia-200">
            Activity Pulse · last 72h
          </h3>
        </div>
        <button
          type="button"
          onClick={fetchPulse}
          data-testid="admin-pulse-refresh"
          className="text-xs text-fuchsia-300/70 hover:text-white flex items-center gap-1 uppercase tracking-widest"
        >
          <RefreshCw className="w-3 h-3" /> Refresh
        </button>
      </div>

      {err && (
        <p className="text-rose-300 text-xs mb-3" data-testid="admin-pulse-error">{err}</p>
      )}

      {/* Summary tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <div className="rounded-xl bg-black/40 border border-white/10 p-3" data-testid="pulse-tile-events">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-fuchsia-300/80">
            <Activity className="w-3 h-3" /> Events
          </div>
          <div className="text-2xl font-black text-white mt-1 tabular-nums">
            {totals?.events_72h ?? (loading ? "…" : 0)}
          </div>
        </div>
        <div className="rounded-xl bg-black/40 border border-white/10 p-3" data-testid="pulse-tile-vibe">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-cyan-300/80">
            <Coins className="w-3 h-3" /> Gross ₵
          </div>
          <div className="text-2xl font-black text-white mt-1 tabular-nums">
            ₵{(totals?.gross_vibe_72h ?? 0).toLocaleString()}
          </div>
        </div>
        <div className="rounded-xl bg-black/40 border border-white/10 p-3" data-testid="pulse-tile-usd">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-emerald-300/80">
            <DollarSign className="w-3 h-3" /> Gross USD
          </div>
          <div className="text-2xl font-black text-white mt-1 tabular-nums">
            ${(totals?.gross_usd_72h ?? 0).toFixed(2)}
          </div>
        </div>
        <div className="rounded-xl bg-black/40 border border-white/10 p-3" data-testid="pulse-tile-topups">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-amber-300/80">
            <TrendingUp className="w-3 h-3" /> Top-ups
          </div>
          <div className="text-2xl font-black text-white mt-1 tabular-nums">
            {totals?.topups_72h ?? 0}
          </div>
          <div className="text-[10px] text-white/40 mt-0.5">
            {(totals?.season_passes_72h ?? 0)}× pass · {(totals?.jftn_gifts_72h ?? 0)}× gift
          </div>
        </div>
      </div>

      {/* Live event list */}
      <div data-testid="pulse-event-list">
        {loading ? (
          <p className="text-white/40 text-xs">Loading pulse…</p>
        ) : events.length === 0 ? (
          <p className="text-white/40 text-xs">
            No activity in the last 72h. Once users start playing, this list fills in real time.
          </p>
        ) : (
          <ul className="space-y-1.5 max-h-80 overflow-y-auto pr-2">
            {events.map((e, i) => (
              <li
                key={`${e.ts}-${i}`}
                className="flex items-center gap-3 rounded-md bg-black/30 border border-white/5 px-3 py-2 text-xs"
                data-testid={`pulse-event-${i}`}
              >
                <span className="text-base leading-none">{e.emoji}</span>
                <span className="text-white/85 flex-1 truncate">{e.text}</span>
                <span className="text-[10px] uppercase tracking-widest text-fuchsia-300/60 tabular-nums">
                  {e.ts ? new Date(e.ts).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
