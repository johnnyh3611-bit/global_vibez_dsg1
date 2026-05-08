/**
 * Euchre AAA — Universal prototype, bronze variant. 4P partnership game.
 * Reuses SpadesTable + SpadesSeat + SpadesHandFan + SpadesTrickPile +
 * SpadesGameMenu + SpadesPlayerProfile + SpadesCommunityChat.
 */
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Bot, Loader2, Sparkles, Crown } from "lucide-react";
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
const SUIT_GLYPH: Record<string, string> = { spades: "♠", clubs: "♣", hearts: "♥", diamonds: "♦" };
const SUIT_COLOR: Record<string, string> = { spades: "text-slate-100", clubs: "text-slate-100", hearts: "text-rose-400", diamonds: "text-rose-400" };

interface EuchrePlayer { card_count: number; tricks_won: number; team: "team1" | "team2"; }
interface EuchreTrickPlay { player: SpadesPosition; card: CardData; }
interface EuchreRaw {
  user_position: SpadesPosition;
  phase: "bidding" | "ordered_dealer_discard" | "playing" | "scoring" | "finished";
  turn: SpadesPosition;
  bid_turn: SpadesPosition;
  bid_round: 1 | 2;
  dealer: SpadesPosition;
  upcard: CardData;
  trump: Suit | null;
  calling_team: "team1" | "team2" | null;
  current_trick: EuchreTrickPlay[];
  led_suit: string | null;
  your_hand: CardData[];
  playable_cards: CardData[];
  scores: { team1: number; team2: number };
  team_tricks: { team1: number; team2: number };
  tricks_played: number;
  players_data: Record<SpadesPosition, EuchrePlayer>;
  match_winner: "team1" | "team2" | null;
  hand_summary: { caller: string; tricks_team1: number; tricks_team2: number; outcome: string; points_awarded: number } | null;
  last_action: { player?: SpadesPosition; action?: string; trump?: string; round?: number } | null;
  play_sequence?: Array<{ player: SpadesPosition; card?: CardData; bid?: { trump?: string; awaiting_discard?: boolean }; trick_winner?: SpadesPosition; trick_complete?: boolean; round_complete?: boolean }>;
}

const BOT_NAMES: Record<SpadesPosition, string> = {
  north: "Partner", south: "You", east: "Rival East", west: "Rival West",
};

