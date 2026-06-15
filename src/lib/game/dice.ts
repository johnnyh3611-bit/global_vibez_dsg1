import { randomInt } from "crypto";

/** Number of dice rolled in a single Vibe 6-5-4 turn. */
export const DICE_COUNT = 5;

export interface SixFiveFourResult {
  qualified: boolean;
  cargo: number;
}

/** Roll `count` fair six-sided dice. */
export function rollDice(count: number = DICE_COUNT): number[] {
  return Array.from({ length: count }, () => randomInt(1, 7));
}

/**
 * Vibe 6-5-4 (Ship, Captain, Crew): a player must roll a 6, then a 5, then a 4
 * to qualify. The two remaining dice are the "cargo" score.
 */
export function evaluateSixFiveFour(dice: number[]): SixFiveFourResult {
  const remaining = [...dice];
  for (const face of [6, 5, 4]) {
    const idx = remaining.indexOf(face);
    if (idx === -1) {
      return { qualified: false, cargo: 0 };
    }
    remaining.splice(idx, 1);
  }
  return { qualified: true, cargo: remaining.reduce((a, b) => a + b, 0) };
}
