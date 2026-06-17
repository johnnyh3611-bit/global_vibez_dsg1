/**
 * Three Card Poker — Player vs Dealer · Pair Plus side bet.
 * Wires to /api/games/three-card-poker/*.
 */
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Crown, Coins } from "lucide-react";
import CasinoTableEnhancer, { ChipStakeSelector } from "@/components/games/CasinoTableEnhancer";
import cardSoundManager from "@/utils/cardSoundManager";

const API = process.env.REACT_APP_BACKEND_URL;
const SUIT: Record<string, string> = { S: "♠", H: "♥", D: "♦", C: "♣" };
const SUIT_C: Record<string, string> = { S: "text-neutral-100", H: "text-rose-400", D: "text-rose-400", C: "text-neutral-100" };

interface CardT { rank: string; suit: string; }
interface PlayResult {
  player_hand: CardT[]; dealer_hand: CardT[];
  player_category: string; dealer_category: string;
  dealer_qualifies: boolean; folded: boolean;
  ante_payout: number; play_payout: number;
  pair_plus_payout: number; ante_bonus: number;
  gross: number; tax: number; net: number;
}

function PCard({ card, hidden }: { card?: CardT; hidden?: boolean }) {
  if (!card) return <div className="w-16 h-24 rounded-xl border-2 border-white/10" />;
  return (
    <motion.div initial={{ rotateY: 180, opacity: 0 }} animate={{ rotateY: 0, opacity: 1 }}
      data-testid={`tcp-card-${card.rank}-${card.suit}`}
      className={`w-16 h-24 rounded-xl border-2 flex flex-col items-center justify-center font-bold text-2xl ${
        hidden ? "bg-gradient-to-br from-purple-700 to-blue-900 border-white/30 text-white/30" :
                 `bg-gradient-to-br from-white to-neutral-200 border-white ${SUIT_C[card.suit]}`}`}>
      {hidden ? "?" : <><span>{card.rank}</span><span className="text-3xl">{SUIT[card.suit]}</span></>}
    </motion.div>
  );
}

