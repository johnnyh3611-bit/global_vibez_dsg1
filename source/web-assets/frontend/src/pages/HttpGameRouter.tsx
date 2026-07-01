import React from 'react';
import { useParams, Navigate } from 'react-router-dom';
import MatrixTicTacToe from './games/MatrixTicTacToe';
import HttpMultiplayerConnect4 from './games/HttpMultiplayerConnect4';
import HttpMultiplayerChess from './games/HttpMultiplayerChess';
import HttpMultiplayerTrivia from './games/HttpMultiplayerTrivia';
import HttpMultiplayerPoker from './games/HttpMultiplayerPoker';
import HttpMultiplayerTruthOrDare from './games/HttpMultiplayerTruthOrDare';
import HttpMultiplayerCheckers from './games/HttpMultiplayerCheckers';
import HttpMultiplayerBlackjack from './games/HttpMultiplayerBlackjack';
// Spades / Hearts / Rummy / Gin Rummy / War / Go Fish / Crazy Eights / Euchre /
// Pinochle route to the canonical AAA rooms (unified Feb 2026). The individual
// HttpMultiplayer* files for those games remain on disk but are no longer
// mounted — they'll be deleted in a follow-up cleanup pass.
import HttpMultiplayerLudo from './games/HttpMultiplayerLudo';
import HttpMultiplayerDominoes from './games/HttpMultiplayerDominoes';
import HttpMultiplayerMancala from './games/HttpMultiplayerMancala';
import HttpMultiplayerBackgammon from './games/HttpMultiplayerBackgammon';
import HttpMultiplayerChineseCheckers from './games/HttpMultiplayerChineseCheckers';
import HttpMultiplayerParcheesi from './games/HttpMultiplayerParcheesi';
import HttpMultiplayerMahjong from './games/HttpMultiplayerMahjong';
import HttpMultiplayerCarrom from './games/HttpMultiplayerCarrom';
import HttpMultiplayerShogi from './games/HttpMultiplayerShogi';
import HttpMultiplayerXiangqi from './games/HttpMultiplayerXiangqi';
import ComingSoonOverlay from '@/components/games/ComingSoonOverlay';
import HttpRoomShell from './HttpRoomShell';
import { isComingSoon } from '@/data/comingSoonGames';

export default function HttpGameRouter() {
  const { gameType } = useParams();

  // COMING SOON gate — applies to multiplayer routes too. Renders the
  // overlay instead of mounting the (potentially incomplete) MP page.
  if (isComingSoon(gameType)) {
    return <ComingSoonOverlay gameName={gameType ?? "This game"} testId={`coming-soon-${gameType}`} />;
  }

  // Resolve the inner game component first so we can wrap every render
  // with the shared HttpRoomShell (unified RoomMenuBar — Feb 6 2026).
  const inner = ((): React.ReactNode => {
    if (gameType === 'tictactoe') return <MatrixTicTacToe />;
    if (gameType === 'connect4') return <HttpMultiplayerConnect4 />;
    if (gameType === 'chess') return <HttpMultiplayerChess />;
    if (gameType === 'trivia') return <HttpMultiplayerTrivia />;
    // UNO lives on the Socket.IO multiplayer page now; redirect stale HTTP path.
    if (gameType === 'uno') return <Navigate to="/multiplayer-uno" replace />;
    if (gameType === 'poker') return <HttpMultiplayerPoker />;
    // AAA canonical card rooms — stale HttpMultiplayer* pages redirect to the
    // universal prototype (Feb 2026 unification pass).
    if (gameType === 'hearts') return <Navigate to="/hearts" replace />;
    if (gameType === 'rummy') return <Navigate to="/rummy" replace />;
    if (gameType === 'gin_rummy' || gameType === 'ginrummy') return <Navigate to="/gin-rummy" replace />;
    if (gameType === 'war') return <Navigate to="/war" replace />;
    if (gameType === 'gofish') return <Navigate to="/go-fish" replace />;
    if (gameType === 'crazy_eights' || gameType === 'crazyeights') return <Navigate to="/crazy-eights" replace />;
    if (gameType === 'euchre') return <Navigate to="/euchre" replace />;
    if (gameType === 'pinochle') return <Navigate to="/pinochle" replace />;
    if (gameType === 'truthordare') return <HttpMultiplayerTruthOrDare />;
    if (gameType === 'checkers') return <HttpMultiplayerCheckers />;
    if (gameType === 'blackjack') return <HttpMultiplayerBlackjack />;
    if (gameType === 'spades') return <Navigate to="/spades" replace />;
    if (gameType === 'ludo') return <HttpMultiplayerLudo />;
    // Dominoes has a canonical AAA room (/dominoes) — unify (Feb 6 2026).
    if (gameType === 'dominoes') return <Navigate to="/dominoes" replace />;
    if (gameType === 'mancala') return <HttpMultiplayerMancala />;
    if (gameType === 'backgammon') return <HttpMultiplayerBackgammon />;
    if (gameType === 'chinesecheckers') return <HttpMultiplayerChineseCheckers />;
    if (gameType === 'parcheesi') return <HttpMultiplayerParcheesi />;
    if (gameType === 'mahjong') return <HttpMultiplayerMahjong />;
    if (gameType === 'carrom') return <HttpMultiplayerCarrom />;
    if (gameType === 'shogi') return <HttpMultiplayerShogi />;
    if (gameType === 'xiangqi') return <HttpMultiplayerXiangqi />;
    return null;
  })();

  if (!inner) {
    // Unknown game, redirect to lobby
    return <Navigate to="/http-multiplayer" replace />;
  }

  // <Navigate> elements never need wrapping (they unmount immediately).
  if (React.isValidElement(inner) && inner.type === Navigate) {
    return inner;
  }

  return <HttpRoomShell gameType={gameType ?? 'unknown'}>{inner}</HttpRoomShell>;
}
