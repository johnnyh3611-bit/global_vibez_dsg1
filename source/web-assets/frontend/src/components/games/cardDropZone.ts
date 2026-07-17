/**
 * Card drop-zone helpers — keep dealt cards landing in a shared center zone
 * instead of ad-hoc offsets per AAA room.
 */
import type { CSSProperties } from "react";

export const CARD_DROP_ZONE = {
  /** CSS class for the shared center drop target */
  className: "gv-card-drop-zone",
  /** Recommended absolute center of a table felt (percent) */
  center: { x: 50, y: 48 },
  /** Max cards before fan compresses */
  maxFan: 13,
  /** Horizontal overlap between fanned cards (px) */
  fanOverlap: 28,
  /** Z base for cards (see GAME_Z.cards) */
  zBase: 40,
} as const;

/** Inline style for a card at fan index `i` of `total` in the drop zone. */
export function cardDropStyle(i: number, total: number): CSSProperties {
  const mid = (total - 1) / 2;
  const offset = (i - mid) * CARD_DROP_ZONE.fanOverlap;
  return {
    position: "absolute",
    left: `calc(50% + ${offset}px)`,
    top: `${CARD_DROP_ZONE.center.y}%`,
    transform: "translate(-50%, -50%)",
    zIndex: CARD_DROP_ZONE.zBase + i,
  };
}

/** Dev/audit helper — returns whether a point is inside the center drop zone. */
export function isInCardDropZone(
  xPct: number,
  yPct: number,
  tol = 18,
): boolean {
  const dx = Math.abs(xPct - CARD_DROP_ZONE.center.x);
  const dy = Math.abs(yPct - CARD_DROP_ZONE.center.y);
  return dx <= tol && dy <= tol;
}
