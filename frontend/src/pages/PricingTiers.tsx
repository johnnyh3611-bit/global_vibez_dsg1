/**
 * /pricing — Sovereign Tiers ladder (5-tier premium · May 2026).
 *
 * Founder ask: free Guest + 4 paid premium types ($10 / $20 / $29 / $65)
 * + Genius Chair $20 one-time lifetime asset. Each paid tier is a
 * DIFFERENT KIND of premium (Access · Influence · Elevated · Sovereign ·
 * Ownership) so subscribers see exactly what they're moving toward.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Check, Crown, Loader2, Sparkles } from "lucide-react";
import { authFetch } from "@/utils/secureAuth";

const API = process.env.REACT_APP_BACKEND_URL;

type Tier = {
  id: string;
  label: string;
  type_of_premium: string;
  price_usd: number;
  interval: "month" | "one_time" | null;
  tagline: string;
  perks: string[];
  supply_cap?: number;
};

const TIER_VISUAL: Record<string, { ring: string; accent: string; bg: string }> = {
  guest: { ring: "border-white/15", accent: "text-white/60", bg: "from-slate-900/50 to-black/60" },
  insider: { ring: "border-sky-400/40", accent: "text-sky-300", bg: "from-sky-500/15 to-slate-900/70" },
  tastemaker: { ring: "border-fuchsia-400/40", accent: "text-fuchsia-300", bg: "from-fuchsia-500/15 to-slate-900/70" },
  royal: { ring: "border-amber-400/50", accent: "text-amber-300", bg: "from-amber-500/15 to-rose-700/15" },
  sovereign: { ring: "border-amber-300", accent: "text-amber-200", bg: "from-amber-400/25 via-fuchsia-500/15 to-cyan-400/15" },
  genius_chair: { ring: "border-amber-200", accent: "text-amber-100", bg: "from-amber-300/30 via-amber-500/20 to-yellow-700/20" },
};

export default function PricingTiers() {
  const navigate = useNavigate();
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [myTier, setMyTier] = useState<string>("guest");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const c = await fetch(`${API}/api/tiers/catalog`).then((r) => r.json());
        setTiers((c?.tiers as Tier[]) || []);
        try {
          const me = await authFetch(`${API}/api/tiers/me`).then((r) => r.json());
          setMyTier(me?.tier_id || "guest");
        } catch { /* not signed in */ }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const subscribe = async (tier: Tier) => {
    setBusy(tier.id);
    setError(null);
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
      setError(e?.message || "Network error");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0810] text-white">
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/10 backdrop-blur-md">
        <button onClick={() => navigate(-1)} className="text-sm flex items-center gap-2 text-white/70 hover:text-white" data-testid="pricing-back">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <h1 className="text-base md:text-xl tracking-[0.3em] uppercase text-amber-200 flex items-center gap-2">
          <Crown className="w-5 h-5" /> Sovereign Tiers
        </h1>
        <div className="text-[10px] uppercase tracking-widest text-white/40 hidden md:block">5 levels of premium</div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h2 className="text-3xl md:text-5xl font-black tracking-tight">
            Different <span className="text-amber-300">kinds</span> of premium.
          </h2>
          <p className="text-white/60 mt-3 max-w-2xl mx-auto text-sm md:text-base">
            The moment you pay, you're premium — the question is which kind. Access. Influence. Elevated. Sovereign. Or ownership for life.
          </p>
        </div>

        {error && <p className="text-rose-300 text-xs mb-3 text-center" data-testid="pricing-error">{error}</p>}

        {loading ? (
          <p className="text-white/40 text-xs flex items-center gap-2 justify-center mt-12">
            <Loader2 className="w-3 h-3 animate-spin" /> Loading tiers…
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4" data-testid="pricing-grid">
            {tiers.map((t) => {
              const viz = TIER_VISUAL[t.id] || TIER_VISUAL.guest;
              const isCurrent = myTier === t.id;
              return (
                <div
                  key={t.id}
                  data-testid={`pricing-tier-${t.id}`}
                  className={`rounded-2xl p-5 flex flex-col bg-gradient-to-br ${viz.bg} border-2 ${viz.ring} ${isCurrent ? "ring-2 ring-amber-300" : ""}`}
                >
                  <p className={`text-[10px] uppercase tracking-widest ${viz.accent}`}>{t.type_of_premium}</p>
                  <h3 className="text-2xl font-black text-white mt-1 flex items-center gap-2">
                    {t.id === "genius_chair" && <Sparkles className="w-5 h-5 text-amber-300" />}
                    {t.label}
                  </h3>
                  <p className="text-white/50 text-xs mt-1 italic">{t.tagline}</p>

                  <div className="mt-4">
                    {t.price_usd === 0 ? (
                      <p className="text-3xl font-black text-white">Free</p>
                    ) : (
                      <p className="text-3xl font-black text-white">
                        ${t.price_usd}<span className="text-sm text-white/40 font-normal">{t.interval === "month" ? "/mo" : " once"}</span>
                      </p>
                    )}
                    {t.supply_cap && (
                      <p className="text-[10px] uppercase tracking-widest text-amber-300/70 mt-1">
                        Capped · {t.supply_cap.toLocaleString()} seats
                      </p>
                    )}
                  </div>

                  <ul className="mt-4 space-y-1.5 flex-1">
                    {t.perks.map((perk, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-[11px] text-white/80">
                        <Check className={`w-3 h-3 mt-0.5 flex-shrink-0 ${viz.accent}`} />
                        <span>{perk}</span>
                      </li>
                    ))}
                  </ul>

                  {t.price_usd > 0 && (
                    <button
                      onClick={() => subscribe(t)}
                      disabled={busy === t.id || isCurrent}
                      data-testid={`pricing-cta-${t.id}`}
                      className={`mt-5 w-full px-4 py-2.5 rounded-full text-xs font-black uppercase tracking-widest transition disabled:opacity-50 ${
                        t.id === "sovereign" || t.id === "genius_chair"
                          ? "bg-amber-400 hover:bg-amber-300 text-black"
                          : "bg-white/10 hover:bg-white/20 text-white border border-white/20"
                      }`}
                    >
                      {busy === t.id ? <Loader2 className="w-4 h-4 animate-spin inline" />
                        : isCurrent ? "Current tier"
                        : t.interval === "one_time" ? "Claim chair"
                        : "Subscribe"}
                    </button>
                  )}
                  {t.price_usd === 0 && isCurrent && (
                    <p className="mt-5 text-[10px] text-center uppercase tracking-widest text-white/40">You're here</p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="text-center mt-10 text-xs text-white/40 max-w-2xl mx-auto">
          Stake-based features (sports bets · lottery tickets · table buy-ins) remain pay-per-use across every tier — premium membership unlocks reduced fees, bonuses, and access, not the stakes themselves.
        </div>
      </main>
    </div>
  );
}
