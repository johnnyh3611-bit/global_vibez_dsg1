/**
 * TreasuryAuditView — replaces the previous AuditLogViewer that was
 * stuck on "Loading…" because it pointed at the wrong audit log.
 *
 * Surfaces the platform's real audit feed:
 *   • god_mode_audit (1110+ rows): chair purchases, premium subs, payouts,
 *     emergency lock toggles, auto-pilot fee changes, escrow releases.
 *   • Admin treasury/health snapshot up top (reserve, liability, fees).
 *   • By-action breakdown so you can see "where does the money flow".
 *
 * Reads `/api/admin/audit/feed` (already exists) and `/api/admin/health-check`.
 */
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";

const API = process.env.REACT_APP_BACKEND_URL;

type AuditRow = {
  user_id: string;
  action: string;
  amount: number;
  meta: Record<string, any>;
  at: string;
};

type Health = {
  status: string;
  reserve_usd: number;
  total_liability_usd: number;
  reserve_ratio: number | null;
  payout_multiplier: number;
  current_house_fee_pct: number;
  emergency_lock: boolean;
};

const fmtUsd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

const ICON: Record<string, string> = {
  CHAIR_PURCHASE: "🪑",
  CHAIR_POOL_PAYOUT: "💎",
  PREMIUM_SUBSCRIPTION: "✨",
  FOUNDERS_PASS_ACTIVATED: "♠️",
  TOKEN_BURN: "🔥",
  VAULT_WITHDRAW: "🏦",
  VAULT_DEPOSIT: "💰",
  MANUAL_CREDIT: "✍️",
  ESCROW_RELEASE: "🤝",
  KYC_SUBMITTED: "🪪",
  EMERGENCY_LOCK_ENABLED: "🚨",
  EMERGENCY_LOCK_RELEASED: "🟢",
  AUTO_PILOT_FEE_ADJUSTED: "🎚",
  AUTO_PILOT_TOGGLED: "🛠",
};

const TONE: Record<string, string> = {
  CHAIR_PURCHASE: "text-amber-300",
  CHAIR_POOL_PAYOUT: "text-fuchsia-300",
  PREMIUM_SUBSCRIPTION: "text-emerald-300",
  FOUNDERS_PASS_ACTIVATED: "text-cyan-300",
  TOKEN_BURN: "text-rose-300",
  EMERGENCY_LOCK_ENABLED: "text-rose-400",
  EMERGENCY_LOCK_RELEASED: "text-emerald-300",
  AUTO_PILOT_FEE_ADJUSTED: "text-amber-200",
};

