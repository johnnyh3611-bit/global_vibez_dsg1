/**
 * LegacyPlayShell — viewport-locked play frame for AAA rooms that have
 * not yet migrated onto GameRoomLayout / BaseCardGameRoom.
 *
 * Keeps the table + hand on one phone screen (esp. landscape) so players
 * never have to scroll down to see their cards. Chrome / stage / hand
 * are flex slots; overflow is clipped, not scrolled.
 */
import React from "react";

export type LegacyPlayShellProps = {
  testId: string;
  className?: string;
  /** Top bar, status banners, turn indicator. */
  chrome: React.ReactNode;
  /** Felt / seats / trick pile. */
  stage: React.ReactNode;
  /** Hand fan + inline bid/action trays. */
  hand?: React.ReactNode;
  /** Modals / overlays rendered outside the scroll lock. */
  children?: React.ReactNode;
};

export function LegacyPlayShell({
  testId,
  className = "",
  chrome,
  stage,
  hand,
  children,
}: LegacyPlayShellProps) {
  return (
    <div
      className={`gv-play-shell ${className}`.trim()}
      data-testid={testId}
    >
      <div className="gv-play-shell__inner">
        <div className="gv-play-shell__chrome">{chrome}</div>
        <div className="gv-play-shell__stage">{stage}</div>
        {hand != null ? (
          <div className="gv-play-shell__hand">{hand}</div>
        ) : null}
      </div>
      {children}
    </div>
  );
}

export default LegacyPlayShell;
