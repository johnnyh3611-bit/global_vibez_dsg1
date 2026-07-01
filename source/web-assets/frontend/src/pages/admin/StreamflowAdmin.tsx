/**
 * Streamflow Admin — crew payout / vesting control panel.
 *
 * Founder connects Solflare (or Phantom), fills in the crew-member
 * wallet + amount + vesting schedule, clicks "Create Stream", signs
 * the tx in the wallet popup. We then POST the resulting stream
 * pubkey + signature to /api/admin/streamflow/streams so the admin
 * log shows it immediately.
 *
 * Read-only section below shows every stream the treasury has ever
 * created (pulled from our store, kept in sync with chain on every
 * write).
 *
 * Security: this page is meant to live under a God-Mode gate. It
 * does NOT hold any private key — every write is signed by Solflare.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import {
  ArrowLeft,
  Wallet,
  Send,
  Clock,
  Users,
  Loader2,
  CheckCircle,
  AlertTriangle,
} from "lucide-react";
import { adminAPI } from "@/utils/adminAPI";

const API = process.env.REACT_APP_BACKEND_URL;
// Devnet USDC mint — default token for crew payouts while in sandbox.
const DEVNET_USDC_MINT = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";

type StreamRow = {
  stream_pubkey: string;
  signature: string;
  recipient: string;
  recipient_label?: string;
  token_mint: string;
  amount_ui: number;
  note?: string;
  period_seconds?: number;
  cliff_seconds?: number;
  status: string;
  created_at: string;
};

type Config = {
  configured: boolean;
  treasury_wallet: string | null;
  cluster: string;
  rpc: string;
  app_url: string;
};

export default function StreamflowAdmin() {
  const { publicKey, signTransaction, connected, sendTransaction } = useWallet();
  const { connection } = useConnection();

  const [config, setConfig] = useState<Config | null>(null);
  const [streams, setStreams] = useState<StreamRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [recipient, setRecipient] = useState("");
  const [recipientLabel, setRecipientLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [periodDays, setPeriodDays] = useState("30");
  const [cliffDays, setCliffDays] = useState("0");
  const [note, setNote] = useState("");
  const [tokenMint, setTokenMint] = useState(DEVNET_USDC_MINT);

  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createOk, setCreateOk] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [statusRes, streamsRes] = await Promise.all([
        adminAPI.fetchWithAuth("/api/admin/streamflow/status"),
        adminAPI.fetchWithAuth("/api/admin/streamflow/streams?limit=50"),
      ]);
      if (statusRes.ok) setConfig(await statusRes.json());
      if (streamsRes.ok) {
        const d = await streamsRes.json();
        setStreams(d.rows || []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const treasuryMatches = useMemo(() => {
    if (!config?.treasury_wallet || !publicKey) return false;
    return publicKey.toBase58() === config.treasury_wallet;
  }, [config?.treasury_wallet, publicKey]);

  const createStream = async () => {
    setCreateError(null);
    setCreateOk(null);
    if (!connected || !publicKey || !signTransaction) {
      setCreateError("Connect your Solflare wallet first.");
      return;
    }
    if (!treasuryMatches) {
      setCreateError(
        `Connected wallet doesn't match treasury wallet ${config?.treasury_wallet}. Switch wallet in Solflare.`,
      );
      return;
    }
    const amt = parseFloat(amount);
    if (!recipient || !amt || amt <= 0) {
      setCreateError("Recipient wallet + amount > 0 are required.");
      return;
    }

    setCreating(true);
    try {
      // Import the SDK lazily so the page still loads even if the
      // SDK has a build-time side-effect on other browsers.
      const sfMod: any = await import("@streamflow/stream");
      // Streamflow SDK expects bn.js BN instances, not native BigInt —
      // the SDK internally calls `.toArrayLike(Buffer, ...)` on amounts.
      const BNMod: any = await import("bn.js");
      const BN = BNMod.default ?? BNMod;
      const SolanaStreamClient =
        sfMod.SolanaStreamClient ?? sfMod.GenericStreamClient;
      const ICluster = sfMod.ICluster ?? { Devnet: "devnet", Mainnet: "mainnet-beta" };
      const client = new SolanaStreamClient(
        connection.rpcEndpoint,
        undefined,
        ICluster.Devnet,
      );

      const nowSec = Math.floor(Date.now() / 1000);
      const periodSec = Math.max(60, parseInt(periodDays || "30") * 86400);
      const cliffSec = Math.max(0, parseInt(cliffDays || "0") * 86400);
      const startTs = nowSec + 30; // start in 30s to give signing time
      const endTs = startTs + periodSec;
      const cliffTs = cliffSec ? startTs + cliffSec : startTs;

      // Amount in base units: USDC = 6 decimals (safe default).
      const baseUnitsStr = String(Math.round(amt * 1_000_000));
      const baseUnitsBN = new BN(baseUnitsStr);
      const perPeriodBN = new BN(
        String(
          Math.max(
            1,
            Math.floor(Math.round(amt * 1_000_000) / Math.max(1, endTs - startTs)),
          ),
        ),
      );

      const createRes = await client.create(
        {
          recipient,
          tokenId: tokenMint,
          start: startTs,
          amount: baseUnitsBN,
          period: 1, // unlock ticker: 1s cadence
          cliff: cliffTs,
          cliffAmount: new BN(0),
          amountPerPeriod: perPeriodBN,
          name: (recipientLabel || "Crew payout").slice(0, 64),
          canTopup: false,
          cancelableBySender: true,
          cancelableByRecipient: false,
          transferableBySender: true,
          transferableByRecipient: false,
          automaticWithdrawal: false,
          withdrawalFrequency: 0,
          partner: null,
        },
        {
          sender: {
            publicKey,
            signTransaction: signTransaction as any,
            signAllTransactions: (txs: any[]) =>
              Promise.all(txs.map((t: any) => (signTransaction as any)(t))),
          },
          isNative: false,
        },
      );

      const streamPubkey =
        (createRes as any)?.metadataId ||
        (createRes as any)?.ixs?.metadataId ||
        (createRes as any)?.id;
      const signature =
        (createRes as any)?.txId ||
        (createRes as any)?.signature ||
        "unknown";

      if (!streamPubkey) {
        throw new Error(
          "Stream created but could not read the returned pubkey — check Solflare for the tx.",
        );
      }

      // Persist to our admin log.
      const rec = await adminAPI.fetchWithAuth(
        "/api/admin/streamflow/streams",
        {
          method: "POST",
          body: JSON.stringify({
            stream_pubkey: String(streamPubkey),
            signature: String(signature),
            recipient,
            recipient_label: recipientLabel || undefined,
            token_mint: tokenMint,
            amount_ui: amt,
            note: note || undefined,
            period_seconds: periodSec,
            cliff_seconds: cliffSec,
          }),
        },
      );
      if (!rec.ok) {
        const e = await rec.json().catch(() => ({}));
        throw new Error(
          e?.detail ||
            "Stream created on-chain but failed to record locally — check /admin/streamflow.",
        );
      }

      setCreateOk(
        `Stream created — pubkey ${String(streamPubkey).slice(0, 8)}… signed ${String(signature).slice(0, 8)}…`,
      );
      setAmount("");
      setRecipient("");
      setRecipientLabel("");
      setNote("");
      await load();
    } catch (e: any) {
      setCreateError(String(e?.message || e).slice(0, 300));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div
      className="min-h-screen bg-[#020a1a] text-slate-100"
      data-testid="streamflow-admin-page"
    >
      <div className="mx-auto max-w-5xl px-5 py-8">
        <Link
          to="/admin"
          className="mb-6 inline-flex items-center gap-2 text-sm text-slate-300 hover:text-white"
          data-testid="streamflow-admin-back"
        >
          <ArrowLeft className="h-4 w-4" /> Back to God-Mode
        </Link>

        <header className="mb-8">
          <h1 className="text-4xl font-bold tracking-tight">
            Crew Payouts <span className="text-cyan-400">·</span> Streamflow
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            Create time-unlocked token streams to crew members, founders, and
            ambassadors. Every stream is signed directly in{" "}
            <strong className="text-cyan-300">Solflare</strong> — this panel
            never holds a private key.
          </p>
        </header>

        {/* Connection / treasury match panel */}
        <section
          className="mb-8 rounded-2xl border border-white/10 bg-slate-950/50 p-5"
          data-testid="streamflow-connect-card"
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="text-sm">
              <div className="text-[10px] uppercase tracking-wider text-slate-500">
                Treasury wallet (expected)
              </div>
              <div
                className="font-mono text-cyan-300 break-all"
                data-testid="streamflow-treasury-display"
              >
                {config?.treasury_wallet || "…"}
              </div>
              <div className="mt-2 text-[10px] uppercase tracking-wider text-slate-500">
                Cluster
              </div>
              <div>{config?.cluster || "…"}</div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <WalletMultiButton />
              {connected && publicKey && (
                <div
                  className={`text-xs ${
                    treasuryMatches ? "text-emerald-300" : "text-rose-300"
                  }`}
                  data-testid="streamflow-match-indicator"
                >
                  {treasuryMatches ? (
                    <span className="inline-flex items-center gap-1">
                      <CheckCircle className="h-3 w-3" /> Treasury wallet matched
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      Wrong wallet — switch in Solflare
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Create form */}
        <section
          className="mb-8 rounded-2xl border border-cyan-500/30 bg-gradient-to-br from-slate-950 to-cyan-950/20 p-6"
          data-testid="streamflow-create-card"
        >
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <Send className="h-4 w-4 text-cyan-400" /> New crew payout
          </h2>

          {/* Vest preset buttons — one-click templates so payouts stay
               consistent across the crew without re-typing rules. */}
          <div className="mb-5 flex flex-wrap gap-2" data-testid="streamflow-presets">
            {[
              {
                key: "founder",
                label: "Founder · 365d / 90d cliff",
                periodDays: "365",
                cliffDays: "90",
                amount: "1000000",
                noteSuffix: "[Founder vest]",
              },
              {
                key: "crew",
                label: "Crew · 30d / 0 cliff",
                periodDays: "30",
                cliffDays: "0",
                amount: "10000",
                noteSuffix: "[Crew vest]",
              },
              {
                key: "ambassador",
                label: "Ambassador · 90d / 0 cliff",
                periodDays: "90",
                cliffDays: "0",
                amount: "5000",
                noteSuffix: "[Ambassador vest]",
              },
            ].map((p) => (
              <button
                key={p.key}
                onClick={() => {
                  setPeriodDays(p.periodDays);
                  setCliffDays(p.cliffDays);
                  if (!amount) setAmount(p.amount);
                  setNote((prev) =>
                    prev.includes(p.noteSuffix) ? prev : `${prev} ${p.noteSuffix}`.trim(),
                  );
                }}
                className="px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest border border-cyan-500/30 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/20 transition-colors"
                data-testid={`streamflow-preset-${p.key}`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <LabeledInput
              label="Recipient wallet (Solana)"
              value={recipient}
              onChange={setRecipient}
              placeholder="e.g. 8fn1G5eUxv…"
              testid="streamflow-recipient-input"
            />
            <LabeledInput
              label="Recipient label (optional)"
              value={recipientLabel}
              onChange={setRecipientLabel}
              placeholder="Alex — founding engineer"
              testid="streamflow-label-input"
            />
            <LabeledInput
              label="Amount (USDC)"
              value={amount}
              onChange={setAmount}
              placeholder="100"
              testid="streamflow-amount-input"
              numeric
            />
            <LabeledInput
              label="Token mint (devnet USDC default)"
              value={tokenMint}
              onChange={setTokenMint}
              testid="streamflow-token-input"
            />
            <LabeledInput
              label="Vesting period (days)"
              value={periodDays}
              onChange={setPeriodDays}
              testid="streamflow-period-input"
              numeric
            />
            <LabeledInput
              label="Cliff (days)"
              value={cliffDays}
              onChange={setCliffDays}
              testid="streamflow-cliff-input"
              numeric
            />
            <div className="md:col-span-2">
              <LabeledInput
                label="Internal note (not on-chain)"
                value={note}
                onChange={setNote}
                placeholder="Q2 2026 crew vest"
                testid="streamflow-note-input"
              />
            </div>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={createStream}
              disabled={creating || !connected || !treasuryMatches}
              className="inline-flex items-center gap-2 rounded-full bg-cyan-500 px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-50"
              data-testid="streamflow-create-btn"
            >
              {creating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Sign & create stream
            </button>
            {createOk && (
              <span
                className="inline-flex items-center gap-1 text-xs text-emerald-300"
                data-testid="streamflow-create-ok"
              >
                <CheckCircle className="h-3 w-3" /> {createOk}
              </span>
            )}
            {createError && (
              <span
                className="text-xs text-rose-300"
                data-testid="streamflow-create-error"
              >
                {createError}
              </span>
            )}
          </div>
          <p className="mt-4 text-[11px] text-slate-500">
            Tip: for crew payouts we recommend <strong>30-day linear
            vesting, no cliff</strong>. For founder allocations, <strong>365 days
            with a 90-day cliff</strong> is standard.
          </p>
        </section>

        {/* Streams list */}
        <section data-testid="streamflow-streams-section">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
            <Clock className="h-4 w-4 text-cyan-400" /> Streams history
          </h2>
          {loading ? (
            <p className="text-sm text-slate-400">Loading…</p>
          ) : streams.length === 0 ? (
            <p
              className="rounded-lg border border-dashed border-white/10 bg-slate-950/40 p-6 text-center text-sm text-slate-400"
              data-testid="streamflow-empty-state"
            >
              No streams created yet. The first crew payout you sign will
              appear here.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-white/10">
              <table className="w-full text-sm">
                <thead className="bg-slate-950/60 text-xs uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="px-3 py-2 text-left">When</th>
                    <th className="px-3 py-2 text-left">Recipient</th>
                    <th className="px-3 py-2 text-right">Amount</th>
                    <th className="px-3 py-2 text-right">Vesting</th>
                    <th className="px-3 py-2 text-left">Status</th>
                    <th className="px-3 py-2 text-left">Tx</th>
                  </tr>
                </thead>
                <tbody>
                  {streams.map((s) => (
                    <tr
                      key={s.stream_pubkey}
                      className="border-t border-white/5 hover:bg-slate-950/40"
                      data-testid={`streamflow-row-${s.stream_pubkey}`}
                    >
                      <td className="px-3 py-2 text-slate-400">
                        {new Date(s.created_at).toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-3 py-2">
                        <div className="font-mono text-xs">
                          {s.recipient.slice(0, 6)}…{s.recipient.slice(-4)}
                        </div>
                        {s.recipient_label && (
                          <div className="text-[11px] text-slate-400">
                            {s.recipient_label}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-cyan-300">
                        {s.amount_ui.toLocaleString(undefined, {
                          maximumFractionDigits: 4,
                        })}
                      </td>
                      <td className="px-3 py-2 text-right text-xs text-slate-400">
                        {s.period_seconds
                          ? `${Math.round((s.period_seconds || 0) / 86400)}d`
                          : "—"}
                        {s.cliff_seconds
                          ? ` · ${Math.round((s.cliff_seconds || 0) / 86400)}d cliff`
                          : ""}
                      </td>
                      <td className="px-3 py-2">
                        <StatusPill status={s.status} />
                      </td>
                      <td className="px-3 py-2 text-xs">
                        <a
                          href={`https://explorer.solana.com/tx/${s.signature}?cluster=${config?.cluster || "devnet"}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-cyan-400 hover:text-cyan-300"
                        >
                          {s.signature.slice(0, 6)}…
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* How-to */}
        <section className="mt-10 rounded-2xl border border-white/10 bg-slate-950/50 p-6">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-400">
            <Users className="h-4 w-4" /> How crew payouts work
          </h3>
          <ol className="space-y-2 text-sm text-slate-300">
            <li>
              <span className="text-cyan-300">1.</span> Fund the treasury
              wallet with SOL (for fees) + USDC (for payouts).
            </li>
            <li>
              <span className="text-cyan-300">2.</span> Paste the crew
              member's Solana wallet address + amount.
            </li>
            <li>
              <span className="text-cyan-300">3.</span> Pick vesting period
              (30d linear is the default for crew; 365d + 90d cliff for
              founders).
            </li>
            <li>
              <span className="text-cyan-300">4.</span> Click Sign — Solflare
              prompts you to approve. One signature per stream.
            </li>
            <li>
              <span className="text-cyan-300">5.</span> The recipient sees
              the stream on https://app.streamflow.finance and can
              withdraw unlocked tokens any time.
            </li>
          </ol>
          <p className="mt-3 text-[11px] text-slate-500">
            All streams are{" "}
            <strong className="text-cyan-300">cancelable by sender</strong>{" "}
            so you can reclaim unvested tokens if a crew member
            off-boards.
          </p>
        </section>
      </div>
    </div>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
  placeholder,
  testid,
  numeric,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  testid: string;
  numeric?: boolean;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-[10px] uppercase tracking-wider text-slate-400">
        {label}
      </span>
      <input
        type={numeric ? "number" : "text"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2 font-mono text-sm text-white placeholder:text-slate-600 focus:border-cyan-500/50 focus:outline-none"
        data-testid={testid}
      />
    </label>
  );
}

function StatusPill({ status }: { status: string }) {
  const m: Record<string, string> = {
    active: "bg-emerald-500/20 text-emerald-200",
    cancelled: "bg-rose-500/20 text-rose-200",
    completed: "bg-cyan-500/20 text-cyan-200",
    failed: "bg-amber-500/20 text-amber-200",
  };
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] ${m[status] || "bg-slate-500/20 text-slate-300"}`}
    >
      {status}
    </span>
  );
}
