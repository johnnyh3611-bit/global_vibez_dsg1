/**
 * Win Condition Patterns
 * Reusable win detection logic for different game types
 */

/**
 * LINEAR MATCH - Check rows, columns, diagonals for matching IDs
 * Used by: TicTacToe, Connect4
 */
export const checkLinearMatch = (board, patterns, targetCount = 3) => {
  for (const pattern of patterns) {
    const cells = pattern.map(index => board[index]);
    
    // Check if all cells in pattern are filled and match
    if (cells.length >= targetCount && cells.every(cell => cell && cell === cells[0])) {
      return { winner: cells[0], pattern };
    }
  }
  return null;
};

/**
 * INVENTORY ZERO - Trigger win when player hand/inventory is empty
 * Used by: Uno, Spades, GoFish, Rummy
 */
export const checkInventoryZero = (state, playerKey) => {
  const playerHand = state[`${playerKey}_hand`] || state.hands?.[playerKey];
  
  if (playerHand && playerHand.length === 0) {
    return { winner: playerKey, reason: 'Emptied hand' };
  }
  return null;
};

/**
 * TARGET SCORE - Trigger win when score reaches threshold
 * Used by: Trivia, Dominoes, Mahjong
 */
export const checkTargetScore = (state, threshold = 100) => {
  const scores = state.player_scores || state.scores;
  
  if (!scores) return null;

  for (const [player, score] of Object.entries(scores)) {
    if (score >= threshold) {
      return { winner: player, reason: `Reached ${score} points`, score };
    }
  }
  return null;
};

/**
 * BOARD CAPTURE - Win by capturing all opponent pieces
 * Used by: Checkers, Chess (checkmate), Carrom
 */
export const checkBoardCapture = (state, player1Key, player2Key) => {
  const player1Pieces = state[`${player1Key}_pieces`] || 0;
  const player2Pieces = state[`${player2Key}_pieces`] || 0;

  if (player1Pieces === 0) {
    return { winner: player2Key, reason: 'Captured all opponent pieces' };
  }
  if (player2Pieces === 0) {
    return { winner: player1Key, reason: 'Captured all opponent pieces' };
  }
  return null;
};

/**
 * TRICK COUNT - Win by collecting most tricks/books
 * Used by: Spades, Hearts
 */
export const checkTrickCount = (state, targetTricks = 13) => {
  const player1Tricks = state.player1_tricks || 0;
  const player2Tricks = state.player2_tricks || 0;
  const totalTricks = player1Tricks + player2Tricks;

  // Check if all tricks have been played
  if (totalTricks >= targetTricks) {
    if (player1Tricks > player2Tricks) {
      return { winner: 'player1', reason: `Won ${player1Tricks} tricks`, tricks: player1Tricks };
    } else if (player2Tricks > player1Tricks) {
      return { winner: 'player2', reason: `Won ${player2Tricks} tricks`, tricks: player2Tricks };
    } else {
      return { winner: 'draw', reason: 'Tied tricks' };
    }
  }
  return null;
};

/**
 * DRAW DETECTION - Check for stalemate/draw conditions
 */
export const checkDraw = (board, emptyValue = null) => {
  // Board is full but no winner
  const isFull = board.every(cell => cell !== emptyValue);
  if (isFull) {
    return { winner: 'draw', reason: 'Board full - Draw' };
  }
  return null;
};
