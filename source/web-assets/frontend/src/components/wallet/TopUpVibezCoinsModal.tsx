/**
 * TopUpVibezCoinsModal — Stripe checkout for buying ₵ packs.
 *
 * Triggered automatically when a user hits an "insufficient balance"
 * error during a JFTN buy-in or any other coin-debited flow. Also
 * usable as a standalone wallet top-up modal.
 *
 * Backend: GET /api/coins/packs · POST /api/coins/topup/checkout
 */
import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Coins, Sparkles, Star, Zap, Loader2 } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

interface Pack {
  id: string;
  label: string;
  coins: number;
  usd: number;
  bonus_pct: number;
  popular: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** Optional starter pack to highlight (e.g., the smallest pack that
   *  would clear the user's current shortfall). */
  recommendedPackId?: string;
  /** Optional explanatory message ("You need ₵100, you have ₵50"). */
  contextMessage?: string;
}

const PACK_ICONS: Record<string, any> = {
  starter: Coins,
  popular: Star,
  pro: Sparkles,
  vip: Zap,
};

export default function TopUpVibezCoinsModal({
  open,
  onClose,
  recommendedPackId,
  contextMessage,
}: Props) {
  const [packs, setPacks] = useState<Pack[]>([]);
  const [selected, setSelected] = useState<string>("popular");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    fetch(`${API}/coins/packs`)
      .then((r) => r.json())
      .then((d) => {
        setPacks(d.packs || []);
        if (recommendedPackId) setSelected(recommendedPackId);
      })
      .catch(() => setError("Couldn't load coin packs"));
  }, [open, recommendedPackId]);

  const handleCheckout = async () => {
    setError("");
    setSubmitting(true);
    try {
      const token = localStorage.getItem("auth_token");
      if (!token) {
        window.location.href = "/login";
        return;
      }
      const res = await fetch(`${API}/coins/topup/checkout`, {
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
        setError(data.detail || "Couldn't start checkout");
        return;
      }
      // Redirect to Stripe-hosted checkout. The success URL routes
      // back to /wallet/topup-success which polls + credits the user.
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
            className="relative w-full max-w-lg rounded-2xl bg-slate-950/95 border border-yellow-500/30 shadow-[0_0_60px_rgba(234,179,8,0.25)] p-6 text-white"
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
              <Coins className="w-6 h-6 text-yellow-300" />
              <h2 className="text-2xl font-bold text-yellow-300">
                Top Up Vibez Coins
              </h2>
            </div>
            <p className="text-sm text-white/60 mb-5">
              {contextMessage ||
                "Buy ₵ to play games, unlock JFTN rooms, and tip creators."}
            </p>

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
                        ? "border-yellow-400 bg-yellow-500/10 shadow-[0_0_24px_rgba(234,179,8,0.35)]"
                        : "border-slate-700/60 bg-slate-900/40 hover:border-yellow-500/40"
                    }`}
                  >
                    {p.popular && (
                      <span
                        className="absolute -top-2 right-3 px-2 py-0.5 rounded-full bg-yellow-400 text-slate-950 text-[10px] font-black uppercase tracking-wider"
                        data-testid="topup-popular-badge"
                      >
                        Popular
                      </span>
                    )}
                    <Icon className={`w-5 h-5 mb-2 ${active ? "text-yellow-300" : "text-slate-400"}`} />
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

            <button
              onClick={handleCheckout}
              disabled={submitting || !selected}
              className="w-full bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-300 hover:to-orange-400 disabled:opacity-60 px-4 py-3 rounded-xl font-bold text-slate-950 flex items-center justify-center gap-2 shadow-[0_0_24px_rgba(234,179,8,0.35)] transition-all"
              data-testid="topup-checkout-btn"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Redirecting…
                </>
              ) : (
                <>
                  <Coins className="w-4 h-4" /> Pay with card
                </>
              )}
            </button>

            <p className="text-[10px] text-white/40 mt-3 text-center">
              Secure checkout by Stripe · Coins credit instantly after payment.
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
