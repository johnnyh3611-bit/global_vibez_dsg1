/**
 * <FriendEventToaster /> — listens to /ws/friend-events/{user_id} and
 * surfaces real-time pop-ups when a friend does something noteworthy:
 *
 *   • VIBEZ_654_SCORE  — friend posts a high 654 score
 *   • JOINED_ROOM      — friend enters a glasshouse
 *   • CALL_INITIATED   — friend started a call
 *
 * Mount once at app root next to <IncomingCallModal />.
 */
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, X, Trophy, DoorOpen, Phone } from "lucide-react";
import { getUserId } from "@/utils/secureAuth";

const API = process.env.REACT_APP_BACKEND_URL;
const TOAST_TTL_MS = 5500;
const MAX_VISIBLE = 3;

type Toast = {
  id: string;
  event: string;
  from_user_id: string;
  payload: Record<string, unknown>;
};

const ICON_BY_EVENT: Record<string, React.ComponentType<{ className?: string }>> = {
  VIBEZ_654_SCORE: Trophy,
  JOINED_ROOM: DoorOpen,
  CALL_INITIATED: Phone,
};

const COLOR_BY_EVENT: Record<string, string> = {
  VIBEZ_654_SCORE: "from-amber-400 to-orange-500",
  JOINED_ROOM: "from-emerald-400 to-cyan-500",
  CALL_INITIATED: "from-fuchsia-400 to-pink-500",
};

const labelFor = (t: Toast): string => {
  const who = t.from_user_id.slice(0, 10);
  if (t.event === "VIBEZ_654_SCORE") {
    const score = Number(t.payload?.score ?? 0);
    return `${who} just scored ${score} on Vibez 654`;
  }
  if (t.event === "JOINED_ROOM") {
    return `${who} entered the Glasshouse`;
  }
  if (t.event === "CALL_INITIATED") {
    return `${who} started a Vibe Call`;
  }
  return `${who} · ${t.event}`;
};

export default function FriendEventToaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const userId = getUserId();
    if (!userId || !API) return;
    const wsUrl = API.replace(/^http/, "ws") + `/api/ws/friend-events/${encodeURIComponent(userId)}`;
    let ws: WebSocket | null = null;
    let reconnect: number | null = null;

    const connect = () => {
      try {
        ws = new WebSocket(wsUrl);
      } catch {
        reconnect = window.setTimeout(connect, 5000);
        return;
      }
      wsRef.current = ws;
      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (!data?.event || !data?.from_user_id) return;
          const id = `${data.event}-${data.from_user_id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          setToasts((p) => [{ id, ...data }, ...p].slice(0, MAX_VISIBLE));
          window.setTimeout(() => {
            setToasts((p) => p.filter((t) => t.id !== id));
          }, TOAST_TTL_MS);
        } catch { /* ignore */ }
      };
      ws.onclose = () => {
        wsRef.current = null;
        reconnect = window.setTimeout(connect, 5000);
      };
      ws.onerror = () => ws?.close();
    };
    connect();
    return () => {
      if (reconnect !== null) clearTimeout(reconnect);
      ws?.close();
      wsRef.current = null;
    };
  }, []);

  const dismiss = (id: string) =>
    setToasts((p) => p.filter((t) => t.id !== id));

  return (
    <div
      className="fixed top-4 right-4 z-[9990] flex flex-col gap-2 pointer-events-none"
      data-testid="friend-event-toaster"
    >
      <AnimatePresence>
        {toasts.map((t) => {
          const Icon = ICON_BY_EVENT[t.event] || Sparkles;
          const colors = COLOR_BY_EVENT[t.event] || "from-cyan-400 to-fuchsia-500";
          return (
            <motion.div
              key={t.id}
              initial={{ x: 80, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 80, opacity: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 22 }}
              className="pointer-events-auto"
            >
              <div className="glass-panel max-w-xs px-3 py-2 flex items-center gap-2">
                <div
                  className={`w-9 h-9 rounded-2xl bg-gradient-to-br ${colors} flex items-center justify-center flex-shrink-0`}
                >
                  <Icon className="w-4 h-4 text-black" />
                </div>
                <p
                  className="flex-1 text-xs text-cyan-100 truncate"
                  data-testid={`friend-event-toast-${t.event}`}
                >
                  {labelFor(t)}
                </p>
                <button
                  onClick={() => dismiss(t.id)}
                  className="text-cyan-400 hover:text-cyan-100"
                  aria-label="Dismiss"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
