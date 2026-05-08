/**
 * Baccarat AAA — Universal prototype, monaco variant (Riviera emerald).
 *
 * Aligns Baccarat with the rest of the AAA card-room family (Spades,
 * Hearts, Bid Whist, etc.). Reuses SpadesTable + SpadesCard +
 * SpadesGameMenu + SpadesStatusBanner + SpadesCommunityChat. Currency
 * displayed exclusively in Vibez Coins (₵) — no `$` allowed per
 * platform rule.
 *
 * Backend contract preserved: `POST /api/baccarat/play` with body
 * `{bet_type, bet_amount, game_mode}` returning `player_hand[],
 * banker_hand[], player_score, banker_score, winner, payout`.
 */
import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Bot, Sparkles, TrendingUp, Trophy } from "lucide-react";
import { authFetch } from "@/utils/secureAuth";
import { useSafeTimeout } from "@/hooks/useSafeTimeout";

import SpadesTable from "@/components/spades/SpadesTable";
import SpadesCard from "@/components/spades/SpadesCard";
import SpadesStatusBanner from "@/components/spades/SpadesStatusBanner";
import SpadesGameMenu from "@/components/spades/SpadesGameMenu";
import SpadesCommunityChat from "@/components/spades/SpadesCommunityChat";
import TurnIndicator from "@/components/games/TurnIndicator";
import BigRoadRoadmap, { type BaccaratOutcome } from "@/components/games/BigRoadRoadmap";
import { CardSqueeze, ChipToss } from "@/components/games/CasinoCinematics";
import type { SpadesCard as CardData, StatusMessage } from "@/components/spades/types";

const API = process.env.REACT_APP_BACKEND_URL;
const CHIP_VALUES = [5, 10, 25, 50, 100, 500];

type BetZone = "player" | "banker" | "tie";

interface BaccaratResponse {
  player_hand: CardData[];
  banker_hand: CardData[];
  player_score: number;
  banker_score: number;
  winner: BetZone;
  payout: number;
}

interface HistoryRow {
  timestamp?: string;
  winner: BetZone;
  bet_type: BetZone;
  bet_amount: number;
  profit: number;
}

// ─── Vegas-style chip ─────────────────────────────────────────────────
function VibezChip({ value, selected, onClick, disabled }: { value: number; selected: boolean; onClick: () => void; disabled?: boolean }) {
  // Canonical casino chip palette (Vegas Strip standard).
  const grad =
    value >= 500 ? "linear-gradient(135deg, #9333ea, #db2777)" :   // audit:allow-hex
    value >= 100 ? "linear-gradient(135deg, #0f172a, #334155)" :   // audit:allow-hex
    value >= 50  ? "linear-gradient(135deg, #0284c7, #0ea5e9)" :   // audit:allow-hex
    value >= 25  ? "linear-gradient(135deg, #15803d, #22c55e)" :   // audit:allow-hex
    value >= 10  ? "linear-gradient(135deg, #b91c1c, #ef4444)" :   // audit:allow-hex
                   "linear-gradient(135deg, #f59e0b, #fbbf24)";    // audit:allow-hex
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      whileHover={!disabled ? { scale: 1.08, y: -3 } : undefined}
      whileTap={!disabled ? { scale: 0.95 } : undefined}
      className={`relative w-14 h-14 md:w-16 md:h-16 rounded-full font-black flex items-center justify-center text-white shadow-lg transition-all ${
        selected ? "ring-4 ring-amber-400 scale-110 shadow-[0_0_18px_rgba(251,191,36,0.55)]" : ""
      } ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
      style={{ background: grad, fontFamily: "'Cinzel', serif" }}
      data-testid={`baccarat-chip-${value}`}
    >
      <div className="text-center leading-none">
        <div className="text-[10px] opacity-90">₵</div>
        <div className="text-base">{value}</div>
      </div>
    </motion.button>
  );
}

// ─── Pit-table bet zone ────────────────────────────────────────────────
function BetZone({
  zone, label, payout, currentBet, onBet, disabled, accent,
}: {
  zone: BetZone;
  label: string;
  payout: string;
  currentBet: number;
  onBet: () => void;
  disabled: boolean;
  accent: { bg: string; ring: string; ink: string; ringSelected: string };
}) {
  return (
    <motion.button
      onClick={onBet}
      disabled={disabled}
      whileHover={!disabled ? { scale: 1.03 } : undefined}
      whileTap={!disabled ? { scale: 0.98 } : undefined}
      className={`relative flex-1 px-4 py-5 rounded-xl border-2 backdrop-blur-sm transition-all overflow-hidden ${
        currentBet > 0 ? `${accent.bg} ${accent.ringSelected} shadow-[0_0_28px_rgba(251,191,36,0.25)]` : `bg-black/40 ${accent.ring} hover:${accent.ringSelected}`
      } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
      data-testid={`baccarat-bet-zone-${zone}`}
    >
      {/* Engraved felt texture */}
      <div
        className="absolute inset-0 pointer-events-none opacity-25"
        style={{
          backgroundImage:
            "repeating-linear-gradient(45deg, rgba(255,255,255,0.05) 0 1px, transparent 1px 8px)",
        }}
      />
      <div className={`relative text-2xl md:text-3xl font-black uppercase tracking-[0.3em] ${accent.ink}`} style={{ fontFamily: "'Cinzel', serif" }}>
        {label}
      </div>
      <div className={`relative mt-1 text-[10px] uppercase tracking-widest ${accent.ink} opacity-75`}>
        Pays {payout}
      </div>
      {currentBet > 0 ? (
        <motion.div
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="relative mt-3 inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-400/15 border border-amber-300/50 text-amber-200 font-black tabular-nums"
          data-testid={`baccarat-bet-amount-${zone}`}
        >
          ₵{currentBet.toLocaleString()}
        </motion.div>
      ) : null}
    </motion.button>
  );
}

