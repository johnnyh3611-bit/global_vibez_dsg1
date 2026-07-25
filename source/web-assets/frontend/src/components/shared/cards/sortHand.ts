/**
 * sortHand — shared hand arrangement for trick-takers and meld games.
 */
import type { PlayingCard, CardSortMode } from "./types";

const RANK_ORDER: Record<string, number> = {
  A: 0,
  K: 1,
  Q: 2,
  J: 3,
  "10": 4,
  "9": 5,
  "8": 6,
  "7": 7,
  "6": 8,
  "5": 9,
  "4": 10,
  "3": 11,
  "2": 12,
};

/** Alternating colour: H → C → D → S; jokers/wilds first. */
const SUIT_ORDER: Record<string, number> = {
  joker: -1,
  hearts: 0,
  clubs: 1,
  diamonds: 2,
  spades: 3,
};

export function cardKey(c: { suit: string; rank: string }): string {
  return `${c.suit}-${c.rank}`;
}

export function sortBySuit<T extends PlayingCard>(hand: T[]): T[] {
  return [...hand].sort((a, b) => {
    const sa = SUIT_ORDER[a.suit] ?? 99;
    const sb = SUIT_ORDER[b.suit] ?? 99;
    if (sa !== sb) return sa - sb;
    const ra = RANK_ORDER[String(a.rank)] ?? 99;
    const rb = RANK_ORDER[String(b.rank)] ?? 99;
    return ra - rb;
  });
}

/**
 * Group by meld_id (Gin Rummy). Melds (id >= 0) first, deadwood (-1) last.
 * Within each group, keep relative order then suit-sort for stability.
 */
export function groupByMeld<T extends PlayingCard & { meld_id?: number }>(
  hand: T[],
): { groups: Array<{ id: number; cards: T[] }>; flat: T[] } {
  const map = new Map<number, T[]>();
  const order: number[] = [];
  hand.forEach((c) => {
    const id = c.meld_id ?? -1;
    if (!map.has(id)) {
      map.set(id, []);
      order.push(id);
    }
    map.get(id)!.push(c);
  });
  order.sort((a, b) => (a === -1 ? 1 : b === -1 ? -1 : a - b));
  const groups = order.map((id) => ({
    id,
    cards: sortBySuit(map.get(id) ?? []),
  }));
  return { groups, flat: groups.flatMap((g) => g.cards) };
}

export function sortHand<T extends PlayingCard & { meld_id?: number }>(
  hand: T[],
  mode: CardSortMode = "suit",
): T[] {
  if (mode === "none") return hand;
  if (mode === "meld") return groupByMeld(hand).flat;
  return sortBySuit(hand);
}

export { RANK_ORDER, SUIT_ORDER };
