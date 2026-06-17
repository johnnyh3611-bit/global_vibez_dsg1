/**
 * /tiers — Sovereign Tiers premium ladder (May 2026 founder ask).
 *
 * Renders the math-anchored 6-tier pricing curve. Tastemaker is the
 * popular_anchor → frontend amplifies it with a "MOST POPULAR" badge
 * + scale-105. Annual toggle previews the 2-months-free figure.
 *
 * Backed by /api/tiers/catalog. POST /api/tiers/subscribe returns a
 * cs_test_… Stripe checkout URL (subscription mode for monthly tiers,
 * payment mode for the Genius Chair one-time).
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Check, Crown, Sparkles, Loader2, Gem, ShieldCheck, Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import { authFetch } from "@/utils/secureAuth";

const API = process.env.REACT_APP_BACKEND_URL;

type Tier = {
  id: string;
  label: string;
  type_of_premium: string;
  tagline: string;
  price_usd: number;
  price_usd_year: number;
  interval: string | null;
  popular_anchor?: boolean;
  trial_intro_usd?: number;
  supply_cap?: number;
  perks: string[];
};

const ICONS: Record<string, any> = {
  guest: Sparkles,
  insider: ShieldCheck,
  tastemaker: Flame,
  royal: Crown,
  sovereign: Gem,
  genius_chair: Crown,
};

const GRADIENTS: Record<string, string> = {
  guest: "from-slate-600 to-slate-700",
  insider: "from-cyan-500 to-sky-700",
  tastemaker: "from-fuchsia-500 to-violet-700",
  royal: "from-amber-400 to-orange-600",
  sovereign: "from-emerald-400 to-teal-700",
  genius_chair: "from-yellow-400 via-amber-500 to-orange-700",
};

export default function SovereignTiers() {
  const navigate = useNavigate();
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [annualDiscount, setAnnualDiscount] = useState<{ pct: number; label: string }>({ pct: 16.67, label: "2 months free" });
  const [currentTierId, setCurrentTierId] = useState<string>("guest");
  const [interval, setInterval] = useState<"month" | "year">("month");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API}/api/tiers/catalog`);
        const d = await r.json();
        setTiers(d?.tiers || []);
        if (d?.annual_discount_pct) {
          setAnnualDiscount({ pct: d.annual_discount_pct, label: d.annual_discount_label || "2 months free" });
        }
        try {
          const me = await authFetch(`${API}/api/tiers/me`);
          if (me.ok) {
            const j = await me.json();
            setCurrentTierId(j?.tier_id || "guest");
          }
        } catch { /* not logged in */ }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const subscribe = async (tier: Tier) => {
    if (tier.id === "guest") return;
    setBusy(tier.id);
    try {
      const r = await authFetch(`${API}/api/tiers/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier_id: tier.id, origin_url: window.location.origin }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.detail || "Couldn't start checkout");
      if (d?.checkout_url) {
        window.location.href = d.checkout_url;
      }
    } catch (e: any) {
      alert(e?.message || "Network error");
    } finally {
      setBusy(null);
    }
  };

  const monthlyVisible = tiers.filter((t) => t.interval !== "one_time");
  const ownership = tiers.find((t) => t.id === "genius_chair");

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0f1a] via-[#0d0817] to-[#0a0f1a] text-white" data-testid="sovereign-tiers-page">
      <header className="px-6 py-4 flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="text-white/70 hover:text-white"
          data-testid="tiers-back"
        >
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>
        <h1 className="text-base md:text-xl tracking-[0.3em] uppercase text-fuchsia-200">
          Sovereign Tiers
        </h1>
        <span className="text-[10px] uppercase tracking-widest text-white/40 hidden md:inline">
          Pay-once · or pay-monthly — your call
        </span>
      </header>

      <main className="max-w-7xl mx-auto px-4 pb-16">
        {/* Hero */}
        <section className="text-center py-8 md:py-12">
          <p className="text-[11px] uppercase tracking-[0.4em] text-fuchsia-300/70 mb-3">
            One floor · five tiers · zero compromise
          </p>
          <h2 className="text-3xl md:text-5xl font-black bg-gradient-to-r from-amber-200 via-fuchsia-300 to-cyan-200 bg-clip-text text-transparent">
            Pick the seat that fits.
          </h2>
          <p className="text-sm text-white/60 mt-3 max-w-2xl mx-auto">
            Each tier doubles the previous one's perks for roughly 2× the price —
            so the value is obvious before you click. <span className="text-fuchsia-300">Tastemaker</span> is where most members land.
          </p>

          {/* Annual / monthly toggle */}
          <div className="mt-6 inline-flex items-center gap-2 bg-white/5 backdrop-blur-lg p-1.5 rounded-full border border-white/10">
            <button
              type="button"
              data-testid="tiers-interval-month"
              onClick={() => setInterval("month")}
              className={`px-5 py-1.5 rounded-full text-xs uppercase tracking-widest font-bold transition ${
                interval === "month" ? "bg-white text-black" : "text-white/70"
              }`}
            >
              Monthly
            </button>
            <button
              type="button"
              data-testid="tiers-interval-year"
              onClick={() => setInterval("year")}
              className={`px-5 py-1.5 rounded-full text-xs uppercase tracking-widest font-bold transition flex items-center gap-2 ${
                interval === "year" ? "bg-white text-black" : "text-white/70"
              }`}
            >
              Annual
              <span className="bg-emerald-400 text-emerald-950 text-[10px] px-2 py-0.5 rounded-full">
                {annualDiscount.label}
              </span>
            </button>
          </div>
        </section>

        {loading ? (
          <p className="text-center text-white/40 text-xs flex items-center gap-2 justify-center py-12">
            <Loader2 className="w-3 h-3 animate-spin" /> Loading tiers…
          </p>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4" data-testid="tiers-grid">
              {monthlyVisible.map((t) => {
                const Icon = ICONS[t.id] || Sparkles;
                const gradient = GRADIENTS[t.id] || "from-slate-600 to-slate-700";
                const isCurrent = t.id === currentTierId;
                const isPopular = t.popular_anchor;
                const isFree = t.price_usd === 0;
                const displayPrice = interval === "year" && t.price_usd_year ? t.price_usd_year : t.price_usd;
                return (
                  <div
                    key={t.id}
                    data-testid={`tier-card-${t.id}`}
                    className={`relative rounded-2xl border overflow-hidden transition-transform ${
                      isPopular
                        ? "border-fuchsia-400 md:scale-105 z-10 shadow-2xl shadow-fuchsia-500/20"
                        : "border-white/10 hover:border-white/20"
                    } bg-[#0d1118]`}
                  >
                    {isPopular && (
                      <div
                        className="absolute top-0 left-0 right-0 bg-gradient-to-r from-fuchsia-500 via-violet-500 to-fuchsia-500 text-white text-[10px] uppercase tracking-[0.3em] font-black text-center py-1"
                        data-testid={`tier-popular-${t.id}`}
                      >
                        ⭐ Most Popular
                      </div>
                    )}
                    {isCurrent && (
                      <div className="absolute top-0 right-0 bg-emerald-400 text-emerald-950 text-[10px] uppercase tracking-widest font-black px-2 py-0.5 rounded-bl-lg">
                        Current
                      </div>
                    )}

                    <div className={`bg-gradient-to-br ${gradient} ${isPopular ? "pt-7" : "pt-5"} pb-4 px-5`}>
                      <Icon className="w-7 h-7 mb-2 text-white" />
                      <h3 className="text-2xl font-black text-white">{t.label}</h3>
                      <p className="text-[10px] uppercase tracking-widest text-white/80 mt-0.5">
                        {t.type_of_premium}
                      </p>
                      <div className="flex items-baseline gap-1 mt-4">
                        <span className="text-4xl font-black text-white tabular-nums" data-testid={`tier-price-${t.id}`}>
                          ${displayPrice}
                        </span>
                        {!isFree && (
                          <span className="text-xs text-white/80">
                            /{interval === "year" ? "yr" : "mo"}
                          </span>
                        )}
                      </div>
                      {t.trial_intro_usd && interval === "month" && (
                        <p className="text-[10px] uppercase tracking-widest text-amber-200 mt-1" data-testid={`tier-trial-${t.id}`}>
                          ★ First month ${t.trial_intro_usd}
                        </p>
                      )}
                      <p className="text-xs text-white/80 italic mt-2">{t.tagline}</p>
                    </div>

                    <ul className="px-5 py-4 space-y-2">
                      {t.perks.map((p, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-white/80 leading-snug">
                          <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
                          <span>{p}</span>
                        </li>
                      ))}
                    </ul>

                    <div className="px-5 pb-5">
                      {isFree ? (
                        <div className="text-center text-[10px] uppercase tracking-widest text-white/50 py-3">
                          Default tier · no checkout
                        </div>
                      ) : (
                        <Button
                          onClick={() => subscribe(t)}
                          disabled={busy === t.id || isCurrent}
                          data-testid={`tier-subscribe-${t.id}`}
                          className={`w-full bg-gradient-to-r ${gradient} hover:opacity-90 text-white font-black uppercase tracking-widest text-xs py-5`}
                        >
                          {busy === t.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : isCurrent ? (
                            "Your tier"
                          ) : (
                            `Choose ${t.label}`
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Genius Chair — Ownership row */}
            {ownership && (
              <section
                className="mt-10 rounded-3xl border border-amber-400/40 bg-gradient-to-br from-amber-950/40 via-yellow-900/30 to-orange-950/40 overflow-hidden"
                data-testid="tier-ownership-row"
              >
                <div className="md:flex">
                  <div className="md:w-5/12 p-7 md:p-10 bg-gradient-to-br from-yellow-400/10 to-amber-600/10">
                    <p className="text-[10px] uppercase tracking-[0.4em] text-amber-200">
                      Ownership Premium
                    </p>
                    <h3 className="text-3xl md:text-4xl font-black text-amber-100 mt-2">
                      Genius Chair
                    </h3>
                    <p className="text-xs text-amber-100/70 italic mt-2">{ownership.tagline}</p>
                    <div className="mt-4 flex items-baseline gap-2">
                      <span className="text-5xl font-black text-yellow-300 tabular-nums" data-testid="tier-price-genius_chair">
                        ${ownership.price_usd}
                      </span>
                      <span className="text-xs uppercase tracking-widest text-amber-200">one-time · lifetime</span>
                    </div>
                    <p className="text-[10px] text-amber-200/60 mt-2">
                      Supply cap {ownership.supply_cap?.toLocaleString()} · tradeable on secondary market once sold out
                    </p>
                    <Button
                      onClick={() => subscribe(ownership)}
                      disabled={busy === "genius_chair" || currentTierId === "genius_chair"}
                      data-testid="tier-subscribe-genius_chair"
                      className="mt-5 bg-gradient-to-r from-yellow-400 via-amber-500 to-orange-600 hover:opacity-90 text-black font-black uppercase tracking-widest text-xs px-8 py-6"
                    >
                      {busy === "genius_chair" ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : currentTierId === "genius_chair" ? (
                        "You hold a chair"
                      ) : (
                        "Claim a Chair"
                      )}
                    </Button>
                  </div>
                  <div className="md:w-7/12 p-7 md:p-10">
                    <p className="text-xs uppercase tracking-widest text-amber-200 mb-4">
                      Why a Chair beats a subscription
                    </p>
                    <ul className="space-y-2.5">
                      {ownership.perks.map((p, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-amber-50/90 leading-snug">
                          <Crown className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                          <span>{p}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </section>
            )}

            {/* Value math */}
            <section className="mt-12 grid md:grid-cols-3 gap-4">
              <div className="rounded-xl bg-white/5 border border-white/10 p-5" data-testid="tiers-math-1">
                <p className="text-[10px] uppercase tracking-widest text-fuchsia-300 mb-2">Curve math</p>
                <p className="text-2xl font-black text-white">~2× price · ~2× perks</p>
                <p className="text-xs text-white/60 mt-2">
                  Each step doubles for a clean apples-to-apples decision. No "what am I getting?" friction.
                </p>
              </div>
              <div className="rounded-xl bg-white/5 border border-white/10 p-5" data-testid="tiers-math-2">
                <p className="text-[10px] uppercase tracking-widest text-emerald-300 mb-2">Annual save</p>
                <p className="text-2xl font-black text-white">{annualDiscount.label}</p>
                <p className="text-xs text-white/60 mt-2">
                  Pay yearly and you get two months on the house. Cancel anytime · prorated refunds.
                </p>
              </div>
              <div className="rounded-xl bg-white/5 border border-white/10 p-5" data-testid="tiers-math-3">
                <p className="text-[10px] uppercase tracking-widest text-amber-300 mb-2">Lifetime path</p>
                <p className="text-2xl font-black text-white">$20 · once · forever</p>
                <p className="text-xs text-white/60 mt-2">
                  Genius Chair breaks even vs Sovereign in ~9 weeks. Everything after is profit.
                </p>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
