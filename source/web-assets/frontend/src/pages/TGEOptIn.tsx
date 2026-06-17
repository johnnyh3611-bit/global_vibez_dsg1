/**
 * TGE Opt-In — user registers their Solana wallet for the future
 * $DSG Token Generation Event.
 */
import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Wallet, CheckCircle2, Clock, ArrowLeft, Coins } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

interface TGEStatus {
  user: {
    user_id: string;
    solana_wallet_address?: string;
    tge_opt_in?: boolean;
  };
  total_vibez: number;
  config: {
    mode: string;
    min_eligible_vibez: number;
  };
}

const TGEOptIn: React.FC = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState<TGEStatus | null>(null);
  const [wallet, setWallet] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/tge/me/status`, {});
      if (!res.ok) throw new Error("Not authenticated");
      const data: TGEStatus = await res.json();
      setStatus(data);
      if (data.user.solana_wallet_address) setWallet(data.user.solana_wallet_address);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const submit = async (optIn: boolean) => {
    setSubmitting(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch(`${API}/api/tge/me/opt-in`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: wallet.trim(), opt_in: optIn }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Update failed");
      setSuccess(true);
      await loadStatus();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const isOptedIn = Boolean(status?.user.tge_opt_in);
  const hasWallet = Boolean(status?.user.solana_wallet_address);

  return (
    <div className="min-h-screen bg-black text-white" data-testid="tge-opt-in-page">
      <div className="max-w-2xl mx-auto px-6 py-16">
        <button
          onClick={() => navigate(-1)}
          className="text-sm text-neutral-400 hover:text-white mb-6 flex items-center gap-1"
          data-testid="tge-opt-in-back-btn"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <div className="flex items-center gap-2 text-purple-400 font-mono text-xs uppercase tracking-widest mb-4">
          <Coins className="w-4 h-4" /> $DSG · Token Generation Event
        </div>

        <h1 className="text-4xl md:text-5xl font-black italic uppercase tracking-tighter leading-none">
          Claim your
          <br />
          <span className="text-transparent bg-gradient-to-r from-fuchsia-500 to-purple-500 bg-clip-text">
            future tokens.
          </span>
        </h1>
        <p className="mt-4 text-neutral-400">
          Register your Solana wallet now so your mined $DSG is ready to claim on day one of the Token Generation Event.
          No tokens are minted until the official launch.
        </p>

        {/* Status card */}
        <div className="mt-8 p-5 rounded-2xl bg-neutral-900/60 border border-white/5 backdrop-blur-sm">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs font-mono text-purple-400 uppercase tracking-widest">
                Your $DSG
              </div>
              <div className="text-3xl font-black text-fuchsia-300 mt-1 tabular-nums">
                {status?.total_vibez.toFixed(2) ?? "—"}
              </div>
            </div>
            <div>
              <div className="text-xs font-mono text-purple-400 uppercase tracking-widest">Status</div>
              <div className="mt-1 flex items-center gap-2">
                {isOptedIn ? (
                  <span className="flex items-center gap-1 text-emerald-400 font-bold text-sm" data-testid="tge-status-opted-in">
                    <CheckCircle2 className="w-4 h-4" /> Opted In
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-amber-400 font-bold text-sm" data-testid="tge-status-not-opted-in">
                    <Clock className="w-4 h-4" /> Not opted in yet
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Wallet form */}
        <div className="mt-6 p-5 rounded-2xl bg-neutral-900/60 border border-white/5">
          <label className="text-xs font-mono text-purple-400 uppercase tracking-widest flex items-center gap-2 mb-3">
            <Wallet className="w-4 h-4" /> Solana wallet address
          </label>
          <input
            type="text"
            value={wallet}
            onChange={(e) => setWallet(e.target.value)}
            placeholder="e.g. 5d3F7fZs...base58 pubkey"
            data-testid="tge-wallet-input"
            className="w-full px-4 py-3 rounded-lg bg-black/40 border border-white/10 text-white font-mono text-sm focus:border-purple-500 outline-none"
          />
          <p className="text-[11px] text-neutral-500 mt-2">
            Base58 pubkey, 32-44 characters. Double-check this — we can't recover tokens sent to the wrong address.
          </p>

          {error && (
            <div
              className="mt-3 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm"
              data-testid="tge-opt-in-error"
            >
              {error}
            </div>
          )}
          {success && (
            <div
              className="mt-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm"
              data-testid="tge-opt-in-success"
            >
              Wallet saved. You're all set for the TGE.
            </div>
          )}

          <div className="mt-5 flex gap-3">
            <button
              onClick={() => submit(true)}
              disabled={submitting || !wallet.trim()}
              data-testid="tge-opt-in-btn"
              className="flex-1 px-5 py-3 rounded-lg bg-gradient-to-r from-fuchsia-500 to-purple-500 text-sm font-bold uppercase tracking-wide hover:scale-105 transition-transform disabled:opacity-40"
            >
              {submitting ? "Saving..." : isOptedIn ? "Update Wallet" : "Opt In"}
            </button>
            {isOptedIn && (
              <button
                onClick={() => submit(false)}
                disabled={submitting}
                data-testid="tge-opt-out-btn"
                className="px-5 py-3 rounded-lg bg-neutral-800 border border-neutral-700 text-sm font-semibold hover:bg-neutral-700 disabled:opacity-40"
              >
                Opt Out
              </button>
            )}
          </div>
        </div>

        {/* Fine print */}
        <div className="mt-6 text-xs text-neutral-500 leading-relaxed">
          Current mode: <code className="text-purple-400">{status?.config.mode || "mock"}</code> — no on-chain transactions yet. Your $DSG
          continues to accrue via gameplay and will be minted to this wallet at TGE.
          Eligibility threshold: {status?.config.min_eligible_vibez ?? 10} $DSG.
        </div>
      </div>
    </div>
  );
};

export default TGEOptIn;
