/**
 * TournamentChat — per-tournament heckle lane.
 *
 * Renders as a right-side panel inside GauntletRunner. Shows recent messages,
 * supports emoji reactions, auto-pins system messages. Live updates via
 * Socket.IO namespace `/tournament-chat`. Falls back to 8s polling if sockets
 * are unavailable.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Send, Pin, Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { io, Socket } from "socket.io-client";
import { useVoiceMirrorTarget } from "@/contexts/VoiceMirrorContext";
import TranslatedSubtitle from "@/components/common/TranslatedSubtitle";

const API = process.env.REACT_APP_BACKEND_URL;

const REACTION_SET = ["🔥", "👀", "😂", "💀", "🏆", "💯"];

interface ChatMessage {
  message_id: string;
  tournament_id: string;
  user_id: string;
  username: string;
  text: string;
  reactions: Record<string, number>;
  is_pinned: boolean;
  is_system: boolean;
  created_at: string;
}

interface Props {
  tournamentId: string;
  userId?: string;
}

const TournamentChat: React.FC<Props> = ({ tournamentId, userId }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const socketRef = useRef<Socket | null>(null);

  const scrollToBottom = useCallback(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, []);

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/card-royale/chat/${tournamentId}?limit=100`, {
      });
      if (!res.ok) return;
      const data = await res.json();
      setMessages(data.messages || []);
      setTimeout(scrollToBottom, 50);
    } catch (e) {
      // swallow — polling will retry
    }
  }, [tournamentId, scrollToBottom]);

  // Initial load + Socket.IO connection
  useEffect(() => {
    fetchMessages();
    if (!API) return;
    let s: Socket | null = null;
    try {
      s = io(`${API}/tournament-chat`, {
        path: "/api/socket.io",
        transports: ["websocket", "polling"],
        auth: { user_id: userId || "anon" },
      });
      s.on("connect", () => {
        s!.emit("join", { tournament_id: tournamentId });
      });
      s.on("chat:new", (msg: ChatMessage) => {
        if (msg.tournament_id !== tournamentId) return;
        setMessages((prev) => {
          if (prev.some((m) => m.message_id === msg.message_id)) return prev;
          return [...prev, msg].slice(-200);
        });
        setTimeout(scrollToBottom, 50);
      });
      s.on("chat:react", (evt: { message_id: string; reactions: Record<string, number> }) => {
        setMessages((prev) =>
          prev.map((m) => (m.message_id === evt.message_id ? { ...m, reactions: evt.reactions } : m))
        );
      });
      socketRef.current = s;
    } catch (e) {
      console.warn("[chat] socket failed, falling back to polling", e);
    }

    // Polling fallback (fires regardless, harmless if sockets work)
    const iv = setInterval(fetchMessages, 12000);
    return () => {
      clearInterval(iv);
      if (s) {
        try {
          s.emit("leave", { tournament_id: tournamentId });
          s.disconnect();
        } catch {}
      }
    };
  }, [tournamentId, userId, fetchMessages, scrollToBottom]);

  const send = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    await sendRaw(text);
    setDraft("");
  };

  const sendRaw = useCallback(async (text: string) => {
    if (!text || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`${API}/api/card-royale/chat/${tournamentId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Send failed");
      if (data.message) {
        setMessages((prev) => {
          if (prev.some((m) => m.message_id === data.message.message_id)) return prev;
          return [...prev, data.message].slice(-200);
        });
        setTimeout(scrollToBottom, 50);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  }, [tournamentId, sending, scrollToBottom]);

  // Voice Mirror: translated voice notes flow into tournament chat.
  useVoiceMirrorTarget({
    id: `tournament-chat-${tournamentId}`,
    label: "Heckle Lane",
    onTranslated: ({ translated, original }) => {
      const text = (translated || original || "").trim();
      if (text) sendRaw(text);
    },
  });

  const react = async (messageId: string, emoji: string) => {
    try {
      await fetch(`${API}/api/card-royale/chat/${tournamentId}/react`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message_id: messageId, emoji }),
      });
    } catch {
      /* ignored; socket update reconciles */
    }
  };

  const pinned = messages.filter((m) => m.is_pinned);
  const regular = messages.filter((m) => !m.is_pinned);

  return (
    <div
      className="flex flex-col h-full bg-neutral-950/70 rounded-2xl border border-purple-500/20 backdrop-blur-md"
      data-testid="tournament-chat"
    >
      <header className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
        <Zap className="w-4 h-4 text-fuchsia-400" />
        <h3 className="font-black italic uppercase tracking-tighter text-sm">Heckle Lane</h3>
        <span className="ml-auto text-[10px] font-mono text-neutral-500 uppercase tracking-widest">
          Live
        </span>
      </header>

      {pinned.length > 0 && (
        <div className="px-3 py-2 bg-fuchsia-500/10 border-b border-fuchsia-500/20 space-y-2" data-testid="chat-pinned-panel">
          {pinned.map((m) => (
            <div key={m.message_id} className="flex items-start gap-2 text-sm" data-testid={`pinned-${m.message_id}`}>
              <Pin className="w-3.5 h-3.5 text-fuchsia-300 shrink-0 mt-0.5" />
              <div className="whitespace-pre-line text-fuchsia-100">{m.text}</div>
            </div>
          ))}
        </div>
      )}

      <div
        ref={listRef}
        className="flex-1 overflow-y-auto px-3 py-2 space-y-2 min-h-0"
        data-testid="chat-messages"
      >
        {regular.length === 0 ? (
          <p className="text-xs text-neutral-600 text-center py-6">No messages yet — break the ice.</p>
        ) : (
          <AnimatePresence initial={false}>
            {regular.map((m) => (
              <motion.div
                key={m.message_id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className={`group flex flex-col gap-1 ${m.is_system ? "opacity-80" : ""}`}
                data-testid={`chat-msg-${m.message_id}`}
              >
                <div className="flex items-baseline gap-2">
                  <span className={`text-xs font-bold ${m.is_system ? "text-fuchsia-400" : "text-purple-300"}`}>
                    {m.username}
                  </span>
                  <span className="text-[10px] text-neutral-600 font-mono">
                    {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <div className="text-sm text-neutral-200 whitespace-pre-line">{m.text}</div>
                <TranslatedSubtitle text={m.text} />

                <div className="flex flex-wrap items-center gap-1 mt-0.5">
                  {Object.entries(m.reactions || {})
                    .filter(([, c]) => (c as number) > 0)
                    .map(([emoji, count]) => (
                      <button
                        key={emoji}
                        onClick={() => react(m.message_id, emoji)}
                        className="px-1.5 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/30 text-xs hover:bg-purple-500/20"
                        data-testid={`reaction-${m.message_id}-${emoji}`}
                      >
                        {emoji} <span className="text-[10px] text-neutral-400">{count as number}</span>
                      </button>
                    ))}
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5 ml-auto">
                    {REACTION_SET.map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => react(m.message_id, emoji)}
                        className="w-5 h-5 rounded hover:bg-white/5 text-xs"
                        data-testid={`react-btn-${m.message_id}-${emoji}`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      {error && (
        <div className="px-3 py-1 text-xs text-rose-400" data-testid="chat-error">
          {error}
        </div>
      )}

      <div className="flex gap-2 p-3 border-t border-white/5">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Heckle something..."
          maxLength={500}
          data-testid="chat-input"
          className="flex-1 px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-sm text-white focus:border-fuchsia-500 outline-none"
        />
        <button
          onClick={send}
          disabled={sending || !draft.trim()}
          data-testid="chat-send-btn"
          className="px-3 py-2 rounded-lg bg-gradient-to-r from-fuchsia-500 to-purple-500 text-white disabled:opacity-40 hover:scale-105 transition-transform"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default TournamentChat;
