/**
 * /founders-pass — Casino House Tiers
 *
 * One-time purchase tiers (NOT subscriptions, NOT securities). Users buy
 * a House Tier to:
 *   • Unlock a permanent stake-accrual MULTIPLIER (1.5× / 4× / 9× / 20×)
 *   • Get a starter stake grant (300 / 2,500 / 10,000 / 50,000)
 *   • Pick up cosmetic perks (badge, aura, tournament privileges)
 *
 * Buyer must STILL play to earn — multiplier amplifies activity earnings,
 * it is not yield on capital. Same legal structure as Discord Nitro,
 * Patreon Founding Patron, Costco Lifetime.
 */
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Sparkles, Check, Zap, Crown, Diamond, Lock } from "lucide-react";
import { authFetch, getUserId } from "@/utils/secureAuth";
import { toast } from "sonner";

const API = process.env.REACT_APP_BACKEND_URL;

type Tier = {
  id: string;
  name: string;
  icon: string;
  price_usd: number;
  multiplier: number;
  starter_stakes: number;
  color: string;
  tagline: string;
  perks: string[];
  next_pass_number?: number;
};

type TiersResponse = {
  currency: string;
  tiers: Tier[];
  legal_disclaimer: string;
};

type MyPass = {
  has_pass: boolean;
  tier?: string;
  tier_name?: string;
  multiplier?: number;
  starter_stakes_granted?: number;
  amount_paid_usd?: number;
  activated_at?: string;
  pass_number?: number;
  pass_number_label?: string;
};

const fmtUsd = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