function adapt(raw: EuchreRaw): { players: Record<SpadesPosition, SpadesPlayerView>; scores: SpadesScores } {
  const safe = raw.players_data ?? ({} as Record<SpadesPosition, EuchrePlayer>);
  const players: Record<SpadesPosition, SpadesPlayerView> = {} as Record<SpadesPosition, SpadesPlayerView>;
  (["north", "east", "south", "west"] as SpadesPosition[]).forEach((pos) => {
    const p = safe[pos];
    players[pos] = {
      hand_count: p?.card_count ?? 0,
      bid: 3,                                   // pill semantics: tricks-won/3 (3+ to make)
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

export default function EuchreAAA() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<"lobby" | "game">("lobby");
  const [raw, setRaw] = useState<EuchreRaw | null>(null);
  const [busy, setBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState<StatusMessage | null>(null);
  const [profileOpen, setProfileOpen] = useState<SpadesPosition | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [dealing, setDealing] = useState(false);
  const [showMpLobby, setShowMpLobby] = useState(false);

  const flash = useCallback((text: string, tone: StatusMessage["tone"] = "amber", ttl = 1800) => {
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
      const res = await authFetch(`${API}/api/euchre-practice/start`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      const data = await res.json();
      if (!res.ok) { flash(data.detail || "Failed to start", "rose"); return; }
      setRaw(data.game as EuchreRaw);
      setPhase("game");
      flash("Euchre · 24-card · Bowers in play", "amber");
      dealAndShow();
    } finally { setBusy(false); }
  }, [flash, dealAndShow]);

  const post = useCallback(async (path: string, body: Record<string, unknown> = {}) => {
    if (!raw || busy) return;
    setBusy(true);
    try {
      const res = await authFetch(`${API}/api/euchre-practice/${path}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { flash(data.detail || "Action failed", "rose"); return null; }
      return data.game as EuchreRaw;
    } finally { setBusy(false); }
  }, [raw, busy, flash]);

  const orderUp = useCallback(async () => {
    const next = await post("order-up");
    if (next) { setRaw(next); flash(`Trump · ${(next.trump ?? "—").toUpperCase()}`, "amber", 1800); }
  }, [post, flash]);

  const namedTrump = useCallback(async (suit: Suit) => {
    const next = await post("name-trump", { suit });
    if (next) { setRaw(next); flash(`Trump · ${suit.toUpperCase()}`, "amber", 1800); }
  }, [post, flash]);

  const passBid = useCallback(async () => {
    const next = await post("pass-bid");
    if (next) setRaw(next);
  }, [post]);

  const discardCard = useCallback(async (card: CardData) => {
    const next = await post("discard", { card });
    if (next) setRaw(next);
  }, [post]);

  const playCard = useCallback(async (card: CardData) => {
    if (!raw || busy) return;
    if (raw.phase === "ordered_dealer_discard") {
      // tap = discard
      await discardCard(card);
      return;
    }
    setBusy(true);
    try {
      const res = await authFetch(`${API}/api/euchre-practice/play`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ card }),
      });
      const data = await res.json();
      if (!res.ok) { flash(data.detail || "Illegal play", "rose"); return; }
      const next = data.game as EuchreRaw;
      const seq = next.play_sequence ?? [];
      // Stage trick pile growth one play at a time (Spades pattern)
      if (seq.length === 0) { setRaw(next); return; }
      let stagedTrick: EuchreTrickPlay[] = [...raw.current_trick, { player: raw.user_position, card }];
      const stagedPlayers = { ...raw.players_data };
      for (const ev of seq) {
        if (!ev.card) continue;
        if (ev.player !== raw.user_position) {
          stagedTrick = [...stagedTrick, { player: ev.player, card: ev.card }];
          setRaw((prev) => prev ? { ...prev, current_trick: stagedTrick, players_data: stagedPlayers } : prev);
        }
        await new Promise<void>((r) => setTimeout(r, 850));
        if (ev.trick_complete && ev.trick_winner) {
          flash(`${BOT_NAMES[ev.trick_winner] ?? ev.trick_winner} took the trick`, "amber", 1100);
          await new Promise<void>((r) => setTimeout(r, 1000));
          stagedTrick = [];
          setRaw((prev) => prev ? { ...prev, current_trick: stagedTrick } : prev);
        }
      }
      setRaw(next);
    } finally { setBusy(false); }
  }, [raw, busy, flash, discardCard]);

  const newHand = useCallback(async () => {
    const next = await post("new-hand");
    if (next) {
      setRaw(next);
      flash("New hand", "amber");
      dealAndShow();
    }
  }, [post, flash, dealAndShow]);

  const backToLobby = () => { setRaw(null); setPhase("lobby"); };

  if (phase === "lobby") {
    return (
      <>
      <div className="min-h-screen bg-[#1a0f04] text-white relative overflow-x-hidden" data-testid="euchre-aaa-lobby">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 w-[60vw] h-[60vw] max-w-[700px] max-h-[700px] rounded-full bg-amber-700/15 blur-[120px]" />
        </div>
        <div className="relative z-10 max-w-3xl mx-auto px-4 py-6">
          <button onClick={() => navigate("/games")} className="flex items-center gap-2 text-amber-300/70 hover:text-white transition mb-4 text-sm font-bold" data-testid="euchre-aaa-lobby-back">
            <ArrowLeft className="w-4 h-4" /> Back to Games
          </button>
          <div className="flex items-center gap-3 mb-8">
            <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-700 via-orange-700 to-amber-900 shadow-[0_0_24px_rgba(180,83,9,0.45)]">
              <Crown className="w-8 h-8 text-amber-200" />
            </div>
            <div>
              <p className="text-xs font-mono uppercase tracking-[0.3em] text-amber-300/80" style={{ fontFamily: "'Cinzel', serif" }}>
                Card Parlour · Euchre
              </p>
              <h1 className="text-3xl md:text-4xl font-black leading-none" style={{ fontFamily: "'Cinzel', serif" }}>
                Euchre AAA
              </h1>
            </div>
          </div>
          <div className="mb-6 p-4 rounded-2xl bg-white/[0.03] border border-amber-400/20 text-sm text-amber-100/80 leading-relaxed">
            <p className="text-xs uppercase tracking-[0.3em] text-amber-300 font-bold mb-2" style={{ fontFamily: "'Cinzel', serif" }}>
              House Rules
            </p>
            • 24-card deck (9-A) · 4 players · partners N+S vs E+W · 5 cards each<br />
            • Bidding R1: <strong>Order Up</strong> the upcard or pass · R2: <strong>Name Trump</strong> (different suit) or pass<br />
            • <strong>Right Bower</strong> (J of trump) ranks #1 · <strong>Left Bower</strong> (J of same colour) ranks #2 — both treated as trump<br />
            • Make 3-4 tricks: +1 · Sweep all 5: +2 · <strong>Euchred</strong> (caller &lt; 3): defenders +2<br />
            • First team to <strong>10 points</strong> wins
          </div>
          <button
            onClick={startMatch}
            disabled={busy}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-600 via-orange-600 to-amber-600 hover:from-amber-500 hover:to-orange-500 text-amber-50 font-black uppercase tracking-widest text-base shadow-[0_0_30px_rgba(180,83,9,0.55)] disabled:opacity-50"
            style={{ fontFamily: "'Cinzel', serif" }}
            data-testid="euchre-aaa-lobby-start-btn"
          >
            {busy ? "Dealing…" : "Start AI Match"}
          </button>
          <button
            onClick={() => setShowMpLobby(true)}
            className="w-full mt-3 py-3 rounded-2xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-black uppercase tracking-widest text-sm shadow-[0_0_30px_rgba(34,211,238,0.35)]"
            style={{ fontFamily: "'Cinzel', serif" }}
            data-testid="euchre-aaa-mp-btn"
          >
            🎮 Play Live Multiplayer
          </button>
        </div>
      </div>
      <CardMpLobbyModal
        open={showMpLobby}
        game="euchre"
        onClose={() => setShowMpLobby(false)}
        playRoute="/card-mp/euchre"
      />
    </>
    );
  }

  if (!raw) {
    return <div className="min-h-screen bg-[#1a0f04] flex items-center justify-center"><Loader2 className="w-12 h-12 text-amber-400 animate-spin" /></div>;
  }

  const { players, scores } = adapt(raw);
  const youPosition = raw.user_position;
  const isYourBidTurn = raw.phase === "bidding" && raw.bid_turn === youPosition;
  const isYourPlayTurn = raw.phase === "playing" && raw.turn === youPosition;
  const isYourDiscard = raw.phase === "ordered_dealer_discard";
  const finished = raw.phase === "finished";
  const scoring = raw.phase === "scoring";

  // Auto-advance to the next hand after 5s of scoring review — per
  // user: "should be a pop-up that lasts about 5 seconds to show
  // everything so people could read it. Then they go on to the next
  // round. It shouldn't just sit there for a long time."
  useEffect(() => {
    if (!scoring || busy) return;
    const t = window.setTimeout(() => { newHand(); }, 5000);
    return () => window.clearTimeout(t);
  }, [scoring, busy, newHand]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#2a1a0a] via-[#1a0f04] to-[#0a0703] text-white relative overflow-x-hidden" data-testid="euchre-aaa">
      <div className="relative z-10 flex flex-col min-h-screen">
        <div className="flex flex-wrap items-start justify-between px-2 sm:px-3 md:px-5 pt-2 sm:pt-3 md:pt-4 gap-2">
          <div className="flex flex-col items-start gap-2">
            <button onClick={backToLobby} className="flex items-center gap-1.5 text-amber-300/70 hover:text-white transition text-xs md:text-sm font-bold" data-testid="euchre-aaa-back-btn">
              <ArrowLeft className="w-4 h-4" /> Lobby
            </button>
            <SpadesGameMenu onExit={backToLobby} onOpenMessages={() => setChatOpen(true)} />
          </div>
          <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 order-3 w-full sm:order-none sm:w-auto">
            <div className="px-2 py-0.5 rounded-full bg-amber-700/20 border border-amber-500/40 text-[9px] md:text-[10px] uppercase tracking-[0.3em] text-amber-200 font-bold">Euchre</div>
            <div className="px-2 py-0.5 rounded-full bg-fuchsia-500/15 border border-fuchsia-400/40 text-[9px] md:text-[10px] uppercase tracking-[0.3em] text-fuchsia-300 font-bold">
              <span className="inline-flex items-center gap-1"><Bot className="w-2.5 h-2.5" /> AI</span>
            </div>
            {raw.trump ? (
              <div className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/50 text-[9px] md:text-[10px] uppercase tracking-[0.3em] text-emerald-200 font-bold flex items-center gap-1">
                Trump · <span>{SUIT_GLYPH[raw.trump]}</span> {raw.trump}
              </div>
            ) : (
              <div className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-600 text-[9px] md:text-[10px] uppercase tracking-[0.3em] text-amber-200 font-bold">
                Bidding · R{raw.bid_round}
              </div>
            )}
            {raw.upcard && raw.phase === "bidding" ? (
              <div className="px-2 py-0.5 rounded-full bg-slate-800 border border-amber-500/40 text-[9px] md:text-[10px] uppercase tracking-[0.3em] text-amber-200 font-bold flex items-center gap-1">
                Upcard · <span className={SUIT_COLOR[raw.upcard.suit]}>{raw.upcard.rank}{SUIT_GLYPH[raw.upcard.suit]}</span>
              </div>
            ) : null}
          </div>
          <SpadesScoreBadge scores={scores} players={players} phase="playing" tricksPlayed={raw.tricks_played} />
        </div>

        <SpadesStatusBanner message={statusMsg} />

        <div className="flex items-center justify-center py-2 md:py-3 relative">
          <div className="relative">
            <SpadesTable brandSubLabel="EUCHRE" variant="gold" centreGlyph="E">
              <SpadesSeat position="north" player={players.north} isTurn={raw.turn === "north" || raw.bid_turn === "north"} isYou={youPosition === "north"} isDealer={raw.dealer === "north"} onClick={() => setProfileOpen("north")} />
              <SpadesSeat position="east"  player={players.east}  isTurn={raw.turn === "east"  || raw.bid_turn === "east"}  isYou={youPosition === "east"}  isDealer={raw.dealer === "east"}  onClick={() => setProfileOpen("east")} />
              <SpadesSeat position="west"  player={players.west}  isTurn={raw.turn === "west"  || raw.bid_turn === "west"}  isYou={youPosition === "west"}  isDealer={raw.dealer === "west"}  onClick={() => setProfileOpen("west")} />
              <SpadesTrickPile trick={raw.current_trick} />
            </SpadesTable>
            <SpadesDealingAnimation active={dealing} />
          </div>
        </div>

        <div className="px-3 md:px-4 -mt-10 md:-mt-12 pb-3 md:pb-4 relative z-30">
          {/* Always render the hand once dealt so the player can SEE
              their cards while bidding (Order Up / Name Trump / Pass).
              Interaction is locked off in non-play phases by passing
              isYourTurn=false → cards rendered, not clickable. Fix Feb
              2026 (round 2): user reported "can't see the cards at all
              to play the game" because the fan was previously gated to
              `playing | ordered_dealer_discard` only. */}
          {raw.your_hand && raw.your_hand.length > 0 && !finished && !scoring ? (
            <SpadesHandFan
              hand={raw.your_hand}
              validPlays={isYourDiscard ? raw.your_hand : (raw.playable_cards ?? [])}
              isYourTurn={isYourPlayTurn || isYourDiscard}
              onPlay={playCard}
              busy={busy}
              hideTurnIndicator={raw.phase === "bidding"}
            />
          ) : null}

          {/* Bidding panel */}
          {isYourBidTurn ? (
            <div className="mt-3 flex flex-wrap justify-center gap-2" data-testid="euchre-bid-panel">
              {raw.bid_round === 1 ? (
                <>
                  <button
                    onClick={orderUp}
                    disabled={busy}
                    className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black uppercase tracking-widest text-xs shadow-[0_0_20px_rgba(245,158,11,0.45)] disabled:opacity-40"
                    data-testid="euchre-order-up-btn"
                  >
                    Order Up · {SUIT_GLYPH[raw.upcard.suit]} {raw.upcard.rank}
                  </button>
                  <button
                    onClick={passBid}
                    disabled={busy}
                    className="px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-600 hover:bg-slate-700 text-amber-100 font-bold uppercase tracking-widest text-xs disabled:opacity-40"
                    data-testid="euchre-pass-btn"
                  >
                    Pass
                  </button>
                </>
              ) : (
                <>
                  {(["clubs", "diamonds", "spades", "hearts"] as Suit[])
                    .filter((s) => s !== raw.upcard.suit)
                    .map((s) => (
                      <button
                        key={s}
                        onClick={() => namedTrump(s)}
                        disabled={busy}
                        className="px-3 py-2 rounded-lg bg-slate-900 border-2 border-amber-400/50 hover:border-amber-300 text-amber-100 font-black uppercase tracking-widest text-xs disabled:opacity-40"
                        data-testid={`euchre-name-trump-${s}`}
                      >
                        Trump <span className={SUIT_COLOR[s]}>{SUIT_GLYPH[s]}</span>
                      </button>
                    ))}
                  <button
                    onClick={passBid}
                    disabled={busy}
                    className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 hover:bg-slate-700 text-amber-100 font-bold uppercase tracking-widest text-xs disabled:opacity-40"
                    data-testid="euchre-pass-btn-2"
                  >
                    Pass
                  </button>
                </>
              )}
            </div>
          ) : null}

          {raw.phase === "ordered_dealer_discard" ? (
            <div className="mt-3 text-center text-amber-200 text-xs uppercase tracking-[0.3em] font-bold" data-testid="euchre-discard-prompt">
              Tap a card to discard (you ordered up the upcard)
            </div>
          ) : null}

          {scoring ? (
            <button onClick={newHand} disabled={busy} className="mx-auto mt-3 block px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold disabled:opacity-50" data-testid="euchre-next-hand-btn">
              Next Hand
            </button>
          ) : null}

          {raw.hand_summary && (scoring || finished) ? (
            <div className="mt-4 p-4 rounded-2xl bg-white/[0.04] border border-amber-400/30 text-center" data-testid="euchre-hand-summary">
              <p className="text-xs uppercase tracking-[0.25em] text-amber-300 font-bold mb-1" style={{ fontFamily: "'Cinzel', serif" }}>
                {raw.hand_summary.outcome.toUpperCase()} · +{raw.hand_summary.points_awarded}
              </p>
              <p className="text-amber-100 text-sm">
                Tricks · team1 {raw.hand_summary.tricks_team1} · team2 {raw.hand_summary.tricks_team2}
              </p>
            </div>
          ) : null}

          {finished ? (
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="mt-4 p-6 rounded-2xl bg-gradient-to-br from-amber-950/40 to-[#0a0703] border-2 border-amber-400/40 text-center" data-testid="euchre-aaa-finished-footer">
              <Sparkles className="w-10 h-10 mx-auto mb-2 text-amber-300" />
              <h2 className="text-2xl font-black mb-1" style={{ fontFamily: "'Cinzel', serif" }}>
                {raw.match_winner === "team1" ? "Your Team Wins!" : "Rivals Win"}
              </h2>
              <div className="flex gap-3 justify-center mt-4">
                <button onClick={startMatch} disabled={busy} className="px-5 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold disabled:opacity-50" data-testid="euchre-aaa-replay-btn">Play Again</button>
                <button onClick={backToLobby} className="px-5 py-2.5 rounded-lg border border-amber-400/40 text-amber-200 hover:bg-amber-500/10 font-bold" data-testid="euchre-aaa-lobby-btn">Back to Lobby</button>
              </div>
            </motion.div>
          ) : null}
        </div>
      </div>

      <SpadesPlayerProfile open={profileOpen !== null} position={profileOpen} player={profileOpen ? players[profileOpen] : null} isYou={profileOpen === youPosition} onClose={() => setProfileOpen(null)} />
      <SpadesCommunityChat open={chatOpen} gameId={`euchre-${raw.user_position}`} mode="ai" onClose={() => setChatOpen(false)} />
    </div>
  );
}
