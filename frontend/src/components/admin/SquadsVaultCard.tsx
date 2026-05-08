/**
 * SquadsVaultCard — read-only on-chain Squads multisig status.
 *
 * Surfaces the live vault balance, network (with MAINNET badge), and
 * cosigner list straight from the new `/api/admin/treasury/squads-status`
 * endpoint. Polls every 60s so the founder can see deposits land in
 * near-real-time without refreshing the panel.
 *
 * No signing happens here — this is purely "show me what's on-chain".
 * The actual Phantom + Ledger 2-of-2 signing UX will live on a
 * separate "Sign Payroll" card in a follow-up phase.
 */
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ShieldCheck,
  AlertTriangle,
  Copy,
  Wallet,
  RefreshCw,
  ExternalLink,
  QrCode,
} from "lucide-react";
import VaultDepositQRModal from "@/components/admin/VaultDepositQRModal";

const API = process.env.REACT_APP_BACKEND_URL;
const POLL_MS = 60_000;

type SquadsStatus = {
  configured: boolean;
  network: string;
  is_mainnet: boolean;
  vault_pda: string | null;
  squad_address: string | null;
  phantom_cosigner: string | null;
  founder_cosigner: string | null;
  threshold: number | null;
  member_count: number | null;
  vault_balance_lamports: number | null;
  vault_balance_sol: number | null;
  rpc_ok: boolean;
};

function truncate(v: string | null | undefined, head = 6, tail = 6) {
  if (!v) return "—";
  if (v.length <= head + tail + 1) return v;
  return `${v.slice(0, head)}…${v.slice(-tail)}`;
}

function copy(value: string, label: string) {
  navigator.clipboard
    .writeText(value)
    .then(() => toast.success(`${label} copied`))
    .catch(() => toast.error("Couldn't copy"));
}

