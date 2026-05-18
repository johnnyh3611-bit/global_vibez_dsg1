/**
 * Admin Payments Audit — Stripe vs internal-coin drift detector (Feb 2026).
 *
 * Three views on one page:
 *   1. Reconcile card — Stripe-paid USD vs internally-credited USD with
 *      a delta indicator (red if non-zero so missing credits surface in
 *      seconds, not months).
 *   2. Summary table — counts + amount_usd grouped by (kind, status)
 *      so the founder spots flow imbalances ("100 created vs 96 paid?
 *      what happened to those 4?").
 *   3. Recent events feed — paginated, filterable by kind / status /
 *      user_id. Helpful for hunting a specific receipt.
 *
 * Backend contract:
 *   GET /api/admin/payments-audit/reconcile?days=N
 *   GET /api/admin/payments-audit/summary?days=N
 *   GET /api/admin/payments-audit/events?kind=X&status=Y&user_id=Z&limit=L
 */
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type SummaryRow = {
  kind: string;
  status: string;
  count: number;
  amount_usd: number;
  coins: number;
};

type EventRow = {
  event_id: string;
  kind: string;
  source: string;
  status: string;
  user_id: string | null;
  amount_usd: number | null;
  coins: number | null;
  stripe_session_id: string | null;
  metadata: Record<string, any>;
  at: string;
};

type Reconcile = {
  window_days: number;
  since: string;
  stripe_paid_usd: number;
  internally_credited_usd: number;
  drift_usd: number;
};

const API = process.env.REACT_APP_BACKEND_URL;
const WINDOW_OPTIONS = [1, 7, 30, 90];

const fmtUsd = (n: number | null | undefined) =>
  typeof n === "number" ? `$${n.toFixed(2)}` : "—";

