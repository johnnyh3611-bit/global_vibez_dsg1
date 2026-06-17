/**
 * HttpMultiplayerGinRummy — 2-player Gin Rummy.
 *
 * Simplified MVP rules:
 *   - Each player gets 10 cards, 1 starts face-up in discard pile.
 *   - On your turn: draw from deck OR take the top discard → then discard 1.
 *   - "Knock" when your deadwood (cards not in any meld) ≤ 10 points.
 *   - MVP scoring: knocker gets positive points = opponent's deadwood;
 *     full laydown validation is deferred (knock just ends the round).
 */
import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate, useParams } from "react-router-dom";
import { useHttpMultiplayer } from "@/hooks/useHttpMultiplayer";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Hand } from "lucide-react";
import cardSoundManager from "@/utils/cardSoundManager";
import WinCelebration from "@/components/games/WinCelebration";

type GameState = {
  player1_hand: string[];
  player2_hand: string[];
  deck: string[];
  discard_pile: string[];
  player1_score: number;
  player2_score: number;
  phase: "draw" | "discard";
  last_drawn: string | null;
  knocked_by: "player1" | "player2" | null;
};

const RANK_VALUE: Record<string, number> = {
  A: 1, "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9, "10": 10, J: 10, Q: 10, K: 10,
};

const displayRank = (card: string): string => card.slice(0, -1);
const suitOf = (card: string): string => card.slice(-1);
const suitSymbol = (s: string): string => ({ H: "♥", D: "♦", C: "♣", S: "♠" } as Record<string, string>)[s] || "?";
const isRed = (s: string): boolean => s === "H" || s === "D";

// Rough deadwood estimator — treats every card as deadwood, minus trivial
// "set of 3+" detection. Good enough for MVP knock decision; client-side hint only.
function estimateDeadwood(hand: string[]): number {
  // Group by rank
  const byRank: Record<string, string[]> = {};
  for (const c of hand) {
    const r = displayRank(c);
    (byRank[r] = byRank[r] || []).push(c);
  }
  // Any rank with 3+ cards → treat as meld (zero deadwood)
  const meldCards = new Set<string>();
  for (const cards of Object.values(byRank)) {
    if (cards.length >= 3) cards.forEach((c) => meldCards.add(c));
  }
  return hand
    .filter((c) => !meldCards.has(c))
    .reduce((sum, c) => sum + (RANK_VALUE[displayRank(c)] ?? 0), 0);
}

const PlayingCard: React.FC<{ card: string | null; onClick?: () => void; selected?: boolean; faceDown?: boolean; small?: boolean }> = ({ card, onClick, selected, faceDown, small }) => {
  const size = small ? "w-10 h-14" : "w-14 h-20";
  if (faceDown) {
    return <div className={`${size} bg-gradient-to-br from-emerald-800 to-teal-950 rounded-lg border border-emerald-400/40`} />;
  }
  if (!card) return null;
  const s = suitOf(card);
  const red = isRed(s);
  return (
    <motion.button
      whileHover={onClick ? { y: -8 } : {}}
      onClick={onClick}
      disabled={!onClick}
      className={`${size} bg-white rounded-lg border-2 flex flex-col items-center justify-center shadow ${red ? "text-red-600" : "text-black"} ${selected ? "ring-2 ring-yellow-400 -translate-y-2" : ""} ${onClick ? "cursor-pointer" : "opacity-80 cursor-default"}`}
    >
      <div className="text-xs font-bold">{displayRank(card)}</div>
      <div className="text-xl">{suitSymbol(s)}</div>
    </motion.button>
  );
};

