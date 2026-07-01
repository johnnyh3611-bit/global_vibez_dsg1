/**
 * HttpMultiplayerCrazyEights — proto-UNO for 2 players.
 *
 * Rules:
 *   - Match the top card by suit OR rank
 *   - 8s are wild — player chooses next suit
 *   - If you can't play, draw from deck. If still no play, pass.
 *   - First to empty hand wins.
 */
import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate, useParams } from "react-router-dom";
import { useHttpMultiplayer } from "@/hooks/useHttpMultiplayer";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import cardSoundManager from "@/utils/cardSoundManager";
import WinCelebration from "@/components/games/WinCelebration";

type GameState = {
  player1_hand: string[];
  player2_hand: string[];
  deck: string[];
  discard_pile: string[];
  top_card: string;
  active_suit: string;   // H/D/C/S
  wild_suit: string | null;
};

const displayRank = (card: string): string => {
  const r = card.slice(0, -1);
  return r;
};
const suitOf = (card: string): string => card.slice(-1);
const suitSymbol = (s: string): string => ({ H: "♥", D: "♦", C: "♣", S: "♠" } as Record<string, string>)[s] || "?";
const isRed = (s: string): boolean => s === "H" || s === "D";

const PlayingCard: React.FC<{ card: string | null; onClick?: () => void; highlight?: boolean; faceDown?: boolean }> = ({ card, onClick, highlight, faceDown }) => {
  if (faceDown) {
    return <div className="w-14 h-20 bg-gradient-to-br from-indigo-800 to-violet-950 rounded-lg border border-indigo-400/40" />;
  }
  if (!card) return null;
  const s = suitOf(card);
  const red = isRed(s);
  return (
    <motion.button
      whileHover={onClick ? { y: -8 } : {}}
      onClick={onClick}
      disabled={!onClick}
      className={`w-14 h-20 bg-white rounded-lg border-2 flex flex-col items-center justify-center shadow ${red ? "text-red-600" : "text-black"} ${highlight ? "ring-2 ring-yellow-400" : ""} ${onClick ? "cursor-pointer" : "opacity-70 cursor-default"}`}
    >
      <div className="text-sm font-bold">{displayRank(card)}</div>
      <div className="text-2xl">{suitSymbol(s)}</div>
    </motion.button>
  );
};

