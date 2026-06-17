/**
 * SpadesCommunityChat — Room-wide chat drawer for the Spades table.
 *
 * AI mode: messages persist to sessionStorage keyed by game_id. System
 *          banner explains that messages are local-only (bots don't
 *          reply in AI mode).
 *
 * Live mode: connects to the shared /api/ws/chat WebSocket endpoint and
 *          joins the game-specific room `spades:{game_id}`. Every
 *          connected player at this table sees every message in real
 *          time. Server-side AI moderation is already wired into the
 *          endpoint so abusive content is filtered before broadcast.
 *
 * Both modes share:
 *   • 24-emoji quick picker (card suits + greatest-hits)
 *   • Auto-scroll to latest
 *   • Amber Cinzel styling
 */
import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, Send, Smile, Wifi, WifiOff, X } from "lucide-react";
import { getAuthToken, getUsername } from "@/utils/secureAuth";

const QUICK_EMOJIS = [
  "❤️", "😂", "😍", "🔥", "👍", "👏",
  "😊", "🎉", "😢", "😮", "😎", "🤔",
  "💯", "✨", "🙏", "💪", "🎊", "😘",
  "♠️", "♥️", "♣️", "♦️", "🃏", "🎲",
];

interface ChatMessage {
  id: string;
  sender: string;
  text: string;
  time: string;
  system?: boolean;
}

interface Props {
  open: boolean;
  gameId: string;
  mode: "ai" | "live";
  onClose: () => void;
}

function sessionKey(gameId: string) {
  return `spades_chat_${gameId}`;
}

function roomId(gameId: string) {
  return `spades:${gameId}`;
}