const ZONE_ACCENTS: Record<BetZone, { bg: string; ring: string; ink: string; ringSelected: string }> = {
  player: { bg: "bg-cyan-500/15", ring: "border-cyan-400/30", ringSelected: "border-cyan-300/80", ink: "text-cyan-100" },
  banker: { bg: "bg-rose-500/15", ring: "border-rose-400/30", ringSelected: "border-rose-300/80", ink: "text-rose-100" },
  tie:    { bg: "bg-emerald-500/15", ring: "border-emerald-400/30", ringSelected: "border-emerald-300/80", ink: "text-emerald-100" },
};

export default function BaccaratPremium() {
  const navigate = useNavigate();
  const safeTimeout = useSafeTimeout();
  const [credits, setCredits] = useState<number>(0);
  const [selectedChip, setSelectedChip] = useState<number>(25);
  const [bets, setBets] = useState<Record<BetZone, number>>({ player: 0, banker: 0, tie: 0 });
  const [phase, setPhase] = useState<"betting" | "dealing" | "result">("betting");
  const [playerHand, setPlayerHand] = useState<CardData[]>([]);
  const [bankerHand, setBankerHand] = useState<CardData[]>([]);
  const [playerScore, setPlayerScore] = useState(0);
  const [bankerScore, setBankerScore] = useState(0);
  const [winner, setWinner] = useState<BetZone | null>(null);
  const [payout, setPayout] = useState(0);
  const [busy, setBusy] = useState(false);
  /** Phase 3 cinematic — Baccarat card-squeeze reveal at peak drama. */
  const [squeezeActive, setSqueezeActive] = useState(false);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [statusMsg, setStatusMsg] = useState<StatusMessage | null>(null);
  const [chatOpen, setChatOpen] = useState(false);

  const flash = useCallback((text: string, tone: StatusMessage["tone"] = "amber", ttl = 1800) => {
    setStatusMsg({ text, tone, id: Date.now() });
    window.setTimeout(() => setStatusMsg((p) => (p && p.text === text ? null : p)), ttl);
  }, []);

  // ─── data ────────────────────────────────────────────────────────────
  const fetchCredits = useCallback(async () => {
    try {
      const res = await authFetch(`${API}/api/auth/me`);
      if (res.ok) {
        const data = await res.json();
        setCredits(data.credits_balance ?? 0);
      }
    } catch { /* silent */ }
  }, []);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await authFetch(`${API}/api/baccarat/history?limit=5`);
      if (res.ok) {
        const data = await res.json();
        setHistory(data.games ?? []);
      }
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    fetchCredits();
    fetchHistory();
  }, [fetchCredits, fetchHistory]);

  // ─── betting actions ────────────────────────────────────────────────
  /** Last chip toss event — drives the cinematic <ChipToss/> overlay. */
  const [chipToss, setChipToss] = useState<{
    id: number; zone: BetZone; amount: number;
  } | null>(null);

  const placeBet = (zone: BetZone) => {
    if (phase !== "betting" || busy) return;
    if (credits < selectedChip) { flash("Insufficient credits", "rose"); return; }
    setBets((b) => ({ ...b, [zone]: b[zone] + selectedChip }));
    setCredits((c) => c - selectedChip);
    // Fire the cinematic chip toss — origin = bottom of viewport (rail
    // chip selector), target = bet zone offset. Each zone has a
    // canonical Y offset so chips visually fly to the right zone.
    const zoneTargetY = zone === "tie" ? -180 : zone === "banker" ? -100 : -60;
    const zoneTargetX = zone === "banker" ? 120 : zone === "player" ? -120 : 0;
    setChipToss({
      id: Date.now(),
      zone,
      amount: selectedChip,
    });
    // Stash the offsets on the event so the overlay reads them at render time.
    (window as any).__bp_chip_toss_offsets = { x: zoneTargetX, y: zoneTargetY };
  };

  const clearBets = () => {
    if (phase !== "betting" || busy) return;
    const total = bets.player + bets.banker + bets.tie;
    setCredits((c) => c + total);
    setBets({ player: 0, banker: 0, tie: 0 });
  };

  const totalBet = bets.player + bets.banker + bets.tie;

  // ─── deal ───────────────────────────────────────────────────────────
  const deal = async () => {
    if (totalBet === 0) { flash("Place a bet first", "rose"); return; }
    // Determine primary bet (highest amount; player wins ties)
    const ranked = (Object.entries(bets) as [BetZone, number][]).sort((a, b) => b[1] - a[1]);
    const [primaryZone, primaryAmount] = ranked[0];
    setBusy(true);
    setPhase("dealing");
    flash("Dealing cards…", "amber", 1500);
    try {
      const res = await authFetch(`${API}/api/baccarat/play`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bet_type: primaryZone, bet_amount: primaryAmount, game_mode: "standard" }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail ?? "Deal failed");
      }
      const data = (await res.json()) as BaccaratResponse;
      // Animate cards + score reveal
      setPlayerHand([]);
      setBankerHand([]);
      data.player_hand.forEach((c, i) => {
        safeTimeout(() => setPlayerHand((h) => [...h, c]), 350 + i * 380);
      });
      data.banker_hand.forEach((c, i) => {
        safeTimeout(() => setBankerHand((h) => [...h, c]), 540 + i * 380);
      });
      const settle = 600 + Math.max(data.player_hand.length, data.banker_hand.length) * 380 + 400;
      // Cinematic squeeze fires just before the score reveal — peak drama.
      safeTimeout(() => setSqueezeActive(true), Math.max(0, settle - 900));
      safeTimeout(() => {
        setPlayerScore(data.player_score);
        setBankerScore(data.banker_score);
        setWinner(data.winner);
        setPayout(data.payout);
        setPhase("result");
        flash(
          data.winner === "tie" ? "Tie · stand-off" :
          data.winner === primaryZone ? `${data.winner.toUpperCase()} wins · +₵${data.payout}` :
          `${data.winner.toUpperCase()} wins`,
          data.winner === primaryZone ? "emerald" : "rose",
          2400,
        );
        fetchCredits();
        fetchHistory();
      }, settle);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Deal failed";
      flash(msg, "rose");
      setPhase("betting");
    } finally {
      setBusy(false);
    }
  };

  const newRound = () => {
    setPhase("betting");
    setPlayerHand([]);
    setBankerHand([]);
    setPlayerScore(0);
    setBankerScore(0);
    setWinner(null);
    setPayout(0);
    setBets({ player: 0, banker: 0, tie: 0 });
    setSqueezeActive(false);
  };

  return (
    <div
      className="min-h-screen text-white bg-gradient-to-br from-emerald-950 via-slate-950 to-[#04060e] relative overflow-x-hidden"
      data-testid="baccarat-aaa"
    >
      {/* Top bar */}
      <div className="flex items-start justify-between px-3 md:px-5 pt-3 md:pt-4 gap-2">
        <div className="flex flex-col items-start gap-2">
          <button
            onClick={() => navigate("/games")}
            className="flex items-center gap-1.5 text-emerald-200/70 hover:text-white transition text-xs md:text-sm font-bold"
            data-testid="baccarat-leave-table"
          >
            <ArrowLeft className="w-4 h-4" /> Lobby
          </button>
          <SpadesGameMenu onExit={() => navigate("/games")} onOpenMessages={() => setChatOpen(true)} />
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-center">
          <div className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-400/40 text-[9px] md:text-[10px] uppercase tracking-[0.3em] text-amber-200 font-bold">
            Baccarat
          </div>
          <div className="px-2 py-0.5 rounded-full bg-fuchsia-500/15 border border-fuchsia-400/40 text-[9px] md:text-[10px] uppercase tracking-[0.3em] text-fuchsia-300 font-bold">
            <span className="inline-flex items-center gap-1"><Bot className="w-2.5 h-2.5" /> AI</span>
          </div>
          <div className="px-2 py-0.5 rounded-full bg-slate-900/80 border border-emerald-400/30 text-[9px] md:text-[10px] uppercase tracking-[0.3em] text-emerald-200 font-bold tabular-nums" data-testid="baccarat-credits">
            ₵{credits.toLocaleString()} credits
          </div>
        </div>

        <div className="px-3 py-1.5 rounded-xl bg-slate-900/70 border border-amber-400/30 text-right">
          <div className="text-[9px] uppercase tracking-widest text-amber-200/70 font-bold">Total Bet</div>
          <div className="text-amber-200 font-black tabular-nums" data-testid="baccarat-total-bet">₵{totalBet.toLocaleString()}</div>
        </div>
      </div>

      <SpadesStatusBanner message={statusMsg} />

      {/* Phase 3 cinematic — squeeze-reveal on the dealing→result transition.
           Center-of-screen overlay that auto-dismisses; non-blocking pointer. */}
      {squeezeActive && (
        <div
          data-testid="baccarat-card-squeeze"
          className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center"
        >
          <CardSqueeze
            active
            faceUp={
              <span className="text-3xl font-black tabular-nums text-amber-700">
                {Math.max(playerScore, bankerScore)}
              </span>
            }
            onComplete={() => setSqueezeActive(false)}
          />
        </div>
      )}

      {/* Universal turn indicator (LOCKED 2026-02-16 — Baccarat phase cues) */}
      <TurnIndicator
        role={phase === 'dealing' ? 'dealer' : (phase === 'result' ? 'system' : 'me')}
        customLabel={
          phase === 'betting' ? 'PLACE YOUR BETS' :
          phase === 'dealing' ? 'SQUEEZE — DEAL' :
          (winner ? `${String(winner).toUpperCase()} WINS` : 'STAND BY')
        }
      />

      {/* Title lockup */}
      <div className="text-center pt-2 pb-3">
        <p className="text-[10px] uppercase tracking-[0.3em] text-emerald-300/70 font-bold" style={{ fontFamily: "'Cinzel', serif" }}>
          Casino Pit · Punto Banco
        </p>
        <h1 className="text-3xl md:text-4xl font-black text-amber-200 leading-tight" style={{ fontFamily: "'Cinzel', serif" }}>
          Baccarat AAA
        </h1>
      </div>

      {/* Table + hands */}
      <div className="flex items-center justify-center py-2 md:py-3 relative">
        <div className="relative">
          <SpadesTable brandSubLabel="BACCARAT" variant="monaco" centreGlyph="B">
            {/* Hands centred on the felt — banker top, player bottom */}
            <div
              className="absolute inset-x-0 top-[18%] flex flex-col items-center gap-1 z-20"
              data-testid="baccarat-banker-hand-zone"
            >
              <div className="text-[10px] uppercase tracking-[0.3em] font-bold text-rose-300" style={{ fontFamily: "'Cinzel', serif" }}>
                Banker {bankerScore > 0 ? <span className="text-rose-200" data-testid="baccarat-banker-score">· {bankerScore}</span> : null}
              </div>
              <div className="flex gap-2 min-h-[110px] items-center">
                <AnimatePresence>
                  {bankerHand.map((c, idx) => (
                    <motion.div
                      key={`bnk-${idx}-${c.suit}-${c.rank}`}
                      initial={{ y: -40, opacity: 0, rotate: -10 }}
                      animate={{ y: 0, opacity: 1, rotate: (idx - 1) * 4 }}
                      transition={{ duration: 0.42 }}
                    >
                      <SpadesCard card={c} size="md" isPlayable={false} />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>

            <div
              className="absolute inset-x-0 bottom-[18%] flex flex-col items-center gap-1 z-20"
              data-testid="baccarat-player-hand-zone"
            >
              <div className="flex gap-2 min-h-[110px] items-center">
                <AnimatePresence>
                  {playerHand.map((c, idx) => (
                    <motion.div
                      key={`pl-${idx}-${c.suit}-${c.rank}`}
                      initial={{ y: 40, opacity: 0, rotate: 10 }}
                      animate={{ y: 0, opacity: 1, rotate: (idx - 1) * 4 }}
                      transition={{ duration: 0.42 }}
                    >
                      <SpadesCard card={c} size="md" isPlayable={false} />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
              <div className="text-[10px] uppercase tracking-[0.3em] font-bold text-cyan-300" style={{ fontFamily: "'Cinzel', serif" }}>
                Player {playerScore > 0 ? <span className="text-cyan-200" data-testid="baccarat-player-score">· {playerScore}</span> : null}
              </div>
            </div>
          </SpadesTable>
        </div>
      </div>

      {/* Result banner */}
      <AnimatePresence>
        {phase === "result" && winner ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92 }}
            className="mx-auto max-w-md mt-4 mb-2 px-6 py-3 rounded-2xl border-2 text-center backdrop-blur"
            data-testid="baccarat-result-banner"
            style={{
              background: winner === "player" ? "rgba(34,211,238,0.12)" : winner === "banker" ? "rgba(244,63,94,0.12)" : "rgba(16,185,129,0.12)",
              borderColor: winner === "player" ? "rgba(34,211,238,0.55)" : winner === "banker" ? "rgba(244,63,94,0.55)" : "rgba(16,185,129,0.55)",
            }}
          >
            <p className="text-[10px] uppercase tracking-[0.3em] font-bold opacity-80" style={{ fontFamily: "'Cinzel', serif" }}>
              {winner === "tie" ? "Stand-Off" : `${winner.toUpperCase()} Wins`}
            </p>
            {payout > 0 ? (
              <p className="text-amber-200 font-black text-xl tabular-nums">+₵{payout.toLocaleString()}</p>
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Bet zones */}
      <div className="px-3 md:px-6 mt-2 max-w-4xl mx-auto">
        <div className="flex flex-col md:flex-row gap-3" data-testid="baccarat-bet-zones">
          <BetZone zone="player" label="Player" payout="1 : 1" currentBet={bets.player} onBet={() => placeBet("player")} disabled={phase !== "betting" || busy} accent={ZONE_ACCENTS.player} />
          <BetZone zone="tie"    label="Tie"    payout="8 : 1" currentBet={bets.tie}    onBet={() => placeBet("tie")}    disabled={phase !== "betting" || busy} accent={ZONE_ACCENTS.tie} />
          <BetZone zone="banker" label="Banker" payout="0.95 : 1 (5% comm.)" currentBet={bets.banker} onBet={() => placeBet("banker")} disabled={phase !== "betting" || busy} accent={ZONE_ACCENTS.banker} />
        </div>

        {/* Chip selector */}
        <div className="mt-4 px-4 py-3 rounded-2xl bg-slate-900/60 border border-amber-400/20 backdrop-blur" data-testid="baccarat-chip-selector">
          <p className="text-[10px] uppercase tracking-[0.3em] text-amber-200/70 font-bold text-center mb-2" style={{ fontFamily: "'Cinzel', serif" }}>
            Stake per click
          </p>
          <div className="flex justify-center gap-2 md:gap-3 flex-wrap">
            {CHIP_VALUES.map((v) => (
              <VibezChip key={v} value={v} selected={selectedChip === v} onClick={() => setSelectedChip(v)} disabled={phase !== "betting"} />
            ))}
          </div>
        </div>

        {/* Action buttons */}
        <div className="mt-4 flex gap-3">
          {phase !== "result" ? (
            <>
              <button
                onClick={deal}
                disabled={busy || totalBet === 0 || phase !== "betting"}
                className="flex-1 px-4 py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black uppercase tracking-[0.3em] text-sm shadow-[0_0_24px_rgba(251,191,36,0.45)] disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ fontFamily: "'Cinzel', serif" }}
                data-testid="baccarat-deal-btn"
              >
                {busy ? "Dealing…" : "Deal"}
              </button>
              <button
                onClick={clearBets}
                disabled={busy || totalBet === 0 || phase !== "betting"}
                className="px-4 py-3.5 rounded-xl bg-slate-800 border border-slate-600 hover:bg-slate-700 text-slate-200 font-bold uppercase tracking-[0.3em] text-sm disabled:opacity-40"
                data-testid="baccarat-clear-btn"
              >
                Clear
              </button>
            </>
          ) : (
            <button
              onClick={newRound}
              className="flex-1 px-4 py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black uppercase tracking-[0.3em] text-sm shadow-[0_0_24px_rgba(16,185,129,0.45)]"
              style={{ fontFamily: "'Cinzel', serif" }}
              data-testid="baccarat-new-round-btn"
            >
              <Sparkles className="inline w-4 h-4 mr-1.5 -mt-0.5" />
              New Round
            </button>
          )}
        </div>

        {/* Sidebar (history + how to play) */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4 pb-8">
          <div className="rounded-2xl bg-slate-900/60 border border-emerald-400/20 p-4" data-testid="baccarat-recent-games">
            <h3 className="text-amber-200 font-black mb-2 flex items-center gap-2 text-sm uppercase tracking-[0.25em]" style={{ fontFamily: "'Cinzel', serif" }}>
              <TrendingUp className="w-4 h-4" /> Recent
            </h3>

            {/* Big Road roadmap (LOCKED 2026-02-16 — Phase 3 cinematic flourish).
                 Maps the recent winner column to the canonical 6×24 grid so
                 streak players can spot dragons and ponds. */}
            <div className="mb-3">
              <BigRoadRoadmap
                outcomes={history.slice().reverse().map((g) => g.winner as BaccaratOutcome)}
                rows={6}
                cols={16}
              />
            </div>

            <div className="space-y-2 text-xs">
              {history.length === 0 ? (
                <p className="text-slate-400 text-center py-3">No games yet · play your first round</p>
              ) : history.map((g, i) => (
                <div key={`game-${g.timestamp ?? i}-${g.winner}`} className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-slate-800/60 border border-white/5">
                  <span className="text-slate-200 capitalize font-bold">{g.winner}</span>
                  <span className={`tabular-nums font-black ${g.profit > 0 ? "text-emerald-300" : "text-rose-300"}`}>
                    {g.profit > 0 ? "+" : ""}₵{g.profit.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl bg-slate-900/60 border border-emerald-400/20 p-4" data-testid="baccarat-rules-card">
            <h3 className="text-amber-200 font-black mb-2 flex items-center gap-2 text-sm uppercase tracking-[0.25em]" style={{ fontFamily: "'Cinzel', serif" }}>
              <Trophy className="w-4 h-4" /> Rules
            </h3>
            <ul className="text-xs text-slate-300 space-y-1.5 list-none">
              <li>· Bet on Player, Banker, or Tie</li>
              <li>· Closest to 9 wins · only last digit counts</li>
              <li>· Natural 8 / 9 — instant settle</li>
              <li>· 10s + face cards count as 0 · Aces = 1</li>
              <li>· Banker payout includes 5% house commission</li>
            </ul>
          </div>
        </div>
      </div>

      <SpadesCommunityChat open={chatOpen} gameId="baccarat-aaa" mode="ai" onClose={() => setChatOpen(false)} />
    </div>
  );
}
