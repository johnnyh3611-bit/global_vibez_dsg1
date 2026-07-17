/**
 * TopUpVibezCoinsModal — buy ₵ packs.
 *
 * Preferred order:
 *   1. Solana deposit (QR + memo)
 *   2. Helio card (MoonPay Commerce) — Stripe alternative
 *   3. Legacy Stripe card (if Helio not configured)
 *
 * Backend:
 *   GET  /api/coins/packs
 *   GET  /api/coins/topup/providers
 *   POST /api/coins/topup/helio
 *   POST /api/coins/topup/checkout
 *   POST /api/crypto-payments/create-deposit
 */
import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Coins, Sparkles, Star, Zap, Loader2, Wallet, CreditCard } from "lucide-react";
import SolanaDepositPanel from "@/components/wallet/SolanaDepositPanel";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

interface Pack {
  id: string;
  label: string;
  coins: number;
  usd: number;
  bonus_pct: number;
  popular: boolean;
}

interface Provider {
  id: string;
  label: string;
  ready: boolean;
  primary?: boolean;
  kind?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  recommendedPackId?: string;
  contextMessage?: string;
}

const PACK_ICONS: Record<string, any> = {
  starter: Coins,
  popular: Star,
  pro: Sparkles,
  vip: Zap,
};

type PayMethod = "solana" | "card";

