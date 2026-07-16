import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Calculator } from "lucide-react";
import {
  estimateChairRoi,
  useChairEconomics,
} from "@/hooks/useChairEconomics";
import { triggerHaptic } from "@/hooks/useGestures";

function fmtUsd(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (Math.abs(n) >= 1000) return `$${(n / 1000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

/** Compact "if I buy N chairs…" estimator for /earn (live economics). */
export function ChairRoiCalculator() {
  const { econ, loading, error } = useChairEconomics();
  const [chairs, setChairs] = useState(1);
  const [tierName, setTierName] = useState("Genius");

  const estimate = useMemo(() => {
    if (!econ) return null;
    return estimateChairRoi(econ, { chairs, tierName });
  }, [econ, chairs, tierName]);

  if (loading) {
    return (
      <div
        className="rounded-2xl border border-amber-400/20 bg-amber-500/5 p-5 text-sm text-white/50"
        data-testid="chair-roi-calculator"
      >
        Loading live chair economics…
      </div>
    );
  }

  if (error || !econ || !estimate) {
    return (
      <div
        className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-sm text-white/60"
        data-testid="chair-roi-calculator"
      >
        Chair calculator unavailable right now.{" "}
        <Link to="/how-chairs-work" className="text-amber-300 underline">
          Open full guide
        </Link>
      </div>
    );
  }

  const tiers = econ.tiers.map((t) => t.name);

  return (
    <section
      className="rounded-2xl border border-amber-400/30 bg-gradient-to-br from-amber-500/10 to-yellow-500/5 p-5"
      data-testid="chair-roi-calculator"
      aria-label="Chair earnings calculator"
    >
      <div className="mb-4 flex items-start gap-3">
        <Calculator className="mt-0.5 h-5 w-5 text-amber-300" />
        <div>
          <h2 className="text-lg font-bold text-white">
            If I buy a chair, what do I earn?
          </h2>
          <p className="mt-1 text-xs text-white/55">
            Live pool math from the platform · assumes $50K quarterly revenue and
            ~10K chairs in the market.
          </p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {tiers.slice(0, 5).map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => {
              triggerHaptic("light");
              setTierName(name);
            }}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
              tierName === name
                ? "bg-amber-400 text-black"
                : "border border-white/15 text-white/70 hover:bg-white/5"
            }`}
          >
            {name}
          </button>
        ))}
      </div>

      <label className="mb-4 block text-xs text-white/60">
        Chairs: <span className="font-bold text-amber-200">{chairs}</span>
        <input
          type="range"
          min={1}
          max={10}
          value={chairs}
          onChange={(e) => setChairs(Number(e.target.value))}
          className="mt-2 w-full accent-amber-400"
        />
      </label>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Cost" value={fmtUsd(estimate.totalCost)} />
        <Stat label="Est. / month" value={fmtUsd(estimate.monthlyUsd)} highlight />
        <Stat label="Est. / quarter" value={fmtUsd(estimate.quarterlyUsd)} />
        <Stat
          label="Break-even"
          value={
            Number.isFinite(estimate.breakevenQuarters)
              ? `${estimate.breakevenQuarters.toFixed(1)} qtrs`
              : "—"
          }
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-3 text-sm">
        <Link
          to="/chair-vault"
          onClick={() => triggerHaptic("medium")}
          className="rounded-full bg-amber-400 px-4 py-2 font-semibold text-black hover:bg-amber-300"
        >
          Buy in Chair Vault
        </Link>
        <Link
          to="/how-chairs-work"
          className="rounded-full border border-white/15 px-4 py-2 text-white/80 hover:bg-white/5"
        >
          Full calculator
        </Link>
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-white/45">{label}</p>
      <p
        className={`mt-1 text-base font-bold ${
          highlight ? "text-emerald-300" : "text-white"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
