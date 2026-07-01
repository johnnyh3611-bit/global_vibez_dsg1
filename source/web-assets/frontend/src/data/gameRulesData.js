// Centralized game rules data
export const GAME_RULES = {
  blackjack: {
    title: 'Blackjack Rules',
    objective: 'Get closer to 21 than the dealer without going over',
    rules: [
      'Number cards (2-10) = face value',
      'Face cards (J, Q, K) = 10 points',
      'Ace = 1 or 11 points (your choice)',
      'Hit = Take another card',
      'Stand = Keep current hand',
      'Bust = Go over 21 (you lose)',
      'Blackjack = Ace + 10-value card (21 in 2 cards)'
    ],
    howToWin: 'Beat the dealer\'s hand without busting'
  },

  poker: {
    title: 'Texas Hold\'em Poker Rules',
    objective: 'Win chips by making the best 5-card hand or bluffing',
    rules: [
      'Each player gets 2 hole cards (face down)',
      '5 community cards dealt in center (shared by all)',
      'Betting rounds: Pre-flop, Flop (3 cards), Turn (1 card), River (1 card)',
      'Actions: Fold (quit), Call (match bet), Raise (increase bet)',
      'Hand rankings (highest to lowest):',
      '  Royal Flush > Straight Flush > 4 of a Kind > Full House > Flush > Straight > 3 of a Kind > 2 Pair > Pair > High Card',
      'Best 5-card hand using hole cards + community cards wins',
      'Win by having best hand OR making everyone else fold'
    ],
    howToWin: 'Make the best hand or bluff opponents into folding!'
  },

  baccarat: {
    title: 'Baccarat Rules',
    objective: 'Bet on Player, Banker, or Tie - Closest to 9 wins',
    rules: [
      'Bet on Player, Banker, or Tie before cards dealt',
      'Two hands dealt: Player hand and Banker hand',
      'Cards: Face cards/10s = 0, Aces = 1, others = face value',
      'If total exceeds 9, subtract 10 (e.g., 7+8=15 becomes 5)',
      'Natural 8 or 9 wins immediately',
      'Banker bet has lowest house edge (1.06%)'
    ],
    howToWin: 'Correctly predict which hand gets closest to 9'
  },

  roulette: {
    title: 'Roulette Rules',
    objective: 'Bet on where the ball will land on the spinning wheel',
    rules: [
      'Place chips on numbers (0-36) or betting areas',
      'Straight bet (single number): 35:1 payout',
      'Red/Black: 1:1 payout',
      'Even/Odd: 1:1 payout',
      'Low (1-18) / High (19-36): 1:1 payout',
      'Dozens (1-12, 13-24, 25-36): 2:1 payout',
      'Nova (AI dealer) announces "No more bets!" before spin'
    ],
    howToWin: 'Correctly predict where the ball lands'
  },

  bid_whist: {
    title: 'Bid Whist Rules',
    objective: 'Win tricks to meet your bid (team-based)',
    rules: [
      'Partners sit across from each other (4 players total)',
      'Each player gets 12 cards (4-card kitty remains)',
      'Bid 4-7 books (tricks) with trump suit',
      'Highest bidder gets kitty and discards 4 cards',
      'Must follow suit if possible',
      'Trump suit beats other suits',
      'Team must meet/exceed bid to score',
      'First team to 7 points wins game!'
    ],
    howToWin: 'Meet your bid to score points!'
  }
};

export const GAME_EMOJIS = {
  // Card Games
  blackjack: '🃏', poker: '♠️', baccarat: '🎴', bid_whist: '🎴',
  roulette: '🎰', slots: '🎰', craps: '🎲',
  
  // Board Games
  tictactoe: '❌', reversi: '⚫', battleship: '🚢',
  
  // Arcade
  snake: '🐍', memory_match: '🧠'
};
