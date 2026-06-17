/**
 * Turn Manager
 * Handles turn order logic for multiplayer games
 */

/**
 * Simple 2-player turn toggle
 */
export const toggleTurn = (currentTurn) => {
  return currentTurn === 'player1' ? 'player2' : 'player1';
};

/**
 * Multi-player turn rotation
 */
export const rotateTurn = (players, currentPlayer) => {
  const currentIndex = players.indexOf(currentPlayer);
  const nextIndex = (currentIndex + 1) % players.length;
  return players[nextIndex];
};

/**
 * Check if it's a specific player's turn
 */
export const isPlayerTurn = (gameState, playerId) => {
  return gameState.current_turn === playerId;
};
