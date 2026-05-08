/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎴 SPADES AAA — Global Vibez Spades Superior Edition
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Single canonical Spades room. Replaces six legacy implementations.
 *
 * Visual lineage — matches the BidWhistPremium (Vibe Wiz Premium) room
 * which the user explicitly called out as the reference:
 *   • Emerald-green felt + dark-amber wood-tone frame (rounded rectangle)
 *   • Center casino chip with VIBEZ branding + 4 suit pips
 *   • Player badges floating OUTSIDE the felt at N/S/E/W with red/blue
 *     team borders, Cinzel font, amber "book count cube"
 *   • Score lives as a compressed badge in the top-right (not as giant
 *     twin blocks above the table)
 *   • Bidding appears as a MODAL popup that animates in after the
 *     dealing-animation finishes (so the player sees cards fly to each
 *     seat first, then the bid UI reveals itself)
 *
 * Flow:
 *   1. Lobby → pick Mode + Ruleset → Start
 *   2. Game phase begins with a 1.4s dealing animation (cards fly from
 *      the chip to each seat in rotation)
 *   3. Bid modal pops up, user taps a number chip, confirms
 *   4. Bots auto-bid, phase flips to 'playing'
 *   5. Hand fan renders at the bottom; trick pile builds in the center
 *   6. After 13 tricks, Round Modal summarises the delta, then loops to
 *      a fresh deal for the next hand.
 *
 * Backend: AI mode uses /api/spades-practice/*; live mode shows a
 * matchmaking placeholder (queue→game wiring is the next iteration).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Bot, Crown, Loader2, Wifi } from "lucide-react";
import { authFetch } from "@/utils/secureAuth";

import SpadesTable from "@/components/spades/SpadesTable";
import SpadesLobby from "@/components/spades/SpadesLobby";
import SpadesStatusBanner from "@/components/spades/SpadesStatusBanner";
import SpadesBidModal from "@/components/spades/SpadesBidModal";
import SpadesHandFan from "@/components/spades/SpadesHandFan";
import SpadesScoreBadge from "@/components/spades/SpadesScoreBadge";
import SpadesSeat from "@/components/spades/SpadesSeat";
import SpadesTrickPile from "@/components/spades/SpadesTrickPile";
import SpadesRoundModal from "@/components/spades/SpadesRoundModal";
import SpadesDealingAnimation from "@/components/spades/SpadesDealingAnimation";
import SpadesGameMenu from "@/components/spades/SpadesGameMenu";
import SpadesPlayerProfile from "@/components/spades/SpadesPlayerProfile";
import SpadesCommunityChat from "@/components/spades/SpadesCommunityChat";
import TurnIndicator, { type TurnRole } from "@/components/games/TurnIndicator";
import ScoreBoardPanel from "@/components/games/ScoreBoardPanel";
import SpecialStatePrompt, { type SpecialStateVariant } from "@/components/games/SpecialStatePrompt";
import type {
  SpadesCard,
  SpadesPracticeState,
  SpadesPosition,
  SpadesRuleset,
  SpadesMode,
  StatusMessage,
} from "@/components/spades/types";

const API = process.env.REACT_APP_BACKEND_URL;

export default function SpadesAAA() {
  const navigate = useNavigate();

  // Phase machine: lobby → queue (live only) → game
  const [phase, setPhase] = useState<"lobby" | "queue" | "game">("lobby");

  // Lobby state
  const [mode, setMode] = useState<SpadesMode>("ai");
  const [ruleset, setRuleset] = useState<SpadesRuleset>("CLASSIC");

  // Game state
  const [game, setGame] = useState<SpadesPracticeState | null>(null);
  const [busy, setBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState<StatusMessage | null>(null);

  // Round flow
  const [roundModalOpen, setRoundModalOpen] = useState(false);
  const [lastRoundSummary, setLastRoundSummary] = useState<{
    team1Score: number;
    team2Score: number;
    delta1: number;
    delta2: number;
  } | null>(null);
  const prevScoresRef = useRef<{ team1: number; team2: number } | null>(null);

  // Animation triggers
  const [dealing, setDealing] = useState(false);
  const [bidModalOpen, setBidModalOpen] = useState(false);
  /** Held when the player chose Nil (bid 0) — drives <SpecialStatePrompt>. */
  const [pendingNil, setPendingNil] = useState<number | null>(null);
  const [dealKey, setDealKey] = useState(0);

  // Overlay state
  const [profileOpen, setProfileOpen] = useState<SpadesPosition | null>(null);

  // Universal 10-second Shot Clock (Beta Specs §6 — copy from Whist).
  // Resets on every turn change; auto-plays the lowest valid card on
  // expire so idle play doesn't stall the table.
  const SHOT_CLOCK_MS = 10_000;
  const [turnExpiresAt, setTurnExpiresAt] = useState<number | null>(null);
  const lastTurnKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!game) {
      setTurnExpiresAt(null);
      lastTurnKeyRef.current = null;
      return;
    }
    const activeKey = game.turn_position ?? null;
    const turnKey = activeKey
      ? `${game.phase}:${activeKey}:${game.current_trick?.length ?? 0}`
      : null;
    if (turnKey !== lastTurnKeyRef.current) {
      lastTurnKeyRef.current = turnKey;
      setTurnExpiresAt(activeKey ? Date.now() + SHOT_CLOCK_MS : null);
    }
  }, [game]);
  const [chatOpen, setChatOpen] = useState(false);

  // Hand-review window between the deal animation and the bid modal.
  // Per the user: "after you deal the cards, we need to have a 10-second
  // runoff while the player can look at the cards... then you let the
  // player Place Your Bid pop up." During review, the hand fan is
  // visible but non-interactive, and a countdown + early-start button
  // give the player control.
  const REVIEW_SECONDS = 10;
  const [reviewActive, setReviewActive] = useState(false);
  const [reviewRemaining, setReviewRemaining] = useState(REVIEW_SECONDS);
  const reviewTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const flashStatus = useCallback(
    (text: string, tone: StatusMessage["tone"] = "cyan", ttl = 2400) => {
      setStatusMsg({ text, tone, id: Date.now() });
      window.setTimeout(() => {
        setStatusMsg((prev) =>
          prev && prev.text === text ? null : prev,
        );
      }, ttl);
    },
    [],
  );

  // Kick off the dealing animation → 10s hand-review → bid modal sequence.
  // Stages (all triggered by the same startDealSequence call):
  //   0.0s → deal animation begins (cards fly from center chip)
  //   3.5s → deal finishes; hand fan reveals; 10s review countdown starts
  //  13.5s → review ends; bid modal pops up automatically
  // The player can short-circuit the 10s review via the "Place Bid Now"
  // button rendered in the review footer.
  const endReviewAndShowBid = useCallback(() => {
    if (reviewTimerRef.current) {
      clearInterval(reviewTimerRef.current);
      reviewTimerRef.current = null;
    }
    setReviewActive(false);
    setBidModalOpen(true);
  }, []);

  const startDealSequence = useCallback(() => {
    setDealing(true);
    setBidModalOpen(false);
    setReviewActive(false);
    setReviewRemaining(REVIEW_SECONDS);

    // Stage 1 → let the deal animation run (~3.5s), then begin review.
    window.setTimeout(() => {
      setDealing(false);
      setReviewActive(true);
      setReviewRemaining(REVIEW_SECONDS);

      // Stage 2 → 10-second countdown during which the hand is visible
      // but the bid modal stays closed.
      if (reviewTimerRef.current) clearInterval(reviewTimerRef.current);
      reviewTimerRef.current = setInterval(() => {
        setReviewRemaining((r) => {
          if (r <= 1) {
            // Stage 3 → fire the bid modal.
            if (reviewTimerRef.current) {
              clearInterval(reviewTimerRef.current);
              reviewTimerRef.current = null;
            }
            setReviewActive(false);
            setBidModalOpen(true);
            return 0;
          }
          return r - 1;
        });
      }, 1000);
    }, 3500);
  }, []);

  // Cancel the review timer on unmount / back-to-lobby to avoid leaks.
  useEffect(() => {
    return () => {
      if (reviewTimerRef.current) clearInterval(reviewTimerRef.current);
    };
  }, []);

  // AI game start
  const startAiGame = useCallback(
    async (rs: SpadesRuleset) => {
      setBusy(true);
      try {
        const res = await authFetch(`${API}/api/spades-practice/start`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ruleset: rs }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          flashStatus(err.detail || "Failed to start", "rose");
          return;
        }
        const data = await res.json();
        setGame(data.game);
        prevScoresRef.current = {
          team1: data.game.scores?.team1?.points ?? 0,
          team2: data.game.scores?.team2?.points ?? 0,
        };
        setPhase("game");
        setDealKey((k) => k + 1);
        flashStatus(`${data.game.ruleset_label} · Dealing…`, "cyan", 1600);
        startDealSequence();
      } catch (e) {
        flashStatus("Network error", "rose");
      } finally {
        setBusy(false);
      }
    },
    [flashStatus, startDealSequence],
  );

  // Place user's bid via modal — Nil (0) intercepts via SpecialStatePrompt.
  const submitBidNow = useCallback(
    async (bid: number) => {
      if (!game || busy) return;
      setBusy(true);
      setBidModalOpen(false);
      try {
        const res = await authFetch(`${API}/api/spades-practice/bid`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ game_id: game.game_id, bid }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          flashStatus(err.detail || "Bid failed", "rose");
          setBidModalOpen(true); // let the user retry
          return;
        }
        const data = (await res.json()) as SpadesPracticeState;
        setGame(data);
        flashStatus(
          bid === 0 ? "Nil bid placed" : `You bid ${bid}`,
          bid === 0 ? "amber" : "cyan",
        );
      } finally {
        setBusy(false);
      }
    },
    [game, busy, flashStatus],
  );

  /**
   * Nil intercept (LOCKED 2026-02-16) — picking 0 in the bid pad pops
   * the canonical full-screen <SpecialStatePrompt nil> for explicit
   * confirmation. Same drama as BidWhistAAA's Boston flow. Bids 1+
   * pass straight through.
   */
  const placeBid = useCallback(
    async (bid: number) => {
      if (bid === 0) {
        setBidModalOpen(false);
        setPendingNil(0);
        return;
      }
      await submitBidNow(bid);
    },
    [submitBidNow],
  );

  // Play a card during the playing phase. The backend resolves the
  // whole trick (user + 3 bots) in one HTTP call, but the player
  // should see each card physically land one-at-a-time with a brief
  // pause between plays so they can follow what's happening. We do
  // that by mutating the local `game.current_trick` over time from the
  // server's ordered `play_sequence`, then applying the final state
  // (scores, next turn, next trick, phase change) only after the
  // sequence finishes playing out.
  const CARD_STAGING_MS = 850;   // time between consecutive card reveals
  const TRICK_HOLD_MS = 1200;    // extra pause once the 4th card lands
  const playCard = useCallback(
    async (card: SpadesCard) => {
      if (!game || busy) return;
      setBusy(true);
      try {
        const res = await authFetch(`${API}/api/spades-practice/play`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ game_id: game.game_id, card }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          flashStatus(err.detail || "Play rejected", "rose");
          setBusy(false);
          return;
        }
        const data = (await res.json()) as SpadesPracticeState;
        const seq = data.play_sequence ?? [];

        // Fast-path: nothing to stage (empty sequence) → just apply the
        // final state. Should never happen but keeps behavior safe.
        if (seq.length === 0) {
          setGame(data);
          setBusy(false);
          return;
        }

        // Stage the reveals. We don't flip `setGame(data)` (which would
        // clear the trick for the NEXT hand) until every card in the
        // last trick has been shown and the hold-pause expires.
        //
        // Local staging state starts from the CURRENT trick (pre-play).
        const startingTrick = [...game.current_trick];
        let stagedTrick: typeof game.current_trick = startingTrick;
        const removeCardFromMyHand = (c: SpadesCard): SpadesCard[] =>
          game.your_hand.filter(
            (h) => !(h.suit === c.suit && h.rank === c.rank),
          );

        // Per-player tricks counter — bump when a trick completes so the
        // seat-badge book-cube updates in real time along with the pile.
        const stagedPlayers = { ...game.players };
        // Mutable copy of your hand so the fan shrinks as you play.
        let stagedHand = removeCardFromMyHand(card);

        for (let i = 0; i < seq.length; i++) {
          const ev = seq[i];
          const isFirstEv = i === 0;
          // On each event: add the card to the visible trick pile.
          stagedTrick = [
            ...stagedTrick,
            { position: ev.player, card: ev.card },
          ];

          // Tiny initial wait so the user's own card also animates in
          // (backend response arrives faster than the card animation).
          await new Promise<void>((r) =>
            setTimeout(r, isFirstEv ? 200 : CARD_STAGING_MS),
          );

          // When a trick completes, pause so everyone sees the winner
          // clearly, then clear the pile for the next trick.
          if (ev.trick_complete && ev.trick_winner) {
            // Flash a status banner announcing the winner.
            const winnerSeat = ev.trick_winner as SpadesPosition;
            const winnerName =
              stagedPlayers[winnerSeat]?.name ?? winnerSeat;
            flashStatus(`${winnerName} took the trick`, "emerald", 1400);
            // Bump their tricks counter.
            if (stagedPlayers[winnerSeat]) {
              stagedPlayers[winnerSeat] = {
                ...stagedPlayers[winnerSeat],
                tricks: stagedPlayers[winnerSeat].tricks + 1,
              };
            }

            // Push the staged state so the UI reflects the completed
            // pile with all 4 cards before we clear it.
            setGame((prev) =>
              prev
                ? {
                    ...prev,
                    current_trick: stagedTrick,
                    players: stagedPlayers,
                    your_hand: stagedHand,
                  }
                : prev,
            );

            // Hold on the complete trick so the player sees it.
            await new Promise<void>((r) => setTimeout(r, TRICK_HOLD_MS));

            // Clear for the next trick (visually) — the server's final
            // response knows the next trick may already have a card
            // (the winner leads) but we'll reconcile that when we
            // commit the full state below.
            stagedTrick = [];
            setGame((prev) =>
              prev
                ? {
                    ...prev,
                    current_trick: [],
                    players: stagedPlayers,
                    your_hand: stagedHand,
                  }
                : prev,
            );
          } else {
            // Mid-trick: just push the accumulated pile + updated hand.
            setGame((prev) =>
              prev
                ? {
                    ...prev,
                    current_trick: stagedTrick,
                    players: stagedPlayers,
                    your_hand: stagedHand,
                  }
                : prev,
            );
          }
        }

        // Final reconciliation: commit the authoritative server state.
        // This catches any lingering turn_position / led_suit /
        // spades_broken / valid_plays / phase change / next-trick
        // first card that we couldn't infer from the sequence alone.
        const prev = prevScoresRef.current;
        const t1 = data.scores?.team1?.points ?? 0;
        const t2 = data.scores?.team2?.points ?? 0;
        if (prev && (t1 !== prev.team1 || t2 !== prev.team2)) {
          setLastRoundSummary({
            team1Score: t1,
            team2Score: t2,
            delta1: t1 - prev.team1,
            delta2: t2 - prev.team2,
          });
          setRoundModalOpen(true);
          prevScoresRef.current = { team1: t1, team2: t2 };
          if (data.phase === "bidding") {
            setDealKey((k) => k + 1);
          }
        }
        setGame(data);
      } finally {
        setBusy(false);
      }
    },
    [game, busy, flashStatus],
  );

  // Shot-clock auto-play (Beta Specs §6 + Universal Design Agent §2):
  // when the user's 10s expires, play their lowest valid card so the
  // table never stalls. Bots are driven server-side already.
  const handleShotClockExpire = useCallback(() => {
    if (!game || busy) return;
    if (game.turn_position !== "south") return;
    const candidates = game.valid_plays?.length
      ? game.valid_plays
      : game.your_hand;
    if (!candidates || candidates.length === 0) return;
    const RANK_VALUES: Record<string, number> = {
      "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8,
      "9": 9, "10": 10, J: 11, Q: 12, K: 13, A: 14,
    };
    const lowest = [...candidates].sort(
      (a, b) => (RANK_VALUES[a.rank] ?? 99) - (RANK_VALUES[b.rank] ?? 99),
    )[0];
    flashStatus("Shot clock — auto-played", "amber");
    void playCard(lowest);
  }, [game, busy, flashStatus, playCard]);

  // When the round modal closes AND we're in a new bidding phase, kick
  // off the deal animation for the next hand.
  const handleRoundModalClose = () => {
    setRoundModalOpen(false);
    if (game?.phase === "bidding") {
      startDealSequence();
    }
  };

  const backToLobby = () => {
    if (reviewTimerRef.current) {
      clearInterval(reviewTimerRef.current);
      reviewTimerRef.current = null;
    }
    setGame(null);
    setRoundModalOpen(false);
    setBidModalOpen(false);
    setDealing(false);
    setReviewActive(false);
    setLastRoundSummary(null);
    prevScoresRef.current = null;
    setPhase("lobby");
  };

  const isFinished = game?.phase === "finished";

  // ── Lobby ───────────────────────────────────────────────────────────
  if (phase === "lobby") {
    return (
      <SpadesLobby
        mode={mode}
        ruleset={ruleset}
        busy={busy}
        onChangeMode={setMode}
        onChangeRuleset={setRuleset}
        onStart={() => {
          if (mode === "ai") {
            void startAiGame(ruleset);
          } else {
            flashStatus("Live multiplayer queue starting…", "cyan");
            setPhase("queue");
          }
        }}
        onBack={() => navigate("/games")}
      />
    );
  }

  // ── Live queue (placeholder) ────────────────────────────────────────
  if (phase === "queue") {
    return (
      <div
        className="min-h-screen bg-[#050507] text-white flex items-center justify-center px-4"
        data-testid="spades-queue-screen"
      >
        <div className="text-center max-w-md">
          <Loader2 className="w-12 h-12 text-cyan-400 animate-spin mx-auto mb-6" />
          <h1 className="text-3xl font-black mb-2">Looking for opponents…</h1>
          <p className="text-purple-200/70 mb-6">
            Live multiplayer Spades needs 4 players. You and 3 more.
          </p>
          <button
            onClick={backToLobby}
            className="px-5 py-2.5 rounded-lg border border-cyan-400/40 text-cyan-200 hover:bg-cyan-500/10 font-bold"
            data-testid="spades-queue-cancel-btn"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // ── Game ────────────────────────────────────────────────────────────
  if (!game) {
    return (
      <div className="min-h-screen bg-[#050507] flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-cyan-400 animate-spin" />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-gradient-to-b from-[#05070d] via-[#081021] to-[#050507] text-white relative overflow-x-hidden"
      data-testid="spades-aaa"
    >
      {/* Subtle glasshouse grid — same as BidWhistPremium */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.12]"
        style={{
          backgroundImage:
            "linear-gradient(#333 1px, transparent 1px), linear-gradient(90deg, #333 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      <div className="relative z-10 flex flex-col min-h-screen">
        {/* ── Top bar: Back · Badges · Score ── */}
        <div className="flex flex-wrap items-start justify-between px-2 sm:px-3 md:px-5 pt-2 sm:pt-3 md:pt-4 gap-2">
          <div className="flex flex-col items-start gap-2">
            <button
              onClick={backToLobby}
              className="flex items-center gap-1.5 text-amber-300/70 hover:text-white transition text-xs md:text-sm font-bold"
              data-testid="spades-back-btn"
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
              <div className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-400/40 text-[9px] md:text-[10px] uppercase tracking-[0.3em] text-amber-300 font-bold">
                {game.ruleset_label ?? "Classic"}
              </div>
              <div className="px-2 py-0.5 rounded-full bg-fuchsia-500/15 border border-fuchsia-400/40 text-[9px] md:text-[10px] uppercase tracking-[0.3em] text-fuchsia-300 font-bold">
                {mode === "ai" ? (
                  <span className="inline-flex items-center gap-1">
                    <Bot className="w-2.5 h-2.5" /> AI
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1">
                    <Wifi className="w-2.5 h-2.5" /> Live
                  </span>
                )}
              </div>
            </div>
          </div>

          <SpadesScoreBadge
            scores={game.scores}
            players={game.players}
            phase={game.phase}
            tricksPlayed={game.tricks_played}
          />
        </div>

        {/* ── Phase 2 polish: collapsible scoreboard panel (LOCKED 2026-02-16) ── */}
        <ScoreBoardPanel
          rows={[
            {
              id: 'us',
              label: `Us · ${game.players?.south?.name ?? 'You'} + ${game.players?.north?.name ?? 'Partner'}`,
              color: '#FFD33D',
              score: game.scores?.team1?.points ?? 0,
              bid: game.scores?.team1?.bid,
              tricks: game.scores?.team1?.tricks_taken,
              bags: game.scores?.team1?.bags,
            },
            {
              id: 'them',
              label: `Them · ${game.players?.east?.name ?? 'Opp'} + ${game.players?.west?.name ?? 'Opp'}`,
              color: '#9CA3AF',
              score: game.scores?.team2?.points ?? 0,
              bid: game.scores?.team2?.bid,
              tricks: game.scores?.team2?.tricks_taken,
              bags: game.scores?.team2?.bags,
            },
          ]}
          title="Scoreboard"
        />

        {/* ── Status banner ── */}
        <SpadesStatusBanner message={statusMsg} />

        {/* ── Universal turn indicator (LOCKED 2026-02-16 — every multiplayer room) ── */}
        {(() => {
          const yourPos = game.user_position;
          const turnPos = game.turn_position;
          if (!turnPos) return null;
          // Spades partnerships: north/south = team 1, east/west = team 2.
          // From your perspective, your "partner" is the seat across the table.
          const partnerOf: Record<string, string> = {
            north: 'south', south: 'north', east: 'west', west: 'east',
          };
          const role: TurnRole =
            turnPos === yourPos ? 'me'
            : turnPos === partnerOf[yourPos] ? 'partner'
            : 'opponent';
          const turnPlayer = game.players?.[turnPos as keyof typeof game.players];
          return (
            <TurnIndicator
              role={role}
              name={role === 'me' ? undefined : (turnPlayer?.name || (turnPos as string))}
              expiresAt={role === 'me' ? turnExpiresAt : null}
            />
          );
        })()}

        {/* ── ARENA (table + seats + dealing layer) ──
            Content-sized so the hand fan directly below can tuck up
            against the bottom rim instead of floating at the viewport
            bottom. */}
        <div className="flex items-center justify-center py-2 md:py-3 relative">
          <div className="relative">
            <SpadesTable brandSubLabel={game.ruleset_label ? `${game.ruleset_label.toUpperCase()}` : "SPADES AAA"}>
              <SpadesSeat
                position="north"
                player={game.players.north}
                isTurn={game.turn_position === "north"}
                isYou={false}
                onClick={() => setProfileOpen("north")}
                shotClockExpiresAt={game.turn_position === "north" ? turnExpiresAt : null}
                onShotClockExpire={handleShotClockExpire}
              />
              <SpadesSeat
                position="east"
                player={game.players.east}
                isTurn={game.turn_position === "east"}
                isYou={false}
                onClick={() => setProfileOpen("east")}
                shotClockExpiresAt={game.turn_position === "east" ? turnExpiresAt : null}
                onShotClockExpire={handleShotClockExpire}
              />
              <SpadesSeat
                position="west"
                player={game.players.west}
                isTurn={game.turn_position === "west"}
                isYou={false}
                onClick={() => setProfileOpen("west")}
                shotClockExpiresAt={game.turn_position === "west" ? turnExpiresAt : null}
                onShotClockExpire={handleShotClockExpire}
              />
              {/* South is YOU — we intentionally do NOT render your own
                  seat badge on your own screen. You know who you are;
                  other players in live mode still see it via their own
                  client. The hand fan below visually anchors your seat. */}
              <SpadesTrickPile trick={game.current_trick} />
            </SpadesTable>

            {/* Dealing animation sits on top of the arena */}
            <SpadesDealingAnimation active={dealing} />
          </div>
        </div>

        {/* ── Hand fan — "like cards sitting on the table edge" ──
            Pulled tight against the felt with a negative margin so the
            top of the fan overlaps the bottom rim. Per the user: "move
            the cards very close to the table... like if a bowl was
            sitting on the table and the cards was coming around."
            Renders during the playing phase AND during the 10s review
            window so the player can study their freshly-dealt hand
            before the bid modal pops up. */}
        <div className="px-3 md:px-4 -mt-10 md:-mt-12 pb-3 md:pb-4 relative z-20">
          {game.phase === "playing" ? (
            <SpadesHandFan
              key={dealKey}
              hand={game.your_hand}
              validPlays={game.valid_plays ?? []}
              isYourTurn={game.turn_position === "south"}
              onPlay={playCard}
              busy={busy}
            />
          ) : game.phase === "bidding" && reviewActive ? (
            <>
              {/* Floating countdown pill — positioned as a small overlay
                  above the center of the hand fan so it doesn't push
                  the cards away from the table rim. */}
              <div
                className="absolute left-1/2 -translate-x-1/2 -top-3 md:-top-4 flex items-center gap-2 z-30"
                data-testid="spades-review-banner"
              >
                <div className="px-2.5 py-1 rounded-full bg-slate-950/90 backdrop-blur border-2 border-amber-500/70 flex items-center gap-1.5 shadow-[0_0_16px_rgba(251,191,36,0.35)]">
                  <span
                    className="text-[9px] uppercase tracking-[0.25em] text-amber-300/80 font-bold"
                    style={{ fontFamily: "'Cinzel', serif" }}
                  >
                    Review
                  </span>
                  <span
                    className="text-sm font-black text-amber-300 tabular-nums leading-none"
                    style={{ fontFamily: "'Cinzel', serif" }}
                    data-testid="spades-review-countdown"
                  >
                    {reviewRemaining}s
                  </span>
                </div>
                <button
                  onClick={endReviewAndShowBid}
                  className="px-2.5 py-1 rounded-full bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-[#3a2500] font-black text-[10px] uppercase tracking-widest transition shadow-[0_0_16px_rgba(251,191,36,0.35)]"
                  style={{ fontFamily: "'Cinzel', serif" }}
                  data-testid="spades-review-bid-now-btn"
                >
                  Bid Now
                </button>
              </div>
              {/* Hand fan (display-only during review) */}
              <SpadesHandFan
                key={`review-${dealKey}`}
                hand={game.your_hand}
                validPlays={[]}
                isYourTurn={false}
                onPlay={() => undefined}
                busy={true}
                hideTurnIndicator={true}
              />
            </>
          ) : game.phase === "bidding" && !dealing && !bidModalOpen ? (
            <div className="text-center text-amber-300/60 text-xs uppercase tracking-[0.3em] font-bold">
              Waiting for bids…
            </div>
          ) : null}

          {isFinished ? (
            <FinishedFooter
              winnerTeam={
                (game.scores?.team1?.points ?? 0) >=
                (game.scores?.team2?.points ?? 0)
                  ? "team1"
                  : "team2"
              }
              onLobby={backToLobby}
              onReplay={() => startAiGame(ruleset)}
              busy={busy}
            />
          ) : null}
        </div>
      </div>

      {/* ── Modals layer ── */}
      <SpadesBidModal
        open={bidModalOpen && game.phase === "bidding" && !isFinished}
        ruleset={game.ruleset as SpadesRuleset | undefined}
        hand={game.your_hand}
        onBid={placeBid}
        busy={busy}
      />

      {/* Nil full-screen confirmation (LOCKED 2026-02-16). Cancel reopens
           the bid modal so the player can pick a number bid instead. */}
      <SpecialStatePrompt
        open={pendingNil !== null}
        variant="nil"
        onConfirm={() => {
          setPendingNil(null);
          submitBidNow(0);
        }}
        onCancel={() => {
          setPendingNil(null);
          setBidModalOpen(true);
        }}
      />

      <SpadesRoundModal
        open={roundModalOpen && !isFinished}
        summary={lastRoundSummary}
        scores={game.scores}
        players={game.players}
        onClose={handleRoundModalClose}
      />

      {/* Player profile popup — tap any seat */}
      <SpadesPlayerProfile
        open={profileOpen !== null}
        position={profileOpen}
        player={profileOpen ? game.players[profileOpen] : null}
        isYou={profileOpen === "south"}
        onClose={() => setProfileOpen(null)}
      />

      {/* Community chat drawer — opened via Menu → Messages */}
      <SpadesCommunityChat
        open={chatOpen}
        gameId={game.game_id}
        mode={mode}
        onClose={() => setChatOpen(false)}
      />
    </div>
  );
}

const FinishedFooter: React.FC<{
  winnerTeam: "team1" | "team2";
  onLobby: () => void;
  onReplay: () => void;
  busy: boolean;
}> = ({ winnerTeam, onLobby, onReplay, busy }) => {
  const youWon = winnerTeam === "team1";
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-4 p-6 rounded-2xl bg-gradient-to-br from-amber-950/40 to-[#050507] border-2 border-amber-500/40 text-center"
      data-testid="spades-finished-footer"
    >
      <Crown
        className={`w-10 h-10 mx-auto mb-2 ${youWon ? "text-amber-300" : "text-rose-300"}`}
      />
      <h2
        className="text-2xl font-black mb-1"
        style={{ fontFamily: "'Cinzel', serif" }}
      >
        {youWon ? "Your Team Wins!" : "Opponents Win"}
      </h2>
      <p className="text-purple-200/70 mb-4 text-sm">
        First team to 200 points takes the table.
      </p>
      <div className="flex gap-3 justify-center">
        <button
          onClick={onReplay}
          disabled={busy}
          className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 text-white font-bold disabled:opacity-50"
          data-testid="spades-replay-btn"
        >
          Play Again
        </button>
        <button
          onClick={onLobby}
          className="px-5 py-2.5 rounded-lg border border-amber-400/40 text-amber-200 hover:bg-amber-500/10 font-bold"
          data-testid="spades-lobby-btn"
        >
          Back to Lobby
        </button>
      </div>
    </motion.div>
  );
};
