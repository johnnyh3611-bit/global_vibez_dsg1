/**
 * Card Physics & Layout Engine — shared primitives for AAA card rooms.
 *
 * Spades / Bid Whist own the visual language; Hearts, Gin, etc. consume
 * these exports so fanning, selection, staging, and action trays match.
 */
export * from "./types";
export { calculateHandArcLayout } from "./calculateHandArcLayout";
export type { HandArcOpts, HandArcSlot, HandArcLayout } from "./calculateHandArcLayout";
export {
  cardKey,
  sortBySuit,
  sortHand,
  groupByMeld,
  RANK_ORDER,
  SUIT_ORDER,
} from "./sortHand";
export { useCardSelection } from "./useCardSelection";
export type { UseCardSelectionOpts } from "./useCardSelection";
export { usePlaySequence } from "./usePlaySequence";
export type { PlaySeqEvent, UsePlaySequenceOpts } from "./usePlaySequence";
export { CardActionTray } from "./CardActionTray";
export type { CardAction, CardActionTrayProps } from "./CardActionTray";
export { HandFan } from "./HandFan";
export type { HandFanProps } from "./HandFan";
export { BaseCardGameRoom } from "./BaseCardGameRoom";
export type { BaseCardGameRoomProps } from "./BaseCardGameRoom";

/** Re-export the Spades card face as the canonical AnimatedCard primitive. */
export { default as AnimatedCard } from "@/components/spades/SpadesCard";
