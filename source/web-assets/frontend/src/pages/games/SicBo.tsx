/**
 * Sic Bo — DSG variant.
 * Specific Triple pays 180:1 · Any Triple pays 30:1.
 *
 * UX (2026 bet pass): BetSlip + presets + fixed 1.5s dice + GameVideoLayout.
 */
import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Dices, Trophy } from "lucide-react";
import { PremiumDice } from "@/components/games/vibedice654/PremiumDice";
import CasinoTableEnhancer, { ChipStakeSelector } from "@/components/games/CasinoTableEnhancer";
import BetSlip, {
  BetButton,
  notifyBetError,
  notifyBetPlaced,
  runFixedDiceRoll,
} from "@/components/betting/BetSlip";
import GameVideoLayout from "@/components/video/GameVideoLayout";
import { useGameTableCallVideo } from "@/components/video/GameTableCallVideo";
import cardSoundManager from "@/utils/cardSoundManager";

const API = process.env.REACT_APP_BACKEND_URL;
const MIN_BET = 5;
const MAX_BET = 500;

interface PlayResult {
  won: boolean; stake: number; payout_ratio: number;
  gross: number; tax: number; net: number;
}

export default function SicBo() {
  const nav = useNavigate();
  const tableCallVideo = useGameTableCallVideo();
  const [betType, setBetType] = useState<string>("any_triple");
  const [stake, setStake] = useState(10);
  const [dice, setDice] = useState<number[] | null>(null);
  const [result, setResult] = useState<PlayResult | null>(null);
  const [rolling, setRolling] = useState(false);
  const [slipOpen, setSlipOpen] = useState(true);

  const triples = [1, 2, 3, 4, 5, 6].map((n) => `specific_triple_${n}`);
  const payoutRatio = betType === "any_triple" ? 30 : 180;
  const selectionLabel = useMemo(() => {
    if (betType === "any_triple") return "Any Triple";
    const n = betType.replace("specific_triple_", "");
    return `Specific Triple ${n}`;
  }, [betType]);

  const roll = useCallback(async () => {
    if (stake < MIN_BET) {
      notifyBetError(`Minimum bet is ₵${MIN_BET}`);
      return;
    }
    setRolling(true);
    setResult(null);
    notifyBetPlaced(stake, `${selectionLabel} · ₵${stake}`);
    try {
      await runFixedDiceRoll((faces) => setDice(faces), 3);
      const rollRes = await fetch(`${API}/api/games/sic-bo/roll`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      }).then((r) => r.json());
      const finalDice = rollRes.dice as number[];
      setDice(finalDice);
      const playRes: PlayResult = await fetch(`${API}/api/games/sic-bo/play`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bet_type: betType, dice: finalDice, stake }),
      }).then((r) => r.json());
      if ((playRes as any)?.detail) {
        notifyBetError(String((playRes as any).detail));
      } else {
        setResult(playRes);
      }
    } catch {
      notifyBetError("Roll failed — try again");
    } finally {
      setRolling(false);
    }
  }, [betType, stake, selectionLabel]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-rose-950/15 to-black text-white pb-40 md:pb-28" data-testid="sic-bo-page">
      <div className="sticky top-0 z-30 backdrop-blur-md bg-black/70 border-b border-white/10">
        <div className="max-w-5xl mx-auto px-4 sm:px-5 py-3 flex items-center gap-3 sm:gap-4">
          <button
            onClick={() => {
              if (rolling) {
                notifyBetError("Finish this roll before leaving");
                return;
              }
              nav(-1);
            }}
            data-testid="sicbo-back-btn"
            className="p-2 rounded-lg hover:bg-white/10 shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Dices className="w-5 h-5 text-rose-400 shrink-0" />
              <h1 className="text-lg font-black tracking-wide">Sic Bo</h1>
              <span className="text-[10px] font-mono uppercase tracking-widest text-rose-300 bg-rose-500/10 border border-rose-500/30 px-2 py-0.5 rounded hidden sm:inline">SPECIFIC TRIPLE 180:1</span>
            </div>
            <p className="text-xs text-neutral-400 mt-0.5 truncate">
              Total bet ₵{stake} · {selectionLabel}
            </p>
          </div>
        </div>
      </div>

      <GameVideoLayout
        criticalDecision={rolling || (!result && slipOpen)}
        testid="sicbo-video-layout"
        video={tableCallVideo}
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-5 py-5 sm:py-6 space-y-5">
          <CasinoTableEnhancer
            gameId="sicbo"
            phase={rolling ? "rolling" : (result ? (result.won ? "won" : "lost") : "betting")}
            labels={{ rolling: "ROLLING DICE" }}
          />

          <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-rose-950/40 to-black p-6 sm:p-8 flex justify-center gap-3 sm:gap-6 flex-wrap">
            {(dice ?? [0, 0, 0]).map((d, i) => (
              <div key={i} data-testid={`sicbo-die-${i}`}>
                <PremiumDice value={d || 1} rolling={rolling} isQualifier={!!result?.won && d > 0} />
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/40 p-5 space-y-4">
            <div className="flex flex-wrap gap-2">
              <button onClick={() => { setBetType("any_triple"); setSlipOpen(true); }} data-testid="sicbo-bet-any-triple" className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest ${betType === "any_triple" ? "bg-yellow-400 text-black" : "bg-white/5 hover:bg-white/10"}`}>Any Triple (30:1)</button>
              {triples.map((t, i) => (
                <button key={t} onClick={() => { setBetType(t); setSlipOpen(true); }} data-testid={`sicbo-bet-${t}`} className={`px-3 py-2 rounded-full text-xs font-bold inline-flex items-center gap-2 ${betType === t ? "bg-emerald-400 text-black" : "bg-white/5 hover:bg-white/10"}`}>
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
                  onChange={(n) => { cardSoundManager.playChipClink?.(); setStake(n); setSlipOpen(true); }}
                  disabled={rolling}
                  testid="sicbo-stake"
                />
              </div>
              <BetButton
                testid="sicbo-roll-btn"
                className="hidden md:inline-flex sm:ml-auto"
                disabled={rolling}
                onClick={roll}
              >
                {rolling ? "Rolling…" : "Roll dice"}
              </BetButton>
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
                  <div><div className="text-[10px] text-neutral-500">REWARD</div><b className="text-cyan-300">{result.payout_ratio}:1</b></div>
                  <div><div className="text-[10px] text-neutral-500">GROSS</div><b className="text-emerald-300">₵{result.gross.toFixed(2)}</b></div>
                  <div><div className="text-[10px] text-neutral-500">TAX</div><b className="text-yellow-300">₵{result.tax.toFixed(2)}</b></div>
                  <div><div className="text-[10px] text-neutral-500">NET</div><b className="text-emerald-200">₵{result.net.toFixed(2)}</b></div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </GameVideoLayout>

      <BetSlip
        open={slipOpen && !result}
        stake={stake}
        payoutRatio={payoutRatio}
        selectionLabel={selectionLabel}
        minBet={MIN_BET}
        maxBet={MAX_BET}
        confirming={rolling}
        disabled={rolling}
        onStakeChange={setStake}
        onConfirm={roll}
        confirmLabel={rolling ? "Rolling…" : "Confirm & roll"}
        testid="sicbo-bet-slip"
      />

      <div className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-black/90 backdrop-blur border-t border-white/10 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <BetButton testid="sicbo-roll-btn-mobile" disabled={rolling} onClick={roll}>
          {rolling ? "Rolling…" : `Roll · ₵${stake}`}
        </BetButton>
      </div>
    </div>
  );
}
