/**
 * Pinochle AAA — Universal prototype, "pearl" variant. 4P partnership.
 *
 * Backend: /api/pinochle-practice/{start, bid, pass-bid, name-trump,
 * play, new-hand}. The engine drives 4 phases:
 *   • bidding         — auction starting at 250, increments of 10
 *   • naming_trump    — high bidder picks trump
 *   • playing         — 12 tricks. Must follow + must-beat + trump-if-can
 *   • scoring         — hand done; show summary; click "Next Hand"
 *
 * UI mirrors EuchreAAA structure but with Pinochle's auction panel
 * (raise / pass) instead of Euchre's order-up / name-trump duality.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Bot, Loader2, Sparkles, Diamond } from "lucide-react";
import { authFetch } from "@/utils/secureAuth";
import CardMpLobbyModal from "@/components/card_multiplayer/CardMpLobbyModal";

import SpadesTable from "@/components/spades/SpadesTable";
import SpadesStatusBanner from "@/components/spades/SpadesStatusBanner";
import SpadesHandFan from "@/components/spades/SpadesHandFan";
import SpadesScoreBadge from "@/components/spades/SpadesScoreBadge";
import SpadesSeat from "@/components/spades/SpadesSeat";
import SpadesTrickPile from "@/components/spades/SpadesTrickPile";
import SpadesDealingAnimation from "@/components/spades/SpadesDealingAnimation";
import SpadesGameMenu from "@/components/spades/SpadesGameMenu";
import CommHubButton from "@/components/common/CommHubButton";
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
const SUITS = ["clubs", "diamonds", "spades", "hearts"] as const;
type Suit = typeof SUITS[number];
const SUIT_GLYPH: Record<string, string> = {
  spades: "♠", clubs: "♣", hearts: "♥", diamonds: "♦",
};
const SUIT_COLOR: Record<string, string> = {
  spades: "text-slate-100", clubs: "text-slate-100", hearts: "text-rose-300", diamonds: "text-rose-300",
};

interface PinochlePlayer { card_count: number; tricks_won: number; team: "team1" | "team2"; meld: number; }
interface PinochleTrickPlay { player: SpadesPosition; card: CardData; }
interface MeldEntry { name: string; points: number; }
interface PinochleRaw {
  user_position: SpadesPosition;
  phase: "bidding" | "naming_trump" | "playing" | "scoring" | "finished";
  turn: SpadesPosition;
  bid_turn: SpadesPosition;
  high_bid: number;
  high_bidder: SpadesPosition | null;
  passed: SpadesPosition[];
  min_next_bid: number | null;
  dealer: SpadesPosition;
  trump: Suit | null;
  calling_team: "team1" | "team2" | null;
  current_trick: PinochleTrickPlay[];
  led_suit: string | null;
  your_hand: CardData[];
  playable_cards: CardData[];
  your_meld: { total: number; melds: MeldEntry[] } | null;
  scores: { team1: number; team2: number };
  team_meld: { team1: number; team2: number };
  team_trick: { team1: number; team2: number };
  tricks_played: number;
  players_data: Record<SpadesPosition, PinochlePlayer>;
  match_winner: "team1" | "team2" | null;
  hand_summary: {
    bidder_team: string;
    contract: number;
    bidder_total: number;
    defender_total: number;
    went_set: boolean;
    delta: { team1: number; team2: number };
  } | null;
  last_action: { player?: SpadesPosition; action?: string; amount?: number; trump?: string } | null;
  play_sequence?: Array<{
    player: SpadesPosition;
    card?: CardData;
    action?: string;
    amount?: number;
    trump?: string;
    trick_complete?: boolean;
    trick_winner?: SpadesPosition;
  }>;
}

const BOT_NAMES: Record<SpadesPosition, string> = {
  north: "Partner", south: "You", east: "Rival East", west: "Rival West",
};

function adapt(raw: PinochleRaw): { players: Record<SpadesPosition, SpadesPlayerView>; scores: SpadesScores } {
  const safe = raw.players_data ?? ({} as Record<SpadesPosition, PinochlePlayer>);
  const players: Record<SpadesPosition, SpadesPlayerView> = {} as Record<SpadesPosition, SpadesPlayerView>;
  (["north", "east", "south", "west"] as SpadesPosition[]).forEach((pos) => {
    const p = safe[pos];
    players[pos] = {
      hand_count: p?.card_count ?? 0,
      bid: 12,                                  // pill: tricks-won/12
      tricks: p?.tricks_won ?? 0,
      team: p?.team ?? (pos === "north" || pos === "south" ? "team1" : "team2"),
      is_bot: pos !== raw.user_position,
      name: pos === raw.user_position ? "You" : BOT_NAMES[pos],
    };
  });
  return {
    players,
    scores: { team1: { points: raw.scores?.team1 ?? 0, bags: 0 }, team2: { points: raw.scores?.team2 ?? 0, bags: 0 } },
  };
}

export default function PinochleAAA() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<"lobby" | "game">("lobby");
  const [raw, setRaw] = useState<PinochleRaw | null>(null);
  const [busy, setBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState<StatusMessage | null>(null);
  const [profileOpen, setProfileOpen] = useState<SpadesPosition | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [dealing, setDealing] = useState(false);
  const [showMpLobby, setShowMpLobby] = useState(false);
  const [mode, setMode] = useState<"single" | "double">("single");

  // Universal 10s Shot Clock (Beta Specs §4 / Universal Design Agent §2).
  const SHOT_CLOCK_MS = 10_000;
  const [turnExpiresAt, setTurnExpiresAt] = useState<number | null>(null);
  const lastTurnKeyRef = useRef<string | null>(null);

  const flash = useCallback((text: string, tone: StatusMessage["tone"] = "indigo", ttl = 1800) => {
    setStatusMsg({ text, tone, id: Date.now() });
    window.setTimeout(() => setStatusMsg((p) => (p && p.text === text ? null : p)), ttl);
  }, []);

  const dealAndShow = useCallback(() => {
    setDealing(true);
    window.setTimeout(() => setDealing(false), 2200);
  }, []);

  const startMatch = useCallback(async () => {
    setBusy(true);
    try {
      const res = await authFetch(`${API}/api/pinochle-practice/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      const data = await res.json();
      if (!res.ok) { flash(data.detail || "Failed to start", "rose"); return; }
      setRaw(data.game as PinochleRaw);
      setPhase("game");
      flash(mode === "double" ? "80-card · Auction begins at 500" : "48-card · Auction begins at 250", "indigo");
      dealAndShow();
    } finally { setBusy(false); }
  }, [flash, dealAndShow, mode]);

  const post = useCallback(async (path: string, body: Record<string, unknown> = {}) => {
    if (!raw || busy) return;
    setBusy(true);
    try {
      const res = await authFetch(`${API}/api/pinochle-practice/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { flash(data.detail || "Action failed", "rose"); return null; }
      return data.game as PinochleRaw;
    } finally { setBusy(false); }
  }, [raw, busy, flash]);

  const placeBid = useCallback(async (amount: number) => {
    const next = await post("bid", { amount });
    if (next) { setRaw(next); flash(`Bid · ${amount}`, "indigo"); }
  }, [post, flash]);

  const passBid = useCallback(async () => {
    const next = await post("pass-bid");
    if (next) setRaw(next);
  }, [post]);

  const namedTrump = useCallback(async (suit: Suit) => {
    const next = await post("name-trump", { suit });
    if (next) { setRaw(next); flash(`Trump · ${suit.toUpperCase()}`, "indigo", 1800); }
  }, [post, flash]);

  const playCard = useCallback(async (card: CardData) => {
    if (!raw || busy) return;
    setBusy(true);
    try {
      const res = await authFetch(`${API}/api/pinochle-practice/play`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ card }),
      });
      const data = await res.json();
      if (!res.ok) { flash(data.detail || "Illegal play", "rose"); return; }
      const next = data.game as PinochleRaw;
      const seq = next.play_sequence ?? [];
      if (seq.length === 0) { setRaw(next); return; }
      // Stage trick pile growth one card at a time (Spades AAA pattern).
      let stagedTrick: PinochleTrickPlay[] = [...raw.current_trick, { player: raw.user_position, card }];
      const stagedPlayers = { ...raw.players_data };
      for (const ev of seq) {
        if (!ev.card) continue;
        if (ev.player !== raw.user_position) {
          stagedTrick = [...stagedTrick, { player: ev.player, card: ev.card }];
          setRaw((prev) => prev ? { ...prev, current_trick: stagedTrick, players_data: stagedPlayers } : prev);
        }
        await new Promise<void>((r) => setTimeout(r, 850));
        if (ev.trick_complete && ev.trick_winner) {
          flash(`${BOT_NAMES[ev.trick_winner] ?? ev.trick_winner} took the trick`, "indigo", 1100);
          await new Promise<void>((r) => setTimeout(r, 1000));
          stagedTrick = [];
          setRaw((prev) => prev ? { ...prev, current_trick: stagedTrick } : prev);
        }
      }
      setRaw(next);
    } finally { setBusy(false); }
  }, [raw, busy, flash]);

  // ── Universal 10s Shot Clock — reset on every turn change ─────────────
  useEffect(() => {
    if (!raw) {
      setTurnExpiresAt(null);
      lastTurnKeyRef.current = null;
      return;
    }
    // Pinochle has TWO turn fields: bid_turn (during bidding/naming_trump)
    // and turn (during play). Use whichever is active for this phase.
    const activeKey =
      raw.phase === "bidding" || raw.phase === "naming_trump"
        ? raw.bid_turn
        : raw.turn;
    const turnKey = activeKey
      ? `${raw.phase}:${activeKey}:${raw.current_trick?.length ?? 0}`
      : null;
    if (turnKey !== lastTurnKeyRef.current) {
      lastTurnKeyRef.current = turnKey;
      setTurnExpiresAt(activeKey ? Date.now() + SHOT_CLOCK_MS : null);
    }
  }, [raw]);

  // Auto-action on shot-clock expire — only fires for the human seat.
  // Bidding → auto-pass; naming_trump → pick the most-held suit;
  // playing → lowest valid card. Bots are paced server-side already.
  const handleShotClockExpire = useCallback(() => {
    if (!raw || busy) return;
    if (raw.phase === "playing") {
      if (raw.turn !== raw.user_position) return;
      const candidates = raw.playable_cards?.length
        ? raw.playable_cards
        : raw.your_hand;
      if (!candidates || candidates.length === 0) return;
      // Pinochle ranking: A > 10 > K > Q > J > 9
      const RANK_VALUES: Record<string, number> = { "9": 1, J: 2, Q: 3, K: 4, "10": 5, A: 6 };
      const lowest = [...candidates].sort(
        (a, b) => (RANK_VALUES[a.rank] ?? 99) - (RANK_VALUES[b.rank] ?? 99),
      )[0];
      flash("Shot clock — auto-played", "indigo", 1500);
      void playCard(lowest);
    } else if (raw.phase === "bidding") {
      if (raw.bid_turn !== raw.user_position) return;
      flash("Shot clock — auto-passed", "indigo", 1500);
      void passBid();
    } else if (raw.phase === "naming_trump") {
      if (raw.bid_turn !== raw.user_position) return;
      // Pick the suit with the most cards in hand.
      const counts: Record<string, number> = {};
      for (const c of raw.your_hand ?? []) {
        counts[c.suit] = (counts[c.suit] ?? 0) + 1;
      }
      const best = (Object.entries(counts) as [Suit, number][])
        .sort(([, a], [, b]) => b - a)[0]?.[0];
      if (best) {
        flash("Shot clock — auto-named trump", "indigo", 1500);
        void namedTrump(best);
      }
    }
  }, [raw, busy, flash, playCard, passBid, namedTrump]);

  const newHand = useCallback(async () => {
    const next = await post("new-hand");
    if (next) {
      setRaw(next);
      flash("New hand", "indigo");
      dealAndShow();
    }
  }, [post, flash, dealAndShow]);

  const backToLobby = () => { setRaw(null); setPhase("lobby"); };

  // ─── LOBBY ────────────────────────────────────────────────────────
  if (phase === "lobby") {
    return (
      <>
      <div className="min-h-screen bg-[#080a18] text-white relative overflow-x-hidden" data-testid="pinochle-aaa-lobby">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 w-[60vw] h-[60vw] max-w-[700px] max-h-[700px] rounded-full bg-cyan-500/15 blur-[120px]" />
          <div className="absolute right-10 bottom-10 w-[40vw] h-[40vw] max-w-[500px] max-h-[500px] rounded-full bg-fuchsia-500/10 blur-[120px]" />
        </div>
        <div className="relative z-10 max-w-3xl mx-auto px-4 py-6">
          <button onClick={() => navigate("/games")} className="flex items-center gap-2 text-cyan-200/70 hover:text-white transition mb-4 text-sm font-bold" data-testid="pinochle-aaa-lobby-back">
            <ArrowLeft className="w-4 h-4" /> Back to Games
          </button>
          <div className="flex items-center gap-3 mb-8">
            <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-300 via-slate-200 to-cyan-500 shadow-[0_0_24px_rgba(34,211,238,0.45)]">
              <Diamond className="w-7 h-7 text-slate-900" />
            </div>
            <div>
              <p className="text-xs font-mono uppercase tracking-[0.3em] text-cyan-200/80" style={{ fontFamily: "'Cinzel', serif" }}>
                Pearl Parlour · Pinochle
              </p>
              <h1 className="text-3xl md:text-4xl font-black leading-none" style={{ fontFamily: "'Cinzel', serif" }}>
                Pinochle AAA
              </h1>
            </div>
          </div>
          <div className="mb-6 p-4 rounded-2xl bg-white/[0.03] border border-cyan-400/20 text-sm text-cyan-100/80 leading-relaxed">
            <p className="text-xs uppercase tracking-[0.3em] text-cyan-300 font-bold mb-2" style={{ fontFamily: "'Cinzel', serif" }}>
              House Rules — 48-card Single-Deck Partnership
            </p>
            • Partners N+S vs E+W · 12 cards each · A-10-K-Q-J-9 (10 ranks above K!)<br />
            • <strong>Auction</strong> · starts at 250, raise in tens, last bidder names trump<br />
            • <strong>Melds</strong> · Run (150) · Royal Marriage (40) · Aces (100) · Pinochle (40) · Dix (10)<br />
            • <strong>Tricks</strong> · A=11 · 10=10 · K=4 · Q=3 · J=2 · 9=0 · Last trick +10<br />
            • Bidder team must hit <strong className="text-cyan-200">contract</strong> or go SET<br />
            • First team to <strong className="text-cyan-200">1500</strong> wins
          </div>
          <div className="mb-6 p-4 rounded-2xl bg-white/[0.03] border border-cyan-400/20" data-testid="pinochle-mode-toggle">
            <p className="text-[10px] uppercase tracking-[0.3em] text-cyan-300 font-bold mb-3" style={{ fontFamily: "'Cinzel', serif" }}>
              Choose your variant
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setMode("single")}
                data-testid="pinochle-mode-single"
                className={`p-3 rounded-xl text-left transition ${
                  mode === "single"
                    ? "bg-cyan-500 text-slate-950 shadow-[0_0_18px_rgba(34,211,238,0.55)]"
                    : "bg-white/5 text-cyan-100 hover:bg-white/10"
                }`}
              >
                <p className="text-[10px] uppercase tracking-widest font-black opacity-70">Single Deck</p>
                <p className="text-base font-black" style={{ fontFamily: "'Cinzel', serif" }}>48 cards · 1500</p>
                <p className="text-[10px] opacity-70 mt-0.5">12 per hand · classic partnership</p>
              </button>
              <button
                onClick={() => setMode("double")}
                data-testid="pinochle-mode-double"
                className={`p-3 rounded-xl text-left transition ${
                  mode === "double"
                    ? "bg-fuchsia-500 text-white shadow-[0_0_18px_rgba(217,70,239,0.55)]"
                    : "bg-white/5 text-cyan-100 hover:bg-white/10"
                }`}
              >
                <p className="text-[10px] uppercase tracking-widest font-black opacity-70">Double Deck</p>
                <p className="text-base font-black" style={{ fontFamily: "'Cinzel', serif" }}>80 cards · 5000</p>
                <p className="text-[10px] opacity-70 mt-0.5">20 per hand · no 9s · tournament</p>
              </button>
            </div>
          </div>
          <button
            onClick={startMatch}
            disabled={busy}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-cyan-400 via-slate-200 to-cyan-500 hover:from-cyan-300 hover:to-cyan-400 text-slate-900 font-black uppercase tracking-widest text-base shadow-[0_0_30px_rgba(34,211,238,0.55)] disabled:opacity-50"
            style={{ fontFamily: "'Cinzel', serif" }}
            data-testid="pinochle-aaa-lobby-start-btn"
          >
            {busy ? "Dealing…" : "Open The Pearl Parlour"}
          </button>
          <button
            onClick={() => setShowMpLobby(true)}
            className="w-full mt-3 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-black uppercase tracking-widest text-sm shadow-[0_0_30px_rgba(34,211,238,0.35)]"
            style={{ fontFamily: "'Cinzel', serif" }}
            data-testid="pinochle-aaa-mp-btn"
          >
            🎮 Play Live Multiplayer
          </button>
        </div>
      </div>
      <CardMpLobbyModal
        open={showMpLobby}
        game="pinochle"
        onClose={() => setShowMpLobby(false)}
        playRoute="/card-mp/pinochle"
      />
      </>
    );
  }

  if (!raw) {
    return <div className="min-h-screen bg-[#080a18] flex items-center justify-center"><Loader2 className="w-12 h-12 text-cyan-400 animate-spin" /></div>;
  }

  const { players, scores } = adapt(raw);
  const youPosition = raw.user_position;
  const isYourBidTurn = raw.phase === "bidding" && raw.bid_turn === youPosition;
  const isYourTrumpTurn = raw.phase === "naming_trump" && raw.high_bidder === youPosition;
  const isYourPlayTurn = raw.phase === "playing" && raw.turn === youPosition;
  const finished = raw.phase === "finished";
  const scoring = raw.phase === "scoring";

  // Auto-advance to the next hand after 5s of scoring review — user:
  // "should be a pop-up that lasts about 5 seconds to show everything
  // so people could read it. Then they go on to the next round."
  useEffect(() => {
    if (!scoring || busy) return;
    const t = window.setTimeout(() => { newHand(); }, 5000);
    return () => window.clearTimeout(t);
  }, [scoring, busy, newHand]);

  // Pinochle bid options — show next 6 step-bids + "pass".
  const bidOptions: number[] = [];
  if (raw.min_next_bid) {
    for (let i = 0; i < 6; i++) bidOptions.push(raw.min_next_bid + i * 10);
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a1428] via-[#080a18] to-[#04060e] text-white relative overflow-x-hidden" data-testid="pinochle-aaa">
      <div className="relative z-10 flex flex-col min-h-screen">
        <div className="flex flex-wrap items-start justify-between px-2 sm:px-3 md:px-5 pt-2 sm:pt-3 md:pt-4 gap-2">
          <div className="flex flex-col items-start gap-2">
            <button onClick={backToLobby} className="flex items-center gap-1.5 text-cyan-200/70 hover:text-white transition text-xs md:text-sm font-bold" data-testid="pinochle-aaa-back-btn">
              <ArrowLeft className="w-4 h-4" /> Lobby
            </button>
            <SpadesGameMenu onExit={backToLobby} onOpenMessages={() => setChatOpen(true)} />
            <CommHubButton compact />
            <div data-testid="room-menu-bar" className="hidden" aria-hidden="true" />
          </div>
          <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 order-3 w-full sm:order-none sm:w-auto">
            <div className="px-2 py-0.5 rounded-full bg-cyan-700/20 border border-cyan-500/40 text-[9px] md:text-[10px] uppercase tracking-[0.3em] text-cyan-200 font-bold">Pinochle</div>
            <div className="px-2 py-0.5 rounded-full bg-fuchsia-500/15 border border-fuchsia-400/40 text-[9px] md:text-[10px] uppercase tracking-[0.3em] text-fuchsia-300 font-bold">
              <span className="inline-flex items-center gap-1"><Bot className="w-2.5 h-2.5" /> AI</span>
            </div>
            {raw.trump ? (
              <div className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/50 text-[9px] md:text-[10px] uppercase tracking-[0.3em] text-emerald-200 font-bold flex items-center gap-1">
                Trump · <span>{SUIT_GLYPH[raw.trump]}</span> {raw.trump}
              </div>
            ) : null}
            {raw.high_bid > 0 ? (
              <div className="px-2 py-0.5 rounded-full bg-slate-800 border border-cyan-500/40 text-[9px] md:text-[10px] uppercase tracking-[0.3em] text-cyan-200 font-bold tabular-nums">
                Contract · {raw.high_bid} {raw.high_bidder ? "· " + (raw.high_bidder === youPosition ? "you" : raw.high_bidder) : ""}
              </div>
            ) : null}
            <div className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-600 text-[9px] md:text-[10px] uppercase tracking-[0.3em] text-cyan-100 font-bold tabular-nums">
              → 1500
            </div>
          </div>
          <SpadesScoreBadge scores={scores} players={players} phase="playing" tricksPlayed={raw.tricks_played} />
        </div>

        <SpadesStatusBanner message={statusMsg} />

        <div className="flex items-center justify-center py-2 md:py-3 relative">
          <div className="relative">
            <SpadesTable brandSubLabel="PINOCHLE" variant="pearl" centreGlyph="P">
              <SpadesSeat position="north" player={players.north} isTurn={raw.turn === "north" || raw.bid_turn === "north"} isYou={youPosition === "north"} isDealer={raw.dealer === "north"} onClick={() => setProfileOpen("north")} shotClockExpiresAt={(raw.turn === "north" || raw.bid_turn === "north") ? turnExpiresAt : null} onShotClockExpire={handleShotClockExpire} />
              <SpadesSeat position="east"  player={players.east}  isTurn={raw.turn === "east"  || raw.bid_turn === "east"}  isYou={youPosition === "east"}  isDealer={raw.dealer === "east"}  onClick={() => setProfileOpen("east")}  shotClockExpiresAt={(raw.turn === "east"  || raw.bid_turn === "east")  ? turnExpiresAt : null} onShotClockExpire={handleShotClockExpire} />
              <SpadesSeat position="west"  player={players.west}  isTurn={raw.turn === "west"  || raw.bid_turn === "west"}  isYou={youPosition === "west"}  isDealer={raw.dealer === "west"}  onClick={() => setProfileOpen("west")}  shotClockExpiresAt={(raw.turn === "west"  || raw.bid_turn === "west")  ? turnExpiresAt : null} onShotClockExpire={handleShotClockExpire} />
              <SpadesTrickPile trick={raw.current_trick} />
            </SpadesTable>
            <SpadesDealingAnimation active={dealing} />
          </div>
        </div>

        <div className="px-3 md:px-4 -mt-10 md:-mt-12 pb-3 md:pb-4 relative z-30">
          {/* Always show the hand once dealt — bidders need to SEE their
              cards to bid intelligently. Fix Feb 2026 (round 2): user
              said "can't see the cards" — the fan was gated to `playing`
              only, leaving the auction + trump-naming phases blind. */}
          {raw.your_hand && raw.your_hand.length > 0 && !finished && !scoring ? (
            <SpadesHandFan
              hand={raw.your_hand}
              validPlays={raw.playable_cards ?? raw.your_hand}
              isYourTurn={isYourPlayTurn}
              onPlay={playCard}
              busy={busy}
              hideTurnIndicator={raw.phase === "bidding" || raw.phase === "naming_trump"}
            />
          ) : null}

          {/* Auction panel */}
          {isYourBidTurn ? (
            <div className="mt-3 flex flex-wrap justify-center gap-2" data-testid="pinochle-bid-panel">
              {bidOptions.map((amt) => (
                <button
                  key={amt}
                  onClick={() => placeBid(amt)}
                  disabled={busy}
                  className="px-3 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black uppercase tracking-widest text-xs disabled:opacity-40 tabular-nums"
                  data-testid={`pinochle-bid-${amt}`}
                >
                  {amt}
                </button>
              ))}
              <button
                onClick={passBid}
                disabled={busy}
                className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 hover:bg-slate-700 text-cyan-100 font-bold uppercase tracking-widest text-xs disabled:opacity-40"
                data-testid="pinochle-pass-btn"
              >
                Pass
              </button>
            </div>
          ) : null}

          {/* Trump-naming panel */}
          {isYourTrumpTurn ? (
            <div className="mt-3 flex flex-wrap justify-center gap-2" data-testid="pinochle-trump-panel">
              {SUITS.map((s) => (
                <button
                  key={s}
                  onClick={() => namedTrump(s)}
                  disabled={busy}
                  className="px-3 py-2 rounded-lg bg-slate-900 border-2 border-cyan-400/50 hover:border-cyan-300 text-cyan-100 font-black uppercase tracking-widest text-xs disabled:opacity-40"
                  data-testid={`pinochle-name-trump-${s}`}
                >
                  Trump <span className={SUIT_COLOR[s]}>{SUIT_GLYPH[s]}</span>
                </button>
              ))}
            </div>
          ) : null}

          {/* Meld breakdown after trump declared */}
          {raw.your_meld && (raw.phase === "playing" || raw.phase === "naming_trump") ? (
            <div className="mt-3 flex flex-wrap justify-center gap-2 text-[10px] uppercase tracking-wider" data-testid="pinochle-meld-strip">
              <span className="text-cyan-300/80 font-bold">Your Meld:</span>
              {raw.your_meld.melds.length === 0 ? (
                <span className="text-cyan-100/50">— none</span>
              ) : (
                raw.your_meld.melds.map((m, i) => (
                  <span key={i} className="px-2 py-0.5 rounded bg-cyan-500/15 border border-cyan-400/30 text-cyan-100">
                    {m.name} · <strong className="text-cyan-200">+{m.points}</strong>
                  </span>
                ))
              )}
              <span className="px-2 py-0.5 rounded bg-cyan-700/30 border border-cyan-400/50 text-cyan-100 font-black tabular-nums">
                Total {raw.your_meld.total}
              </span>
            </div>
          ) : null}

          {scoring ? (
            <button onClick={newHand} disabled={busy} className="mx-auto mt-3 block px-5 py-2.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold disabled:opacity-50" data-testid="pinochle-next-hand-btn">
              Next Hand
            </button>
          ) : null}

          {raw.hand_summary && (scoring || finished) ? (
            <div className="mt-4 p-4 rounded-2xl bg-white/[0.04] border border-cyan-400/30 text-center max-w-md mx-auto" data-testid="pinochle-hand-summary">
              <p className="text-xs uppercase tracking-[0.25em] text-cyan-300 font-bold mb-1" style={{ fontFamily: "'Cinzel', serif" }}>
                {raw.hand_summary.went_set ? "BIDDER WENT SET" : "BIDDER MADE THE CONTRACT"} · {raw.hand_summary.contract}
              </p>
              <p className="text-cyan-100 text-sm">
                Δ team1 <strong className={raw.hand_summary.delta.team1 < 0 ? "text-rose-300" : "text-emerald-300"}>{raw.hand_summary.delta.team1 >= 0 ? "+" : ""}{raw.hand_summary.delta.team1}</strong>
                {" · "}
                Δ team2 <strong className={raw.hand_summary.delta.team2 < 0 ? "text-rose-300" : "text-emerald-300"}>{raw.hand_summary.delta.team2 >= 0 ? "+" : ""}{raw.hand_summary.delta.team2}</strong>
              </p>
            </div>
          ) : null}

          {finished ? (
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="mt-4 p-6 rounded-2xl bg-gradient-to-br from-cyan-950/40 to-[#04060e] border-2 border-cyan-400/40 text-center" data-testid="pinochle-aaa-finished-footer">
              <Sparkles className="w-10 h-10 mx-auto mb-2 text-cyan-300" />
              <h2 className="text-2xl font-black mb-1" style={{ fontFamily: "'Cinzel', serif" }}>
                {raw.match_winner === "team1" ? "Your Team Wins!" : "Rivals Win"}
              </h2>
              <div className="flex gap-3 justify-center mt-4">
                <button onClick={startMatch} disabled={busy} className="px-5 py-2.5 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold disabled:opacity-50" data-testid="pinochle-aaa-replay-btn">Play Again</button>
                <button onClick={backToLobby} className="px-5 py-2.5 rounded-lg border border-cyan-400/40 text-cyan-200 hover:bg-cyan-500/10 font-bold" data-testid="pinochle-aaa-lobby-btn">Back to Lobby</button>
              </div>
            </motion.div>
          ) : null}
        </div>
      </div>

      <SpadesPlayerProfile open={profileOpen !== null} position={profileOpen} player={profileOpen ? players[profileOpen] : null} isYou={profileOpen === youPosition} onClose={() => setProfileOpen(null)} />
      <SpadesCommunityChat open={chatOpen} gameId={`pinochle-${raw.user_position}`} mode="ai" onClose={() => setChatOpen(false)} />
    </div>
  );
}
