/**
 * Crazy Eights AAA — Universal prototype, indigo-onyx variant.
 * Reuses SpadesTable variant="onyx" + SpadesSeat + SpadesHandFan +
 * SpadesGameMenu + SpadesCommunityChat + SpadesPlayerProfile.
 *
 * Hearts had a pass phase; Crazy Eights has a wild-suit phase.
 * The seat progress pill shows cards remaining (lower = closer to victory).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Bot, Loader2, Sparkles, Plus } from "lucide-react";
import { authFetch } from "@/utils/secureAuth";

import SpadesTable from "@/components/spades/SpadesTable";
import SpadesStatusBanner from "@/components/spades/SpadesStatusBanner";
import SpadesHandFan from "@/components/spades/SpadesHandFan";
import SpadesScoreBadge from "@/components/spades/SpadesScoreBadge";
import SpadesSeat from "@/components/spades/SpadesSeat";
import SpadesDealingAnimation from "@/components/spades/SpadesDealingAnimation";
import SpadesGameMenu from "@/components/spades/SpadesGameMenu";
import CommHubButton from "@/components/common/CommHubButton";
import SpadesPlayerProfile from "@/components/spades/SpadesPlayerProfile";
import SpadesCommunityChat from "@/components/spades/SpadesCommunityChat";
import CrazyEightsWildModal from "@/components/crazy-eights-aaa/CrazyEightsWildModal";
import CrazyEightsCenterPile from "@/components/crazy-eights-aaa/CrazyEightsCenterPile";
import type {
  SpadesCard as CardData,
  SpadesPosition,
  SpadesPlayerView,
  SpadesScores,
  StatusMessage,
} from "@/components/spades/types";

const API = process.env.REACT_APP_BACKEND_URL;

interface CePlayer { card_count: number; score: number; }
interface CeRaw {
  user_position: SpadesPosition;
  phase: "playing" | "scoring" | "finished";
  turn: SpadesPosition;
  top_card: CardData;
  declared_suit: "clubs" | "diamonds" | "spades" | "hearts";
  draw_pile_count: number;
  your_hand: CardData[];
  playable_cards: CardData[];
  scores: Record<SpadesPosition, number>;
  players_data: Record<SpadesPosition, CePlayer>;
  hand_winner: SpadesPosition | null;
  match_winner: SpadesPosition | null;
  pending_wild: boolean;
  last_action: { player: SpadesPosition; card?: CardData; drew?: boolean; wild?: boolean; declared?: string } | null;
  play_sequence?: Array<{ player: SpadesPosition; card?: CardData; drew?: boolean; wild?: boolean; declared?: string; hand_complete?: boolean; winner?: SpadesPosition | null }>;
}

const BOT_NAMES: Record<SpadesPosition, string> = {
  north: "Cyber Echo",
  south: "You",
  east:  "Neon Riot",
  west:  "Pulse Wraith",
};

function adapt(raw: CeRaw): {
  players: Record<SpadesPosition, SpadesPlayerView>;
  scores: SpadesScores;
} {
  const safe = raw.players_data ?? ({} as Record<SpadesPosition, CePlayer>);
  const players: Record<SpadesPosition, SpadesPlayerView> = {} as Record<SpadesPosition, SpadesPlayerView>;
  (["north", "east", "south", "west"] as SpadesPosition[]).forEach((pos) => {
    const p = safe[pos];
    players[pos] = {
      hand_count: p?.card_count ?? 0,
      bid: 0,
      tricks: p?.card_count ?? 0,  // pill shows cards remaining (low = closer to win)
      team: pos === "north" || pos === "south" ? "team1" : "team2",
      is_bot: pos !== raw.user_position,
      name: pos === raw.user_position ? "You" : BOT_NAMES[pos],
    };
  });
  const total1 = (raw.scores?.north ?? 0) + (raw.scores?.south ?? 0);
  const total2 = (raw.scores?.east ?? 0) + (raw.scores?.west ?? 0);
  return { players, scores: { team1: { points: total1, bags: 0 }, team2: { points: total2, bags: 0 } } };
}

export default function CrazyEightsAAA() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<"lobby" | "game">("lobby");
  const [raw, setRaw] = useState<CeRaw | null>(null);
  const [busy, setBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState<StatusMessage | null>(null);
  const [profileOpen, setProfileOpen] = useState<SpadesPosition | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [dealing, setDealing] = useState(false);
  const [dealKey, setDealKey] = useState(0);
  const [pendingPlayCard, setPendingPlayCard] = useState<CardData | null>(null);

  // Universal 10s Shot Clock (Beta Specs §4 + UDA §2). Auto-plays the
  // lowest matching card or draws if no playable cards exist.
  const SHOT_CLOCK_MS = 10_000;
  const [turnExpiresAt, setTurnExpiresAt] = useState<number | null>(null);
  const lastTurnKeyRef = useRef<string | null>(null);

  const flash = useCallback((text: string, tone: StatusMessage["tone"] = "indigo", ttl = 1800) => {
    setStatusMsg({ text, tone, id: Date.now() });
    window.setTimeout(() => setStatusMsg((p) => (p && p.text === text ? null : p)), ttl);
  }, []);

  const dealAndShow = useCallback(() => {
    setDealing(true);
    setDealKey((k) => k + 1);
    window.setTimeout(() => setDealing(false), 2500);
  }, []);

  // Stage each entry in `play_sequence` so the user sees each bot land
  // their card on the discard pile one at a time. We tween a copy of
  // game.top_card through the sequence with a brief pause, then commit
  // the authoritative server state at the end. Mirror of Spades AAA.
  const STAGE_MS = 700;
  const stagePlaySequence = useCallback(async (next: CeRaw) => {
    const seq = next.play_sequence ?? [];
    if (seq.length <= 1) {
      setRaw(next);
      return;
    }
    // Walk events one-by-one. We start from the current `raw` and step
    // through each play. After the last event we replace with the full
    // server payload (so card_count / scores / phase are accurate).
    for (let i = 0; i < seq.length; i++) {
      const ev = seq[i];
      // Show a status label naming the actor + what they did.
      if (ev.drew) {
        flash(`${BOT_NAMES[ev.player] ?? ev.player} drew a card`, "indigo", 900);
      } else if (ev.card) {
        const wildLabel = ev.wild ? ` · declared ${ev.declared}` : "";
        flash(`${BOT_NAMES[ev.player] ?? ev.player} → ${ev.card.rank}${ev.card.suit[0].toUpperCase()}${wildLabel}`, "indigo", 900);
        // Mid-flight: show the card on top of the discard pile and
        // decrement the playing seat's hand_count immediately so the
        // visual state matches what just happened.
        setRaw((prev) => {
          if (!prev) return prev;
          const players_data = { ...prev.players_data };
          const seat = players_data[ev.player];
          if (seat) {
            players_data[ev.player] = { ...seat, card_count: Math.max(0, seat.card_count - 1) };
          }
          return {
            ...prev,
            top_card: ev.card!,
            declared_suit: (ev.declared as CeRaw["declared_suit"]) ?? prev.declared_suit,
            players_data,
            turn: ev.player,
          };
        });
      }
      await new Promise<void>((r) => setTimeout(r, STAGE_MS));
    }
    setRaw(next);
  }, [flash]);

  const startMatch = useCallback(async () => {
    setBusy(true);
    try {
      const res = await authFetch(`${API}/api/crazy-eights-practice/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) {
        flash(data.detail || "Failed to start", "rose");
        return;
      }
      setRaw(data.game as CeRaw);
      setPhase("game");
      flash("Crazy Eights · Match underway", "indigo");
      dealAndShow();
    } finally {
      setBusy(false);
    }
  }, [flash, dealAndShow]);

  const playCard = useCallback(async (card: CardData) => {
    if (!raw || busy) return;
    if (card.rank === "8") {
      // Defer: open the wild picker first
      setPendingPlayCard(card);
      return;
    }
    setBusy(true);
    try {
      const res = await authFetch(`${API}/api/crazy-eights-practice/play`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ card }),
      });
      const data = await res.json();
      if (!res.ok) {
        flash(data.detail || "Illegal play", "rose");
        return;
      }
      await stagePlaySequence(data.game as CeRaw);
    } finally {
      setBusy(false);
    }
  }, [raw, busy, flash, stagePlaySequence]);

  const finalizeWild = useCallback(async (suit: "clubs" | "diamonds" | "spades" | "hearts") => {
    if (!raw || !pendingPlayCard) return;
    setBusy(true);
    try {
      const res = await authFetch(`${API}/api/crazy-eights-practice/play`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ card: pendingPlayCard, declared_suit: suit }),
      });
      const data = await res.json();
      if (!res.ok) {
        flash(data.detail || "Wild rejected", "rose");
        return;
      }
      setPendingPlayCard(null);
      flash(`Wild · declared ${suit.toUpperCase()}`, "indigo");
      await stagePlaySequence(data.game as CeRaw);
    } finally {
      setBusy(false);
    }
  }, [raw, pendingPlayCard, flash, stagePlaySequence]);

  const draw = useCallback(async () => {
    if (!raw || busy) return;
    setBusy(true);
    try {
      const res = await authFetch(`${API}/api/crazy-eights-practice/draw`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) {
        flash(data.detail || "Cannot draw", "rose");
        return;
      }
      flash("Drew 1 · turn passes", "indigo");
      await stagePlaySequence(data.game as CeRaw);
    } finally {
      setBusy(false);
    }
  }, [raw, busy, flash, stagePlaySequence]);

  // ── Universal 10s Shot Clock ─────────────────────────────────────────
  useEffect(() => {
    if (!raw) {
      setTurnExpiresAt(null);
      lastTurnKeyRef.current = null;
      return;
    }
    const activeKey = raw.turn ?? null;
    const turnKey = activeKey ? `${raw.phase}:${activeKey}` : null;
    if (turnKey !== lastTurnKeyRef.current) {
      lastTurnKeyRef.current = turnKey;
      setTurnExpiresAt(activeKey ? Date.now() + SHOT_CLOCK_MS : null);
    }
  }, [raw]);

  // Auto-action: play any matching card if one exists, else draw.
  // (Crazy Eights — match suit OR rank OR play an 8 wild.)
  const handleShotClockExpire = useCallback(() => {
    if (!raw || busy) return;
    if (raw.turn !== raw.user_position || raw.phase !== "playing") return;
    if (raw.pending_wild) return; // wait for human suit pick — don't auto
    const top = raw.discard_top;
    const hand = raw.your_hand ?? [];
    const RANK_VALUES: Record<string, number> = {
      "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8,
      "9": 9, "10": 10, J: 11, Q: 12, K: 13, A: 14,
    };
    // Prefer a non-eight match by suit/rank — saves the wild for later.
    const matches = hand
      .filter((c) => c.rank !== "8" && (c.suit === top?.suit || c.rank === top?.rank))
      .sort((a, b) => (RANK_VALUES[a.rank] ?? 99) - (RANK_VALUES[b.rank] ?? 99));
    const eights = hand.filter((c) => c.rank === "8");
    const choice = matches[0] ?? eights[0];
    if (choice) {
      flash("Shot clock — auto-played", "indigo", 1500);
      void playCard(choice);
    } else {
      flash("Shot clock — auto-drew", "indigo", 1500);
      void draw();
    }
  }, [raw, busy, flash, playCard, draw]);

  const newHand = useCallback(async () => {
    if (!raw) return;
    setBusy(true);
    try {
      const res = await authFetch(`${API}/api/crazy-eights-practice/new-hand`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) {
        flash(data.detail || "Cannot start next hand", "rose");
        return;
      }
      setRaw(data.game as CeRaw);
      flash("Next hand · dealt", "indigo");
      dealAndShow();
      // If the new hand starts with bots, stage their plays too.
      const next = data.game as CeRaw;
      if ((next.play_sequence ?? []).length > 1) {
        await stagePlaySequence(next);
      }
    } finally {
      setBusy(false);
    }
  }, [raw, flash, dealAndShow, stagePlaySequence]);

  const backToLobby = () => {
    setRaw(null);
    setPhase("lobby");
    setPendingPlayCard(null);
  };

  // Auto-trigger new-hand prompt when scoring phase ends
  useEffect(() => {
    if (raw?.phase === "scoring") {
      flash(`Hand winner: ${raw.hand_winner ?? "—"}`, "indigo", 2500);
    }
  }, [raw?.phase, raw?.hand_winner, flash]);

  if (phase === "lobby") {
    return (
      <div
        className="min-h-screen bg-[#050507] text-white relative overflow-x-hidden"
        data-testid="crazy-eights-aaa-lobby"
      >
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 w-[60vw] h-[60vw] max-w-[700px] max-h-[700px] rounded-full bg-indigo-500/15 blur-[120px]" />
        </div>
        <div className="relative z-10 max-w-3xl mx-auto px-4 py-6">
          <button
            onClick={() => navigate("/games")}
            className="flex items-center gap-2 text-indigo-300/70 hover:text-white transition mb-4 text-sm font-bold"
            data-testid="crazy-eights-aaa-lobby-back"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Games
          </button>
          <div className="flex items-center gap-3 mb-8">
            <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 via-fuchsia-500 to-purple-700 shadow-[0_0_24px_rgba(139,92,246,0.45)]">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <div>
              <p className="text-xs font-mono uppercase tracking-[0.3em] text-indigo-300/80" style={{ fontFamily: "'Cinzel', serif" }}>
                Card Room · Crazy Eights
              </p>
              <h1 className="text-3xl md:text-4xl font-black leading-none" style={{ fontFamily: "'Cinzel', serif" }}>
                Crazy Eights AAA
              </h1>
            </div>
          </div>
          <div className="mb-6 p-4 rounded-2xl bg-white/[0.03] border border-indigo-400/20 text-sm text-indigo-100/80 leading-relaxed">
            <p className="text-xs uppercase tracking-[0.3em] text-indigo-300 font-bold mb-2" style={{ fontFamily: "'Cinzel', serif" }}>
              House Rules
            </p>
            • 52-card deck · 5 cards each · top card flipped to start the discard<br />
            • Match the SUIT or RANK · 8s are wild, declare any suit<br />
            • Can't play? Draw 1 · turn passes<br />
            • First to empty hand wins · 8s are worth <strong>50 points</strong> · face cards 10 · A=1<br />
            • First to <strong>200 points</strong> takes the match
          </div>
          <button
            onClick={startMatch}
            disabled={busy}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-indigo-500 via-fuchsia-500 to-indigo-500 hover:from-indigo-400 hover:to-fuchsia-400 text-white font-black uppercase tracking-widest text-base shadow-[0_0_30px_rgba(139,92,246,0.45)] disabled:opacity-50"
            style={{ fontFamily: "'Cinzel', serif" }}
            data-testid="crazy-eights-aaa-lobby-start-btn"
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
        <Loader2 className="w-12 h-12 text-indigo-400 animate-spin" />
      </div>
    );
  }

  const { players, scores } = adapt(raw);
  const youPosition = raw.user_position;
  const isYourTurn = raw.turn === youPosition && raw.phase === "playing" && !raw.pending_wild;
  const finished = raw.phase === "finished";

  return (
    <div
      className="min-h-screen bg-gradient-to-b from-[#0a0a18] via-[#05050a] to-[#020207] text-white relative overflow-x-hidden"
      data-testid="crazy-eights-aaa"
    >
      <div className="relative z-10 flex flex-col min-h-screen">
        <div className="flex flex-wrap items-start justify-between px-2 sm:px-3 md:px-5 pt-2 sm:pt-3 md:pt-4 gap-2">
          <div className="flex flex-col items-start gap-2">
            <button
              onClick={backToLobby}
              className="flex items-center gap-1.5 text-indigo-300/70 hover:text-white transition text-xs md:text-sm font-bold"
              data-testid="crazy-eights-aaa-back-btn"
            >
              <ArrowLeft className="w-4 h-4" /> Lobby
            </button>
            <SpadesGameMenu onExit={backToLobby} onOpenMessages={() => setChatOpen(true)} />
            <CommHubButton compact />
            <div data-testid="room-menu-bar" className="hidden" aria-hidden="true" />
          </div>
          <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 order-3 w-full sm:order-none sm:w-auto">
            <div className="px-2 py-0.5 rounded-full bg-indigo-500/15 border border-indigo-400/40 text-[9px] md:text-[10px] uppercase tracking-[0.3em] text-indigo-300 font-bold">
              Crazy 8s
            </div>
            <div className="px-2 py-0.5 rounded-full bg-fuchsia-500/15 border border-fuchsia-400/40 text-[9px] md:text-[10px] uppercase tracking-[0.3em] text-fuchsia-300 font-bold">
              <span className="inline-flex items-center gap-1">
                <Bot className="w-2.5 h-2.5" /> AI
              </span>
            </div>
          </div>
          <SpadesScoreBadge scores={scores} players={players} phase="playing" tricksPlayed={0} />
        </div>

        <SpadesStatusBanner message={statusMsg} />

        <div className="flex items-center justify-center py-2 md:py-3 relative">
          <div className="relative">
            <SpadesTable brandSubLabel="CRAZY 8S" variant="onyx" centreGlyph="8">
              <SpadesSeat position="north" player={players.north} isTurn={raw.turn === "north"} isYou={youPosition === "north"} onClick={() => setProfileOpen("north")} shotClockExpiresAt={raw.turn === "north" ? turnExpiresAt : null} onShotClockExpire={handleShotClockExpire} />
              <SpadesSeat position="east"  player={players.east}  isTurn={raw.turn === "east"}  isYou={youPosition === "east"}  onClick={() => setProfileOpen("east")}  shotClockExpiresAt={raw.turn === "east" ? turnExpiresAt : null} onShotClockExpire={handleShotClockExpire} />
              <SpadesSeat position="west"  player={players.west}  isTurn={raw.turn === "west"}  isYou={youPosition === "west"}  onClick={() => setProfileOpen("west")}  shotClockExpiresAt={raw.turn === "west" ? turnExpiresAt : null} onShotClockExpire={handleShotClockExpire} />
            </SpadesTable>
            <CrazyEightsCenterPile top={raw.top_card} declaredSuit={raw.declared_suit} drawCount={raw.draw_pile_count} />
            <SpadesDealingAnimation active={dealing} />
          </div>
        </div>

        <div className="px-3 md:px-4 -mt-10 md:-mt-12 pb-3 md:pb-4 relative z-30">
          {raw.phase === "playing" ? (
            <SpadesHandFan
              key={dealKey}
              hand={raw.your_hand}
              validPlays={raw.playable_cards ?? []}
              isYourTurn={isYourTurn}
              onPlay={playCard}
              busy={busy}
            />
          ) : null}

          <div className="mt-3 flex justify-center gap-3">
            {raw.phase === "playing" && isYourTurn ? (
              <button
                onClick={draw}
                disabled={busy}
                className="px-5 py-2.5 rounded-xl bg-slate-800 border-2 border-indigo-400/50 text-indigo-200 hover:bg-slate-700 hover:border-indigo-300 font-bold flex items-center gap-2 disabled:opacity-50"
                data-testid="crazy-eights-draw-btn"
              >
                <Plus className="w-4 h-4" /> Draw
              </button>
            ) : null}
            {raw.phase === "scoring" ? (
              <button
                onClick={newHand}
                disabled={busy}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-fuchsia-500 text-white font-bold disabled:opacity-50"
                data-testid="crazy-eights-next-hand-btn"
              >
                Next Hand
              </button>
            ) : null}
          </div>

          {finished ? (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 p-6 rounded-2xl bg-gradient-to-br from-indigo-950/40 to-[#050507] border-2 border-indigo-400/40 text-center"
              data-testid="crazy-eights-aaa-finished-footer"
            >
              <Sparkles className="w-10 h-10 mx-auto mb-2 text-indigo-300" />
              <h2 className="text-2xl font-black mb-1" style={{ fontFamily: "'Cinzel', serif" }}>
                {raw.match_winner === youPosition ? "You Win!" : `${BOT_NAMES[raw.match_winner ?? "north"]} wins`}
              </h2>
              <div className="flex gap-3 justify-center mt-4">
                <button onClick={startMatch} disabled={busy} className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-indigo-500 to-fuchsia-500 text-white font-bold disabled:opacity-50" data-testid="crazy-eights-aaa-replay-btn">
                  Play Again
                </button>
                <button onClick={backToLobby} className="px-5 py-2.5 rounded-lg border border-indigo-400/40 text-indigo-200 hover:bg-indigo-500/10 font-bold" data-testid="crazy-eights-aaa-lobby-btn">
                  Back to Lobby
                </button>
              </div>
            </motion.div>
          ) : null}
        </div>
      </div>

      <CrazyEightsWildModal open={pendingPlayCard !== null} busy={busy} onPick={finalizeWild} />

      <SpadesPlayerProfile
        open={profileOpen !== null}
        position={profileOpen}
        player={profileOpen ? players[profileOpen] : null}
        isYou={profileOpen === youPosition}
        onClose={() => setProfileOpen(null)}
      />
      <SpadesCommunityChat open={chatOpen} gameId={`crazy-eights-${raw.user_position}`} mode="ai" onClose={() => setChatOpen(false)} />
    </div>
  );
}
