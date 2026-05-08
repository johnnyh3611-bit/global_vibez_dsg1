/**
 * BettingInterface — slider-based bet control per MASTER_RULEBOOK §2.5.
 * Never allow text input. Currency is ₵ (Vibez Coins), never $.
 */
import { useState } from "react";

export const BettingInterface = ({
  min = 10,
  max = 1000,
  initial = 50,
  onBet,
  onCheck,
}: {
  min?: number;
  max?: number;
  initial?: number;
  onBet?: (amount: number) => void;
  onCheck?: () => void;
}) => {
  const [bet, setBet] = useState<number>(initial);
  return (
    <div
      data-testid="vibez-betting-interface"
      className="fixed bottom-24 right-8 flex flex-col items-center gap-4 bg-black/40 backdrop-blur-lg p-6 rounded-3xl border border-white/10 z-40"
    >
      <div className="text-cyan-400 font-mono text-xl" data-testid="bet-amount-display">
        ₵ {bet.toLocaleString()}
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={bet}
        onChange={(e) => setBet(parseInt(e.target.value, 10))}
        data-testid="bet-amount-slider"
        className="w-64 h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
      />
      <div className="flex gap-4">
        <button
          onClick={() => onCheck?.()}
          data-testid="bet-check-btn"
          className="px-6 py-2 bg-purple-600/20 border border-purple-500 text-purple-400 rounded-full hover:bg-purple-600 hover:text-white transition-all"
        >
          Check
        </button>
        <button
          onClick={() => onBet?.(bet)}
          data-testid="bet-raise-btn"
          className="px-6 py-2 bg-cyan-500 text-black font-bold rounded-full shadow-[0_0_20px_#22d3ee] active:scale-95"
        >
          Raise Bet
        </button>
      </div>
    </div>
  );
};
