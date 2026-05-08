/**
 * ChairExpansionPlan — public-facing roadmap for the 3-tier supply ladder.
 * Compressed from the legacy 10-tier PDF to the final 3-tier shape the
 * Founder confirmed 2026-05-04: Genius $20 × 50K → Genesis $100 × 100K →
 * Apex $250 × 50K. 200K active circulation + 800K reserve vault (the
 * reserve unlocks + the 200M DSG Founder Vault begins a 12-month drip
 * the moment chair #50,000 sells).
 *
 * Pulls live `/api/chairs/expansion-plan` so the "current tier"
 * highlight always reflects the on-platform sold count.
 */
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Crown,
  Lock,
  TrendingUp,
  Sparkles,
  Info,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

type Tier = {
  order: number;
  name: string;
  low: number;
  high: number;
  price_usd: number;
  supply: number;
  potential_revenue_usd: number;
  status: "active" | "completed" | "future";
};

type ExpansionPlan = {
  tiers: Tier[];
  active_circulation: number;
  reserve_vault_locked: number;
  total_ecosystem_capacity: number;
  genesis_floor_multiplier: number;
  reserve_unlock_gate: string;
  total_potential_revenue_usd: number;
  current_tier_order: number | null;
  active_chairs_sold: number;
};

function fmtUsd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function fmtNum(n: number): string {
  return n.toLocaleString("en-US");
}

