/**
 * Unit tests for Blackjack pure utility functions.
 * No React Testing Library required — these are pure functions.
 */
import { parseCard, calculateScore, formatCurrency } from '../blackjack/utils';

describe('parseCard', () => {
  test('parses simple suited card', () => {
    expect(parseCard('7H')).toEqual({ suit: 'Hearts', val: '7' });
    expect(parseCard('KS')).toEqual({ suit: 'Spades', val: 'K' });
    expect(parseCard('AD')).toEqual({ suit: 'Diamonds', val: 'A' });
    expect(parseCard('QC')).toEqual({ suit: 'Clubs', val: 'Q' });
  });

  test('parses ten (two-digit value)', () => {
    expect(parseCard('10H')).toEqual({ suit: 'Hearts', val: '10' });
  });

  test('returns null for null/undefined input', () => {
    expect(parseCard(null)).toBeNull();
    expect(parseCard(undefined)).toBeNull();
    expect(parseCard('')).toBeNull();
  });

  test('returns null for face-down "BACK" card', () => {
    expect(parseCard('BACK')).toBeNull();
  });
});

describe('calculateScore', () => {
  test('returns 0 for empty/invalid hand', () => {
    expect(calculateScore([])).toBe(0);
    expect(calculateScore(null)).toBe(0);
    expect(calculateScore(undefined)).toBe(0);
  });

  test('sums number cards correctly', () => {
    expect(calculateScore(['2H', '7S'])).toBe(9);
    expect(calculateScore(['5C', '6D'])).toBe(11);
  });

  test('counts face cards as 10', () => {
    expect(calculateScore(['JH', 'QS'])).toBe(20);
    expect(calculateScore(['KC', '10D'])).toBe(20);
  });

  test('counts ace as 11 when it does not bust', () => {
    expect(calculateScore(['AH', '9S'])).toBe(20);
    expect(calculateScore(['AS', 'KH'])).toBe(21); // blackjack
  });

  test('demotes ace to 1 when needed to avoid bust', () => {
    expect(calculateScore(['AH', '10S', '5C'])).toBe(16); // 11+10+5=26 → 1+10+5=16
    expect(calculateScore(['AH', 'AS', '9C'])).toBe(21); // 11+11+9=31 → 1+1+9=11 but better is 11+1+9=21
  });

  test('handles multiple aces correctly', () => {
    // A + A + A + 8 → 11 + 1 + 1 + 8 = 21
    expect(calculateScore(['AH', 'AS', 'AD', '8C'])).toBe(21);
  });

  test('ignores face-down cards in hand', () => {
    expect(calculateScore(['7H', 'BACK'])).toBe(7);
  });
});

describe('formatCurrency', () => {
  test('formats whole numbers with commas', () => {
    expect(formatCurrency(1000)).toBe('$1,000');
    expect(formatCurrency(1000000)).toBe('$1,000,000');
  });

  test('handles zero', () => {
    expect(formatCurrency(0)).toBe('$0');
  });
});
