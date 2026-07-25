/**
 * Shared playing-card types for the Card Physics engine.
 * Aliases Spades primitives so secondary rooms import one package.
 */
export type {
  SpadesCard as PlayingCard,
  SpadesPosition as SeatPosition,
  SpadesSuit as Suit,
  SpadesTrickPlay as TrickPlay,
} from "@/components/spades/types";

export type CardKey = string;

export type CardSortMode = "suit" | "none" | "meld";

export type SelectionMode = "single" | "multi";

export type CardPhase =
  | "lobby"
  | "deal"
  | "pass"
  | "bid"
  | "draw"
  | "discard"
  | "play"
  | "meld"
  | "score"
  | "finished"
  | string;
