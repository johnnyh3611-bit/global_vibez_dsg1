/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ❤️ HEARTS AAA — Global Vibez Hearts (reuses Spades AAA universal prototype)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Per the user's mandate: every 4-player card room shares the Spades AAA
 * functionality (seat layout, dropdowns, dealing animation, hand fan,
 * trick pile, status banner, score badge, game menu, profile, chat).
 * Hearts gets the CRIMSON variant of the universal SpadesTable + a
 * Hearts-specific PassModal to handle the 3-card pass phase.
 *
 * Backend endpoints (all under /api/hearts-practice/):
 *   POST /start          — fresh game + deal
 *   GET  /state          — current state
 *   POST /pass-cards     — {cards: 3 cards}
 *   POST /play           — {card}
 *   POST /new-hand       — start next hand after scoring
 *
 * Per-seat progress pill: shows points-this-round (lower is better).
 * 0 = clean, 1-12 = manageable, 13+ = took the queen (or shot moon attempt).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Bot, Heart, Loader2 } from "lucide-react";
import { authFetch } from "@/utils/secureAuth";

import SpadesTable from "@/components/spades/SpadesTable";
import SpadesStatusBanner from "@/components/spades/SpadesStatusBanner";
import SpadesHandFan from "@/components/spades/SpadesHandFan";
import SpadesScoreBadge from "@/components/spades/SpadesScoreBadge";
import SpadesSeat from "@/components/spades/SpadesSeat";
import SpadesTrickPile from "@/components/spades/SpadesTrickPile";
import SpadesRoundModal from "@/components/spades/SpadesRoundModal";
import SpadesDealingAnimation from "@/components/spades/SpadesDealingAnimation";
import SpadesGameMenu from "@/components/spades/SpadesGameMenu";
import SpadesPlayerProfile from "@/components/spades/SpadesPlayerProfile";
import SpadesCommunityChat from "@/components/spades/SpadesCommunityChat";
import HeartsPassModal from "@/components/hearts-aaa/HeartsPassModal";
import TurnIndicator, { type TurnRole } from "@/components/games/TurnIndicator";
import type {
  SpadesCard as CardData,
  SpadesPosition,
  SpadesPlayerView,
  SpadesScores,
  SpadesPhase,
  StatusMessage,
} from "@/components/spades/types";

const API = process.env.REACT_APP_BACKEND_URL;

type PassDirection = "left" | "right" | "across" | "none";

interface HeartsPlayerInfo {
  card_count: number;
  round_points: number;
  tricks_won: number;
  total_score: number;
  passed: boolean;
}

interface HeartsTrickPlay {
  player: SpadesPosition;
  card: CardData;
}

interface HeartsRawState {
  user_position: SpadesPosition;
  phase: "passing" | "playing" | "scoring" | "finished";
  turn: SpadesPosition;
  hands_played: number;
  pass_direction: PassDirection;
  hearts_broken: boolean;
  is_first_trick: boolean;
  tricks_played: number;
  current_trick: HeartsTrickPlay[];
  led_suit: string | null;
  scores: Record<SpadesPosition, number>;
  round_points: Record<SpadesPosition, number>;
  tricks_won: Record<SpadesPosition, number>;
  players_data: Record<SpadesPosition, HeartsPlayerInfo>;
  match_winner: SpadesPosition | null;
  your_hand: CardData[];
  playable_cards: CardData[];
  pending_human_pass: boolean;
  last_round_breakdown: {
    raw: Record<SpadesPosition, number>;
    scored: Record<SpadesPosition, number>;
    shot_moon: SpadesPosition | null;
  } | null;
  play_sequence?: Array<{
    player: SpadesPosition;
    card: CardData;
    trick_winner: SpadesPosition | null;
    trick_complete: boolean;
    round_complete: boolean;
  }>;
}

const BOT_NAMES: Record<SpadesPosition, string> = {
  north: "Partner",
  south: "You",
  east:  "Rival East",
  west:  "Rival West",
};

const DIRECTION_LABEL: Record<PassDirection, string> = {
  left:   "Pass · Left",
  right:  "Pass · Right",
  across: "Pass · Across",
  none:   "No Pass",
};

