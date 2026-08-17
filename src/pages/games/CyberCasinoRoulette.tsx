/**
 * Cyber Casino — Roulette
 *
 * Native React + framer-motion implementation. No Unity, no iframe.
 * Wheel uses an SVG conic gradient for the colored pockets, spins via
 * a CSS rotation tween. Numbers + colors match European single-zero
 * roulette (37 pockets: 0 + 1-36).
 *
 * Bet types implemented:
 *   • Straight (single number)        — 35:1
 *   • Red / Black                     — 1:1
 *   • Even / Odd                      — 1:1
 *   • Low (1-18) / High (19-36)       — 1:1
 *   • Dozens (1-12, 13-24, 25-36)     — 2:1
 *
 * All bets settle in Vibez Coins (the soft currency) — no real money
 * until the user is fully verified + the chair-pool is funded. Wins
 * credit instantly; losses go to the platform pool.
 */
import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Coins, RotateCw, Sparkles } from "lucide-react";
import { toast } from "sonner";

// European single-zero wheel order
const WHEEL_ORDER = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24,
  16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
];
const RED_NUMBERS = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
]);

type BetKind =
  | { type: "number"; n: number }
  | { type: "red" }
  | { type: "black" }
  | { type: "even" }
  | { type: "odd" }
  | { type: "low" }
  | { type: "high" }
  | { type: "dozen"; d: 1 | 2 | 3 };

type Bet = { kind: BetKind; amount: number; id: string };

const colorOf = (n: number) =>
  n === 0 ? "green" : RED_NUMBERS.has(n) ? "red" : "black";

const payout = (kind: BetKind, n: number, amount: number): number => {
  switch (kind.type) {
    case "number":
      return n === kind.n ? amount * 36 : 0;
    case "red":
      return colorOf(n) === "red" ? amount * 2 : 0;
    case "black":
      return colorOf(n) === "black" ? amount * 2 : 0;
    case "even":
      return n !== 0 && n % 2 === 0 ? amount * 2 : 0;
    case "odd":
      return n !== 0 && n % 2 === 1 ? amount * 2 : 0;
    case "low":
      return n >= 1 && n <= 18 ? amount * 2 : 0;
    case "high":
      return n >= 19 && n <= 36 ? amount * 2 : 0;
    case "dozen": {
      const inDozen =
        kind.d === 1
          ? n >= 1 && n <= 12
          : kind.d === 2
            ? n >= 13 && n <= 24
            : n >= 25 && n <= 36;
      return inDozen ? amount * 3 : 0;
    }
  }
};

const labelOf = (kind: BetKind): string => {
  switch (kind.type) {
    case "number":
      return `#${kind.n}`;
    case "red":
      return "Red";
    case "black":
      return "Black";
    case "even":
      return "Even";
    case "odd":
      return "Odd";
    case "low":
      return "1–18";
    case "high":
      return "19–36";
    case "dozen":
      return ["", "1–12", "13–24", "25–36"][kind.d];
  }
};