function wsUrl(): string | null {
  // Convert the REACT_APP_BACKEND_URL origin to a ws:// or wss:// URL
  // and hit the mounted chat endpoint (/api/ws/chat).
  const base = process.env.REACT_APP_BACKEND_URL;
  if (!base) return null;
  try {
    const u = new URL(base);
    const proto = u.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${u.host}/api/ws/chat`;
  } catch {
    return null;
  }
}

export const SpadesCommunityChat: React.FC<Props> = ({
  open,
  gameId,
  mode,
  onClose,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const username = getUsername() || "You";

  // Live-mode WebSocket. Null in AI mode (or while disconnected).
  const wsRef = useRef<WebSocket | null>(null);
  const [liveConnected, setLiveConnected] = useState(false);
  const room = roomId(gameId);

  // Load persisted conversation on mount / game switch.
  useEffect(() => {
    if (!gameId) return;
    try {
      const raw = window.sessionStorage.getItem(sessionKey(gameId));
      if (raw) {
        setMessages(JSON.parse(raw));
        return;
      }
    } catch {
      /* ignore storage errors */
    }
    // First-open — seed a System welcome.
    setMessages([
      {
        id: "sys-welcome",
        sender: "System",
        text:
          mode === "ai"
            ? "Community chat · AI mode. Messages are local to this session."
            : "Community chat · everyone at the table sees these messages.",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        system: true,
      },
    ]);
  }, [gameId, mode]);

  // ── WebSocket wiring (live mode only) ───────────────────────────────
  // Connects when the drawer opens in live mode, cleans up on close /
  // unmount. The server broadcasts `{type:'message', user_name, message,
  // timestamp}` to everyone in the room — we fold those into the local
  // message list alongside user-typed messages.
  useEffect(() => {
    if (mode !== "live" || !open) {
      wsRef.current?.close();
      wsRef.current = null;
      setLiveConnected(false);
      return;
    }

    const url = wsUrl();
    if (!url) return;
    const token = getAuthToken();
    const ws = new WebSocket(token ? `${url}?token=${encodeURIComponent(token)}` : url);
    wsRef.current = ws;

    ws.onopen = () => {
      setLiveConnected(true);
      // Join this Spades table's room.
      ws.send(JSON.stringify({ action: "join_room", room }));
    };

    ws.onclose = () => setLiveConnected(false);
    ws.onerror = () => setLiveConnected(false);

    ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        if (data.type === "message") {
          setMessages((prev) => [
            ...prev,
            {
              id: `ws-${data.timestamp ?? Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              sender: data.user_name ?? data.sender ?? "Player",
              text: data.message ?? data.text ?? "",
              time: new Date(data.timestamp ?? Date.now()).toLocaleTimeString(
                [],
                { hour: "2-digit", minute: "2-digit" },
              ),
            },
          ]);
        } else if (data.type === "room_history" && Array.isArray(data.messages)) {
          const hist: ChatMessage[] = data.messages.map((m: Record<string, unknown>) => ({
            id: `hist-${(m.message_id as string) ?? Math.random().toString(36).slice(2)}`,
            sender: (m.user_name as string) ?? "Player",
            text: (m.message as string) ?? "",
            time: new Date(
              (m.created_at as string) ?? Date.now(),
            ).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          }));
          // Prepend history above the welcome banner so the timeline is
          // chronological. Guard against duplicates by checking text+time.
          setMessages((prev) => {
            const keyed = new Set(prev.map((p) => `${p.sender}|${p.text}|${p.time}`));
            const unique = hist.filter(
              (h) => !keyed.has(`${h.sender}|${h.text}|${h.time}`),
            );
            return [...unique, ...prev];
          });
        } else if (data.type === "system" || data.type === "user_joined") {
          // Quietly surface system events in AI mode we might not see.
          if (data.message) {
            setMessages((prev) => [
              ...prev,
              {
                id: `sys-${Date.now()}`,
                sender: "System",
                text: data.message,
                time: new Date().toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                }),
                system: true,
              },
            ]);
          }
        }
      } catch {
        /* ignore non-JSON frames */
      }
    };

    return () => {
      try {
        ws.send(JSON.stringify({ action: "leave_room", room }));
      } catch {
        /* socket already closed */
      }
      ws.close();
      wsRef.current = null;
      setLiveConnected(false);
    };
  }, [mode, open, room]);

  // Persist on every change (AI mode only — live mode history comes
  // from the server's room_history event so we don't need to cache it).
  useEffect(() => {
    if (mode !== "ai") return;
    if (!gameId || messages.length === 0) return;
    try {
      window.sessionStorage.setItem(sessionKey(gameId), JSON.stringify(messages));
    } catch {
      /* ignore quota errors */
    }
  }, [messages, gameId, mode]);

  // Auto-scroll.
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, open]);

  const send = () => {
    const text = input.trim();
    if (!text) return;
    const now = new Date();
    // Live mode → push to WebSocket; the server echoes back to everyone
    // (including us) via the `message` event, so we DON'T add it locally.
    // If the socket is disconnected we fall back to local display so the
    // user's typing never gets silently dropped.
    if (mode === "live" && wsRef.current && liveConnected) {
      wsRef.current.send(
        JSON.stringify({ action: "send_message", room, message: text }),
      );
      setInput("");
      setPickerOpen(false);
      return;
    }
    setMessages((prev) => [
      ...prev,
      {
        id: `m-${now.getTime()}`,
        sender: username,
        text,
        time: now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
    setInput("");
    setPickerOpen(false);
  };

  const appendEmoji = (e: string) => {
    setInput((v) => `${v}${e}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      send();
    }
  };

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ duration: 0.28, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="fixed top-0 right-0 h-full w-full max-w-[360px] z-[64] flex flex-col bg-gradient-to-b from-[#081021] via-[#050a14] to-[#050507] border-l-2 border-amber-500/40 shadow-[-12px_0_40px_rgba(0,0,0,0.6)]"
          data-testid="spades-community-chat"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-amber-500/20 bg-black/40 backdrop-blur">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-500 to-yellow-600 flex items-center justify-center">
                <MessageCircle className="w-4 h-4 text-[#3a2500]" />
              </div>
              <div>
                <p
                  className="text-sm font-black text-amber-300 leading-none"
                  style={{ fontFamily: "'Cinzel', serif" }}
                >
                  Community
                </p>
                <p className="text-[9px] uppercase tracking-widest text-amber-200/50">
                  Table Chat
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-amber-300/70 hover:text-white p-1 rounded transition"
              data-testid="spades-chat-close-btn"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-3 py-3 space-y-2"
            data-testid="spades-chat-messages"
          >
            {messages.map((m) => (
              <Bubble key={m.id} msg={m} isMe={m.sender === username} />
            ))}
          </div>

          {/* Emoji picker popover */}
          <AnimatePresence>
            {pickerOpen ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="px-3 pb-2"
                data-testid="spades-chat-emoji-picker"
              >
                <div className="bg-slate-950/95 backdrop-blur border border-amber-500/30 rounded-xl p-2">
                  <div className="grid grid-cols-8 gap-1">
                    {QUICK_EMOJIS.map((e) => (
                      <button
                        key={e}
                        type="button"
                        onClick={() => appendEmoji(e)}
                        className="h-8 rounded hover:bg-amber-500/15 text-lg transition"
                        data-testid={`spades-chat-emoji-${e}`}
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>

          {/* Input */}
          <div className="px-3 py-3 border-t border-amber-500/20 bg-black/40 backdrop-blur">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPickerOpen((p) => !p)}
                className={`p-2 rounded-lg border transition ${
                  pickerOpen
                    ? "bg-amber-500/20 border-amber-400/60 text-amber-200"
                    : "bg-slate-950/60 border-amber-500/20 text-amber-300/70 hover:text-amber-200"
                }`}
                data-testid="spades-chat-emoji-btn"
                aria-label="Open emoji picker"
              >
                <Smile className="w-4 h-4" />
              </button>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Message the table…"
                maxLength={280}
                className="flex-1 px-3 py-2 rounded-lg bg-slate-950/80 border border-amber-500/20 text-sm text-white placeholder:text-amber-200/30 focus:outline-none focus:border-amber-400/50"
                data-testid="spades-chat-input"
              />
              <button
                type="button"
                onClick={send}
                disabled={!input.trim()}
                className="px-3 py-2 rounded-lg bg-gradient-to-r from-amber-500 to-yellow-500 text-[#3a2500] font-black disabled:opacity-40 hover:from-amber-400 hover:to-yellow-400 transition"
                data-testid="spades-chat-send-btn"
                aria-label="Send message"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <p className="mt-2 text-[9px] text-amber-300/40 uppercase tracking-widest text-center flex items-center justify-center gap-1">
              {mode === "ai" ? (
                "AI Mode · Local to this session"
              ) : liveConnected ? (
                <>
                  <Wifi className="w-2.5 h-2.5 text-emerald-400" />
                  <span className="text-emerald-400">Live · All players see this</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-2.5 h-2.5 text-rose-400" />
                  <span className="text-rose-400">Reconnecting…</span>
                </>
              )}
            </p>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
};

const Bubble: React.FC<{ msg: ChatMessage; isMe: boolean }> = ({ msg, isMe }) => {
  if (msg.system) {
    return (
      <div className="text-center">
        <span className="inline-block px-3 py-1 rounded-full bg-slate-950/80 border border-amber-500/20 text-[10px] uppercase tracking-widest text-amber-300/60">
          {msg.text}
        </span>
      </div>
    );
  }
  return (
    <div className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
      <div className="max-w-[80%]">
        {!isMe ? (
          <p
            className="text-[10px] text-amber-300/60 font-bold uppercase tracking-wider mb-0.5 ml-2"
            style={{ fontFamily: "'Cinzel', serif" }}
          >
            {msg.sender}
          </p>
        ) : null}
        <div
          className={`px-3 py-2 rounded-2xl text-sm leading-snug whitespace-pre-wrap break-words ${
            isMe
              ? "bg-gradient-to-br from-amber-500 to-yellow-600 text-[#3a2500] rounded-tr-sm"
              : "bg-slate-900/90 border border-amber-500/20 text-white rounded-tl-sm"
          }`}
        >
          {msg.text}
        </div>
        <p className="text-[9px] text-amber-300/40 mt-0.5 font-mono text-right pr-2">
          {msg.time}
        </p>
      </div>
    </div>
  );
};

export default SpadesCommunityChat;