function adaptPlayers(
  raw: Record<SpadesPosition, HeartsPlayerInfo> | null | undefined,
  youPosition: SpadesPosition,
): Record<SpadesPosition, SpadesPlayerView> {
  const safe = raw ?? ({} as Record<SpadesPosition, HeartsPlayerInfo>);
  const out: Record<SpadesPosition, SpadesPlayerView> = {} as Record<SpadesPosition, SpadesPlayerView>;
  (["north", "east", "south", "west"] as SpadesPosition[]).forEach((pos) => {
    const p = safe[pos];
    out[pos] = {
      hand_count: p?.card_count ?? 0,
      // No bid in Hearts — pill shows raw points-this-round (low = good)
      bid: 0,
      tricks: p?.round_points ?? 0,
      // Teamless — assign visually balanced colours: N+S "team1", E+W "team2"
      team: pos === "north" || pos === "south" ? "team1" : "team2",
      is_bot: pos !== youPosition,
      name: pos === youPosition ? "You" : BOT_NAMES[pos],
    };
  });
  return out;
}

function adaptTrickPile(raw: HeartsTrickPlay[] | null | undefined): Array<{ position: SpadesPosition; card: CardData }> {
  return (raw ?? []).map((r) => ({ position: r.player, card: r.card }));
}

function adaptPhase(p: HeartsRawState["phase"]): SpadesPhase {
  if (p === "passing") return "bidding";
  if (p === "scoring") return "scoring";
  if (p === "finished") return "finished";
  return "playing";
}

function buildSpadesScores(scores: Record<SpadesPosition, number>): SpadesScores {
  // Spades-style team rollup so the SpadesScoreBadge can render. We collapse
  // 4-individual scores into N+S vs E+W pairs purely for visual scoring;
  // Hearts itself is FFA — the round modal exposes the per-player split.
  return {
    team1: { points: (scores.north ?? 0) + (scores.south ?? 0), bags: 0 },
    team2: { points: (scores.east ?? 0) + (scores.west ?? 0), bags: 0 },
  };
}

