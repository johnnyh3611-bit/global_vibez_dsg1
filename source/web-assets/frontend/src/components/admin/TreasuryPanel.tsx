import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Coins, RefreshCw, Save, FileText, Usb, ShieldCheck, PenLine, CheckCircle2 } from "lucide-react";
import { useLedger } from "@/components/web3/LedgerSignerProvider";
import { useLedgerSigning } from "@/lib/ledger";
import LedgerConnectButton from "@/components/web3/LedgerConnectButton";
import PhantomConnectButton from "@/components/web3/PhantomConnectButton";
import PerfSparkline from "@/components/admin/PerfSparkline";
import SweepOldWalletCard from "@/components/admin/SweepOldWalletCard";
import SquadsVaultCard from "@/components/admin/SquadsVaultCard";
import SquadsSDKVerifier from "@/components/admin/SquadsSDKVerifier";
import MainnetSignRehearsal from "@/components/admin/MainnetSignRehearsal";

const API = process.env.REACT_APP_BACKEND_URL;

type Cfg = {
  team_pct: number;
  ops_pct: number;
  reserve_pct: number;
  founder_pct: number;
  core_team_pct: number;
  founder_cap_trigger_mrr_usd: number;
  founder_cap_amount_usd: number;
  auto_cap_enabled: boolean;
  squads_address: string | null;
  streamflow_api_key_present: boolean;
  usdc_swap_enabled: boolean;
};

type Dashboard = {
  config: Cfg;
  all_time: Record<string, number>;
  month_to_date: {
    revenue_usd: number;
    founder_paid_usd: number;
    cap_engaged: boolean;
    cap_headroom_usd: number | null;
  };
};

type LedgerRow = {
  tx_id: string;
  source: string;
  user_id?: string;
  gross_usd: number;
  team_usd: number;
  ops_usd: number;
  reserve_usd: number;
  founder_usd: number;
  core_team_usd: number;
  founder_capped: boolean;
  founder_overflow_to_chair_pool_usd: number;
  created_at: string;
};

