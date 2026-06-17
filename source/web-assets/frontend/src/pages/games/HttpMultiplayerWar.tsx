/**
 * HttpMultiplayerWar — 2-player War card game over HTTP multiplayer.
 *
 * Flow:
 *  - Both players' piles are initialized server-side, each holds 26 cards.
 *  - On their turn, each player flips their top card via makeMove({type:'flip'}).
 *  - When both have flipped, higher rank takes both cards into their pile;
 *    tie → both escrow their cards into war_pile and flip again.
 *  - Winner owns all 52 cards.
 */
import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate, useParams } from "react-router-dom";
import { useHttpMultiplayer } from "@/hooks/useHttpMultiplayer";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Swords } from "lucide-react";
import cardSoundManager from "@/utils/cardSoundManager";
import WinCelebration from "@/components/games/WinCelebration";

type GameState = {
  player1_pile: string[];
  player2_pile: string[];
  player1_played: string | null;
  player2_played: string | null;
  war_pile: string[];
  last_round_winner: "player1" | "player2" | null;
  in_war: boolean;
  round_number: number;
};

const RANK_VALUE: Record<string, number> = {
  "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8,
  "9": 9, "10": 10, J: 11, Q: 12, K: 13, A: 14,
};

const displayRank = (card: string): string => {
  const r = card.slice(0, -1);
  return r === "1" ? "A" : r;
};

const suitInfo = (card: string): { symbol: string; isRed: boolean } => {
  const s = card.slice(-1);
  return { symbol: ({ H: "♥", D: "♦", C: "♣", S: "♠" } as Record<string, string>)[s] || "?", isRed: s === "H" || s === "D" };
};

const PlayingCard: React.FC<{ card: string | null; faceDown?: boolean }> = ({ card, faceDown }) => {
  if (faceDown || !card) {
    return (
      <div className="w-20 h-28 bg-gradient-to-br from-red-800 to-rose-950 rounded-xl border border-red-500/40 shadow-lg flex items-center justify-center">
        <Swords className="w-8 h-8 text-red-300/60" />
      </div>
    );
  }
  const { symbol, isRed } = suitInfo(card);
  return (
    <motion.div
      initial={{ rotateY: 180, scale: 0.8 }}
      animate={{ rotateY: 0, scale: 1 }}
      className={`w-20 h-28 bg-white rounded-xl border-2 border-neutral-800 shadow-xl flex flex-col items-center justify-center ${isRed ? "text-red-600" : "text-black"}`}
    >
      <div className="text-xl font-black">{displayRank(card)}</div>
      <div className="text-3xl">{symbol}</div>
    </motion.div>
  );
};

