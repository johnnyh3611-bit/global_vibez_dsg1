/**
 * Specific Rules Registry
 * Maps game types to their logic implementations
 */
import { SpadesLogic } from './rules/SpadesLogic';
import { UnoLogic } from './rules/UnoLogic';
import { CheckersLogic } from './rules/CheckersLogic';
import { GameLogic } from './GameLogic';

// ============== FULLY IMPLEMENTED GAMES ==============

const spadesLogic = new SpadesLogic();
const unoLogic = new UnoLogic();
const checkersLogic = new CheckersLogic();

// ============== STUB IMPLEMENTATIONS ==============
// These will be implemented one-by-one

class StubLogic extends GameLogic {
  constructor(gameName) {
    super();
    this.gameName = gameName;
  }

  validateMove(state, action) {
    // Default: allow all moves (will be implemented per-game)

    return { valid: true };
  }

  calculateWin(state) {
    // Default: no winner yet
    return null;
  }
}

// ============== GAME REGISTRY ==============

export const SpecificRules = {
  // CARD TIER - Fully Implemented
  'spades': spadesLogic,
  'uno': unoLogic,
  
  // GRID TIER - Fully Implemented
  'checkers': checkersLogic,
  
  // CARD TIER - Stubs (To be implemented)
  'poker': new StubLogic('Poker'),
  'hearts': new StubLogic('Hearts'),
  'rummy': new StubLogic('Rummy'),
  'gofish': new StubLogic('GoFish'),
  'blackjack': new StubLogic('Blackjack'),
  
  // GRID TIER - Stubs (To be implemented)
  'chess': new StubLogic('Chess'),
  'connect4': new StubLogic('Connect4'),
  'tictactoe': new StubLogic('TicTacToe'),
  
  // BOARD GAMES - Stubs (To be implemented)
  'ludo': new StubLogic('Ludo'),
  'dominoes': new StubLogic('Dominoes'),
  'mancala': new StubLogic('Mancala'),
  'backgammon': new StubLogic('Backgammon'),
  'chinesecheckers': new StubLogic('ChineseCheckers'),
  'parcheesi': new StubLogic('Parcheesi'),
  'mahjong': new StubLogic('Mahjong'),
  'carrom': new StubLogic('Carrom'),
  'shogi': new StubLogic('Shogi'),
  'xiangqi': new StubLogic('Xiangqi'),
  
  // SOCIAL TIER - Stubs (To be implemented)
  'trivia': new StubLogic('Trivia'),
  'truthordare': new StubLogic('TruthOrDare'),
};

/**
 * Get game logic instance for a specific game type
 */
export const getGameLogic = (gameType) => {
  const logic = SpecificRules[gameType.toLowerCase()];
  if (!logic) {

    return new StubLogic(gameType);
  }
  return logic;
};
