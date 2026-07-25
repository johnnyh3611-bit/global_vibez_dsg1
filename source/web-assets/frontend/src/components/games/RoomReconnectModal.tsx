/**
 * RoomReconnectModal — standard drop recovery for live game rooms.
 * Offers Reconnect (retry join) or Back to lobby.
 */
import React from "react";
import { Loader2, WifiOff } from "lucide-react";

export type RoomReconnectModalProps = {
  open: boolean;
  reconnecting?: boolean;
  title?: string;
  detail?: string;
  onReconnect: () => void;
  onBackToLobby: () => void;
  testId?: string;
};

export default function RoomReconnectModal({
  open,
  reconnecting = false,
  title = "Connection lost",
  detail = "Your seat is still held. Reconnect to rejoin the table, or return to the lobby.",
  onReconnect,
  onBackToLobby,
  testId = "room-reconnect-modal",
}: RoomReconnectModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 px-4"
      data-testid={testId}
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${testId}-title`}
    >
      <div className="w-full max-w-sm rounded-2xl border border-cyan-400/30 bg-[#071018] p-5 text-white shadow-[0_0_40px_rgba(34,211,238,0.2)]">
        <div className="mb-3 flex items-center gap-2 text-cyan-300">
          <WifiOff className="h-5 w-5" aria-hidden />
          <h2 id={`${testId}-title`} className="text-base font-bold tracking-wide">
            {title}
          </h2>
        </div>
        <p className="mb-5 text-sm text-slate-300">{detail}</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={onReconnect}
            disabled={reconnecting}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-bold text-slate-950 disabled:opacity-50"
            data-testid={`${testId}-reconnect`}
          >
            {reconnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Reconnect
          </button>
          <button
            type="button"
            onClick={onBackToLobby}
            disabled={reconnecting}
            className="flex-1 rounded-xl border border-slate-600 bg-slate-900/80 px-4 py-2.5 text-sm font-semibold text-slate-200 disabled:opacity-50"
            data-testid={`${testId}-lobby`}
          >
            Back to lobby
          </button>
        </div>
      </div>
    </div>
  );
}
