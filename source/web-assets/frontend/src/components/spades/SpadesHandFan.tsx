/**
 * SpadesHandFan — thin adapter over the shared Card Physics HandFan.
 * Keeps the historical import path + data-testid for Spades / Bid Whist /
 * Hearts / Crazy Eights / Euchre / Pinochle.
 */
import React from "react";
import { HandFan } from "@/components/shared/cards";
import type { SpadesCard as SpadesCardData } from "./types";

interface Props {
  hand: SpadesCardData[];
  validPlays: SpadesCardData[];
  isYourTurn: boolean;
  onPlay: (card: SpadesCardData) => void;
  busy: boolean;
  hideTurnIndicator?: boolean;
  /** Disables suit-grouping. Required for Gin Rummy / Rummy which
   *  intentionally group by MELD instead of by suit. */
  disableSuitSort?: boolean;
}

export const SpadesHandFan: React.FC<Props> = ({
  hand,
  validPlays,
  isYourTurn,
  onPlay,
  busy,
  hideTurnIndicator = false,
  disableSuitSort = false,
}) => (
  <HandFan
    hand={hand}
    validPlays={validPlays}
    isYourTurn={isYourTurn}
    onPlay={onPlay}
    busy={busy}
    hideTurnIndicator={hideTurnIndicator}
    sortMode={disableSuitSort ? "none" : "suit"}
    testId="spades-hand-fan"
  />
);

export default SpadesHandFan;
