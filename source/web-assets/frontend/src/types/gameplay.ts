/**
 * Shared gameplay types for casino & multiplayer games.
 *
 * Purpose: eliminate ad-hoc prop duplication across 200+ game components
 * so the eventual // @ts-nocheck hardening pass becomes mechanical.
 */

/* -------------------------------------------------------------------------- */
/*  Cards                                                                      */
/* -------------------------------------------------------------------------- */

export type Suit = 'H' | 'D' | 'C' | 'S' | 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type Rank =
  | 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K'
  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13;

export interface Card {
  suit: Suit;
  value: Rank;
  rank?: Rank;
  isFaceUp?: boolean;
  id?: string;
}

export type Hand = Card[];

/* -------------------------------------------------------------------------- */
/*  Betting                                                                    */
/* -------------------------------------------------------------------------- */

export type ChipValue = 1 | 5 | 10 | 25 | 50 | 100 | 500 | 1000;

export interface Bet {
  amount: number;
  type?: string;
  insurance?: boolean;
  predicted_point?: number | null;
}

/* -------------------------------------------------------------------------- */
/*  Player / Room                                                              */
/* -------------------------------------------------------------------------- */

export interface Player {
  id: string;
  username?: string;
  name?: string;
  seat?: number;
  team?: 1 | 2;
  balance?: number;
  avatar?: string;
}

export interface GameRoom {
  id: string;
  gameType: string;
  hostId: string;
  players: Player[];
  spectators?: number;
  status: 'waiting' | 'in_progress' | 'finished';
}

/* -------------------------------------------------------------------------- */
/*  Game actions                                                               */
/* -------------------------------------------------------------------------- */

export type GameAction =
  | { kind: 'hit' }
  | { kind: 'stand' }
  | { kind: 'double' }
  | { kind: 'split' }
  | { kind: 'bet'; amount: number }
  | { kind: 'fold' }
  | { kind: 'call' }
  | { kind: 'raise'; amount: number }
  | { kind: 'play_card'; card: Card }
  | { kind: 'custom'; name: string; payload?: Record<string, unknown> };

export type Result = 'win' | 'lose' | 'push' | 'blackjack' | null;

/* -------------------------------------------------------------------------- */
/*  Social                                                                     */
/* -------------------------------------------------------------------------- */

export interface VibeMessage {
  from_user_id: string;
  to_user_id: string;
  vibe_type: 'drink' | 'tip' | 'cheer' | 'message';
  message?: string;
}
