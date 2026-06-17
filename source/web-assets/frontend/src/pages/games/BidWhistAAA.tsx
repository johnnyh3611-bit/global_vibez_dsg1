/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🃏 BID WHIST AAA — Global Vibez Bid Whist (reuses the Spades AAA prototype)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Per the user: "Vibe Whist Premium to the functionality of [Spades AAA].
 * This is the now the base or the functionality or the prototype for every
 * multiplayer card game room. We just implement the card rules."
 *
 * Accordingly: every visual + flow component is imported directly from
 * `@/components/spades/*` (table, seat, hand fan, trick pile, score
 * badge, round modal, status banner, dealing animation, game menu,
 * player profile, community chat). ONLY the rules differ here:
 *
 *   • 54-card deck (52 + 2 jokers) → 12 cards per hand + 6-card kitty
 *   • Bidding: 3-7 books + trump suit + Uptown/Downtown/No Trump
 *   • Kitty exchange phase after bid win (discard 6 cards)
 *   • First team to 7 points wins (vs Spades' 200)
 *
 * Backend endpoints (all under /api/bid-whist-practice/):
 *   POST /start           — fresh game + deal
 *   GET  /state           — current game state (used for polling bot turns)
 *   POST /bid             — {amount, bid_type, trump_suit} or {} for pass
 *   POST /kitty-exchange  — {discarded_cards, trump_suit}
 *   POST /play            — {card}
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Bot, Crown, Loader2, Wifi } from "lucide-react";
import { authFetch } from "@/utils/secureAuth";

// ALL of these come straight from the Spades prototype.
import SpadesTable from "@/components/spades/SpadesTable";
import SpadesStatusBanner from "@/components/spades/SpadesStatusBanner";
import SpadesHandFan from "@/components/spades/SpadesHandFan";
import SpadesScoreBadge from "@/components/spades/SpadesScoreBadge";
import SpadesSeat from "@/components/spades/SpadesSeat";
import SpadesTrickPile from "@/components/spades/SpadesTrickPile";
import SpadesRoundModal from "@/components/spades/SpadesRoundModal";
import SpadesDealingAnimation from "@/components/spades/SpadesDealingAnimation";
import SpadesGameMenu from "@/components/spades/SpadesGameMenu";
import CommHubButton from "@/components/common/CommHubButton";
import SpadesPlayerProfile from "@/components/spades/SpadesPlayerProfile";
import SpadesCommunityChat from "@/components/spades/SpadesCommunityChat";
import TurnIndicator, { type TurnRole } from "@/components/games/TurnIndicator";
import SpecialStatePrompt, { type SpecialStateVariant } from "@/components/games/SpecialStatePrompt";
import type {
  SpadesCard as CardData,
  SpadesPosition,
  SpadesPlayerView,
  SpadesScores,
  SpadesPhase,
  StatusMessage,
} from "@/components/spades/types";

// Bid-Whist-specific modals (new):
import BidWhistBidModal, {
  type BidWhistBid,
} from "@/components/bidwhist-aaa/BidWhistBidModal";
import BidWhistKittyModal from "@/components/bidwhist-aaa/BidWhistKittyModal";

const API = process.env.REACT_APP_BACKEND_URL;

// ─────────────────────────────────────────────────────────────────────────
// Adapter: Bid Whist backend → Spades-component types
// ─────────────────────────────────────────────────────────────────────────
// Backend returns `players_data: {north: {team, card_count, books_won}}`
// and various fields under legacy names (whose_turn, winning_bid,
// bids[].player/type) — we normalise them here so the downstream code
// can speak the Spades-prototype dialect.

interface BwRawPlayer {
  team: "team1" | "team2";
  card_count: number;
  books_won: number;
  hand?: CardData[];
}

interface BwRawBid {
  player: SpadesPosition;
  amount: number;
  type: string;
  value?: number;
}

interface BwRawTrickPlay {
  player: SpadesPosition;
  card: CardData;
}

interface BwWinningBid {
  player: SpadesPosition;
  amount: number;
  type: string;
  trump_suit?: string;
}