export default function HttpMultiplayerWar() {
  const navigate = useNavigate();
  const { gameId: urlGameId } = useParams();
  const [userId] = useState(() => localStorage.getItem("mp_user_id") || "user_" + Math.random().toString(36).slice(2, 11));
  const [userName] = useState(() => localStorage.getItem("mp_user_name") || "Player");

  const { connected, gameState, isMyTurn, opponent, makeMove, leaveGame } = useHttpMultiplayer(userId, userName, urlGameId);

  const myRole: "player1" | "player2" | undefined = gameState?.my_role;
  const oppRole: "player1" | "player2" | null = myRole === "player1" ? "player2" : myRole === "player2" ? "player1" : null;
  const state = gameState?.game_state as GameState | undefined;

  const myPile = state?.[`${myRole}_pile` as keyof GameState] as string[] | undefined;
  const oppPile = oppRole ? (state?.[`${oppRole}_pile` as keyof GameState] as string[]) : undefined;
  const myPlayed = state?.[`${myRole}_played` as keyof GameState] as string | null | undefined;
  const oppPlayed = oppRole ? (state?.[`${oppRole}_played` as keyof GameState] as string | null) : null;

  const winner = useMemo(() => {
    if (!state) return null;
    if (state.player1_pile.length === 0) return "player2";
    if (state.player2_pile.length === 0) return "player1";
    return null;
  }, [state]);

  const flip = () => {
    if (!isMyTurn || !state || winner) return;
    if (!myPile || myPile.length === 0) return;
    cardSoundManager.playCardFlip?.();
    const top = myPile[myPile.length - 1];
    const newState: GameState = {
      ...state,
      [`${myRole}_pile`]: myPile.slice(0, -1),
      [`${myRole}_played`]: top,
    } as GameState;

    // If both have played → resolve
    if (oppPlayed && myRole && oppRole) {
      const myVal = RANK_VALUE[displayRank(top)];
      const oppVal = RANK_VALUE[displayRank(oppPlayed)];
      const resolvedState = { ...newState, round_number: state.round_number + 1 };
      if (myVal > oppVal) {
        const winnings = [top, oppPlayed, ...state.war_pile];
        resolvedState[`${myRole}_pile` as keyof GameState] = [...winnings, ...(state[`${myRole}_pile` as keyof GameState] as string[]).slice(0, -1)] as never;
        resolvedState[`${myRole}_played` as keyof GameState] = null as never;
        resolvedState[`${oppRole}_played` as keyof GameState] = null as never;
        resolvedState.war_pile = [];
        resolvedState.last_round_winner = myRole as never;
        resolvedState.in_war = false;
      } else if (oppVal > myVal) {
        const winnings = [top, oppPlayed, ...state.war_pile];
        resolvedState[`${oppRole}_pile` as keyof GameState] = [...winnings, ...(state[`${oppRole}_pile` as keyof GameState] as string[])] as never;
        resolvedState[`${myRole}_pile` as keyof GameState] = myPile.slice(0, -1) as never;
        resolvedState[`${myRole}_played` as keyof GameState] = null as never;
        resolvedState[`${oppRole}_played` as keyof GameState] = null as never;
        resolvedState.war_pile = [];
        resolvedState.last_round_winner = oppRole as never;
        resolvedState.in_war = false;
      } else {
        // TIE — WAR!
        resolvedState.war_pile = [...state.war_pile, top, oppPlayed];
        resolvedState[`${myRole}_played` as keyof GameState] = null as never;
        resolvedState[`${oppRole}_played` as keyof GameState] = null as never;
        resolvedState.in_war = true;
      }
      makeMove({ type: "flip_resolve" }, resolvedState);
    } else {
      makeMove({ type: "flip" }, newState);
    }
  };

  if (!connected) {
    return (
      <div className="min-h-[calc(100dvh-56px)] bg-gradient-to-br from-black via-red-950 to-black flex items-center justify-center text-white">
        <div className="text-center">
          <Swords className="w-12 h-12 mx-auto mb-4 animate-pulse text-red-400" /> {/* audit:allow-animate */}
          <p>Waiting for opponent...</p>
        </div>
      </div>
    );
  }

  if (winner) {
    const iWon = winner === myRole;
    return (
      <WinCelebration
        won={iWon}
        gameId={urlGameId || ""}
        userId={userId}
        gameLabel="War"
        subtitle={`Final round: ${state?.round_number ?? 0}`}
        winnerRole={winner as "player1" | "player2"}
        onBack={() => navigate("/multiplayer")}
        testId="war-game-over"
      />
    );
  }

  return (
    <div className="min-h-[calc(100dvh-56px)] bg-gradient-to-br from-black via-red-950 to-black text-white p-4" data-testid="war-game">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Button data-testid="mp-war-leave-btn" variant="ghost" size="sm" onClick={() => { leaveGame(); navigate("/multiplayer"); }}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Leave
          </Button>
          <div className="ml-auto text-xs font-mono uppercase tracking-widest text-red-300">
            Round {state?.round_number ?? 0} {state?.in_war && <span className="ml-2 text-yellow-300 animate-pulse">· WAR!</span>}
          </div>
        </div>

        {/* Opponent pile */}
        <div className="text-center mb-8">
          <div className="text-xs uppercase tracking-widest text-neutral-500 mb-2">{opponent?.name || "Opponent"} · {oppPile?.length ?? 0} cards</div>
          <div className="inline-flex items-center gap-4">
            <PlayingCard card={null} faceDown />
            <div className="text-xl font-black">↓</div>
            <PlayingCard card={oppPlayed ?? null} faceDown={!oppPlayed} />
          </div>
        </div>

        {/* War pile */}
        {state && state.war_pile.length > 0 && (
          <div className="text-center mb-8">
            <div className="text-[10px] uppercase tracking-widest text-yellow-300">Escrowed · {state.war_pile.length} cards</div>
          </div>
        )}

        {/* Your area */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-4 mb-6">
            <PlayingCard card={null} faceDown />
            <div className="text-xl font-black">↑</div>
            <PlayingCard card={myPlayed ?? null} faceDown={!myPlayed} />
          </div>
          <div className="text-xs uppercase tracking-widest text-neutral-500 mb-3">You · {myPile?.length ?? 0} cards</div>
          <Button
            onClick={flip}
            disabled={!isMyTurn || Boolean(myPlayed) || !myPile || myPile.length === 0}
            className="bg-red-600 hover:bg-red-500 text-white font-black uppercase tracking-widest px-8"
            data-testid="war-flip-btn"
          >
            <Swords className="w-4 h-4 mr-2" />
            {myPlayed ? "Waiting for opponent..." : isMyTurn ? "Flip Card" : "Not your turn"}
          </Button>
        </div>
      </div>
    </div>
  );
}
