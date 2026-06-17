// Multiplayer Game State Manager
// Handles game initialization and state management for multiplayer games

export class MultiplayerGameStateManager {
  constructor(gameType, multiplayerManager) {
    this.gameType = gameType;
    this.multiplayerManager = multiplayerManager;
    this.gameState = this.initializeGame(gameType);
  }

  initializeGame(gameType) {
    const baseState = {
      game_type: gameType,
      status: 'active',
      current_turn: 'player',
      winner: null
    };

    switch (gameType) {
      case 'tictactoe':
        return {
          ...baseState,
          game_state: {
            board: ['', '', '', '', '', '', '', '', '']
          }
        };

      case 'connect4':
        return {
          ...baseState,
          game_state: {
            board: Array(6).fill().map(() => Array(7).fill(''))
          }
        };

      case 'chess':
        return {
          ...baseState,
          game_state: {
            fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
            board: []
          }
        };

      case 'checkers':
        return {
          ...baseState,
          game_state: {
            board: this.initializeCheckersBoard()
          }
        };

      case 'reversi':
        return {
          ...baseState,
          game_state: {
            board: this.initializeReversiBoard()
          }
        };

      case 'uno':
        return {
          ...baseState,
          game_state: {
            player_hand: [],
            top_card: '5R',
            direction: 1,
            ai_hand_count: 7
          }
        };

      case 'poker':
        return {
          ...baseState,
          game_state: {
            player_hand: [],
            community_cards: [],
            pot: 100,
            current_bet: 10,
            phase: 'preflop'
          }
        };

      case 'blackjack':
        return {
          ...baseState,
          game_state: {
            player_hand: [],
            dealer_hand: [],
            player_total: 0,
            dealer_total: 0
          }
        };

      case 'hearts':
        return {
          ...baseState,
          game_state: {
            player_hand: [],
            current_trick: [],
            player_score: 0,
            ai_score: 0
          }
        };

      case 'crazy_eights':
      case 'go_fish':
        return {
          ...baseState,
          game_state: {
            player_hand: [],
            top_card: null,
            ai_hand_count: 7
          }
        };

      default:
        return baseState;
    }
  }

  initializeCheckersBoard() {
    const board = Array(8).fill().map(() => Array(8).fill(null));
    
    // Place black pieces (AI) on top 3 rows
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 8; col++) {
        if ((row + col) % 2 === 1) {
          board[row][col] = { player: 'ai', king: false };
        }
      }
    }
    
    // Place red pieces (player) on bottom 3 rows
    for (let row = 5; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        if ((row + col) % 2 === 1) {
          board[row][col] = { player: 'player', king: false };
        }
      }
    }
    
    return board;
  }

  initializeReversiBoard() {
    const board = Array(8).fill().map(() => Array(8).fill(''));
    
    // Initial 4 pieces in center
    board[3][3] = 'player';
    board[3][4] = 'ai';
    board[4][3] = 'ai';
    board[4][4] = 'player';
    
    return board;
  }

  getState() {
    return this.gameState;
  }

  updateState(newState) {
    this.gameState = { ...this.gameState, ...newState };
    return this.gameState;
  }

  applyMove(move, player) {
    // Apply move based on game type
    const gameState = this.gameState.game_state;

    switch (this.gameType) {
      case 'tictactoe':
        if (move.position !== undefined) {
          gameState.board[move.position] = player === 'player' ? 'X' : 'O';
        }
        break;

      case 'connect4':
        if (move.column !== undefined) {
          const col = move.column;
          for (let row = 5; row >= 0; row--) {
            if (!gameState.board[row][col]) {
              gameState.board[row][col] = player === 'player' ? 'red' : 'yellow';
              break;
            }
          }
        }
        break;

      case 'chess':
        if (move.from && move.to) {
          gameState.lastMove = move;
          // Chess move application is handled by chess library
        }
        break;

      // Add more game-specific move logic here
      default:
    }

    // Toggle turn
    this.gameState.current_turn = this.gameState.current_turn === 'player' ? 'ai' : 'player';

    return this.gameState;
  }

  checkWinCondition() {
    const gameState = this.gameState.game_state;

    switch (this.gameType) {
      case 'tictactoe':
        return this.checkTicTacToeWin(gameState.board);

      case 'connect4':
        return this.checkConnect4Win(gameState.board);

      // Add more win condition checks
      default:
        return null;
    }
  }

  checkTicTacToeWin(board) {
    const winPatterns = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
      [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
      [0, 4, 8], [2, 4, 6] // diagonals
    ];

    for (const pattern of winPatterns) {
      const [a, b, c] = pattern;
      if (board[a] && board[a] === board[b] && board[a] === board[c]) {
        return board[a] === 'X' ? 'player' : 'ai';
      }
    }

    if (board.every(cell => cell !== '')) {
      return 'draw';
    }

    return null;
  }

  checkConnect4Win(board) {
    // Check horizontal, vertical, and diagonal wins
    const checkLine = (cells) => {
      for (let i = 0; i < cells.length - 3; i++) {
        const first = cells[i];
        if (first && cells[i+1] === first && cells[i+2] === first && cells[i+3] === first) {
          return first === 'red' ? 'player' : 'ai';
        }
      }
      return null;
    };

    // Check rows
    for (const row of board) {
      const winner = checkLine(row);
      if (winner) return winner;
    }

    // Check columns
    for (let col = 0; col < 7; col++) {
      const column = board.map(row => row[col]);
      const winner = checkLine(column);
      if (winner) return winner;
    }

    // Check diagonals (simplified)
    // ... (add diagonal checking logic)

    return null;
  }
}