interface BwRawState {
  game_id: string;
  your_position: SpadesPosition;
  your_hand: CardData[];
  playable_cards: CardData[];
  led_suit: string | null;
  kitty: CardData[] | null;
  kitty_count: number;
  dealer: SpadesPosition;
  phase: "bidding" | "kitty_exchange" | "playing" | "scoring" | "finished";
  scores: SpadesScores;
  tricks_won: { team1: number; team2: number };
  players_data: Record<SpadesPosition, BwRawPlayer>;
  bids: BwRawBid[];
  winning_bid: BwWinningBid | null;
  bid_winner: SpadesPosition | null;
  trump_suit: string | null;
  bid_type: string | null;
  whose_turn: SpadesPosition;
  current_bidder?: SpadesPosition;
  current_trick: BwRawTrickPlay[];
  winner?: "team1" | "team2" | null;
  winning_score?: number;
  play_sequence?: Array<{
    player: SpadesPosition;
    card: CardData;
    trick_winner: SpadesPosition | null;
    trick_complete: boolean;
  }>;
}

// Seed names per seat so the profile modal has something friendly to
// show when users tap a bot.
const BOT_NAMES: Record<SpadesPosition, string> = {
  north: "Partner",
  south: "You",
  east:  "Rival East",
  west:  "Rival West",
};

function adaptPlayers(
  raw: Record<SpadesPosition, BwRawPlayer> | null | undefined,
  bids: BwRawBid[] | null | undefined,
  tricksWon: Record<SpadesPosition, number> | null | undefined,
  youPosition: SpadesPosition,
): Record<SpadesPosition, SpadesPlayerView> {
  const safeRaw = raw ?? ({} as Record<SpadesPosition, BwRawPlayer>);
  const bidMap: Record<string, number> = {};
  for (const b of bids ?? []) bidMap[b.player] = b.amount;
  const out: Record<SpadesPosition, SpadesPlayerView> = {} as Record<SpadesPosition, SpadesPlayerView>;
  (["north", "east", "south", "west"] as SpadesPosition[]).forEach((pos) => {
    const p = safeRaw[pos];
    const tricks = (tricksWon && tricksWon[pos] != null)
      ? tricksWon[pos]
      : (p?.books_won ?? 0);
    out[pos] = {
      hand_count: p?.card_count ?? 0,
      bid: bidMap[pos] ?? 0,
      tricks,
      team: p?.team ?? (pos === "south" || pos === "north" ? "team2" : "team1"),
      is_bot: pos !== youPosition,
      name: pos === youPosition ? "You" : BOT_NAMES[pos],
    };
  });
  return out;
}

function adaptTrickPile(raw: BwRawTrickPlay[] | null | undefined): Array<{ position: SpadesPosition; card: CardData }> {
  return (raw ?? []).map((r) => ({ position: r.player, card: r.card }));
}

function adaptPhase(bwPhase: BwRawState["phase"]): SpadesPhase {
  if (bwPhase === "kitty_exchange") return "bidding"; // still pre-play for the seat UI
  if (bwPhase === "finished") return "finished";
  if (bwPhase === "scoring") return "scoring";
  if (bwPhase === "playing") return "playing";
  return "bidding";
}

// ─────────────────────────────────────────────────────────────────────────

