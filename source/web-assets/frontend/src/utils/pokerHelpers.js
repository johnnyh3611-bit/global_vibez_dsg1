// utils/pokerHelpers.js

export const getCardColor = (suit) => {
  return (suit === 'Hearts' || suit === 'Diamonds') ? 'text-red-500' : 'text-slate-900';
};

// Calculate relative positioning for players on an ellipse
export const getPlayerPosition = (index, totalPlayers) => {
  const angle = (index / totalPlayers) * 2 * Math.PI;
  return {
    left: `${50 + 40 * Math.cos(angle)}%`,
    top: `${50 + 35 * Math.sin(angle)}%`,
  };
};

// Parse card from backend format (e.g., "AS" -> {rank: "A", suit: "S"})
export const parseCard = (cardStr) => {
  if (!cardStr || cardStr === '?' || cardStr === 'BACK') return null;
  return {
    rank: cardStr.slice(0, -1),
    suit: cardStr.slice(-1)
  };
};

// Format card for display
export const formatCard = (cardStr) => {
  const card = parseCard(cardStr);
  if (!card) return null;
  
  const suitSymbols = {
    'H': '♥', 'D': '♦', 'C': '♣', 'S': '♠'
  };
  
  return {
    ...card,
    suitSymbol: suitSymbols[card.suit],
    color: (card.suit === 'H' || card.suit === 'D') ? 'red' : 'black'
  };
};
