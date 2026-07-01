/**
 * JFTNEscrowTab — Treasury sub-tab for Just-for-the-Night Solana escrow.
 * Lists passes that crossed the 72-hour mark and lets admins Release or
 * Freeze each one. Endpoints:
 *   GET  /api/admin/jftn/escrow-pending
 *   GET  /api/admin/jftn/escrow-summary
 *   POST /api/admin/jftn/release/{pass_id}
 *   POST /api/admin/jftn/freeze/{pass_id}
 */
import { useState, useEffect, useCallback } from "react";
import { Card, Title, Text, Badge } from "@tremor/react";
import { Snowflake, Send, RefreshCw, Lock } from "lucide-react";
import { authFetch } from "@/utils/secureAuth";
import { CURRENCY_SYMBOL } from "@/utils/currency";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

type Pass = {
  pass_id: string;
  user_email: string;
  creator_id: string;
  payment_method?: "coins" | "solana";
  entry_coins?: number | null;
  entry_fee_sol?: number | null;
  status: string;
  is_mock: boolean;
  purchased_at: string;
  payout_eligible_at: string;
  signature: string;
};

type Summary = {
  held_count: number;
  held_total_coins: number;
  held_total_sol: number;
  released_count: number;
  frozen_count: number;
};

export default function JFTNEscrowTab() {
  const [passes, setPasses] = useState<Pass[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const refresh = useCallback(async () => {
    setErrorMessage("");
    try {
      const [pendingRes, summaryRes] = await Promise.all([
        authFetch(`${API}/admin/jftn/escrow-pending`),
        authFetch(`${API}/admin/jftn/escrow-summary`),
      ]);
      if (!pendingRes.ok) {
        const data = await pendingRes.json().catch(() => ({}));
        setErrorMessage(
          pendingRes.status === 403
            ? "Admin access required."
            : data.detail || `Request failed (${pendingRes.status})`,
        );
        return;
      }
      const pendingData = await pendingRes.json();
      setPasses(pendingData.ready_for_release || []);
      if (summaryRes.ok) setSummary(await summaryRes.json());
    } catch {
      setErrorMessage("Network error — could not reach the JFTN escrow API.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleRelease = async (pass: Pass) => {
    const amount =
      pass.payment_method === "coins"
        ? `₵${(pass.entry_coins || 0).toLocaleString()}`
        : `${pass.entry_fee_sol ?? 0} SOL`;
    if (!window.confirm(`Release ${amount} to creator ${pass.creator_id}?`))
      return;
    setActing(pass.pass_id);
    try {
      const res = await authFetch(`${API}/admin/jftn/release/${pass.pass_id}`, {
        method: "POST",
        body: JSON.stringify({ notes: "Released via God-Mode" }),
      });
      if (res.ok) refresh();
      else {
        const data = await res.json().catch(() => ({}));
        alert(data.detail || "Release failed");
      }
    } finally {
      setActing(null);
    }
  };

  const handleFreeze = async (pass: Pass) => {
    const reason = window.prompt("Freeze reason (required):");
    if (!reason) return;
    setActing(pass.pass_id);
    try {
      const res = await authFetch(`${API}/admin/jftn/freeze/${pass.pass_id}`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
      if (res.ok) refresh();
      else {
        const data = await res.json().catch(() => ({}));
        alert(data.detail || "Freeze failed");
      }
    } finally {
      setActing(null);
    }
  };

  return (
    <div className="space-y-6" data-testid="jftn-escrow-tab">
      <Card>
        <div className="flex items-start justify-between gap-4">
          <div>
            <Title>JFTN · Solana Escrow Review</Title>
            <Text className="mt-1">
              Passes that crossed the 72-hour hold are eligible for release or
              freeze. Devnet only.
            </Text>
          </div>
          <button
            onClick={refresh}
            className="flex items-center gap-1 text-xs text-cyan-300 hover:text-cyan-200 px-2 py-1 rounded border border-cyan-500/30"
            data-testid="jftn-escrow-refresh"
          >
            <RefreshCw className="w-3 h-3" /> Refresh
          </button>
        </div>
      </Card>

      {errorMessage && (
        <Card className="bg-red-900/30 border-2 border-red-500/40">
          <Text className="text-red-200">{errorMessage}</Text>
        </Card>
      )}

      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-testid="jftn-escrow-summary">
          <Card decoration="top" decorationColor="cyan">
            <Text>Held in Escrow</Text>
            <p className="text-2xl font-bold text-cyan-300 mt-1">{summary.held_count}</p>
            <Text className="text-xs">
              {CURRENCY_SYMBOL}{summary.held_total_coins.toLocaleString()} · {summary.held_total_sol.toFixed(2)} SOL
            </Text>
          </Card>
          <Card decoration="top" decorationColor="emerald">
            <Text>Released</Text>
            <p className="text-2xl font-bold text-emerald-300 mt-1">{summary.released_count}</p>
          </Card>
          <Card decoration="top" decorationColor="red">
            <Text>Frozen</Text>
            <p className="text-2xl font-bold text-red-300 mt-1">{summary.frozen_count}</p>
          </Card>
          <Card decoration="top" decorationColor="amber">
            <Text>Ready Now</Text>
            <p className="text-2xl font-bold text-amber-300 mt-1">{passes.length}</p>
            <Text className="text-xs">≥ 72h old</Text>
          </Card>
        </div>
      )}

      <Card>
        <Title>Ready for Release ({passes.length})</Title>
        {loading ? (
          <Text className="mt-3">Loading…</Text>
        ) : passes.length === 0 ? (
          <div className="mt-4 flex flex-col items-center text-slate-400 py-6">
            <Lock className="w-10 h-10 mb-2 text-slate-600" />
            <Text>Nothing has crossed the 72-hour mark yet.</Text>
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-cyan-500 uppercase text-xs">
                <tr>
                  <th className="p-2">Pass</th>
                  <th>User</th>
                  <th>Creator</th>
                  <th>Amount</th>
                  <th>Purchased</th>
                  <th>Mode</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody data-testid="jftn-escrow-rows">
                {passes.map((p) => {
                  const busy = acting === p.pass_id;
                  return (
                    <tr
                      key={p.pass_id}
                      className="border-b border-slate-800 hover:bg-cyan-900/10"
                      data-testid={`jftn-escrow-row-${p.pass_id}`}
                    >
                      <td className="p-2 font-mono text-xs text-cyan-200">
                        {p.pass_id}
                      </td>
                      <td className="text-xs">{p.user_email}</td>
                      <td className="text-xs">{p.creator_id}</td>
                      <td className="font-mono">
                        {p.payment_method === "coins"
                          ? `₵${(p.entry_coins || 0).toLocaleString()}`
                          : `${p.entry_fee_sol ?? 0} SOL`}
                      </td>
                      <td className="text-xs text-slate-400">
                        {new Date(p.purchased_at).toLocaleString()}
                      </td>
                      <td>
                        {p.payment_method === "coins" ? (
                          <Badge color="cyan">{CURRENCY_SYMBOL} VIBEZ</Badge>
                        ) : p.is_mock ? (
                          <Badge color="amber">MOCK</Badge>
                        ) : (
                          <Badge color="emerald">DEVNET</Badge>
                        )}
                      </td>
                      <td>
                        <div className="flex gap-2">
                          <button
                            disabled={busy}
                            onClick={() => handleRelease(p)}
                            className="flex items-center gap-1 px-3 py-1 rounded bg-emerald-600/20 border border-emerald-500/40 text-emerald-300 text-xs hover:bg-emerald-600/30 disabled:opacity-50"
                            data-testid={`jftn-escrow-release-${p.pass_id}`}
                          >
                            <Send className="w-3 h-3" />
                            Release
                          </button>
                          <button
                            disabled={busy}
                            onClick={() => handleFreeze(p)}
                            className="flex items-center gap-1 px-3 py-1 rounded bg-red-600/20 border border-red-500/40 text-red-300 text-xs hover:bg-red-600/30 disabled:opacity-50"
                            data-testid={`jftn-escrow-freeze-${p.pass_id}`}
                          >
                            <Snowflake className="w-3 h-3" />
                            Freeze
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
