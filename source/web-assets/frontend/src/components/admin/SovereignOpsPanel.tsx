/**
 * SovereignOpsPanel — God Mode dashboard for v11/v12 Constitution primitives:
 *   1) Solana Bridge queue       (approve / broadcast / reject)
 *   2) Inactivity Reap candidates (12-month dormant scan + sweep)
 *   3) AI Governor Burn-Slide     (live rate + manual execute)
 *
 * ALL writes are dry-run by default. Live on-chain broadcasts are blocked
 * server-side until `SOVEREIGN_OPS_DRY_RUN=0` is set AND the founder
 * explicitly opts in per call.
 */
import { useCallback, useEffect, useState } from "react";
import { Card, Title, Text, Badge, Button } from "@tremor/react";
import {
  Flame, Coins, UserMinus, Loader2, RefreshCw, CheckCircle2, XCircle, Send,
} from "lucide-react";
import { fetchWithAuth, BACKEND_URL } from "@/utils/adminAPI";

type BridgeRow = {
  request_id: string;
  user_id: string;
  coins_in: number;
  genius_bonus: boolean;
  tokens_out: number;
  status: "pending" | "approved" | "broadcast" | "rejected";
  requested_at: string;
  tx_sig?: string | null;
};
type BridgeQueueResp = { rows: BridgeRow[]; counts: Record<string, number>; dry_run_default: boolean };

type BurnSchedule = {
  circulating_supply: number;
  total_burned: number;
  burn_rate: number;
  ceiling: number;
  floor_supply: number;
  next_breakpoint: { current_rate: number; supply_when_rate_drops: number; distance_to_next_step: number };
  wallet_caps: { standard: number; chair_holder: number };
};

type InactivityCandidate = {
  user_id: string;
  email?: string;
  last_login_at?: string;
  last_activity_at?: string;
  token_balance?: number;
  credits_balance?: number;
};
type InactivityResp = {
  cutoff_iso: string;
  rows: InactivityCandidate[];
  count: number;
  total_coins_to_reap: number;
  giveaway_share_coins: number;
  leadership_share_coins: number;
  dry_run_default: boolean;
};

