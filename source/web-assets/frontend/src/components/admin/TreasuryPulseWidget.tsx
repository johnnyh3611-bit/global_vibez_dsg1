/**
 * TreasuryPulseWidget — live infrastructure-wallet health for the founder.
 *
 * Source: v7 OMNI BLUEPRINT — closed-loop self-funding model.
 * Reads /api/pricing/infra/balance + /api/pricing/infra/ledger and
 * surfaces the running balance + last 5 transfers as a real-time
 * "platform pays for itself" telemetry card.
 */
import { useCallback, useEffect, useState } from "react";
import { Card, Title, Text, Metric, Badge } from "@tremor/react";
import { Coins, ArrowDownToLine, RefreshCcw, Building2 } from "lucide-react";
import { fetchWithAuth } from "@/utils/adminAPI";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

interface InfraTransfer {
  transfer_id: string;
  creator_id: string;
  content_type: string;
  count: number;
  amount: number;
  transferred_at: string;
  note: string;
}

interface InfraBalance {
  balance: number;
  total_received: number;
  transfer_count: number;
}

export default function TreasuryPulseWidget() {
  const [balance, setBalance] = useState<InfraBalance | null>(null);
  const [transfers, setTransfers] = useState<InfraTransfer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [bal, led] = await Promise.all([
        fetchWithAuth(`${BACKEND_URL}/api/pricing/infra/balance`).then(r => r.json()),
        fetchWithAuth(`${BACKEND_URL}/api/pricing/infra/ledger?limit=5`).then(r => r.json()),
      ]);
      setBalance(bal);
      setTransfers(led.ledger || []);
    } catch (e: any) {
      setError(e?.message || "Failed to load treasury data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 15000);   // auto-refresh every 15s
    return () => clearInterval(id);
  }, [load]);

  const fmt = (n: number) => `$${n.toFixed(2)}`;
  const fmtTime = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
      return iso;
    }
  };

  return (
    <Card data-testid="treasury-pulse-widget">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-emerald-500/20 border border-emerald-400/40 p-2">
            <Building2 className="w-5 h-5 text-emerald-300" />
          </div>
          <div>
            <Title className="!mb-0">Treasury Pulse</Title>
            <Text className="text-xs text-slate-400 mt-1">
              Closed-loop infrastructure self-funding · v7 OMNI Blueprint
            </Text>
          </div>
        </div>
        <button
          onClick={load}
          disabled={loading}
          data-testid="treasury-pulse-refresh"
          className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-50 text-xs uppercase tracking-widest font-bold flex items-center gap-1"
        >
          <RefreshCcw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Loading…" : "Re-Sync"}
        </button>
      </div>

      {error && (
        <div data-testid="treasury-pulse-error" className="rounded-lg border border-rose-500/40 bg-rose-950/30 px-3 py-2 text-rose-200 text-sm">
          {error}
        </div>
      )}

      {balance && (
        <>
          <div className="grid grid-cols-3 gap-3 mb-5" data-testid="treasury-pulse-stats">
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-900/10 p-3">
              <div className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-emerald-300 mb-1">
                <Coins className="w-3 h-3" /> Wallet Balance
              </div>
              <Metric className="!text-emerald-200" data-testid="treasury-pulse-balance">{fmt(balance.balance)}</Metric>
            </div>
            <div className="rounded-xl border border-cyan-500/30 bg-cyan-900/10 p-3">
              <div className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-cyan-300 mb-1">
                <ArrowDownToLine className="w-3 h-3" /> All-Time
              </div>
              <Metric className="!text-cyan-200">{fmt(balance.total_received)}</Metric>
            </div>
            <div className="rounded-xl border border-violet-500/30 bg-violet-900/10 p-3">
              <div className="text-[10px] uppercase tracking-widest text-violet-300 mb-1">Transfers</div>
              <Metric className="!text-violet-200" data-testid="treasury-pulse-count">{balance.transfer_count.toLocaleString()}</Metric>
            </div>
          </div>

          <div>
            <h3 className="text-xs uppercase tracking-widest text-slate-300 font-bold mb-2">
              Recent transfers
              <span className="text-slate-500 font-normal ml-2">(last 5 · auto-refresh 15s)</span>
            </h3>
            {transfers.length === 0 ? (
              <div className="text-xs text-slate-500 italic px-3 py-4 text-center bg-black/20 rounded-lg border border-white/5">
                No transfers yet — waiting for first creator upload.
              </div>
            ) : (
              <ul className="space-y-1.5" data-testid="treasury-pulse-ledger">
                {[...transfers].reverse().map(t => (
                  <li
                    key={t.transfer_id}
                    data-testid={`treasury-pulse-row-${t.transfer_id}`}
                    className="rounded-lg bg-black/30 border border-white/5 px-3 py-2 flex items-center gap-3"
                  >
                    <Badge size="xs" color="emerald">{t.content_type}</Badge>
                    <div className="flex-1 min-w-0 text-xs">
                      <div className="font-mono text-slate-300 truncate">
                        {t.creator_id} <span className="text-slate-500">×{t.count}</span>
                      </div>
                      <div className="text-[10px] text-slate-500 truncate">{t.note}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-emerald-300 font-mono font-bold text-sm">+{fmt(t.amount)}</div>
                      <div className="text-[10px] text-slate-500">{fmtTime(t.transferred_at)}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </Card>
  );
}
