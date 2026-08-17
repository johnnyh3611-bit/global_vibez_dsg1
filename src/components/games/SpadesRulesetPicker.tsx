/**
 * SpadesRulesetPicker — controlled 2-tile selector for the Spades ruleset.
 *
 * Reads /api/spades/rulesets on mount so the data is always live (server
 * is the source of truth on house-cut, deck size, promoted-trump list).
 * Renders a glassmorphism toggle: Classic vs Big Wheel.
 *
 *   <SpadesRulesetPicker
 *     value={ruleset}
 *     onChange={setRuleset}
 *   />
 *
 * The parent passes the chosen ruleset id ("CLASSIC" / "BIG_WHEEL") into
 * its create-table call: `body: { ..., ruleset: chosenRuleset }`.
 */
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, Spade, Crown, Diamond } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

type Ruleset = {
  id: string;
  label: string;
  deck_size: number;
  house_cut_pct: number;
  has_jokers: boolean;
  promoted_trumps: string[];
};

const PROMOTED_GLYPH: Record<string, { icon: React.ReactNode; label: string }> = {
  BIG_JOKER:    { icon: <Crown className="w-3.5 h-3.5" />, label: "Big Joker" },
  LITTLE_JOKER: { icon: <Crown className="w-3 h-3 opacity-70" />, label: "Little Joker" },
  "2_SPADES":   { icon: <Spade className="w-3.5 h-3.5" />, label: "2♠" },
  "2_DIAMONDS": { icon: <Diamond className="w-3.5 h-3.5" />, label: "2♦" },
};

export default function SpadesRulesetPicker({
  value,
  onChange,
  disabled = false,
}: {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
}) {
  const [rulesets, setRulesets] = useState<Ruleset[] | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`${API}/api/spades/rulesets`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((d) => {
        if (alive) setRulesets(d.rulesets || []);
      })
      .catch(() => {
        /* silent — picker stays empty, parent can supply a sensible default */
      });
    return () => {
      alive = false;
    };
  }, []);

  if (!rulesets) {
    return (
      <div
        className="rounded-xl border border-white/10 bg-black/40 p-4 text-slate-400 text-xs"
        data-testid="spades-ruleset-picker-loading"
      >
        Loading rulesets…
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-2xl p-4"
      data-testid="spades-ruleset-picker"
    >
      <div className="flex items-center gap-2 mb-3">
        <Spade className="w-4 h-4 text-cyan-300" />
        <h3 className="text-[12px] uppercase tracking-widest text-cyan-300 font-bold">
          Table Ruleset
        </h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {rulesets.map((rs) => {
          const active = value === rs.id;
          const isBigWheel = rs.id === "BIG_WHEEL";
          return (
            <motion.button
              key={rs.id}
              type="button"
              disabled={disabled}
              onClick={() => onChange(rs.id)}
              data-testid={`spades-ruleset-${rs.id.toLowerCase()}`}
              whileHover={!disabled ? { y: -2 } : {}}
              whileTap={!disabled ? { scale: 0.98 } : {}}
              className={`relative text-left rounded-xl p-4 transition border-2 ${
                active
                  ? isBigWheel
                    ? "border-amber-300 bg-amber-500/[0.08] shadow-[0_0_22px_rgba(252,211,77,0.45)]"
                    : "border-cyan-300 bg-cyan-500/[0.08] shadow-[0_0_22px_rgba(34,211,238,0.4)]"
                  : "border-white/10 bg-black/30 hover:border-white/30"
              } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {isBigWheel ? (
                    <Sparkles className="w-4 h-4 text-amber-300" />
                  ) : (
                    <Spade className="w-4 h-4 text-cyan-300" />
                  )}
                  <span
                    className={`font-black uppercase tracking-widest text-sm ${
                      active
                        ? isBigWheel
                          ? "text-amber-200"
                          : "text-cyan-100"
                        : "text-slate-200"
                    }`}
                  >
                    {rs.label}
                  </span>
                </div>
                <span
                  className={`text-[9px] uppercase tracking-widest font-black px-2 py-0.5 rounded-full ${
                    isBigWheel
                      ? "bg-amber-500/20 text-amber-200"
                      : "bg-cyan-500/15 text-cyan-200"
                  }`}
                >
                  {rs.house_cut_pct}% rake
                </span>
              </div>

              <p className="text-[11px] text-slate-300 leading-snug">
                {rs.deck_size}-card deck
                {rs.has_jokers ? " · Jokers in play" : " · standard"}
              </p>

              {rs.promoted_trumps.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 mt-3">
                  <span className="text-[9px] uppercase tracking-widest text-amber-200/70">
                    Top trumps:
                  </span>
                  {rs.promoted_trumps.map((t) => {
                    const g = PROMOTED_GLYPH[t];
                    return (
                      <span
                        key={t}
                        className="inline-flex items-center gap-1 text-[10px] text-amber-100 bg-amber-500/15 border border-amber-300/30 rounded-md px-1.5 py-0.5"
                      >
                        {g?.icon}
                        {g?.label || t}
                      </span>
                    );
                  })}
                </div>
              )}

              {isBigWheel && (
                <p className="text-[10px] text-amber-200/80 mt-3 italic leading-snug">
                  Higher variance · 2 extra trump cards · 2 % bigger rake.
                </p>
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