// ── Bridge Queue ─────────────────────────────────────────────────────
const BridgeQueueCard = () => {
  const [data, setData] = useState<BridgeQueueResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetchWithAuth(`${BACKEND_URL}/api/admin/bridge/queue?status=pending`);
      setData(await r.json());
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const approve = async (id: string) => { setBusyId(id); try {
    await fetchWithAuth(`${BACKEND_URL}/api/admin/bridge/${id}/approve`, { method: "POST" });
    await load();
  } finally { setBusyId(null); } };

  const broadcast = async (id: string) => { setBusyId(id); try {
    await fetchWithAuth(`${BACKEND_URL}/api/admin/bridge/${id}/broadcast`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dry_run: true }),
    });
    await load();
  } finally { setBusyId(null); } };

  const reject = async (id: string) => { setBusyId(id); try {
    const reason = window.prompt("Reject reason (optional):") ?? "";
    await fetchWithAuth(`${BACKEND_URL}/api/admin/bridge/${id}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    await load();
  } finally { setBusyId(null); } };

  return (
    <Card data-testid="sovereign-ops-bridge-card">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
        <div className="flex items-center gap-3">
          <Coins className="w-5 h-5 text-cyan-400" />
          <div>
            <Title>Solana Bridge Queue</Title>
            <Text className="text-xs text-slate-400">
              4:1 in-app ₵ → DSG (1.5× Genius). Dry-run enforced server-side until safe phrase.
            </Text>
          </div>
        </div>
        <Button icon={RefreshCw} variant="secondary" onClick={load} loading={loading} data-testid="bridge-queue-refresh">
          Refresh
        </Button>
      </div>
      {data?.counts && (
        <div className="flex gap-2 flex-wrap text-xs mb-3" data-testid="bridge-queue-counts">
          <Badge color="amber">Pending {data.counts.pending}</Badge>
          <Badge color="cyan">Approved {data.counts.approved}</Badge>
          <Badge color="emerald">Broadcast {data.counts.broadcast}</Badge>
          <Badge color="rose">Rejected {data.counts.rejected}</Badge>
          {data.dry_run_default && <Badge color="yellow">DRY-RUN ARMED</Badge>}
        </div>
      )}
      {loading && <div className="flex items-center gap-2 text-slate-400 text-sm py-3"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>}
      {!loading && (data?.rows?.length ?? 0) === 0 && (
        <div className="text-sm text-slate-400 py-4 text-center" data-testid="bridge-queue-empty">No pending bridge requests.</div>
      )}
      <div className="space-y-2">
        {data?.rows?.map((r) => (
          <div key={r.request_id} className="rounded-lg border border-white/10 bg-black/30 p-3 flex items-center justify-between gap-3 flex-wrap" data-testid={`bridge-row-${r.request_id}`}>
            <div className="flex-1 min-w-[200px] text-xs">
              <div className="font-mono text-cyan-200">{r.request_id}</div>
              <div className="text-slate-400">
                {r.user_id} · {r.coins_in.toLocaleString()} ₵ → <span className="text-emerald-300 font-bold">{r.tokens_out.toLocaleString()} DSG</span>
                {r.genius_bonus && <span className="ml-2 text-amber-300">+ 1.5× Genius</span>}
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="xs" color="emerald" icon={CheckCircle2} loading={busyId === r.request_id} onClick={() => approve(r.request_id)} data-testid={`bridge-approve-${r.request_id}`}>
                Approve
              </Button>
              <Button size="xs" color="cyan" icon={Send} loading={busyId === r.request_id} onClick={() => broadcast(r.request_id)} data-testid={`bridge-broadcast-${r.request_id}`}>
                Broadcast (dry)
              </Button>
              <Button size="xs" color="rose" variant="secondary" icon={XCircle} loading={busyId === r.request_id} onClick={() => reject(r.request_id)} data-testid={`bridge-reject-${r.request_id}`}>
                Reject
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};

// ── Inactivity Reap ──────────────────────────────────────────────────
const InactivityCard = () => {
  const [data, setData] = useState<InactivityResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [sweeping, setSweeping] = useState(false);
  const [lastRun, setLastRun] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetchWithAuth(`${BACKEND_URL}/api/admin/inactivity/candidates?limit=50`);
      setData(await r.json());
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const runSweep = async () => {
    setSweeping(true);
    try {
      const r = await fetchWithAuth(`${BACKEND_URL}/api/admin/inactivity/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dry_run: true, limit: 50 }),
      });
      const j = await r.json();
      setLastRun(`Dry sweep ${new Date(j.run_at).toLocaleString()} · ${j.sweep_count} users · ${j.total_coins.toLocaleString()} ₵`);
      await load();
    } finally { setSweeping(false); }
  };

  return (
    <Card data-testid="sovereign-ops-inactivity-card">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
        <div className="flex items-center gap-3">
          <UserMinus className="w-5 h-5 text-rose-400" />
          <div>
            <Title>Inactivity Reap · 12-month Dormant Sweep</Title>
            <Text className="text-xs text-slate-400">
              Last login + last activity both stale ≥ 365 days → 50% Giveaway Fund / 50% Leadership Dividends.
            </Text>
          </div>
        </div>
        <Button icon={RefreshCw} variant="secondary" onClick={load} loading={loading} data-testid="inactivity-refresh">
          Scan
        </Button>
      </div>
      {data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs mb-3" data-testid="inactivity-counts">
          <div className="rounded bg-rose-500/10 border border-rose-500/30 p-2">
            <div className="text-rose-300/70 uppercase text-[10px]">Candidates</div>
            <div className="text-lg font-bold text-rose-200">{data.count}</div>
          </div>
          <div className="rounded bg-slate-700/30 p-2">
            <div className="text-slate-400 uppercase text-[10px]">Total ₵ to Reap</div>
            <div className="text-lg font-bold text-slate-200">{data.total_coins_to_reap.toLocaleString()}</div>
          </div>
          <div className="rounded bg-emerald-500/10 border border-emerald-500/30 p-2">
            <div className="text-emerald-300/70 uppercase text-[10px]">Giveaway Share</div>
            <div className="text-lg font-bold text-emerald-200">{data.giveaway_share_coins.toLocaleString()}</div>
          </div>
          <div className="rounded bg-amber-500/10 border border-amber-500/30 p-2">
            <div className="text-amber-300/70 uppercase text-[10px]">Leadership Share</div>
            <div className="text-lg font-bold text-amber-200">{data.leadership_share_coins.toLocaleString()}</div>
          </div>
        </div>
      )}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Button icon={UserMinus} color="rose" loading={sweeping} onClick={runSweep} data-testid="inactivity-run-dry">
          Run Dry Sweep
        </Button>
        {lastRun && <div className="text-xs text-rose-200/80" data-testid="inactivity-last-run">{lastRun}</div>}
      </div>
    </Card>
  );
};

