import React from 'react';
import { useParams, Navigate } from 'react-router-dom';
import MultiplayerTicTacToe from './MultiplayerTicTacToe';
import MultiplayerConnect4 from './MultiplayerConnect4';

/**
 * Router component that directs to the appropriate multiplayer game
 * based on the game type parameter
 */
export default function MultiplayerGameRouter() {
  const { gameType, roomCode } = useParams();

  // Map game types to components
  const gameComponents = {
    'tictactoe': MultiplayerTicTacToe,
    'connect4': MultiplayerConnect4,
    // Add more games as they're implemented
    // 'chess': MultiplayerChess,
    // 'uno': MultiplayerUNO,
    // 'trivia': MultiplayerTrivia,
  };

  const GameComponent = gameComponents[gameType];

  if (!GameComponent) {
    // Unknown game type, redirect to lobby
    return <Navigate to="/multiplayer" replace />;
  }

  return <GameComponent />;
}
