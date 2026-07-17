/**
 * Renders the active VibeCallRoom for GameVideoLayout's `video` slot.
 * Registers as a game-dock consumer so IncomingCallModal hides its
 * floating overlay (avoids double mounts / double Agora joins).
 *
 * Use `useGameTableCallVideo()` for the layout prop so an inactive
 * call passes `undefined` (hides the dock) instead of an empty node.
 */
import { useEffect, type ReactNode } from "react";
import VibeCallRoom from "@/components/voice/VibeCallRoom";
import { useActiveVibeCall } from "@/contexts/ActiveVibeCallContext";

export function useGameTableCallVideo(): ReactNode | undefined {
  const { call } = useActiveVibeCall();
  if (!call) return undefined;
  return <GameTableCallVideo />;
}

export default function GameTableCallVideo() {
  const { call, clearCall, registerGameDock } = useActiveVibeCall();

  useEffect(() => {
    if (!call) return undefined;
    return registerGameDock();
  }, [call, registerGameDock]);

  if (!call) return null;

  return (
    <div className="w-full h-full min-h-[120px]" data-testid="game-table-call-video">
      <VibeCallRoom
        channel={call.channel}
        enableVideo={call.mediaType === "video"}
        autoJoin
        onLeave={clearCall}
      />
      {call.peerLabel ? (
        <p className="text-[9px] text-cyan-300/80 text-center py-0.5 font-mono truncate px-1">
          {call.peerLabel}
        </p>
      ) : null}
    </div>
  );
}
