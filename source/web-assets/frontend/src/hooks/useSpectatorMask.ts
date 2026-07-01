/**
 * useSpectatorMask — Sovereign Master Code §3 (Vibe-Stream Spectator Logic).
 *
 * Hides hand cards from spectators in multiplayer card rooms.
 * Usage in any card-room component:
 *
 *   const isSpectator = useSpectatorMask(currentUserId, players);
 *   if (isSpectator && card.owner !== currentUserId) {
 *     return <CardBack />;          // mask the card face
 *   }
 *   {isSpectator && <SideBetInterface />}  // show alternate UI
 */
import { useMemo } from "react";

export interface MaskablePlayer { user_id: string }

/**
 * @returns true when the current user is in the room but NOT one of the
 *   seated players (i.e. they are spectating).
 */
export function useSpectatorMask(
  currentUserId: string | null | undefined,
  players: MaskablePlayer[] | null | undefined
): boolean {
  return useMemo(() => {
    if (!currentUserId || !players || players.length === 0) return false;
    return !players.some((p) => p.user_id === currentUserId);
  }, [currentUserId, players]);
}

/**
 * Pure helper for the same logic — no React hook overhead. Use in
 * callbacks, reducers, or render functions inside .map() loops.
 */
export function isCardVisibleToUser(
  cardOwnerId: string,
  currentUserId: string | null | undefined,
  players: MaskablePlayer[] | null | undefined
): boolean {
  if (!currentUserId) return false;
  // If the user is the card's owner, always visible (the player's own hand).
  if (cardOwnerId === currentUserId) return true;
  // If the user is a seated player, they can see other public state but
  // NOT other players' hand cards — caller decides per game (some games
  // reveal hands at showdown, etc.).
  // For spectators (user not in `players`), hide everything.
  const isPlayer = !!players?.some((p) => p.user_id === currentUserId);
  return isPlayer; // returns true for players, false for spectators
}
