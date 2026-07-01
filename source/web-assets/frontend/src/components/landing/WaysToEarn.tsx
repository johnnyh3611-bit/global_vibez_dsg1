/**
 * WaysToEarn — comprehensive earnings explainer for the landing page.
 *
 * Lays out every legitimate way a user can put money into their pocket
 * on Global Vibez, with real production numbers (sourced from
 * `routes/profit_share.py` ACCRUAL_RATES and the live chair-pool
 * percentages from /api/chairs/economics). Followed by a Monthly
 * Platform Scenarios table so visitors can self-project earnings at
 * different revenue tiers.
 *
 * Renders inside a `<LandingAccordion>` so it doesn't bloat the
 * landing scroll until a visitor opts in.
 */
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Crown,
  Gamepad2,
  Car,
  Bike,
  Repeat,
  Coins,
  Mic2,
  Users,
  Gift,
  TrendingUp,
  Calculator,
  Sparkles,
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

type Economics = {
  chair_pool_pct: number;
  chair_pool_pct_pre_ev: number;
  chair_pool_pct_post_ev: number;
  escape_velocity_fired: boolean;
  total_weighted: number;
};

// 7 earning paths sourced from production (profit_share.py + apex_evolution
// + chair_expansion + VibeRidez VibeXP). Each PathCard is independently
// testable + skimmable on mobile.
const EARNING_PATHS = [
  {
    id: "chair-payouts",
    Icon: Crown,
    eyebrow: "Chairs",
    title: "Quarterly Profit Share",
    body:
      "Park a Founder Chair. Every game pot, tip, and ride throws 13.5% into the Sovereign Treasury, which recirculates to chair holders weighted by tier — Genius 3× / Genesis 2× / post-Genesis 1×. Stacks with 5× chair mining on the daily ₵ pool. Weight locked at purchase, distributed in ₵ Vibez Coins. When chair #50,000 sells, the 200M DSG Founder Vault starts a 12-month drip (25% immediate, balance monthly) on top.",
    rate: "Up to 30% of platform profit, by weight",
    tone: "border-amber-500/40 bg-amber-950/20 text-amber-300",
  },
  {
    id: "loyalty-stakes",
    Icon: Sparkles,
    eyebrow: "Engagement Mining",
    title: "Loyalty Stakes (the daily earn)",
    body:
      "Use the platform → earn loyalty stakes that convert to ₵ Vibez Coins each quarter. Real production rates: +200 stakes per Premium renewal, +30 per $1 of creator revenue, +10 per $1 deposited, +3 per Spades/BidWhist hand, +2 per VibeRidez ride completed, +1 per JFTN visit / Vibe Call minute / Vibez 654 round. Active drivers + daily players easily clear 1,000+ stakes/month.",
    rate: "Variable — accrued automatically",
    tone: "border-cyan-500/40 bg-cyan-950/20 text-cyan-300",
  },
  {
    id: "vibe-ridez",
    Icon: Car,
    eyebrow: "VibeRidez",
    title: "Triple-Stream Driver Pay",
    body:
      "Drive a VibeRidez ride and earn from THREE streams on a single trip: (1) 70% of the fare via the Solana on-chain split, (2) virtual gifts from livestream viewers, (3) 100 VibeXP per safe ride + 10 VibeXP per streamed mile. VibeXP converts 1:1 to $DSG at TGE. The other 20% / 10% of fare goes to platform / community liquidity.",
    rate: "70% of fare + tips + 100 XP/ride",
    tone: "border-emerald-500/40 bg-emerald-950/20 text-emerald-300",
  },
  {
    id: "hungry-vibez",
    Icon: Bike,
    eyebrow: "Hungry Vibez",
    title: "Food Delivery on the Same Fleet",
    body:
      "Same driver network as VibeRidez, second task type. Pick up from Mom & Pop partner kitchens, drop off to customers, keep 70% of the delivery fee via the same on-chain split — plus restaurant tips and the $DSG payout token. Flat-fee partner restaurants pay no predatory per-order rake, so drivers see more per drop. Live dispatch, no idle rides.",
    rate: "70% of delivery fee + tips + $DSG",
    tone: "border-orange-500/40 bg-orange-950/20 text-orange-300",
  },
  {
    id: "vibe-venues-host",
    Icon: Crown,
    eyebrow: "Vibe Venues",
    title: "Host a House — Hourly Rental",
    body:
      "List your loft, rooftop, kitchen, or pop-up space. Pick from 3 / 6 / 9 / 12 / 24 hr blocks. Customer pays full rent + (optional) chef fee up front into $DSG smart escrow. After their Vibe-Check, you get 80% of the house rental as on-chain payout — platform keeps 20% to fund the chair pool. Zero per-event hassle, no security-deposit fights.",
    rate: "80% of house rental per booking",
    tone: "border-fuchsia-500/40 bg-fuchsia-950/20 text-fuchsia-300",
  },
  {
    id: "vibe-artisan",
    Icon: Mic2,
    eyebrow: "Vibe Artisan",
    title: "Chef · Decorator · Setter Membership",
    body:
      "Flat $20/month membership unlocks Signature Commercials inside venue 360° walkthroughs, AI-driven 'Perfect Mate' auto-matching with bookings, and a 1-2hr early-access prep window for every event. 30% prep-fee releases on confirmation, 70% balance on Vibe-Check — so you cover groceries the moment a customer locks the booking.",
    rate: "$20/mo flat · 30% prep upfront, 70% on Vibe-Check",
    tone: "border-orange-500/40 bg-orange-950/20 text-orange-300",
  },
  {
    id: "premium-multiplier",
    Icon: TrendingUp,
    eyebrow: "Premium Tier",
    title: "1.5× Stake Multiplier",
    body:
      "Active Premium subscription (Diamond / Gold / Premium tier) puts a permanent 1.5× boost on every loyalty stake you accrue AND keeps your chair payouts active each quarter. Without active premium, your chair holds its weight but skips that quarter's distribution. $9.99/mo recovers fast at 200+ stakes/renewal alone.",
    rate: "+50% on every stake while active",
    tone: "border-rose-500/40 bg-rose-950/20 text-rose-300",
  },
  {
    id: "vibe-credits",
    Icon: Coins,
    eyebrow: "$DSG Token",
    title: "Vibe Credits → $DSG at TGE",
    body:
      "Every Vibez Coin (₵) you hold today converts 1:1 to the public $DSG SPL token at the Token Generation Event. Verified accounts only. Park-it-now mechanic: chair payouts, loyalty redemptions, driver fares, even gameplay rewards are all denominated in ₵ — and ₵ becomes $DSG on TGE day. Earn now, redeem on day 1.",
    rate: "1 ₵ = 1 $DSG at TGE",
    tone: "border-violet-500/40 bg-violet-950/20 text-violet-300",
  },
  {
    id: "creator-revenue",
    Icon: Mic2,
    eyebrow: "Creators",
    title: "Stream + Tip Pool",
    body:
      "Stream from your VibeRidez vehicle, host a Glasshouse session, run a 3D Glass Emoji event, or build an audience on the Bilingual Chat. Every $1 you earn pays back 30 loyalty stakes (3× the deposit rate). Highest accrual multiplier in the platform — creators who pull $500/mo earn ~15K stakes/mo on top of their cash earnings.",
    rate: "30 stakes per $1 earned",
    tone: "border-fuchsia-500/40 bg-fuchsia-950/20 text-fuchsia-300",
  },
  {
    id: "referrals",
    Icon: Users,
    eyebrow: "Referrals",
    title: "Genius Kit Invites",
    body:
      "Open your Genius Kit (chair holders only) → unique invite QR + link. Every friend who scans your code AND parks their first chair earns YOU +10 loyalty stakes — discretionary loyalty bonus, not investment yield. Compound it: 50 referred buyers = 500 stakes/year of pure pass-through earn.",
    rate: "+10 stakes per converted referral",
    tone: "border-amber-500/40 bg-amber-950/15 text-amber-300",
  },
  {
    id: "games",
    Icon: Gamepad2,
    eyebrow: "Games",
    title: "Big Wheel + JFTN Rooms",
    body:
      "Spin the Big Wheel Lounge, walk into JFTN-gated rooms, host bilingual chat sessions — every interaction generates Vibe Credits AND hands you stakes. JFTN rooms reward token-gated entry; stakes accrue silently in the background. Casual play earns a few hundred stakes/month; competitive players clear 5K+.",
    rate: "1–3 stakes per round / visit",
    tone: "border-emerald-500/40 bg-emerald-950/15 text-emerald-300",
  },
];

