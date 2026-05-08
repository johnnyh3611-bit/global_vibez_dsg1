/**
 * Phase progress bar + scarcity counter.
 *
 * Shows the current phase, its price, remaining seats, and a visual
 * progress bar. Drives FOMO without implying capital appreciation —
 * we say "early-bird seats remaining" not "price will go up so buy now".
 */
import { Lock } from "lucide-react";

type Phase = {
  phase: string;
  price_usd: number | null;
  weight?: number | null;
  in_phase_capacity?: number;
  in_phase_sold?: number;
  remaining_in_phase?: number;
  tagline?: string;
  total_sold?: number;
};

// "Next phase" pricing hint shown on the progress bar (e.g. "Next:
// Genesis @ $15"). Aligned with the backend PHASES list in
// routes/chairs.py — kept in sync manually since this is a tiny,
// rarely-changing config and avoids a network call just to render
// a footer line.
const NEXT_PHASE_PRICE: Record<string, number> = {
  Genius: 15,
  Genesis: 20,
  "Phase III": 25,
  "Phase IV": 30,
  "Phase V": 0, // Phase V is the last buyable phase in the legacy engine
  // — Phase X / Apex is the public ceiling, revealed via the Welcome
  // Letter rather than the next-phase hint.
};

const NEXT_PHASE_WEIGHT: Record<string, number> = {
  Genius: 2.0,
  Genesis: 1.5,
  "Phase III": 1.25,
  "Phase IV": 1.0,
  "Phase V": 1.0,
};

export default function PhaseProgress({ phase }: { phase: Phase }) {
  if (phase.phase === "Sold Out" || phase.price_usd === null) {
    return (
      <div className="rounded-2xl border border-rose-400/40 bg-rose-500/10 p-5 flex items-center gap-3">
        <Lock className="w-5 h-5 text-rose-300" />
        <div>
          <p className="text-[10px] uppercase tracking-widest text-rose-300 font-bold">
            Sold out
          </p>
          <p className="text-base font-black text-white">
            All 60,000 Founder Chairs claimed.
          </p>
        </div>
      </div>
    );
  }

  const cap = Math.max(1, phase.in_phase_capacity ?? 1);
  const sold = phase.in_phase_sold ?? 0;
  const pct = Math.min(100, Math.round((sold / cap) * 100));
  const nextPrice = NEXT_PHASE_PRICE[phase.phase] ?? 0;
  const nextWeight = NEXT_PHASE_WEIGHT[phase.phase] ?? 1.0;
  const weight = phase.weight ?? 1.0;

  return (
    <div
      className="rounded-2xl border border-cyan-400/30 bg-gradient-to-r from-cyan-500/10 via-amber-500/5 to-fuchsia-500/10 backdrop-blur-xl p-5"
      data-testid="phase-progress"
    >
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-[10px] uppercase tracking-widest text-amber-300 font-bold">
              Current phase · {phase.phase}
            </p>
            {weight > 1 && (
              <span
                data-testid="phase-multiplier-badge"
                className={`text-[10px] uppercase tracking-widest font-black px-2 py-0.5 rounded-full ${
                  weight >= 3
                    ? "bg-amber-400 text-black"
                    : "bg-fuchsia-400 text-black"
                }`}
              >
                {weight}× earn rate
              </span>
            )}
          </div>
          <p className="text-3xl sm:text-4xl font-black text-white mt-1">
            ${phase.price_usd?.toFixed(2)}
            <span className="text-sm text-cyan-300 font-normal ml-1">/ chair</span>
          </p>
          {phase.tagline && (
            <p className="text-[12px] text-cyan-300/70 italic mt-1">{phase.tagline}</p>
          )}
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-widest text-cyan-500">
            Seats remaining in phase
          </p>
          <p
            className="text-2xl font-black text-cyan-200"
            data-testid="phase-remaining"
          >
            {(phase.remaining_in_phase ?? 0).toLocaleString()}
            <span className="text-xs text-cyan-500 font-normal">
              {" / "}
              {cap.toLocaleString()}
            </span>
          </p>
        </div>
      </div>

      <div className="mt-4 h-2 rounded-full bg-white/5 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-amber-400 via-rose-400 to-fuchsia-400 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>

      {nextPrice > 0 && (
        <p className="mt-3 text-[11px] text-cyan-500/80 leading-relaxed">
          Once this phase fills, the next batch goes to{" "}
          <span className="text-amber-300 font-bold">${nextPrice.toFixed(2)}/chair</span>
          {weight > nextWeight && (
            <>
              {" "}with the multiplier dropping to{" "}
              <span className="text-rose-300 font-bold">{nextWeight}×</span>
            </>
          )}
          . Your purchase weight is locked the moment you buy.
        </p>
      )}
    </div>
  );
}