export default function HeartsAAA() {
  const navigate = useNavigate();

  const [phase, setPhase] = useState<"lobby" | "game">("lobby");
  const [raw, setRaw] = useState<HeartsRawState | null>(null);
  const [busy, setBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState<StatusMessage | null>(null);

  const [profileOpen, setProfileOpen] = useState<SpadesPosition | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [passOpen, setPassOpen] = useState(false);
  const [dealing, setDealing] = useState(false);
  const [dealKey, setDealKey] = useState(0);

  const [roundModalOpen, setRoundModalOpen] = useState(false);
  const [lastRoundSummary, setLastRoundSummary] = useState<{
    team1Score: number;
    team2Score: number;
    delta1: number;
    delta2: number;
  } | null>(null);
  const prevTeamScoresRef = useRef<{ team1: number; team2: number } | null>(null);

  const flashStatus = useCallback(
    (text: string, tone: StatusMessage["tone"] = "rose", ttl = 2400) => {
      setStatusMsg({ text, tone, id: Date.now() });
      window.setTimeout(() => {
        setStatusMsg((prev) => (prev && prev.text === text ? null : prev));
      }, ttl);
    },
    [],
  );

  const startDealSequence = useCallback((nextRaw: HeartsRawState) => {
    setDealing(true);
    setDealKey((k) => k + 1);
    window.setTimeout(() => {
      setDealing(false);
      if (nextRaw.phase === "passing") {
        setPassOpen(true);
      }
    }, 3200);
  }, []);

  const startGame = useCallback(async () => {
    setBusy(true);
    try {
      const res = await authFetch(`${API}/api/hearts-practice/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        flashStatus(err.detail || "Failed to start", "rose");
        return;
      }
      const data = await res.json();
      const fresh = data.game as HeartsRawState;
      setRaw(fresh);
      const tScores = buildSpadesScores(fresh.scores);
      prevTeamScoresRef.current = { team1: tScores.team1.points, team2: tScores.team2.points };
      setPhase("game");
      flashStatus(`Hearts · ${DIRECTION_LABEL[fresh.pass_direction]}`, "rose", 1800);
      startDealSequence(fresh);
    } catch (e) {
      flashStatus("Network error", "rose");
    } finally {
      setBusy(false);
    }
  }, [flashStatus, startDealSequence]);

  // Detect round-end via score delta and pop the round modal.
  const detectRoundEnd = useCallback((next: HeartsRawState) => {
    const t = buildSpadesScores(next.scores);
    const prev = prevTeamScoresRef.current;
    if (prev && (t.team1.points !== prev.team1 || t.team2.points !== prev.team2)) {
      setLastRoundSummary({
        team1Score: t.team1.points,
        team2Score: t.team2.points,
        delta1: t.team1.points - prev.team1,
        delta2: t.team2.points - prev.team2,
      });
      setRoundModalOpen(true);
      prevTeamScoresRef.current = { team1: t.team1.points, team2: t.team2.points };
    }
  }, []);

  const submitPass = useCallback(async (cards: CardData[]) => {
    if (!raw || busy) return;
    setBusy(true);
    try {
      const res = await authFetch(`${API}/api/hearts-practice/pass-cards`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cards }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        flashStatus(err.detail || "Pass rejected", "rose");
        return;
      }
      const data = await res.json();
      const next = data.game as HeartsRawState;
      setRaw(next);
      setPassOpen(false);
      detectRoundEnd(next);
      flashStatus("Cards in play — good luck", "rose", 2000);
    } finally {
      setBusy(false);
    }
  }, [raw, busy, flashStatus, detectRoundEnd]);

  const playCard = useCallback(async (card: CardData) => {
    if (!raw || busy) return;
    setBusy(true);
    try {
      const res = await authFetch(`${API}/api/hearts-practice/play`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ card }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        flashStatus(err.detail || "Illegal play", "rose");
        return;
      }
      const data = await res.json();
      const next = data.game as HeartsRawState;
      const seq = next.play_sequence ?? [];
      if (seq.length === 0) {
        setRaw(next);
        detectRoundEnd(next);
        return;
      }
      // Stage trick-pile reveals one card at a time. We replay the
      // sequence on top of the current frontend state so each opponent's
      // card visibly LANDS in the trick pile before the next play, and
      // a winning trick lingers TRICK_HOLD_MS before clearing — exactly
      // like Spades AAA. Final authoritative state is committed at the
      // end of the loop.
      const CARD_STAGING_MS = 850;
      const TRICK_HOLD_MS = 1200;
      let stagedTrick: HeartsTrickPlay[] = [...raw.current_trick];
      let stagedHand = raw.your_hand.filter(
        (c) => !(c.suit === card.suit && c.rank === card.rank),
      );
      const stagedPlayersData = { ...raw.players_data };

      const pushFrame = () =>
        setRaw((prev) =>
          prev ? { ...prev, current_trick: stagedTrick, your_hand: stagedHand, players_data: stagedPlayersData } : prev,
        );

      for (let i = 0; i < seq.length; i++) {
        const ev = seq[i];
        const isFirst = i === 0;
        stagedTrick = [...stagedTrick, { player: ev.player, card: ev.card }];
        await new Promise<void>((r) => setTimeout(r, isFirst ? 200 : CARD_STAGING_MS));
        if (ev.trick_complete && ev.trick_winner) {
          const winner = ev.trick_winner as SpadesPosition;
          flashStatus(`${BOT_NAMES[winner] ?? winner} took the trick`, "rose", 1300);
          if (stagedPlayersData[winner]) {
            stagedPlayersData[winner] = { ...stagedPlayersData[winner], tricks_won: (stagedPlayersData[winner].tricks_won ?? 0) + 1 };
          }
          pushFrame();
          await new Promise<void>((r) => setTimeout(r, TRICK_HOLD_MS));
          stagedTrick = [];
          pushFrame();
        } else {
          pushFrame();
        }
        if (ev.round_complete) break;
      }
      // Commit authoritative state once the staging finishes.
      setRaw(next);
      detectRoundEnd(next);
    } finally {
      setBusy(false);
    }
  }, [raw, busy, flashStatus, detectRoundEnd]);

  const startNextHand = useCallback(async () => {
    if (!raw || busy) return;
    setBusy(true);
    try {
      const res = await authFetch(`${API}/api/hearts-practice/new-hand`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        flashStatus(err.detail || "Failed to start next hand", "rose");
        return;
      }
      const data = await res.json();
      const next = data.game as HeartsRawState;
      setRaw(next);
      flashStatus(`New hand · ${DIRECTION_LABEL[next.pass_direction]}`, "rose", 1800);
      startDealSequence(next);
    } finally {
      setBusy(false);
    }
  }, [raw, busy, flashStatus, startDealSequence]);

  const handleRoundModalClose = () => {
    setRoundModalOpen(false);
    if (raw?.phase === "scoring") {
      void startNextHand();
    }
  };

  const backToLobby = () => {
    setRaw(null);
    setRoundModalOpen(false);
    setPassOpen(false);
    setDealing(false);
    setLastRoundSummary(null);
    prevTeamScoresRef.current = null;
    setPhase("lobby");
  };

  // Auto-open pass modal when entering passing phase with cards still due.
  useEffect(() => {
    if (raw?.phase === "passing" && raw.pending_human_pass && !dealing) {
      setPassOpen(true);
    }
  }, [raw?.phase, raw?.pending_human_pass, dealing]);

  // ── Lobby ──────────────────────────────────────────────────────────
  if (phase === "lobby") {
    return (
      <div
        className="min-h-screen bg-[#050507] text-white relative overflow-x-hidden"
        data-testid="hearts-aaa-lobby"
      >
        <div
          className="absolute inset-0 pointer-events-none opacity-30"
          style={{
            backgroundImage:
              "linear-gradient(rgba(244,63,94,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(244,63,94,0.08) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 w-[60vw] h-[60vw] max-w-[700px] max-h-[700px] rounded-full bg-rose-500/15 blur-[120px]" />
        </div>

        <div className="relative z-10 max-w-3xl mx-auto px-4 py-6">
          <button
            onClick={() => navigate("/games")}
            className="flex items-center gap-2 text-rose-300/70 hover:text-white transition mb-4 text-sm font-bold"
            data-testid="hearts-aaa-lobby-back"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Games
          </button>

          <div className="flex items-center gap-3 mb-8">
            <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-rose-500 to-red-700 shadow-[0_0_24px_rgba(244,63,94,0.45)]">
              <Heart className="w-8 h-8 text-white" />
            </div>
            <div>
              <p
                className="text-xs font-mono uppercase tracking-[0.3em] text-rose-400/80"
                style={{ fontFamily: "'Cinzel', serif" }}
              >
                Card Room · Hearts
              </p>
              <h1
                className="text-3xl md:text-4xl font-black leading-none"
                style={{ fontFamily: "'Cinzel', serif" }}
              >
                Hearts AAA
              </h1>
            </div>
          </div>

          <div className="mb-6 p-4 rounded-2xl bg-white/[0.03] border border-rose-400/20 text-sm text-rose-100/80 leading-relaxed">
            <p
              className="text-xs uppercase tracking-[0.3em] text-rose-300 font-bold mb-2"
              style={{ fontFamily: "'Cinzel', serif" }}
            >
              House Rules
            </p>
            • 52-card deck · 13 cards each · pass 3 cards each hand (left → right → across → no-pass)<br />
            • Whoever holds <strong>2♣</strong> leads the first trick · must lead 2♣<br />
            • Must follow suit · hearts can't be led until "broken"<br />
            • Each ♥ = 1 point · <strong>Q♠ = 13 points</strong> · <em>shoot the moon</em> = 0 for you, 26 for everyone else<br />
            • First to <strong>100 points</strong> loses · lowest score wins
          </div>

          <button
            onClick={startGame}
            disabled={busy}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-rose-500 via-red-500 to-rose-500 hover:from-rose-400 hover:to-red-400 text-white font-black uppercase tracking-widest text-base shadow-[0_0_30px_rgba(244,63,94,0.45)] disabled:opacity-50"
            style={{ fontFamily: "'Cinzel', serif" }}
            data-testid="hearts-aaa-lobby-start-btn"
          >
            {busy ? "Dealing…" : "Start AI Match"}
          </button>
        </div>
      </div>
    );
  }

  if (!raw) {
    return (
      <div className="min-h-screen bg-[#050507] flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-rose-400 animate-spin" />
      </div>
    );
  }

  const youPosition = raw.user_position;
  const players = adaptPlayers(raw.players_data, youPosition);
  const trickPile = adaptTrickPile(raw.current_trick);
  const scores = buildSpadesScores(raw.scores);
  const uiPhase = adaptPhase(raw.phase);
  const isFinished = raw.phase === "finished";
  const tricksPlayed = raw.tricks_played;

  return (
    <div
      className="min-h-screen bg-gradient-to-b from-[#1a050a] via-[#0a020a] to-[#050507] text-white relative overflow-x-hidden"
      data-testid="hearts-aaa"
    >
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.12]"
        style={{
          backgroundImage:
            "linear-gradient(#3a0a14 1px, transparent 1px), linear-gradient(90deg, #3a0a14 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      <div className="relative z-10 flex flex-col min-h-screen">
        <div className="flex flex-wrap items-start justify-between px-2 sm:px-3 md:px-5 pt-2 sm:pt-3 md:pt-4 gap-2">
          <div className="flex flex-col items-start gap-2">
            <button
              onClick={backToLobby}
              className="flex items-center gap-1.5 text-rose-300/70 hover:text-white transition text-xs md:text-sm font-bold"
              data-testid="hearts-aaa-back-btn"
            >
              <ArrowLeft className="w-4 h-4" /> Lobby
            </button>
            <SpadesGameMenu
              onExit={backToLobby}
              onOpenMessages={() => setChatOpen(true)}
            />
          </div>

          <div className="flex flex-col items-center gap-1.5 order-3 w-full sm:order-none sm:w-auto">
            <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
              <div className="px-2 py-0.5 rounded-full bg-rose-500/15 border border-rose-400/40 text-[9px] md:text-[10px] uppercase tracking-[0.3em] text-rose-300 font-bold">
                Hearts
              </div>
              <div className="px-2 py-0.5 rounded-full bg-fuchsia-500/15 border border-fuchsia-400/40 text-[9px] md:text-[10px] uppercase tracking-[0.3em] text-fuchsia-300 font-bold">
                <span className="inline-flex items-center gap-1">
                  <Bot className="w-2.5 h-2.5" /> AI
                </span>
              </div>
              <div className="px-2 py-0.5 rounded-full bg-rose-500/15 border border-rose-400/40 text-[9px] md:text-[10px] uppercase tracking-[0.3em] text-rose-300 font-bold">
                {DIRECTION_LABEL[raw.pass_direction]}
              </div>
              {raw.hearts_broken ? (
                <div className="px-2 py-0.5 rounded-full bg-pink-500/15 border border-pink-400/40 text-[9px] md:text-[10px] uppercase tracking-[0.3em] text-pink-300 font-bold">
                  Hearts Broken
                </div>
              ) : null}
            </div>
          </div>

          <SpadesScoreBadge
            scores={scores}
            players={players}
            phase={uiPhase}
            tricksPlayed={tricksPlayed}
          />
        </div>

        <SpadesStatusBanner message={statusMsg} />

        {/* Universal turn indicator (LOCKED 2026-02-16 — every multiplayer room) */}
        {raw.turn && !isFinished && (() => {
          const partnerOf: Record<string, string> = { north: 'south', south: 'north', east: 'west', west: 'east' };
          const role: TurnRole = raw.turn === youPosition
            ? 'me'
            : raw.turn === partnerOf[youPosition]
              ? 'partner'  // hearts is FFA scoring but partnership in some variants
              : 'opponent';
          return <TurnIndicator role={role} name={role === 'me' ? undefined : players[raw.turn]?.name} />;
        })()}

        <div className="flex items-center justify-center py-2 md:py-3 relative">
          <div className="relative">
            <SpadesTable brandSubLabel="HEARTS" variant="crimson" centreGlyph="♥">
              <SpadesSeat
                position="north"
                player={players.north}
                isTurn={raw.turn === "north"}
                isYou={youPosition === "north"}
                onClick={() => setProfileOpen("north")}
              />
              <SpadesSeat
                position="east"
                player={players.east}
                isTurn={raw.turn === "east"}
                isYou={youPosition === "east"}
                onClick={() => setProfileOpen("east")}
              />
              <SpadesSeat
                position="west"
                player={players.west}
                isTurn={raw.turn === "west"}
                isYou={youPosition === "west"}
                onClick={() => setProfileOpen("west")}
              />
              <SpadesTrickPile trick={trickPile} />
            </SpadesTable>
            <SpadesDealingAnimation active={dealing} />
          </div>
        </div>

        <div className="px-3 md:px-4 -mt-10 md:-mt-12 pb-3 md:pb-4 relative z-20">
          {raw.phase === "playing" ? (
            <SpadesHandFan
              key={dealKey}
              hand={raw.your_hand}
              validPlays={raw.playable_cards ?? []}
              isYourTurn={raw.turn === youPosition}
              onPlay={playCard}
              busy={busy}
            />
          ) : raw.phase === "passing" && !dealing && !passOpen ? (
            <div className="text-center text-rose-300/60 text-xs uppercase tracking-[0.3em] font-bold">
              Waiting for partners to pass…
            </div>
          ) : null}

          {isFinished ? (
            <FinishedFooter
              winner={raw.match_winner}
              youPosition={youPosition}
              onLobby={backToLobby}
              onReplay={startGame}
              busy={busy}
            />
          ) : null}
        </div>
      </div>

      <HeartsPassModal
        open={passOpen && raw.phase === "passing" && !isFinished}
        hand={raw.your_hand}
        passDirection={raw.pass_direction}
        busy={busy}
        onSubmit={submitPass}
      />

      <SpadesRoundModal
        open={roundModalOpen && !isFinished}
        summary={lastRoundSummary}
        scores={scores}
        players={players}
        onClose={handleRoundModalClose}
      />

      <SpadesPlayerProfile
        open={profileOpen !== null}
        position={profileOpen}
        player={profileOpen ? players[profileOpen] : null}
        isYou={profileOpen === youPosition}
        onClose={() => setProfileOpen(null)}
      />

      <SpadesCommunityChat
        open={chatOpen}
        gameId={`hearts-${raw.user_position}`}
        mode="ai"
        onClose={() => setChatOpen(false)}
      />
    </div>
  );
}

const FinishedFooter: React.FC<{
  winner: SpadesPosition | null;
  youPosition: SpadesPosition;
  onLobby: () => void;
  onReplay: () => void;
  busy: boolean;
}> = ({ winner, youPosition, onLobby, onReplay, busy }) => {
  const youWon = winner === youPosition;
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-4 p-6 rounded-2xl bg-gradient-to-br from-rose-950/40 to-[#050507] border-2 border-rose-500/40 text-center"
      data-testid="hearts-aaa-finished-footer"
    >
      <Heart
        className={`w-10 h-10 mx-auto mb-2 ${youWon ? "text-rose-300" : "text-slate-300"}`}
      />
      <h2
        className="text-2xl font-black mb-1"
        style={{ fontFamily: "'Cinzel', serif" }}
      >
        {youWon ? "You Win!" : `${BOT_NAMES[winner ?? "north"]} wins`}
      </h2>
      <p className="text-rose-200/70 mb-4 text-sm">
        Lowest total when someone breaks 100 takes the match.
      </p>
      <div className="flex gap-3 justify-center">
        <button
          onClick={onReplay}
          disabled={busy}
          className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-400 hover:to-red-500 text-white font-bold disabled:opacity-50"
          data-testid="hearts-aaa-replay-btn"
        >
          Play Again
        </button>
        <button
          onClick={onLobby}
          className="px-5 py-2.5 rounded-lg border border-rose-400/40 text-rose-200 hover:bg-rose-500/10 font-bold"
          data-testid="hearts-aaa-lobby-btn"
        >
          Back to Lobby
        </button>
      </div>
    </motion.div>
  );
};