// Monthly scenarios — assume 250K chairs sold (mid-rampup), ~437,500
// total weighted units. Single Genius chair holder gets 3 / 437,500 of
// the chair pool. Scenarios show MONTHLY chair payout at platform
// profit levels, both pre-EV (14%) and post-EV (30%).
const SCENARIOS = [
  {
    label: "Early ($50K/mo profit)",
    monthly: 50_000,
    color: "border-slate-600 text-slate-200",
  },
  {
    label: "Growing ($250K/mo)",
    monthly: 250_000,
    color: "border-cyan-500/40 text-cyan-200",
  },
  {
    label: "Critical mass ($1M/mo)",
    monthly: 1_000_000,
    color: "border-emerald-500/40 text-emerald-200",
  },
  {
    label: "Escape Velocity ($5M/mo)",
    monthly: 5_000_000,
    color: "border-amber-500/40 text-amber-200",
  },
];

const TOTAL_WEIGHTED_AT_FULL = 437_500; // 50K Genius×3 + 50K Genesis×2 + 50K Phase III×1.5 + 50K Phase IV×1.25 + 50K Phase V×1
const GENIUS_WEIGHT = 3;

function fmtUsd(n: number): string {
  if (n >= 1_000_000)
    return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)
    return `$${(n / 1_000).toFixed(1)}K`;
  if (n >= 100)
    return `$${n.toFixed(0)}`;
  return `$${n.toFixed(2)}`;
}

