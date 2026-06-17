/**
 * InRoomCommsLauncher — chat + video link surfaced on every game room.
 *
 * Founder directive 2026-05-09 (final pre-beta polish): "Make sure all
 * video links + chat links are linked in to every room."
 *
 * Implementation
 *   • Small inline pill anchored top-right (NOT a sticky / floating
 *     sidebar — those were the rejected pattern). The pill scrolls
 *     with the page header on non-overflow pages and stays anchored
 *     on `h-[100dvh]+overflow-hidden` games where the game owns its
 *     own viewport.
 *   • One button: opens a full-window MODAL containing a Jitsi Meet
 *     iframe — Jitsi gives BOTH text chat AND video in a single
 *     drop-in widget (no API key, no backend, end-to-end encrypted).
 *   • Room name is derived from `window.location.pathname` so every
 *     route automatically gets its own isolated comms room. Two
 *     players who land on `/spades` from the SAME match share one
 *     channel; players in different rooms never collide.
 *   • Only renders on protected fullscreen-game routes (mounted by
 *     App.js inside `ProtectedRouteContent` when `isFullscreenGame`
 *     is true). All other pages keep the inline `<PageActionStrip />`
 *     which already exposes its own Comms section.
 */
import { useEffect, useRef, useState } from "react";
import { MessageSquareText, X, Maximize2 } from "lucide-react";

const sanitizeRoom = (path: string): string => {
  // Jitsi room names allow alnum + dashes. Strip everything else so
  // a route like `/card-mp/spades-12abc` collapses to a stable id.
  return ("vibezdsg-" + path.replace(/^\/+|\/+$/g, "").replace(/[^a-zA-Z0-9]+/g, "-")).slice(0, 60) || "vibezdsg-room";
};

export default function InRoomCommsLauncher() {
  const [open, setOpen] = useState(false);
  const [roomName, setRoomName] = useState<string>("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setRoomName(sanitizeRoom(window.location.pathname));
  }, []);

  // Lock body scroll while the modal is open so the iframe owns
  // the input focus chain.
  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = original; };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-testid="in-room-comms-pill"
        aria-label="Open room chat and video"
        className="fixed top-3 right-3 z-[55] flex items-center gap-1.5 px-3 py-1.5 rounded-full
                   bg-black/70 hover:bg-black/90 backdrop-blur border border-cyan-400/40 hover:border-fuchsia-400/60
                   text-white text-[11px] font-black uppercase tracking-wider
                   shadow-[0_0_18px_-6px_rgba(34,211,238,0.5)] transition-colors"
      >
        <MessageSquareText className="w-3.5 h-3.5 text-cyan-300" />
        <span className="hidden sm:inline">Chat &amp; Video</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[60] bg-black/80 backdrop-blur flex flex-col"
          data-testid="in-room-comms-modal"
        >
          <div className="flex items-center justify-between px-4 py-2.5 bg-black border-b border-white/10">
            <div className="flex items-center gap-2 min-w-0">
              <MessageSquareText className="w-4 h-4 text-cyan-300 shrink-0" />
              <div className="min-w-0">
                <h2 className="text-xs font-black tracking-wider text-white truncate">
                  Room Comms · Chat &amp; Video
                </h2>
                <p className="text-[10px] text-white/50 font-mono truncate">{roomName}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <a
                href={`https://meet.jit.si/${roomName}`}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="in-room-comms-popout"
                aria-label="Open in new tab"
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition"
                title="Open comms in a new tab"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </a>
              <button
                type="button"
                onClick={() => setOpen(false)}
                data-testid="in-room-comms-close"
                aria-label="Close"
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-rose-500 text-white flex items-center justify-center transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div ref={containerRef} className="flex-1 bg-black">
            <iframe
              title="VIBEZ DSG Room Comms"
              src={`https://meet.jit.si/${roomName}#config.prejoinPageEnabled=true&config.disableDeepLinking=true`}
              allow="camera; microphone; display-capture; autoplay; clipboard-write"
              className="w-full h-full border-0"
              data-testid="in-room-comms-iframe"
            />
          </div>
        </div>
      )}
    </>
  );
}
