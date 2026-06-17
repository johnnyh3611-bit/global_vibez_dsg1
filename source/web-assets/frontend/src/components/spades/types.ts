/**
 * Shared TypeScript types for the Spades AAA module.
 * Source of truth so individual components stay locked to the same shape.
 */

export type SpadesPosition = "north" | "south" | "east" | "west";
export type SpadesTeam = "team1" | "team2";
export type SpadesRuleset = "CLASSIC" | "BIG_WHEEL";
export type SpadesMode = "ai" | "live";

export type SpadesSuit = "spades" | "hearts" | "diamonds" | "clubs" | "joker";

/**
 * A card as sent by the backend.
 * For Big Wheel, promoted cards have `promoted: true` and an explicit
 * `promoted_id` (e.g. "BIG_JOKER", "2_SPADES"). For all standard cards
 * `rank` is one of: '2' '3' … '10' 'J' 'Q' 'K' 'A'.
 *
 * Bid Whist sends jokers as {suit: "joker", rank: "Big"|"Little",
 * type: "big_joker"|"little_joker"} so the renderer detects jokers via
 * any of: rank ∈ {BIG_JOKER, LITTLE_JOKER, Big, Little}, suit == "joker",
 * or type == "big_joker"/"little_joker".
 */
export interface SpadesCard {
  suit: SpadesSuit;
  rank: string;
  value: number;
  promoted?: boolean;
  promoted_id?: string;
  type?: string;
}

export interface SpadesPlayerView {
  hand_count: number;
  bid: number;
  tricks: number;
  team: SpadesTeam;
  is_bot: boolean;
  name: string;
}

export interface SpadesScores {
  team1: { points: number; bags: number };
  team2: { points: number; bags: number };
}

export interface SpadesTrickPlay {
  position: SpadesPosition;
  card: SpadesCard;
}

export type SpadesPhase = "bidding" | "playing" | "scoring" | "finished";

/**
 * Shape returned by /api/spades-practice/{start,bid,play,new-hand} endpoints.
 * Mirrors `_client_state` in backend/routes/spades_practice.py.
 */
export interface SpadesPracticeState {
  game_id: string;
  mode: "practice";
  ruleset?: SpadesRuleset;
  ruleset_label?: string;
  your_position: SpadesPosition;
  your_team: SpadesTeam;
  your_hand: SpadesCard[];
  your_bid: number;
  your_tricks: number;
  phase: SpadesPhase;
  turn_position: SpadesPosition;
  current_trick: SpadesTrickPlay[];
  led_suit: SpadesSuit | null;
  tricks_played: number;
  spades_broken: boolean;
  players: Record<SpadesPosition, SpadesPlayerView>;
  scores: SpadesScores;
  valid_plays: SpadesCard[];
  winner: SpadesTeam | null;
  hand_history: Array<{ winner: SpadesPosition }>;
  /** Present ONLY on /play responses. Ordered list of card plays (user +
   *  bots) that the frontend replays with timing so each card visibly
   *  lands one-by-one instead of all at once. */
  play_sequence?: Array<{
    player: SpadesPosition;
    card: SpadesCard;
    trick_winner: SpadesPosition | null;
    trick_complete: boolean;
  }>;
}

export interface StatusMessage {
  text: string;
  tone: "cyan" | "amber" | "rose" | "emerald";
  id: number;
}
