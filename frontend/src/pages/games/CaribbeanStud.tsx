/**
 * Caribbean Stud Poker
 * Wires to /api/games/caribbean-stud/* (constants, deal, resolve)
 */
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Crown, Coins, Eye, EyeOff } from "lucide-react";
import CasinoTableEnhancer, { ChipStakeSelector } from "@/components/games/CasinoTableEnhancer";
import cardSoundManager from "@/utils/cardSoundManager";

const API = process.env.REACT_APP_BACKEND_URL;

interface CardT { rank: string; suit: string; }
interface DealResult { player_hand: CardT[]; dealer_hand: CardT[]; }
interface ResolveResult {
  player_category: string; dealer_category: string;
  dealer_qualifies: boolean; folded: boolean;
  ante: number; play_bet: number; ante_payout: number; play_payout: number;
  gross_total: number; sovereign_tax: number; net_total: number;
}

const SUIT: Record<string, string> = { S: "♠", H: "♥", D: "♦", C: "♣" };
const SUIT_COLOR: Record<string, string> = { S: "text-neutral-100", H: "text-rose-400", D: "text-rose-400", C: "text-neutral-100" };

function PlayingCard({ card, hidden }: { card: CardT; hidden?: boolean }) {
  return (
    <motion.div
      initial={{ rotateY: 180, opacity: 0 }}
      animate={{ rotateY: 0, opacity: 1 }}
      data-testid={`cs-card-${card.rank}-${card.suit}`}
      className={`w-16 h-24 rounded-xl border-2 flex flex-col items-center justify-center font-bold text-2xl
        ${hidden ? "bg-gradient-to-br from-purple-700 to-blue-900 border-white/30 text-white/30" :
          `bg-gradient-to-br from-white to-neutral-200 border-white ${SUIT_COLOR[card.suit]}`}`}
    >
      {hidden ? "?" : <>
        <span>{card.rank}</span>
        <span className="text-3xl">{SUIT[card.suit]}</span>
      </>}
    </motion.div>
  );
}

