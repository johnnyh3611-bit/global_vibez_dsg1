/**
 * <CallButton userId="..." displayName="..." /> — drop-in privacy-masked
 * "Call" button. Pop in any profile / participant card / ride card.
 *
 * Behaviour:
 *   • Click → POST /api/vibe-phone/call/initiate
 *   • Shows an outgoing-call dialog with the masked vibe_number until the
 *     other side picks up, declines, or times out
 *   • On Accept → mounts <VibeCallRoom> directly inside the dialog
 *   • Listens to its own one-shot WS for CALL_ANSWERED/DECLINED/ENDED/TIMEOUT
 *
 * It does NOT use the global IncomingCallModal — that's only for receiving.
 */
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, PhoneOff, Loader2, Video } from "lucide-react";
import { authFetch, getUserId } from "@/utils/secureAuth";
import VibeCallRoom from "@/components/voice/VibeCallRoom";
import { useActiveVibeCall } from "@/contexts/ActiveVibeCallContext";

const API = process.env.REACT_APP_BACKEND_URL;

type DialState = "idle" | "ringing" | "active" | "declined" | "timed_out" | "ended" | "error";

export default function CallButton({
  userId,
  displayName,
  className = "",
  size = "md",
  mediaType = "voice",
}: {
  userId: string;
  displayName?: string;
  className?: string;
  size?: "sm" | "md";
  /** voice = Vibe Phone audio; video = FaceTime-style Agora video */
  mediaType?: "voice" | "video";
}) {
  const [state, setState] = useState<DialState>("idle");
  const [callId, setCallId] = useState<string | null>(null);
  const [channel, setChannel] = useState<string | null>(null);
  const [calleeNumber, setCalleeNumber] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const enableVideo = mediaType === "video";
  const { setCall, clearCall, gameDockConsumers } = useActiveVibeCall();
  const hideInModal = gameDockConsumers > 0;

  const wsRef = useRef<WebSocket | null>(null);

  // Listen for the CALL_ANSWERED/DECLINED/etc events on our own user socket.
  useEffect(() => {
    if (state === "idle" || state === "ended" || state === "declined" || state === "timed_out") return;
    const me = getUserId();
    if (!me || !API) return;
    const wsUrl = API.replace(/^http/, "ws") + `/api/ws/vibe-phone/${encodeURIComponent(me)}`;
    let ws: WebSocket | null = null;
    try {
      ws = new WebSocket(wsUrl);
      wsRef.current = ws;
    } catch {
      return;
    }
    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.call_id !== callId) return;
        if (data.event === "CALL_ANSWERED") {
          setState("active");
          if (callId && channel) {
            setCall({
              callId,
              channel,
              mediaType,
              peerLabel: calleeNumber || displayName || userId,
            });
          }
        } else if (data.event === "CALL_DECLINED") setState("declined");
        else if (data.event === "CALL_TIMEOUT") setState("timed_out");
        else if (data.event === "CALL_ENDED") {
          setState("ended");
          clearCall();
        }
      } catch {
        /* ignore */
      }
    };
    return () => ws?.close();
  }, [state, callId, channel, mediaType, calleeNumber, displayName, userId, setCall, clearCall]);

  const startCall = async () => {
    setError(null);
    setState("ringing");
    try {
      const r = await authFetch(`${API}/api/vibe-phone/call/initiate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callee_user_id: userId, media_type: mediaType }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.detail || `HTTP ${r.status}`);
      }
      const data = await r.json();
      setCallId(data.call_id);
      setChannel(data.channel);
      setCalleeNumber(data.callee_vibe_number);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Couldn't place call";
      setError(msg);
      setState("error");
    }
  };

  const cancel = async () => {
    if (!callId) {
      setState("idle");
      return;
    }
    try {
      await authFetch(`${API}/api/vibe-phone/call/end`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ call_id: callId }),
      });
    } catch {
      /* ignore */
    }
    setState("ended");
  };

  const close = () => {
    setState("idle");
    setCallId(null);
    setChannel(null);
    setCalleeNumber(null);
    setError(null);
    clearCall();
  };

  const sizing = size === "sm"
    ? "w-9 h-9 text-xs"
    : "px-4 py-2 text-xs";

  return (
    <>
      <button
        onClick={startCall}
        className={`${sizing} rounded-full ${
          enableVideo
            ? "bg-fuchsia-500 hover:bg-fuchsia-600 text-white"
            : "bg-emerald-500 hover:bg-emerald-600 text-black"
        } font-black uppercase tracking-widest flex items-center justify-center gap-2 ${className}`}
        title={displayName ? `${enableVideo ? "Video call" : "Call"} ${displayName}` : enableVideo ? "Video call" : "Call"}
        data-testid={`vibe-phone-call-${userId}`}
      >
        {enableVideo ? (
          <Video className={size === "sm" ? "w-4 h-4" : "w-3.5 h-3.5"} />
        ) : (
          <Phone className={size === "sm" ? "w-4 h-4" : "w-3.5 h-3.5"} />
        )}
        {size !== "sm" && <span>{enableVideo ? "Video" : "Call"}</span>}
      </button>

      <AnimatePresence>
        {state !== "idle" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center px-6"
            data-testid="vibe-phone-outgoing-modal"
          >
            <motion.div
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.94, opacity: 0 }}
              className={`bg-gradient-to-b from-slate-900 to-black border ${
                enableVideo ? "border-fuchsia-400/40 max-w-lg" : "border-cyan-400/40 max-w-sm"
              } rounded-3xl p-6 w-full shadow-[0_0_60px_rgba(34,211,238,0.3)]`}
            >
              {state === "ringing" && (
                <div className="flex flex-col items-center text-center">
                  <motion.div
                    animate={{ scale: [1, 1.05, 1], opacity: [0.7, 1, 0.7] }}
                    transition={{ duration: 1.2, repeat: Infinity }}
                    className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-400/50 flex items-center justify-center"
                  >
                    <Phone className="w-7 h-7 text-emerald-300" />
                  </motion.div>
                  <p className="text-[10px] uppercase tracking-[0.4em] text-cyan-400 mt-4">
                    Calling…
                  </p>
                  <h2 className="text-xl font-black text-white mt-1 font-mono">
                    {calleeNumber || displayName || userId}
                  </h2>
                  <button
                    onClick={cancel}
                    className="mt-6 px-5 py-2 rounded-full bg-rose-500 text-white text-xs uppercase tracking-widest font-bold flex items-center gap-2"
                    data-testid="vibe-phone-outgoing-cancel"
                  >
                    <PhoneOff className="w-4 h-4" /> Cancel
                  </button>
                </div>
              )}

              {state === "active" && channel && !hideInModal && (
                <div className="flex flex-col items-center w-full">
                  <p className="text-[10px] uppercase tracking-[0.4em] text-emerald-400 mb-3">
                    Connected
                  </p>
                  <VibeCallRoom
                    channel={channel}
                    enableVideo={enableVideo}
                    autoJoin
                    onLeave={close}
                  />
                  <p className="text-[10px] text-cyan-400/80 text-center mt-2 font-mono">
                    with {calleeNumber}
                  </p>
                </div>
              )}
              {state === "active" && hideInModal && (
                <div className="flex flex-col items-center text-center py-4">
                  <p className="text-[10px] uppercase tracking-[0.4em] text-emerald-400 mb-2">
                    Connected · on table
                  </p>
                  <p className="text-xs text-cyan-300/80 font-mono mb-4">
                    Call is in the game video dock
                  </p>
                  <button
                    onClick={close}
                    className="px-5 py-2 rounded-full bg-rose-500 text-white text-xs uppercase tracking-widest font-bold flex items-center gap-2"
                  >
                    <PhoneOff className="w-4 h-4" /> End call
                  </button>
                </div>
              )}

              {state === "declined" && (
                <div className="flex flex-col items-center text-center">
                  <PhoneOff className="w-12 h-12 text-rose-400" />
                  <p className="text-lg font-bold text-white mt-3">Declined</p>
                  <p className="text-xs text-cyan-500/70 mt-1">
                    {calleeNumber} didn't pick up
                  </p>
                  <button
                    onClick={close}
                    className="mt-5 px-5 py-2 rounded-full bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 text-xs uppercase tracking-widest"
                  >
                    Close
                  </button>
                </div>
              )}

              {state === "timed_out" && (
                <div className="flex flex-col items-center text-center">
                  <Loader2 className="w-12 h-12 text-amber-300 opacity-60" />
                  <p className="text-lg font-bold text-white mt-3">No answer</p>
                  <p className="text-xs text-cyan-500/70 mt-1">
                    {calleeNumber} didn't pick up in time
                  </p>
                  <button
                    onClick={close}
                    className="mt-5 px-5 py-2 rounded-full bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 text-xs uppercase tracking-widest"
                  >
                    Close
                  </button>
                </div>
              )}

              {state === "ended" && (
                <div className="flex flex-col items-center text-center">
                  <PhoneOff className="w-12 h-12 text-cyan-400" />
                  <p className="text-lg font-bold text-white mt-3">Call ended</p>
                  <button
                    onClick={close}
                    className="mt-5 px-5 py-2 rounded-full bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 text-xs uppercase tracking-widest"
                  >
                    Close
                  </button>
                </div>
              )}

              {state === "error" && (
                <div className="flex flex-col items-center text-center">
                  <PhoneOff className="w-12 h-12 text-rose-400" />
                  <p className="text-sm font-bold text-rose-300 mt-3 max-w-xs">
                    {error || "Couldn't place call"}
                  </p>
                  <button
                    onClick={close}
                    className="mt-5 px-5 py-2 rounded-full bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 text-xs uppercase tracking-widest"
                  >
                    Close
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
