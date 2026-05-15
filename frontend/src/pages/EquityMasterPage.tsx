/**
 * EquityMasterPage — Crewmate Architecture · 30% Revenue Split · Diamond Market Logic.
 *
 * Surfaces every locked number from Global_Vibez_DSG_Equity_Master.pdf:
 *   • The 4 Crewmate roles + chair caps (Founder ∞ · Pit Boss 250 ·
 *     Vibe Scout 250 · Treasurer 250)
 *   • The 30% gross→ownership revenue split (paid quarterly)
 *   • Genius → Genesis → Diamond phase pricing math
 *   • An interactive dividend calculator driven by the real backend
 *     `/api/equity-master/valuation` POST endpoint
 *
 * All numbers are PULLED from the backend (which itself reads from the
 * Final[…] locked constants) so this page can never drift from the PDF.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Crown, Gem, Dices, Radio, Key, TrendingUp, Lock, Shield, Vote, Megaphone } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

type Constants = {
  ownership_revenue_share_pct: string;
  dividend_distribution_cadence: string;
  vibez_payout_bonus_pct: string;
  yield_basis_pct: string;
  phases: {
    genius_floor_usd: number;
    genesis_floor_usd: number;
    diamond_reference_usd: number;
    diamond_reference_monthly_gross_usd: number;
  };
  scarcity_premium_pct: { min: number; max: number };
  total_chairs_baseline: number;
  walking_ads_cohort_size: number;
  revenue_categories: string[];
  spec_doc: string;
  governance?: {
    block_release_size: number;
    majority_vote_threshold_pct: string;
    milestone_barrier: string;
  };
  crewmate_lockup_months?: number;
  platform_buyback_floor_usd?: number;
  value_matrix?: ValueRow[];
};

type ValueRow = {
  id: string;
  label: string;
  monthly_rev_usd: number;
  annual_div_per_chair_usd: number;
  market_value_usd: number;
  tagline: string;
};

type Role = {
  id: string;
  label: string;
  focus_area: string;
  chair_cap_display: string;
  emoji: string;
};

type Dividend = {
  monthly_gross_usd: number;
  monthly_dividend_per_chair_usd: number;
  quarterly_dividend_per_chair_usd: number;
  annual_dividend_per_chair_usd: number;
  current_price_usd: number;
  effective_price_usd: number;
  floor_phase: "genius" | "genesis" | "diamond";
};

const ROLE_ICON: Record<string, typeof Crown> = {
  founder: Crown,
  pit_boss: Dices,
  vibe_scout: Radio,
  treasurer: Key,
};

function fmtUSD(n: number, digits = 2): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(n);
}

function fmtInt(n: number): string {
  return new Intl.NumberFormat("en-US").format(n);
}

export default function EquityMasterPage() {
  const navigate = useNavigate();
  const [constants, setConstants] = useState<Constants | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [grossInput, setGrossInput] = useState<number>(5_000_000);
  const [dividend, setDividend] = useState<Dividend | null>(null);
  const [calculating, setCalculating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [c, r, d] = await Promise.all([
          fetch(`${API}/api/equity-master/constants`).then((x) => x.json()),
          fetch(`${API}/api/equity-master/crewmate-roles`).then((x) => x.json()),
          fetch(`${API}/api/equity-master/dividend?monthly_gross=5000000`).then((x) => x.json()),
        ]);
        if (cancelled) return;
        setConstants(c);
        setRoles(r.roles);
        setDividend(d);
      } catch {
        /* offline — leave empty; the page still renders the static math */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const recalc = async (gross: number) => {
    setCalculating(true);
    try {
      const r = await fetch(`${API}/api/equity-master/valuation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monthly_gross_usd: gross, total_chairs: 1_000_000 }),
      });
      const d = await r.json();
      setDividend(d);
    } finally {
      setCalculating(false);
    }
  };

  const phase = dividend?.floor_phase ?? "diamond";
  const phaseColor =
    phase === "diamond"
      ? "from-cyan-300 via-fuchsia-400 to-amber-300"
      : phase === "genesis"
        ? "from-amber-400 via-orange-500 to-rose-500"
        : "from-emerald-400 via-cyan-500 to-blue-500";

  return (
    <div
      data-testid="equity-master-page"
      className="min-h-screen bg-[#06070d] text-white"
    >
      {/* Header */}
      <header className="sticky top-0 z-10 bg-gradient-to-b from-[#06070d] via-[#06070d]/90 to-transparent backdrop-blur-md border-b border-white/5">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            data-testid="equity-back-btn"
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-xs uppercase tracking-widest"
          >
            <ArrowLeft className="w-3 h-3" /> Dashboard
          </button>
          <div className="flex items-center gap-2 text-fuchsia-300">
            <Lock className="w-3 h-3" />
            <span className="text-[10px] uppercase tracking-[0.4em]">
              Equity Master · Locked
            </span>
          </div>
          <div className="w-24" />
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-10 space-y-12">
        {/* Hero */}
        <section className="text-center">
          <motion.h1
            className="text-4xl sm:text-5xl lg:text-6xl font-black bg-gradient-to-r from-amber-300 via-fuchsia-400 to-cyan-300 bg-clip-text text-transparent"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            Crewmate Architecture
          </motion.h1>
          <p className="mt-3 text-base text-white/70 max-w-2xl mx-auto">
            30% Revenue Split · Diamond Market Logic · Employee-Owned Hierarchy
          </p>
          <p className="mt-1 text-xs uppercase tracking-[0.3em] text-fuchsia-300/80">
            {constants?.spec_doc ?? "Global_Vibez_DSG_Equity_Master.pdf"}
          </p>
        </section>

        {/* Top stats strip */}
        <section
          data-testid="equity-stats-strip"
          className="grid grid-cols-2 md:grid-cols-4 gap-3"
        >
          {[
            {
              label: "Revenue → Owners",
              value: constants?.ownership_revenue_share_pct ?? "30%",
              hint: "of gross · quarterly",
            },
            {
              label: "Total Chairs",
              value: fmtInt(constants?.total_chairs_baseline ?? 1_000_000),
              hint: "baseline supply",
            },
            {
              label: "$VIBEZ Bonus",
              value: `+${constants?.vibez_payout_bonus_pct ?? "5%"}`,
              hint: "vs SOL / USDC",
            },
            {
              label: "Scarcity Premium",
              value: `${constants?.scarcity_premium_pct.min ?? 20}–${constants?.scarcity_premium_pct.max ?? 30}%`,
              hint: "on locked chairs",
            },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-sm p-4"
              data-testid={`equity-stat-${s.label.toLowerCase().replace(/[^a-z]+/g, "-")}`}
            >
              <div className="text-[10px] uppercase tracking-widest text-white/40">
                {s.label}
              </div>
              <div className="text-2xl font-black text-white mt-1">{s.value}</div>
              <div className="text-xs text-fuchsia-300/70 mt-1">{s.hint}</div>
            </div>
          ))}
        </section>

        {/* Crewmate roles */}
        <section>
          <h2 className="text-lg md:text-lg font-bold uppercase tracking-[0.3em] text-white/80 mb-4">
            🧭 The 4 Crewmates
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {roles.map((role, i) => {
              const Icon = ROLE_ICON[role.id] ?? Crown;
              return (
                <motion.div
                  key={role.id}
                  data-testid={`crewmate-role-${role.id}`}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05, duration: 0.4 }}
                  className="rounded-2xl border-2 border-fuchsia-500/30 bg-gradient-to-br from-fuchsia-950/40 via-black/60 to-cyan-950/30 p-5 hover:border-amber-300/50 transition-colors"
                >
                  <Icon className="w-7 h-7 text-amber-300 mb-3" />
                  <div className="text-[10px] uppercase tracking-widest text-cyan-300">
                    Chair Cap · {role.chair_cap_display}
                  </div>
                  <div className="text-xl font-black text-white mt-1">
                    {role.label}
                  </div>
                  <p className="text-xs text-white/60 mt-2 leading-relaxed">
                    {role.focus_area}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </section>

        {/* v2 Equity & Value Matrix — 4-tier canonical price ladder */}
        <section>
          <h2 className="text-lg font-bold uppercase tracking-[0.3em] text-white/80 mb-4">
            💎 Equity &amp; Value Matrix
          </h2>
          <p className="text-xs text-white/50 mb-4 max-w-3xl">
            Every row is calculated from the same formula:{" "}
            <span className="text-amber-300/80">
              (monthly_rev × 0.30 / 1,000,000) × 12 / 0.10
            </span>
            . Server refuses to start if any row drifts from this math.
          </p>
          <div
            data-testid="equity-value-matrix"
            className="overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.03]"
          >
            <table className="min-w-full text-sm">
              <thead className="bg-white/5 text-[10px] uppercase tracking-widest text-white/50">
                <tr>
                  <th className="px-4 py-3 text-left">Tier</th>
                  <th className="px-4 py-3 text-right">Monthly Platform Rev</th>
                  <th className="px-4 py-3 text-right">Annual Div / Chair</th>
                  <th className="px-4 py-3 text-right">Market Value (10% Yield)</th>
                </tr>
              </thead>
              <tbody>
                {(constants?.value_matrix ?? [
                  { id: "floor", label: "Floor Level", monthly_rev_usd: 500_000, annual_div_per_chair_usd: 1.80, market_value_usd: 18, tagline: "" },
                  { id: "genesis", label: "Genesis Target", monthly_rev_usd: 2_750_000, annual_div_per_chair_usd: 9.90, market_value_usd: 99, tagline: "" },
                  { id: "diamond", label: "Diamond Status", monthly_rev_usd: 10_000_000, annual_div_per_chair_usd: 36, market_value_usd: 360, tagline: "" },
                  { id: "platinum", label: "Platinum Scale", monthly_rev_usd: 50_000_000, annual_div_per_chair_usd: 180, market_value_usd: 1_800, tagline: "" },
                ]).map((row) => (
                  <tr
                    key={row.id}
                    data-testid={`value-matrix-row-${row.id}`}
                    className="border-t border-white/5 hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-4 py-4">
                      <div className="text-base font-black uppercase tracking-wide text-white">
                        {row.label}
                      </div>
                      {row.tagline && (
                        <div className="text-[10px] text-fuchsia-300/70 mt-1">
                          {row.tagline}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4 text-right text-amber-300/90 font-bold">
                      {fmtUSD(row.monthly_rev_usd, 0)}
                    </td>
                    <td className="px-4 py-4 text-right text-cyan-300 font-bold">
                      {fmtUSD(row.annual_div_per_chair_usd, 2)}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <span className="text-2xl font-black bg-gradient-to-r from-amber-300 via-fuchsia-400 to-cyan-300 bg-clip-text text-transparent">
                        {fmtUSD(row.market_value_usd, 2)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* v2 Block-Release Governance + Crewmate Lock-up */}
        <section
          data-testid="equity-governance-section"
          className="grid grid-cols-1 md:grid-cols-3 gap-3"
        >
          <div className="rounded-2xl border-2 border-cyan-400/30 bg-gradient-to-br from-cyan-950/30 via-black/60 to-fuchsia-950/30 p-5">
            <Vote className="w-7 h-7 text-cyan-300 mb-3" />
            <div className="text-[10px] uppercase tracking-widest text-cyan-300">
              Block-Release Governance
            </div>
            <div className="text-3xl font-black text-white mt-1">
              {fmtInt(constants?.governance?.block_release_size ?? 50_000)} chairs
            </div>
            <p className="text-xs text-white/60 mt-2 leading-relaxed">
              New supply mints only in strict {fmtInt(50_000)}-unit blocks, gated by a{" "}
              <span className="text-cyan-300 font-bold">
                {constants?.governance?.majority_vote_threshold_pct ?? ">51%"}
              </span>{" "}
              majority vote — and only when Yield Math confirms the price stays put.
            </p>
          </div>
          <div className="rounded-2xl border-2 border-amber-300/30 bg-gradient-to-br from-amber-950/30 via-black/60 to-rose-950/30 p-5">
            <Shield className="w-7 h-7 text-amber-300 mb-3" />
            <div className="text-[10px] uppercase tracking-widest text-amber-300">
              Crewmate Lock-Up
            </div>
            <div className="text-3xl font-black text-white mt-1">
              {constants?.crewmate_lockup_months ?? 12} months
            </div>
            <p className="text-xs text-white/60 mt-2 leading-relaxed">
              All Crewmate chairs are locked for {constants?.crewmate_lockup_months ?? 12}{" "}
              months before internal-market trade. Skin-in-the-game built into the protocol.
            </p>
          </div>
          <div className="rounded-2xl border-2 border-emerald-400/30 bg-gradient-to-br from-emerald-950/30 via-black/60 to-cyan-950/30 p-5">
            <Megaphone className="w-7 h-7 text-emerald-300 mb-3" />
            <div className="text-[10px] uppercase tracking-widest text-emerald-300">
              Platform Buy-Back Floor
            </div>
            <div className="text-3xl font-black text-white mt-1">
              {fmtUSD(constants?.platform_buyback_floor_usd ?? 20, 0)}
            </div>
            <p className="text-xs text-white/60 mt-2 leading-relaxed">
              Guaranteed buy-back from the House Treasury protects Genius-Phase{" "}
              <span className="text-emerald-300 font-bold">Walking Advertisements</span>{" "}
              cohort. Permanent Founder badge on DSG TV avatar.
            </p>
          </div>
        </section>

        {/* Live calculator */}
        <section>
          <h2 className="text-lg font-bold uppercase tracking-[0.3em] text-white/80 mb-4">
            📊 Live Dividend Calculator
          </h2>
          <div className="rounded-2xl border-2 border-amber-300/30 bg-gradient-to-br from-amber-950/30 via-black/60 to-fuchsia-950/30 p-6">
            <div className="flex flex-col md:flex-row md:items-end gap-4 mb-6">
              <div className="flex-1">
                <label
                  htmlFor="gross-input"
                  className="text-[10px] uppercase tracking-widest text-amber-300/80 block mb-2"
                >
                  Monthly Gross Revenue (USD)
                </label>
                <input
                  id="gross-input"
                  data-testid="equity-gross-input"
                  type="number"
                  min={0}
                  step={100_000}
                  value={grossInput}
                  onChange={(e) => setGrossInput(Number(e.target.value) || 0)}
                  className="w-full px-4 py-3 rounded-xl bg-black/50 border border-white/10 text-white text-xl font-bold focus:border-amber-300/50 focus:outline-none"
                />
              </div>
              <button
                type="button"
                data-testid="equity-recalc-btn"
                onClick={() => recalc(grossInput)}
                disabled={calculating}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-amber-400 to-fuchsia-500 hover:opacity-90 text-black font-black uppercase tracking-widest text-sm disabled:opacity-50"
              >
                {calculating ? "Calculating…" : "Recalculate"}
              </button>
            </div>

            {dividend && (
              <div
                data-testid="equity-calc-results"
                className={`grid grid-cols-2 md:grid-cols-4 gap-3`}
              >
                <CalcCell
                  label="Pool / month"
                  value={fmtUSD(dividend.monthly_gross_usd * 0.3, 0)}
                  hint="30% of gross"
                />
                <CalcCell
                  label="Monthly / chair"
                  value={fmtUSD(dividend.monthly_dividend_per_chair_usd, 4)}
                  hint="per 1 chair"
                />
                <CalcCell
                  label="Annual / chair"
                  value={fmtUSD(dividend.annual_dividend_per_chair_usd, 2)}
                  hint="12 × monthly"
                />
                <CalcCell
                  label="Chair Price"
                  value={fmtUSD(dividend.effective_price_usd, 2)}
                  hint={`${dividend.floor_phase} phase`}
                  highlight
                  phaseColor={phaseColor}
                />
              </div>
            )}

            <p className="mt-5 text-[11px] text-white/40 leading-relaxed">
              Formula: <span className="text-amber-300/80">price = annual_dividend / 0.10</span>{" "}
              (10% yield basis). Quarterly payouts. Choose SOL/USDC or $VIBEZ (+5% bonus).
            </p>
          </div>
        </section>

        {/* Revenue sources */}
        <section>
          <h2 className="text-lg font-bold uppercase tracking-[0.3em] text-white/80 mb-4">
            🏛 Revenue Categories Feeding the Pool
          </h2>
          <div className="flex flex-wrap gap-2">
            {(constants?.revenue_categories ?? [
              "casino",
              "ridez",
              "tv_ads",
              "yellow_pages",
            ]).map((c) => (
              <span
                key={c}
                data-testid={`revenue-category-${c}`}
                className="px-4 py-2 rounded-full bg-white/5 border border-fuchsia-400/30 text-fuchsia-200 text-xs uppercase tracking-widest"
              >
                {c.replace("_", " ")}
              </span>
            ))}
          </div>
          <p className="mt-4 text-xs text-white/50 max-w-2xl">
            Every dollar of gross revenue from these 4 streams contributes to the
            ownership pool. The pool pays out quarterly to chair holders.
          </p>
        </section>

        {/* Footer note */}
        <footer className="text-center text-[10px] uppercase tracking-[0.3em] text-white/30 pt-6 border-t border-white/5">
          <TrendingUp className="w-3 h-3 inline-block mr-1" />
          Numbers locked at boot via{" "}
          <span className="text-fuchsia-300/70">routes/equity_master.py</span> ·{" "}
          server refuses to start on drift.
        </footer>
      </main>
    </div>
  );
}

function CalcCell({
  label,
  value,
  hint,
  highlight,
  phaseColor,
}: {
  label: string;
  value: string;
  hint: string;
  highlight?: boolean;
  phaseColor?: string;
}) {
  return (
    <div
      className={`rounded-xl p-4 ${
        highlight
          ? "border-2 border-amber-300/40 bg-black/60"
          : "border border-white/10 bg-black/30"
      }`}
    >
      <div className="text-[10px] uppercase tracking-widest text-white/40">
        {label}
      </div>
      <div
        className={`text-xl font-black mt-1 ${
          highlight && phaseColor
            ? `bg-gradient-to-r ${phaseColor} bg-clip-text text-transparent`
            : "text-white"
        }`}
      >
        {value}
      </div>
      <div className="text-[10px] text-fuchsia-300/60 mt-0.5">{hint}</div>
    </div>
  );
}
