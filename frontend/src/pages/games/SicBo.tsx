/**
 * Sic Bo — DSG variant.
 * Specific Triple pays 180:1 · Any Triple pays 30:1.
 * Wires to /api/games/sic-bo/* (constants, roll, play).
 */
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Dices, Trophy } from "lucide-react";
import { PremiumDice } from "@/components/games/vibedice654/PremiumDice";
import CasinoTableEnhancer, { ChipStakeSelector } from "@/components/games/CasinoTableEnhancer";
import cardSoundManager from "@/utils/cardSoundManager";

const API = process.env.REACT_APP_BACKEND_URL;

interface PlayResult {
  won: boolean; stake: number; payout_ratio: number;
  gross: number; tax: number; net: number;
}

export default function SicBo() {
  const nav = useNavigate();
  const [betType, setBetType] = useState<string>("any_triple");
  const [stake, setStake] = useState(10);
  const [dice, setDice] = useState<number[] | null>(null);
  const [result, setResult] = useState<PlayResult | null>(null);
  const [rolling, setRolling] = useState(false);

  const triples = [1, 2, 3, 4, 5, 6].map(n => `specific_triple_${n}`);

  const roll = useCallback(async () => {
    setRolling(true);
    setResult(null);
    // animate dice cycling
    for (let i = 0; i < 6; i++) {
      setDice([
        Math.ceil(Math.random() * 6),
        Math.ceil(Math.random() * 6),
        Math.ceil(Math.random() * 6),
      ]);
      // eslint-disable-next-line no-await-in-loop
      await new Promise(r => setTimeout(r, 80));
    }
    const rollRes = await fetch(`${API}/api/games/sic-bo/roll`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
    }).then(r => r.json());
    const finalDice = rollRes.dice as number[];
    setDice(finalDice);
    const playRes: PlayResult = await fetch(`${API}/api/games/sic-bo/play`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bet_type: betType, dice: finalDice, stake }),
    }).then(r => r.json());
    setResult(playRes);
    setRolling(false);
  }, [betType, stake]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-rose-950/15 to-black text-white pb-28 md:pb-8" data-testid="sic-bo-page">
      <div className="sticky top-0 z-30 backdrop-blur-md bg-black/70 border-b border-white/10">
        <div className="max-w-5xl mx-auto px-4 sm:px-5 py-3 flex items-center gap-3 sm:gap-4">
          <button onClick={() => nav(-1)} data-testid="sicbo-back-btn" className="p-2 rounded-lg hover:bg-white/10 shrink-0"><ArrowLeft className="w-5 h-5" /></button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Dices className="w-5 h-5 text-rose-400 shrink-0" />
              <h1 className="text-lg font-black tracking-wide">Sic Bo</h1>
              <span className="text-[10px] font-mono uppercase tracking-widest text-rose-300 bg-rose-500/10 border border-rose-500/30 px-2 py-0.5 rounded hidden sm:inline">SPECIFIC TRIPLE 180:1</span>
            </div>
            <p className="text-xs text-neutral-400 mt-0.5 truncate">3-dice Asian table · pick a bet, roll, win</p>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-5 py-5 sm:py-6 space-y-5">
        {/* AAA enhancer (Feb 2026 Late × 5) */}
        <CasinoTableEnhancer
          gameId="sicbo"
          phase={rolling ? 'rolling' : (result ? (result.won ? 'won' : 'lost') : 'betting')}
          labels={{ rolling: 'ROLLING DICE' }}
        />

        {/* Dice tray */}
        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-rose-950/40 to-black p-6 sm:p-8 flex justify-center gap-3 sm:gap-6 flex-wrap">
          {(dice ?? [0, 0, 0]).map((d, i) => (
            <div key={i} data-testid={`sicbo-die-${i}`}>
              <PremiumDice value={d || 1} rolling={rolling} isQualifier={!!result?.won && d > 0} />
            </div>
          ))}
        </div>

        {/* Bet selection */}
        <div className="rounded-2xl border border-white/10 bg-black/40 p-5 space-y-4">
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setBetType("any_triple")} data-testid="sicbo-bet-any-triple" className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest ${betType === "any_triple" ? "bg-yellow-400 text-black" : "bg-white/5 hover:bg-white/10"}`}>Any Triple (30:1)</button>
            {triples.map((t, i) => (
              <button key={t} onClick={() => setBetType(t)} data-testid={`sicbo-bet-${t}`} className={`px-3 py-2 rounded-full text-xs font-bold inline-flex items-center gap-2 ${betType === t ? "bg-emerald-400 text-black" : "bg-white/5 hover:bg-white/10"}`}>
                <span className="inline-block scale-50 origin-center -my-2"><PremiumDice value={i + 1} rolling={false} /></span>
                <span>180:1</span>
              </button>
            ))}
          </div>
          <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-end gap-3">
            <div className="flex flex-col text-xs">
              <span className="text-neutral-400 uppercase tracking-widest mb-1.5">Chip Stake</span>
              <ChipStakeSelector
                stake={stake}
                onChange={(n) => { cardSoundManager.playChipClink?.(); setStake(n); }}
                disabled={rolling}
                testid="sicbo-stake"
              />
            </div>
            <button onClick={roll} disabled={rolling} data-testid="sicbo-roll-btn" className="hidden md:block sm:ml-auto px-6 py-2.5 rounded-full bg-gradient-to-r from-rose-500 to-orange-500 text-black font-black tracking-wide hover:brightness-110 disabled:opacity-50">{rolling ? "ROLLING…" : "ROLL DICE"}</button>
          </div>
        </div>

        <AnimatePresence>
          {result && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              data-testid="sicbo-result"
              className={`rounded-2xl border-2 p-5 ${result.won ? "border-emerald-400 bg-emerald-900/20" : "border-rose-500/40 bg-rose-950/10"}`}>
              <div className="flex items-center gap-2 mb-3">
                <Trophy className={`w-5 h-5 ${result.won ? "text-emerald-300" : "text-rose-400"}`} />
                <h3 className="font-bold uppercase tracking-widest">{result.won ? "WINNER!" : "No Win"}</h3>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm font-mono">
                <div><div className="text-[10px] text-neutral-500">PAYOUT</div><b className="text-cyan-300">{result.payout_ratio}:1</b></div>
                <div><div className="text-[10px] text-neutral-500">GROSS</div><b className="text-emerald-300">${result.gross.toFixed(2)}</b></div>
                <div><div className="text-[10px] text-neutral-500">TAX</div><b className="text-yellow-300">${result.tax.toFixed(2)}</b></div>
                <div><div className="text-[10px] text-neutral-500">NET</div><b className="text-emerald-200">${result.net.toFixed(2)}</b></div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Mobile-only sticky ROLL CTA (Feb 2026 Late × 5) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-black/90 backdrop-blur border-t border-white/10 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <button onClick={roll} disabled={rolling} data-testid="sicbo-roll-btn-mobile" className="w-full py-3 rounded-full bg-gradient-to-r from-rose-500 to-orange-500 text-black font-black tracking-widest disabled:opacity-50">
          {rolling ? "ROLLING…" : `ROLL · $${stake}`}
        </button>
      </div>
    </div>
  );
}
