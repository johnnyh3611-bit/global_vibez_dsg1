/**
 * MilestoneRecap — small analytics panel under MilestoneQueue showing
 * posted vs skipped vs queued counts over a 7-day or 30-day window.
 * Helps the founder see which threshold milestones are worth the post
 * effort vs which ones get skipped.
 */
import { useEffect, useState, useCallback } from "react";
import { TrendingUp, BarChart3 } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

type Recap = {
  period_days: number;
  since: string;
  counts: {
    posted: number;
    skipped: number;
    queued: number;
    total: number;
  };
  post_rate_pct: number;
  recent_posted: Array<{
    milestone_id: string;
    phase: string;
    threshold: number;
    posted_at: string;
    seats_sold_at_trigger: number;
  }>;
};

export default function MilestoneRecap() {
  const [data, setData] = useState<Recap | null>(null);
  const [period, setPeriod] = useState<7 | 30>(7);

  const load = useCallback(async () => {
    try {
      const r = await fetch(
        `${API}/api/admin/milestones/recap?period_days=${period}`,
        {},
      );
      if (r.ok) setData(await r.json());
    } catch {
      /* silent */
    }
  }, [period]);

  useEffect(() => {
    load();
  }, [load]);

  if (!data) {
    return <p className="text-slate-400 text-sm">Loading recap…</p>;
  }

  const { posted, skipped, queued, total } = data.counts;

  return (
    <div data-testid="milestone-recap">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-[11px] uppercase tracking-widest text-cyan-300 flex items-center gap-1.5 font-bold">
          <BarChart3 className="w-3.5 h-3.5" /> Recap
        </h4>
        <div className="flex gap-1">
          {[7, 30].map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p as 7 | 30)}
              data-testid={`recap-period-${p}`}
              className={`text-[10px] uppercase tracking-widest px-2 py-1 rounded ${
                period === p
                  ? "bg-cyan-300 text-black"
                  : "bg-cyan-500/15 text-cyan-200 hover:bg-cyan-500/25"
              }`}
            >
              {p}d
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 mb-3">
        <Tile color="emerald" label="Posted" value={posted} />
        <Tile color="rose" label="Skipped" value={skipped} />
        <Tile color="amber" label="Queued" value={queued} />
        <Tile color="cyan" label="Post rate" value={`${data.post_rate_pct}%`} />
      </div>

      {total === 0 ? (
        <p className="text-slate-500 text-[11px]">
          No milestones generated in the last {period} day{period > 1 ? "s" : ""}.
        </p>
      ) : data.recent_posted.length > 0 ? (
        <div>
          <p className="text-[10px] uppercase tracking-widest text-slate-400 mb-1.5 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" /> Most recently posted
          </p>
          <div className="space-y-1">
            {data.recent_posted.map((m) => (
              <div
                key={m.milestone_id}
                data-testid={`recap-recent-${m.milestone_id}`}
                className="flex items-center justify-between rounded-md bg-emerald-500/[0.06] border border-emerald-400/20 px-2.5 py-1.5 text-[11px]"
              >
                <span className="font-black text-emerald-200">
                  {m.phase}{" "}
                  <span className="text-emerald-300">{m.threshold}%</span>
                </span>
                <span className="text-slate-400 text-[10px]">
                  {new Date(m.posted_at).toLocaleDateString()} ·{" "}
                  {m.seats_sold_at_trigger.toLocaleString()} seats
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-slate-500 text-[11px]">
          {posted === 0
            ? "Nothing posted yet — try clicking 'Post on X' on a queued card."
            : "No recent posts inside this window."}
        </p>
      )}
    </div>
  );
}

function Tile({
  label,
  value,
  color,
}: {
  label: string;
  value: number | string;
  color: "emerald" | "rose" | "amber" | "cyan";
}) {
  const c =
    color === "emerald"
      ? "border-emerald-400/40 bg-emerald-500/[0.06] text-emerald-200"
      : color === "rose"
      ? "border-rose-400/40 bg-rose-500/[0.06] text-rose-200"
      : color === "amber"
      ? "border-amber-400/40 bg-amber-500/[0.06] text-amber-200"
      : "border-cyan-400/40 bg-cyan-500/[0.06] text-cyan-200";
  return (
    <div className={`rounded-md p-2 border ${c}`}>
      <p className="text-[9px] uppercase tracking-widest opacity-70">{label}</p>
      <p className="text-base font-black mt-0.5">{value}</p>
    </div>
  );
}
