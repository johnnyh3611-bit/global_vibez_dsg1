/**
 * AdminRecirculation — Feb 2026 · In-App Coin Recirculation (Blueprint 40/30/30)
 *
 * IMPORTANT: this dashboard is for the IN-APP COIN economy ONLY.
 * The DSG token (Solana SPL) keeps its own burn schedule — see the
 * Burn Schedule admin elsewhere. The two are deliberately decoupled.
 *
 * Three sections:
 *   • Pools card — live Tournament Pool + Treasury balances and the
 *     locked airlock total. Updates on every visit.
 *   • Recent ledger — every 40/30/30 split, newest-first, with source.
 *   • Airlock held — the 30% portion currently in 72h hold.
 *
 * Backend contract:
 *   GET /api/admin/recirculation/summary
 *   GET /api/admin/recirculation/ledger?source=X&user_id=Y&limit=N
 *   GET /api/admin/recirculation/airlocks?status=held|cleared&limit=N
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

type Summary = {
  tournament_pool: number;
  treasury: number;
  airlock_locked: number;
  model: string;
  split_pct: { tournament: number; treasury: number; airlock: number };
  airlock_hold_seconds: number;
};

type LedgerRow = {
  recirc_id: string;
  source: string;
  user_id: string | null;
  amount_coins: number;
  split: { tournament: number; treasury: number; airlock: number };
  at: string;
};

type AirlockRow = {
  recirc_id: string;
  amount_coins: number;
  source: string;
  status: string;
  queued_at: string;
  clears_at: string;
};

const API = process.env.REACT_APP_BACKEND_URL;
const fmt = (n: number) => n.toLocaleString();

const AdminRecirculation: React.FC = () => {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [airlocks, setAirlocks] = useState<AirlockRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sRes, lRes, aRes] = await Promise.all([
        fetch(`${API}/api/admin/recirculation/summary`, { credentials: 'include' }),
        fetch(`${API}/api/admin/recirculation/ledger?limit=50`, { credentials: 'include' }),
        fetch(`${API}/api/admin/recirculation/airlocks?status=held&limit=50`, { credentials: 'include' }),
      ]);
      if (!sRes.ok || !lRes.ok || !aRes.ok) {
        throw new Error(`HTTP ${sRes.status}/${lRes.status}/${aRes.status}`);
      }
      const [s, l, a] = await Promise.all([sRes.json(), lRes.json(), aRes.json()]);
      setSummary(s);
      setLedger(l?.rows || []);
      setAirlocks(a?.rows || []);
    } catch (err: any) {
      toast.error(`Failed to load recirculation: ${err?.message || err}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="p-8 space-y-6" data-testid="admin-recirculation-page">
      <header className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-black text-white mb-1">
            In-App Coin Recirculation
          </h1>
          <p className="text-sm text-gray-400 max-w-2xl">
            Fixed-supply 40/30/30 engine for the in-app ₵ coin economy
            (Blueprint). Coins no longer burn — they cycle through pools
            to drive velocity. The DSG token has its own separate burn
            schedule.
          </p>
        </div>
        <Button
          onClick={load}
          disabled={loading}
          className="bg-fuchsia-500 hover:bg-fuchsia-400 text-white font-bold disabled:opacity-40"
          data-testid="admin-recirculation-refresh-btn"
        >
          {loading ? 'Loading…' : 'Refresh'}
        </Button>
      </header>

      <Card
        className="p-6 bg-black/40 border border-fuchsia-500/30"
        data-testid="admin-recirculation-pools-card"
      >
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs uppercase tracking-widest text-zinc-500">
            Pool balances
          </span>
          {summary && (
            <Badge
              variant="outline"
              className="text-emerald-300 border-emerald-500/50 bg-emerald-950/30"
            >
              {summary.split_pct.tournament * 100}% /{' '}
              {summary.split_pct.treasury * 100}% /{' '}
              {summary.split_pct.airlock * 100}%
            </Badge>
          )}
        </div>
        {!summary ? (
          <p className="text-sm text-zinc-400">Loading pools…</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div data-testid="admin-recirculation-tournament-pool">
              <div className="text-xs uppercase tracking-widest text-zinc-500 mb-1">
                Tournament Pool (40%)
              </div>
              <div className="text-3xl font-black text-white font-mono">
                ₵ {fmt(summary.tournament_pool)}
              </div>
            </div>
            <div data-testid="admin-recirculation-treasury">
              <div className="text-xs uppercase tracking-widest text-zinc-500 mb-1">
                Treasury (30%)
              </div>
              <div className="text-3xl font-black text-white font-mono">
                ₵ {fmt(summary.treasury)}
              </div>
            </div>
            <div data-testid="admin-recirculation-airlock-locked">
              <div className="text-xs uppercase tracking-widest text-zinc-500 mb-1">
                Airlock locked (30%)
              </div>
              <div className="text-3xl font-black text-amber-300 font-mono">
                ₵ {fmt(summary.airlock_locked)}
              </div>
              <div className="text-[10px] uppercase tracking-widest text-zinc-500 mt-1">
                72h hold · auto-releases
              </div>
            </div>
          </div>
        )}
      </Card>

      <Card
        className="p-6 bg-black/40 border border-zinc-800"
        data-testid="admin-recirculation-ledger-card"
      >
        <h2 className="text-lg font-bold text-white mb-3">Recent splits</h2>
        {ledger.length === 0 ? (
          <p
            className="text-sm text-zinc-500"
            data-testid="admin-recirculation-ledger-empty"
          >
            No recirculation events yet — split rows will appear as
            users transact in-app.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-zinc-500 uppercase tracking-widest border-b border-zinc-800">
                  <th className="py-2 pr-3">At</th>
                  <th className="py-2 pr-3">Source</th>
                  <th className="py-2 pr-3">User</th>
                  <th className="py-2 pr-3 text-right">Total ₵</th>
                  <th className="py-2 pr-3 text-right">Tournament</th>
                  <th className="py-2 pr-3 text-right">Treasury</th>
                  <th className="py-2 text-right">Airlock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900 font-mono">
                {ledger.map((r) => (
                  <tr
                    key={r.recirc_id}
                    data-testid={`admin-recirculation-ledger-row-${r.recirc_id}`}
                  >
                    <td className="py-2 pr-3 text-zinc-400 whitespace-nowrap">
                      {r.at.replace('T', ' ').slice(0, 19)}
                    </td>
                    <td className="py-2 pr-3 text-zinc-200">{r.source}</td>
                    <td className="py-2 pr-3 text-zinc-300 truncate max-w-[120px]">
                      {r.user_id || '—'}
                    </td>
                    <td className="py-2 pr-3 text-right text-white">{fmt(r.amount_coins)}</td>
                    <td className="py-2 pr-3 text-right text-emerald-300">
                      {fmt(r.split.tournament)}
                    </td>
                    <td className="py-2 pr-3 text-right text-fuchsia-300">
                      {fmt(r.split.treasury)}
                    </td>
                    <td className="py-2 text-right text-amber-300">
                      {fmt(r.split.airlock)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card
        className="p-6 bg-black/40 border border-zinc-800"
        data-testid="admin-recirculation-airlocks-card"
      >
        <h2 className="text-lg font-bold text-white mb-3">
          72h airlock — currently held
        </h2>
        {airlocks.length === 0 ? (
          <p
            className="text-sm text-zinc-500"
            data-testid="admin-recirculation-airlocks-empty"
          >
            No airlock rows currently held.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-800 font-mono text-xs">
            {airlocks.map((a) => (
              <li
                key={a.recirc_id}
                className="flex items-center justify-between py-2"
                data-testid={`admin-recirculation-airlock-row-${a.recirc_id}`}
              >
                <span className="text-zinc-400">{a.queued_at.replace('T', ' ').slice(0, 19)}</span>
                <span className="text-zinc-300">{a.source}</span>
                <span className="text-amber-300">₵ {fmt(a.amount_coins)}</span>
                <span className="text-zinc-500">
                  clears {a.clears_at.replace('T', ' ').slice(0, 19)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
};

export default AdminRecirculation;