export default function BidWhistAAA() {
  const navigate = useNavigate();

  // Phase machine — same shape as SpadesAAA
  const [phase, setPhase] = useState<"lobby" | "game">("lobby");
  const [raw, setRaw] = useState<BwRawState | null>(null);
  const [busy, setBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState<StatusMessage | null>(null);

  // Overlay state (all mirrors SpadesAAA)
  const [profileOpen, setProfileOpen] = useState<SpadesPosition | null>(null);
  const [chatOpen, setChatOpen] = useState(false);

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
  const [kittyOpen, setKittyOpen] = useState(false);
  const [dealKey, setDealKey] = useState(0);
  /**
   * Boston / Big-Boston full-screen confirmation (LOCKED 2026-02-16).
   * Set when the player picks a 13-book bid — caller must explicitly
   * commit on the SpecialStatePrompt before we POST to the backend.
   */
  const [pendingBoston, setPendingBoston] = useState<{ bid: BidWhistBid; variant: SpecialStateVariant } | null>(null);

  /**
   * Universal 10-second Shot Clock (Universal Design Agent v2 §2 + Beta
   * Specs §4). Resets every time the active turn rotates. When the
   * countdown hits zero we auto-play the lowest valid card (or auto-pass
   * during the bid phase) so the game never stalls on an idle player.
   *
   * `turnExpiresAt` is computed client-side off the *current* turn key
   * since the practice backend doesn't ship a turn-deadline yet. The
   * ring's drift-resistance logic wraps the seat (see ShotClockRing).
   */
  const SHOT_CLOCK_MS = 10_000;
  const [turnExpiresAt, setTurnExpiresAt] = useState<number | null>(null);
  const lastTurnKeyRef = useRef<string | null>(null);

  // 15-second review window (matches SpadesAAA exactly)
  const REVIEW_SECONDS = 10;
  const [reviewActive, setReviewActive] = useState(false);
  const [reviewRemaining, setReviewRemaining] = useState(REVIEW_SECONDS);
  const reviewTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const flashStatus = useCallback(
    (text: string, tone: StatusMessage["tone"] = "cyan", ttl = 2400) => {
      setStatusMsg({ text, tone, id: Date.now() });
      window.setTimeout(() => {
        setStatusMsg((prev) => (prev && prev.text === text ? null : prev));
      }, ttl);
    },
    [],
  );

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
    setKittyOpen(false);
    setReviewActive(false);
    setReviewRemaining(REVIEW_SECONDS);

    window.setTimeout(() => {
      setDealing(false);
      setReviewActive(true);
      setReviewRemaining(REVIEW_SECONDS);

      if (reviewTimerRef.current) clearInterval(reviewTimerRef.current);
      reviewTimerRef.current = setInterval(() => {
        setReviewRemaining((r) => {
          if (r <= 1) {
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

  useEffect(() => {
    return () => {
      if (reviewTimerRef.current) clearInterval(reviewTimerRef.current);
    };
  }, []);

  // ── Start AI game ──────────────────────────────────────────────────
  const startGame = useCallback(async () => {
    setBusy(true);
    try {
      const res = await authFetch(`${API}/api/bid-whist-practice/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bet_amount: 0 }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        flashStatus(err.detail || "Failed to start", "rose");
        return;
      }
      const data = await res.json();
      setRaw(data.game);
      prevScoresRef.current = {
        team1: data.game.scores?.team1 ?? 0,
        team2: data.game.scores?.team2 ?? 0,
      };
      setPhase("game");
      setDealKey((k) => k + 1);
      flashStatus("Bid Whist · Dealing…", "cyan", 1600);
      startDealSequence();
    } catch (e) {
      flashStatus("Network error", "rose");
    } finally {
      setBusy(false);
    }
  }, [flashStatus, startDealSequence]);

  // ── Refresh state (we poll after bot bids / bot plays) ─────────────
  const refreshState = useCallback(async (): Promise<BwRawState | null> => {
    try {
      const res = await authFetch(`${API}/api/bid-whist-practice/state`);
      if (!res.ok) return null;
      const data = await res.json();
      setRaw(data.game);
      return data.game as BwRawState;
    } catch {
      return null;
    }
  }, []);

  // After placing a bid (or passing), the backend auto-runs bot bids
  // until either the auction closes OR it's the user's turn again.
  // Then we surface kitty-exchange modal if the user won.
  const afterBotAdvance = useCallback(
    async (fresh: BwRawState | null) => {
      if (!fresh) return;
      // If it's the user's turn to bid again, reopen the bid modal.
      if (fresh.phase === "bidding") {
        // Find whose turn to bid. BW rotates bid order fixed: N→E→S→W.
        const order: SpadesPosition[] = ["north", "east", "south", "west"];
        const next = order[fresh.bids.length];
        if (next === fresh.your_position) {
          setBidModalOpen(true);
        }
        return;
      }
      if (fresh.phase === "kitty_exchange") {
        if (fresh.bid_winner === fresh.your_position) {
          setKittyOpen(true);
        } else {
          flashStatus(
            `${BOT_NAMES[fresh.bid_winner ?? "north"]} won the bid`,
            "amber",
            2800,
          );
        }
        return;
      }
      if (fresh.phase === "playing") {
        flashStatus("Cards in play — good luck", "cyan", 2000);
      }
    },
    [flashStatus],
  );

  // ── Place bid ──────────────────────────────────────────────────────
  const submitBidNow = useCallback(
    async (bid: BidWhistBid) => {
      if (!raw || busy) return;
      setBusy(true);
      setBidModalOpen(false);
      try {
        const res = await authFetch(`${API}/api/bid-whist-practice/bid`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: bid.amount,
            bid_type: bid.direction,
            trump_suit: bid.trump_suit,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          flashStatus(err.detail || "Bid failed", "rose");
          setBidModalOpen(true);
          return;
        }
        flashStatus(`Bid ${bid.amount} ${bid.direction} · ${bid.trump_suit}`, "cyan");
        const fresh = await refreshState();
        await afterBotAdvance(fresh);
      } finally {
        setBusy(false);
      }
    },
    [raw, busy, flashStatus, refreshState, afterBotAdvance],
  );

  /**
   * Front-door for the bid modal. Bids of 13 (Boston / Big Boston) get
   * intercepted with the canonical full-screen SpecialStatePrompt so
   * the player has to explicitly commit before we ship the call.
   *
   *   • Boston (13 books, with kitty exchange) → 'boston'
   *   • Big Boston (13 books, no kitty look)   → 'big-boston'  (uplink == "downtown" w/ amount 13)
   */
  const placeBid = useCallback(
    async (bid: BidWhistBid) => {
      if (bid.amount === 13) {
        // Treat downtown 13 as the no-look "Big Boston". Either way we
        // surface a full-screen confirmation before committing.
        const variant: SpecialStateVariant =
          bid.direction === "downtown" ? "big-boston" : "boston";
        setBidModalOpen(false);
        setPendingBoston({ bid, variant });
        return;
      }
      await submitBidNow(bid);
    },
    [submitBidNow],
  );

  const passBid = useCallback(async () => {
    if (!raw || busy) return;
    setBusy(true);
    setBidModalOpen(false);
    try {
      const res = await authFetch(`${API}/api/bid-whist-practice/bid`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}), // empty = pass
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        flashStatus(err.detail || "Pass failed", "rose");
        return;
      }
      flashStatus("You passed", "amber");
      const fresh = await refreshState();
      await afterBotAdvance(fresh);
    } finally {
      setBusy(false);
    }
  }, [raw, busy, flashStatus, refreshState, afterBotAdvance]);

  // ── Kitty exchange ─────────────────────────────────────────────────
  const submitKitty = useCallback(
    async (sub: { discarded_cards: CardData[]; trump_suit: string }) => {
      if (!raw || busy) return;
      setBusy(true);
      try {
        const res = await authFetch(
          `${API}/api/bid-whist-practice/kitty-exchange`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(sub),
          },
        );
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          flashStatus(err.detail || "Kitty exchange failed", "rose");
          return;
        }
        setKittyOpen(false);
        flashStatus("Kitty resolved — play begins", "emerald", 2400);
        const fresh = await refreshState();
        await afterBotAdvance(fresh);
      } finally {
        setBusy(false);
      }
    },
    [raw, busy, flashStatus, refreshState, afterBotAdvance],
  );

  // ── Play card ──────────────────────────────────────────────────────
  // Stage card-by-card reveals (same pattern as Spades / Hearts / Euchre).
  // Backend resolves user + 3 bots in one HTTP call but we walk the
  // play_sequence to land each card individually with a brief pause,
  // then HOLD on the completed trick before clearing for the next one.
  const BW_CARD_STAGING_MS = 850;
  const BW_TRICK_HOLD_MS = 1200;
  const playCard = useCallback(
    async (card: CardData) => {
      if (!raw || busy) return;
      setBusy(true);
      try {
        const res = await authFetch(`${API}/api/bid-whist-practice/play`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ card }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          flashStatus(err.detail || "Play rejected", "rose");
          setBusy(false);
          return;
        }
        const data = (await res.json()).game as BwRawState;
        const seq = data.play_sequence ?? [];

        // Fast-path — server returned no sequence (defensive). Just commit.
        if (seq.length === 0) {
          setRaw(data);
          return;
        }

        // Stage from the CURRENT trick. We don't flip setRaw(data) until
        // every card has been revealed and the hold-pause expires, so the
        // server's already-cleared current_trick (after the 4th card) doesn't
        // wipe the pile prematurely.
        let stagedTrick: BwRawTrickPlay[] = [...raw.current_trick];
        const stagedPlayers = { ...raw.players_data };
        const stagedHand = raw.your_hand.filter(
          (c) => !(c.suit === card.suit && c.rank === card.rank),
        );

        for (let i = 0; i < seq.length; i++) {
          const ev = seq[i];
          const isFirst = i === 0;

          // Append the card to the visible trick pile.
          stagedTrick = [...stagedTrick, { player: ev.player, card: ev.card }];
          setRaw((prev) =>
            prev
              ? {
                  ...prev,
                  current_trick: stagedTrick,
                  your_hand: stagedHand,
                  players_data: stagedPlayers,
                }
              : prev,
          );

          // Tiny initial wait so the user's own card animates in too.
          await new Promise<void>((r) =>
            setTimeout(r, isFirst ? 200 : BW_CARD_STAGING_MS),
          );

          if (ev.trick_complete && ev.trick_winner) {
            // Bump the winner's books_won pill in real time.
            const winner = ev.trick_winner as SpadesPosition;
            if (stagedPlayers[winner]) {
              stagedPlayers[winner] = {
                ...stagedPlayers[winner],
                books_won: (stagedPlayers[winner].books_won ?? 0) + 1,
              };
            }
            const winnerName = BOT_NAMES[winner] ?? winner;
            flashStatus(`${winnerName} took the book`, "emerald", 1300);

            // Push the staged state with the FULL 4-card trick.
            setRaw((prev) =>
              prev
                ? {
                    ...prev,
                    current_trick: stagedTrick,
                    your_hand: stagedHand,
                    players_data: stagedPlayers,
                  }
                : prev,
            );

            // Hold on the completed trick so the user sees the winner.
            await new Promise<void>((r) => setTimeout(r, BW_TRICK_HOLD_MS));

            // Clear the visual pile for the next trick.
            stagedTrick = [];
            setRaw((prev) =>
              prev
                ? {
                    ...prev,
                    current_trick: [],
                    your_hand: stagedHand,
                    players_data: stagedPlayers,
                  }
                : prev,
            );
          }
        }

        // Final reconciliation — commit authoritative state. Catches
        // phase changes, score updates, next-trick first card, etc.
        const prev = prevScoresRef.current;
        const t1 = data.scores?.team1 ?? 0;
        const t2 = data.scores?.team2 ?? 0;
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
        setRaw(data);
      } finally {
        setBusy(false);
      }
    },
    [raw, busy, flashStatus],
  );

  // ─── Universal Shot Clock — reset on turn change, auto-play on expire ───
  // Computes whose turn it actually is right now (mirrors the inline logic
  // further down), then re-arms `turnExpiresAt` whenever that key changes.
  // The ring drains client-side via ShotClockRing's RAF loop.
  useEffect(() => {
    if (!raw) {
      setTurnExpiresAt(null);
      lastTurnKeyRef.current = null;
      return;
    }
    // Mirror the same `currentTurn` logic used down the page (line ~775)
    // so the ring matches whatever the UI says is the active seat.
    const activeKey: string | null =
      raw.whose_turn ?? raw.current_bidder ?? null;
    const turnKey = activeKey
      ? `${raw.phase}:${activeKey}:${raw.bids?.length ?? 0}:${raw.current_trick?.length ?? 0}`
      : null;
    if (turnKey !== lastTurnKeyRef.current) {
      lastTurnKeyRef.current = turnKey;
      setTurnExpiresAt(activeKey ? Date.now() + SHOT_CLOCK_MS : null);
    }
  }, [raw]);

  // Auto-action when the user's shot-clock hits 0. Lowest valid card,
  // or auto-pass during bidding (Universal Design Agent §2).
  const handleShotClockExpire = useCallback(() => {
    if (!raw || busy) return;
    const activeKey = raw.whose_turn ?? raw.current_bidder ?? null;
    if (activeKey !== raw.your_position) return; // never auto-act for bots

    if (raw.phase === "playing") {
      const candidates = raw.playable_cards?.length
        ? raw.playable_cards
        : raw.your_hand;
      if (!candidates || candidates.length === 0) return;
      const RANK_VALUES: Record<string, number> = {
        "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8,
        "9": 9, "10": 10, J: 11, Q: 12, K: 13, A: 14,
      };
      const lowest = [...candidates].sort(
        (a, b) => (RANK_VALUES[a.rank] ?? 99) - (RANK_VALUES[b.rank] ?? 99),
      )[0];
      flashStatus("Shot clock — auto-played", "amber", 1500);
      void playCard(lowest);
    } else if (raw.phase === "bidding") {
      flashStatus("Shot clock — auto-passed", "amber", 1500);
      void passBid();
    }
  }, [raw, busy, flashStatus, playCard, passBid]);

  const handleRoundModalClose = () => {
    setRoundModalOpen(false);
    if (raw?.phase === "bidding") {
      startDealSequence();
    }
  };

  const backToLobby = () => {
    if (reviewTimerRef.current) {
      clearInterval(reviewTimerRef.current);
      reviewTimerRef.current = null;
    }
    setRaw(null);
    setRoundModalOpen(false);
    setBidModalOpen(false);
    setKittyOpen(false);
    setDealing(false);
    setReviewActive(false);
    setLastRoundSummary(null);
    prevScoresRef.current = null;
    setPhase("lobby");
  };

  const isFinished = raw?.phase === "finished";

  // ── Lobby (minimal: single Start Game button) ──────────────────────
  if (phase === "lobby") {
    return (
      <div
        className="min-h-screen bg-[#050507] text-white relative overflow-x-hidden"
        data-testid="bidwhist-aaa-lobby"
      >
        <div
          className="absolute inset-0 pointer-events-none opacity-30"
          style={{
            backgroundImage:
              "linear-gradient(rgba(34,211,238,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.08) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 w-[60vw] h-[60vw] max-w-[700px] max-h-[700px] rounded-full bg-amber-500/15 blur-[120px]" />
        </div>

        <div className="relative z-10 max-w-3xl mx-auto px-4 py-6">
          <button
            onClick={() => navigate("/games")}
            className="flex items-center gap-2 text-amber-300/70 hover:text-white transition mb-4 text-sm font-bold"
            data-testid="bidwhist-aaa-lobby-back"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Games
          </button>

          <div className="flex items-center gap-3 mb-8">
            <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-700 shadow-[0_0_24px_rgba(251,191,36,0.45)]">
              <Crown className="w-8 h-8 text-white" />
            </div>
            <div>
              <p
                className="text-xs font-mono uppercase tracking-[0.3em] text-amber-400/80"
                style={{ fontFamily: "'Cinzel', serif" }}
              >
                Card Room · Bid Whist
              </p>
              <h1
                className="text-3xl md:text-4xl font-black leading-none"
                style={{ fontFamily: "'Cinzel', serif" }}
              >
                Bid Whist AAA
              </h1>
            </div>
          </div>

          <div className="mb-6 p-4 rounded-2xl bg-white/[0.03] border border-amber-400/20 text-sm text-amber-100/80 leading-relaxed">
            <p className="text-xs uppercase tracking-[0.3em] text-amber-300 font-bold mb-2" style={{ fontFamily: "'Cinzel', serif" }}>
              House Rules
            </p>
            • 54-card deck (52 + 2 jokers) · 12 cards per hand + 6-card kitty · partners N+S vs E+W<br />
            • Bids: <strong>3 – 7 books</strong> · choose trump suit + Uptown (high A-2) / Downtown (low A-K) / No Trump<br />
            • Winning bidder picks up the kitty, discards 6, then leads<br />
            • First team to <strong>7 points</strong> wins the table · missed contract = points for the other team
          </div>

          <button
            onClick={startGame}
            disabled={busy}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-500 hover:from-amber-400 hover:to-yellow-400 text-[#3a2500] font-black uppercase tracking-widest text-base shadow-[0_0_30px_rgba(251,191,36,0.45)] disabled:opacity-50"
            style={{ fontFamily: "'Cinzel', serif" }}
            data-testid="bidwhist-aaa-lobby-start-btn"
          >
            {busy ? "Starting…" : "Start AI Match"}
          </button>
        </div>
      </div>
    );
  }

  if (!raw) {
    return (
      <div className="min-h-screen bg-[#050507] flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-amber-400 animate-spin" />
      </div>
    );
  }

  // Adapted views
  const youPosition = raw.your_position;
  const currentTurn = raw.whose_turn ?? raw.current_bidder ?? raw.your_position;
  const players = adaptPlayers(
    raw.players_data,
    raw.bids,
    raw.player_tricks as Record<SpadesPosition, number> | undefined,
    youPosition,
  );
  const trickPile = adaptTrickPile(raw.current_trick);
  const scores = raw.scores;
  const uiPhase = adaptPhase(raw.phase);
  const tricksPlayed = (raw.tricks_won?.team1 ?? 0) + (raw.tricks_won?.team2 ?? 0);
  const currentHighBid = raw.winning_bid
    ? { amount: raw.winning_bid.amount, bidder: raw.winning_bid.player }
    : null;

  // ─── Auto-bid-resort (Beta Specs §4): once the winning bid is set,
  // re-sort the player's hand by high (uptown) or low (downtown) so they
  // see the most valuable plays first without manually fanning. Trump
  // suit also bubbles to the front so the player can lead it on demand.
  const RANK_VAL: Record<string, number> = {
    "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8,
    "9": 9, "10": 10, J: 11, Q: 12, K: 13, A: 14,
  };
  const sortedHand = (() => {
    const hand = raw.your_hand ?? [];
    if (!raw.winning_bid) return hand;
    const direction = raw.winning_bid.type ?? "uptown";
    const trump = raw.trump_suit;
    const highFirst = direction !== "downtown"; // uptown / no_trump => high
    return [...hand].sort((a, b) => {
      // Trump first
      if (trump) {
        const aT = a.suit === trump;
        const bT = b.suit === trump;
        if (aT !== bT) return aT ? -1 : 1;
      }
      // Then by rank in the bid direction
      const av = RANK_VAL[a.rank] ?? 0;
      const bv = RANK_VAL[b.rank] ?? 0;
      return highFirst ? bv - av : av - bv;
    });
  })();

  return (
    <div
      className="min-h-screen bg-gradient-to-b from-[#05070d] via-[#081021] to-[#050507] text-white relative overflow-x-hidden"
      data-testid="bidwhist-aaa"
    >
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.12]"
        style={{
          backgroundImage:
            "linear-gradient(#333 1px, transparent 1px), linear-gradient(90deg, #333 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Marker so the floating CommHubDropdown hides — its place is
            inside this in-game menu bar (founder directive May 2026). */}
        <div data-testid="room-menu-bar" className="hidden" aria-hidden="true" />

        {/* Top bar — matches SpadesAAA exactly */}
        <div className="flex flex-wrap items-start justify-between px-2 sm:px-3 md:px-5 pt-2 sm:pt-3 md:pt-4 gap-2">
          <div className="flex flex-col items-start gap-2">
            <button
              onClick={backToLobby}
              className="flex items-center gap-1.5 text-amber-300/70 hover:text-white transition text-xs md:text-sm font-bold"
              data-testid="bidwhist-aaa-back-btn"
            >
              <ArrowLeft className="w-4 h-4" /> Lobby
            </button>
            <div className="flex items-center gap-2">
              <SpadesGameMenu
                onExit={backToLobby}
                onOpenMessages={() => setChatOpen(true)}
              />
              <CommHubButton compact />
            </div>
          </div>

          <div className="flex flex-col items-center gap-1.5 order-3 w-full sm:order-none sm:w-auto">
            <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
              <div className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-400/40 text-[9px] md:text-[10px] uppercase tracking-[0.3em] text-amber-300 font-bold">
                Bid Whist
              </div>
              <div className="px-2 py-0.5 rounded-full bg-fuchsia-500/15 border border-fuchsia-400/40 text-[9px] md:text-[10px] uppercase tracking-[0.3em] text-fuchsia-300 font-bold">
                <span className="inline-flex items-center gap-1">
                  <Bot className="w-2.5 h-2.5" /> AI
                </span>
              </div>
              {raw.trump_suit ? (
                <div className="px-2 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-400/40 text-[9px] md:text-[10px] uppercase tracking-[0.3em] text-cyan-300 font-bold">
                  Trump · {raw.trump_suit}
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
        {currentTurn && (() => {
          const partnerOf: Record<string, string> = { north: 'south', south: 'north', east: 'west', west: 'east' };
          const role: TurnRole = currentTurn === youPosition ? 'me'
            : currentTurn === partnerOf[youPosition] ? 'partner' : 'opponent';
          // Show the 10s shot-clock countdown on the user's own turn so
          // they can see it ticking even though they have no seat badge.
          return (
            <TurnIndicator
              role={role}
              name={role === 'me' ? undefined : players[currentTurn]?.name}
              expiresAt={role === 'me' ? turnExpiresAt : null}
              onExpire={role === 'me' ? handleShotClockExpire : undefined}
            />
          );
        })()}

        {/* Arena — identical to SpadesAAA */}
        <div className="flex items-center justify-center py-2 md:py-3 relative">
          <div className="relative">
            <SpadesTable brandSubLabel="BID WHIST" variant="cobalt">
              <SpadesSeat
                position="north"
                player={players.north}
                isTurn={currentTurn === "north"}
                isYou={youPosition === "north"}
                isDealer={raw.dealer === "north"}
                onClick={() => setProfileOpen("north")}
                shotClockExpiresAt={currentTurn === "north" ? turnExpiresAt : null}
                onShotClockExpire={handleShotClockExpire}
              />
              <SpadesSeat
                position="east"
                player={players.east}
                isTurn={currentTurn === "east"}
                isYou={youPosition === "east"}
                isDealer={raw.dealer === "east"}
                onClick={() => setProfileOpen("east")}
                shotClockExpiresAt={currentTurn === "east" ? turnExpiresAt : null}
                onShotClockExpire={handleShotClockExpire}
              />
              <SpadesSeat
                position="west"
                player={players.west}
                isTurn={currentTurn === "west"}
                isYou={youPosition === "west"}
                isDealer={raw.dealer === "west"}
                onClick={() => setProfileOpen("west")}
                shotClockExpiresAt={currentTurn === "west" ? turnExpiresAt : null}
                onShotClockExpire={handleShotClockExpire}
              />
              <SpadesTrickPile trick={trickPile} />
            </SpadesTable>
            <SpadesDealingAnimation active={dealing} />
          </div>
        </div>

        {/* Hand fan / review window */}
        <div className="px-3 md:px-4 -mt-4 md:-mt-6 pb-3 md:pb-4 relative z-20">
          {uiPhase === "playing" ? (
            <SpadesHandFan
              key={dealKey}
              hand={sortedHand}
              validPlays={raw.playable_cards ?? []}
              isYourTurn={currentTurn === youPosition}
              onPlay={playCard}
              busy={busy}
            />
          ) : uiPhase === "bidding" && reviewActive ? (
            <>
              <div
                className="absolute left-1/2 -translate-x-1/2 -top-8 md:-top-10 flex items-center gap-2 z-30"
                data-testid="bidwhist-aaa-review-banner"
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
                    data-testid="bidwhist-aaa-review-countdown"
                  >
                    {reviewRemaining}s
                  </span>
                </div>
                <button
                  onClick={endReviewAndShowBid}
                  className="px-2.5 py-1 rounded-full bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-[#3a2500] font-black text-[10px] uppercase tracking-widest transition shadow-[0_0_16px_rgba(251,191,36,0.35)]"
                  style={{ fontFamily: "'Cinzel', serif" }}
                  data-testid="bidwhist-aaa-review-bid-now-btn"
                >
                  Bid Now
                </button>
              </div>
              <SpadesHandFan
                key={`review-${dealKey}`}
                hand={raw.your_hand}
                validPlays={[]}
                isYourTurn={false}
                onPlay={() => undefined}
                busy={true}
                hideTurnIndicator={true}
              />
            </>
          ) : uiPhase === "bidding" && !dealing && !bidModalOpen && !kittyOpen ? (
            <div className="text-center text-amber-300/60 text-xs uppercase tracking-[0.3em] font-bold">
              Waiting for bids…
            </div>
          ) : null}

          {isFinished ? (
            <FinishedFooter
              winnerTeam={(scores.team1 ?? 0) >= (scores.team2 ?? 0) ? "team1" : "team2"}
              onLobby={backToLobby}
              onReplay={startGame}
              busy={busy}
            />
          ) : null}
        </div>
      </div>

      {/* Bid modal */}
      <BidWhistBidModal
        open={bidModalOpen && uiPhase === "bidding" && !isFinished}
        currentHighBid={currentHighBid}
        onBid={placeBid}
        onPass={passBid}
        busy={busy}
      />

      {/* Boston / Big-Boston full-screen confirmation (LOCKED 2026-02-16).
           Wraps the placeBid callback so a 13-book call must be explicitly
           confirmed before we POST it. Cancel reopens the bid modal. */}
      <SpecialStatePrompt
        open={!!pendingBoston}
        variant={pendingBoston?.variant ?? "boston"}
        onConfirm={() => {
          const captured = pendingBoston;
          setPendingBoston(null);
          if (captured) submitBidNow(captured.bid);
        }}
        onCancel={() => {
          setPendingBoston(null);
          setBidModalOpen(true);
        }}
      />

      {/* Kitty exchange modal */}
      <BidWhistKittyModal
        open={kittyOpen && raw.phase === "kitty_exchange"}
        hand={raw.your_hand}
        initialTrump={raw.trump_suit ?? "spades"}
        winningBidLabel={
          raw.winning_bid
            ? `${raw.winning_bid.amount} ${raw.winning_bid.type} · ${raw.winning_bid.trump_suit ?? raw.trump_suit ?? ""}`
            : undefined
        }
        onSubmit={submitKitty}
        busy={busy}
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
        gameId={raw.game_id}
        mode="ai"
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
  const youWon = winnerTeam === "team2"; // BW: user is team2 (south+north)
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-4 p-6 rounded-2xl bg-gradient-to-br from-amber-950/40 to-[#050507] border-2 border-amber-500/40 text-center"
      data-testid="bidwhist-aaa-finished-footer"
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
        First team to 7 points takes the table.
      </p>
      <div className="flex gap-3 justify-center">
        <button
          onClick={onReplay}
          disabled={busy}
          className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 text-white font-bold disabled:opacity-50"
          data-testid="bidwhist-aaa-replay-btn"
        >
          Play Again
        </button>
        <button
          onClick={onLobby}
          className="px-5 py-2.5 rounded-lg border border-amber-400/40 text-amber-200 hover:bg-amber-500/10 font-bold"
          data-testid="bidwhist-aaa-lobby-btn"
        >
          Back to Lobby
        </button>
      </div>
    </motion.div>
  );
};