export default function ChairExpansionPlan() {
  const [plan, setPlan] = useState<ExpansionPlan | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch(`${API}/api/chairs/expansion-plan`);
        if (r.ok) setPlan(await r.json());
      } catch {
        /* silent — section just renders without live data */
      }
    };
    load();
  }, []);

  if (!plan) return null;

  // 3-tier compressed ladder — show Genius + Genesis publicly; hide Apex
  // (tier 3) behind the Welcome Letter's narrative reveal so visitors get
  // a friendlier arc rather than seeing the $250 ceiling upfront.
  const visibleTiers = plan.tiers.filter((t) => t.order < 3);

  return (
    <section
      className="bg-black py-16 px-6 border-t border-neutral-900"
      data-testid="chair-expansion-section"
    >
      <div className="max-w-4xl mx-auto">
        {/* Collapsible disclosure box */}
        <div
          className="rounded-2xl border border-amber-500/30 bg-amber-950/10 overflow-hidden"
          data-testid="founders-info-box"
        >
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="w-full flex items-center justify-between gap-4 p-5 text-left hover:bg-amber-950/20 transition"
            aria-expanded={open}
            data-testid="founders-info-toggle"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl border border-amber-500/40 bg-amber-500/10 flex items-center justify-center">
                <Info className="w-5 h-5 text-amber-300" />
              </div>
              <div>
                <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-amber-400">
                  Click to expand
                </p>
                <h2 className="text-xl sm:text-2xl font-black italic text-white uppercase tracking-tighter mt-0.5">
                  Important Information for Founders
                </h2>
                <p className="text-xs text-neutral-400 mt-1">
                  Supply curve, pricing tiers, and Reserve Vault mechanics
                </p>
              </div>
            </div>
            {open ? (
              <ChevronUp className="w-6 h-6 text-amber-300 flex-shrink-0" />
            ) : (
              <ChevronDown className="w-6 h-6 text-amber-300 flex-shrink-0" />
            )}
          </button>

          <AnimatePresence initial={false}>
            {open && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="border-t border-amber-500/20"
                data-testid="founders-info-content"
              >
                <div className="p-6 space-y-8">
                  <p className="text-sm text-neutral-300 leading-relaxed">
                    The Vibez chair economy follows a transparent, supply-locked
                    expansion curve. The pricing ramps deliberately to reward
                    early believers — Genius buyers carry the highest
                    earn-rate weight (3×) for life, locked at purchase.
                  </p>

                  {/* Top-line stats */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Stat
                      label="Total Capacity"
                      value={fmtNum(plan.total_ecosystem_capacity)}
                      sub="chairs"
                      Icon={Crown}
                      tone="amber"
                      testId="chair-stat-capacity"
                    />
                    <Stat
                      label="Active Circulation"
                      value={fmtNum(plan.active_circulation)}
                      sub="500K available"
                      Icon={Sparkles}
                      tone="emerald"
                      testId="chair-stat-active"
                    />
                    <Stat
                      label="Reserve Vault"
                      value={fmtNum(plan.reserve_vault_locked)}
                      sub="locked until milestone"
                      Icon={Lock}
                      tone="slate"
                      testId="chair-stat-reserve"
                    />
                    <Stat
                      label="Genius Multiplier"
                      value="3×"
                      sub="locked at buy time"
                      Icon={TrendingUp}
                      tone="fuchsia"
                      testId="chair-stat-multiplier"
                    />
                  </div>

                  {/* Tier ladder (Apex hidden — revealed in Welcome Letter) */}
                  <ol className="space-y-2" data-testid="chair-tier-ladder">
                    {visibleTiers.map((t, idx) => {
                      const isCurrent = t.order === plan.current_tier_order;
                      const tone =
                        t.status === "completed"
                          ? "border-emerald-500/40 bg-emerald-950/20"
                          : isCurrent
                            ? "border-fuchsia-500/60 bg-fuchsia-950/20 shadow-lg shadow-fuchsia-500/10"
                            : "border-slate-800 bg-slate-950/40";
                      return (
                        <motion.li
                          key={t.order}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.04 }}
                          className={`relative grid grid-cols-12 gap-3 items-center rounded-xl border p-4 ${tone}`}
                          data-testid={`chair-tier-${t.order}`}
                        >
                          <div className="col-span-1 text-center">
                            <div className="text-2xl font-black text-white/90 font-mono leading-none">
                              {String(t.order).padStart(2, "0")}
                            </div>
                          </div>
                          <div className="col-span-5 sm:col-span-4">
                            <p className="text-xs font-mono uppercase tracking-widest text-neutral-500">
                              {t.status === "active" && "🔵 Now Selling"}
                              {t.status === "completed" && "✅ Sold Out"}
                              {t.status === "future" && "⏳ Upcoming"}
                            </p>
                            <h3 className="text-base sm:text-lg font-bold text-white mt-0.5">
                              {t.name}
                            </h3>
                          </div>
                          <div className="col-span-3 sm:col-span-3">
                            <p className="text-[10px] uppercase tracking-wider text-neutral-500">
                              Range
                            </p>
                            <p className="text-xs font-mono text-cyan-300">
                              {fmtNum(t.low)} – {fmtNum(t.high)}
                            </p>
                          </div>
                          <div className="col-span-3 sm:col-span-2 text-right">
                            <p className="text-[10px] uppercase tracking-wider text-neutral-500">
                              Price
                            </p>
                            <p className="text-xl font-black text-white font-mono">
                              ${t.price_usd}
                            </p>
                          </div>
                          <div className="hidden sm:block col-span-2 text-right">
                            <p className="text-[10px] uppercase tracking-wider text-neutral-500">
                              Tier Cap
                            </p>
                            <p className="text-xs font-mono text-emerald-300">
                              {fmtUsd(t.potential_revenue_usd)}
                            </p>
                          </div>
                        </motion.li>
                      );
                    })}
                  </ol>

                  {/* Apex teaser — pointer to Welcome Letter */}
                  <div
                    className="rounded-xl border border-violet-500/30 bg-violet-950/20 p-4 text-sm text-violet-100"
                    data-testid="apex-teaser"
                  >
                    🔒 The final tier (<strong>Apex</strong>) is
                    intentionally not shown here. See the Founders Letter
                    above for the ceiling reveal — we share it once, quietly,
                    so visitors aren't hit with a "max price" upfront.
                  </div>

                  {/* Reserve vault explainer */}
                  <div
                    className="rounded-xl border border-amber-700/40 bg-amber-950/20 p-5"
                    data-testid="reserve-vault-block"
                  >
                    <div className="flex items-start gap-3">
                      <Lock className="w-5 h-5 text-amber-300 mt-0.5 flex-shrink-0" />
                      <div>
                        <h3 className="text-amber-200 font-bold uppercase tracking-wider text-sm">
                          Reserve Vault — {fmtNum(plan.reserve_vault_locked)} Chairs Locked
                        </h3>
                        <p className="text-xs text-amber-100/80 mt-2 leading-relaxed">
                          Half of total chair supply is programmatically locked
                          and only releases when the platform reaches{" "}
                          <strong className="text-amber-200">
                            {plan.reserve_unlock_gate}
                          </strong>
                          . This protects the floor for early holders by
                          guaranteeing supply can't be flooded mid-cycle. When
                          unlocked, vault chairs are issued through
                          community-voted distribution events — never
                          bulk-sold.
                        </p>
                      </div>
                    </div>
                  </div>

                  <p
                    className="text-center text-[10px] font-mono uppercase tracking-[0.3em] text-neutral-600"
                    data-testid="chair-expansion-disclaimer"
                  >
                    Live data · /api/chairs/expansion-plan · Apex price hidden by design
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  sub,
  Icon,
  tone,
  testId,
}: {
  label: string;
  value: string;
  sub: string;
  Icon: typeof Crown;
  tone: "emerald" | "amber" | "slate" | "fuchsia";
  testId: string;
}) {
  const palette: Record<typeof tone, string> = {
    emerald: "border-emerald-500/30 bg-emerald-950/20 text-emerald-300",
    amber: "border-amber-500/30 bg-amber-950/20 text-amber-300",
    slate: "border-slate-700 bg-slate-900/40 text-slate-300",
    fuchsia: "border-fuchsia-500/30 bg-fuchsia-950/20 text-fuchsia-300",
  };
  return (
    <div
      className={`rounded-2xl border p-4 ${palette[tone]}`}
      data-testid={testId}
    >
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-widest opacity-70">
          {label}
        </p>
        <Icon className="w-4 h-4 opacity-60" />
      </div>
      <p className="text-2xl font-black mt-1 font-mono text-white">{value}</p>
      <p className="text-[10px] opacity-60 mt-1">{sub}</p>
    </div>
  );
}
