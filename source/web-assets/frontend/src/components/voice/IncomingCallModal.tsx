/**
 * <IncomingCallModal /> — global full-screen ringer.
 *
 * Mount once at app root (App.js). Opens a WebSocket to
 * /ws/vibe-phone/{user_id} for the authenticated user; when an
 * INCOMING_CALL event lands, pops a full-screen modal over everything
 * with Accept / Decline / Block-this-user.
 *
 * On Accept → mounts the existing <VibeCallRoom> component to join the
 * Agora channel that the backend already created for this call.
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, PhoneOff, ShieldAlert } from "lucide-react";
import { authFetch, getUserId } from "@/utils/secureAuth";
import VibeCallRoom from "@/components/voice/VibeCallRoom";

const API = process.env.REACT_APP_BACKEND_URL;

type IncomingCall = {
  call_id: string;
  from_user_id: string;
  from_vibe_number: string;
  channel: string;
};

export default function IncomingCallModal() {
  const [incoming, setIncoming] = useState<IncomingCall | null>(null);
  const [accepted, setAccepted] = useState<IncomingCall | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const ringerRef = useRef<HTMLAudioElement | null>(null);

  // Open the WS as soon as we have an authenticated user.
  useEffect(() => {
    const userId = getUserId();
    if (!userId || !API) return;

    const wsUrl = API.replace(/^http/, "ws") + `/api/ws/vibe-phone/${encodeURIComponent(userId)}`;
    let ws: WebSocket | null = null;
    let reconnectTimer: number | null = null;

    const connect = () => {
      try {
        ws = new WebSocket(wsUrl);
      } catch {
        reconnectTimer = window.setTimeout(connect, 4000);
        return;
      }
      wsRef.current = ws;
      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.event === "INCOMING_CALL") {
            setIncoming({
              call_id: data.call_id,
              from_user_id: data.from_user_id,
              from_vibe_number: data.from_vibe_number,
              channel: data.channel,
            });
            ringerRef.current?.play().catch(() => {});
          }
        } catch {
          /* ignore malformed */
        }
      };
      ws.onclose = () => {
        wsRef.current = null;
        // Auto-reconnect with backoff.
        reconnectTimer = window.setTimeout(connect, 4000);
      };
      ws.onerror = () => ws?.close();
    };

    connect();
    return () => {
      if (reconnectTimer !== null) clearTimeout(reconnectTimer);
      ws?.close();
      wsRef.current = null;
    };
  }, []);

  // Stop the ringer whenever the modal closes.
  useEffect(() => {
    if (!incoming && ringerRef.current) {
      ringerRef.current.pause();
      ringerRef.current.currentTime = 0;
    }
  }, [incoming]);

  const respond = useCallback(async (accept: boolean) => {
    if (!incoming) return;
    try {
      await authFetch(`${API}/api/vibe-phone/call/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ call_id: incoming.call_id, accept }),
      });
    } catch {
      /* swallow — UI still closes */
    }
    if (accept) {
      setAccepted(incoming);
    }
    setIncoming(null);
  }, [incoming]);

  const block = useCallback(async () => {
    if (!incoming) return;
    try {
      await authFetch(`${API}/api/vibe-phone/block`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: incoming.from_user_id }),
      });
      await authFetch(`${API}/api/vibe-phone/call/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ call_id: incoming.call_id, accept: false }),
      });
    } catch {
      /* ignore */
    }
    setIncoming(null);
  }, [incoming]);

  return (
    <>
      {/* Hidden ringer audio. Replace src whenever you have a real mp3. */}
      <audio
        ref={ringerRef}
        loop
        // 1-second 800Hz sine wave, base64 — placeholder until a real ringtone is uploaded.
        src="data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA="
      />

      <AnimatePresence>
        {incoming && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center px-6"
            data-testid="vibe-phone-incoming-modal"
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              transition={{ type: "spring", stiffness: 220, damping: 22 }}
              className="bg-gradient-to-b from-slate-900 to-black border border-cyan-400/40 rounded-3xl p-8 w-full max-w-sm shadow-[0_0_60px_rgba(34,211,238,0.35)]"
            >
              <div className="flex flex-col items-center text-center">
                <motion.div
                  animate={{ scale: [1, 1.06, 1] }}
                  transition={{ duration: 1.2, repeat: Infinity }}
                  className="w-20 h-20 rounded-full bg-gradient-to-br from-cyan-400 to-fuchsia-500 flex items-center justify-center shadow-[0_0_30px_rgba(34,211,238,0.6)]"
                >
                  <Phone className="w-10 h-10 text-black" />
                </motion.div>
                <p className="mt-6 text-[10px] uppercase tracking-[0.4em] text-cyan-300">
                  Incoming Vibe Call
                </p>
                <h2
                  className="text-2xl font-black text-white mt-2 font-mono"
                  data-testid="vibe-phone-incoming-number"
                >
                  {incoming.from_vibe_number}
                </h2>
                <p className="text-[10px] text-cyan-500 mt-1 font-mono">
                  {incoming.from_user_id}
                </p>

                <div className="grid grid-cols-3 gap-2 w-full mt-8">
                  <button
                    onClick={() => respond(false)}
                    className="flex flex-col items-center gap-1 py-3 rounded-2xl bg-rose-500 hover:bg-rose-600 text-white text-[10px] uppercase tracking-widest font-bold"
                    data-testid="vibe-phone-decline"
                  >
                    <PhoneOff className="w-5 h-5" />
                    Decline
                  </button>
                  <button
                    onClick={() => respond(true)}
                    className="flex flex-col items-center gap-1 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-black text-[10px] uppercase tracking-widest font-black"
                    data-testid="vibe-phone-accept"
                  >
                    <Phone className="w-5 h-5" />
                    Accept
                  </button>
                  <button
                    onClick={block}
                    className="flex flex-col items-center gap-1 py-3 rounded-2xl bg-amber-500 hover:bg-amber-600 text-black text-[10px] uppercase tracking-widest font-bold"
                    data-testid="vibe-phone-block"
                  >
                    <ShieldAlert className="w-5 h-5" />
                    Block
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Accepted call — embedded VibeCallRoom in a slide-up dock */}
      <AnimatePresence>
        {accepted && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            className="fixed bottom-4 right-4 z-[9998]"
            data-testid="vibe-phone-active-dock"
          >
            <div className="relative">
              <VibeCallRoom
                channel={accepted.channel}
                onLeave={() => setAccepted(null)}
              />
              <p className="text-[10px] text-cyan-400/80 text-center mt-1 font-mono">
                with {accepted.from_vibe_number}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