export default function SquadsVaultCard() {
  const [status, setStatus] = useState<SquadsStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qrOpen, setQrOpen] = useState(false);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/admin/treasury/squads-status`, {
      });
      if (!r.ok) throw new Error(`squads-status ${r.status}`);
      setStatus(await r.json());
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const id = setInterval(fetchStatus, POLL_MS);
    return () => clearInterval(id);
  }, []);

  if (status && !status.configured) {
    return (
      <Card
        className="bg-slate-900/70 border-slate-800 p-5"
        data-testid="squads-vault-card-unconfigured"
      >
        <div className="flex items-center gap-3">
          <Wallet className="w-5 h-5 text-slate-500" />
          <div>
            <h3 className="text-sm uppercase tracking-wider text-slate-400">
              Squads Multi-Sig Vault
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Not configured. Set <code className="text-slate-300">SQUADS_VAULT_PDA</code>
              &nbsp;in <code className="text-slate-300">backend/.env</code> to enable
              on-chain treasury reads.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card
      className="bg-slate-900/70 border-slate-800 p-5 space-y-4"
      data-testid="squads-vault-card"
    >
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <ShieldCheck
            className={`w-5 h-5 ${status?.rpc_ok ? "text-emerald-400" : "text-amber-400"}`}
          />
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm uppercase tracking-wider text-slate-300">
                Squads Multi-Sig Vault
              </h3>
              {status?.is_mainnet ? (
                <Badge
                  className="bg-rose-900/60 border-rose-500/60 text-rose-200 font-bold tracking-wider"
                  data-testid="squads-mainnet-badge"
                >
                  ⚠ MAINNET
                </Badge>
              ) : status?.network ? (
                <Badge
                  className="bg-amber-900/60 border-amber-500/40 text-amber-200"
                  data-testid="squads-devnet-badge"
                >
                  {status.network.toUpperCase()}
                </Badge>
              ) : null}
              {status?.threshold && status?.member_count ? (
                <Badge
                  className="bg-cyan-900/60 border-cyan-500/40 text-cyan-200"
                  data-testid="squads-threshold-badge"
                >
                  {status.threshold}-of-{status.member_count}
                </Badge>
              ) : null}
            </div>
            <p className="text-xs text-slate-500 mt-1 max-w-xl">
              Read-only on-chain snapshot. Signing happens client-side via
              Phantom + Ledger — server never holds keys.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={fetchStatus}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-800/60 disabled:opacity-50"
          data-testid="squads-refresh-btn"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {status?.squad_address && (
        <div className="flex flex-wrap gap-2">
          <a
            href={`https://app.squads.so/squads/${status.squad_address}/transactions`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md bg-fuchsia-700 hover:bg-fuchsia-600 px-3 py-1.5 text-xs font-semibold text-white"
            data-testid="squads-open-transactions-btn"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            New Transaction (Squads UI)
          </a>
          <button
            type="button"
            onClick={() => setQrOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-md bg-emerald-700 hover:bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white"
            data-testid="squads-open-qr-btn"
          >
            <QrCode className="w-3.5 h-3.5" />
            Top Up (QR)
          </button>
          <a
            href={`https://app.squads.so/squads/${status.squad_address}/home`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800/60"
            data-testid="squads-open-home-btn"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Squad Home
          </a>
          <a
            href={`https://app.squads.so/squads/${status.squad_address}/members`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800/60"
            data-testid="squads-open-members-btn"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Members
          </a>
        </div>
      )}

      <VaultDepositQRModal
        open={qrOpen}
        onOpenChange={setQrOpen}
        squadAddress={status?.squad_address || null}
        network={status?.network || null}
        isMainnet={!!status?.is_mainnet}
      />

      {error && (
        <div
          className="flex items-center gap-2 text-xs text-amber-400"
          data-testid="squads-error"
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>{error}</span>
        </div>
      )}

      {status && status.is_mainnet && (
        <div
          className="rounded-lg border border-rose-900/50 bg-rose-950/30 p-3 text-xs text-rose-200"
          data-testid="squads-mainnet-warning"
        >
          <strong className="font-bold">⚠ Real-money treasury.</strong>{" "}
          Any signing action against this vault moves actual SOL on Solana
          mainnet. Phase-A view is read-only — the Phantom + Ledger 2-of-2
          signing flow ships in Phase B with a typed-confirmation modal
          and a 0.001 SOL test cap.
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-3">
        <BalanceTile
          label="Vault Balance"
          sol={status?.vault_balance_sol ?? null}
          rpcOk={status?.rpc_ok ?? false}
        />
        <AddressTile
          label="Vault PDA"
          value={status?.vault_pda || ""}
          testId="squads-vault-pda"
        />
        <AddressTile
          label="Squad Address"
          value={status?.squad_address || ""}
          testId="squads-address"
        />
        <AddressTile
          label="Cosigner 1 (Phantom)"
          value={status?.phantom_cosigner || ""}
          testId="squads-phantom-cosigner"
        />
        <AddressTile
          label="Cosigner 2 (Founder)"
          value={status?.founder_cosigner || ""}
          testId="squads-founder-cosigner"
        />
      </div>

      {status?.founder_cosigner && status.founder_cosigner === "8fn1G5eUxvUxz1KfQ7yxFkJkB5o91Cej76xq2Tx58mph" && (
        <div
          className="rounded-lg border border-amber-700/40 bg-amber-950/20 p-3 text-[11px] text-amber-200/90"
          data-testid="squads-cosigner-overlap-warning"
        >
          <strong className="font-semibold">Heads-up:</strong> Cosigner 2 is the
          same wallet as your platform deposit address. Public exposure is fine
          (it's just a pubkey), but if its private key lives on a hot machine,
          treasury security is effectively 1-of-1. Consider rotating Cosigner 2
          to an isolated cold/Ledger key in a future Phase.
        </div>
      )}

      <p className="text-[10px] text-slate-600">
        Polls every {POLL_MS / 1000}s · {status?.rpc_ok ? "RPC OK" : "RPC unavailable"}
      </p>
    </Card>
  );
}

function BalanceTile({
  label,
  sol,
  rpcOk,
}: {
  label: string;
  sol: number | null;
  rpcOk: boolean;
}) {
  return (
    <div
      className="rounded-lg bg-slate-950/60 border border-slate-800 p-3"
      data-testid="squads-vault-balance"
    >
      <p className="text-[10px] uppercase tracking-wider text-slate-500">
        {label}
      </p>
      <p
        className={`text-2xl font-mono mt-0.5 ${rpcOk ? "text-emerald-300" : "text-slate-500"}`}
      >
        {sol === null ? "—" : sol.toFixed(6)}
        <span className="text-xs text-slate-500 ml-1">SOL</span>
      </p>
    </div>
  );
}

function AddressTile({
  label,
  value,
  testId,
}: {
  label: string;
  value: string;
  testId: string;
}) {
  return (
    <div className="rounded-lg bg-slate-950/60 border border-slate-800 p-3">
      <p className="text-[10px] uppercase tracking-wider text-slate-500">
        {label}
      </p>
      <div className="flex items-center justify-between gap-2 mt-1">
        <code
          className="font-mono text-xs text-cyan-300 truncate"
          title={value}
          data-testid={testId}
        >
          {truncate(value, 8, 6)}
        </code>
        {value && (
          <button
            type="button"
            onClick={() => copy(value, label)}
            className="rounded p-1 text-slate-400 hover:bg-slate-800/60 hover:text-cyan-300"
            data-testid={`${testId}-copy`}
            title="Copy"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