export default function ThreeCardPoker() {
  const nav = useNavigate();
  const [ante, setAnte] = useState(10);
  const [pairPlus, setPairPlus] = useState(0);
  const [result, setResult] = useState<PlayResult | null>(null);
  const [phase, setPhase] = useState<"idle" | "decision" | "resolved">("idle");
  const [busy, setBusy] = useState(false);

  const startRound = () => { setPhase("decision"); setResult(null); };

  const decide = useCallback(async (raise_play: boolean) => {
    setBusy(true);
    const res: PlayResult = await fetch(`${API}/api/games/three-card-poker/play`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ante, raise_play, pair_plus: pairPlus }),
    }).then(r => r.json());
    setResult(res);
    setPhase("resolved");
    setBusy(false);
  }, [ante, pairPlus]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-rose-950/20 to-black text-white pb-28 md:pb-8" data-testid="three-card-poker-page">
      <div className="sticky top-0 z-30 backdrop-blur-md bg-black/70 border-b border-white/10">
        <div className="max-w-5xl mx-auto px-4 sm:px-5 py-3 flex items-center gap-3 sm:gap-4">
          <button onClick={() => nav(-1)} data-testid="tcp-back-btn" className="p-2 rounded-lg hover:bg-white/10 shrink-0"><ArrowLeft className="w-5 h-5" /></button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Crown className="w-5 h-5 text-rose-400 shrink-0" />
              <h1 className="text-lg font-black tracking-wide">Three Card Poker</h1>
              <span className="text-[10px] font-mono uppercase tracking-widest text-rose-300 bg-rose-500/10 border border-rose-500/30 px-2 py-0.5 rounded hidden sm:inline">PAIR PLUS · 40:1 ROYAL</span>
            </div>
            <p className="text-xs text-neutral-400 mt-0.5 truncate">3 cards · Q-high qualifier · Ante bonus on straight+</p>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-5 py-5 sm:py-6 space-y-5">
        {/* AAA enhancer (Feb 2026 Late × 5) */}
        <CasinoTableEnhancer
          gameId="tcp"
          phase={busy ? 'rolling' : (phase === 'resolved' && result ? (result.net > 0 ? 'won' : 'lost') : 'betting')}
          labels={{
            betting: phase === 'decision' ? 'FOLD OR RAISE' : 'PLACE ANTE',
            rolling: 'DEALING…',
          }}
        />
        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-emerald-950/40 to-black p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs uppercase tracking-widest text-emerald-300">Dealer</span>
            {result && <span className="text-xs text-neutral-400">{result.dealer_qualifies ? `Qualifies — ${result.dealer_category}` : `Doesn't Qualify — ${result.dealer_category}`}</span>}
          </div>
          <div className="flex justify-center gap-2">
            {(result?.dealer_hand ?? Array(3).fill(null)).map((c, i) => <PCard key={i} card={c} hidden={!result} />)}
          </div>
        </div>

        <div className="rounded-2xl border border-rose-500/40 bg-gradient-to-br from-rose-950/30 to-black p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs uppercase tracking-widest text-rose-300">Your Hand</span>
            {result && <span className="text-xs text-neutral-400">{result.player_category}</span>}
          </div>
          <div className="flex justify-center gap-2">
            {(result?.player_hand ?? Array(3).fill(null)).map((c, i) => <PCard key={i} card={c} />)}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/40 p-5">
          {phase === "idle" && (
            <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-end gap-3">
              <div className="flex flex-col text-xs">
                <span className="text-neutral-400 uppercase tracking-widest mb-1.5">Ante</span>
                <ChipStakeSelector
                  stake={ante}
                  onChange={(n) => { cardSoundManager.playChipClink?.(); setAnte(n); }}
                  disabled={busy}
                  testid="tcp-ante"
                />
              </div>
              <label className="flex flex-col text-xs">
                <span className="text-neutral-400 uppercase">Pair Plus</span>
                <select value={pairPlus} onChange={e => setPairPlus(parseFloat(e.target.value))} disabled={busy} data-testid="tcp-pp-select" className="mt-1 bg-black border border-white/20 rounded-lg px-3 py-2 font-mono">
                  {[0, 5, 10, 25, 50].map(n => <option key={n} value={n}>₵{n}</option>)}
                </select>
              </label>
              <button onClick={startRound} disabled={busy} data-testid="tcp-deal-btn" className="hidden md:block sm:ml-auto px-6 py-2.5 rounded-full bg-gradient-to-r from-rose-500 to-pink-500 text-white font-black tracking-wide hover:brightness-110">DEAL</button>
            </div>
          )}
          {phase === "decision" && (
            <div className="flex justify-center gap-3">
              <button onClick={() => decide(false)} disabled={busy} data-testid="tcp-fold-btn" className="px-6 py-3 rounded-full bg-rose-500 hover:bg-rose-400 text-white font-bold">FOLD (lose ante)</button>
              <button onClick={() => decide(true)} disabled={busy} data-testid="tcp-raise-btn" className="px-6 py-3 rounded-full bg-gradient-to-r from-yellow-400 to-amber-500 text-black font-black">RAISE (${ante})</button>
            </div>
          )}
          {phase === "resolved" && result && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div><div className="text-[10px] text-neutral-500 uppercase">Ante</div><div className={`font-mono font-bold ${result.ante_payout >= 0 ? "text-emerald-300" : "text-rose-300"}`}>₵{result.ante_payout.toFixed(2)}</div></div>
                <div><div className="text-[10px] text-neutral-500 uppercase">Play</div><div className={`font-mono font-bold ${result.play_payout >= 0 ? "text-emerald-300" : "text-rose-300"}`}>₵{result.play_payout.toFixed(2)}</div></div>
                <div><div className="text-[10px] text-neutral-500 uppercase">Bonus / PP</div><div className="font-mono font-bold text-yellow-300">₵{(result.ante_bonus + result.pair_plus_payout).toFixed(2)}</div></div>
                <div><div className="text-[10px] text-neutral-500 uppercase">Net</div><div className={`font-mono font-black text-lg ${result.net >= 0 ? "text-emerald-300" : "text-rose-300"}`} data-testid="tcp-net">₵{result.net.toFixed(2)}</div></div>
              </div>
              <button onClick={() => { setPhase("idle"); setResult(null); }} data-testid="tcp-new-btn" className="w-full py-2.5 rounded-full bg-white/10 hover:bg-white/20 font-bold">New Hand</button>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
          <h2 className="text-xs uppercase tracking-widest text-neutral-400 mb-3 flex items-center gap-1"><Coins className="w-3 h-3" /> Pair Plus Paytable</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm font-mono">
            <div className="flex justify-between bg-white/5 rounded-lg px-3 py-2"><span>Straight Flush</span><b className="text-yellow-300">40:1</b></div>
            <div className="flex justify-between bg-white/5 rounded-lg px-3 py-2"><span>Three of a Kind</span><b className="text-yellow-300">30:1</b></div>
            <div className="flex justify-between bg-white/5 rounded-lg px-3 py-2"><span>Straight</span><b className="text-yellow-300">6:1</b></div>
            <div className="flex justify-between bg-white/5 rounded-lg px-3 py-2"><span>Flush</span><b className="text-yellow-300">4:1</b></div>
            <div className="flex justify-between bg-white/5 rounded-lg px-3 py-2"><span>Pair</span><b className="text-yellow-300">1:1</b></div>
          </div>
        </div>
      </div>

      {/* Mobile-only sticky CTA — context-aware to phase. */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-black/90 backdrop-blur border-t border-white/10 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        {phase === "idle" && (
          <button onClick={startRound} disabled={busy} data-testid="tcp-deal-btn-mobile" className="w-full py-3 rounded-full bg-gradient-to-r from-rose-500 to-pink-500 text-white font-black tracking-widest disabled:opacity-50">DEAL · ${ante}</button>
        )}
        {phase === "decision" && (
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => decide(false)} disabled={busy} data-testid="tcp-fold-btn-mobile" className="py-3 rounded-full bg-rose-500 text-white font-black tracking-widest disabled:opacity-50">FOLD</button>
            <button onClick={() => decide(true)} disabled={busy} data-testid="tcp-raise-btn-mobile" className="py-3 rounded-full bg-gradient-to-r from-yellow-400 to-amber-500 text-black font-black tracking-widest disabled:opacity-50">RAISE ${ante}</button>
          </div>
        )}
        {phase === "resolved" && (
          <button onClick={() => { setPhase("idle"); setResult(null); }} data-testid="tcp-new-btn-mobile" className="w-full py-3 rounded-full bg-white/10 text-white font-black tracking-widest">NEW HAND</button>
        )}
      </div>
    </div>
  );
}