export default function HttpMultiplayerCrazyEights() {
  const navigate = useNavigate();
  const { gameId: urlGameId } = useParams();
  const [userId] = useState(() => localStorage.getItem("mp_user_id") || "user_" + Math.random().toString(36).slice(2, 11));
  const [userName] = useState(() => localStorage.getItem("mp_user_name") || "Player");

  const { connected, gameState, isMyTurn, opponent, makeMove, leaveGame } = useHttpMultiplayer(userId, userName, urlGameId);

  const [wildPending, setWildPending] = useState<string | null>(null); // card id when user must pick suit

  const myRole: "player1" | "player2" | undefined = gameState?.my_role;
  const oppRole = myRole === "player1" ? "player2" : "player1";
  const state = gameState?.game_state as GameState | undefined;

  const myHand = (state?.[`${myRole}_hand` as keyof GameState] as string[]) || [];
  const oppHandCount = (state?.[`${oppRole}_hand` as keyof GameState] as string[])?.length ?? 0;
  const activeSuit = state?.wild_suit || state?.active_suit;

  const canPlay = (card: string): boolean => {
    if (!state) return false;
    if (displayRank(card) === "8") return true;
    return suitOf(card) === activeSuit || displayRank(card) === displayRank(state.top_card);
  };

  const winner = useMemo(() => {
    if (!state) return null;
    if ((state.player1_hand || []).length === 0) return "player1";
    if ((state.player2_hand || []).length === 0) return "player2";
    return null;
  }, [state]);

  const playCard = (card: string, chosenSuit: string | null = null) => {
    if (!isMyTurn || !state || !myRole) return;
    if (!canPlay(card)) return;
    const isEight = displayRank(card) === "8";
    if (isEight && !chosenSuit) {
      setWildPending(card);
      return;
    }
    const newHand = myHand.filter((c) => c !== card);
    const newState: GameState = {
      ...state,
      [`${myRole}_hand`]: newHand,
      discard_pile: [...state.discard_pile, card],
      top_card: card,
      active_suit: isEight ? (chosenSuit as string) : suitOf(card),
      wild_suit: isEight ? (chosenSuit as string) : null,
    };
    setWildPending(null);
    cardSoundManager.playCardSlam?.();
    makeMove({ type: "play", card, suit: chosenSuit }, newState);
  };

  const drawCard = () => {
    if (!isMyTurn || !state || !myRole) return;
    if (state.deck.length === 0) return;
    const drawn = state.deck[state.deck.length - 1];
    cardSoundManager.playCardDeal?.();
    const newState: GameState = {
      ...state,
      [`${myRole}_hand`]: [...myHand, drawn],
      deck: state.deck.slice(0, -1),
    };
    makeMove({ type: "draw" }, newState);
  };

  if (!connected) {
    return <div className="min-h-[calc(100dvh-56px)] bg-gradient-to-br from-black to-indigo-950 flex items-center justify-center text-white">Waiting for opponent…</div>;
  }

  if (winner) {
    const iWon = winner === myRole;
    return (
      <WinCelebration
        won={iWon}
        gameId={urlGameId || ""}
        userId={userId}
        gameLabel="Crazy Eights"
        winnerRole={winner as "player1" | "player2"}
        onBack={() => navigate("/multiplayer")}
        testId="crazyeights-game-over"
      />
    );
  }

  return (
    <div className="min-h-[calc(100dvh-56px)] bg-gradient-to-br from-black via-indigo-950 to-violet-950 text-white p-4" data-testid="crazyeights-game">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Button data-testid="mp-crazy-eights-leave-btn" variant="ghost" size="sm" onClick={() => { leaveGame(); navigate("/multiplayer"); }}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Leave
          </Button>
          <div className="ml-auto text-xs font-mono uppercase tracking-widest text-indigo-300">
            Active suit: {suitSymbol(activeSuit || "")}
          </div>
        </div>

        {/* Opponent */}
        <div className="text-center mb-6">
          <div className="text-xs uppercase tracking-widest text-neutral-500 mb-2">{opponent?.name || "Opponent"} · {oppHandCount} cards</div>
          <div className="flex justify-center gap-1">
            {Array.from({ length: Math.min(oppHandCount, 10) }).map((_, i) => <PlayingCard key={i} card={null} faceDown />)}
          </div>
        </div>

        {/* Center — deck + discard */}
        <div className="flex justify-center items-center gap-6 mb-6">
          <button
            onClick={drawCard}
            disabled={!isMyTurn || !state || state.deck.length === 0}
            className="w-16 h-24 bg-gradient-to-br from-indigo-700 to-violet-900 rounded-lg border border-indigo-400/60 flex items-center justify-center text-xs font-mono uppercase tracking-widest disabled:opacity-40"
            data-testid="crazyeights-draw-btn"
          >
            Draw<br />{state?.deck.length ?? 0}
          </button>
          <PlayingCard card={state?.top_card ?? null} />
        </div>

        {/* Wild suit picker */}
        {wildPending && (
          <div className="mb-6 text-center" data-testid="crazyeights-wild-picker">
            <div className="text-sm mb-2">Pick a suit:</div>
            <div className="inline-flex gap-2">
              {["H", "D", "C", "S"].map((s) => (
                <button
                  key={s}
                  onClick={() => playCard(wildPending, s)}
                  data-testid={`crazyeights-wild-suit-${s}`}
                  aria-label={`Choose ${s} suit`}
                  className={`w-12 h-12 rounded-lg bg-white ${isRed(s) ? "text-red-600" : "text-black"} text-2xl font-bold`}
                >
                  {suitSymbol(s)}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* My hand */}
        <div className="text-center">
          <div className="text-xs uppercase tracking-widest text-neutral-500 mb-2">Your hand · {isMyTurn ? <span className="text-yellow-300">Your turn</span> : "waiting"}</div>
          <div className="flex justify-center flex-wrap gap-2">
            {myHand.map((card) => (
              <PlayingCard
                key={card}
                card={card}
                onClick={() => playCard(card)}
                highlight={isMyTurn && canPlay(card)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
