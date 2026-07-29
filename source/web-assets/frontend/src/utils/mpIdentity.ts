/**
 * Stable identity for HTTP-multiplayer games.
 *
 * Every HttpMultiplayer* page used to fall back to a NEW random id when
 * `mp_user_id` was missing — and never persisted it. A remount or hard
 * navigation then produced a different id, and the backend rejected the
 * player with "403 Not a player" mid-game. Persist the generated id so
 * the same browser keeps the same seat.
 */
export function getMpUserId(): string {
  let id = localStorage.getItem('mp_user_id');
  if (!id) {
    // Prefer the authenticated user id when available.
    id = localStorage.getItem('user_id') || 'user_' + Math.random().toString(36).slice(2, 11);
    localStorage.setItem('mp_user_id', id);
  }
  return id;
}

export function getMpUserName(): string {
  return (
    localStorage.getItem('mp_user_name') ||
    localStorage.getItem('username') ||
    'Player'
  );
}