export default function TreasuryAuditView() {
  const [rows, setRows] = useState<AuditRow[] | null>(null);
  const [byAction, setByAction] = useState<
    { _id: string; count: number; total_amount: number }[]
  >([]);
  const [health, setHealth] = useState<Health | null>(null);
  const [filter, setFilter] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      const params = new URLSearchParams({ limit: "200" });
      if (filter) params.set("action", filter);
      const [feed, hc] = await Promise.all([
        fetch(`${API}/api/admin/audit/feed?${params}`, {}),
        fetch(`${API}/api/admin/health-check`, {}),
      ]);
      if (!feed.ok) {
        setError(`Audit feed returned ${feed.status}`);
        setRows([]);
        return;
      }
      const f = await feed.json();
      setRows(f.rows || []);
      setByAction(f.by_action || []);
      if (hc.ok) setHealth(await hc.json());
      setError(null);
    } catch (e: any) {
      setError(e?.message || "Could not load audit feed.");
      setRows([]);
    }
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
    // eslint-disable-next-line
  }, [filter]);

  const totalAmount = useMemo(
    () => byAction.reduce((s, r) => s + (r.total_amount || 0), 0),
    [byAction],
  );

  return (
    <div className="space-y-4" data-testid="treasury-audit-view">
      {/* Treasury snapshot */}
      {health && (
        <div className="grid sm:grid-cols-4 gap-3">
          <div className="rounded-xl bg-black/40 border border-cyan-500/30 p-4">
            <p className="text-[10px] uppercase tracking-widest text-cyan-400">Reserve</p>
            <p className="text-xl font-black text-cyan-200 mt-1">
              {fmtUsd(health.reserve_usd)}
            </p>
          </div>
          <div className="rounded-xl bg-black/40 border border-amber-500/30 p-4">
            <p className="text-[10px] uppercase tracking-widest text-amber-400">Liability</p>
            <p className="text-xl font-black text-amber-200 mt-1">
              {fmtUsd(health.total_liability_usd)}
            </p>
          </div>
          <div className="rounded-xl bg-black/40 border border-fuchsia-500/30 p-4">
            <p className="text-[10px] uppercase tracking-widest text-fuchsia-400">Coverage</p>
            <p className="text-xl font-black text-fuchsia-200 mt-1">
              {(health.reserve_ratio ?? 99).toFixed(2)}×
            </p>
          </div>
          <div className="rounded-xl bg-black/40 border border-emerald-500/30 p-4">
            <p className="text-[10px] uppercase tracking-widest text-emerald-400">House fee</p>
            <p className="text-xl font-black text-emerald-200 mt-1">
              {(health.current_house_fee_pct * 100).toFixed(0)}%
            </p>
          </div>
        </div>
      )}

      {/* By-action breakdown */}
      {byAction.length > 0 && (
        <div className="rounded-xl bg-slate-900/60 border border-slate-700 p-4">
          <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-3">
            Activity by event type ({totalAmount > 0 ? `${fmtUsd(totalAmount)} flowed` : "totals"})
          </p>
          <div className="flex flex-wrap gap-2" data-testid="treasury-audit-breakdown">
            <button
              onClick={() => setFilter("")}
              className={`text-[11px] px-3 py-1 rounded-full transition ${
                filter === ""
                  ? "bg-cyan-500 text-black font-black"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              All
            </button>
            {byAction.slice(0, 14).map((b) => (
              <button
                key={b._id}
                onClick={() => setFilter(b._id)}
                className={`text-[11px] px-3 py-1 rounded-full transition ${
                  filter === b._id
                    ? "bg-cyan-500 text-black font-black"
                    : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                }`}
              >
                {ICON[b._id] || "📝"} {b._id.replace(/_/g, " ")} ·{" "}
                <span className="opacity-70">{b.count}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Feed */}
      <div className="rounded-xl bg-slate-900/60 border border-slate-700 overflow-hidden">
        <div className="px-4 py-2 border-b border-slate-700 flex items-center justify-between">
          <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">
            Audit feed {filter && `· ${filter}`}
          </p>
          <button
            onClick={load}
            className="text-[10px] uppercase tracking-widest text-cyan-300 hover:text-cyan-100"
          >
            ↻ Refresh
          </button>
        </div>
        {error ? (
          <div className="p-6 text-center">
            <p className="text-rose-300 text-sm">⚠ {error}</p>
            <button
              onClick={load}
              className="mt-3 text-[11px] bg-cyan-500 text-black font-bold px-4 py-2 rounded-full"
            >
              Retry
            </button>
          </div>
        ) : rows === null ? (
          <div className="p-6 text-center text-slate-400 text-sm">
            Loading audit events…
          </div>
        ) : rows.length === 0 ? (
          <div className="p-6 text-center text-slate-400 text-sm">
            ✨ No audit events yet.
          </div>
        ) : (
          <div className="max-h-[600px] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="text-slate-500 uppercase tracking-widest text-[10px] sticky top-0 bg-slate-900">
                <tr>
                  <th className="text-left px-4 py-2">When</th>
                  <th className="text-left px-4 py-2">Event</th>
                  <th className="text-left px-4 py-2">User</th>
                  <th className="text-right px-4 py-2">Amount (USD)</th>
                  <th className="text-left px-4 py-2">Detail</th>
                </tr>
              </thead>
              <tbody data-testid="treasury-audit-rows">
                {rows.map((r, i) => (
                  <motion.tr
                    key={`${r.at}-${i}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.2, delay: i * 0.005 }}
                    className="border-t border-slate-800 hover:bg-slate-800/40"
                  >
                    <td className="px-4 py-2 text-slate-400 font-mono whitespace-nowrap">
                      {new Date(r.at).toLocaleDateString()}
                      <br />
                      <span className="text-[10px] text-slate-500">
                        {new Date(r.at).toLocaleTimeString()}
                      </span>
                    </td>
                    <td className={`px-4 py-2 font-bold ${TONE[r.action] || "text-slate-200"}`}>
                      {ICON[r.action] || "📝"}{" "}
                      {r.action.replace(/_/g, " ").toLowerCase()}
                    </td>
                    <td className="px-4 py-2 text-slate-300 font-mono text-[11px]">
                      {r.user_id === "system"
                        ? <span className="text-amber-300">system</span>
                        : r.user_id?.slice(0, 16) + "…"}
                    </td>
                    <td className="px-4 py-2 text-right text-amber-300 font-bold">
                      {r.amount ? fmtUsd(r.amount) : "—"}
                    </td>
                    <td className="px-4 py-2 text-slate-400 max-w-md">
                      {r.meta && Object.keys(r.meta).length > 0 ? (
                        <details>
                          <summary className="cursor-pointer text-cyan-400 hover:text-cyan-200">
                            view ({Object.keys(r.meta).length} fields)
                          </summary>
                          <pre className="mt-1 text-[10px] text-slate-300 bg-black/40 p-2 rounded overflow-x-auto">
                            {JSON.stringify(r.meta, null, 2)}
                          </pre>
                        </details>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
