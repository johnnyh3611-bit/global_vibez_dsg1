/**
 * BidWhistKittyModal — Discard 6 + confirm trump selection after winning the bid.
 *
 * Unique to Bid Whist. After winning the auction, the winner receives
 * the 6-card kitty (so they have 12 cards total) and must discard 6
 * back down to 6 before play begins. They also confirm their trump
 * suit + direction (pre-selected from their winning bid — they can
 * still change it if they want).
 *
 * UI pattern:
 *   • Shows the winner's full 12-card hand + a "To Discard" tray
 *   • Click a card to toggle into/out of the discard tray (max 6)
 *   • Footer with winning bid summary + "Confirm & Play" CTA when 6
 *     cards are staged
 */
import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, X } from "lucide-react";
import SpadesCard from "@/components/spades/SpadesCard";
import type { SpadesCard as CardData } from "@/components/spades/types";

export interface KittySubmit {
  discarded_cards: CardData[];
  trump_suit: string;
}

interface Props {
  open: boolean;
  hand: CardData[];          // 12 cards (6 original + 6 kitty)
  initialTrump?: string;     // from winning bid
  winningBidLabel?: string;  // e.g., "4 Uptown ♠"
  onSubmit: (submission: KittySubmit) => void;
  busy: boolean;
}

export const BidWhistKittyModal: React.FC<Props> = ({
  open,
  hand,
  initialTrump = "spades",
  winningBidLabel,
  onSubmit,
  busy,
}) => {
  const [discarded, setDiscarded] = useState<string[]>([]);

  // Unique key for each card (stable across re-renders).
  const key = (c: CardData) => `${c.suit}-${c.rank}`;

  const handMap = useMemo(
    () => Object.fromEntries(hand.map((c) => [key(c), c] as const)),
    [hand],
  );

  const toggle = (c: CardData) => {
    const k = key(c);
    setDiscarded((prev) => {
      if (prev.includes(k)) return prev.filter((p) => p !== k);
      if (prev.length >= 6) return prev; // cap at 6
      return [...prev, k];
    });
  };

  const discardedCards = discarded
    .map((k) => handMap[k])
    .filter(Boolean) as CardData[];

  const handleConfirm = () => {
    if (discardedCards.length !== 6 || busy) return;
    onSubmit({
      discarded_cards: discardedCards,
      trump_suit: initialTrump,
    });
  };

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[72] bg-black/80 backdrop-blur-md flex items-center justify-center p-3 md:p-4"
          data-testid="bidwhist-kitty-modal"
        >
          <motion.div
            initial={{ scale: 0.88, y: 24, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ duration: 0.35 }}
            className="relative w-full max-w-4xl mx-auto p-1"
          >
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-amber-500/30 via-emerald-500/20 to-cyan-500/20 blur-3xl animate-pulse" />
            <div className="relative bg-gradient-to-br from-slate-900/95 via-[#0a1a12] to-slate-900/95 backdrop-blur-xl rounded-2xl border-2 border-amber-500/50 shadow-[0_0_60px_rgba(251,191,36,0.3)] p-4 md:p-6">
              {/* Title */}
              <div className="text-center mb-4">
                <Sparkles className="w-8 h-8 text-amber-300 mx-auto mb-1" />
                <p className="text-[10px] uppercase tracking-[0.3em] text-amber-300/80 font-bold">
                  You Won the Bid
                </p>
                <h2
                  className="text-2xl md:text-3xl font-black text-white"
                  style={{ fontFamily: "'Cinzel', serif" }}
                >
                  Pick the Kitty
                </h2>
                {winningBidLabel ? (
                  <p className="text-sm text-amber-200/80 mt-1">
                    Contract: <strong>{winningBidLabel}</strong>
                  </p>
                ) : null}
              </div>

              {/* To-Discard tray */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] uppercase tracking-widest text-amber-300/70 font-bold">
                    Discard ({discardedCards.length}/6)
                  </span>
                  {discardedCards.length > 0 ? (
                    <button
                      onClick={() => setDiscarded([])}
                      className="text-[9px] uppercase tracking-wider text-rose-300/70 hover:text-rose-200"
                    >
                      Clear
                    </button>
                  ) : null}
                </div>
                <div className="min-h-[104px] rounded-lg border-2 border-dashed border-amber-500/25 bg-slate-950/40 p-2 flex items-center gap-1 flex-wrap">
                  {discardedCards.length === 0 ? (
                    <p className="text-xs text-amber-300/40 italic mx-auto">
                      Tap 6 cards below to discard them
                    </p>
                  ) : (
                    discardedCards.map((c) => (
                      <button
                        key={key(c)}
                        onClick={() => toggle(c)}
                        className="relative"
                      >
                        <SpadesCard card={c} size="sm" isPlayable={false} />
                        <span className="absolute top-0 right-0 bg-rose-500 rounded-full w-4 h-4 flex items-center justify-center">
                          <X className="w-2.5 h-2.5 text-white" />
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Hand grid */}
              <div className="flex gap-1 flex-wrap justify-center p-2 bg-emerald-900/20 rounded-xl border border-amber-500/15">
                {hand.map((c) => {
                  const isDiscarded = discarded.includes(key(c));
                  return (
                    <SpadesCard
                      key={key(c)}
                      card={c}
                      size="md"
                      isDimmed={isDiscarded}
                      onClick={() => toggle(c)}
                    />
                  );
                })}
              </div>

              {/* CTA */}
              <button
                onClick={handleConfirm}
                disabled={discardedCards.length !== 6 || busy}
                className="mt-5 w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-500 hover:from-amber-400 hover:to-yellow-400 text-[#3a2500] font-black uppercase tracking-widest text-sm shadow-[0_0_24px_rgba(251,191,36,0.5)] disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ fontFamily: "'Cinzel', serif" }}
                data-testid="bidwhist-kitty-confirm"
              >
                {busy
                  ? "Submitting…"
                  : discardedCards.length === 6
                    ? "Confirm & Start Play"
                    : `Select ${6 - discardedCards.length} more to discard`}
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
};

export default BidWhistKittyModal;
