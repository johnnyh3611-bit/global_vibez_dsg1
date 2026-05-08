/**
 * CHECKERS Game Logic (with Tower Stacking)
 * Implements traditional checkers rules + tower stacking mechanic
 * Based on UE5 FCheckerTower architecture
 */
import { GameLogic } from '../GameLogic';

export class CheckersLogic extends GameLogic {
  /**
   * Validate if a move is legal
   * Handles: regular moves, jumps, multiple jumps, king moves
   */
  validateMove(state, action) {
    const { from, to, playerId } = action.payload;
    
    // Parse board position
    const fromPos = this.parsePosition(from);
    const toPos = this.parsePosition(to);
    
    if (!fromPos || !toPos) {
      return { valid: false, reason: "Invalid board position" };
    }

    // Get piece at position
    const piece = state.board[fromPos.row]?.[fromPos.col];
    
    if (!piece || piece.owner !== playerId) {
      return { valid: false, reason: "No piece or not your piece" };
    }

    // Check if move is diagonal
    const rowDiff = Math.abs(toPos.row - fromPos.row);
    const colDiff = Math.abs(toPos.col - fromPos.col);
    
    if (rowDiff !== colDiff) {
      return { valid: false, reason: "Must move diagonally" };
    }

    // Check if destination is empty
    const destPiece = state.board[toPos.row]?.[toPos.col];
    if (destPiece) {
      return { valid: false, reason: "Destination occupied" };
    }

    // Regular move (1 square) or Jump (2 squares)
    if (rowDiff === 1) {
      // Regular move - check direction based on piece type
      if (!this.isValidDirection(piece, fromPos, toPos)) {
        return { valid: false, reason: "Wrong direction for non-king" };
      }

      // Check for forced jumps
      const availableJumps = this.getAvailableJumps(state, playerId);
      if (availableJumps.length > 0) {
        return { valid: false, reason: "Must jump when possible" };
      }

      return { valid: true };
    }
    
    if (rowDiff === 2) {
      // Jump move - validate jump
      return this.validateJump(state, fromPos, toPos, piece);
    }

    return { valid: false, reason: "Invalid move distance" };
  }

  /**
   * Validate jump move
   */
  validateJump(state, fromPos, toPos, piece) {
    const midRow = (fromPos.row + toPos.row) / 2;
    const midCol = (fromPos.col + toPos.col) / 2;
    
    const jumpedPiece = state.board[midRow]?.[midCol];
    
    if (!jumpedPiece) {
      return { valid: false, reason: "No piece to jump" };
    }

    if (jumpedPiece.owner === piece.owner) {
      return { valid: false, reason: "Cannot jump own piece" };
    }

    // Check direction for non-kings
    if (!this.isValidDirection(piece, fromPos, toPos)) {
      return { valid: false, reason: "Wrong direction for non-king" };
    }

    return { valid: true, captured: { row: midRow, col: midCol } };
  }

  /**
   * Check if move direction is valid for piece type
   */
  isValidDirection(piece, fromPos, toPos) {
    if (piece.isKing) {
      return true; // Kings can move in all diagonal directions
    }

    // Red pieces move down (increasing row)
    if (piece.owner === 'player1') {
      return toPos.row > fromPos.row;
    }
    
    // Black pieces move up (decreasing row)
    if (piece.owner === 'player2') {
      return toPos.row < fromPos.row;
    }

    return false;
  }

