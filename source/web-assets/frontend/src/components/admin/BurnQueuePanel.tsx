import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Flame, RefreshCw, AlertTriangle } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

type ChairRow = {
  chair_id: string;
  user_id?: string;
  price_per_chair_usd?: number;
  quantity?: number;
  premium_lapsed_at?: string;
};
type Queue = {
  totals: { warning: number; final: number; on_deck: number };
  queue: { warning: ChairRow[]; final: ChairRow[]; on_deck: ChairRow[] };
};

const fmt = (n?: number | null) =>
  (n ?? 0).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export default function BurnQueuePanel() {
  const [q, setQ] = useState<Queue | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const refresh = async () => {
    const r = await fetch(`${API}/api/admin/burn-queue`, {});
    if (r.ok) setQ(await r.json());
  };
  useEffect(() => { refresh(); }, []);

  const burn = async (chairId: string) => {
    if (!confirm(`Burn chair ${chairId} and issue dollar-equivalent VIBEZ refund?`)) return;
    setBusy(chairId);
    setMsg(null);
    try {
      const r = await fetch(`${API}/api/admin/burn-queue/execute/${chairId}`, {
        method: "POST",
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || "burn failed");
      setMsg(`✓ Burned ${chairId} · refund ${fmt(data.refund_usd)} → ${data.refund_vibez.toLocaleString()} ₵VIBEZ`);
      await refresh();
    } catch (e: any) {
      setMsg(`✗ ${e.message}`);
    } finally {
      setBusy(null);
    }
  };

  if (!q) return <p className="text-slate-400" data-testid="burn-queue-loading">Loading burn queue…</p>;

  return (
    <Card className="bg-slate-900/70 border-slate-800 p-5" data-testid="burn-queue-panel">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Flame className="w-6 h-6 text-orange-400" />
          <h3 className="text-lg font-bold text-white">60-Day Burn Queue</h3>
        </div>
        <Button size="sm" variant="outline" onClick={refresh} data-testid="burn-queue-refresh">
          <RefreshCw className="w-4 h-4 mr-1" /> Refresh
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <Stat label="Warning (30d+)" value={q.totals.warning} variant="warn" testid="bq-warning" />
        <Stat label="Final Notice (55d+)" value={q.totals.final} variant="final" testid="bq-final" />
        <Stat label="On-Deck (60d+)" value={q.totals.on_deck} variant="ondeck" testid="bq-ondeck" />
      </div>

      {msg && <p className="text-sm text-emerald-300 mb-3">{msg}</p>}

      {q.totals.on_deck === 0 ? (
        <p className="text-slate-500 text-sm text-center py-6">
          No chairs are eligible for burn right now. The queue auto-populates once a chair's premium has
          lapsed for 60 days.
        </p>
      ) : (
        <div className="overflow-x-auto" data-testid="burn-queue-table">
          <table className="w-full text-xs">
            <thead className="text-slate-500 border-b border-slate-800">
              <tr>
                <th className="text-left py-2 px-2">Chair ID</th>
                <th className="text-left py-2 px-2">User</th>
                <th className="text-right py-2 px-2">Refund USD</th>
                <th className="text-left py-2 px-2">Lapsed</th>
                <th className="text-center py-2 px-2">Action</th>
              </tr>
            </thead>
            <tbody className="text-slate-200">
              {q.queue.on_deck.map((r) => (
                <tr key={r.chair_id} className="border-b border-slate-800/50">
                  <td className="py-2 px-2 font-mono text-orange-300">{r.chair_id}</td>
                  <td className="py-2 px-2 text-slate-400">{r.user_id ?? "—"}</td>
                  <td className="py-2 px-2 text-right">
                    {fmt((r.price_per_chair_usd ?? 0) * (r.quantity ?? 1))}
                  </td>
                  <td className="py-2 px-2 text-slate-500">
                    {r.premium_lapsed_at ? new Date(r.premium_lapsed_at).toLocaleDateString() : "—"}
                  </td>
                  <td className="py-2 px-2 text-center">
                    <Button
                      size="sm"
                      onClick={() => burn(r.chair_id)}
                      disabled={busy === r.chair_id}
                      data-testid={`burn-execute-${r.chair_id}`}
                      className="bg-red-600 hover:bg-red-700 text-white"
                    >
                      {busy === r.chair_id ? "Burning…" : "🔥 Burn & Refund"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function Stat({ label, value, variant, testid }: { label: string; value: number; variant: "warn"|"final"|"ondeck"; testid: string }) {
  const cls = {
    warn: "border-amber-500/30 text-amber-300",
    final: "border-orange-500/30 text-orange-300",
    ondeck: "border-red-500/30 text-red-300",
  }[variant];
  return (
    <div className={`bg-slate-950/60 border ${cls} rounded-lg p-3`} data-testid={testid}>
      <p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}
