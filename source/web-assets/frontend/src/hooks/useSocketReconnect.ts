/**
 * useSocketReconnect — robust client reconnect for real-time game rooms.
 *
 * On brief network drops, Socket.IO reconnects automatically; this hook
 * re-authenticates and re-joins the room so balances / table state resync.
 */
import { useEffect, useRef } from "react";
import type { Socket } from "socket.io-client";

export type SocketReconnectOpts = {
  socket: Socket | null | undefined;
  roomId?: string | null;
  userId?: string | null;
  userName?: string | null;
  /** Emitted after reconnect to re-enter the room (default: join_room). */
  joinEvent?: string;
  /** Extra payload fields for the join emit. */
  joinPayload?: Record<string, unknown>;
  /** Auth emit name (default: authenticate). */
  authEvent?: string;
  onResync?: () => void;
  enabled?: boolean;
};

export default function useSocketReconnect({
  socket,
  roomId,
  userId,
  userName,
  joinEvent = "join_room",
  joinPayload,
  authEvent = "authenticate",
  onResync,
  enabled = true,
}: SocketReconnectOpts): void {
  const onResyncRef = useRef(onResync);
  onResyncRef.current = onResync;

  useEffect(() => {
    if (!enabled || !socket) return;

    const resync = () => {
      try {
        if (userId) {
          socket.emit(authEvent, {
            user_id: userId,
            user_name: userName || userId,
          });
        }
        if (roomId) {
          socket.emit(joinEvent, {
            room_id: roomId,
            user_id: userId,
            ...(joinPayload || {}),
          });
        }
        onResyncRef.current?.();
      } catch {
        /* never throw out of socket handlers */
      }
    };

    const onReconnect = () => resync();
    const onConnect = () => {
      // First connect is handled by callers; only re-sync after a drop.
      if ((socket as { _gvHadConnect?: boolean })._gvHadConnect) {
        resync();
      }
      (socket as { _gvHadConnect?: boolean })._gvHadConnect = true;
    };

    socket.io?.on?.("reconnect", onReconnect);
    socket.on("connect", onConnect);

    return () => {
      socket.io?.off?.("reconnect", onReconnect);
      socket.off("connect", onConnect);
    };
  }, [
    socket,
    roomId,
    userId,
    userName,
    joinEvent,
    authEvent,
    enabled,
    // joinPayload intentionally omitted — callers should memoize if needed
  ]);
}
