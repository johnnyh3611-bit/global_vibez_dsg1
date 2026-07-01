/**
 * PurchaseJFTNPassModal — Vibez Coins (₵) is the PRIMARY payment method.
 * Solana is an alternative payment path for crypto users. Mock-pay path is
 * only used during demos / dev (Devnet only).
 *
 * Backend: POST /api/jftn/passes/purchase
 *   coins: { payment_method: 'coins', entry_coins: 1000, … }
 *   solana: { payment_method: 'solana', entry_fee_sol: 0.5, signature: '...' }
 */
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Sparkles, ShieldCheck, Loader2, Coins } from "lucide-react";
import { authFetch } from "@/utils/secureAuth";
import { CURRENCY_SYMBOL, formatCoins } from "@/utils/currency";
import TopUpVibezCoinsModal from "@/components/wallet/TopUpVibezCoinsModal";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

type Props = {
  open: boolean;
  onClose: () => void;
  onPurchased: (pass: any) => void;
  creatorId: string;
  creatorWallet: string;
  roomId?: string;
  /** Primary price in Vibez Coins. */
  feeCoins?: number;
  /** Optional alt-price in SOL for users paying with crypto. */
  feeSol?: number;
};

export default function PurchaseJFTNPassModal({
  open,
  onClose,
  onPurchased,
  creatorId,
  creatorWallet,
  roomId,
  feeCoins = 1000,
  feeSol = 0.5,
}: Props) {
  // Default to coins per product directive.
  const [mode, setMode] = useState<"coins" | "solana_real" | "solana_mock">("coins");
  const [signatureInput, setSignatureInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  // When the backend returns 402 / insufficient balance, we offer a
  // one-tap top-up to convert the discovery moment into revenue
  // instead of bouncing the user out.
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [shortfallContext, setShortfallContext] = useState("");

  const pickRecommendedPack = (need: number, have: number): string => {
    const gap = Math.max(0, need - have);
    if (gap <= 500) return "starter";
    if (gap <= 1000) return "popular";
    if (gap <= 2500) return "pro";
    return "vip";
  };

  const handleSubmit = async () => {
    if (submitting) return;
    setError("");
    setSubmitting(true);

    try {
      let body: any;
      if (mode === "coins") {
        body = {
          creator_id: creatorId,
          creator_wallet: creatorWallet,
          room_id: roomId,
          payment_method: "coins",
          entry_coins: feeCoins,
        };
      } else {
        const sig =
          mode === "solana_mock"
            ? `MOCK_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
            : signatureInput.trim();
        if (mode === "solana_real" && !sig) {
          setError("Paste your wallet's transaction signature first.");
          setSubmitting(false);
          return;
        }
        body = {
          creator_id: creatorId,
          creator_wallet: creatorWallet,
          room_id: roomId,
          payment_method: "solana",
          entry_fee_sol: feeSol,
          signature: sig,
        };
      }

      const res = await authFetch(`${API}/jftn/passes/purchase`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        // Insufficient balance → drop the dead-end error and pop the
        // top-up modal pre-targeted at a pack that clears the shortfall.
        if (
          res.status === 402 ||
          /insufficient/i.test(data.detail || "")
        ) {
          // Detail looks like "Insufficient Vibez Coins (need ₵100, have ₵50)"
          const m = /need\s*₵?(\d+).*have\s*₵?(\d+)/i.exec(data.detail || "");
          const need = m ? parseInt(m[1], 10) : feeCoins;
          const have = m ? parseInt(m[2], 10) : 0;
          setShortfallContext(
            `You need ₵${need.toLocaleString()} to unlock this room — your wallet has ₵${have.toLocaleString()}.`,
          );
          setTopUpOpen(true);
          return;
        }
        setError(data.detail || "Purchase failed");
        return;
      }
      onPurchased(data.pass);
      onClose();
    } catch (e: any) {
      setError(e?.message || "Network error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[80] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
          data-testid="jftn-purchase-modal"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.92, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md rounded-2xl bg-slate-950/95 border border-cyan-500/30 shadow-[0_0_50px_rgba(34,211,238,0.25)] p-6 text-white"
          >
            <button
              onClick={onClose}
              className="absolute top-3 right-3 p-1 rounded-full text-white/60 hover:bg-white/10"
              aria-label="Close"
              data-testid="jftn-purchase-close"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-5 h-5 text-cyan-300" />
              <h2 className="text-2xl font-['Cinzel'] font-bold text-cyan-300">
                Unlock Just for the Night
              </h2>
            </div>
            <p className="text-sm text-white/60 mb-5">
              {formatCoins(feeCoins)} · 24-hour access · pass auto-expires.
            </p>

            {/* Mode toggle — PRIMARY = coins. */}
            <div
              className="grid grid-cols-3 gap-2 mb-4 p-1 rounded-xl bg-white/5 border border-white/10"
              role="tablist"
            >
              <button
                onClick={() => setMode("coins")}
                className={`py-2 rounded-lg text-[11px] font-bold uppercase tracking-widest transition-colors ${
                  mode === "coins"
                    ? "bg-cyan-500/20 text-cyan-200 border border-cyan-400/40"
                    : "text-white/60 hover:text-white/80"
                }`}
                data-testid="jftn-mode-coins"
              >
                {CURRENCY_SYMBOL} Vibez
              </button>
              <button
                onClick={() => setMode("solana_real")}
                className={`py-2 rounded-lg text-[11px] font-bold uppercase tracking-widest transition-colors ${
                  mode === "solana_real"
                    ? "bg-purple-500/20 text-purple-200 border border-purple-400/40"
                    : "text-white/60 hover:text-white/80"
                }`}
                data-testid="jftn-mode-solana-real"
              >
                Wallet SOL
              </button>
              <button
                onClick={() => setMode("solana_mock")}
                className={`py-2 rounded-lg text-[11px] font-bold uppercase tracking-widest transition-colors ${
                  mode === "solana_mock"
                    ? "bg-amber-500/20 text-amber-200 border border-amber-400/40"
                    : "text-white/60 hover:text-white/80"
                }`}
                data-testid="jftn-mode-mock"
              >
                Demo
              </button>
            </div>

            {mode === "coins" && (
              <div className="rounded-lg bg-cyan-500/5 border border-cyan-500/20 p-3 mb-4 text-xs text-cyan-200/90">
                <Coins className="w-4 h-4 inline -mt-0.5 mr-1" />
                Pay {formatCoins(feeCoins)} from your in-app balance. Vibez
                Coins are the primary currency — convert to SOL anytime in your
                wallet.
              </div>
            )}

            {mode === "solana_mock" && (
              <div className="rounded-lg bg-amber-500/5 border border-amber-500/20 p-3 mb-4 text-xs text-amber-200/90">
                <ShieldCheck className="w-4 h-4 inline -mt-0.5 mr-1" />
                Devnet demo — no real value spent. The backend will create a
                24h pass against a mock signature so you can test the flow
                end-to-end.
              </div>
            )}

            {mode === "solana_real" && (
              <div className="mb-4">
                <label className="text-[11px] uppercase tracking-widest text-white/50 mb-1 block">
                  Paste Solana transaction signature
                </label>
                <input
                  type="text"
                  value={signatureInput}
                  onChange={(e) => setSignatureInput(e.target.value)}
                  placeholder="5Jp...solana_tx_signature"
                  className="w-full bg-slate-900 border border-white/15 rounded-lg px-3 py-2 text-sm font-mono focus:border-purple-400 focus:outline-none"
                  data-testid="jftn-signature-input"
                />
                <p className="text-[10px] text-white/40 mt-1">
                  Send {feeSol} SOL to{" "}
                  <span className="font-mono text-purple-300">
                    {creatorWallet.slice(0, 8)}…{creatorWallet.slice(-6)}
                  </span>
                  , then paste the tx signature here.
                </p>
              </div>
            )}

            {error && (
              <div
                className="rounded-lg bg-red-900/30 border border-red-500/40 p-2 mb-4 text-xs text-red-200"
                data-testid="jftn-purchase-error"
              >
                {error}
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-60 px-4 py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/30 transition-all"
              data-testid="jftn-purchase-submit"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Verifying…
                </>
              ) : mode === "coins" ? (
                <>
                  <Coins className="w-4 h-4" />
                  Pay {formatCoins(feeCoins)} & Unlock
                </>
              ) : mode === "solana_mock" ? (
                <>
                  <Sparkles className="w-4 h-4" />
                  Activate Pass (Demo)
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Verify Solana Tx
                </>
              )}
            </button>

            <p className="text-[10px] text-white/40 mt-3 text-center">
              All passes route through 72-hour escrow. Powered by Vibez Coins.
            </p>
          </motion.div>
        </motion.div>
      )}
      {/* Top-up modal — shown when the user's wallet is short. */}
      <TopUpVibezCoinsModal
        open={topUpOpen}
        onClose={() => setTopUpOpen(false)}
        recommendedPackId={pickRecommendedPack(feeCoins, 0)}
        contextMessage={shortfallContext}
      />
    </AnimatePresence>
  );
}
