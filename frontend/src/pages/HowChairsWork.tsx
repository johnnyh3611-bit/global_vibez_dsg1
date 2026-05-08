/**
 * HowChairsWork — public explainer + interactive ROI calculator.
 *
 * Pulls real economics from `/api/chairs/economics` so the math is
 * never wrong: tier prices + weights are sourced from the live
 * PHASES list, the chair-pool % is the actual production constant
 * (PROFIT_SHARE_RATIO × CHAIR_POOL_RATIO = 0.20 × 0.70 = 14%), and
 * the denominator is the live sum of weighted chairs across all
 * locked buyers.
 *
 * The calculator answers ONE question well: "if I buy N chairs at
 * tier T and platform quarterly profit is $R, what do I earn?".
 * No yield-farming theater, no spinning numbers — just a single
 * honest computation surfaced in $ and ₵.
 */
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import GeniusPhaseProgress from "@/components/chairs/GeniusPhaseProgress";
import {
  Crown,
  Sparkles,
  TrendingUp,
  Calculator,
  Lock,
  Info,
  ArrowRight,
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

type Tier = {
  name: string;
  price_usd: number;
  weight: number;
  limit: number;
  tagline: string;
};

type Economics = {
  tiers: Tier[];
  chair_pool_pct: number;
  chair_pool_pct_pre_ev: number;
  chair_pool_pct_post_ev: number;
  escape_velocity_fired: boolean;
  profit_share_ratio: number;
  chair_pool_ratio: number;
  total_weighted: number;
  total_chairs: number;
  usd_to_coins: number;
};

function fmtUsd(n: number): string {
  if (Math.abs(n) >= 1_000_000)
    return `$${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

function fmtNum(n: number): string {
  return n.toLocaleString("en-US");
}

// Average weight per chair across all 5 active tiers, weighted by
// each tier's chair limit. Used to translate a user-facing "market
// depth in chairs" assumption into a "weighted-chairs in circulation"
// denominator. The math: Σ(limit × weight) / Σ(limit), so as tiers
// fill organically the implied avg weight roughly tracks reality.
//   = (50k×3 + 100k×2 + 150k×1.5 + 200k×1.25 + 250k×1) / 750k
//   = 1075 / 750 ≈ 1.4333
const AVG_WEIGHT_PER_CHAIR = 1.4333;

export default function HowChairsWork() {
  const [econ, setEcon] = useState<Economics | null>(null);
  const [tier, setTier] = useState<string>("Genius");
  const [chairs, setChairs] = useState<number>(1);
  const [revenue, setRevenue] = useState<number>(50_000);
  // Hypothetical market depth — how many chairs OTHER holders own.
  // Without this, an empty live denominator makes every tier appear
  // to earn the same % share, which masks the whole point of weights.
  // Default = 10k chairs (~Genius fully sold) to give meaningful
  // comparison out of the gate.
  const [marketDepth, setMarketDepth] = useState<number>(10_000);

  useEffect(() => {
    fetch(`${API}/api/chairs/economics`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setEcon(d))
      .catch(() => null);
  }, []);

  // Effective denominator = live weighted chairs + hypothetical
  // market depth (converted to weight units). User controls the
  // assumption explicitly, keeping the math honest.
  const baseWeighted = useMemo(() => {
    if (!econ) return 0;
    return econ.total_weighted + marketDepth * AVG_WEIGHT_PER_CHAIR;
  }, [econ, marketDepth]);

  // Derived ROI math. Memoized because revenue + chairs sliders fire
  // a lot of state changes — no need to re-allocate the comparison
  // array on every keystroke.
  const calc = useMemo(() => {
    if (!econ) return null;
    const myTier = econ.tiers.find((t) => t.name === tier);
    if (!myTier) return null;
    const myWeight = myTier.weight * chairs;
    const totalCost = myTier.price_usd * chairs;
    const chairPool = revenue * econ.chair_pool_pct;
    // The denominator MUST include the user's hypothetical chairs,
    // otherwise the % share is overstated. We assume a marginal
    // buyer joining the current pool.
    const denominator = baseWeighted + myWeight;
    const myShareFraction = denominator > 0 ? myWeight / denominator : 0;
    const quarterlyPayoutUsd = myShareFraction * chairPool;
    const quarterlyPayoutCoins = Math.round(
      quarterlyPayoutUsd * econ.usd_to_coins,
    );
    const breakevenQuarters =
      quarterlyPayoutUsd > 0 ? totalCost / quarterlyPayoutUsd : Infinity;
    return {
      myTier,
      myWeight,
      totalCost,
      chairPool,
      myShareFraction,
      quarterlyPayoutUsd,
      quarterlyPayoutCoins,
      breakevenQuarters,
    };
  }, [econ, tier, chairs, revenue, baseWeighted]);

  const comparisonRows = useMemo(() => {
    if (!econ) return [];
    return econ.tiers.map((t) => {
      const w = t.weight * chairs;
      const denom = baseWeighted + w;
      const share = denom > 0 ? w / denom : 0;
      const payout = share * (revenue * econ.chair_pool_pct);
      const cost = t.price_usd * chairs;
      const be = payout > 0 ? cost / payout : Infinity;
      return { ...t, payout, cost, breakeven: be };
    });
  }, [econ, chairs, revenue, baseWeighted]);

  return (
    <main
      className="min-h-screen bg-black text-white"
      data-testid="how-chairs-work-page"
    >
      {/* HERO */}
      <section className="px-6 py-24 max-w-4xl mx-auto text-center">
        <p className="text-xs font-mono uppercase tracking-[0.4em] text-fuchsia-400 mb-4">
          The Founder's Plain-English Guide
        </p>
        <h1 className="text-5xl sm:text-6xl font-black italic uppercase tracking-tighter">
          How a Chair Works
        </h1>
        <p className="text-neutral-400 mt-6 text-base sm:text-lg leading-relaxed">
          A chair is your seat at the table. As the platform grows,
          chair-holders share <strong className="text-white">14%</strong> of
          quarterly platform profit — distributed by{" "}
          <strong className="text-white">weight</strong>, not by who paid the
          most. Earlier buyers carry a higher weight, locked for life. Below
          is the actual math, plus a calculator that uses live on-chain
          numbers to show what your slice looks like.
        </p>
      </section>

      {/* GENIUS PHASE PROGRESS — live system-wide + per-user cap */}
      <section className="px-6 pb-16 max-w-3xl mx-auto">
        <GeniusPhaseProgress />
      </section>

      {/* THE 3 LEVERS */}
      <section className="px-6 pb-16 max-w-5xl mx-auto">
        <div className="grid md:grid-cols-3 gap-4">
          <Lever
            num="01"
            Icon={Crown}
            title="Tier"
            body="Which Phase you bought in. Genius ($10) → Genesis ($15) → Phase III ($20) → Phase IV ($25) → Phase V ($30). Locked to your chair forever."
            tone="amber"
            testId="lever-tier"
          />
          <Lever
            num="02"
            Icon={TrendingUp}
            title="Weight (Multiplier)"
            body="Your earn-rate multiplier, set the moment you buy. Genius = 3×, Genesis = 2×, Phase III = 1.5×, Phase IV = 1.25×, Phase V = 1×. Never decreases — even after Genius sells out."
            tone="fuchsia"
            testId="lever-weight"
          />
          <Lever
            num="03"
            Icon={Calculator}
            title="Cost Factor"
            body="Total paid divided by total weight. Genius at $10 / 3× = $3.33 per weight unit. Phase V at $30 / 1× = $30 per weight unit. That 9× ratio is the early-believer reward."
            tone="cyan"
            testId="lever-cost"
          />
        </div>
      </section>

      {/* CALCULATOR */}
      <section className="px-6 pb-24 max-w-4xl mx-auto">
        <div className="rounded-3xl border border-fuchsia-500/30 bg-gradient-to-br from-fuchsia-950/30 via-black to-violet-950/20 p-8 shadow-2xl">
          <div className="flex items-center gap-3 mb-6">
            <Calculator className="w-6 h-6 text-fuchsia-400" />
            <h2
              className="text-2xl font-black italic uppercase tracking-tighter"
              data-testid="calculator-title"
            >
              ROI Calculator — Honest Math
            </h2>
          </div>

          {!econ && (
            <p className="text-neutral-500 text-sm" data-testid="calc-loading">
              Loading live economics…
            </p>
          )}

          {econ && (
            <>
              {/* INPUTS */}
              <div className="space-y-6">
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-widest text-fuchsia-300 mb-2">
                    1. Pick your tier
                  </label>
                  <div
                    className="grid grid-cols-2 sm:grid-cols-5 gap-2"
                    data-testid="calc-tier-buttons"
                  >
                    {econ.tiers.map((t) => (
                      <button
                        key={t.name}
                        type="button"
                        onClick={() => setTier(t.name)}
                        data-testid={`calc-tier-btn-${t.name.replace(/\s+/g, "-")}`}
                        className={`rounded-xl border px-3 py-3 text-left transition ${
                          tier === t.name
                            ? "border-fuchsia-400 bg-fuchsia-500/15"
                            : "border-slate-800 hover:border-slate-600"
                        }`}
                      >
                        <p className="text-xs font-bold text-white">{t.name}</p>
                        <p className="text-lg font-black font-mono text-fuchsia-300">
                          ${t.price_usd}
                        </p>
                        <p className="text-[10px] text-neutral-400">
                          {t.weight}× weight
                        </p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="calc-chairs"
                      className="block text-[10px] font-mono uppercase tracking-widest text-fuchsia-300 mb-2"
                    >
                      2. How many chairs
                    </label>
                    <input
                      id="calc-chairs"
                      data-testid="calc-chairs-input"
                      type="number"
                      min={1}
                      max={1000}
                      value={chairs}
                      onChange={(e) =>
                        setChairs(
                          Math.max(1, parseInt(e.target.value || "1", 10)),
                        )
                      }
                      className="w-full rounded-xl bg-slate-950 border border-slate-800 px-4 py-3 text-2xl font-black font-mono text-white focus:border-fuchsia-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="calc-revenue"
                      className="block text-[10px] font-mono uppercase tracking-widest text-fuchsia-300 mb-2"
                    >
                      3. Hypothetical quarterly profit (USD)
                    </label>
                    <input
                      id="calc-revenue"
                      data-testid="calc-revenue-input"
                      type="range"
                      min={1_000}
                      max={5_000_000}
                      step={1_000}
                      value={revenue}
                      onChange={(e) =>
                        setRevenue(parseInt(e.target.value, 10))
                      }
                      className="w-full accent-fuchsia-500"
                    />
                    <p
                      className="text-2xl font-black font-mono text-white mt-1"
                      data-testid="calc-revenue-display"
                    >
                      {fmtUsd(revenue)}
                      <span className="text-xs text-neutral-500 ml-2 font-normal">
                        / quarter
                      </span>
                    </p>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="calc-depth"
                    className="block text-[10px] font-mono uppercase tracking-widest text-fuchsia-300 mb-2"
                  >
                    4. Market depth — chairs already held by others
                  </label>
                  <input
                    id="calc-depth"
                    data-testid="calc-depth-input"
                    type="range"
                    min={0}
                    max={500_000}
                    step={1_000}
                    value={marketDepth}
                    onChange={(e) =>
                      setMarketDepth(parseInt(e.target.value, 10))
                    }
                    className="w-full accent-fuchsia-500"
                  />
                  <p
                    className="text-base font-mono text-white mt-1"
                    data-testid="calc-depth-display"
                  >
                    {fmtNum(marketDepth)} chairs assumed
                    <span className="text-xs text-neutral-500 ml-2 font-normal">
                      ≈ {(marketDepth * AVG_WEIGHT_PER_CHAIR).toFixed(0)} weight units
                    </span>
                  </p>
                  <p className="text-[10px] text-neutral-500 mt-1 leading-relaxed">
                    The denominator that decides your slice. Move this to see how
                    your share evolves as the platform grows. 0 = you're the only
                    holder, 500K = full active circulation.
                  </p>
                </div>
              </div>

              {/* OUTPUTS */}
              {calc && (
                <div
                  className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-3"
                  data-testid="calc-output-grid"
                >
                  <Output
                    label="You Pay"
                    value={fmtUsd(calc.totalCost)}
                    sub={`${chairs} × $${calc.myTier.price_usd}`}
                    testId="calc-out-cost"
                  />
                  <Output
                    label="Your Weight"
                    value={`${calc.myWeight.toFixed(2)}`}
                    sub={`vs ${fmtNum(Math.round(baseWeighted))} assumed total`}
                    testId="calc-out-weight"
                  />
                  <Output
                    label="Quarterly Payout"
                    value={fmtUsd(calc.quarterlyPayoutUsd)}
                    sub={`= ${fmtNum(calc.quarterlyPayoutCoins)} ₵`}
                    tone="emerald"
                    testId="calc-out-payout"
                  />
                  <Output
                    label="Breakeven"
                    value={
                      isFinite(calc.breakevenQuarters)
                        ? `${calc.breakevenQuarters.toFixed(1)} q`
                        : "—"
                    }
                    sub={
                      isFinite(calc.breakevenQuarters)
                        ? `${(calc.breakevenQuarters / 4).toFixed(1)} years`
                        : "(no payout)"
                    }
                    tone="fuchsia"
                    testId="calc-out-breakeven"
                  />
                </div>
              )}

              {/* COMPARISON TABLE */}
              {comparisonRows.length > 0 && (
                <div className="mt-8" data-testid="calc-comparison-table">
                  <p className="text-[10px] font-mono uppercase tracking-widest text-neutral-500 mb-2">
                    Side-by-side at the same chair count + revenue
                  </p>
                  <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/40">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left text-neutral-500 border-b border-slate-800">
                          <th className="px-3 py-2 font-mono uppercase">Tier</th>
                          <th className="px-3 py-2 font-mono uppercase text-right">
                            Cost
                          </th>
                          <th className="px-3 py-2 font-mono uppercase text-right">
                            Quarterly
                          </th>
                          <th className="px-3 py-2 font-mono uppercase text-right">
                            Breakeven
                          </th>
                        </tr>
                      </thead>
                      <tbody className="font-mono">
                        {comparisonRows.map((row) => (
                          <tr
                            key={row.name}
                            data-testid={`calc-cmp-${row.name.replace(/\s+/g, "-")}`}
                            className={`border-b border-slate-900 ${row.name === tier ? "bg-fuchsia-500/10" : ""}`}
                          >
                            <td className="px-3 py-2 text-white font-bold">
                              {row.name}
                            </td>
                            <td className="px-3 py-2 text-right text-neutral-300">
                              ${row.cost.toFixed(0)}
                            </td>
                            <td className="px-3 py-2 text-right text-emerald-300">
                              {fmtUsd(row.payout)}
                            </td>
                            <td className="px-3 py-2 text-right text-fuchsia-300">
                              {isFinite(row.breakeven)
                                ? `${row.breakeven.toFixed(1)} q`
                                : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ASSUMPTION BLOCK */}
              <div
                className="mt-6 flex items-start gap-2 rounded-xl border border-cyan-500/20 bg-cyan-950/15 p-4 text-xs text-cyan-100/80"
                data-testid="calc-assumption-block"
              >
                <Info className="w-4 h-4 text-cyan-300 flex-shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <p>
                    <strong className="text-cyan-200">Assumptions:</strong>{" "}
                    {(econ.chair_pool_pct * 100).toFixed(0)}% of quarterly
                    platform profit flows to the chair pool right now. When
                    the platform hits{" "}
                    <strong className="text-amber-300">Escape Velocity</strong>
                    , that share auto-bumps to{" "}
                    <strong className="text-amber-300">
                      {(econ.chair_pool_pct_post_ev * 100).toFixed(0)}%
                    </strong>{" "}
                    — same chair, ~2× the payout the moment the Founder pulls
                    the switch. Your payout requires an active premium
                    subscription each quarter; without one, your chair holds
                    its weight but skips that quarter's distribution. ₵ =
                    Vibez Coins @ {econ.usd_to_coins} ₵ per $1.
                  </p>
                  <p className="mt-2 text-cyan-100/60">
                    Live denominator: {fmtNum(econ.total_chairs)} chairs ·{" "}
                    {econ.total_weighted.toFixed(2)} live weight units +{" "}
                    {fmtNum(marketDepth)} hypothetical chairs (≈
                    {(marketDepth * AVG_WEIGHT_PER_CHAIR).toFixed(0)} weight) ={" "}
                    <strong className="text-cyan-100">
                      {baseWeighted.toFixed(2)}
                    </strong>{" "}
                    effective.
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      </section>

      {/* RESERVE VAULT NOTE */}
      <section className="px-6 pb-20 max-w-4xl mx-auto">
        <div
          className="rounded-2xl border border-amber-700/40 bg-amber-950/20 p-6 flex gap-4"
          data-testid="how-reserve-vault-block"
        >
          <Lock className="w-5 h-5 text-amber-300 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-amber-200 font-bold uppercase tracking-wider text-sm">
              About the other 500,000 chairs
            </h3>
            <p className="text-xs text-amber-100/80 mt-2 leading-relaxed">
              The platform's chair supply is 1,000,000 total — but only
              500,000 are in active circulation. The other 500,000 sit in
              the Reserve Vault and only unlock once the platform reaches
              Escape Velocity (major user milestones). When unlocked,
              vault chairs are distributed through community-voted events
              — never bulk-sold. This protects the floor for early holders
              by guaranteeing the supply curve can't be flooded mid-cycle.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 pb-24 max-w-3xl mx-auto text-center">
        <Link
          to="/chairs/vault"
          className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-fuchsia-500 to-violet-500 px-8 py-4 text-base font-bold text-white shadow-xl shadow-fuchsia-500/30 hover:scale-105 transition-transform"
          data-testid="how-chairs-park-cta"
        >
          Park Your Chair
          <ArrowRight className="w-5 h-5" />
        </Link>
        <p className="text-xs text-neutral-500 mt-4">
          A chair is not a security. Multipliers reward activity, not capital.
        </p>
      </section>
    </main>
  );
}

function Lever({
  num,
  Icon,
  title,
  body,
  tone,
  testId,
}: {
  num: string;
  Icon: typeof Crown;
  title: string;
  body: string;
  tone: "amber" | "fuchsia" | "cyan";
  testId: string;
}) {
  const colors: Record<typeof tone, string> = {
    amber: "border-amber-500/30 bg-amber-950/20 text-amber-300",
    fuchsia: "border-fuchsia-500/30 bg-fuchsia-950/20 text-fuchsia-300",
    cyan: "border-cyan-500/30 bg-cyan-950/20 text-cyan-300",
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className={`rounded-2xl border p-5 ${colors[tone]}`}
      data-testid={testId}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-mono opacity-60">{num}</span>
        <Icon className="w-5 h-5 opacity-80" />
      </div>
      <h3 className="text-lg font-black text-white mb-2">{title}</h3>
      <p className="text-sm text-neutral-300 leading-relaxed">{body}</p>
    </motion.div>
  );
}

function Output({
  label,
  value,
  sub,
  tone,
  testId,
}: {
  label: string;
  value: string;
  sub: string;
  tone?: "emerald" | "fuchsia";
  testId: string;
}) {
  const valueClass =
    tone === "emerald"
      ? "text-emerald-300"
      : tone === "fuchsia"
        ? "text-fuchsia-300"
        : "text-white";
  return (
    <div
      className="rounded-xl border border-slate-800 bg-slate-950/60 p-3"
      data-testid={testId}
    >
      <p className="text-[9px] font-mono uppercase tracking-widest text-neutral-500">
        {label}
      </p>
      <p className={`text-2xl font-black font-mono mt-1 ${valueClass}`}>
        {value}
      </p>
      <p className="text-[10px] text-neutral-500 mt-0.5">{sub}</p>
    </div>
  );
}
