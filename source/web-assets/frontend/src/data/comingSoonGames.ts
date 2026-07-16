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
 * Gate only titles with no dedicated AAA room AND no practice UI map
 * entry. Prefer routing fixes over permanent Coming Soon when a room
 * already exists.
 */
export const COMING_SOON_GAME_IDS: ReadonlySet<string> = new Set<string>([
  // Lobby tiles that only advertise multiplayer and have no solo practice
  // component yet — Practice vs AI shows Coming Soon instead of a blank board.
  'carrom',
  'parcheesi',
  'shogi',
  'xiangqi',
  'chinesecheckers',
]);

export const isComingSoon = (gameId: string | undefined | null): boolean => {
  if (!gameId) return false;
  return COMING_SOON_GAME_IDS.has(gameId);
};
