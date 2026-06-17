/**
 * Unit tests for vibedice654 constants & shared config.
 */
import { SIDE_BET_OPTIONS, MAX_SIDE_BETS } from '../games/vibedice654/constants';

describe('SIDE_BET_OPTIONS', () => {
  test('exposes exactly 9 canonical side bets', () => {
    expect(SIDE_BET_OPTIONS).toHaveLength(9);
  });

  test('each bet has required fields', () => {
    SIDE_BET_OPTIONS.forEach((bet) => {
      expect(bet).toHaveProperty('id');
      expect(bet).toHaveProperty('name');
      expect(bet).toHaveProperty('payout');
      expect(bet).toHaveProperty('description');
      expect(bet).toHaveProperty('category');
      expect(typeof bet.id).toBe('string');
      expect(bet.id).toMatch(/^[A-Z0-9_]+$/);
    });
  });

  test('bet ids are unique', () => {
    const ids = SIDE_BET_OPTIONS.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('categories are from allowed set', () => {
    const allowed = new Set(['triples', 'special', 'straights', 'prediction', 'timing']);
    SIDE_BET_OPTIONS.forEach((bet) => {
      expect(allowed.has(bet.category)).toBe(true);
    });
  });

  test('contains key strategic bets', () => {
    const ids = SIDE_BET_OPTIONS.map((b) => b.id);
    expect(ids).toContain('TRIPLE_6');
    expect(ids).toContain('ONE_AND_DONE');
    expect(ids).toContain('POINT_PREDICTION');
    expect(ids).toContain('LARGE_STRAIGHT');
  });
});

describe('MAX_SIDE_BETS', () => {
  test('is a positive integer', () => {
    expect(Number.isInteger(MAX_SIDE_BETS)).toBe(true);
    expect(MAX_SIDE_BETS).toBeGreaterThan(0);
  });

  test('does not exceed total available bet count', () => {
    expect(MAX_SIDE_BETS).toBeLessThanOrEqual(SIDE_BET_OPTIONS.length);
  });
});