const AdminPaymentsAudit: React.FC = () => {
  const [days, setDays] = useState<number>(7);
  const [reconcile, setReconcile] = useState<Reconcile | null>(null);
  const [summary, setSummary] = useState<SummaryRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Event filters
  const [filterKind, setFilterKind] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterUser, setFilterUser] = useState<string>("");

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterKind) params.set("kind", filterKind);
      if (filterStatus) params.set("status", filterStatus);
      if (filterUser) params.set("user_id", filterUser);
      params.set("limit", "50");

      const [recRes, sumRes, evtRes] = await Promise.all([
        fetch(`${API}/api/admin/payments-audit/reconcile?days=${days}`, {
          credentials: "include",
        }),
        fetch(`${API}/api/admin/payments-audit/summary?days=${days}`, {
          credentials: "include",
        }),
        fetch(`${API}/api/admin/payments-audit/events?${params.toString()}`, {
          credentials: "include",
        }),
      ]);
      if (!recRes.ok || !sumRes.ok || !evtRes.ok) {
        throw new Error(
          `HTTP ${recRes.status}/${sumRes.status}/${evtRes.status}`,
        );
      }
      const [rec, sum, evt] = await Promise.all([
        recRes.json(),
        sumRes.json(),
        evtRes.json(),
      ]);
      setReconcile(rec);
      setSummary(sum?.rows || []);
      setEvents(evt?.events || []);
    } catch (err: any) {
      toast.error(`Failed to load audit: ${err?.message || err}`);
    } finally {
      setLoading(false);
    }
  }, [days, filterKind, filterStatus, filterUser]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Auto-derive available filter values from the events feed so we
  // never offer a dropdown option that has zero rows.
  const kinds = useMemo(
    () => Array.from(new Set(events.map((e) => e.kind))).sort(),
    [events],
  );
  const statuses = useMemo(
    () => Array.from(new Set(events.map((e) => e.status))).sort(),
    [events],
  );

  const driftSeverity =
    reconcile && Math.abs(reconcile.drift_usd) > 0.01
      ? "danger"
      : "clean";

  return (
    <div className="p-8 space-y-6" data-testid="admin-payments-audit-page">
      <header className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-black text-white mb-1">
            Payments Audit
          </h1>
          <p className="text-sm text-gray-400">
            Stripe receipts vs internal coin credits. Drift surfaces missing
            credits within minutes instead of refund tickets.
          </p>
        </div>
        <div
          className="flex items-center gap-2"
          data-testid="admin-payments-audit-window-picker"
        >
          {WINDOW_OPTIONS.map((d) => (
            <Button
              key={d}
              variant={d === days ? "default" : "outline"}
              size="sm"
              onClick={() => setDays(d)}
              className={
                d === days
                  ? "bg-fuchsia-500 hover:bg-fuchsia-400 text-white"
                  : "bg-transparent border-zinc-700 text-zinc-300"
              }
              data-testid={`admin-payments-audit-window-${d}d`}
            >
              {d}d
            </Button>
          ))}
        </div>
      </header>

      {/* Reconcile card */}
      <Card
        className={`p-6 bg-black/40 border ${
          driftSeverity === "danger"
            ? "border-red-500/50 shadow-[0_0_30px_rgba(239,68,68,0.25)]"
            : "border-emerald-500/40"
        }`}
        data-testid="admin-payments-audit-reconcile-card"
      >
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs uppercase tracking-widest text-zinc-500">
            Reconciliation · last {days} day{days === 1 ? "" : "s"}
          </span>
          <Badge
            variant="outline"
            className={
              driftSeverity === "danger"
                ? "text-red-300 border-red-500/50 bg-red-950/30"
                : "text-emerald-300 border-emerald-500/50 bg-emerald-950/30"
            }
            data-testid="admin-payments-audit-drift-badge"
          >
            {driftSeverity === "danger" ? "DRIFT DETECTED" : "CLEAN"}
          </Badge>
        </div>
        {loading ? (
          <p className="text-sm text-zinc-400">Loading reconciliation…</p>
        ) : reconcile ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div data-testid="admin-payments-audit-stripe-paid">
              <div className="text-xs uppercase tracking-widest text-zinc-500 mb-1">
                Stripe paid
              </div>
              <div className="text-3xl font-black text-white font-mono">
                {fmtUsd(reconcile.stripe_paid_usd)}
              </div>
            </div>
            <div data-testid="admin-payments-audit-credited">
              <div className="text-xs uppercase tracking-widest text-zinc-500 mb-1">
                Internally credited
              </div>
              <div className="text-3xl font-black text-white font-mono">
                {fmtUsd(reconcile.internally_credited_usd)}
              </div>
            </div>
            <div data-testid="admin-payments-audit-drift">
              <div className="text-xs uppercase tracking-widest text-zinc-500 mb-1">
                Drift
              </div>
              <div
                className={`text-3xl font-black font-mono ${
                  driftSeverity === "danger" ? "text-red-400" : "text-emerald-300"
                }`}
              >
                {fmtUsd(reconcile.drift_usd)}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-zinc-500">No reconciliation data yet.</p>
        )}
      </Card>

      {/* Summary table */}
      <Card
        className="p-6 bg-black/40 border border-zinc-800"
        data-testid="admin-payments-audit-summary-card"
      >
        <h2 className="text-lg font-bold text-white mb-3">
          Counts &amp; totals by kind × status
        </h2>
        {loading ? (
          <p className="text-sm text-zinc-400">Loading summary…</p>
        ) : summary.length === 0 ? (
          <p className="text-sm text-zinc-500">
            No payment events in the last {days} day{days === 1 ? "" : "s"} yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-zinc-500 text-xs uppercase tracking-widest border-b border-zinc-800">
                  <th className="py-2 pr-4">Kind</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4 text-right">Count</th>
                  <th className="py-2 pr-4 text-right">USD</th>
                  <th className="py-2 text-right">Coins</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900">
                {summary.map((row, i) => (
                  <tr
                    key={`${row.kind}-${row.status}-${i}`}
                    data-testid={`admin-payments-audit-summary-row-${row.kind}-${row.status}`}
                  >
                    <td className="py-2 pr-4 text-zinc-200">{row.kind}</td>
                    <td className="py-2 pr-4 text-zinc-300">{row.status}</td>
                    <td className="py-2 pr-4 text-right text-white font-mono">
                      {row.count.toLocaleString()}
                    </td>
                    <td className="py-2 pr-4 text-right text-amber-300 font-mono">
                      {fmtUsd(row.amount_usd)}
                    </td>
                    <td className="py-2 text-right text-zinc-300 font-mono">
                      {row.coins.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Events feed */}
      <Card
        className="p-6 bg-black/40 border border-zinc-800"
        data-testid="admin-payments-audit-events-card"
      >
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <h2 className="text-lg font-bold text-white">Recent events</h2>
          <div className="flex items-center gap-2 text-xs">
            <select
              value={filterKind}
              onChange={(e) => setFilterKind(e.target.value)}
              className="bg-zinc-900 border border-zinc-700 rounded-md px-2 py-1 text-zinc-200"
              data-testid="admin-payments-audit-filter-kind"
            >
              <option value="">All kinds</option>
              {kinds.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-zinc-900 border border-zinc-700 rounded-md px-2 py-1 text-zinc-200"
              data-testid="admin-payments-audit-filter-status"
            >
              <option value="">All statuses</option>
              {statuses.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <Input
              placeholder="user_id"
              value={filterUser}
              onChange={(e) => setFilterUser(e.target.value)}
              className="w-44 bg-zinc-900 border-zinc-700 text-zinc-200 h-8"
              data-testid="admin-payments-audit-filter-user"
            />
          </div>
        </div>
        {loading ? (
          <p className="text-sm text-zinc-400">Loading events…</p>
        ) : events.length === 0 ? (
          <p
            className="text-sm text-zinc-500"
            data-testid="admin-payments-audit-events-empty"
          >
            No events match these filters.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-zinc-500 uppercase tracking-widest border-b border-zinc-800">
                  <th className="py-2 pr-3">At</th>
                  <th className="py-2 pr-3">Kind</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Source</th>
                  <th className="py-2 pr-3">User</th>
                  <th className="py-2 pr-3 text-right">USD</th>
                  <th className="py-2 pr-3 text-right">Coins</th>
                  <th className="py-2 text-left">Stripe session</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900 font-mono">
                {events.map((e) => (
                  <tr
                    key={e.event_id}
                    data-testid={`admin-payments-audit-event-${e.event_id}`}
                  >
                    <td className="py-2 pr-3 text-zinc-400 whitespace-nowrap">
                      {e.at.replace("T", " ").slice(0, 19)}
                    </td>
                    <td className="py-2 pr-3 text-zinc-200">{e.kind}</td>
                    <td className="py-2 pr-3 text-zinc-300">{e.status}</td>
                    <td className="py-2 pr-3 text-zinc-400">{e.source}</td>
                    <td className="py-2 pr-3 text-zinc-300 truncate max-w-[120px]">
                      {e.user_id || "—"}
                    </td>
                    <td className="py-2 pr-3 text-right text-amber-300">
                      {fmtUsd(e.amount_usd)}
                    </td>
                    <td className="py-2 pr-3 text-right text-zinc-300">
                      {e.coins != null ? e.coins.toLocaleString() : "—"}
                    </td>
                    <td className="py-2 text-zinc-500 truncate max-w-[160px]">
                      {e.stripe_session_id || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};

export default AdminPaymentsAudit;
