/**
 * GameLockStatusWidget — at-a-glance health for every locked game on the
 * platform. Renders on the God-Mode dashboard.
 *
 * Top-of-card pill: overall_color (green / yellow / red)
 * Bottom: per-game grid sorted by category, each tile showing:
 *   - title
 *   - lock badge (LOCKED · REDESIGN · BLOCKED)
 *   - engine import status
 *   - actual vs declared test count
 *   - tap to copy the deep-link route
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, Title, Text, Badge } from "@tremor/react";
import { ShieldCheck, ShieldAlert, ShieldX, RefreshCcw, ExternalLink } from "lucide-react";
import { fetchWithAuth } from "@/utils/adminAPI";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

interface LockRow {
  id: string;
  name: string;
  category: string;
  route: string;
  engine_module: string | null;
  test_module: string | null;
  min_tests: number;
  last_modified: string;
  status: "LOCKED" | "REDESIGN" | "BLOCKED";
  engine_importable: boolean | null;
  test_module_exists: boolean;
  test_pass_count: number | null;
  lock_intact: boolean;
  lock_color: "green" | "yellow" | "red";
}

interface LockResponse {
  overall_color: "green" | "yellow" | "red";
  summary: { total: number; locked_ok: number; locked_broken: number; redesign: number; blocked: number; };
  games: LockRow[];
}

const COLOR_TO_TREMOR: Record<string, "emerald" | "amber" | "rose"> = {
  green: "emerald", yellow: "amber", red: "rose",
};

const CATEGORY_LABEL: Record<string, string> = {
  dice: "🎲 Dice",
  card: "🃏 Card",
  casino: "🎰 Casino",
  wheel: "🎡 Wheel",
  lottery: "🎟 Lottery / Slots",
  video_poker: "📺 Video Poker",
  skill: "🎯 Skill",
  board: "♟ Board",
  party: "🥳 Party",
  arcade: "🕹 Arcade",
};

export default function GameLockStatusWidget() {
  const [data, setData] = useState<LockResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuth(`${BACKEND_URL}/api/admin/games-lock/`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: LockResponse = await res.json();
      setData(json);
    } catch (e: any) {
      setError(e?.message || "Failed to load lock status");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const grouped = useMemo(() => {
    if (!data) return {} as Record<string, LockRow[]>;
    const out: Record<string, LockRow[]> = {};
    for (const g of data.games) {
      out[g.category] = out[g.category] || [];
      out[g.category].push(g);
    }
    return out;
  }, [data]);

  const overallIcon = (c: string) => c === "green"
    ? <ShieldCheck className="w-7 h-7 text-emerald-400" />
    : c === "yellow"
    ? <ShieldAlert className="w-7 h-7 text-amber-400" />
    : <ShieldX className="w-7 h-7 text-rose-400" />;

  return (
    <Card data-testid="game-lock-status-widget">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          {data ? overallIcon(data.overall_color) : <ShieldCheck className="w-7 h-7 text-neutral-500" />}
          <div>
            <Title className="!mb-0">Game Lock Status</Title>
            <Text className="text-xs text-slate-400 mt-1">
              Per-room health for every shipped game · backend asserts engine + min-test count
            </Text>
          </div>
        </div>
        <button
          onClick={load}
          data-testid="game-lock-refresh-btn"
          disabled={loading}
          className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-50 text-xs uppercase tracking-widest font-bold flex items-center gap-1"
        >
          <RefreshCcw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Checking…" : "Re-Check"}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-500/40 bg-rose-950/30 px-3 py-2 text-rose-200 text-sm" data-testid="game-lock-error">
          {error}
        </div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-5" data-testid="game-lock-summary">
            <SummaryStat label="Total" value={data.summary.total} color="slate" />
            <SummaryStat label="Locked OK" value={data.summary.locked_ok} color="emerald" testid="lock-stat-ok" />
            <SummaryStat label="Locked Broken" value={data.summary.locked_broken} color="rose" testid="lock-stat-broken" />
            <SummaryStat label="In Redesign" value={data.summary.redesign} color="amber" />
            <SummaryStat label="Blocked" value={data.summary.blocked} color="rose" />
          </div>

          {Object.entries(grouped).map(([cat, rows]) => (
            <div key={cat} className="mb-5">
              <h3 className="text-xs uppercase tracking-widest text-slate-300 font-bold mb-2">
                {CATEGORY_LABEL[cat] || cat} <span className="text-slate-500 font-normal">· {rows.length}</span>
              </h3>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {rows.map(g => <LockRowCard key={g.id} row={g} />)}
              </div>
            </div>
          ))}
        </>
      )}
    </Card>
  );
}

function SummaryStat({ label, value, color, testid }: { label: string; value: number; color: string; testid?: string }) {
  return (
    <div data-testid={testid} className="rounded-xl border border-white/10 bg-black/30 px-3 py-2">
      <div className={`text-2xl font-black tracking-tight text-${color}-300`}>{value}</div>
      <div className="text-[10px] uppercase tracking-widest text-slate-400">{label}</div>
    </div>
  );
}

function LockRowCard({ row }: { row: LockRow }) {
  const colorBg = row.lock_color === "green"
    ? "border-emerald-500/30 bg-emerald-900/10"
    : row.lock_color === "yellow"
    ? "border-amber-500/30 bg-amber-900/10"
    : "border-rose-500/30 bg-rose-900/10";

  const dot = row.lock_color === "green"
    ? "bg-emerald-400"
    : row.lock_color === "yellow"
    ? "bg-amber-400"
    : "bg-rose-400";

  return (
    <div
      data-testid={`game-lock-row-${row.id}`}
      className={`rounded-xl border ${colorBg} px-3 py-2.5 flex items-start gap-2`}
    >
      <span className={`mt-1.5 inline-block w-2 h-2 rounded-full flex-none ${dot}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-sm truncate">{row.name}</span>
          <Badge size="xs" color={COLOR_TO_TREMOR[row.lock_color]}>{row.status}</Badge>
        </div>
        <div className="text-[10px] text-slate-400 font-mono flex flex-wrap items-center gap-x-2">
          <span>{row.route}</span>
          {row.test_pass_count !== null && (
            <span data-testid={`game-lock-row-${row.id}-tests`}>
              tests {row.test_pass_count}/{row.min_tests}
            </span>
          )}
          {row.engine_importable === false && (
            <span className="text-rose-300 font-bold">ENGINE BROKEN</span>
          )}
          <span className="text-slate-500">· {row.last_modified}</span>
        </div>
      </div>
      <a
        href={row.route}
        target="_blank"
        rel="noopener noreferrer"
        data-testid={`game-lock-row-${row.id}-open`}
        className="p-1.5 rounded hover:bg-white/10 flex-none"
        title={`Open ${row.route} in new tab`}
      >
        <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
      </a>
    </div>
  );
}
