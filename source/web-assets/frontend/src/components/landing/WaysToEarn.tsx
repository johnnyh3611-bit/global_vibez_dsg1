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
  Coins,
  Mic2,
  Users,
  Gift,
  Calculator,
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

type Economics = {
  chair_pool_pct: number;
  chair_pool_pct_pre_ev: number;
  chair_pool_pct_post_ev: number;
  escape_velocity_fired: boolean;
  total_weighted: number;
};

type EarnPath = {
  id: string;
  Icon: React.ComponentType<{ className?: string }>;
  eyebrow: string;
  title: string;
  body: string;
  rate: string;
  tone: string;
};

/** Ship-core four paths — shown first. */
const CORE_PATHS: EarnPath[] = [
  {
    id: "chair-rewards",
    Icon: Crown,
    eyebrow: "Start here",
    title: "Own a Chair",
    body:
      "Genius chairs start at $20. Platform fees recirculate to holders by tier weight. Use the live calculator on /earn — same economics as /api/chairs/economics.",
    rate: "Passive share of platform fees",
    tone: "border-amber-500/40 bg-amber-950/20 text-amber-300",
  },
  {
    id: "referrals",
    Icon: Users,
    eyebrow: "Referrals",
    title: "Invite & earn",
    body:
      "Share your code from /referral. Earn when friends join and play — the fastest grow-with-friends path alongside chairs.",
    rate: "Bounty when invites convert",
    tone: "border-emerald-500/40 bg-emerald-950/20 text-emerald-300",
  },
  {
    id: "games",
    Icon: Gamepad2,
    eyebrow: "Games",
    title: "Win at the tables",
    body:
      "Spades, Bid Whist, Dice Hall, and more. Winnings land as Vibez Coins (₵) you can track in your wallet.",
    rate: "Skill-based ₵ winnings",
    tone: "border-yellow-500/40 bg-yellow-950/20 text-yellow-200",
  },
  {
    id: "creator-revenue",
    Icon: Mic2,
    eyebrow: "Streams",
    title: "Go live",
    body:
      "Broadcast from /streamer/studio, tip and chat on /streams. Creator revenue is a core earn path — not buried under lifestyle betas.",
    rate: "Tips + engagement",
    tone: "border-cyan-500/40 bg-cyan-950/20 text-cyan-300",
  },
];

/** Optional / beta — collapsed by default. */
const BETA_PATHS: EarnPath[] = [
  {
    id: "vibe-ridez",
    Icon: Car,
    eyebrow: "Beta",
    title: "VibeRidez driver pay",
    body: "Drive, stream, and tip-split on the rides fleet. Explore after the four core paths.",
    rate: "Fare split + tips",
    tone: "border-white/15 bg-white/[0.03] text-white/70",
  },
  {
    id: "hungry-vibez",
    Icon: Bike,
    eyebrow: "Beta",
    title: "Hungry Vibez delivery",
    body: "Same fleet, food drops. Lifestyle pillar — not required for your first earn.",
    rate: "Delivery fee share",
    tone: "border-white/15 bg-white/[0.03] text-white/70",
  },
  {
    id: "vibe-venues-host",
    Icon: Crown,
    eyebrow: "Beta",
    title: "Host a Vibe Venue",
    body: "List hourly spaces. Explore after chairs / games / streams.",
    rate: "Host rental share",
    tone: "border-white/15 bg-white/[0.03] text-white/70",
  },
  {
    id: "vibe-credits",
    Icon: Coins,
    eyebrow: "TGE",
    title: "₵ → $DSG (planned)",
    body: "In-app Vibez Coins today. Verified balances planned to convert 1:1 at Token Generation Event.",
    rate: "1:1 at TGE (planned)",
    tone: "border-white/15 bg-white/[0.03] text-white/70",
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
      <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/40 via-black to-amber-950/30 p-5">
        <p className="mb-2 text-[10px] font-mono uppercase tracking-[0.3em] text-emerald-300">
          Four ways to earn today
        </p>
        <p className="text-sm leading-relaxed text-neutral-200">
          Start with chairs (passive), referrals, game winnings, or streaming.
          Lifestyle betas (rides, food, venues) stay collapsed below. Live
          chair math is on <strong className="text-amber-300">/earn</strong>.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2" data-testid="earning-paths-grid">
        {CORE_PATHS.map((p, i) => (
          <motion.div
            key={p.id}
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.04 }}
            className={`rounded-2xl border p-4 ${p.tone}`}
            data-testid={`earning-path-${p.id}`}
          >
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[9px] font-mono uppercase tracking-widest opacity-70">
                {p.eyebrow}
              </p>
              <p.Icon className="h-4 w-4 opacity-90" />
            </div>
            <h3 className="mb-1.5 text-base font-black leading-tight text-white">
              {p.title}
            </h3>
            <p className="text-xs leading-relaxed text-neutral-300">{p.body}</p>
            <p className="mt-2 text-[10px] font-mono uppercase tracking-widest opacity-90">
              {p.rate}
            </p>
          </motion.div>
        ))}
      </div>

      <details
        className="rounded-2xl border border-white/10 bg-white/[0.02] p-4"
        data-testid="earning-paths-beta"
      >
        <summary className="cursor-pointer text-xs font-bold uppercase tracking-widest text-white/50">
          More paths · beta &amp; TGE
        </summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {BETA_PATHS.map((p) => (
            <div
              key={p.id}
              className={`rounded-xl border p-3 ${p.tone}`}
              data-testid={`earning-path-${p.id}`}
            >
              <div className="mb-1 flex items-center justify-between">
                <p className="text-[9px] font-mono uppercase tracking-widest opacity-70">
                  {p.eyebrow}
                </p>
                <p.Icon className="h-3.5 w-3.5 opacity-80" />
              </div>
              <h3 className="text-sm font-bold text-white">{p.title}</h3>
              <p className="mt-1 text-xs text-white/55">{p.body}</p>
            </div>
          ))}
        </div>
      </details>

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
