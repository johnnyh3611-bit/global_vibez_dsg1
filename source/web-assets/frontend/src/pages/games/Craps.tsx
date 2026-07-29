/**
 * Craps Props — DSG variant.
 * Snake Eyes (1+1) · Boxcars (6+6) · both pay 30:1.
 * Wires to /api/games/craps/* (constants, prop).
 *
 * UX (2026 bet pass): BetSlip + presets + fixed 1.5s dice + GameVideoLayout shell.
 */
import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Flame, Trophy } from "lucide-react";
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
const PAYOUT = 30;
const MIN_BET = 50; // ₵50 platform floor
const MAX_BET = 500;

interface PropResult {
  won: boolean; stake: number; payout_ratio: number;
  gross: number; tax: number; net: number;
  dice: [number, number];
}

export default function Craps() {
  const nav = useNavigate();
  const tableCallVideo = useGameTableCallVideo();
  const [prop, setProp] = useState<"snake_eyes" | "boxcars">("snake_eyes");
  const [stake, setStake] = useState(MIN_BET);
  const [dice, setDice] = useState<[number, number] | null>(null);
  const [result, setResult] = useState<PropResult | null>(null);
  const [rolling, setRolling] = useState(false);
  const [slipOpen, setSlipOpen] = useState(true);

  const selectionLabel = prop === "snake_eyes" ? "Snake Eyes (1-1)" : "Boxcars (6-6)";

  const roll = useCallback(async () => {
    if (stake < MIN_BET) {
      notifyBetError(`Minimum bet is ₵${MIN_BET}`);
      return;
    }
    setRolling(true);
    setResult(null);
    notifyBetPlaced(stake, `${selectionLabel} · ₵${stake}`);
    try {
      await runFixedDiceRoll((faces) => {
        setDice([faces[0], faces[1]]);
      }, 2);

      // The backend rolls the dice server-side — the client only animates
      // and then settles on the authoritative roll from the response.
      const res: PropResult = await fetch(`${API}/api/games/craps/prop`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prop, stake }),
      }).then((r) => r.json());
      if ((res as any)?.detail) {
        notifyBetError(String((res as any).detail));
      } else {
        setDice([res.dice[0], res.dice[1]]);
        setResult(res);
      }
    } catch {
      notifyBetError("Roll failed — try again");
    } finally {
      setRolling(false);
    }
  }, [prop, stake, selectionLabel]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-orange-950/15 to-black text-white pb-40 md:pb-28" data-testid="craps-page">
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
            data-testid="craps-back-btn"
            className="p-2 rounded-lg hover:bg-white/10 shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Flame className="w-5 h-5 text-orange-400 shrink-0" />
              <h1 className="text-lg font-black tracking-wide">Craps Props</h1>
              <span className="text-[10px] font-mono uppercase tracking-widest text-orange-300 bg-orange-500/10 border border-orange-500/30 px-2 py-0.5 rounded hidden sm:inline">SNAKE EYES & BOXCARS · 30:1</span>
            </div>
            <p className="text-xs text-neutral-400 mt-0.5 truncate">
              Total bet ₵{stake} · Balance shown in slip
            </p>
          </div>
        </div>
      </div>

      <GameVideoLayout
        criticalDecision={rolling || (!result && slipOpen)}
        testid="craps-video-layout"
        video={tableCallVideo}
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-5 py-5 sm:py-6 space-y-5">
          <CasinoTableEnhancer
            gameId="craps"
            phase={rolling ? "rolling" : (result ? (result.won ? "won" : "lost") : "betting")}
            labels={{ rolling: "ROLLING DICE", won: "WINNER!", lost: "NO WIN" }}
          />

          <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-orange-950/40 to-black p-6 sm:p-8 flex justify-center gap-4 sm:gap-6">
            {(dice ?? [0, 0]).map((d, i) => (
              <div key={i} data-testid={`craps-die-${i}`}>
                <PremiumDice value={d || 1} rolling={rolling} isQualifier={!!result?.won && d > 0} />
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/40 p-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setProp("snake_eyes")} data-testid="craps-bet-snake" className={`p-4 rounded-2xl border-2 text-left ${prop === "snake_eyes" ? "border-emerald-400 bg-emerald-500/10" : "border-white/10 hover:bg-white/5"}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="inline-block scale-[0.6] origin-left -my-2"><PremiumDice value={1} rolling={false} /></span>
                  <span className="inline-block scale-[0.6] origin-left -my-2 -ml-4"><PremiumDice value={1} rolling={false} /></span>
                </div>
                <div className="text-xs uppercase tracking-widest text-neutral-400">Snake Eyes</div>
                <div className="text-yellow-300 font-mono font-bold">30:1</div>
              </button>
              <button onClick={() => setProp("boxcars")} data-testid="craps-bet-box" className={`p-4 rounded-2xl border-2 text-left ${prop === "boxcars" ? "border-emerald-400 bg-emerald-500/10" : "border-white/10 hover:bg-white/5"}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="inline-block scale-[0.6] origin-left -my-2"><PremiumDice value={6} rolling={false} /></span>
                  <span className="inline-block scale-[0.6] origin-left -my-2 -ml-4"><PremiumDice value={6} rolling={false} /></span>
                </div>
                <div className="text-xs uppercase tracking-widest text-neutral-400">Boxcars</div>
                <div className="text-yellow-300 font-mono font-bold">30:1</div>
              </button>
            </div>
            <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-end gap-3">
              <div className="flex flex-col text-xs">
                <span className="text-neutral-400 uppercase tracking-widest mb-1.5">Chip Stake</span>
                <ChipStakeSelector
                  stake={stake}
                  onChange={(n) => { cardSoundManager.playChipClink?.(); setStake(n); setSlipOpen(true); }}
                  disabled={rolling}
                  testid="craps-stake"
                />
              </div>
              <BetButton
                testid="craps-roll-btn"
                className="hidden md:inline-flex sm:ml-auto"
                disabled={rolling}
                onClick={() => { setSlipOpen(true); roll(); }}
              >
                {rolling ? "Rolling…" : "Roll"}
              </BetButton>
            </div>
          </div>

          <AnimatePresence>
            {result && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                data-testid="craps-result"
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
        payoutRatio={PAYOUT}
        selectionLabel={selectionLabel}
        minBet={MIN_BET}
        maxBet={MAX_BET}
        balance={0}
        confirming={rolling}
        disabled={rolling}
        onStakeChange={setStake}
        onConfirm={roll}
        confirmLabel={rolling ? "Rolling…" : "Confirm & roll"}
        testid="craps-bet-slip"
      />

      <div className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-black/90 backdrop-blur border-t border-white/10 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <BetButton testid="craps-roll-btn-mobile" disabled={rolling} onClick={roll}>
          {rolling ? "Rolling…" : `Roll · ₵${stake}`}
        </BetButton>
      </div>
    </div>
  );
}
