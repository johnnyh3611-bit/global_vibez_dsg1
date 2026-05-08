/**
 * PracticeBaccarat (AAA variant) — local-only practice room.
 * Matches BaccaratPremium aesthetic but runs the rules client-side
 * (no API). Used by /practice/play/baccarat.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Bot, Sparkles, Trophy } from "lucide-react";
import cardSoundManager from "@/utils/cardSoundManager";

import SpadesTable from "@/components/spades/SpadesTable";
import SpadesCard from "@/components/spades/SpadesCard";
import SpadesStatusBanner from "@/components/spades/SpadesStatusBanner";
import SpadesGameMenu from "@/components/spades/SpadesGameMenu";
import SpadesCommunityChat from "@/components/spades/SpadesCommunityChat";
import type { SpadesCard as CardData, StatusMessage } from "@/components/spades/types";

type BetZone = "player" | "banker" | "tie";

const CARD_VALUES: Record<string, number> = {
  A: 1, "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9,
  "10": 0, J: 0, Q: 0, K: 0,
};
const SUITS = ["hearts", "diamonds", "clubs", "spades"];
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const CHIP_VALUES = [5, 25, 100, 500];

function makeShoe(): CardData[] {
  const shoe: CardData[] = [];
  for (let d = 0; d < 8; d++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        shoe.push({ suit, rank, value: CARD_VALUES[rank] } as unknown as CardData);
      }
    }
  }
  return shoe.sort(() => Math.random() - 0.5);
}

function score(hand: CardData[]): number {
  return hand.reduce((s, c) => s + (CARD_VALUES[(c as { rank: string }).rank] ?? 0), 0) % 10;
}

// ─── chip ──────────────────────────────────────────────────────────────
function VibezChip({ value, selected, onClick, disabled }: { value: number; selected: boolean; onClick: () => void; disabled?: boolean }) {
  const grad =
    value >= 500 ? "linear-gradient(135deg, #9333ea, #db2777)" :   // audit:allow-hex
    value >= 100 ? "linear-gradient(135deg, #0f172a, #334155)" :   // audit:allow-hex
    value >= 25  ? "linear-gradient(135deg, #15803d, #22c55e)" :   // audit:allow-hex
                   "linear-gradient(135deg, #f59e0b, #fbbf24)";    // audit:allow-hex
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      whileHover={!disabled ? { scale: 1.08, y: -3 } : undefined}
      whileTap={!disabled ? { scale: 0.95 } : undefined}
      className={`relative w-14 h-14 md:w-16 md:h-16 rounded-full font-black flex items-center justify-center text-white shadow-lg transition-all ${
        selected ? "ring-4 ring-amber-400 scale-110 shadow-[0_0_18px_rgba(251,191,36,0.55)]" : ""
      } ${disabled ? "opacity-40" : "cursor-pointer"}`}
      style={{ background: grad, fontFamily: "'Cinzel', serif" }}
      data-testid={`baccarat-practice-chip-${value}`}
    >
      <div className="text-center leading-none">
        <div className="text-[10px] opacity-90">₵</div>
        <div className="text-base">{value}</div>
      </div>
    </motion.button>
  );
}

const ZONE_ACCENTS: Record<BetZone, { bg: string; ring: string; ink: string; ringSelected: string }> = {
  player: { bg: "bg-cyan-500/15", ring: "border-cyan-400/30", ringSelected: "border-cyan-300/80", ink: "text-cyan-100" },
  banker: { bg: "bg-rose-500/15", ring: "border-rose-400/30", ringSelected: "border-rose-300/80", ink: "text-rose-100" },
  tie:    { bg: "bg-emerald-500/15", ring: "border-emerald-400/30", ringSelected: "border-emerald-300/80", ink: "text-emerald-100" },
};

function BetZoneBtn({ zone, label, payout, currentBet, selected, onClick, disabled }: { zone: BetZone; label: string; payout: string; currentBet: number; selected: boolean; onClick: () => void; disabled: boolean }) {
  const a = ZONE_ACCENTS[zone];
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      whileHover={!disabled ? { scale: 1.03 } : undefined}
      whileTap={!disabled ? { scale: 0.98 } : undefined}
      className={`relative flex-1 px-4 py-5 rounded-xl border-2 backdrop-blur-sm transition-all overflow-hidden ${
        selected ? `${a.bg} ${a.ringSelected}` : `bg-black/40 ${a.ring}`
      } ${disabled ? "opacity-50" : "cursor-pointer"}`}
      data-testid={`baccarat-practice-bet-zone-${zone}`}
    >
      <div className={`relative text-2xl md:text-3xl font-black uppercase tracking-[0.3em] ${a.ink}`} style={{ fontFamily: "'Cinzel', serif" }}>
        {label}
      </div>
      <div className={`relative mt-1 text-[10px] uppercase tracking-widest ${a.ink} opacity-75`}>Pays {payout}</div>
      {currentBet > 0 ? (
        <div className="relative mt-3 inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-400/15 border border-amber-300/50 text-amber-200 font-black tabular-nums">
          ₵{currentBet}
        </div>
      ) : null}
    </motion.button>
  );
}

export default function PracticeBaccarat() {
  const navigate = useNavigate();
  const [credits, setCredits] = useState(1000);
  const [currentBet, setCurrentBet] = useState(0);
  const [betType, setBetType] = useState<BetZone | null>(null);
  const [chipValue, setChipValue] = useState(25);
  const [phase, setPhase] = useState<"betting" | "dealing" | "result">("betting");
  const [playerHand, setPlayerHand] = useState<CardData[]>([]);
  const [bankerHand, setBankerHand] = useState<CardData[]>([]);
  const [playerScore, setPlayerScore] = useState(0);
  const [bankerScore, setBankerScore] = useState(0);
  const [winner, setWinner] = useState<BetZone | null>(null);
  const [lastWin, setLastWin] = useState(0);
  const [statusMsg, setStatusMsg] = useState<StatusMessage | null>(null);
  const [chatOpen, setChatOpen] = useState(false);

  const flash = (text: string, tone: StatusMessage["tone"] = "amber", ttl = 1800) => {
    setStatusMsg({ text, tone, id: Date.now() });
    window.setTimeout(() => setStatusMsg((p) => (p && p.text === text ? null : p)), ttl);
  };

  const placeBet = (type: BetZone) => {
    if (phase !== "betting" || credits < chipValue) return;
    cardSoundManager.playChipClink?.();
    setBetType(type);
    setCurrentBet((b) => b + chipValue);
    setCredits((c) => c - chipValue);
  };

  const clearBet = () => {
    if (phase !== "betting" || !currentBet) return;
    setCredits((c) => c + currentBet);
    setCurrentBet(0);
    setBetType(null);
  };

  const finish = (pCards: CardData[], bCards: CardData[], pS: number, bS: number) => {
    setPlayerScore(pS);
    setBankerScore(bS);
    setPhase("result");
    let w: BetZone = "tie";
    let pay = 0;
    if (pS > bS) w = "player";
    else if (bS > pS) w = "banker";
    if (betType === w) {
      pay = w === "tie" ? currentBet * 9 : w === "banker" ? Math.floor(currentBet * 1.95) : currentBet * 2;
    } else if (w === "tie" && (betType === "player" || betType === "banker")) {
      pay = currentBet; // push
    }
    setWinner(w);
    setLastWin(pay);
    setCredits((c) => c + pay);
    flash(
      w === "tie" ? "Stand-Off · push" :
      betType === w ? `${w.toUpperCase()} wins · +₵${pay}` :
      `${w.toUpperCase()} wins`,
      betType === w ? "emerald" : "rose",
      2400,
    );
  };

  const deal = () => {
    if (!betType || currentBet === 0) return;
    setPhase("dealing");
    cardSoundManager.playCardShuffle?.();
    const shoe = makeShoe();
    const playerCards: CardData[] = [shoe[0], shoe[2]];
    const bankerCards: CardData[] = [shoe[1], shoe[3]];
    let idx = 4;
    setPlayerHand(playerCards);
    setBankerHand(bankerCards);
    setTimeout(() => {
      let pS = score(playerCards);
      let bS = score(bankerCards);
      if (pS >= 8 || bS >= 8) {
        finish(playerCards, bankerCards, pS, bS);
        return;
      }
      // Player third card rule
      let playerThirdValue: number | null = null;
      if (pS <= 5) {
        playerCards.push(shoe[idx++]);
        pS = score(playerCards);
        playerThirdValue = CARD_VALUES[(playerCards[2] as { rank: string }).rank] ?? 0;
        setPlayerHand([...playerCards]);
        cardSoundManager.playCardFlip?.();
      }
      setTimeout(() => {
        // Banker third card rule (standard punto banco)
        let draws = false;
        if (playerCards.length === 2) {
          if (bS <= 5) draws = true;
        } else {
          if (bS <= 2) draws = true;
          else if (bS === 3 && playerThirdValue !== 8) draws = true;
          else if (bS === 4 && playerThirdValue !== null && playerThirdValue >= 2 && playerThirdValue <= 7) draws = true;
          else if (bS === 5 && playerThirdValue !== null && playerThirdValue >= 4 && playerThirdValue <= 7) draws = true;
          else if (bS === 6 && playerThirdValue !== null && playerThirdValue >= 6 && playerThirdValue <= 7) draws = true;
        }
        if (draws) {
          bankerCards.push(shoe[idx++]);
          bS = score(bankerCards);
          setBankerHand([...bankerCards]);
          cardSoundManager.playCardFlip?.();
        }
        setTimeout(() => finish(playerCards, bankerCards, pS, bS), 900);
      }, playerCards.length > 2 ? 1200 : 500);
    }, 900);
  };

  const newRound = () => {
    setPhase("betting");
    setPlayerHand([]);
    setBankerHand([]);
    setPlayerScore(0);
    setBankerScore(0);
    setWinner(null);
    setCurrentBet(0);
    setBetType(null);
  };

  return (
    <div className="min-h-screen text-white bg-gradient-to-br from-emerald-950 via-slate-950 to-[#04060e] relative overflow-x-hidden" data-testid="baccarat-practice-aaa">
      <div className="flex items-start justify-between px-3 md:px-5 pt-3 md:pt-4 gap-2">
        <div className="flex flex-col items-start gap-2">
          <button onClick={() => navigate("/games")} className="flex items-center gap-1.5 text-emerald-200/70 hover:text-white transition text-xs md:text-sm font-bold" data-testid="baccarat-practice-leave">
            <ArrowLeft className="w-4 h-4" /> Lobby
          </button>
          <SpadesGameMenu onExit={() => navigate("/games")} onOpenMessages={() => setChatOpen(true)} />
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-center">
          <div className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-400/40 text-[9px] md:text-[10px] uppercase tracking-[0.3em] text-amber-200 font-bold">Baccarat</div>
          <div className="px-2 py-0.5 rounded-full bg-fuchsia-500/15 border border-fuchsia-400/40 text-[9px] md:text-[10px] uppercase tracking-[0.3em] text-fuchsia-300 font-bold">
            <span className="inline-flex items-center gap-1"><Bot className="w-2.5 h-2.5" /> Practice</span>
          </div>
          <div className="px-2 py-0.5 rounded-full bg-slate-900/80 border border-emerald-400/30 text-[9px] md:text-[10px] uppercase tracking-[0.3em] text-emerald-200 font-bold tabular-nums" data-testid="baccarat-practice-credits">
            ₵{credits.toLocaleString()} chips
          </div>
        </div>
        <div className="px-3 py-1.5 rounded-xl bg-slate-900/70 border border-amber-400/30 text-right">
          <div className="text-[9px] uppercase tracking-widest text-amber-200/70 font-bold">Bet</div>
          <div className="text-amber-200 font-black tabular-nums">₵{currentBet.toLocaleString()}</div>
        </div>
      </div>

      <SpadesStatusBanner message={statusMsg} />

      <div className="text-center pt-2 pb-3">
        <p className="text-[10px] uppercase tracking-[0.3em] text-emerald-300/70 font-bold" style={{ fontFamily: "'Cinzel', serif" }}>
          Practice Pit · Punto Banco
        </p>
        <h1 className="text-3xl md:text-4xl font-black text-amber-200 leading-tight" style={{ fontFamily: "'Cinzel', serif" }}>
          Baccarat
        </h1>
      </div>

      <div className="flex items-center justify-center py-2 md:py-3 relative">
        <div className="relative">
          <SpadesTable brandSubLabel="BACCARAT · PRACTICE" variant="monaco" centreGlyph="B">
            <div className="absolute inset-x-0 top-[18%] flex flex-col items-center gap-1 z-20">
              <div className="text-[10px] uppercase tracking-[0.3em] font-bold text-rose-300" style={{ fontFamily: "'Cinzel', serif" }}>
                Banker {bankerScore > 0 ? <span className="text-rose-200">· {bankerScore}</span> : null}
              </div>
              <div className="flex gap-2 min-h-[110px] items-center">
                <AnimatePresence>
                  {bankerHand.map((c, idx) => (
                    <motion.div key={`bnk-${idx}`} initial={{ y: -40, opacity: 0, rotate: -10 }} animate={{ y: 0, opacity: 1, rotate: (idx - 1) * 4 }} transition={{ duration: 0.42 }}>
                      <SpadesCard card={c} size="md" isPlayable={false} />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
            <div className="absolute inset-x-0 bottom-[18%] flex flex-col items-center gap-1 z-20">
              <div className="flex gap-2 min-h-[110px] items-center">
                <AnimatePresence>
                  {playerHand.map((c, idx) => (
                    <motion.div key={`pl-${idx}`} initial={{ y: 40, opacity: 0, rotate: 10 }} animate={{ y: 0, opacity: 1, rotate: (idx - 1) * 4 }} transition={{ duration: 0.42 }}>
                      <SpadesCard card={c} size="md" isPlayable={false} />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
              <div className="text-[10px] uppercase tracking-[0.3em] font-bold text-cyan-300" style={{ fontFamily: "'Cinzel', serif" }}>
                Player {playerScore > 0 ? <span className="text-cyan-200">· {playerScore}</span> : null}
              </div>
            </div>
          </SpadesTable>
        </div>
      </div>

      <AnimatePresence>
        {phase === "result" && winner ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92 }}
            className="mx-auto max-w-md mt-4 mb-2 px-6 py-3 rounded-2xl border-2 text-center backdrop-blur"
            style={{
              background: winner === "player" ? "rgba(34,211,238,0.12)" : winner === "banker" ? "rgba(244,63,94,0.12)" : "rgba(16,185,129,0.12)",
              borderColor: winner === "player" ? "rgba(34,211,238,0.55)" : winner === "banker" ? "rgba(244,63,94,0.55)" : "rgba(16,185,129,0.55)",
            }}
          >
            <p className="text-[10px] uppercase tracking-[0.3em] font-bold opacity-80" style={{ fontFamily: "'Cinzel', serif" }}>
              {winner === "tie" ? "Stand-Off" : `${winner.toUpperCase()} Wins`}
            </p>
            {lastWin > 0 ? <p className="text-amber-200 font-black text-xl tabular-nums">+₵{lastWin.toLocaleString()}</p> : null}
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="px-3 md:px-6 mt-2 max-w-4xl mx-auto pb-8">
        <div className="flex flex-col md:flex-row gap-3">
          <BetZoneBtn zone="player" label="Player" payout="1 : 1" currentBet={betType === "player" ? currentBet : 0} selected={betType === "player"} onClick={() => placeBet("player")} disabled={phase !== "betting"} />
          <BetZoneBtn zone="tie"    label="Tie"    payout="8 : 1" currentBet={betType === "tie" ? currentBet : 0}    selected={betType === "tie"}    onClick={() => placeBet("tie")}    disabled={phase !== "betting"} />
          <BetZoneBtn zone="banker" label="Banker" payout="0.95 : 1" currentBet={betType === "banker" ? currentBet : 0} selected={betType === "banker"} onClick={() => placeBet("banker")} disabled={phase !== "betting"} />
        </div>

        <div className="mt-4 px-4 py-3 rounded-2xl bg-slate-900/60 border border-amber-400/20 backdrop-blur">
          <p className="text-[10px] uppercase tracking-[0.3em] text-amber-200/70 font-bold text-center mb-2" style={{ fontFamily: "'Cinzel', serif" }}>
            Stake per click
          </p>
          <div className="flex justify-center gap-2 md:gap-3 flex-wrap">
            {CHIP_VALUES.map((v) => <VibezChip key={v} value={v} selected={chipValue === v} onClick={() => setChipValue(v)} disabled={phase !== "betting"} />)}
          </div>
        </div>

        <div className="mt-4 flex gap-3">
          {phase !== "result" ? (
            <>
              <button onClick={deal} disabled={phase !== "betting" || currentBet === 0} className="flex-1 px-4 py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black uppercase tracking-[0.3em] text-sm shadow-[0_0_24px_rgba(251,191,36,0.45)] disabled:opacity-40 disabled:cursor-not-allowed" style={{ fontFamily: "'Cinzel', serif" }} data-testid="baccarat-practice-deal-btn">
                {phase === "dealing" ? "Dealing…" : "Deal"}
              </button>
              <button onClick={clearBet} disabled={phase !== "betting" || !currentBet} className="px-4 py-3.5 rounded-xl bg-slate-800 border border-slate-600 hover:bg-slate-700 text-slate-200 font-bold uppercase tracking-[0.3em] text-sm disabled:opacity-40" data-testid="baccarat-practice-clear-btn">
                Clear
              </button>
            </>
          ) : (
            <button onClick={newRound} className="flex-1 px-4 py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black uppercase tracking-[0.3em] text-sm shadow-[0_0_24px_rgba(16,185,129,0.45)]" style={{ fontFamily: "'Cinzel', serif" }} data-testid="baccarat-practice-new-round-btn">
              <Sparkles className="inline w-4 h-4 mr-1.5 -mt-0.5" />
              New Round
            </button>
          )}
        </div>

        <div className="mt-6 rounded-2xl bg-slate-900/60 border border-emerald-400/20 p-4">
          <h3 className="text-amber-200 font-black mb-2 flex items-center gap-2 text-sm uppercase tracking-[0.25em]" style={{ fontFamily: "'Cinzel', serif" }}>
            <Trophy className="w-4 h-4" /> Practice Rules
          </h3>
          <ul className="text-xs text-slate-300 space-y-1.5">
            <li>· Local-only chips · resets to ₵1000 each visit</li>
            <li>· Closest to 9 wins · only last digit counts</li>
            <li>· Natural 8 / 9 — instant settle</li>
            <li>· 10s + face cards = 0 · Aces = 1</li>
          </ul>
        </div>
      </div>

      <SpadesCommunityChat open={chatOpen} gameId="baccarat-practice" mode="ai" onClose={() => setChatOpen(false)} />
    </div>
  );
}
