/**
 * War AAA — Universal prototype, ruby variant, 2-player density.
 * Simple flip-and-compare engine with an animated reveal pile.
 */
import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Bot, Loader2, Swords, Zap } from "lucide-react";
import { authFetch } from "@/utils/secureAuth";

import SpadesTable from "@/components/spades/SpadesTable";
import SpadesStatusBanner from "@/components/spades/SpadesStatusBanner";
import SpadesSeat from "@/components/spades/SpadesSeat";
import SpadesScoreBadge from "@/components/spades/SpadesScoreBadge";
import SpadesGameMenu from "@/components/spades/SpadesGameMenu";
import SpadesPlayerProfile from "@/components/spades/SpadesPlayerProfile";
import SpadesCommunityChat from "@/components/spades/SpadesCommunityChat";
import type {
  SpadesCard as CardData,
  SpadesPosition,
  SpadesPlayerView,
  SpadesScores,
  StatusMessage,
} from "@/components/spades/types";

const API = process.env.REACT_APP_BACKEND_URL;

interface BattlePlay { player: SpadesPosition; card: CardData; face_down?: boolean; }
interface WarRoundResult {
  round?: number;
  war_depth?: number;
  winner?: SpadesPosition;
  battle?: BattlePlay[];
  elimination?: boolean;
  match_finished?: boolean;
  north_count?: number;
  south_count?: number;
}
interface WarRaw {
  user_position: SpadesPosition;
  phase: "ready" | "playing" | "finished";
  round_no: number;
  max_rounds: number;
  north_count: number;
  south_count: number;
  last_round: WarRoundResult | null;
  battle_log_tail: WarRoundResult[];
  match_winner: SpadesPosition | null;
  players_data: Record<SpadesPosition, { card_count: number }>;
  last_battle?: WarRoundResult;
}

const SUIT_GLYPH: Record<string, string> = { spades: "♠", clubs: "♣", hearts: "♥", diamonds: "♦" };
const SUIT_COLOR: Record<string, string> = { spades: "text-slate-900", clubs: "text-slate-900", hearts: "text-rose-600", diamonds: "text-rose-600" };

function CardFace({ card, faceDown, big }: { card: CardData; faceDown?: boolean; big?: boolean }) {
  if (faceDown) {
    return (
      <div className={`${big ? "w-16 h-24 md:w-20 md:h-28" : "w-10 h-14 md:w-12 md:h-16"} rounded-md bg-gradient-to-br from-rose-700 to-rose-950 border-2 border-rose-400/60 shadow-lg flex items-center justify-center`}>
        <span className="text-[8px] md:text-[10px] font-black uppercase tracking-widest text-rose-200 -rotate-90">VIBEZ</span>
      </div>
    );
  }
  return (
    <div className={`${big ? "w-16 h-24 md:w-20 md:h-28" : "w-10 h-14 md:w-12 md:h-16"} rounded-md bg-white border-2 border-slate-300 shadow-lg flex flex-col items-center justify-between p-1`}>
      <span className={`${big ? "text-sm" : "text-[10px]"} font-bold leading-none ${SUIT_COLOR[card.suit]}`}>{card.rank}</span>
      <span className={`${big ? "text-4xl" : "text-2xl"} ${SUIT_COLOR[card.suit]}`}>{SUIT_GLYPH[card.suit]}</span>
      <span className={`${big ? "text-sm" : "text-[10px]"} font-bold leading-none rotate-180 ${SUIT_COLOR[card.suit]}`}>{card.rank}</span>
    </div>
  );
}

