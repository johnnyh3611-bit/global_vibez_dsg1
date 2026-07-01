/**
 * BidWhistBidModal — Premium-style bid ring for Bid Whist.
 *
 * Same visual language as SpadesBidModal (amber halo, Cinzel title, 15s
 * countdown timer with colour-coded escalation, glowing-amber-chip bid
 * selector) — ONLY the rules differ:
 *
 *   • Book range 3–7 (vs Spades 1–13)
 *   • "Pass" action appears as a left-side bid option
 *   • Direction toggle: Uptown (high A-2) / Downtown (low A-K)
 *   • Trump-suit picker row (♠ ♥ ♦ ♣ · No Trump)
 *
 * The 15-second auto-submit behaviour matches Spades exactly — when the
 * timer hits zero, we send the currently-selected bid (or Pass if no
 * selection was made).
 */
import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap } from "lucide-react";

export type BidWhistDirection = "uptown" | "downtown" | "no_trump";
export type BidWhistSuit = "spades" | "hearts" | "diamonds" | "clubs" | "no_trump";

export interface BidWhistBid {
  amount: number;                 // 3-7
  direction: BidWhistDirection;   // uptown | downtown | no_trump
  trump_suit: BidWhistSuit;       // spades | hearts | diamonds | clubs | no_trump
}

interface Props {
  open: boolean;
  currentHighBid?: { amount: number; bidder?: string } | null;
  onBid: (bid: BidWhistBid) => void;
  onPass: () => void;
  busy: boolean;
}

const BOOK_AMOUNTS = [3, 4, 5, 6, 7];
const SUIT_META: Array<{ id: BidWhistSuit; label: string; symbol: string; color: string }> = [
  { id: "spades",   label: "Spades",   symbol: "♠", color: "text-slate-100" },
  { id: "hearts",   label: "Hearts",   symbol: "♥", color: "text-rose-400" },
  { id: "diamonds", label: "Diamonds", symbol: "♦", color: "text-rose-400" },
  { id: "clubs",    label: "Clubs",    symbol: "♣", color: "text-slate-100" },
  { id: "no_trump", label: "No Trump", symbol: "∅", color: "text-amber-300" },
];

const BID_TIMER_SECONDS = 15;