export default function TopUpVibezCoinsModal({
  open,
  onClose,
  recommendedPackId,
  contextMessage,
}: Props) {
  const [packs, setPacks] = useState<Pack[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [selected, setSelected] = useState<string>("popular");
  const [method, setMethod] = useState<PayMethod>("solana");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setMethod("solana");
    setError("");
    Promise.all([
      fetch(`${API}/coins/packs`).then((r) => r.json()),
      fetch(`${API}/coins/topup/providers`).then((r) => (r.ok ? r.json() : { providers: [] })),
    ])
      .then(([packData, providerData]) => {
        setPacks(packData.packs || []);
        setProviders(providerData.providers || []);
        if (recommendedPackId) setSelected(recommendedPackId);
      })
      .catch(() => setError("Couldn't load coin packs"));
  }, [open, recommendedPackId]);

  const selectedPack = useMemo(
    () => packs.find((p) => p.id === selected) || packs[0],
    [packs, selected],
  );

  const helioReady = providers.some((p) => p.id === "helio" && p.ready);
  const stripeReady = providers.some((p) => p.id === "stripe" && p.ready);
  const cardLabel = helioReady ? "Card (Helio)" : "Card";

  const handleCardCheckout = async () => {
    setError("");
    setSubmitting(true);
    try {
      const token = localStorage.getItem("auth_token");
      if (!token) {
        window.location.href = "/login";
        return;
      }
      // Prefer Helio when configured; fall back to legacy Stripe.
      const endpoint = helioReady ? `${API}/coins/topup/helio` : `${API}/coins/topup/checkout`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          pack_id: selected,
          origin_url: window.location.origin,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const detail =
          typeof data.detail === "string"
            ? data.detail
            : data.detail?.msg || "Couldn't start checkout";
        setError(detail);
        return;
      }
      if (!data.checkout_url) {
        setError("Checkout URL missing from server");
        return;
      }
      window.location.href = data.checkout_url;
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
          className="fixed inset-0 z-[90] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          data-testid="topup-modal"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.92, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-slate-950/95 border border-cyan-500/30 shadow-[0_0_60px_rgba(34,211,238,0.2)] p-6 text-white"
          >
            <button
              onClick={onClose}
              className="absolute top-3 right-3 p-1 rounded-full text-white/60 hover:bg-white/10"
              aria-label="Close"
              data-testid="topup-close"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-1">
              <Coins className="w-6 h-6 text-cyan-300" />
              <h2 className="text-2xl font-bold text-cyan-300">
                Top Up Vibez Coins
              </h2>
            </div>
            <p className="text-sm text-white/60 mb-4">
              {contextMessage ||
                "Buy ₵ with Solana — or card via Helio when you need fiat."}
            </p>

            <div
              className="grid grid-cols-2 gap-2 mb-4 p-1 rounded-xl bg-black/40 border border-white/10"
              role="tablist"
              aria-label="Payment method"
            >
              <button
                type="button"
                role="tab"
                aria-selected={method === "solana"}
                data-testid="topup-method-solana"
                onClick={() => setMethod("solana")}
                className={`flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-bold transition ${
                  method === "solana"
                    ? "bg-gradient-to-r from-cyan-600 to-emerald-600 text-white shadow-lg"
                    : "text-white/50 hover:text-white/80"
                }`}
              >
                <Wallet className="w-4 h-4" />
                Solana
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={method === "card"}
                data-testid="topup-method-card"
                onClick={() => setMethod("card")}
                className={`flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-bold transition ${
                  method === "card"
                    ? "bg-white/10 text-white border border-white/20"
                    : "text-white/40 hover:text-white/70"
                }`}
              >
                <CreditCard className="w-4 h-4" />
                {cardLabel}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-5">
              {packs.map((p) => {
                const Icon = PACK_ICONS[p.id] || Coins;
                const active = selected === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => setSelected(p.id)}
                    data-testid={`topup-pack-${p.id}`}
                    className={`relative p-4 rounded-xl border-2 text-left transition-all ${
                      active
                        ? "border-cyan-400 bg-cyan-500/10 shadow-[0_0_24px_rgba(34,211,238,0.35)]"
                        : "border-slate-700/60 bg-slate-900/40 hover:border-cyan-500/40"
                    }`}
                  >
                    {p.popular && (
                      <span
                        className="absolute -top-2 right-3 px-2 py-0.5 rounded-full bg-cyan-400 text-slate-950 text-[10px] font-black uppercase tracking-wider"
                        data-testid="topup-popular-badge"
                      >
                        Popular
                      </span>
                    )}
                    <Icon className={`w-5 h-5 mb-2 ${active ? "text-cyan-300" : "text-slate-400"}`} />
                    <div className="text-2xl font-bold text-white">
                      ₵{p.coins.toLocaleString()}
                    </div>
                    <div className="text-sm text-slate-300">${p.usd.toFixed(2)} USD</div>
                    {p.bonus_pct > 0 && (
                      <div className="mt-1 text-[11px] font-semibold text-emerald-300">
                        save {p.bonus_pct}%
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {error && (
              <div
                className="rounded-lg bg-red-900/30 border border-red-500/40 p-2 mb-3 text-xs text-red-200"
                data-testid="topup-error"
              >
                {error}
              </div>
            )}

            {method === "solana" ? (
              <div data-testid="topup-solana-panel">
                <p className="text-xs text-white/50 mb-3">
                  Send SOL (or USDC on Solana) for about $
                  {(selectedPack?.usd ?? 25).toFixed(2)}. Include the memo so we
                  can credit ₵{selectedPack?.coins?.toLocaleString() ?? "—"} to
                  your account.
                </p>
                <SolanaDepositPanel amountUsd={selectedPack?.usd ?? 25} />
                <p className="text-[10px] text-white/40 mt-3 text-center">
                  No card processor · Solana deposit · Credits after confirm.
                </p>
              </div>
            ) : (
              <>
                {!helioReady && !stripeReady && (
                  <p className="text-xs text-amber-200/80 mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2">
                    Card checkout is not configured yet. Use Solana, or ask an
                    admin to set HELIO_API_KEY / HELIO_SECRET_KEY / HELIO_PAYLINK_ID
                    on Railway.
                  </p>
                )}
                <button
                  onClick={handleCardCheckout}
                  disabled={submitting || !selected || (!helioReady && !stripeReady)}
                  className="w-full bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 disabled:opacity-60 px-4 py-3 rounded-xl font-bold text-slate-950 flex items-center justify-center gap-2 transition-all"
                  data-testid="topup-checkout-btn"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Redirecting…
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-4 h-4" />
                      {helioReady ? "Pay with card (Helio)" : "Pay with card"}
                    </>
                  )}
                </button>
                <p className="text-[10px] text-white/40 mt-3 text-center">
                  {helioReady
                    ? "Helio / MoonPay Commerce · card → crypto · credits after webhook."
                    : "Legacy Stripe path · prefer Solana or Helio when available."}
                </p>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
