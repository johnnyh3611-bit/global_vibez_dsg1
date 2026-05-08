import { motion, AnimatePresence } from 'framer-motion';
import { HelpCircle, X, Trophy, Target, Lightbulb } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

/**
 * How to Play Guide - Global Vibez DSG™ Games
 * Comprehensive instructions for all games
 */

const GAME_GUIDES = {
  tictactoe: {
    name: 'Tic-Tac-Toe — Five in a Row',
    emoji: '⭕',
    objective: 'Be the first to get 5 in a row (horizontal, vertical, or diagonal)',
    setup: 'Play on a 12×12 grid. You are X, AI is O.',
    howToPlay: [
      'Click any empty cell to place your X',
      'AI will automatically place its O',
      'Try to line up 5 Xs in a row while blocking the AI',
      'Game ends when someone gets 5 in a row or the board fills up',
    ],
    winning: 'First to line up 5 of their symbols in a row, column, or diagonal wins. If the board fills with no winner, it\'s a draw.',
    tips: ['Build "open threes" (three in a row with both ends open) to force a win', 'Block the opponent the moment they get 4 in a row — even if it means delaying your own attack'],
  },
  connect4: {
    name: 'Connect 4',
    emoji: '🔴',
    objective: 'Connect 4 of your pieces in a row before your opponent',
    setup: 'Play on a 6x7 vertical grid. Pieces fall to the lowest available position.',
    howToPlay: [
      'Click a column to drop your piece',
      'Pieces stack from bottom to top',
      'Try to connect 4 horizontally, vertically, or diagonally',
      'Take turns with AI opponent'
    ],
    winning: 'First to connect 4 pieces in any direction wins!',
    tips: ['Build from the bottom up', 'Watch for diagonal opportunities', 'Block opponent\'s potential 4-in-a-rows']
  },
  blackjack: {
    name: 'Blackjack',
    emoji: '🃏',
    objective: 'Get as close to 21 as possible without going over (busting)',
    setup: 'You and dealer each get 2 cards. One dealer card is hidden.',
    howToPlay: [
      'Face cards (J, Q, K) = 10 points',
      'Aces = 1 or 11 points (your choice)',
      'Number cards = face value',
      'Hit: Take another card',
      'Stand: Keep your current hand',
      'Dealer must hit until 17 or higher'
    ],
    winning: 'Get closer to 21 than dealer without busting. Blackjack (21 with 2 cards) is best!',
    tips: ['Stand on 17 or higher', 'Hit on 11 or lower', 'Dealer busts if over 21 - you win!']
  },
  uno: {
    name: 'UNO',
    emoji: '🎴',
    objective: 'Be the first to play all your cards',
    setup: 'Each player starts with 7 cards. Match the top card by color or number.',
    howToPlay: [
      'Play a card matching the color OR number',
      'Special cards: Skip, Reverse, Draw Two',
      'Wild cards can be played anytime',
      'Draw a card if you can\'t play',
      'Shout "UNO!" when you have one card left'
    ],
    winning: 'First player to empty their hand wins!',
    tips: ['Save Wild cards for when you\'re stuck', 'Play high-value cards first', 'Watch opponent\'s card count']
  },
  chess: {
    name: 'Chess',
    emoji: '♟️',
    objective: 'Checkmate the opponent\'s King',
    setup: '8x8 board. Each player has 16 pieces: King, Queen, Rooks, Bishops, Knights, Pawns.',
    howToPlay: [
      '♔ King: Moves 1 square in any direction',
      '♕ Queen: Moves any distance in any direction',
      '♖ Rook: Moves any distance horizontally or vertically',
      '♗ Bishop: Moves any distance diagonally',
      '♘ Knight: Moves in L-shape (2+1 squares)',
      '♙ Pawn: Moves forward 1 (or 2 on first move), captures diagonally',
      'Click piece, then click destination square'
    ],
    winning: 'Checkmate the King (King is under attack with no escape). Stalemate = draw.',
    tips: ['Control the center', 'Protect your King', 'Develop pieces early', 'Knights before Bishops']
  },
  go_fish: {
    name: 'Go Fish',
    emoji: '🎣',
    objective: 'Collect the most 4-of-a-kind sets',
    setup: 'Each player gets 7 cards. Remaining cards form the draw pile.',
    howToPlay: [
      'Click a card rank you have to ask opponent for that rank',
      'If opponent has it, you get their cards',
      'If not, "Go Fish!" - draw from deck',
      'When you get 4-of-a-kind, it\'s removed (you score)',
      'Continue until all cards are matched'
    ],
    winning: 'Player with most 4-of-a-kind sets wins!',
    tips: ['Remember what opponent asks for', 'Ask for cards you have multiples of', 'Track which ranks are gone']
  },
  checkers: {
    name: 'Checkers',
    emoji: '🟤',
    objective: 'Capture all opponent pieces or block them from moving',
    setup: '8x8 board. Each player has 12 pieces on dark squares.',
    howToPlay: [
      'Pieces move diagonally forward 1 square',
      'Jump over opponent pieces to capture them',
      'Multiple jumps possible in one turn',
      'Reach opposite end: piece becomes "King" (moves backward too)',
      'Must jump if possible (mandatory captures)'
    ],
    winning: 'Capture all opponent pieces or block them completely!',
    tips: ['Kings are powerful - push for them', 'Control the center', 'Force opponent into bad positions']
  },
  reversi: {
    name: 'Reversi (Othello)',
    emoji: '⚫',
    objective: 'Have more pieces of your color when board is full',
    setup: '8x8 board. Start with 4 pieces in center (2 black, 2 white).',
    howToPlay: [
      'Place piece to sandwich opponent pieces',
      'Flip all sandwiched pieces to your color',
      'Must flip at least one piece per turn',
      'If no valid moves, skip turn',
      'Game ends when board is full'
    ],
    winning: 'Count pieces at end - most pieces wins!',
    tips: ['Corner squares are powerful (can\'t be flipped)', 'Avoid edges early game', 'Set up future moves']
  },
  crazy_eights: {
    name: 'Crazy Eights',
    emoji: '8️⃣',
    objective: 'Be first to play all your cards',
    setup: 'Each player gets 5 cards. Top card of deck starts the discard pile.',
    howToPlay: [
      'Play a card matching suit OR rank',
      '8s are wild - play anytime, choose new suit',
      'Draw from deck if you can\'t play',
      'First to empty hand wins'
    ],
    winning: 'Play all your cards before opponent!',
    tips: ['Save 8s for emergencies', 'Track which suits opponent is weak in', 'Play high cards first']
  },
  hearts: {
    name: 'Hearts',
    emoji: '♥️',
    objective: 'Have the LOWEST score - avoid taking hearts',
    setup: '4 players. Each gets 13 cards. Play tricks.',
    howToPlay: [
      'Follow the lead suit if possible',
      'Highest card of lead suit wins the trick',
      'Each heart = 1 penalty point',
      'Queen of Spades = 13 penalty points',
      '"Shoot the Moon": Take ALL hearts/Q♠ to give 26 points to everyone else'
    ],
    winning: 'Lowest score after all tricks wins! (Or shoot the moon)',
    tips: ['Pass high hearts/Q♠ at start', 'Dump hearts on others', 'Watch for moon shots']
  },
  poker: {
    name: 'Poker (Texas Hold\'em)',
    emoji: '🃏',
    objective: 'Win chips by having best hand or making opponents fold',
    setup: '2 hole cards (private) + 5 community cards (shared)',
    howToPlay: [
      'Betting rounds: Pre-flop, Flop (3 cards), Turn (1 card), River (1 card)',
      'Fold: Give up hand',
      'Call: Match current bet',
      'Raise: Increase bet',
      'Hand rankings: Royal Flush > Straight Flush > 4-of-kind > Full House > Flush > Straight > 3-of-kind > 2 Pair > Pair > High Card'
    ],
    winning: 'Best 5-card hand wins the pot!',
    tips: ['Play strong starting hands', 'Position matters', 'Bluff strategically', 'Know when to fold']
  },
  ludo: {
    name: 'Ludo',
    emoji: '🎲',
    objective: 'Be first to get all 4 pieces around the board to home',
    setup: '4 players (you + 3 AI). Each has 4 pieces starting in home base.',
    howToPlay: [
      'Roll dice to move',
      'Need 6 to bring piece out of home',
      'If you roll 6, go again',
      'Land on opponent = send them back home',
      'Safe zones protect pieces',
      'Enter home stretch on exact count'
    ],
    winning: 'First player to get all 4 pieces home wins!',
    tips: ['Spread pieces out', 'Use 6s wisely', 'Block opponents when possible', 'Protect lead pieces']
  }
};