  /**
   * Get all available jumps for a player (for forced jump rule)
   */
  getAvailableJumps(state, playerId) {
    const jumps = [];
    
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = state.board[row]?.[col];
        if (piece && piece.owner === playerId) {
          const pieceJumps = this.getPieceJumps(state, { row, col }, piece);
          jumps.push(...pieceJumps);
        }
      }
    }
    
    return jumps;
  }

  /**
   * Get available jumps for a specific piece
   */
  getPieceJumps(state, pos, piece) {
    const jumps = [];
    const directions = piece.isKing 
      ? [[-2, -2], [-2, 2], [2, -2], [2, 2]]  // Kings can jump all directions
      : piece.owner === 'player1' 
        ? [[2, -2], [2, 2]]  // Red jumps down
        : [[-2, -2], [-2, 2]];  // Black jumps up

    for (const [dRow, dCol] of directions) {
      const toRow = pos.row + dRow;
      const toCol = pos.col + dCol;
      const midRow = pos.row + dRow / 2;
      const midCol = pos.col + dCol / 2;

      if (toRow >= 0 && toRow < 8 && toCol >= 0 && toCol < 8) {
        const destPiece = state.board[toRow]?.[toCol];
        const midPiece = state.board[midRow]?.[midCol];

        if (!destPiece && midPiece && midPiece.owner !== piece.owner) {
          jumps.push({ from: pos, to: { row: toRow, col: toCol } });
        }
      }
    }

    return jumps;
  }

  /**
   * Parse position string (e.g., "A1" -> {row: 0, col: 0})
   */
  parsePosition(posStr) {
    if (!posStr || posStr.length < 2) return null;
    
    const col = posStr.charCodeAt(0) - 65; // A=0, B=1, etc.
    const row = parseInt(posStr.slice(1)) - 1; // 1=0, 2=1, etc.
    
    if (col < 0 || col > 7 || row < 0 || row > 7) return null;
    
    return { row, col };
  }

  /**
   * Format position ({row, col} -> "A1")
   */
  formatPosition(pos) {
    return String.fromCharCode(65 + pos.col) + (pos.row + 1);
  }

  /**
   * Calculate win condition
   */
  calculateWin(state) {
    let player1Pieces = 0;
    let player2Pieces = 0;
    let player1CanMove = false;
    let player2CanMove = false;

    // Count pieces and check for available moves
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = state.board[row]?.[col];
        if (piece) {
          if (piece.owner === 'player1') {
            player1Pieces++;
            if (!player1CanMove && this.canPieceMove(state, { row, col }, piece)) {
              player1CanMove = true;
            }
          } else if (piece.owner === 'player2') {
            player2Pieces++;
            if (!player2CanMove && this.canPieceMove(state, { row, col }, piece)) {
              player2CanMove = true;
            }
          }
        }
      }
    }

    // Win conditions: opponent has no pieces or no legal moves
    if (player2Pieces === 0 || !player2CanMove) {
      return { winner: 'player1', reason: 'Opponent eliminated/blocked' };
    }
    
    if (player1Pieces === 0 || !player1CanMove) {
      return { winner: 'player2', reason: 'Opponent eliminated/blocked' };
    }

    return null;
  }

  /**
   * Check if a piece can move
   */
  canPieceMove(state, pos, piece) {
    const directions = piece.isKing
      ? [[-1, -1], [-1, 1], [1, -1], [1, 1], [-2, -2], [-2, 2], [2, -2], [2, 2]]
      : piece.owner === 'player1'
        ? [[1, -1], [1, 1], [2, -2], [2, 2]]
        : [[-1, -1], [-1, 1], [-2, -2], [-2, 2]];

    for (const [dRow, dCol] of directions) {
      const toRow = pos.row + dRow;
      const toCol = pos.col + dCol;

      if (toRow >= 0 && toRow < 8 && toCol >= 0 && toCol < 8) {
        const destPiece = state.board[toRow]?.[toCol];
        
        if (!destPiece) {
          // For jumps, check if there's a piece to jump
          if (Math.abs(dRow) === 2) {
            const midRow = pos.row + dRow / 2;
            const midCol = pos.col + dCol / 2;
            const midPiece = state.board[midRow]?.[midCol];
            if (midPiece && midPiece.owner !== piece.owner) {
              return true;
            }
          } else {
            return true;
          }
        }
      }
    }

    return false;
  }

  /**
   * Process move and update game state
   * Implements TOWER STACKING mechanic
   */
  processMove(state, action) {
    const { from, to } = action.payload;
    const fromPos = this.parsePosition(from);
    const toPos = this.parsePosition(to);
    
    const newBoard = state.board.map(row => [...row]);
    const piece = newBoard[fromPos.row][fromPos.col];
    
    // Check if this is a jump (capture)
    const rowDiff = Math.abs(toPos.row - fromPos.row);
    if (rowDiff === 2) {
      // TOWER STACKING: Capture mechanic
      const midRow = (fromPos.row + toPos.row) / 2;
      const midCol = (fromPos.col + toPos.col) / 2;
      const capturedPiece = newBoard[midRow][midCol];
      
      // Add captured piece to BOTTOM of attacker's stack
      const newStack = [capturedPiece.color, ...(piece.stack || [piece.color])];
      piece.stack = newStack;
      
      // Remove captured piece from board
      newBoard[midRow][midCol] = null;
    }

    // Move piece to new position
    newBoard[toPos.row][toPos.col] = piece;
    newBoard[fromPos.row][fromPos.col] = null;

    // Check for king promotion
    if (!piece.isKing) {
      if ((piece.owner === 'player1' && toPos.row === 7) ||
          (piece.owner === 'player2' && toPos.row === 0)) {
        piece.isKing = true;
      }
    }

    return {
      ...state,
      board: newBoard,
      lastMove: { from, to }
    };
  }

  /**
   * Initialize standard checkers board
   */
  static initializeBoard() {
    const board = Array(8).fill(null).map(() => Array(8).fill(null));
    
    // Place red pieces (player1) - rows 0-2
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 8; col++) {
        if ((row + col) % 2 === 1) {
          board[row][col] = {
            owner: 'player1',
            color: 'red',
            isKing: false,
            stack: ['red']  // Tower stack
          };
        }
      }
    }

    // Place black pieces (player2) - rows 5-7
    for (let row = 5; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        if ((row + col) % 2 === 1) {
          board[row][col] = {
            owner: 'player2',
            color: 'black',
            isKing: false,
            stack: ['black']  // Tower stack
          };
        }
      }
    }

    return board;
  }
}
