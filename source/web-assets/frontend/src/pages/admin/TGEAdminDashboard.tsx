/**
 * TGE Admin Console — preview + execute $DSG mint batches.
 * Fully MOCKED until Solana keys arrive (VIBEZ_TGE_MODE=mock).
 */
import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Coins, Wallet, AlertTriangle, ArrowLeft, Rocket, CheckCircle2 } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

interface TGEConfig {
  mode: string;
  token_mint_address: string;
  treasury_configured: boolean;
  min_eligible_vibez: number;
  supported_networks: string[];
  rpc_health?: { ok: boolean; rpc?: string; block_height?: number; error?: string };
}

interface CohortRow {
  user_id: string;
  username: string;
  wallet: string;
  opted_in: boolean;
  total_vibez: number;
  pending_vibez: number;
  available_vibez: number;
  eligible_to_mint: boolean;
}

interface DryRun {
  mode: string;
  computed_at: string;
  cohort_size: number;
  eligible_count: number;
  pending_opt_in_count: number;
  pending_wallet_count: number;
  total_vibez_to_mint: number;
  min_vibez_threshold: number;
  sample_rows: CohortRow[];
  config: TGEConfig;
}

interface Batch {
  batch_id: string;
  status: string;
  mode: string;
  initiated_by: string;
  initiated_at: string;
  eligible_count: number;
  total_vibez_minted: number;
  min_vibez_threshold: number;
  note?: string;
}

const TGEAdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [dryRun, setDryRun] = useState<DryRun | null>(null);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [threshold, setThreshold] = useState<number>(10);
  const [executing, setExecuting] = useState(false);
  const [lastBatchId, setLastBatchId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [d, b] = await Promise.all([
        fetch(`${API}/api/tge/admin/dry-run?min_vibez=${threshold}`, {}).then((r) => r.json()),
        fetch(`${API}/api/tge/admin/batches`, {}).then((r) => r.json()),
      ]);
      if (d.detail) throw new Error(d.detail);
      setDryRun(d);
      setBatches(b.batches || []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [threshold]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleExecute = async () => {
    if (!dryRun) return;
    if (!window.confirm(
      `Mint ${dryRun.total_vibez_to_mint} $DSG across ${dryRun.eligible_count} wallets in ${dryRun.mode.toUpperCase()} mode?`
    )) return;
    setExecuting(true);
    try {
      const res = await fetch(`${API}/api/tge/admin/execute-mint`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ min_vibez: threshold, confirm: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Mint failed");
      setLastBatchId(data.batch.batch_id);
      await loadAll();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-6" data-testid="tge-admin-dashboard">
      <button
        onClick={() => navigate("/vibe-vault-admin/dashboard")}
        className="flex items-center gap-1 text-sm text-neutral-400 hover:text-white mb-4"
        data-testid="tge-admin-back-btn"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Vault
      </button>

      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-3 mb-2">
          <Rocket className="w-6 h-6 text-purple-400" />
          <h1 className="text-3xl font-black italic uppercase tracking-tighter">TGE Console · $DSG</h1>
        </div>
        <p className="text-neutral-400 mb-6">
          Token Generation Event scaffold. Preview and simulate mint batches before the Solana SPL integration ships.
        </p>

        {dryRun && (
          <div
            className={`mb-6 p-4 rounded-2xl border backdrop-blur-sm flex items-center gap-3 ${
              dryRun.mode === "mock"
                ? "bg-amber-500/10 border-amber-500/30"
                : "bg-emerald-500/10 border-emerald-500/30"
            }`}
            data-testid="tge-mode-banner"
          >
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
            <div className="text-sm">
              <div className="font-bold uppercase tracking-widest text-xs">
                Mode: {dryRun.mode}
              </div>
              <div className="text-neutral-400">
                {dryRun.mode === "mock"
                  ? "No on-chain transactions. All mints are simulated and logged for audit."
                  : "LIVE — mints will write to Solana."}
                {" · Mint address: "}
                <code className="text-neutral-500">{dryRun.config.token_mint_address || "not configured"}</code>
                {" · Treasury: "}
                <code className={dryRun.config.treasury_configured ? "text-emerald-400" : "text-rose-400"}>
                  {dryRun.config.treasury_configured ? "configured" : "missing"}
                </code>
                {dryRun.config.rpc_health && (
                  <>
                    {" · RPC: "}
                    <code className={dryRun.config.rpc_health.ok ? "text-emerald-400" : "text-rose-400"}>
                      {dryRun.config.rpc_health.ok
                        ? `height ${dryRun.config.rpc_health.block_height?.toLocaleString()}`
                        : "unreachable"}
                    </code>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* KPI Cards */}
        {dryRun && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6" data-testid="tge-kpi-grid">
            <KPI label="Cohort Size" value={dryRun.cohort_size.toLocaleString()} hint="users above threshold" />
            <KPI label="Eligible" value={dryRun.eligible_count.toLocaleString()} hint="opted in + wallet" accent="emerald" />
            <KPI label="Pending Opt-In" value={dryRun.pending_opt_in_count.toLocaleString()} hint="missing opt-in" accent="amber" />
            <KPI label="Total $DSG" value={dryRun.total_vibez_to_mint.toLocaleString(undefined, { maximumFractionDigits: 2 })} hint="ready to mint" accent="purple" />
          </div>
        )}

        {/* Controls */}
        <div className="p-5 rounded-2xl bg-neutral-900/60 border border-white/5 backdrop-blur-sm mb-6">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <div className="flex-1">
              <label className="text-xs font-mono text-purple-400 uppercase tracking-widest block mb-2">
                Min $DSG threshold
              </label>
              <input
                type="number"
                value={threshold}
                min={0}
                step={1}
                onChange={(e) => setThreshold(Number(e.target.value))}
                data-testid="tge-threshold-input"
                className="w-32 px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-white focus:border-purple-500 outline-none"
              />
            </div>
            <button
              onClick={loadAll}
              data-testid="tge-refresh-btn"
              className="px-5 py-2 rounded-lg bg-neutral-800 border border-neutral-700 text-sm font-semibold hover:bg-neutral-700"
            >
              Refresh
            </button>
            <button
              onClick={handleExecute}
              disabled={!dryRun || executing || dryRun.eligible_count === 0}
              data-testid="tge-execute-btn"
              className="px-5 py-2 rounded-lg bg-gradient-to-r from-fuchsia-500 to-purple-500 text-sm font-bold uppercase tracking-wide disabled:opacity-40 hover:scale-105 transition-transform"
            >
              {executing ? "Executing..." : `Execute Mint Batch (${dryRun?.eligible_count ?? 0})`}
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm" data-testid="tge-error">
            {error}
          </div>
        )}

        {lastBatchId && (
          <div className="mb-6 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-3" data-testid="tge-last-batch">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <div className="text-sm">
              Batch <code className="text-emerald-300">{lastBatchId}</code> recorded successfully.
            </div>
          </div>
        )}

        {/* Eligible rows preview */}
        <div className="p-5 rounded-2xl bg-neutral-900/60 border border-white/5 mb-6">
          <h3 className="text-sm font-bold uppercase tracking-widest text-purple-400 mb-3">
            Top Eligible Wallets (preview)
          </h3>
          {loading ? (
            <div className="text-neutral-500 text-sm" data-testid="tge-cohort-loading">Loading...</div>
          ) : !dryRun || dryRun.sample_rows.length === 0 ? (
            <div className="text-neutral-500 text-sm" data-testid="tge-cohort-empty">
              No wallets meet the threshold with a valid opt-in yet.
            </div>
          ) : (
            <div className="overflow-x-auto" data-testid="tge-cohort-table">
              <table className="w-full text-sm">
                <thead className="text-left text-neutral-500 text-xs uppercase tracking-widest">
                  <tr>
                    <th className="py-2">User</th>
                    <th className="py-2">Wallet</th>
                    <th className="py-2 text-right">Pending</th>
                    <th className="py-2 text-right">Available</th>
                    <th className="py-2 text-right">Total $DSG</th>
                  </tr>
                </thead>
                <tbody>
                  {dryRun.sample_rows.map((r) => (
                    <tr key={r.user_id} className="border-t border-neutral-800">
                      <td className="py-2">
                        <span className="font-semibold">{r.username}</span>
                        <span className="text-neutral-600 text-xs ml-2">{r.user_id}</span>
                      </td>
                      <td className="py-2 text-xs text-neutral-400 font-mono truncate max-w-[240px]">
                        {r.wallet || <span className="text-amber-400">—</span>}
                      </td>
                      <td className="py-2 text-right text-neutral-300 tabular-nums">{r.pending_vibez.toFixed(2)}</td>
                      <td className="py-2 text-right text-neutral-300 tabular-nums">{r.available_vibez.toFixed(2)}</td>
                      <td className="py-2 text-right font-bold text-fuchsia-300 tabular-nums">{r.total_vibez.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Batch history */}
        <div className="p-5 rounded-2xl bg-neutral-900/60 border border-white/5">
          <h3 className="text-sm font-bold uppercase tracking-widest text-purple-400 mb-3">Batch History</h3>
          {batches.length === 0 ? (
            <div className="text-neutral-500 text-sm" data-testid="tge-batches-empty">No batches executed yet.</div>
          ) : (
            <div className="space-y-2" data-testid="tge-batches-list">
              {batches.map((b) => (
                <div
                  key={b.batch_id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-black/30 border border-white/5"
                  data-testid={`tge-batch-${b.batch_id}`}
                >
                  <Coins className="w-4 h-4 text-fuchsia-400" />
                  <code className="text-xs text-fuchsia-300">{b.batch_id}</code>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    b.status === "SIMULATED" ? "bg-amber-500/20 text-amber-300" : "bg-emerald-500/20 text-emerald-300"
                  }`}>
                    {b.status}
                  </span>
                  <span className="text-xs text-neutral-500">· {b.mode}</span>
                  <span className="ml-auto text-sm font-bold">
                    {b.total_vibez_minted.toFixed(2)} $DSG · {b.eligible_count} wallets
                  </span>
                  <span className="text-xs text-neutral-600">
                    {new Date(b.initiated_at).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const KPI: React.FC<{ label: string; value: string; hint?: string; accent?: string }> = ({
  label,
  value,
  hint,
  accent = "fuchsia",
}) => {
  const accentMap: Record<string, string> = {
    fuchsia: "text-fuchsia-300",
    emerald: "text-emerald-300",
    amber: "text-amber-300",
    purple: "text-purple-300",
  };
  return (
    <div className="p-4 rounded-xl bg-neutral-900/60 border border-white/5" data-testid={`tge-kpi-${label.toLowerCase().replace(/\s+/g, "-")}`}>
      <div className="text-xs font-mono uppercase tracking-widest text-neutral-500">{label}</div>
      <div className={`text-2xl font-black mt-1 ${accentMap[accent] || accentMap.fuchsia}`}>{value}</div>
      {hint && <div className="text-[10px] text-neutral-600 mt-0.5">{hint}</div>}
    </div>
  );
};

export default TGEAdminDashboard;