export const HowToPlayGuide = ({ gameType, onClose }) => {
  const guide = GAME_GUIDES[gameType];

  if (!guide) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 rounded-3xl border-2 border-white/20 shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="sticky top-0 bg-gradient-to-r from-purple-600 to-pink-600 p-6 rounded-t-3xl border-b-2 border-white/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="text-4xl">{guide.emoji}</div>
                <div>
                  <h2 className="text-2xl font-black text-white">How to Play</h2>
                  <p className="text-white/80 font-semibold">{guide.name}</p>
                </div>
              </div>
              <Button
                onClick={onClose}
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/20 h-10 w-10"
              >
                <X className="w-6 h-6" />
              </Button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Objective */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Target className="w-5 h-5 text-cyan-400" />
                <h3 className="text-white font-bold text-lg">Objective</h3>
              </div>
              <p className="text-white/80 bg-white/5 rounded-xl p-4 border border-white/10">
                {guide.objective}
              </p>
            </div>

            {/* Setup */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">⚙️</span>
                <h3 className="text-white font-bold text-lg">Setup</h3>
              </div>
              <p className="text-white/80 bg-white/5 rounded-xl p-4 border border-white/10">
                {guide.setup}
              </p>
            </div>

            {/* How to Play */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">🎮</span>
                <h3 className="text-white font-bold text-lg">How to Play</h3>
              </div>
              <ul className="space-y-2">
                {guide.howToPlay.map((step, i) => (
                  <motion.li
                    key={`howToPlay-${i}`}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="flex items-start gap-3 bg-white/5 rounded-xl p-3 border border-white/10"
                  >
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gradient-to-r from-cyan-400 to-purple-400 flex items-center justify-center text-white text-xs font-bold">
                      {i + 1}
                    </div>
                    <p className="text-white/80 text-sm">{step}</p>
                  </motion.li>
                ))}
              </ul>
            </div>

            {/* Winning */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Trophy className="w-5 h-5 text-yellow-400" />
                <h3 className="text-white font-bold text-lg">How to Win</h3>
              </div>
              <p className="text-white/80 bg-gradient-to-r from-yellow-500/20 to-amber-500/20 rounded-xl p-4 border border-yellow-500/30">
                {guide.winning}
              </p>
            </div>

            {/* Tips */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Lightbulb className="w-5 h-5 text-green-400" />
                <h3 className="text-white font-bold text-lg">Pro Tips</h3>
              </div>
              <ul className="space-y-2">
                {guide.tips.map((tip, i) => (
                  <li key={`tips-${i}`} className="flex items-start gap-2 text-white/70 text-sm">
                    <span className="text-green-400 mt-0.5">💡</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 bg-white/5 rounded-b-3xl border-t border-white/10 text-center">
            <p className="text-white/40 text-xs">
              © 2026 Global Vibez DSG™ - All Games Exclusively Owned by Global Vibez DSG
            </p>
            <Button
              onClick={onClose}
              className="mt-4 bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white font-bold px-8"
            >
              Got It! Let's Play 🎮
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default HowToPlayGuide;
