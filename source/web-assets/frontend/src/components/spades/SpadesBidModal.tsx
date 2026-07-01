/**
 * SpadesBidModal — Premium-style bid ring (matches BidWhistPremium).
 *
 * Visual parity with BidWhistPremium's BiddingRing:
 *   • Amber-purple glowing ring halo behind the modal
 *   • Cinzel imperial serif title + Zap icon
 *   • Countdown timer in the top-right: green > 10s, yellow > 5s,
 *     red + pulse animation when ≤ 5s
 *   • Circular bid-amount selector (big round buttons)
 *   • Nil toggle + amount row (4–13) for Spades (Spades bids differ from
 *     Bid Whist's 3–7 range, so we keep the broader chip grid)
 *   • Auto-submits the selected bid when the timer hits zero per the
 *     user's explicit request: "15 seconds to bid and then that should
 *     be it"
 */
import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Zap } from "lucide-react";
import type { SpadesCard, SpadesRuleset } from "./types";

interface Props {
  open: boolean;
  ruleset?: SpadesRuleset;
  hand: SpadesCard[];
  onBid: (bid: number) => void;
  busy: boolean;
}

const BID_AMOUNTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
const BID_TIMER_SECONDS = 15;

export const SpadesBidModal: React.FC<Props> = ({
  open,
  ruleset,
  hand,
  onBid,
  busy,
}) => {
  const [selected, setSelected] = useState<number>(4);
  const [nilSelected, setNilSelected] = useState(false);
  const [timeLeft, setTimeLeft] = useState(BID_TIMER_SECONDS);

  // AI-parity suggestion (same heuristic as the backend's bot bid).
  const suggested = useMemo(() => {
    let bid = 0;
    const spades = hand.filter((c) => c.suit === "spades");
    const highSpades = spades.filter((c) => ["A", "K", "Q"].includes(c.rank));
    bid += highSpades.length;
    for (const suit of ["hearts", "diamonds", "clubs"] as const) {
      const cards = hand.filter((c) => c.suit === suit);
      if (cards.length === 0) continue;
      const top = cards.reduce((a, b) => (a.value > b.value ? a : b));
      if (top.rank === "A") bid += 1;
    }
    if (spades.length >= 5) bid += 1;
    bid += hand.filter((c) => c.promoted).length;
    return Math.max(1, Math.min(bid, 13));
  }, [hand]);

  // Reset + auto-seed selected when the modal opens.
  useEffect(() => {
    if (!open) return;
    setSelected(suggested);
    setNilSelected(false);
    setTimeLeft(BID_TIMER_SECONDS);
  }, [open, suggested]);

  // Countdown timer — fires the suggested bid when it hits 0.
  useEffect(() => {
    if (!open) return;
    if (timeLeft <= 0) {
      // Auto-submit whatever's selected (default = suggested).
      if (!busy) onBid(nilSelected ? 0 : selected);
      return;
    }
    const t = window.setTimeout(() => setTimeLeft((v) => v - 1), 1000);
    return () => clearTimeout(t);
  }, [open, timeLeft, busy, onBid, selected, nilSelected]);

  const handlePlace = () => {
    if (busy) return;
    onBid(nilSelected ? 0 : selected);
  };

  const timerColorClass = (() => {
    if (timeLeft > 10) return "text-emerald-300 border-emerald-400/80 bg-emerald-500/10";
    if (timeLeft > 5)  return "text-amber-300 border-amber-400/80 bg-amber-500/10";
    return "text-rose-300 border-rose-500/80 bg-rose-500/10";
  })();

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-md flex items-center justify-center p-3 md:p-4"
          data-testid="spades-bid-modal"
        >
          <motion.div
            initial={{ scale: 0.85, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="relative w-full max-w-xl mx-auto p-1"
          >
            {/* Glowing halo ring */}
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-amber-500/25 via-fuchsia-500/20 to-cyan-500/20 blur-3xl animate-pulse" />

            <div className="relative bg-gradient-to-br from-slate-900/95 to-slate-800/95 backdrop-blur-xl rounded-2xl border-2 border-amber-500/40 shadow-[0_0_60px_rgba(251,191,36,0.3)] p-4 md:p-5">
              {/* ── Header with timer (Premium style) ── */}
              <div className="flex items-center justify-between mb-4">
                <h2
                  className="text-lg md:text-xl font-black text-amber-400 flex items-center gap-2"
                  style={{ fontFamily: "'Cinzel', serif" }}
                >
                  <Zap className="w-5 h-5" />
                  Place Your Bid
                </h2>
                <motion.div
                  animate={timeLeft <= 5 ? { scale: [1, 1.12, 1] } : {}}
                  transition={{ duration: 0.5, repeat: timeLeft <= 5 ? Infinity : 0 }}
                  className={`px-3 py-1.5 rounded-lg border-2 font-black text-xl md:text-2xl tabular-nums ${timerColorClass}`}
                  style={{ fontFamily: "'Cinzel', serif" }}
                  data-testid="spades-bid-modal-timer"
                >
                  {timeLeft}s
                </motion.div>
              </div>

              {/* Big Wheel hint */}
              {ruleset === "BIG_WHEEL" ? (
                <div className="mb-3 flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-fuchsia-500/10 border border-fuchsia-400/30">
                  <Sparkles className="w-3 h-3 text-fuchsia-300" />
                  <span className="text-[10px] uppercase tracking-wider text-fuchsia-200">
                    Big Wheel · Promoted trumps (Jokers / 2♠ / 2♦) count as guaranteed books
                  </span>
                </div>
              ) : null}

              {/* Suggested bid pill */}
              <div className="mb-4 flex items-center justify-center">
                <button
                  type="button"
                  onClick={() => {
                    setSelected(suggested);
                    setNilSelected(false);
                  }}
                  className="flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/15 border border-cyan-400/40 hover:bg-cyan-500/25 transition"
                >
                  <span className="text-[10px] uppercase tracking-wider text-cyan-200 font-bold">
                    Tap for Suggested
                  </span>
                  <span
                    className="text-sm font-black text-white tabular-nums leading-none"
                    style={{ fontFamily: "'Cinzel', serif" }}
                  >
                    {suggested}
                  </span>
                </button>
              </div>

              {/* ── Circular bid amount selector (Premium pattern) ── */}
              <div className="mb-4">
                <div className="text-amber-200/70 text-[10px] mb-2 text-center uppercase tracking-widest font-bold">
                  Select Books (1 – 13)
                </div>
                <div className="flex flex-wrap items-center justify-center gap-1.5 md:gap-2">
                  {BID_AMOUNTS.map((n) => (
                    <motion.button
                      key={n}
                      onClick={() => {
                        setSelected(n);
                        setNilSelected(false);
                      }}
                      disabled={busy}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.95 }}
                      data-testid={`spades-bid-modal-chip-${n}`}
                      className={`w-10 h-10 md:w-11 md:h-11 rounded-full font-black text-base md:text-lg transition-all ${
                        !nilSelected && selected === n
                          ? "bg-gradient-to-br from-amber-500 to-yellow-600 text-white shadow-[0_0_18px_rgba(251,191,36,0.55)] scale-110"
                          : "bg-slate-700/50 text-amber-200/60 hover:bg-slate-700"
                      } disabled:opacity-40 disabled:cursor-not-allowed`}
                      style={{ fontFamily: "'Cinzel', serif" }}
                    >
                      {n}
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Nil option — separate pill below the amount ring */}
              <div className="mb-5 flex justify-center">
                <motion.button
                  onClick={() => setNilSelected((v) => !v)}
                  disabled={busy}
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                  data-testid="spades-bid-modal-chip-nil"
                  className={`px-5 py-1.5 rounded-full border-2 font-black uppercase tracking-widest text-xs transition ${
                    nilSelected
                      ? "bg-amber-500 text-[#3a2500] border-amber-200 shadow-[0_0_18px_rgba(251,191,36,0.5)]"
                      : "bg-amber-500/10 border-amber-400/40 text-amber-200 hover:bg-amber-500/20"
                  } disabled:opacity-40`}
                  style={{ fontFamily: "'Cinzel', serif" }}
                >
                  Nil · Bid 0 for Bonus
                </motion.button>
              </div>

              {/* ── CTA ── */}
              <button
                onClick={handlePlace}
                disabled={busy}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-500 hover:from-amber-400 hover:to-yellow-400 text-[#3a2500] font-black uppercase tracking-widest text-sm shadow-[0_0_24px_rgba(251,191,36,0.5)] disabled:opacity-50"
                style={{ fontFamily: "'Cinzel', serif" }}
                data-testid="spades-bid-modal-place"
              >
                {busy
                  ? "Placing…"
                  : nilSelected
                    ? "Place Nil Bid"
                    : `Place Bid · ${selected} Book${selected === 1 ? "" : "s"}`}
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
};

export default SpadesBidModal;