export default function HttpMultiplayerGinRummy() {
  const navigate = useNavigate();
  const { gameId: urlGameId } = useParams();
  const [userId] = useState(() => localStorage.getItem("mp_user_id") || "user_" + Math.random().toString(36).slice(2, 11));
  const [userName] = useState(() => localStorage.getItem("mp_user_name") || "Player");
  const [selected, setSelected] = useState<string | null>(null);

  const { connected, gameState, isMyTurn, opponent, makeMove, leaveGame } = useHttpMultiplayer(userId, userName, urlGameId);

  const myRole: "player1" | "player2" | undefined = gameState?.my_role;
  const oppRole = myRole === "player1" ? "player2" : "player1";
  const state = gameState?.game_state as GameState | undefined;

  const myHand = (state?.[`${myRole}_hand` as keyof GameState] as string[]) || [];
  const oppCount = (state?.[`${oppRole}_hand` as keyof GameState] as string[])?.length ?? 0;
  const myDeadwood = useMemo(() => estimateDeadwood(myHand), [myHand]);

  const drawDeck = () => {
    if (!isMyTurn || !state || !myRole || state.phase !== "draw" || state.deck.length === 0) return;
    const drawn = state.deck[state.deck.length - 1];
    cardSoundManager.playCardDeal?.();
    const newState: GameState = {
      ...state,
      [`${myRole}_hand`]: [...myHand, drawn],
      deck: state.deck.slice(0, -1),
      phase: "discard",
      last_drawn: drawn,
    };
    makeMove({ type: "draw_deck" }, newState);
  };

  const drawDiscard = () => {
    if (!isMyTurn || !state || !myRole || state.phase !== "draw" || state.discard_pile.length === 0) return;
    const drawn = state.discard_pile[state.discard_pile.length - 1];
    const newState: GameState = {
      ...state,
      [`${myRole}_hand`]: [...myHand, drawn],
      discard_pile: state.discard_pile.slice(0, -1),
      phase: "discard",
      last_drawn: drawn,
    };
    makeMove({ type: "draw_discard" }, newState);
  };

  const discard = () => {
    if (!isMyTurn || !state || !myRole || state.phase !== "discard" || !selected) return;
    if (!myHand.includes(selected)) return;
    cardSoundManager.playCardSlam?.();
    const newState: GameState = {
      ...state,
      [`${myRole}_hand`]: myHand.filter((c) => c !== selected),
      discard_pile: [...state.discard_pile, selected],
      phase: "draw",
      last_drawn: null,
    };
    setSelected(null);
    makeMove({ type: "discard", card: selected }, newState);
  };

  const knock = () => {
    if (!isMyTurn || !state || !myRole) return;
    if (myDeadwood > 10) return;
    const oppHand = (state[`${oppRole}_hand` as keyof GameState] as string[]) || [];
    const oppDead = estimateDeadwood(oppHand);
    const newState: GameState = {
      ...state,
      knocked_by: myRole,
      [`${myRole}_score`]: (state[`${myRole}_score` as keyof GameState] as number) + oppDead,
    };
    makeMove({ type: "knock" }, newState);
  };

  if (!connected) {
    return <div className="min-h-[calc(100dvh-56px)] bg-gradient-to-br from-black to-emerald-950 flex items-center justify-center text-white">Waiting for opponent…</div>;
  }

  if (state?.knocked_by) {
    const myScore = state[`${myRole}_score` as keyof GameState] as number;
    const oppScore = state[`${oppRole}_score` as keyof GameState] as number;
    const iWon = myScore > oppScore;
    return (
      <WinCelebration
        won={iWon}
        gameId={urlGameId || ""}
        userId={userId}
        gameLabel="Gin Rummy"
        subtitle={`You: ${myScore} · Opponent: ${oppScore}`}
        winnerRole={iWon ? (myRole as "player1" | "player2") : (oppRole as "player1" | "player2")}
        onBack={() => navigate("/multiplayer")}
        testId="gin-game-over"
      />
    );
  }

  return (
    <div className="min-h-[calc(100dvh-56px)] bg-gradient-to-br from-black via-emerald-950 to-teal-950 text-white p-4" data-testid="gin-game">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Button data-testid="mp-gin-rummy-leave-btn" variant="ghost" size="sm" onClick={() => { leaveGame(); navigate("/multiplayer"); }}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Leave
          </Button>
          <div className="ml-auto text-xs font-mono uppercase tracking-widest text-emerald-300">
            Phase: {state?.phase} · Deadwood: {myDeadwood}
          </div>
        </div>

        <div className="text-center mb-4">
          <div className="text-xs uppercase tracking-widest text-neutral-500 mb-2">{opponent?.name || "Opponent"} · {oppCount} cards</div>
          <div className="flex justify-center gap-1">
            {Array.from({ length: Math.min(oppCount, 10) }).map((_, i) => <PlayingCard key={i} card={null} faceDown small />)}
          </div>
        </div>

        <div className="flex justify-center items-center gap-6 mb-6">
          <button
            onClick={drawDeck}
            disabled={!isMyTurn || state?.phase !== "draw" || !state?.deck.length}
            className="w-14 h-20 bg-gradient-to-br from-emerald-700 to-teal-900 rounded-lg border border-emerald-400/60 flex items-center justify-center text-[10px] font-mono uppercase tracking-widest disabled:opacity-40"
            data-testid="gin-draw-deck-btn"
          >
            Deck<br />{state?.deck.length ?? 0}
          </button>
          <button
            onClick={drawDiscard}
            disabled={!isMyTurn || state?.phase !== "draw" || !state?.discard_pile.length}
            className={`rounded-lg ${!isMyTurn || state?.phase !== "draw" ? "opacity-50" : "hover:ring-2 ring-yellow-400"}`}
            data-testid="gin-draw-discard-btn"
          >
            <PlayingCard card={state?.discard_pile[state.discard_pile.length - 1] ?? null} />
          </button>
        </div>

        <div className="text-center">
          <div className="text-xs uppercase tracking-widest text-neutral-500 mb-2">Your hand</div>
          <div className="flex justify-center flex-wrap gap-2 mb-4">
            {myHand.map((card) => (
              <PlayingCard key={card} card={card} onClick={() => setSelected(card)} selected={selected === card} />
            ))}
          </div>
          <div className="flex justify-center gap-3">
            <Button
              onClick={discard}
              disabled={!isMyTurn || state?.phase !== "discard" || !selected}
              className="bg-emerald-600 hover:bg-emerald-500"
              data-testid="gin-discard-btn"
            >
              Discard selected
            </Button>
            <Button
              onClick={knock}
              disabled={!isMyTurn || myDeadwood > 10 || state?.phase === "discard"}
              className="bg-yellow-600 hover:bg-yellow-500 text-black font-bold"
              data-testid="gin-knock-btn"
            >
              <Hand className="w-4 h-4 mr-2" /> Knock ({myDeadwood})
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