export default function WaysToEarn() {
  const [econ, setEcon] = useState<Economics | null>(null);

  useEffect(() => {
    fetch(`${API}/api/chairs/economics`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setEcon(d))
      .catch(() => null);
  }, []);

  const preEv = econ?.chair_pool_pct_pre_ev ?? 0.14;
  const postEv = econ?.chair_pool_pct_post_ev ?? 0.30;

  return (
    <div className="p-6 space-y-6" data-testid="ways-to-earn-body">
      {/* Lede */}
      <div className="rounded-2xl border border-fuchsia-500/30 bg-gradient-to-br from-fuchsia-950/40 via-black to-amber-950/30 p-5">
        <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-fuchsia-300 mb-2">
          Eight ways to put money in your pocket
        </p>
        <p className="text-sm text-neutral-200 leading-relaxed">
          Chairs are one earn path — not the only one. Below: every legitimate
          way to make money on Global Vibez, the real per-event accrual rates
          straight from production, and a calculator showing what holders
          earn at different platform-revenue levels. No hype, no projections
          — just the math.
        </p>
      </div>

      {/* 8 paths */}
      <div className="grid sm:grid-cols-2 gap-3" data-testid="earning-paths-grid">
        {EARNING_PATHS.map((p, i) => (
          <motion.div
            key={p.id}
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.04 }}
            className={`rounded-2xl border p-4 ${p.tone}`}
            data-testid={`earning-path-${p.id}`}
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-[9px] font-mono uppercase tracking-widest opacity-70">
                {p.eyebrow}
              </p>
              <p.Icon className="w-4 h-4 opacity-90" />
            </div>
            <h3 className="text-base font-black text-white mb-1.5 leading-tight">
              {p.title}
            </h3>
            <p className="text-xs text-neutral-300 leading-relaxed">
              {p.body}
            </p>
            <p className="text-[10px] font-mono uppercase tracking-widest mt-2 opacity-90">
              {p.rate}
            </p>
          </motion.div>
        ))}
      </div>

      {/* Monthly platform-profit scenarios */}
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/10 p-5">
        <div className="flex items-center gap-2 mb-3">
          <Calculator className="w-4 h-4 text-emerald-300" />
          <h3 className="text-sm font-black uppercase tracking-widest text-emerald-200">
            Monthly Platform Scenarios
          </h3>
        </div>
        <p className="text-xs text-neutral-400 mb-4 leading-relaxed">
          Per-chair monthly payout assuming 250K chairs sold across the 5
          active phases (≈437,500 total weighted units). Real
          chair-pool percentages — same constants the quarterly job uses.
        </p>

        <div className="overflow-x-auto -mx-2">
          <table className="w-full text-xs" data-testid="scenarios-table">
            <thead>
              <tr className="text-left text-[10px] font-mono uppercase tracking-widest text-emerald-300 border-b border-emerald-500/30">
                <th className="px-2 py-2">Platform profit</th>
                <th className="px-2 py-2 text-right">
                  Pre-EV ({(preEv * 100).toFixed(0)}%)
                </th>
                <th className="px-2 py-2 text-right">
                  Post-EV ({(postEv * 100).toFixed(0)}%)
                </th>
                <th className="px-2 py-2 text-right">
                  10 Genius chairs / yr
                </th>
              </tr>
            </thead>
            <tbody>
              {SCENARIOS.map((s) => {
                const pool_pre = s.monthly * preEv;
                const pool_post = s.monthly * postEv;
                const per_genius_pre = (pool_pre * GENIUS_WEIGHT) / TOTAL_WEIGHTED_AT_FULL;
                const per_genius_post = (pool_post * GENIUS_WEIGHT) / TOTAL_WEIGHTED_AT_FULL;
                const ten_chairs_year_post = per_genius_post * 10 * 12;
                return (
                  <tr
                    key={s.label}
                    data-testid={`scenario-row-${s.monthly}`}
                    className={`border-b border-slate-800 ${s.color}`}
                  >
                    <td className="px-2 py-2.5 font-bold whitespace-nowrap">
                      {s.label}
                    </td>
                    <td className="px-2 py-2.5 text-right font-mono">
                      {fmtUsd(per_genius_pre)} <span className="opacity-50">/mo</span>
                    </td>
                    <td className="px-2 py-2.5 text-right font-mono font-black">
                      {fmtUsd(per_genius_post)} <span className="opacity-50">/mo</span>
                    </td>
                    <td className="px-2 py-2.5 text-right font-mono text-amber-300">
                      {fmtUsd(ten_chairs_year_post)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="text-[10px] text-neutral-500 mt-3 leading-relaxed">
          Discretionary distributions, not investment yield. Numbers assume
          250K chairs sold; smaller current sold-count means a higher slice
          for early holders right now. Driver / creator / referral / stake
          earnings are <strong>on top of</strong> these chair payouts — not
          included in the table.
        </p>
      </div>

      {/* Honest expectations */}
      <div className="rounded-2xl border border-rose-500/30 bg-rose-950/15 p-5">
        <div className="flex items-center gap-2 mb-2">
          <Gift className="w-4 h-4 text-rose-300" />
          <h3 className="text-sm font-black uppercase tracking-widest text-rose-200">
            What to expect
          </h3>
        </div>
        <ul className="space-y-2 text-xs text-neutral-300 leading-relaxed">
          <li>
            <strong className="text-rose-300">Early days = small dollars.</strong>{" "}
            At $50K/mo profit, a Genius chair pays ~$0.05/mo. The math
            scales linearly — at $5M/mo it's ~$5/mo per chair, and
            post-Escape Velocity that doubles. Compounds with chair count.
          </li>
          <li>
            <strong className="text-rose-300">Loyalty stakes are the daily earn.</strong>{" "}
            Quarterly chair payouts are the long-term. Active users who
            renew Premium + play games + drive can clear 1,000–10,000
            stakes/month — real ₵, paid out at quarter close.
          </li>
          <li>
            <strong className="text-rose-300">$DSG TGE is the multiplier event.</strong>{" "}
            All ₵ holdings convert 1:1 to the public token at mint. Hold
            ₵ now = hold $DSG on day 1.
          </li>
          <li>
            <strong className="text-rose-300">Nothing is guaranteed.</strong>{" "}
            Founder Chairs are non-transferable loyalty seats with
            discretionary payouts. Not securities. Earn rates can be
            adjusted with notice. Read the fine print on /chair-vault.
          </li>
        </ul>
      </div>
    </div>
  );
}
