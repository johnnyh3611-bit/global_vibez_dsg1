export const MAX_SIDE_BETS = 5;

export const SIDE_BET_OPTIONS = [
  { id: 'TRIPLE_6', name: 'Triple 6', payout: '30:1', description: '3+ sixes', icon: '⚡', category: 'triples' },
  { id: 'ONE_AND_DONE', name: 'One & Done', payout: '50:1', description: '6-5-4 first roll', icon: '🎯', category: 'special' },
  { id: 'STRAIGHT_1', name: 'Straight 1s', payout: '500:1', description: 'Five 1s', icon: '💎', category: 'straights' },
  { id: 'STRAIGHT_6', name: 'Straight 6s', payout: '500:1', description: 'Five 6s', icon: '👑', category: 'straights' },
  { id: 'LARGE_STRAIGHT', name: 'Large Straight', payout: '100:1', description: '1-2-3-4-5 or 2-3-4-5-6', icon: '🌟', category: 'straights' },
  { id: 'POINT_PREDICTION', name: 'Predict Point', payout: '3:1', description: 'Guess final point (2-12)', icon: '🔮', category: 'prediction' },
  { id: 'QUALIFY_ROLL_1', name: 'Qualify Roll 1', payout: '3:1', description: 'Qualify on 1st roll', icon: '🥇', category: 'timing' },
  { id: 'QUALIFY_ROLL_2', name: 'Qualify Roll 2', payout: '2:1', description: 'Qualify on 2nd roll', icon: '🥈', category: 'timing' },
  { id: 'QUALIFY_ROLL_3', name: 'Qualify Roll 3', payout: '1:1', description: 'Qualify on 3rd roll', icon: '🥉', category: 'timing' },
];