export const BidWhistBidModal: React.FC<Props> = ({
  open,
  currentHighBid,
  onBid,
  onPass,
  busy,
}) => {
  const minAmount = currentHighBid?.amount ? currentHighBid.amount + 1 : 3;
  const availableAmounts = useMemo(
    () => BOOK_AMOUNTS.filter((n) => n >= minAmount),
    [minAmount],
  );

  const [selected, setSelected] = useState<number>(availableAmounts[0] ?? 3);
  const [direction, setDirection] = useState<BidWhistDirection>("uptown");
  const [trump, setTrump] = useState<BidWhistSuit>("spades");
  const [timeLeft, setTimeLeft] = useState(BID_TIMER_SECONDS);

  // Reset on open.
  useEffect(() => {
    if (!open) return;
    setSelected(availableAmounts[0] ?? 3);
    setDirection("uptown");
    setTrump("spades");
    setTimeLeft(BID_TIMER_SECONDS);
  }, [open, availableAmounts]);

  // If "no trump" is selected, the direction flips to its own value.
  useEffect(() => {
    if (trump === "no_trump") setDirection("no_trump");
    else if (direction === "no_trump") setDirection("uptown");
  }, [trump, direction]);

  // Countdown — auto-pass at zero (safer than auto-bid for BW since
  // bids are binding contracts).
  useEffect(() => {
    if (!open) return;
    if (timeLeft <= 0) {
      if (!busy) onPass();
      return;
    }
    const t = window.setTimeout(() => setTimeLeft((v) => v - 1), 1000);
    return () => clearTimeout(t);
  }, [open, timeLeft, busy, onPass]);

  const handlePlace = () => {
    if (busy) return;
    onBid({
      amount: selected,
      direction,
      trump_suit: trump,
    });
  };

  const timerColorClass = (() => {
    if (timeLeft > 10) return "text-emerald-300 border-emerald-400/80 bg-emerald-500/10";
    if (timeLeft > 5)  return "text-amber-300 border-amber-400/80 bg-amber-500/10";
    return "text-rose-300 border-rose-500/80 bg-rose-500/10";
  })();

  const noBidsAvailable = availableAmounts.length === 0;

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-md flex items-center justify-center p-3 md:p-4"
          data-testid="bidwhist-bid-modal"
        >
          <motion.div
            initial={{ scale: 0.85, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="relative w-full max-w-xl mx-auto p-1"
          >
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-amber-500/25 via-fuchsia-500/20 to-cyan-500/20 blur-3xl animate-pulse" />

            <div className="relative bg-gradient-to-br from-slate-900/95 to-slate-800/95 backdrop-blur-xl rounded-2xl border-2 border-amber-500/40 shadow-[0_0_60px_rgba(251,191,36,0.3)] p-4 md:p-5">
              {/* Header */}
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
                  data-testid="bidwhist-bid-modal-timer"
                >
                  {timeLeft}s
                </motion.div>
              </div>

              {/* Current high bid */}
              {currentHighBid?.amount ? (
                <div className="mb-3 text-center">
                  <span className="text-[10px] uppercase tracking-wider text-amber-300/70">
                    Current bid:{" "}
                    <strong className="text-amber-300">
                      {currentHighBid.amount}
                    </strong>{" "}
                    by {currentHighBid.bidder ?? "—"} · you must bid{" "}
                    <strong className="text-white">≥ {minAmount}</strong>{" "}
                    or pass
                  </span>
                </div>
              ) : null}

              {/* Books */}
              <div className="mb-4">
                <div className="text-amber-200/70 text-[10px] mb-2 text-center uppercase tracking-widest font-bold">
                  Books (3 – 7)
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {BOOK_AMOUNTS.map((n) => {
                    const disabled = n < minAmount || busy;
                    return (
                      <motion.button
                        key={n}
                        onClick={() => setSelected(n)}
                        disabled={disabled}
                        whileHover={!disabled ? { scale: 1.1 } : undefined}
                        whileTap={!disabled ? { scale: 0.95 } : undefined}
                        data-testid={`bidwhist-bid-modal-chip-${n}`}
                        className={`w-12 h-12 md:w-14 md:h-14 rounded-full font-black text-lg md:text-xl transition-all ${
                          selected === n && !disabled
                            ? "bg-gradient-to-br from-amber-500 to-yellow-600 text-white shadow-[0_0_18px_rgba(251,191,36,0.55)] scale-110"
                            : disabled
                              ? "bg-slate-800/70 text-slate-500 cursor-not-allowed"
                              : "bg-slate-700/50 text-amber-200/60 hover:bg-slate-700"
                        }`}
                        style={{ fontFamily: "'Cinzel', serif" }}
                      >
                        {n}
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              {/* Direction */}
              {trump !== "no_trump" ? (
                <div className="mb-4">
                  <div className="text-amber-200/70 text-[10px] mb-2 text-center uppercase tracking-widest font-bold">
                    Direction
                  </div>
                  <div className="flex gap-2 justify-center">
                    {(["uptown", "downtown"] as BidWhistDirection[]).map((d) => (
                      <button
                        key={d}
                        onClick={() => setDirection(d)}
                        disabled={busy}
                        data-testid={`bidwhist-bid-modal-direction-${d}`}
                        className={`px-4 py-1.5 rounded-full border-2 font-black uppercase tracking-widest text-[11px] transition ${
                          direction === d
                            ? "bg-amber-500 text-[#3a2500] border-amber-200 shadow-[0_0_12px_rgba(251,191,36,0.5)]"
                            : "bg-amber-500/10 border-amber-400/40 text-amber-200 hover:bg-amber-500/20"
                        }`}
                        style={{ fontFamily: "'Cinzel', serif" }}
                      >
                        {d === "uptown" ? "Uptown · High A-2" : "Downtown · Low A-K"}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Trump */}
              <div className="mb-5">
                <div className="text-amber-200/70 text-[10px] mb-2 text-center uppercase tracking-widest font-bold">
                  Trump Suit
                </div>
                <div className="flex gap-1.5 md:gap-2 justify-center flex-wrap">
                  {SUIT_META.map((s) => (
                    <motion.button
                      key={s.id}
                      onClick={() => setTrump(s.id)}
                      disabled={busy}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      data-testid={`bidwhist-bid-modal-trump-${s.id}`}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-2 transition ${
                        trump === s.id
                          ? "bg-amber-500/20 border-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.4)]"
                          : "bg-slate-900/60 border-slate-700 hover:border-amber-400/40"
                      }`}
                    >
                      <span
                        className={`text-lg md:text-xl font-black ${s.color}`}
                        style={{ fontFamily: "'Cinzel', serif" }}
                      >
                        {s.symbol}
                      </span>
                      <span className="text-[9px] uppercase tracking-widest font-bold text-amber-200/80">
                        {s.label}
                      </span>
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* CTAs */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={onPass}
                  disabled={busy}
                  className="col-span-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border-2 border-slate-600 text-slate-200 font-black uppercase tracking-widest text-xs disabled:opacity-50"
                  style={{ fontFamily: "'Cinzel', serif" }}
                  data-testid="bidwhist-bid-modal-pass"
                >
                  Pass
                </button>
                <button
                  onClick={handlePlace}
                  disabled={busy || noBidsAvailable}
                  className="col-span-2 py-3 rounded-xl bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-500 hover:from-amber-400 hover:to-yellow-400 text-[#3a2500] font-black uppercase tracking-widest text-xs md:text-sm shadow-[0_0_18px_rgba(251,191,36,0.4)] disabled:opacity-50"
                  style={{ fontFamily: "'Cinzel', serif" }}
                  data-testid="bidwhist-bid-modal-place"
                >
                  {noBidsAvailable
                    ? "Must Pass"
                    : `Bid ${selected} ${trump === "no_trump" ? "No-Trump" : direction === "downtown" ? "Down" : "Up"} · ${SUIT_META.find((s) => s.id === trump)?.symbol ?? "?"}`}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
};

export default BidWhistBidModal;