function adapt(raw: WarRaw): { players: Record<SpadesPosition, SpadesPlayerView>; scores: SpadesScores } {
  const players: Record<SpadesPosition, SpadesPlayerView> = {} as Record<SpadesPosition, SpadesPlayerView>;
  (["north", "east", "south", "west"] as SpadesPosition[]).forEach((pos) => {
    const cc = raw.players_data?.[pos]?.card_count ?? 0;
    players[pos] = {
      hand_count: cc,
      bid: 52,            // pill semantics: cards captured / 52
      tricks: cc,
      team: pos === "north" || pos === "south" ? "team1" : "team2",
      is_bot: pos !== raw.user_position,
      name: pos === raw.user_position ? "You" : (pos === "north" ? "Adversary" : "—"),
    };
  });
  return {
    players,
    scores: {
      team1: { points: raw.south_count, bags: 0 },
      team2: { points: raw.north_count, bags: 0 },
    },
  };
}

export default function WarAAA() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<"lobby" | "game">("lobby");
  const [raw, setRaw] = useState<WarRaw | null>(null);
  const [busy, setBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState<StatusMessage | null>(null);
  const [profileOpen, setProfileOpen] = useState<SpadesPosition | null>(null);
  const [chatOpen, setChatOpen] = useState(false);

  const flash = useCallback((text: string, tone: StatusMessage["tone"] = "rose", ttl = 1800) => {
    setStatusMsg({ text, tone, id: Date.now() });
    window.setTimeout(() => setStatusMsg((p) => (p && p.text === text ? null : p)), ttl);
  }, []);

  const startMatch = useCallback(async () => {
    setBusy(true);
    try {
      const res = await authFetch(`${API}/api/war-practice/start`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ max_rounds: 50 }),
      });
      const data = await res.json();
      if (!res.ok) { flash(data.detail || "Failed to start", "rose"); return; }
      setRaw(data.game as WarRaw);
      setPhase("game");
      flash("War · Take cover", "rose");
    } finally { setBusy(false); }
  }, [flash]);

  const playRound = useCallback(async () => {
    if (!raw || busy) return;
    setBusy(true);
    try {
      const res = await authFetch(`${API}/api/war-practice/play-round`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) { flash(data.detail || "Cannot play", "rose"); return; }
      const next = data.game as WarRaw;
      setRaw(next);
      const lr = next.last_round;
      if (lr?.war_depth) {
        flash(`WAR! depth ${lr.war_depth}`, "amber", 2500);
      } else if (lr?.winner) {
        flash(lr.winner === raw.user_position ? "You win the round" : "Adversary takes it", "rose");
      }
    } finally { setBusy(false); }
  }, [raw, busy, flash]);

  const backToLobby = () => { setRaw(null); setPhase("lobby"); };

  if (phase === "lobby") {
    return (
      <div className="min-h-screen bg-[#0a0203] text-white relative overflow-x-hidden" data-testid="war-aaa-lobby">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 w-[60vw] h-[60vw] max-w-[700px] max-h-[700px] rounded-full bg-rose-500/15 blur-[120px]" />
        </div>
        <div className="relative z-10 max-w-3xl mx-auto px-4 py-6">
          <button onClick={() => navigate("/games")} className="flex items-center gap-2 text-rose-300/70 hover:text-white transition mb-4 text-sm font-bold" data-testid="war-aaa-lobby-back">
            <ArrowLeft className="w-4 h-4" /> Back to Games
          </button>
          <div className="flex items-center gap-3 mb-8">
            <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-rose-500 via-red-600 to-rose-700 shadow-[0_0_24px_rgba(244,63,94,0.45)]">
              <Swords className="w-8 h-8 text-white" />
            </div>
            <div>
              <p className="text-xs font-mono uppercase tracking-[0.3em] text-rose-300/80" style={{ fontFamily: "'Cinzel', serif" }}>
                Battle Pit · War
              </p>
              <h1 className="text-3xl md:text-4xl font-black leading-none" style={{ fontFamily: "'Cinzel', serif" }}>
                War AAA
              </h1>
            </div>
          </div>
          <div className="mb-6 p-4 rounded-2xl bg-white/[0.03] border border-rose-400/20 text-sm text-rose-100/80 leading-relaxed">
            <p className="text-xs uppercase tracking-[0.3em] text-rose-300 font-bold mb-2" style={{ fontFamily: "'Cinzel', serif" }}>
              House Rules
            </p>
            • Head-to-head · 52-card deck split 26/26<br />
            • Each round, both flip top card. Higher rank takes both.<br />
            • Tie? <strong>WAR</strong> — burn 3 face-down + 1 face-up. Higher face-up takes the pile.<br />
            • Run out mid-war and you lose the match instantly.<br />
            • Otherwise: most cards after 50 rounds wins.
          </div>
          <button
            onClick={startMatch}
            disabled={busy}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-rose-500 via-red-600 to-rose-500 hover:from-rose-400 hover:to-red-500 text-white font-black uppercase tracking-widest text-base shadow-[0_0_30px_rgba(244,63,94,0.55)] disabled:opacity-50"
            style={{ fontFamily: "'Cinzel', serif" }}
            data-testid="war-aaa-lobby-start-btn"
          >
            {busy ? "Shuffling…" : "Begin Battle"}
          </button>
        </div>
      </div>
    );
  }

  if (!raw) {
    return <div className="min-h-screen bg-[#0a0203] flex items-center justify-center"><Loader2 className="w-12 h-12 text-rose-400 animate-spin" /></div>;
  }

  const { players, scores } = adapt(raw);
  const youPosition = raw.user_position;
  const finished = raw.phase === "finished";
  const lr = raw.last_round;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1a0205] via-[#0a0203] to-[#050102] text-white relative overflow-x-hidden" data-testid="war-aaa">
      <div className="relative z-10 flex flex-col min-h-screen">
        <div className="flex flex-wrap items-start justify-between px-2 sm:px-3 md:px-5 pt-2 sm:pt-3 md:pt-4 gap-2">
          <div className="flex flex-col items-start gap-2">
            <button onClick={backToLobby} className="flex items-center gap-1.5 text-rose-300/70 hover:text-white transition text-xs md:text-sm font-bold" data-testid="war-aaa-back-btn">
              <ArrowLeft className="w-4 h-4" /> Lobby
            </button>
            <SpadesGameMenu onExit={backToLobby} onOpenMessages={() => setChatOpen(true)} />
          </div>
          <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 order-3 w-full sm:order-none sm:w-auto">
            <div className="px-2 py-0.5 rounded-full bg-rose-500/15 border border-rose-400/40 text-[9px] md:text-[10px] uppercase tracking-[0.3em] text-rose-300 font-bold">War</div>
            <div className="px-2 py-0.5 rounded-full bg-fuchsia-500/15 border border-fuchsia-400/40 text-[9px] md:text-[10px] uppercase tracking-[0.3em] text-fuchsia-300 font-bold">
              <span className="inline-flex items-center gap-1"><Bot className="w-2.5 h-2.5" /> AI</span>
            </div>
            <div className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-600 text-[9px] md:text-[10px] uppercase tracking-[0.3em] text-rose-200 font-bold tabular-nums">
              Round · {raw.round_no}/{raw.max_rounds}
            </div>
          </div>
          <SpadesScoreBadge scores={scores} players={players} phase="playing" tricksPlayed={0} />
        </div>

        <SpadesStatusBanner message={statusMsg} />

        <div className="flex items-center justify-center py-2 md:py-3 relative">
          <div className="relative">
            <SpadesTable brandSubLabel="WAR" variant="ruby" density="2p" centreGlyph="⚔">
              <SpadesSeat position="north" player={players.north} isTurn={raw.phase === "playing"} isYou={youPosition === "north"} onClick={() => setProfileOpen("north")} />
            </SpadesTable>

            {/* Battle pile centred on the felt */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 flex flex-col items-center gap-2 pointer-events-none">
              <AnimatePresence mode="popLayout">
                {lr?.battle ? (
                  <motion.div
                    key={lr.round}
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.4, opacity: 0 }}
                    className="flex items-center gap-2"
                    data-testid="war-battle-pile"
                  >
                    {(() => {
                      // Show last 2 face-up cards centred (the resolving cards)
                      const faceUp = (lr.battle ?? []).filter(b => !b.face_down);
                      const tail = faceUp.slice(-2);
                      return tail.map((b, i) => (
                        <div key={i} className="flex flex-col items-center gap-1">
                          <span className={`text-[9px] uppercase tracking-widest font-bold ${b.player === lr.winner ? "text-emerald-300" : "text-rose-300/70"}`}>
                            {b.player.toUpperCase()}
                          </span>
                          <CardFace card={b.card} big />
                        </div>
                      ));
                    })()}
                  </motion.div>
                ) : (
                  <div className="text-rose-300/40 text-xs uppercase tracking-widest">Press FLIP to start</div>
                )}
              </AnimatePresence>
              {lr?.war_depth ? (
                <div className="px-3 py-1 rounded-full bg-amber-500/30 border border-amber-300 text-amber-100 text-[10px] font-black uppercase tracking-[0.3em] flex items-center gap-1" data-testid="war-depth-badge">
                  <Zap className="w-3 h-3" /> War ×{lr.war_depth}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="px-3 md:px-4 pb-3 md:pb-4 relative z-30">
          <div className="flex justify-center gap-3 mb-3">
            {!finished ? (
              <button
                onClick={playRound}
                disabled={busy}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-rose-500 via-red-600 to-rose-500 hover:from-rose-400 hover:to-red-500 text-white font-black uppercase tracking-widest text-sm shadow-[0_0_24px_rgba(244,63,94,0.55)] disabled:opacity-50 flex items-center gap-2"
                data-testid="war-flip-btn"
                style={{ fontFamily: "'Cinzel', serif" }}
              >
                <Swords className="w-4 h-4" />
                {busy ? "Flipping…" : "Flip"}
              </button>
            ) : null}
          </div>

          <div className="flex justify-center gap-6 text-rose-100 text-sm mb-3">
            <div className="px-3 py-1 rounded-full bg-slate-900/60 border border-rose-400/30">
              You: <span className="font-black tabular-nums">{raw.south_count}</span>
            </div>
            <div className="px-3 py-1 rounded-full bg-slate-900/60 border border-rose-400/30">
              Adversary: <span className="font-black tabular-nums">{raw.north_count}</span>
            </div>
          </div>

          {finished ? (
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="mt-2 p-6 rounded-2xl bg-gradient-to-br from-rose-950/40 to-[#050102] border-2 border-rose-400/40 text-center" data-testid="war-aaa-finished-footer">
              <Swords className="w-10 h-10 mx-auto mb-2 text-rose-300" />
              <h2 className="text-2xl font-black mb-1" style={{ fontFamily: "'Cinzel', serif" }}>
                {raw.match_winner === youPosition ? "Victory!" : raw.match_winner === null ? "Stalemate" : "Defeated"}
              </h2>
              <p className="text-rose-200/70 mb-4 text-sm">Final tally · You {raw.south_count} · Adversary {raw.north_count}</p>
              <div className="flex gap-3 justify-center">
                <button onClick={startMatch} disabled={busy} className="px-5 py-2.5 rounded-lg bg-rose-500 hover:bg-rose-400 text-white font-bold disabled:opacity-50" data-testid="war-aaa-replay-btn">Rematch</button>
                <button onClick={backToLobby} className="px-5 py-2.5 rounded-lg border border-rose-400/40 text-rose-200 hover:bg-rose-500/10 font-bold" data-testid="war-aaa-lobby-btn">Back to Lobby</button>
              </div>
            </motion.div>
          ) : null}
        </div>
      </div>

      <SpadesPlayerProfile open={profileOpen !== null} position={profileOpen} player={profileOpen ? players[profileOpen] : null} isYou={profileOpen === youPosition} onClose={() => setProfileOpen(null)} />
      <SpadesCommunityChat open={chatOpen} gameId={`war-${raw.user_position}`} mode="ai" onClose={() => setChatOpen(false)} />
    </div>
  );
}
