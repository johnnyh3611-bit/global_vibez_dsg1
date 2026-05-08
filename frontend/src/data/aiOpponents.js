/**
 * AI Opponent Profiles - Realistic human-like players
 * Each AI opponent has unique personality, stats, and avatar
 */

export const AI_OPPONENTS = [
  {
    id: "marcus",
    name: "Marcus Johnson",
    avatar: "https://static.prod-images.emergentagent.com/jobs/c3f468d8-915e-4ce6-875b-05ac1d5140a1/images/be069ef270efb985b48294a8ea179f2661f07083a00ba3dd0d22674ed3b7a3ab.png",
    level: 47,
    rank: "Diamond",
    wins: 1243,
    playStyle: "Aggressive",
    bio: "Tournament veteran with lightning-fast reflexes",
    winRate: 67,
    favoriteGame: "UNO"
  },
  {
    id: "sofia",
    name: "Sofia Rodriguez",
    avatar: "https://static.prod-images.emergentagent.com/jobs/c3f468d8-915e-4ce6-875b-05ac1d5140a1/images/d41b289a46511ff100bd69aaf95c5e7541340ec811eb0e9fe933019fbe431e3c.png",
    level: 52,
    rank: "Master",
    wins: 1567,
    playStyle: "Strategic",
    bio: "Calculated moves, never rushes decisions",
    winRate: 71,
    favoriteGame: "Chess"
  },
  {
    id: "david",
    name: "David Chen",
    avatar: "https://static.prod-images.emergentagent.com/jobs/c3f468d8-915e-4ce6-875b-05ac1d5140a1/images/27bcbf30d177a4523c33927e7c38e14dffb1e7063ae0aca59497cfdc1a885075.png",
    level: 58,
    rank: "Master",
    wins: 2103,
    playStyle: "Analytical",
    bio: "Former chess champion turned card shark",
    winRate: 74,
    favoriteGame: "Poker"
  },
  {
    id: "alex",
    name: "Alex Mansour",
    avatar: "https://static.prod-images.emergentagent.com/jobs/c3f468d8-915e-4ce6-875b-05ac1d5140a1/images/1df8759172ef0b77c95da93862b43dfb7e46ff89624bdd6da891638379454cd3.png",
    level: 44,
    rank: "Platinum",
    wins: 987,
    playStyle: "Balanced",
    bio: "Adapts strategy mid-game like a pro",
    winRate: 64,
    favoriteGame: "Spades"
  },
  {
    id: "maya",
    name: "Maya Park",
    avatar: "https://static.prod-images.emergentagent.com/jobs/c3f468d8-915e-4ce6-875b-05ac1d5140a1/images/97673720ee9d94b9bd7a24c0674fa582a8eb19ef75ce4e9ea0a06bf57b9e8fa4.png",
    level: 49,
    rank: "Diamond",
    wins: 1334,
    playStyle: "Tactical",
    bio: "Esports competitor with ice-cold focus",
    winRate: 69,
    favoriteGame: "Connect 4"
  },
  {
    id: "zara",
    name: "Zara Williams",
    avatar: "https://static.prod-images.emergentagent.com/jobs/c3f468d8-915e-4ce6-875b-05ac1d5140a1/images/c9da25e565a41761b5cf2b1a26a3f89de81a153918df7d0f8c23285cb18944f0.png",
    level: 41,
    rank: "Platinum",
    wins: 856,
    playStyle: "Unpredictable",
    bio: "Creative player who loves risky moves",
    winRate: 62,
    favoriteGame: "Blackjack"
  },
  {
    id: "jake",
    name: "Jake Morrison",
    avatar: "https://static.prod-images.emergentagent.com/jobs/c3f468d8-915e-4ce6-875b-05ac1d5140a1/images/06f354ce5082828697388bd9d27bb2d78f7eaa54ec60a55d8ab06bcc33d03b37.png",
    level: 45,
    rank: "Diamond",
    wins: 1087,
    playStyle: "Patient",
    bio: "Waits for the perfect moment to strike",
    winRate: 65,
    favoriteGame: "Tic-Tac-Toe"
  }
];

/**
 * Get a random AI opponent for a game
 */
export function getRandomOpponent() {
  return AI_OPPONENTS[Math.floor(Math.random() * AI_OPPONENTS.length)];
}

/**
 * Get opponent by ID
 */
export function getOpponentById(id) {
  return AI_OPPONENTS.find(opponent => opponent.id === id);
}

/**
 * Get rank color for display
 */
export function getRankColor(rank) {
  const colors = {
    'Bronze': 'from-orange-700 to-orange-900',
    'Silver': 'from-gray-400 to-gray-600',
    'Gold': 'from-yellow-400 to-yellow-600',
    'Platinum': 'from-cyan-400 to-blue-500',
    'Diamond': 'from-purple-400 to-fuchsia-500',
    'Master': 'from-red-500 to-pink-600'
  };
  return colors[rank] || colors['Silver'];
}