export default function CyberCasinoRoulette() {
  const navigate = useNavigate();
  const [balance, setBalance] = useState(1000);
  const [chip, setChip] = useState(10);
  const [bets, setBets] = useState<Bet[]>([]);
  const [spinning, setSpinning] = useState(false);
  const [lastResult, setLastResult] = useState<number | null>(null);
  const [wheelDeg, setWheelDeg] = useState(0);

  const totalBet = useMemo(() => bets.reduce((a, b) => a + b.amount, 0), [bets]);

  const placeBet = (kind: BetKind) => {
    if (spinning) return;
    if (chip > balance) {
      toast.error("Not enough Vibez Coins");
      return;
    }
    setBalance((b) => b - chip);
    setBets((bs) => [
      ...bs,
      { kind, amount: chip, id: `${Date.now()}-${Math.random()}` },
    ]);
  };

  const clearBets = () => {
    if (spinning) return;
    setBalance((b) => b + totalBet);
    setBets([]);
  };

  const spin = () => {
    if (spinning || bets.length === 0) return;
    setSpinning(true);
    setLastResult(null);

    // Pick a winning pocket and animate the wheel to land on it.
    const winningIdx = Math.floor(Math.random() * WHEEL_ORDER.length);
    const winningN = WHEEL_ORDER[winningIdx];
    const segDeg = 360 / WHEEL_ORDER.length;
    // Offset so the chosen pocket lines up at the top pointer.
    const targetRot = 360 * 5 + (360 - winningIdx * segDeg);
    setWheelDeg((prev) => prev + targetRot);

    setTimeout(() => {
      // Settle every bet.
      let totalWon = 0;
      for (const b of bets) {
        totalWon += payout(b.kind, winningN, b.amount);
      }
      setBalance((bal) => bal + totalWon);
      setLastResult(winningN);
      setBets([]);
      setSpinning(false);
      if (totalWon > 0) {
        toast.success(
          `${winningN} ${colorOf(winningN)} → won ${totalWon} Vibez Coins`,
        );
      } else {
        toast(`${winningN} ${colorOf(winningN)} → no win this round`);
      }
    }, 4500);
  };

  return (
    <div className="min-h-screen bg-[#07030F] text-white pb-12" data-testid="cyber-casino-roulette">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <button
          onClick={() => navigate("/games/cyber-casino")}
          className="flex items-center gap-2 text-purple-300/70 hover:text-white mb-4"
          data-testid="roulette-back-btn"
        >
          <ArrowLeft className="w-4 h-4" /> Cyber Casino
        </button>

        <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-fuchsia-600 to-purple-700 shadow-[0_0_22px_rgba(217,70,239,0.55)]">
              <RotateCw className="w-7 h-7 text-white" />
            </div>
            <div>
              <p className="text-xs font-mono uppercase tracking-[0.3em] text-fuchsia-400/80">
                Cyber Casino · Native
              </p>
              <h1 className="text-3xl md:text-4xl font-black">Neon Roulette</h1>
            </div>
          </div>
          <div className="px-4 py-2 rounded-xl bg-[#0F0720] border border-fuchsia-500/30 flex items-center gap-2">
            <Coins className="w-4 h-4 text-fuchsia-300" />
            <span className="text-xs uppercase tracking-widest text-purple-300/70">
              Balance
            </span>
            <span className="text-xl font-black text-white" data-testid="roulette-balance">
              {balance.toLocaleString()}
            </span>
            <span className="text-xs text-fuchsia-300">Vibez</span>
          </div>
        </div>

        {/* Wheel + Result */}
        <Card className="p-6 bg-[#0F0720] border border-fuchsia-500/20 rounded-2xl mb-6">
          <div className="flex flex-col items-center">
            <div className="relative w-72 h-72 md:w-80 md:h-80 mb-4">
              {/* Pointer */}
              <div className="absolute left-1/2 -translate-x-1/2 -top-2 w-0 h-0 border-l-[14px] border-l-transparent border-r-[14px] border-r-transparent border-t-[18px] border-t-fuchsia-400 z-20" />
              {/* Wheel */}
              <motion.div
                animate={{ rotate: wheelDeg }}
                transition={{ duration: 4.4, ease: [0.18, 0.7, 0.2, 1] }}
                className="w-full h-full rounded-full border-4 border-fuchsia-500/40 shadow-[0_0_36px_rgba(217,70,239,0.45)] relative"
                style={{ background: "#0B0618" }}
                data-testid="roulette-wheel"
              >
                <svg viewBox="-100 -100 200 200" className="w-full h-full">
                  {WHEEL_ORDER.map((n, i) => {
                    const a = (360 / WHEEL_ORDER.length);
                    const start = i * a - 90 - a / 2;
                    const end = start + a;
                    const r = 96;
                    const x1 = r * Math.cos((start * Math.PI) / 180);
                    const y1 = r * Math.sin((start * Math.PI) / 180);
                    const x2 = r * Math.cos((end * Math.PI) / 180);
                    const y2 = r * Math.sin((end * Math.PI) / 180);
                    const fill =
                      n === 0
                        ? "#16a34a"
                        : RED_NUMBERS.has(n)
                          ? "#dc2626"
                          : "#0a0a0a";
                    const tx = 75 * Math.cos((((start + end) / 2) * Math.PI) / 180);
                    const ty = 75 * Math.sin((((start + end) / 2) * Math.PI) / 180);
                    return (
                      <g key={i}>
                        <path
                          d={`M0 0 L${x1} ${y1} A${r} ${r} 0 0 1 ${x2} ${y2} Z`}
                          fill={fill}
                          stroke="#1a0d2e"
                          strokeWidth="0.6"
                        />
                        <text
                          x={tx}
                          y={ty}
                          fill="white"
                          fontSize="8"
                          fontWeight="900"
                          textAnchor="middle"
                          dominantBaseline="middle"
                          transform={`rotate(${(start + end) / 2 + 90} ${tx} ${ty})`}
                        >
                          {n}
                        </text>
                      </g>
                    );
                  })}
                  <circle r="22" fill="#1a0d2e" stroke="#d946ef66" strokeWidth="2" />
                </svg>
              </motion.div>
            </div>

            {lastResult !== null && (
              <div
                className={`px-6 py-3 rounded-2xl font-black text-2xl ${
                  colorOf(lastResult) === "red"
                    ? "bg-red-500/20 text-red-300 border border-red-400/40"
                    : colorOf(lastResult) === "black"
                      ? "bg-neutral-700/40 text-white border border-neutral-500/40"
                      : "bg-emerald-500/20 text-emerald-300 border border-emerald-400/40"
                }`}
                data-testid="roulette-last-result"
              >
                {lastResult}
              </div>
            )}
          </div>
        </Card>

        {/* Chip selector + Spin */}
        <Card className="p-5 bg-[#0F0720] border border-fuchsia-500/20 rounded-2xl mb-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-widest text-purple-300/70">
                Chip
              </span>
              {[5, 10, 25, 50, 100].map((c) => (
                <button
                  key={c}
                  onClick={() => setChip(c)}
                  disabled={spinning}
                  className={`w-12 h-12 rounded-full font-black text-sm border transition-all ${
                    chip === c
                      ? "bg-fuchsia-500 text-white border-fuchsia-300 shadow-[0_0_18px_rgba(217,70,239,0.55)]"
                      : "bg-[#1A0D2E] text-purple-200 border-fuchsia-500/30 hover:border-fuchsia-400/60"
                  }`}
                  data-testid={`roulette-chip-${c}`}
                >
                  {c}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-purple-300/70">
                Total bet: <strong className="text-white">{totalBet}</strong>
              </span>
              <Button
                onClick={clearBets}
                disabled={spinning || bets.length === 0}
                variant="outline"
                className="border-purple-400/30 text-purple-200"
                data-testid="roulette-clear-btn"
              >
                Clear
              </Button>
              <Button
                onClick={spin}
                disabled={spinning || bets.length === 0}
                className="bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-bold shadow-[0_0_22px_rgba(217,70,239,0.45)]"
                data-testid="roulette-spin-btn"
              >
                {spinning ? "Spinning…" : "Spin"} <Sparkles className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        </Card>

        {/* Bet board */}
        <Card className="p-5 bg-[#0F0720] border border-fuchsia-500/20 rounded-2xl">
          {/* Outside bets */}
          <div className="grid grid-cols-2 md:grid-cols-7 gap-2 mb-3">
            <BetTile label="1–18" onClick={() => placeBet({ type: "low" })} testid="bet-low" />
            <BetTile label="EVEN" onClick={() => placeBet({ type: "even" })} testid="bet-even" />
            <BetTile
              label="RED"
              tone="bg-red-600/30 border-red-400/40 text-red-200"
              onClick={() => placeBet({ type: "red" })}
              testid="bet-red"
            />
            <BetTile
              label="BLACK"
              tone="bg-neutral-800/60 border-neutral-500/40 text-white"
              onClick={() => placeBet({ type: "black" })}
              testid="bet-black"
            />
            <BetTile label="ODD" onClick={() => placeBet({ type: "odd" })} testid="bet-odd" />
            <BetTile label="19–36" onClick={() => placeBet({ type: "high" })} testid="bet-high" />
            <BetTile
              label={`Chip ${chip}`}
              tone="bg-fuchsia-500/15 border-fuchsia-400/40 text-fuchsia-200"
              testid="bet-chip-display"
            />
          </div>
          {/* Number grid 1-36 */}
          <div className="grid grid-cols-6 sm:grid-cols-12 gap-1.5">
            <BetTile
              label="0"
              tone="bg-emerald-600/30 border-emerald-400/40 text-emerald-200"
              onClick={() => placeBet({ type: "number", n: 0 })}
              testid="bet-number-0"
            />
            {Array.from({ length: 36 }, (_, i) => i + 1).map((n) => (
              <BetTile
                key={n}
                label={String(n)}
                tone={
                  RED_NUMBERS.has(n)
                    ? "bg-red-600/30 border-red-400/40 text-red-200"
                    : "bg-neutral-800/60 border-neutral-500/40 text-white"
                }
                onClick={() => placeBet({ type: "number", n })}
                testid={`bet-number-${n}`}
              />
            ))}
          </div>
          {/* Dozens */}
          <div className="grid grid-cols-3 gap-2 mt-2">
            <BetTile
              label="1st 12"
              onClick={() => placeBet({ type: "dozen", d: 1 })}
              testid="bet-dozen-1"
            />
            <BetTile
              label="2nd 12"
              onClick={() => placeBet({ type: "dozen", d: 2 })}
              testid="bet-dozen-2"
            />
            <BetTile
              label="3rd 12"
              onClick={() => placeBet({ type: "dozen", d: 3 })}
              testid="bet-dozen-3"
            />
          </div>

          {/* Active bets */}
          {bets.length > 0 && (
            <div className="mt-4 pt-4 border-t border-fuchsia-500/20">
              <p className="text-xs uppercase tracking-widest text-purple-300/70 mb-2">
                Active bets ({bets.length})
              </p>
              <div className="flex flex-wrap gap-2">
                {bets.map((b) => (
                  <span
                    key={b.id}
                    className="text-xs px-2.5 py-1 rounded-full bg-fuchsia-500/10 border border-fuchsia-500/30 text-fuchsia-200 font-mono"
                  >
                    {labelOf(b.kind)} · {b.amount}
                  </span>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

const BetTile: React.FC<{
  label: string;
  tone?: string;
  onClick?: () => void;
  testid?: string;
}> = ({ label, tone, onClick, testid }) => (
  <button
    onClick={onClick}
    disabled={!onClick}
    className={`text-xs font-black py-2 rounded-lg border transition-all hover:-translate-y-0.5 ${
      tone || "bg-[#1A0D2E] border-fuchsia-500/30 text-purple-200 hover:border-fuchsia-400/60"
    } ${!onClick ? "opacity-80 cursor-default" : ""}`}
    data-testid={testid}
  >
    {label}
  </button>
);
