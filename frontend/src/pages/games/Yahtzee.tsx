/**
 * Yahtzee — single-player play table.
 * Wires to /api/games/yahtzee/* (roll, score-roll, fill, totals).
 *
 * Game loop:
 *   1. Roll 5 dice (up to 3 rolls per turn — held dice persist between rolls)
 *   2. Click any unfilled category → score it (locks in)
 *   3. After 13 turns scorecard is complete → grand total displayed
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Crown, Dice5, Lock, Sparkles, RotateCcw } from "lucide-react";
import { PremiumDice } from "@/components/games/vibedice654/PremiumDice";
import CasinoTableEnhancer from "@/components/games/CasinoTableEnhancer";
import cardSoundManager from "@/utils/cardSoundManager";

const API = process.env.REACT_APP_BACKEND_URL;

type Category = string;
type Scorecard = Record<Category, number | null>;

const PIPS = [
  null, // index 0 unused
  ["•"],
  ["•", "•"],
  ["•", "•", "•"],
  ["•", "•", "•", "•"],
  ["•", "•", "•", "•", "•"],
  ["•", "•", "•", "•", "•", "•"],
];

function Die({ value, held, rolling, onClick }: { value: number; held: boolean; rolling: boolean; onClick: () => void; }) {
  return (
    <motion.button
      onClick={onClick}
      whileTap={{ scale: 0.92 }}
      data-testid={`yahtzee-die-${value}`}
      className={`relative rounded-2xl transition-all ${held ? "ring-4 ring-yellow-300 shadow-lg shadow-yellow-500/40" : "hover:ring-2 hover:ring-cyan-300"}`}
    >
      <PremiumDice value={value} rolling={rolling} isQualifier={held} />
      {held && (
        <span className="absolute -top-2 -right-2 bg-yellow-500 text-black text-[10px] font-bold rounded-full px-1.5 py-0.5 flex items-center gap-1 z-10">
          <Lock className="w-2.5 h-2.5" /> HELD
        </span>
      )}
    </motion.button>
  );
}

const CATEGORY_LABELS: Record<string, string> = {
  aces: "Aces (sum of 1s)",
  twos: "Twos (sum of 2s)",
  threes: "Threes (sum of 3s)",
  fours: "Fours (sum of 4s)",
  fives: "Fives (sum of 5s)",
  sixes: "Sixes (sum of 6s)",
  three_of_a_kind: "Three of a Kind",
  four_of_a_kind: "Four of a Kind",
  full_house: "Full House (25)",
  small_straight: "Small Straight (30)",
  large_straight: "Large Straight (40)",
  yahtzee: "YAHTZEE! (50)",
  chance: "Chance (sum)",
};

export default function Yahtzee() {
  const nav = useNavigate();
  const [constants, setConstants] = useState<any>(null);
  const [dice, setDice] = useState<number[]>([1, 1, 1, 1, 1]);
  const [held, setHeld] = useState<Set<number>>(new Set());
  const [rollsLeft, setRollsLeft] = useState(3);
  const [scorecard, setScorecard] = useState<Scorecard>({});
  const [yahtzeeBonusCount, setYahtzeeBonusCount] = useState(0);
  const [scoreHints, setScoreHints] = useState<Record<string, number>>({});
  const [totals, setTotals] = useState<any>(null);
  const [rolling, setRolling] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hasRolled, setHasRolled] = useState(false);

  useEffect(() => {
    fetch(`${API}/api/games/yahtzee/constants`).then(r => r.json()).then(c => {
      setConstants(c);
      // Initialize empty scorecard
      const sc: Scorecard = {};
      c.all_categories.forEach((cat: string) => { sc[cat] = null; });
      setScorecard(sc);
    });
  }, []);

  const refreshHints = useCallback(async (newDice: number[]) => {
    const res = await fetch(`${API}/api/games/yahtzee/score-roll`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dice: newDice, scorecard, yahtzee_bonus_count: yahtzeeBonusCount }),
    }).then(r => r.json());
    setScoreHints(res.scores || {});
  }, [scorecard, yahtzeeBonusCount]);

  const refreshTotals = useCallback(async (sc: Scorecard, bonus: number) => {
    const res = await fetch(`${API}/api/games/yahtzee/totals`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scorecard: sc, yahtzee_bonus_count: bonus }),
    }).then(r => r.json());
    setTotals(res);
  }, []);

  const roll = useCallback(async () => {
    if (rollsLeft <= 0 || busy) return;
    setBusy(true);
    setRolling(true);
    const heldIdx = Array.from(held);
    const res = await fetch(`${API}/api/games/yahtzee/roll`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(hasRolled ? { held: heldIdx, current_dice: dice } : {}),
    }).then(r => r.json());
    setDice(res.dice);
    setRollsLeft(rollsLeft - 1);
    setHasRolled(true);
    await refreshHints(res.dice);
    setTimeout(() => setRolling(false), 600);
    setBusy(false);
  }, [rollsLeft, busy, held, dice, hasRolled, refreshHints]);

  const toggleHeld = (idx: number) => {
    if (!hasRolled || rolling) return;
    const next = new Set(held);
    if (next.has(idx)) next.delete(idx); else next.add(idx);
    setHeld(next);
  };

  const fillCategory = useCallback(async (category: string) => {
    if (busy || scorecard[category] !== null || !hasRolled) return;
    setBusy(true);
    const res = await fetch(`${API}/api/games/yahtzee/fill`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category, dice, scorecard, yahtzee_bonus_count: yahtzeeBonusCount }),
    }).then(r => r.json());
    setScorecard(res.scorecard.categories);
    setYahtzeeBonusCount(res.scorecard.yahtzee_bonus_count);
    setTotals(res.totals);
    // Reset for next turn
    setHeld(new Set());
    setRollsLeft(3);
    setHasRolled(false);
    setScoreHints({});
    setBusy(false);
  }, [busy, scorecard, dice, yahtzeeBonusCount, hasRolled]);

  const newGame = () => {
    if (!constants) return;
    const sc: Scorecard = {};
    constants.all_categories.forEach((c: string) => { sc[c] = null; });
    setScorecard(sc);
    setYahtzeeBonusCount(0);
    setHeld(new Set());
    setRollsLeft(3);
    setDice([1, 1, 1, 1, 1]);
    setHasRolled(false);
    setScoreHints({});
    setTotals(null);
  };

  const isComplete = totals?.is_complete;

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-emerald-950/15 to-black text-white pb-28 md:pb-8" data-testid="yahtzee-page">
      {/* Header */}
      <div className="sticky top-0 z-30 backdrop-blur-md bg-black/60 border-b border-white/10">
        <div className="max-w-6xl mx-auto px-5 py-3 flex items-center gap-4">
          <button onClick={() => nav(-1)} data-testid="yahtzee-back-btn" className="p-2 rounded-lg hover:bg-white/10">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Dice5 className="w-5 h-5 text-emerald-400" />
              <h1 className="text-lg font-black tracking-wide">Yahtzee</h1>
              <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded">5 DICE · 13 ROUNDS</span>
            </div>
            <p className="text-xs text-neutral-400 mt-0.5">Roll · Hold · Score · Fill all 13 categories.</p>
          </div>
          <button onClick={newGame} data-testid="yahtzee-new-game-btn" className="text-xs px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 transition-all flex items-center gap-1">
            <RotateCcw className="w-3 h-3" /> New Game
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-5 py-5 grid lg:grid-cols-2 gap-5">
        {/* AAA enhancer (Feb 2026 Late × 5) — phase indicator + sound effects */}
        <div className="lg:col-span-2">
          <CasinoTableEnhancer
            gameId="yahtzee"
            phase={rolling ? 'rolling' : (isComplete ? 'won' : 'betting')}
            labels={{
              rolling: 'ROLLING DICE',
              won: 'GAME COMPLETE',
              lost: 'GAME COMPLETE',
              betting: rollsLeft > 0 && hasRolled ? 'PICK · HOLD · ROLL' : 'YOUR TURN',
            }}
          />
        </div>
        {/* Left: Dice + Roll */}
        <div className="space-y-5">
          <div className="rounded-2xl border border-white/10 bg-black/40 p-5" data-testid="yahtzee-dice-tray">
            <div className="flex justify-between items-center mb-4">
              <span className="text-xs font-mono uppercase tracking-widest text-neutral-400">Dice Tray</span>
              <span className="text-xs font-mono">Rolls left: <b className="text-emerald-300" data-testid="yahtzee-rolls-left">{rollsLeft}</b></span>
            </div>
            <div className="flex justify-center gap-3 mb-5 flex-wrap">
              {dice.map((v, i) => (
                <Die key={i} value={v} held={held.has(i)} rolling={rolling && !held.has(i)} onClick={() => toggleHeld(i)} />
              ))}
            </div>
            <div className="text-center">
              <button
                onClick={roll}
                disabled={rollsLeft <= 0 || busy}
                data-testid="yahtzee-roll-btn"
                className="px-8 py-3 rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 text-black font-black tracking-widest hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                {hasRolled ? `ROLL (${rollsLeft} LEFT)` : "ROLL DICE"}
              </button>
              {hasRolled && rollsLeft > 0 && (
                <p className="text-xs text-neutral-500 mt-2">Tap dice to HOLD before re-rolling</p>
              )}
            </div>
          </div>

          {isComplete && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              data-testid="yahtzee-final-score"
              className="rounded-2xl border-2 border-yellow-400 bg-gradient-to-br from-yellow-900/30 via-black to-emerald-900/20 p-5 text-center"
            >
              <Crown className="w-10 h-10 mx-auto text-yellow-400 mb-2" />
              <div className="text-xs uppercase tracking-widest text-yellow-200">Final Score</div>
              <div className="text-5xl font-black bg-clip-text text-transparent bg-gradient-to-br from-yellow-300 to-emerald-400 my-2">
                {totals.grand_total}
              </div>
              <div className="text-xs text-neutral-400 font-mono">
                Upper {totals.upper_total} · Lower {totals.lower_subtotal} · Yahtzee Bonus {totals.yahtzee_bonus}
              </div>
            </motion.div>
          )}
        </div>

        {/* Right: Scorecard */}
        <div className="rounded-2xl border border-white/10 bg-black/40 p-5" data-testid="yahtzee-scorecard">
          <h2 className="text-xs font-mono uppercase tracking-widest text-neutral-400 mb-3">Scorecard</h2>
          <div className="space-y-1">
            {constants?.all_categories.map((cat: string) => {
              const filled = scorecard[cat];
              const hint = scoreHints[cat];
              const isUpper = constants.upper_categories.includes(cat);
              return (
                <button
                  key={cat}
                  onClick={() => fillCategory(cat)}
                  disabled={filled !== null || !hasRolled || busy}
                  data-testid={`yahtzee-cat-${cat}`}
                  className={`w-full px-3 py-2 rounded-lg flex items-center justify-between text-sm transition-all
                    ${filled !== null
                      ? "bg-white/5 text-neutral-500 cursor-default"
                      : hasRolled
                        ? "bg-white/5 hover:bg-emerald-500/20 text-white border border-emerald-500/30"
                        : "bg-white/5 text-neutral-600 cursor-not-allowed"
                    }`}
                >
                  <span className={`${isUpper ? "text-cyan-300" : ""}`}>{CATEGORY_LABELS[cat] || cat}</span>
                  <span className={`font-mono font-bold ${
                    filled !== null ? "text-neutral-400"
                    : hint && hint > 0 ? "text-emerald-300"
                    : "text-neutral-600"
                  }`}>
                    {filled !== null ? filled : hasRolled ? hint : "—"}
                  </span>
                </button>
              );
            })}
          </div>
          {totals && (
            <div className="mt-4 pt-4 border-t border-white/10 space-y-1 text-sm font-mono">
              <div className="flex justify-between"><span className="text-neutral-400">Upper subtotal</span><b>{totals.upper_subtotal}</b></div>
              <div className="flex justify-between"><span className="text-neutral-400">Upper bonus (≥63)</span><b className={totals.upper_bonus > 0 ? "text-yellow-300" : ""}>{totals.upper_bonus}</b></div>
              <div className="flex justify-between"><span className="text-neutral-400">Lower subtotal</span><b>{totals.lower_subtotal}</b></div>
              <div className="flex justify-between"><span className="text-neutral-400">Yahtzee bonus</span><b className={totals.yahtzee_bonus > 0 ? "text-yellow-300" : ""}>{totals.yahtzee_bonus}</b></div>
              <div className="flex justify-between text-base mt-2 pt-2 border-t border-white/10"><span>GRAND TOTAL</span><b className="text-emerald-300">{totals.grand_total}</b></div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile-only sticky ROLL CTA (Feb 2026 Late × 5) */}
      {!isComplete && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-black/90 backdrop-blur border-t border-white/10 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <button
            onClick={roll}
            disabled={rollsLeft <= 0 || busy}
            data-testid="yahtzee-roll-btn-mobile"
            className="w-full py-3 rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 text-black font-black tracking-widest disabled:opacity-40"
          >
            {hasRolled ? `ROLL · ${rollsLeft} LEFT` : 'ROLL DICE'}
          </button>
        </div>
      )}
    </div>
  );
}