const fmt = (n?: number | null) =>
  (n ?? 0).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export default function TreasuryPanel() {
  const [dash, setDash] = useState<Dashboard | null>(null);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [editCfg, setEditCfg] = useState<Cfg | null>(null);
  const [saving, setSaving] = useState(false);
  const [snapshotBusy, setSnapshotBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const refresh = async () => {
    const dr = await fetch(`${API}/api/admin/treasury/dashboard`, {});
    if (dr.ok) {
      const data = await dr.json();
      setDash(data);
      setEditCfg(data.config);
    }
    const lr = await fetch(`${API}/api/admin/treasury/ledger?limit=25`, {});
    if (lr.ok) setLedger((await lr.json()).rows || []);
  };

  useEffect(() => { refresh(); }, []);

  const saveConfig = async () => {
    if (!editCfg) return;
    setSaving(true);
    setMsg(null);
    try {
      const r = await fetch(`${API}/api/admin/treasury/config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editCfg),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || "save failed");
      setMsg("✓ Config saved");
      await refresh();
    } catch (e: any) {
      setMsg(`✗ ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const triggerSnapshot = async () => {
    setSnapshotBusy(true);
    setMsg(null);
    try {
      const r = await fetch(`${API}/api/admin/treasury/distribute`, {
        method: "POST",
      });
      if (!r.ok) throw new Error(await r.text());
      setMsg("✓ Distribution snapshot persisted");
      await refresh();
    } catch (e: any) {
      setMsg(`✗ ${e.message}`);
    } finally {
      setSnapshotBusy(false);
    }
  };

  if (!dash || !editCfg) {
    return <p className="text-slate-400" data-testid="treasury-panel-loading">Loading treasury panel…</p>;
  }

  return (
    <div className="space-y-6" data-testid="admin-treasury-panel">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Coins className="w-7 h-7 text-emerald-400" />
          <h2 className="text-2xl font-bold text-white">Treasury</h2>
          {dash.month_to_date.cap_engaged && (
            <Badge className="bg-amber-900/60 border-amber-500/50 text-amber-200">Founder cap ACTIVE</Badge>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={refresh} data-testid="treasury-refresh">
            <RefreshCw className="w-4 h-4 mr-1" /> Refresh
          </Button>
          <Button size="sm" onClick={triggerSnapshot} disabled={snapshotBusy} data-testid="treasury-snapshot-btn">
            <FileText className="w-4 h-4 mr-1" /> {snapshotBusy ? "Snapshotting…" : "Snapshot Distribution"}
          </Button>
        </div>
      </div>

      {msg && <p className="text-sm text-emerald-300">{msg}</p>}

      {/* On-chain Squads multisig — pinned at the top so the MAINNET
          badge is the first thing the founder sees on the panel.
          Read-only in Phase A; signing UI ships in Phase B. */}
      <SquadsVaultCard />

      {/* SDK Compatibility Verifier — read-only diagnostic. Operator
          clicks "Run Verifier" before any in-app SDK signing work to
          confirm @sqds/multisig can parse this Squad's on-chain state. */}
      <SquadsSDKVerifier
        squadAddress={(dash as { squads?: { squad_address?: string | null } } | null)?.squads?.squad_address || null}
      />

      {/* First-mainnet-sign rehearsal — appears right under the Squads
          card so the workflow is: see vault status → walk through
          checklist → click "New Transaction (Squads UI)". */}
      <MainnetSignRehearsal />

      <HardwareSignerCard />

      {/* In-app wallet (Phantom Connect SDK) — drop-in for users who'd
          rather sign in with Google / Apple than juggle a browser
          extension. Sits next to the Ledger card so the founder can
          see all signing surfaces in one glance. */}
      <Card
        className="bg-slate-900/70 border-slate-800 p-5 flex items-center justify-between gap-4"
        data-testid="treasury-phantom-connect-card"
      >
        <div>
          <h3 className="text-sm uppercase tracking-wider text-slate-300">
            In-App Wallet (Phantom Connect)
          </h3>
          <p className="text-xs text-slate-500 mt-0.5 max-w-md">
            Non-custodial Solana wallet via Google / Apple / Phantom OAuth.
            Useful for testing the user-side deposit flow end-to-end.
          </p>
        </div>
        <PhantomConnectButton label="Connect In-App Wallet" />
      </Card>

      <PerfSparkline />

      <SweepOldWalletCard />

      {/* MTD card */}
      <Card className="bg-slate-900/70 border-slate-800 p-5">
        <h3 className="text-sm uppercase tracking-wider text-slate-400 mb-3">Month-to-Date</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Stat label="Revenue" value={fmt(dash.month_to_date.revenue_usd)} testid="mtd-revenue" />
          <Stat label="Founder Paid" value={fmt(dash.month_to_date.founder_paid_usd)} testid="mtd-founder" />
          <Stat
            label="Cap Headroom"
            value={dash.month_to_date.cap_headroom_usd === null ? "n/a" : fmt(dash.month_to_date.cap_headroom_usd)}
            testid="mtd-headroom"
          />
          <Stat label="Cap Engaged" value={dash.month_to_date.cap_engaged ? "Yes" : "No"} testid="mtd-cap-engaged" />
        </div>
      </Card>

      {/* All-time */}
      <Card className="bg-slate-900/70 border-slate-800 p-5">
        <h3 className="text-sm uppercase tracking-wider text-slate-400 mb-3">All-Time Allocations</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Stat label="Gross" value={fmt(dash.all_time.gross_usd)} testid="alltime-gross" />
          <Stat label="Team" value={fmt(dash.all_time.team_usd)} testid="alltime-team" />
          <Stat label="Operations" value={fmt(dash.all_time.ops_usd)} testid="alltime-ops" />
          <Stat label="Reserve" value={fmt(dash.all_time.reserve_usd)} testid="alltime-reserve" />
          <Stat label="Founder" value={fmt(dash.all_time.founder_usd)} testid="alltime-founder" />
          <Stat label="Core Team" value={fmt(dash.all_time.core_team_usd)} testid="alltime-core-team" />
          <Stat
            label="Chair Overflow"
            value={fmt(dash.all_time.chair_pool_overflow_usd)}
            testid="alltime-overflow"
          />
          <Stat label="Tx Count" value={`${Math.round(dash.all_time.tx_count || 0)}`} testid="alltime-tx" />
        </div>
      </Card>

      {/* Editable config */}
      <Card className="bg-slate-900/70 border-slate-800 p-5">
        <h3 className="text-sm uppercase tracking-wider text-slate-400 mb-3">Split Configuration</h3>
        <div className="grid md:grid-cols-3 gap-4">
          <PctField label="Team %" v={editCfg.team_pct} on={(v) => setEditCfg({ ...editCfg, team_pct: v })} />
          <PctField label="Operations %" v={editCfg.ops_pct} on={(v) => setEditCfg({ ...editCfg, ops_pct: v })} />
          <PctField label="Reserve %" v={editCfg.reserve_pct} on={(v) => setEditCfg({ ...editCfg, reserve_pct: v })} />
          <PctField
            label="Founder Draw % (of gross)"
            v={editCfg.founder_pct}
            on={(v) => setEditCfg({ ...editCfg, founder_pct: v })}
          />
          <PctField
            label="Core Team % (of gross)"
            v={editCfg.core_team_pct}
            on={(v) => setEditCfg({ ...editCfg, core_team_pct: v })}
          />
          <UsdField
            label="Cap Trigger MRR ($)"
            v={editCfg.founder_cap_trigger_mrr_usd}
            on={(v) => setEditCfg({ ...editCfg, founder_cap_trigger_mrr_usd: v })}
          />
          <UsdField
            label="Cap Amount ($/mo)"
            v={editCfg.founder_cap_amount_usd}
            on={(v) => setEditCfg({ ...editCfg, founder_cap_amount_usd: v })}
          />
          <div className="col-span-full">
            <Label className="text-slate-400 text-xs">Squads Multi-Sig Address (Solana)</Label>
            <Input
              data-testid="treasury-squads-input"
              className="bg-slate-950 border-slate-700 text-white mt-1"
              placeholder="Paste your Squads vault address"
              value={editCfg.squads_address ?? ""}
              onChange={(e) => setEditCfg({ ...editCfg, squads_address: e.target.value || null })}
            />
          </div>
          <label className="flex items-center gap-2 col-span-full text-sm text-slate-300">
            <input
              type="checkbox"
              checked={editCfg.auto_cap_enabled}
              onChange={(e) => setEditCfg({ ...editCfg, auto_cap_enabled: e.target.checked })}
              data-testid="treasury-auto-cap-toggle"
            />
            Auto-engage Founder Cap above MRR trigger
          </label>
        </div>
        <Button onClick={saveConfig} disabled={saving} className="mt-4" data-testid="treasury-save-config">
          <Save className="w-4 h-4 mr-1" /> {saving ? "Saving…" : "Save Config"}
        </Button>
      </Card>

      {/* Ledger */}
      <Card className="bg-slate-900/70 border-slate-800 p-5">
        <h3 className="text-sm uppercase tracking-wider text-slate-400 mb-3">
          Recent Ledger Entries ({ledger.length})
        </h3>
        {ledger.length === 0 ? (
          <p className="text-slate-500 text-sm">No transactions recorded yet.</p>
        ) : (
          <div className="overflow-x-auto" data-testid="treasury-ledger-table">
            <table className="w-full text-xs">
              <thead className="text-slate-500 border-b border-slate-800">
                <tr>
                  <th className="text-left py-2 px-2">When</th>
                  <th className="text-left py-2 px-2">Source</th>
                  <th className="text-right py-2 px-2">Gross</th>
                  <th className="text-right py-2 px-2">Founder</th>
                  <th className="text-right py-2 px-2">Team</th>
                  <th className="text-right py-2 px-2">Ops</th>
                  <th className="text-right py-2 px-2">Reserve</th>
                  <th className="text-center py-2 px-2">Capped?</th>
                </tr>
              </thead>
              <tbody className="text-slate-200">
                {ledger.map((r) => (
                  <tr key={r.tx_id} className="border-b border-slate-800/50">
                    <td className="py-1.5 px-2 text-slate-400">{new Date(r.created_at).toLocaleString()}</td>
                    <td className="py-1.5 px-2">{r.source}</td>
                    <td className="py-1.5 px-2 text-right">{fmt(r.gross_usd)}</td>
                    <td className="py-1.5 px-2 text-right">{fmt(r.founder_usd)}</td>
                    <td className="py-1.5 px-2 text-right">{fmt(r.core_team_usd)}</td>
                    <td className="py-1.5 px-2 text-right">{fmt(r.ops_usd)}</td>
                    <td className="py-1.5 px-2 text-right">{fmt(r.reserve_usd)}</td>
                    <td className="py-1.5 px-2 text-center">{r.founder_capped ? "🔒" : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function Stat({ label, value, testid }: { label: string; value: string; testid: string }) {
  return (
    <div data-testid={testid}>
      <p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p>
      <p className="text-lg font-semibold text-white mt-0.5">{value}</p>
    </div>
  );
}

function PctField({ label, v, on }: { label: string; v: number; on: (v: number) => void }) {
  return (
    <div>
      <Label className="text-slate-400 text-xs">{label}</Label>
      <Input
        type="number"
        step="0.5"
        value={v}
        onChange={(e) => on(parseFloat(e.target.value || "0"))}
        className="bg-slate-950 border-slate-700 text-white mt-1"
      />
    </div>
  );
}

function UsdField({ label, v, on }: { label: string; v: number; on: (v: number) => void }) {
  return (
    <div>
      <Label className="text-slate-400 text-xs">{label}</Label>
      <Input
        type="number"
        step="100"
        value={v}
        onChange={(e) => on(parseFloat(e.target.value || "0"))}
        className="bg-slate-950 border-slate-700 text-white mt-1"
      />
    </div>
  );
}

/**
 * Surfaces the Ledger hardware-signer status right where it matters: above
 * the treasury config. When the founder is about to push a config change
 * or sign a payroll batch, they see at a glance whether their Ledger is
 * armed. Keeps the security cue close to the action — no need to hunt for
 * a wallet button in the header.
 */
function HardwareSignerCard() {
  const { status, publicKey, error } = useLedger();
  const { ready, signMessage } = useLedgerSigning();
  const isConnected = status === "connected";

  // Test-Sign smoke flow — exercises the full
  // device-management-kit + signer-kit + WebHID round-trip with a
  // dummy challenge string. Zero on-chain risk; verifies pairing
  // before any real founder signing.
  const [testStatus, setTestStatus] = useState<
    "idle" | "signing" | "ok" | "fail"
  >("idle");
  const [testSig, setTestSig] = useState<string | null>(null);

  const runTestSign = async () => {
    if (!ready) {
      toast.error("Connect a Ledger first");
      return;
    }
    setTestStatus("signing");
    setTestSig(null);
    try {
      const challenge = `Vibez · founder-test-sign · ${new Date().toISOString()}`;
      const sig = await signMessage(challenge, {
        onStep: (info) => {
          if (info.userAction) toast(info.userAction);
        },
      });
      // Hex preview of the first 8 bytes — enough to confirm distinct sigs.
      const hex = Array.from(sig.slice(0, 8))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      setTestSig(hex);
      setTestStatus("ok");
      toast.success("Ledger sign test PASSED");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Sign test failed";
      setTestStatus("fail");
      toast.error(msg);
    }
  };

  return (
    <Card
      className="bg-slate-900/70 border-slate-800 p-5"
      data-testid="treasury-hardware-signer-card"
    >
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          {isConnected ? (
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
          ) : (
            <Usb className="w-5 h-5 text-slate-400" />
          )}
          <div>
            <h3 className="text-sm uppercase tracking-wider text-slate-300">
              Hardware Signer
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {isConnected && publicKey
                ? `Ledger armed · ${publicKey.toBase58().slice(0, 8)}…${publicKey
                    .toBase58()
                    .slice(-6)}`
                : status === "connecting"
                ? "Open the Solana app on your Ledger…"
                : status === "error"
                ? `Connect failed: ${error ?? "unknown"}`
                : "Connect a Ledger Nano X / S Plus before signing payroll or config changes."}
            </p>
            {testStatus === "ok" && testSig && (
              <p
                className="text-xs text-emerald-400 mt-1 flex items-center gap-1"
                data-testid="ledger-test-sign-ok"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Sign test OK · sig {testSig}…
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {ready && (
            <Button
              variant="outline"
              size="sm"
              disabled={testStatus === "signing"}
              onClick={runTestSign}
              data-testid="ledger-test-sign-button"
              className="border-cyan-700 text-cyan-300 hover:bg-cyan-900/30"
            >
              <PenLine className="w-3.5 h-3.5 mr-1.5" />
              {testStatus === "signing" ? "Signing…" : "Test Sign"}
            </Button>
          )}
          <LedgerConnectButton />
        </div>
      </div>
    </Card>
  );
}
