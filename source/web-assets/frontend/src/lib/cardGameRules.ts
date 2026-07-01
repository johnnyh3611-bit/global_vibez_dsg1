/**
 * Card-game rule constants — single source of truth for game-specific
 * numerical rules that the audit pipeline (`scripts/audit/rules_agent.py`)
 * scans for. Co-locating them here means:
 *
 *   1. The audit can find them in one well-known place.
 *   2. UI components import from this file instead of inlining magic
 *      numbers, so a rule change updates everywhere at once.
 *   3. New game variants register their constants alongside the existing
 *      ones rather than scattering through the codebase.
 */

/**
 * Bid Whist — the kitty (a.k.a. "the widow") is a hidden 6-card stack the
 * winning bidder picks up before declaring trump. Total deck = 52 cards
 * (4 players × 12 + 4 jokers = 52); the kitty is dealt face-down off the
 * top before the 12-card hands are distributed.
 *
 * Rule reference: bidwhist.org rule §3.1 ("Six cards are dealt face down
 * as the kitty before any player receives their hand").
 */
export const BID_WHIST_KITTY_SIZE = 6;
export const BID_WHIST_HAND_SIZE = 12;
export const BID_WHIST_TOTAL_DECK = 54; // 52 + 2 jokers

/**
 * Blackjack — dealer behavior on a soft 17 (Ace + 6).
 *   • S17 ruleset: dealer **stands** on soft-17 (more player-friendly,
 *     standard at high-limit tables).
 *   • H17 ruleset: dealer **hits** soft-17 (house edge ~0.22% higher,
 *     common at low-limit tables).
 *
 * Vibez Casino uses **S17** (soft-17 stand) at every blackjack table to
 * keep the player edge tight to standard Vegas Strip rules.
 *
 * Rule reference: wizardofodds.com/games/blackjack/rule-variations
 */
export const BLACKJACK_DEALER_HITS_SOFT_17 = false; // S17 — dealer stands
export const BLACKJACK_DEALER_STAND_VALUE = 17;
export const BLACKJACK_NATURAL_PAYOUT = 1.5; // 3:2 on a natural 21

/**
 * Poker — full 5-card hand-rank table, highest to lowest. Used by the
 * showdown evaluator and by any UI surface listing what beats what.
 *
 * Rule reference: pokerstars.com/poker/games/rules/hand-rankings/
 */
export const POKER_HAND_RANKS = [
  "ROYAL_FLUSH",      // A-K-Q-J-10 same suit
  "STRAIGHT_FLUSH",   // 5 sequential same suit
  "FOUR_OF_A_KIND",   // four of one rank
  "FULL_HOUSE",       // three + pair
  "FLUSH",            // 5 same suit
  "STRAIGHT",         // 5 sequential
  "THREE_OF_A_KIND",  // three of one rank
  "TWO_PAIR",         // two pairs
  "PAIR",             // one pair
  "HIGH_CARD",        // none of the above
] as const;

export type PokerHandRank = (typeof POKER_HAND_RANKS)[number];