export default function CaribbeanStud() {
  const nav = useNavigate();
  const [payouts, setPayouts] = useState<Record<string, number>>({});
  const [dealt, setDealt] = useState<DealResult | null>(null);
  const [phase, setPhase] = useState<"idle" | "decision" | "resolved">("idle");
  const [ante, setAnte] = useState(10.0);
  const [showDealer, setShowDealer] = useState(false);
  const [resolved, setResolved] = useState<ResolveResult | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`${API}/api/games/caribbean-stud/constants`).then(r => r.json()).then(d => setPayouts(d.payout_table));
  }, []);

  const newDeal = useCallback(async () => {
    setBusy(true); setResolved(null); setShowDealer(false);
    const res: DealResult = await fetch(`${API}/api/games/caribbean-stud/deal`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    }).then(r => r.json());
    setDealt(res);
    setPhase("decision");
    setBusy(false);
  }, []);

  const resolve = useCallback(async (raise_play: boolean) => {
    if (!dealt) return;
    setBusy(true);
    const res: ResolveResult = await fetch(`${API}/api/games/caribbean-stud/resolve`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ player_hand: dealt.player_hand, dealer_hand: dealt.dealer_hand, ante, raise_play }),
    }).then(r => r.json());
    setResolved(res);
    setShowDealer(true);
    setPhase("resolved");
    setBusy(false);
  }, [dealt, ante]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-emerald-950/15 to-black text-white pb-28 md:pb-8" data-testid="caribbean-stud-page">
      <div className="sticky top-0 z-30 backdrop-blur-md bg-black/70 border-b border-white/10">
        <div className="max-w-5xl mx-auto px-4 sm:px-5 py-3 flex items-center gap-3 sm:gap-4">
          <button onClick={() => nav(-1)} data-testid="cs-back-btn" className="p-2 rounded-lg hover:bg-white/10 shrink-0"><ArrowLeft className="w-5 h-5" /></button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Crown className="w-5 h-5 text-yellow-400 shrink-0" />
              <h1 className="text-lg font-black tracking-wide">Caribbean Stud</h1>
              <span className="text-[10px] font-mono uppercase tracking-widest text-yellow-300 bg-yellow-500/10 border border-yellow-500/30 px-2 py-0.5 rounded hidden sm:inline">A-K QUALIFIER · ROYAL 100:1</span>
            </div>
            <p className="text-xs text-neutral-400 mt-0.5 truncate">5 cards vs dealer · Raise (2×) or Fold</p>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-5 py-5 sm:py-6 space-y-5">
        {/* AAA enhancer (Feb 2026 Late × 5) */}
        <CasinoTableEnhancer
          gameId="cs"
          phase={busy ? 'rolling' : (resolved ? (resolved.net_total > 0 ? 'won' : 'lost') : 'betting')}
          labels={{
            betting: phase === 'decision' ? 'FOLD OR RAISE 2×' : 'PLACE ANTE',
            rolling: 'DEALING…',
          }}
        />
        {/* Dealer */}
        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-emerald-950/40 to-black p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs uppercase tracking-widest text-emerald-300">Dealer</span>
            {phase !== "idle" && <span className="text-xs text-neutral-400">{showDealer ? (resolved ? `(${resolved.dealer_qualifies ? "Qualifies" : "Doesn't Qualify"} — ${resolved.dealer_category})` : "") : "Hidden"}</span>}
          </div>
          <div className="flex justify-center gap-2">
            {dealt ? dealt.dealer_hand.map((c, i) => <PlayingCard key={i} card={c} hidden={!showDealer} />) :
              [...Array(5)].map((_, i) => <div key={i} className="w-16 h-24 rounded-xl border-2 border-white/10" />)}
          </div>
        </div>

        {/* Player */}
        <div className="rounded-2xl border border-fuchsia-500/40 bg-gradient-to-br from-fuchsia-950/30 to-black p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs uppercase tracking-widest text-fuchsia-300">Your Hand</span>
            {dealt && <span className="text-xs text-neutral-400">{resolved?.player_category && `(${resolved.player_category})`}</span>}
          </div>
          <div className="flex justify-center gap-2">
            {dealt ? dealt.player_hand.map((c, i) => <PlayingCard key={i} card={c} />) :
              [...Array(5)].map((_, i) => <div key={i} className="w-16 h-24 rounded-xl border-2 border-white/10" />)}
          </div>
        </div>

        {/* Controls */}
        <div className="rounded-2xl border border-white/10 bg-black/40 p-5">
          {phase === "idle" && (
            <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-end gap-3">
              <div className="flex flex-col text-xs">
                <span className="text-neutral-400 uppercase tracking-widest mb-1.5">Ante</span>
                <ChipStakeSelector
                  stake={ante}
                  onChange={(n) => { cardSoundManager.playChipClink?.(); setAnte(n); }}
                  disabled={busy}
                  testid="cs-ante"
                />
              </div>
              <button onClick={newDeal} disabled={busy} data-testid="cs-deal-btn" className="hidden md:block sm:ml-auto px-6 py-2.5 rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 text-black font-black tracking-wide hover:brightness-110 disabled:opacity-50">DEAL</button>
            </div>
          )}
          {phase === "decision" && (
            <div className="flex justify-center gap-3">
              <button onClick={() => resolve(false)} disabled={busy} data-testid="cs-fold-btn" className="px-6 py-3 rounded-full bg-rose-500 hover:bg-rose-400 text-white font-bold">FOLD (lose ante)</button>
              <button onClick={() => resolve(true)} disabled={busy} data-testid="cs-raise-btn" className="px-6 py-3 rounded-full bg-gradient-to-r from-yellow-400 to-amber-500 text-black font-black">RAISE 2× (${(ante * 2).toFixed(2)})</button>
            </div>
          )}
          {phase === "resolved" && resolved && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div><div className="text-[10px] text-neutral-500 uppercase">Ante Payout</div><div className={`font-mono font-bold ${resolved.ante_payout > 0 ? "text-emerald-300" : resolved.ante_payout < 0 ? "text-rose-300" : ""}`}>${resolved.ante_payout.toFixed(2)}</div></div>
                <div><div className="text-[10px] text-neutral-500 uppercase">Play Payout</div><div className={`font-mono font-bold ${resolved.play_payout > 0 ? "text-emerald-300" : resolved.play_payout < 0 ? "text-rose-300" : ""}`}>${resolved.play_payout.toFixed(2)}</div></div>
                <div><div className="text-[10px] text-neutral-500 uppercase">Sovereign Tax</div><div className="font-mono font-bold text-yellow-300">${resolved.sovereign_tax.toFixed(2)}</div></div>
                <div><div className="text-[10px] text-neutral-500 uppercase">Net Total</div><div className={`font-mono font-black text-lg ${resolved.net_total > 0 ? "text-emerald-300" : resolved.net_total < 0 ? "text-rose-300" : ""}`} data-testid="cs-net-total">${resolved.net_total.toFixed(2)}</div></div>
              </div>
              <button onClick={() => { setPhase("idle"); setDealt(null); setResolved(null); }} data-testid="cs-new-hand-btn" className="w-full py-2.5 rounded-full bg-white/10 hover:bg-white/20 font-bold">New Hand</button>
            </div>
          )}
        </div>

        {/* Paytable */}
        <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
          <h2 className="text-xs uppercase tracking-widest text-neutral-400 mb-3 flex items-center gap-1"><Coins className="w-3 h-3" /> Play Bet Payout Table</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm font-mono">
            {Object.entries(payouts).reverse().map(([cat, mult]) => (
              <div key={cat} className="flex justify-between bg-white/5 rounded-lg px-3 py-2">
                <span className="capitalize">{cat.replace(/_/g, " ")}</span>
                <b className="text-yellow-300">{mult}:1</b>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Mobile-only sticky CTA — context-aware to phase. */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-black/90 backdrop-blur border-t border-white/10 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        {phase === "idle" && (
          <button onClick={newDeal} disabled={busy} data-testid="cs-deal-btn-mobile" className="w-full py-3 rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 text-black font-black tracking-widest disabled:opacity-50">DEAL · ${ante.toFixed(0)}</button>
        )}
        {phase === "decision" && (
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => resolve(false)} disabled={busy} data-testid="cs-fold-btn-mobile" className="py-3 rounded-full bg-rose-500 text-white font-black tracking-widest disabled:opacity-50">FOLD</button>
            <button onClick={() => resolve(true)} disabled={busy} data-testid="cs-raise-btn-mobile" className="py-3 rounded-full bg-gradient-to-r from-yellow-400 to-amber-500 text-black font-black tracking-widest disabled:opacity-50">RAISE 2× ${(ante * 2).toFixed(0)}</button>
          </div>
        )}
        {phase === "resolved" && (
          <button onClick={() => { setPhase("idle"); setDealt(null); setResolved(null); }} data-testid="cs-new-hand-btn-mobile" className="w-full py-3 rounded-full bg-white/10 text-white font-black tracking-widest">NEW HAND</button>
        )}
      </div>
    </div>
  );
}
