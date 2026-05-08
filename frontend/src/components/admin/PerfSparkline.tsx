/**
 * PerfSparkline — shows live p50/p95 latency for the API surface.
 * Polls `/api/admin/perf-snapshot` every 30s, keeps a rolling client-side
 * history (last 20 polls = ~10 minutes) and renders a tiny SVG sparkline
 * for the slowest 3 routes by p95.
 *
 * Why client-side history? The backend snapshot is a single point in time
 * (a rolling 1024-sample window per route), so the sparkline is built up
 * on the client by polling. A server-side time-series store would be
 * overkill — operators just need a "is the dashboard slowing down right
 * now?" tripwire next to the treasury.
 */
import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Activity, AlertTriangle } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;
const POLL_MS = 30_000;
const MAX_POINTS = 20; // ~10 minutes of history at 30s polls
const SLOW_P95_MS = 500; // anything over this gets the amber alert chip

type Row = {
  route: string;
  samples: number;
  p50_ms: number;
  p95_ms: number;
  p99_ms: number;
  max_ms: number;
  avg_ms: number;
};

type Snapshot = {
  success: boolean;
  tracked_routes: number;
  total_samples: number;
  rows: Row[];
};

interface RouteHistory {
  route: string;
  samples: number;
  p50: number;
  p95: number;
  history: number[]; // p95 over time, oldest first
}

/** Render a tiny SVG sparkline. Width / height are intentionally fixed
 * so the layout doesn't jump as new points arrive. */
function Sparkline({
  values,
  width = 96,
  height = 24,
  color = "#34d399",
}: {
  values: number[];
  width?: number;
  height?: number;
  color?: string;
}) {
  if (!values.length) {
    return (
      <svg width={width} height={height} aria-hidden="true">
        <line
          x1={0}
          y1={height / 2}
          x2={width}
          y2={height / 2}
          stroke="#475569"
          strokeWidth={1}
          strokeDasharray="2 2"
        />
      </svg>
    );
  }
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 1);
  const range = Math.max(max - min, 1);
  const stepX = values.length > 1 ? width / (values.length - 1) : width;
  const points = values
    .map((v, i) => {
      const x = i * stepX;
      const y = height - ((v - min) / range) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg width={width} height={height} aria-hidden="true">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        points={points}
      />
    </svg>
  );
}

export default function PerfSparkline() {
  const [routes, setRoutes] = useState<RouteHistory[]>([]);
  const [overallSamples, setOverallSamples] = useState(0);
  const [trackedRoutes, setTrackedRoutes] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const historyRef = useRef<Map<string, number[]>>(new Map());

  const poll = async () => {
    try {
      const r = await fetch(`${API}/api/admin/perf-snapshot`, {
      });
      if (!r.ok) throw new Error(`perf-snapshot ${r.status}`);
      const data: Snapshot = await r.json();
      setError(null);
      setOverallSamples(data.total_samples || 0);
      setTrackedRoutes(data.tracked_routes || 0);

      // Top-3 routes by p95 (rows already sorted desc on the server).
      const top = (data.rows || []).slice(0, 3);
      const next: RouteHistory[] = top.map((row) => {
        const hist = historyRef.current.get(row.route) || [];
        hist.push(row.p95_ms);
        if (hist.length > MAX_POINTS) hist.shift();
        historyRef.current.set(row.route, hist);
        return {
          route: row.route,
          samples: row.samples,
          p50: row.p50_ms,
          p95: row.p95_ms,
          history: [...hist],
        };
      });
      setRoutes(next);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "snapshot failed";
      setError(msg);
    }
  };

  useEffect(() => {
    poll();
    const id = setInterval(poll, POLL_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <Card
      className="bg-slate-900/70 border-slate-800 p-5"
      data-testid="treasury-perf-sparkline-card"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-cyan-400" />
          <h3 className="text-sm uppercase tracking-wider text-slate-300">
            API Performance — Top 3 by p95
          </h3>
        </div>
        <span
          className="text-[10px] uppercase tracking-wider text-slate-500"
          data-testid="perf-sparkline-meta"
        >
          {trackedRoutes} routes · {overallSamples.toLocaleString()} samples
        </span>
      </div>

      {error && (
        <div
          className="flex items-center gap-2 text-xs text-amber-400 mb-2"
          data-testid="perf-sparkline-error"
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>{error}</span>
        </div>
      )}

      {routes.length === 0 ? (
        <p
          className="text-slate-500 text-sm"
          data-testid="perf-sparkline-empty"
        >
          Collecting samples — check back in a minute.
        </p>
      ) : (
        <ul className="space-y-2" data-testid="perf-sparkline-rows">
          {routes.map((r) => {
            const slow = r.p95 >= SLOW_P95_MS;
            return (
              <li
                key={r.route}
                className="flex items-center justify-between gap-3 text-xs"
                data-testid={`perf-sparkline-row-${r.route.replace(/[^a-z0-9]/gi, "_")}`}
              >
                <code
                  className="font-mono text-slate-300 truncate flex-1"
                  title={r.route}
                >
                  {r.route}
                </code>
                <Sparkline
                  values={r.history}
                  color={slow ? "#fbbf24" : "#34d399"}
                />
                <span className="font-mono text-slate-400 w-20 text-right tabular-nums">
                  p50 {r.p50.toFixed(0)}ms
                </span>
                <span
                  className={`font-mono w-24 text-right tabular-nums ${slow ? "text-amber-300" : "text-emerald-300"}`}
                >
                  p95 {r.p95.toFixed(0)}ms
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-3 text-[10px] text-slate-600">
        Polls every {POLL_MS / 1000}s · sparkline shows last {MAX_POINTS}
        &nbsp;polls · amber when p95 ≥ {SLOW_P95_MS}ms
      </p>
    </Card>
  );
}