// ── Burn-Slide ───────────────────────────────────────────────────────
const BurnSlideCard = () => {
  const [data, setData] = useState<BurnSchedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState<number>(1_000_000);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${BACKEND_URL}/api/burn/schedule`);
      setData(await r.json());
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const executeBurn = async () => {
    setBusy(true);
    try {
      const r = await fetchWithAuth(`${BACKEND_URL}/api/admin/burn/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, dry_run: true, note: "Dry-run from God Mode" }),
      });
      const j = await r.json();
      setResult(j.success ? `Dry burn logged · supply ${j.supply_before.toLocaleString()} → ${j.supply_after.toLocaleString()} DSG` : JSON.stringify(j));
      await load();
    } catch (e) {
      setResult(`Error: ${(e as Error).message}`);
    } finally { setBusy(false); }
  };

  return (
    <Card data-testid="sovereign-ops-burn-card">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
        <div className="flex items-center gap-3">
          <Flame className="w-5 h-5 text-amber-400" />
          <div>
            <Title>AI Governor · Burn-Slide</Title>
            <Text className="text-xs text-slate-400">
              5% → 0% as supply slides 750M → 350M. −1%/50M burned.
            </Text>
          </div>
        </div>
        <Button icon={RefreshCw} variant="secondary" onClick={load} loading={loading} data-testid="burn-refresh">
          Refresh
        </Button>
      </div>
      {data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs mb-3" data-testid="burn-stats">
          <div className="rounded bg-amber-500/10 border border-amber-500/30 p-2">
            <div className="text-amber-300/70 uppercase text-[10px]">Current Supply</div>
            <div className="text-lg font-bold text-amber-200" data-testid="burn-current-supply">{data.circulating_supply.toLocaleString()}</div>
          </div>
          <div className="rounded bg-rose-500/10 border border-rose-500/30 p-2">
            <div className="text-rose-300/70 uppercase text-[10px]">Total Burned</div>
            <div className="text-lg font-bold text-rose-200">{data.total_burned.toLocaleString()}</div>
          </div>
          <div className="rounded bg-orange-500/10 border border-orange-500/30 p-2">
            <div className="text-orange-300/70 uppercase text-[10px]">Burn Rate</div>
            <div className="text-lg font-bold text-orange-200" data-testid="burn-rate">{(data.burn_rate * 100).toFixed(2)}%</div>
          </div>
          <div className="rounded bg-slate-700/30 p-2">
            <div className="text-slate-400 uppercase text-[10px]">Floor</div>
            <div className="text-lg font-bold text-slate-200">{data.floor_supply.toLocaleString()}</div>
          </div>
        </div>
      )}
      <div className="flex items-end gap-2 flex-wrap">
        <label className="text-xs">
          <div className="text-slate-400 uppercase text-[10px] mb-1">Burn amount (DSG)</div>
          <input
            type="number"
            value={amount}
            min={1}
            max={50_000_000}
            onChange={(e) => setAmount(parseInt(e.target.value || "0", 10))}
            className="w-32 rounded bg-slate-900/80 border border-slate-700 px-2 py-1 text-emerald-200 font-mono"
            data-testid="burn-amount-input"
          />
        </label>
        <Button icon={Flame} color="amber" loading={busy} onClick={executeBurn} data-testid="burn-execute-btn">
          Execute Dry Burn
        </Button>
        {result && <div className="text-xs text-amber-200/80" data-testid="burn-result">{result}</div>}
      </div>
    </Card>
  );
};

// ── Root ─────────────────────────────────────────────────────────────
export const SovereignOpsPanel = () => (
  <div className="space-y-4" data-testid="sovereign-ops-panel">
    <BridgeQueueCard />
    <InactivityCard />
    <BurnSlideCard />
  </div>
);

export default SovereignOpsPanel;
