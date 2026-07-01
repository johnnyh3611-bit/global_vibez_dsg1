export const CHIP_VALUES: number[] = [25, 50, 100, 500];

export const formatCurrency = (amount: number): string => `₵${amount.toLocaleString()}`;

export type Suit = 'Spades' | 'Hearts' | 'Diamonds' | 'Clubs';

export interface ParsedCard {
  suit: Suit;
  val: string;
}

const SUIT_MAP: Record<string, Suit> = {
  S: 'Spades',
  H: 'Hearts',
  D: 'Diamonds',
  C: 'Clubs',
};

export const parseCard = (cardStr: string | null | undefined): ParsedCard | null => {
  if (!cardStr || cardStr === 'BACK') return null;
  const value = cardStr.slice(0, -1);
  const suit = SUIT_MAP[cardStr.slice(-1)];
  if (!suit) return null;
  return { suit, val: value };
};

export const calculateScore = (hand: (string | null | undefined)[] | null | undefined): number => {
  if (!hand || !Array.isArray(hand)) return 0;
  let score = 0;
  let aces = 0;
  hand.forEach((card) => {
    const parsed = parseCard(card);
    if (!parsed) return;
    if (['J', 'Q', 'K'].includes(parsed.val)) {
      score += 10;
    } else if (parsed.val === 'A') {
      aces += 1;
      score += 11;
    } else {
      score += parseInt(parsed.val, 10);
    }
  });
  while (score > 21 && aces > 0) {
    score -= 10;
    aces -= 1;
  }
  return score;
};
