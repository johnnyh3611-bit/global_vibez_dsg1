/**
 * DynamicPremiumPriceBanner
 *
 * Small, calm banner shown on the Subscription Tiers page. Pulls
 * `/api/premium/price` and shows:
 *   • The current new-member price.
 *   • The next quarter's new-member price (rises $0.50 every quarter).
 *   • The grandfathered rate the caller is locked into (if Premium).
 *
 * NOT a security — this is just dynamic SaaS pricing à la Netflix. Existing
 * subscribers always pay the rate they signed up at; only NEW signups see
 * the new price.
 */
import { useEffect, useState } from "react";
import { TrendingUp, Lock, Sparkles } from "lucide-react";
import { authFetch, getUserId } from "@/utils/secureAuth";

const API = process.env.REACT_APP_BACKEND_URL;

type Price = {
  current_price_usd: number;
  your_grandfathered_price_usd: number | null;
  base_price_usd: number;
  step_per_quarter_usd: number;
  quarters_since_launch: number;
  next_price_increase_to_usd: number;
};

const fmt = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

export default function DynamicPremiumPriceBanner() {
  const [price, setPrice] = useState<Price | null>(null);

  useEffect(() => {
    const f = getUserId() ? authFetch : fetch;
    f(`${API}/api/premium/price`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setPrice(d));
  }, []);

  if (!price) return null;

  return (
    <div
      data-testid="dynamic-premium-price-banner"
      className="mt-6 mb-8 rounded-2xl border border-amber-400/30 bg-gradient-to-r from-amber-500/10 via-fuchsia-500/10 to-cyan-500/10 backdrop-blur-xl p-5 grid sm:grid-cols-3 gap-4"
    >
      <div>
        <p className="text-[10px] uppercase tracking-widest text-amber-300 font-bold flex items-center gap-1">
          <Sparkles className="w-3 h-3" /> Today's price
        </p>
        <p className="text-3xl font-black text-white mt-1">
          {fmt(price.current_price_usd)}
          <span className="text-sm font-normal text-gray-300">/mo</span>
        </p>
        <p className="text-[11px] text-gray-300/80 mt-1">
          Quarter {price.quarters_since_launch + 1} since launch · was {fmt(price.base_price_usd)}
        </p>
      </div>

      <div>
        <p className="text-[10px] uppercase tracking-widest text-fuchsia-300 font-bold flex items-center gap-1">
          <TrendingUp className="w-3 h-3" /> Next quarter
        </p>
        <p className="text-3xl font-black text-fuchsia-200 mt-1">
          {fmt(price.next_price_increase_to_usd)}
          <span className="text-sm font-normal text-gray-300">/mo</span>
        </p>
        <p className="text-[11px] text-gray-300/80 mt-1">
          Goes up {fmt(price.step_per_quarter_usd)}/quarter as the platform grows.
        </p>
      </div>

      <div>
        <p className="text-[10px] uppercase tracking-widest text-cyan-300 font-bold flex items-center gap-1">
          <Lock className="w-3 h-3" /> Your locked rate
        </p>
        {price.your_grandfathered_price_usd ? (
          <>
            <p
              className="text-3xl font-black text-cyan-200 mt-1"
              data-testid="grandfathered-price"
            >
              {fmt(price.your_grandfathered_price_usd)}
              <span className="text-sm font-normal text-gray-300">/mo</span>
            </p>
            <p className="text-[11px] text-emerald-300/90 mt-1">
              You're grandfathered — never goes up.
            </p>
          </>
        ) : (
          <>
            <p className="text-3xl font-black text-gray-400 mt-1">—</p>
            <p className="text-[11px] text-gray-300/80 mt-1">
              Lock today's price by subscribing now.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
