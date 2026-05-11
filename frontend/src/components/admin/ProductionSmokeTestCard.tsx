/**
 * Production Smoke-Test Card — one-click health pulse for the live URL.
 *
 * 2026-05-12 founder ask (backlog #3): "Production smoke-test tile in
 * God Mode — one-click 12-endpoint health pulse against the live URL.
 * Catches regressions in 30s right after each redeploy."
 *
 * Pings 14 critical endpoints. Each appears as a tile that flips
 * green / red based on the response. The button stays disabled while
 * tests are running so users can't double-fire.
 *
 * Targets the SAME `REACT_APP_BACKEND_URL` the rest of the app uses,
 * so on production this hits globalvibezdsg.com and on preview it
 * hits the preview host. The list of endpoints intentionally avoids
 * destructive POSTs — we only test GETs and well-defined health probes.
 */
import { useState } from "react";
import { CheckCircle2, XCircle, Loader2, Activity } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

interface ProbeSpec {
  label: string;
  path: string;
  expectStatus: number[];
  // For the dashboard list endpoints we want to make sure the JSON is
  // parseable + has the expected key. expectKey skipped means "any 200 OK".
  expectKey?: string;
}

const PROBES: ProbeSpec[] = [
  { label: "Health", path: "/api/health", expectStatus: [200] },
  { label: "Live Activity (public)", path: "/api/live-activity/recent", expectStatus: [200], expectKey: "events" },
  { label: "Sports — games", path: "/api/sports/games", expectStatus: [200] },
  { label: "Tiers", path: "/api/sovereign-tiers/config", expectStatus: [200, 404] },
  { label: "JFTN — rooms", path: "/api/just-for-the-night/rooms/discover", expectStatus: [200] },
  { label: "JFTN — season pass (auth-required)", path: "/api/just-for-the-night/season-pass/me", expectStatus: [401] },
  { label: "HungryVibes — restaurants", path: "/api/hungryvibes/restaurants", expectStatus: [200, 404] },
  { label: "Vibe Venues — list", path: "/api/vibe-venues/venues", expectStatus: [200] },
  { label: "VibeRidez — active drivers", path: "/api/ridez/active-drivers", expectStatus: [200] },
  { label: "Streaming — live feeds", path: "/api/streaming/live-feeds", expectStatus: [200] },
  { label: "DSG6 — current draw", path: "/api/dsg6/current-draw", expectStatus: [200, 404] },
  { label: "Underground Live — battles", path: "/api/underground-live/battles", expectStatus: [200] },
  { label: "Unified Earnings (auth-required)", path: "/api/me/unified-earnings", expectStatus: [401] },
  { label: "Admin Activity Pulse (admin-only)", path: "/api/live-activity/admin-pulse", expectStatus: [401, 403] },
];

type ProbeResult = {
  label: string;
  ok: boolean;
  status: number;
  ms: number;
  hint?: string;
};

export default function ProductionSmokeTestCard() {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<ProbeResult[]>([]);
  const [startedAt, setStartedAt] = useState<string | null>(null);

  const runProbes = async () => {
    setRunning(true);
    setResults([]);
    setStartedAt(new Date().toLocaleString());
    const out: ProbeResult[] = [];
    // Fire all probes in parallel — the smoke pulse should be FAST,
    // and the endpoints we hit are read-only.
    const promises = PROBES.map(async (p) => {
      const t0 = performance.now();
      try {
        const res = await fetch(`${API}${p.path}`, {
          method: "GET",
          credentials: "include",
        });
        const ms = Math.round(performance.now() - t0);
        const statusOk = p.expectStatus.includes(res.status);
        let keyOk = true;
        if (statusOk && p.expectKey && res.status === 200) {
          try {
            const body = await res.clone().json();
            keyOk = body && (body[p.expectKey] !== undefined || body.success);
          } catch {
            keyOk = false;
          }
        }
        return {
          label: p.label,
          ok: statusOk && keyOk,
          status: res.status,
          ms,
          hint: statusOk
            ? keyOk
              ? undefined
              : `missing key '${p.expectKey}'`
            : `expected ${p.expectStatus.join("/")}, got ${res.status}`,
        };
      } catch (e: any) {
        return {
          label: p.label,
          ok: false,
          status: 0,
          ms: Math.round(performance.now() - t0),
          hint: e?.message?.slice(0, 80) || "network error",
        };
      }
    });

    const settled = await Promise.all(promises);
    out.push(...settled);
    setResults(out);
    setRunning(false);
  };

  const passCount = results.filter((r) => r.ok).length;
  const failCount = results.length - passCount;

  return (
    <div
      className="rounded-2xl border border-emerald-400/30 bg-gradient-to-br from-emerald-900/30 via-black/60 to-emerald-950/40 backdrop-blur-md p-5 mb-6"
      data-testid="prod-smoke-test-card"
    >
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-emerald-300" />
          <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-emerald-200/80">
            Production Smoke Test · 14 probes
          </span>
        </div>
        <button
          type="button"
          onClick={runProbes}
          disabled={running}
          data-testid="prod-smoke-test-run"
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-emerald-400 hover:bg-emerald-300 disabled:opacity-50 disabled:cursor-not-allowed text-emerald-950 text-xs font-bold transition-colors"
        >
          {running ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Running…
            </>
          ) : (
            <>
              <Activity className="w-3.5 h-3.5" />
              Run pulse
            </>
          )}
        </button>
      </div>

      <p className="text-xs text-emerald-100/70 mb-3">
        Hits {API?.replace(/^https?:\/\//, "")} — read-only health probes.
        Run right after each redeploy to catch regressions in 30 seconds.
      </p>

      {results.length > 0 && (
        <>
          <div className="text-sm font-bold mb-3 flex items-center gap-3" data-testid="prod-smoke-test-summary">
            <span className="text-emerald-300">{passCount} pass</span>
            <span className="text-rose-300">{failCount} fail</span>
            <span className="text-white/40 text-xs">at {startedAt}</span>
          </div>
          <div className="grid sm:grid-cols-2 gap-2" data-testid="prod-smoke-test-grid">
            {results.map((r) => (
              <div
                key={r.label}
                data-testid={`prod-smoke-probe-${r.ok ? "ok" : "fail"}`}
                className={`flex items-start gap-2 p-2 rounded-lg border ${
                  r.ok
                    ? "border-emerald-400/30 bg-emerald-500/5"
                    : "border-rose-400/30 bg-rose-500/5"
                }`}
              >
                {r.ok ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-4 h-4 text-rose-300 shrink-0 mt-0.5" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-white">{r.label}</p>
                  <p className="text-[10px] text-white/50">
                    HTTP {r.status} · {r.ms}ms
                    {r.hint ? ` · ${r.hint}` : ""}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
