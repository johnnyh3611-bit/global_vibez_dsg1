/**
 * comingSoonGames — single source of truth for which game IDs are
 * gated behind a "COMING SOON" overlay across the entire app.
 *
 * Three surfaces consume this list:
 *   1. /games-menu lobby (`pages/GamesNew.tsx`) — adds a badge + disables click
 *   2. Practice play page (`pages/PracticeGamePlay.tsx`) — renders ComingSoonOverlay
 *   3. HTTP multiplayer router (`pages/HttpGameRouter.tsx`) — same intercept
 *
 * To promote a game to "playable", REMOVE its id from this set. To
 * demote, ADD its id. That's the only edit required — every other
 * surface picks it up automatically.
 *
 * EMPTY SET: As of 2026-02-15, every game listed in the casino lobby has
 * been wired end-to-end. The set is intentionally kept (not deleted) so
 * future games can be gated by adding their id back here.
 */
export const COMING_SOON_GAME_IDS: ReadonlySet<string> = new Set<string>([
  // (every game shipped — set is intentionally empty)
]);

export const isComingSoon = (gameId: string | undefined | null): boolean => {
  if (!gameId) return false;
  return COMING_SOON_GAME_IDS.has(gameId);
};