export default function FoundersPass() {
  const navigate = useNavigate();
  const [data, setData] = useState<TiersResponse | null>(null);
  const [me, setMe] = useState<MyPass | null>(null);
  const [purchasingTier, setPurchasingTier] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API}/api/founders-pass/tiers`).then(r => r.ok && r.json()).then(setData);
    if (getUserId()) {
      authFetch(`${API}/api/founders-pass/me`)
        .then(r => r.ok && r.json())
        .then(setMe);
    }
  }, []);

  const handlePurchase = async (tier: Tier) => {
    if (!getUserId()) {
      toast.error("Sign in first to lock in a House Tier.");
      navigate("/login");
      return;
    }

    setPurchasingTier(tier.id);
    try {
      // Try real Stripe checkout first.
      const r = await authFetch(`${API}/api/founders-pass/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier_id: tier.id }),
      });

      if (r.ok) {
        const body = await r.json();
        if (body.checkout_url) {
          window.location.href = body.checkout_url;
          return;
        }
      }

      // Stripe not available in preview → fallback to test-activate.
      const errBody = await r.json().catch(() => ({}));
      if (r.status === 503 && errBody.detail?.includes?.("Stripe not configured")) {
        const ok = window.confirm(
          `Stripe isn't wired up in this preview environment.\n\nActivate ${tier.name} in TEST MODE for ${fmtUsd(tier.price_usd)} (no real charge)?`
        );
        if (!ok) return;
        const ref = `preview_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const tr = await authFetch(`${API}/api/founders-pass/test-activate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tier_id: tier.id, payment_ref: ref }),
        });
        if (!tr.ok) {
          const er = await tr.json().catch(() => ({}));
          toast.error(er.detail || "Could not activate House Tier.");
          return;
        }
        toast.success(`${tier.icon} ${tier.name} activated! ${tier.multiplier}× boost is live.`);
        // Refresh state
        const fresh = await authFetch(`${API}/api/founders-pass/me`);
        if (fresh.ok) setMe(await fresh.json());
        return;
      }

      toast.error(errBody.detail || "Could not start checkout.");
    } catch (e: any) {
      toast.error(e.message || "Purchase failed.");
    } finally {
      setPurchasingTier(null);
    }
  };

  if (!data) {
    return (
      <div className="min-h-screen bg-[#050507] flex items-center justify-center text-cyan-300">
        Loading House Tiers…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050507] text-cyan-100 relative overflow-hidden font-sans">
      {/* Casino floor backdrop */}
      <div
        className="absolute inset-0 opacity-25 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,170,0,0.10) 1px, transparent 1px), linear-gradient(90deg, rgba(255,170,0,0.10) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
        }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(244,63,94,0.10),transparent_60%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_100%,rgba(34,211,238,0.08),transparent_60%)] pointer-events-none" />

      <main className="relative z-10 max-w-6xl mx-auto px-6 py-12">
        {/* Hero */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
          data-testid="founders-pass-hero"
        >
          <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-400/30 rounded-full px-3 py-1 text-[10px] uppercase tracking-widest text-amber-300">
            <Crown className="w-3 h-3" /> Casino House Tiers · One-time
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black mt-4 leading-tight">
            Buy your seat at{" "}
            <span className="bg-gradient-to-r from-amber-300 via-rose-400 to-fuchsia-400 bg-clip-text text-transparent">
              the boss table.
            </span>
          </h1>
          <p className="text-base sm:text-lg text-cyan-300/80 mt-4 max-w-3xl mx-auto">
            Pay once. Earn a permanent multiplier on every Vibe Stake you stack
            — every game played, every ride completed, every deposit. Your buy-in
            shows up on the leaderboard forever and pays you out every quarter.
          </p>
        </motion.section>

        {/* Active pass banner */}
        {me?.has_pass && (
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            data-testid="founders-pass-active-banner"
            className="mt-8 rounded-2xl border border-emerald-400/40 bg-gradient-to-r from-emerald-500/15 via-cyan-500/10 to-fuchsia-500/15 backdrop-blur-xl p-5 flex items-center gap-4"
          >
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center shrink-0 text-3xl">
              {me.has_pass ? "♠️" : ""}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase tracking-widest text-emerald-300 font-bold">
                Your House Tier
              </p>
              <p className="text-xl sm:text-2xl font-black text-white">
                {me.pass_number_label || `${me.tier_name} · ${me.multiplier}× stake multiplier`}
              </p>
              <p className="text-[12px] text-emerald-200/70 mt-0.5">
                Activated {me.activated_at ? new Date(me.activated_at).toLocaleDateString() : "—"}
                {" · "}+{me.starter_stakes_granted?.toLocaleString()} starter stakes granted
                {me.multiplier ? ` · ${me.multiplier}× boost forever` : ""}
              </p>
            </div>
          </motion.section>
        )}

        {/* Tier cards */}
        <section className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-5" data-testid="founders-pass-tiers">
          {data.tiers.map((tier) => {
            const isOwned = me?.tier === tier.id;
            const cantUpgrade =
              me?.has_pass &&
              data.tiers.findIndex(t => t.id === me.tier) >= data.tiers.findIndex(t => t.id === tier.id);
            return (
              <motion.div
                key={tier.id}
                whileHover={{ scale: 1.02, y: -4 }}
                data-testid={`founders-tier-${tier.id}`}
                className={`relative rounded-2xl bg-white/[0.03] backdrop-blur-3xl border border-white/10 p-6 flex flex-col ${
                  isOwned ? "ring-2 ring-emerald-400" : ""
                }`}
              >
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${tier.color} flex items-center justify-center text-3xl shadow-lg`}>
                  {tier.icon}
                </div>
                <h3 className="mt-4 text-2xl font-black text-white">{tier.name}</h3>
                <p className="text-xs text-cyan-400/80 italic mt-1">{tier.tagline}</p>

                {tier.next_pass_number !== undefined && (
                  <p
                    className="mt-2 text-[10px] uppercase tracking-widest text-amber-300/90 font-bold"
                    data-testid={`founders-tier-next-${tier.id}`}
                  >
                    Be Founder #{String(tier.next_pass_number).padStart(3, "0")}
                  </p>
                )}

                <div className="mt-4">
                  <p className="text-4xl font-black text-white">
                    {fmtUsd(tier.price_usd)}
                  </p>
                  <p className="text-[10px] uppercase tracking-widest text-cyan-500 mt-1">
                    One-time · non-refundable
                  </p>
                </div>

                <div className="mt-4 flex items-center gap-2 bg-amber-500/10 border border-amber-400/30 rounded-xl px-3 py-2">
                  <Zap className="w-4 h-4 text-amber-300" />
                  <p className="text-sm font-bold text-amber-200">
                    {tier.multiplier}× stakes · +{tier.starter_stakes.toLocaleString()} starter
                  </p>
                </div>

                <ul className="mt-4 space-y-2 flex-1">
                  {tier.perks.map((perk) => (
                    <li
                      key={perk}
                      className="flex items-start gap-2 text-[12px] text-cyan-200/90"
                    >
                      <Check className="w-3.5 h-3.5 text-emerald-300 flex-shrink-0 mt-0.5" />
                      <span>{perk}</span>
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  data-testid={`founders-tier-buy-${tier.id}`}
                  disabled={purchasingTier === tier.id || isOwned || cantUpgrade}
                  onClick={() => handlePurchase(tier)}
                  className={`mt-5 rounded-xl px-4 py-3 text-sm font-black uppercase tracking-widest transition-all ${
                    isOwned
                      ? "bg-emerald-500/30 text-emerald-200 border border-emerald-400/40 cursor-default"
                      : cantUpgrade
                      ? "bg-white/5 text-cyan-500/40 border border-white/5 cursor-not-allowed"
                      : `bg-gradient-to-r ${tier.color} text-black hover:brightness-110 active:scale-[0.98]`
                  }`}
                >
                  {isOwned
                    ? "✓ Active"
                    : cantUpgrade
                    ? "Locked tier above this"
                    : purchasingTier === tier.id
                    ? "Loading…"
                    : `Lock in ${tier.name}`}
                </button>
              </motion.div>
            );
          })}
        </section>

        {/* How the math works */}
        <section className="mt-12">
          <h2 className="text-2xl font-black text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-300" /> How the math works
          </h2>
          <div className="mt-4 grid sm:grid-cols-3 gap-3">
            {[
              {
                title: "Step 1 — Buy in",
                body: "Pick your tier. One-time payment, never renews. Stripe checkout. Your tier unlocks instantly.",
                icon: Crown,
              },
              {
                title: "Step 2 — Play normally",
                body: "Every game / ride / deposit / call gives you Vibe Stakes. Your tier multiplies them automatically.",
                icon: Zap,
              },
              {
                title: "Step 3 — Get paid quarterly",
                body: "Jan 1 / Apr 1 / Jul 1 / Oct 1 — auto-payout in ₵ Vibez Coins, weighted by your stakes.",
                icon: Diamond,
              },
            ].map((step) => {
              const Icon = step.icon;
              return (
                <div key={step.title} className="rounded-2xl bg-white/[0.03] border border-white/10 p-5 backdrop-blur-3xl">
                  <Icon className="w-5 h-5 text-amber-300" />
                  <p className="mt-2 text-sm font-black text-white">{step.title}</p>
                  <p className="mt-1 text-[12px] text-cyan-300/80 leading-relaxed">{step.body}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Legal */}
        <section className="mt-12 rounded-2xl border border-amber-400/20 bg-amber-500/5 p-5">
          <div className="flex items-start gap-3">
            <Lock className="w-4 h-4 text-amber-300 mt-1 shrink-0" />
            <div>
              <p className="text-[10px] uppercase tracking-widest text-amber-300 font-bold">Plain-English legal</p>
              <p className="mt-2 text-[12px] text-cyan-200/90 leading-relaxed">
                {data.legal_disclaimer}
              </p>
              <p className="mt-2 text-[11px] text-cyan-500/70 leading-relaxed">
                A House Tier is a <strong>one-time loyalty membership</strong>, not an investment.
                You're paying for permanent access to perks + a permanent multiplier on the
                Vibe Stakes loyalty program. Same legal structure as Discord Nitro, Patreon
                Founding Patron, Costco Lifetime, OnlyFans Lifetime Tier.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
