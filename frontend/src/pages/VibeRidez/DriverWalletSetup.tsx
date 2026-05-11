/**
 * Driver Wallet Setup — register/update the Solana wallet that will
 * receive USDC payouts from VibeRidez rides.
 *
 * Flow:
 *   1. GET /api/driver/wallet → show current registration if any.
 *   2. User clicks "Connect Wallet" (Phantom modal opens).
 *   3. On successful connect, `solanaAddress` from Phantom is POSTed
 *      to /api/driver/wallet to persist it server-side. The on-chain
 *      USDC payout daemon reads `users.solana_wallet_address` as
 *      source of truth, so registering here is what unblocks
 *      pending_no_wallet rows in the queue.
 *   4. Link to /driver/earnings to view queued rides.
 */
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Wallet, CheckCircle, AlertTriangle, Copy } from "lucide-react";
import { useAccounts } from "@phantom/react-sdk";
import PhantomConnectButton from "@/components/web3/PhantomConnectButton";
import StripeConnectButton from "@/components/payout/StripeConnectButton";
import { authFetch } from "@/utils/secureAuth";

const API = process.env.REACT_APP_BACKEND_URL;

export default function DriverWalletSetup() {
  const navigate = useNavigate();
  const accounts = useAccounts();

  const [registered, setRegistered] = useState<string | null>(null);
  const [registeredAt, setRegisteredAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Phantom current connected Solana address (if any).
  const phantomAddress = Array.isArray(accounts)
    ? accounts.find(
        (a: { addressType?: string; address?: string }) =>
          a?.addressType === "solana" || a?.addressType === "Solana",
      )?.address ?? null
    : null;

  // Load currently registered wallet from backend.
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await authFetch(`${API}/api/driver/wallet`);
      if (r.ok) {
        const d = await r.json();
        setRegistered(d.solana_wallet_address || null);
        setRegisteredAt(d.registered_at || null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Auto-sync: once Phantom connects AND the connected address differs
  // from what's registered server-side, POST to register.
  useEffect(() => {
    const sync = async () => {
      if (!phantomAddress || phantomAddress === registered || syncing) return;
      setSyncing(true);
      setSyncError(null);
      try {
        const r = await authFetch(`${API}/api/driver/wallet`, {
          method: "POST",
          body: JSON.stringify({ solana_wallet_address: phantomAddress }),
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d?.detail || "Failed to register wallet");
        setRegistered(d.solana_wallet_address);
        setRegisteredAt(new Date().toISOString());
      } catch (e: any) {
        setSyncError(e?.message || "Registration failed");
      } finally {
        setSyncing(false);
      }
    };
    void sync();
  }, [phantomAddress, registered, syncing]);

  const copyAddr = () => {
    if (!registered) return;
    navigator.clipboard?.writeText(registered).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div
      className="min-h-screen bg-[#020a1a] text-slate-100"
      data-testid="driver-wallet-setup-page"
    >
      <div className="mx-auto max-w-3xl px-5 py-8">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mb-6 inline-flex items-center gap-2 text-sm text-slate-300 hover:text-white"
          data-testid="wallet-setup-back-btn"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        <header className="mb-8">
          <h1 className="text-4xl font-bold tracking-tight">
            Payout Wallet
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            Connect the Solana wallet where your ride earnings arrive.
            Payouts are automatic — every completed ride queues USDC to
            this address. No wallet, no payout.
          </p>
          {/* 2026-05-12 backlog #11: bank-deposit option via Stripe Connect.
              Drivers who don't want crypto can opt to receive USD direct
              deposit. Auto-shows "available after launch" until live keys. */}
          <div className="mt-4">
            <StripeConnectButton role="driver" />
          </div>
        </header>

        {loading ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : registered ? (
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-emerald-500/40 bg-emerald-500/5 p-6"
            data-testid="wallet-registered-card"
          >
            <div className="flex items-center gap-2 text-emerald-300">
              <CheckCircle className="h-5 w-5" />
              <span className="text-sm font-semibold uppercase tracking-wider">
                Wallet registered
              </span>
            </div>
            <button
              type="button"
              onClick={copyAddr}
              className="mt-3 flex w-full items-center justify-between gap-2 rounded-lg bg-slate-950/60 px-4 py-3 text-left font-mono text-sm text-emerald-200 hover:bg-slate-950/80"
              data-testid="wallet-address-display"
              title="Click to copy"
            >
              <span className="truncate">{registered}</span>
              <span className="text-xs text-emerald-400">
                {copied ? "Copied" : <Copy className="h-3 w-3" />}
              </span>
            </button>
            {registeredAt && (
              <p className="mt-2 text-xs text-slate-500">
                Registered {new Date(registeredAt).toLocaleString()}
              </p>
            )}
            <div className="mt-5 flex flex-wrap gap-3">
              <PhantomConnectButton label="Change wallet" />
              <Link
                to="/driver/earnings"
                className="inline-flex items-center gap-2 rounded-full border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 text-sm text-cyan-200 hover:bg-cyan-500/20"
                data-testid="wallet-earnings-link"
              >
                View earnings →
              </Link>
            </div>
          </motion.section>
        ) : (
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-amber-500/40 bg-amber-500/5 p-6"
            data-testid="wallet-needs-connect-card"
          >
            <div className="flex items-center gap-2 text-amber-300">
              <AlertTriangle className="h-5 w-5" />
              <span className="text-sm font-semibold uppercase tracking-wider">
                No wallet connected
              </span>
            </div>
            <p className="mt-3 text-sm text-slate-300">
              Until you connect a Solana wallet, your ride earnings queue
              as <span className="font-mono text-amber-300">pending_no_wallet</span>.
              Connect below to unlock automatic payouts.
            </p>
            <div className="mt-5">
              <PhantomConnectButton label="Connect Solana Wallet" />
            </div>
            {syncing && (
              <p
                className="mt-3 text-xs text-cyan-300"
                data-testid="wallet-syncing-status"
              >
                Syncing wallet with payout daemon…
              </p>
            )}
            {syncError && (
              <p
                className="mt-3 text-xs text-rose-300"
                data-testid="wallet-sync-error"
              >
                {syncError}
              </p>
            )}
          </motion.section>
        )}

        <section className="mt-8 rounded-2xl border border-white/10 bg-slate-950/50 p-6">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-400">
            <Wallet className="h-4 w-4" /> How payouts work
          </h2>
          <ul className="space-y-2 text-sm text-slate-300">
            <li>
              <span className="text-cyan-300">1.</span> Complete a ride.
              The fare-splitter records your 70% share as <em>pending</em>.
            </li>
            <li>
              <span className="text-cyan-300">2.</span> Our payout
              daemon picks up pending rows every 60 seconds.
            </li>
            <li>
              <span className="text-cyan-300">3.</span> USDC is
              transferred to your wallet on-chain (Solana devnet while
              in sandbox, mainnet after TGE).
            </li>
            <li>
              <span className="text-cyan-300">4.</span> Your earnings
              page stamps the transaction signature — your receipt.
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}
