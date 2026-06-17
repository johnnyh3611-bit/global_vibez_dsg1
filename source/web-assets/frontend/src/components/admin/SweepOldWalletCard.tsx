/**
 * SweepOldWalletCard — operator safety net.
 *
 * When the platform's receive wallet is rotated, occasional users may still
 * send funds to the OLD address. This card lets the founder:
 *   1. Paste the old wallet → see live SOL balance (admin-only RPC read)
 *   2. Hit "Generate sweep" → get copy-paste instructions to sign in
 *      Phantom or Squads UI (we don't hold the old key server-side)
 *
 * No signing happens server-side. This is intentional — the old wallet's
 * private key is owned by the founder, not the server.
 */
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowDownToLine, Copy, ShieldAlert, Wallet } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

type BalanceResp = {
  old_wallet: string;
  current_treasury: string | null;
  balance_lamports: number;
  balance_sol: number;
  sweepable_lamports: number;
  sweepable_sol: number;
  fee_buffer_lamports: number;
};

type InstructionsResp = {
  from: string;
  to: string;
  amount_lamports: number;
  amount_sol: number;
  memo: string;
  instructions: string[];
};

function copy(value: string, label: string) {
  navigator.clipboard
    .writeText(value)
    .then(() => toast.success(`${label} copied`))
    .catch(() => toast.error("Couldn't copy — copy manually"));
}

export default function SweepOldWalletCard() {
  const [oldWallet, setOldWallet] = useState("");
  const [balance, setBalance] = useState<BalanceResp | null>(null);
  const [instr, setInstr] = useState<InstructionsResp | null>(null);
  const [loading, setLoading] = useState<"balance" | "instr" | null>(null);

  const checkBalance = async () => {
    if (!oldWallet.trim()) {
      toast.error("Paste the old wallet address first");
      return;
    }
    setLoading("balance");
    setBalance(null);
    setInstr(null);
    try {
      const r = await fetch(
        `${API}/api/admin/solana-indexer/sweep-balance?old_wallet=${encodeURIComponent(oldWallet.trim())}`,
        {},
      );
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.detail || `HTTP ${r.status}`);
      }
      const data: BalanceResp = await r.json();
      setBalance(data);
      if (data.balance_lamports === 0) {
        toast.message("Old wallet is empty — nothing to sweep");
      } else {
        toast.success(`${data.balance_sol.toFixed(4)} SOL stranded on old wallet`);
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(null);
    }
  };

  const buildInstructions = async () => {
    if (!oldWallet.trim()) return;
    setLoading("instr");
    setInstr(null);
    try {
      const r = await fetch(
        `${API}/api/admin/solana-indexer/sweep-instructions?old_wallet=${encodeURIComponent(oldWallet.trim())}`,
        { method: "POST",},
      );
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.detail || `HTTP ${r.status}`);
      }
      setInstr(await r.json());
      toast.success("Sweep instructions ready");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(null);
    }
  };

  return (
    <Card
      className="bg-slate-900/70 border-slate-800 p-5"
      data-testid="sweep-old-wallet-card"
    >
      <div className="flex items-start gap-3 mb-4">
        <ArrowDownToLine className="w-5 h-5 text-amber-400 mt-0.5" />
        <div>
          <h3 className="text-sm uppercase tracking-wider text-slate-300">
            Sweep Old Wallet → Current Treasury
          </h3>
          <p className="text-xs text-slate-500 mt-0.5 max-w-xl">
            Safety net for funds users sent to a retired receive address.
            Read-only here — sign &amp; broadcast from Phantom / Squads UI.
          </p>
        </div>
      </div>

      <div className="grid md:grid-cols-[1fr_auto_auto] gap-2 items-end">
        <div>
          <Label className="text-slate-400 text-xs">Old Wallet Address</Label>
          <Input
            data-testid="sweep-old-wallet-input"
            className="bg-slate-950 border-slate-700 text-white mt-1 font-mono text-xs"
            placeholder="e.g. p46P9aVG…"
            value={oldWallet}
            onChange={(e) => setOldWallet(e.target.value)}
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={loading !== null || !oldWallet.trim()}
          onClick={checkBalance}
          data-testid="sweep-check-balance-btn"
        >
          <Wallet className="w-3.5 h-3.5 mr-1.5" />
          {loading === "balance" ? "Checking…" : "Check Balance"}
        </Button>
        <Button
          size="sm"
          disabled={
            loading !== null ||
            !oldWallet.trim() ||
            (balance !== null && balance.sweepable_lamports === 0)
          }
          onClick={buildInstructions}
          className="bg-amber-700 hover:bg-amber-600 text-amber-50"
          data-testid="sweep-build-instructions-btn"
        >
          <ShieldAlert className="w-3.5 h-3.5 mr-1.5" />
          {loading === "instr" ? "Building…" : "Generate Sweep"}
        </Button>
      </div>

      {balance && (
        <div
          className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-3 rounded-lg bg-slate-950/60 border border-slate-800 p-3"
          data-testid="sweep-balance-readout"
        >
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500">
              Old Balance
            </p>
            <p className="text-sm font-mono text-white mt-0.5">
              {balance.balance_sol.toFixed(6)} SOL
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500">
              Sweepable (after fee buffer)
            </p>
            <p className="text-sm font-mono text-emerald-300 mt-0.5">
              {balance.sweepable_sol.toFixed(6)} SOL
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500">
              Current Treasury
            </p>
            <p
              className="text-xs font-mono text-cyan-300 mt-0.5 truncate"
              title={balance.current_treasury || ""}
            >
              {balance.current_treasury
                ? `${balance.current_treasury.slice(0, 8)}…${balance.current_treasury.slice(-6)}`
                : "—"}
            </p>
          </div>
        </div>
      )}

      {instr && (
        <div
          className="mt-4 rounded-lg bg-amber-950/30 border border-amber-700/40 p-4 space-y-3"
          data-testid="sweep-instructions-block"
        >
          <h4 className="text-sm font-semibold text-amber-200 uppercase tracking-wider">
            Sweep Plan
          </h4>
          <div className="grid md:grid-cols-2 gap-3">
            <CopyRow
              label="From (sign with this wallet)"
              value={instr.from}
              testId="sweep-from"
            />
            <CopyRow
              label="To (current treasury)"
              value={instr.to}
              testId="sweep-to"
            />
            <CopyRow
              label="Amount (SOL)"
              value={instr.amount_sol.toFixed(9)}
              testId="sweep-amount"
            />
            <CopyRow
              label="Memo (audit tag)"
              value={instr.memo}
              testId="sweep-memo"
            />
          </div>
          <ol className="list-decimal list-inside text-xs text-amber-100/90 space-y-1 ml-1">
            {instr.instructions.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
        </div>
      )}
    </Card>
  );
}

function CopyRow({
  label,
  value,
  testId,
}: {
  label: string;
  value: string;
  testId: string;
}) {
  return (
    <div className="flex items-end gap-2">
      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-amber-200/70">
          {label}
        </p>
        <code
          className="text-xs font-mono text-amber-50 truncate block"
          title={value}
          data-testid={testId}
        >
          {value}
        </code>
      </div>
      <button
        type="button"
        onClick={() => copy(value, label)}
        className="rounded-md p-1.5 text-amber-300 hover:bg-amber-800/40 transition"
        title="Copy"
        data-testid={`${testId}-copy`}
      >
        <Copy className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
