/**
 * SpadesBidWheel — Bid input for the South seat.
 *
 * Touch-friendly: 0–13 + Nil (== bid 0 with intent) + Blind (in Big Wheel
 * a "Blind 6" hits before you've seen your full hand). For the AI mode,
 * we map a tap to a numeric bid and let the bidding-phase auto-advance
 * to the next bot.
 *
 * The wheel uses a horizontally-scrollable chip strip on mobile and a
 * pill grid on desktop.
 */
import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { Coins } from "lucide-react";
import type { SpadesCard, SpadesRuleset } from "./types";

interface Props {
  ruleset?: SpadesRuleset;
  hand: SpadesCard[];
  onBid: (bid: number) => void;
  busy: boolean;
}

export const SpadesBidWheel: React.FC<Props> = ({ ruleset, hand, onBid, busy }) => {
  // Tiny suggestion based on AI heuristic — same logic the backend uses.
  const suggested = useMemo(() => {
    let bid = 0;
    const spades = hand.filter((c) => c.suit === "spades");
    const highSpades = spades.filter((c) =>
      ["A", "K", "Q"].includes(c.rank),
    );
    bid += highSpades.length;
    for (const suit of ["hearts", "diamonds", "clubs"] as const) {
      const cards = hand.filter((c) => c.suit === suit);
      if (cards.length === 0) continue;
      const top = cards.reduce((a, b) => (a.value > b.value ? a : b));
      if (top.rank === "A") bid += 1;
    }
    if (spades.length >= 5) bid += 1;
    // Promoted trumps in Big Wheel are essentially auto-tricks.
    bid += hand.filter((c) => c.promoted).length;
    return Math.max(1, Math.min(bid, 13));
  }, [hand]);

  return (
    <div
      className="mt-6 p-4 rounded-2xl bg-[#0a1530]/80 backdrop-blur border border-cyan-400/30"
      data-testid="spades-bid-wheel"
    >
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-cyan-400/80">
            Place your bid
          </p>
          <p className="text-xs text-purple-200/70 mt-0.5">
            Tricks you think you can win this hand · Nil = 0 with bonus risk
          </p>
        </div>
        <div className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-cyan-500/15 border border-cyan-400/40">
          <Coins className="w-3 h-3 text-cyan-300" />
          <span className="text-[10px] uppercase tracking-wider text-cyan-200">
            Suggested
          </span>
          <span
            className="text-sm font-black text-white"
            data-testid="spades-bid-suggested"
          >
            {suggested}
          </span>
        </div>
      </div>

      {/* Bid chips: Nil + 1–13 (mobile = horizontal scroll, desktop = grid) */}
      <div
        className="flex gap-2 overflow-x-auto pb-1 md:grid md:grid-cols-7 md:overflow-visible"
        data-testid="spades-bid-chip-row"
      >
        <BidChip
          label="Nil"
          subLabel="0"
          variant="amber"
          onClick={() => onBid(0)}
          disabled={busy}
          testid="spades-bid-nil"
        />
        {Array.from({ length: 13 }, (_, i) => i + 1).map((n) => (
          <BidChip
            key={n}
            label={String(n)}
            variant={n === suggested ? "cyan-suggest" : "cyan"}
            onClick={() => onBid(n)}
            disabled={busy}
            testid={`spades-bid-${n}`}
          />
        ))}
      </div>

      {ruleset === "BIG_WHEEL" ? (
        <p className="mt-3 text-[10px] text-fuchsia-300/70 italic">
          Big Wheel · Jokers and 2♠ / 2♦ in your hand are <strong>guaranteed
          tricks</strong> — already factored into the suggested bid above.
        </p>
      ) : null}
    </div>
  );
};

const BidChip: React.FC<{
  label: string;
  subLabel?: string;
  variant: "cyan" | "amber" | "cyan-suggest";
  onClick: () => void;
  disabled: boolean;
  testid: string;
}> = ({ label, subLabel, variant, onClick, disabled, testid }) => {
  const base =
    "shrink-0 min-w-[48px] md:min-w-0 h-12 md:h-14 rounded-xl font-black text-base md:text-lg transition-all flex flex-col items-center justify-center";
  const tone =
    variant === "amber"
      ? "bg-amber-500/15 border border-amber-400/40 text-amber-200 hover:bg-amber-500/25"
      : variant === "cyan-suggest"
        ? "bg-cyan-400 text-[#04122e] border border-cyan-200 shadow-[0_0_18px_rgba(34,211,238,0.5)] hover:bg-cyan-300"
        : "bg-cyan-500/10 border border-cyan-400/30 text-cyan-100 hover:bg-cyan-500/25";
  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      disabled={disabled}
      data-testid={testid}
      className={`${base} ${tone} disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      <span>{label}</span>
      {subLabel ? (
        <span className="text-[8px] uppercase tracking-widest opacity-70">
          {subLabel}
        </span>
      ) : null}
    </motion.button>
  );
};

export default SpadesBidWheel;
