/**
 * BaseCardGameRoom — GameRoomLayout + card-room conventions.
 * Secondary AAA rooms should mount this instead of hand-rolling chrome.
 */
import React from "react";
import GameRoomLayout, {
  type GameRoomLayoutProps,
} from "@/components/games/GameRoomLayout";
import type { CardPhase } from "./types";
import CardActionTray, { type CardAction } from "./CardActionTray";

export type BaseCardGameRoomProps = Omit<GameRoomLayoutProps, "actions"> & {
  /** Current phase for the action tray. */
  phase?: CardPhase;
  /** Phase-aware action buttons (Pass / Draw / Play / Score). */
  phaseActions?: CardAction[];
  /** Extra leading chrome in the action tray (e.g. review countdown). */
  actionsLeading?: React.ReactNode;
  /** Raw actions slot override — wins over phaseActions when set. */
  actions?: React.ReactNode;
};

export function BaseCardGameRoom({
  phase = "play",
  phaseActions,
  actionsLeading,
  actions,
  hand,
  ...layoutProps
}: BaseCardGameRoomProps) {
  const tray =
    actions ??
    (phaseActions ? (
      <CardActionTray
        phase={phase}
        actions={phaseActions}
        leading={actionsLeading}
      />
    ) : actionsLeading ? (
      <div className="flex justify-center">{actionsLeading}</div>
    ) : undefined);

  return (
    <GameRoomLayout
      {...layoutProps}
      actions={tray}
      hand={hand}
      nativeTable={layoutProps.nativeTable ?? true}
    />
  );
}

export default BaseCardGameRoom;
