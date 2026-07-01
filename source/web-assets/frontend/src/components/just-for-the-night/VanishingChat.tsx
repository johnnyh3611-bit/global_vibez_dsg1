/**
 * VanishingChat — ephemeral private chat for Just for the Night rooms.
 *
 * Features:
 *   - Messages stay hidden until tapped — tapping starts a 3-min fuse
 *   - Countdown runs on both sender and recipient screens simultaneously
 *   - When fuse hits zero, message vanishes from DB + both UIs
 *   - Server-authoritative timer via WebSocket (client countdown is display-only)
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Send, Flame, EyeOff, Loader2 } from "lucide-react";
import QuickEmojiButton from "@/components/chat/QuickEmojiButton";

const API = process.env.REACT_APP_BACKEND_URL;

export interface VanishingChatProps {
  roomId: string;
  currentUserId: string;
  peerUserId: string;
  peerName?: string;
}

interface MessageRow {
  msg_id: string;
  room_id: string;
  from_user_id: string;
  to_user_id: string;
  text: string | null;
  ttl_seconds: number;
  status: "unopened" | "opened";
  sent_at: string;
  opened_at: string | null;
}

const DEFAULT_TTL = 180;

const fmtRemaining = (secs: number): string => {
  if (secs <= 0) return "0:00";
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
};

export const VanishingChat: React.FC<VanishingChatProps> = ({
  roomId,
  currentUserId,
  peerUserId,
  peerName,
}) => {
  const [messages, setMessages] = useState<Record<string, MessageRow>>({});
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [tickNow, setTickNow] = useState(() => Date.now());
  const [wsReady, setWsReady] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // ---- Initial thread load ----
  const loadThread = useCallback(async () => {
    try {
      const r = await fetch(
        `${API}/api/vanishing/thread?room_id=${encodeURIComponent(roomId)}&with_user=${encodeURIComponent(peerUserId)}`,
        {}
      );
      const data = await r.json().catch(() => ({ messages: [] }));
      const byId: Record<string, MessageRow> = {};
      for (const m of data.messages || []) byId[m.msg_id] = m;
      setMessages(byId);
    } catch {
      // offline — leave whatever we have
    }
  }, [roomId, peerUserId]);

  useEffect(() => { loadThread(); }, [loadThread]);

  // ---- WebSocket for real-time NEW_MESSAGE / MESSAGE_OPENED / VANISH ----
  useEffect(() => {
    if (!currentUserId) return;
    const wsUrl = API!.replace(/^http/, "ws") + `/api/vanishing/ws/${encodeURIComponent(currentUserId)}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    ws.onopen = () => setWsReady(true);
    ws.onclose = () => setWsReady(false);
    ws.onerror = () => setWsReady(false);
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === "NEW_MESSAGE" && msg.room_id === roomId) {
          // Recipient got a message — pull fresh thread so we have the row
          loadThread();
        } else if (msg.type === "MESSAGE_SENT" && msg.room_id === roomId) {
          loadThread();
        } else if (msg.type === "MESSAGE_OPENED") {
          setMessages((prev) => {
            const existing = prev[msg.msg_id];
            if (!existing) return prev;
            return {
              ...prev,
              [msg.msg_id]: {
                ...existing,
                status: "opened",
                opened_at: msg.opened_at,
                ttl_seconds: msg.ttl_seconds ?? existing.ttl_seconds,
              },
            };
          });
        } else if (msg.type === "VANISH") {
          setMessages((prev) => {
            const copy = { ...prev };
            delete copy[msg.msg_id];
            return copy;
          });
        }
      } catch {
        // bad payload — ignore
      }
    };
    return () => { ws.close(); };
  }, [currentUserId, roomId, loadThread]);

  // ---- Ticking clock for countdown display ----
  useEffect(() => {
    const iv = setInterval(() => setTickNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);

  // ---- Auto-scroll to newest ----
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // ---- Send a new message ----
  const handleSend = useCallback(async () => {
    if (!draft.trim() || sending) return;
    setSending(true);
    try {
      const r = await fetch(`${API}/api/vanishing/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room_id: roomId, to_user_id: peerUserId, text: draft.trim() }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.detail || "Send failed");
      setDraft("");
      // WS will trigger the thread refresh, but also force one in case WS is down
      loadThread();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSending(false);
    }
  }, [draft, sending, roomId, peerUserId, loadThread]);

  // ---- Open a message (starts the fuse on both sides) ----
  const handleOpen = useCallback(async (msgId: string) => {
    try {
      const r = await fetch(`${API}/api/vanishing/open`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ msg_id: msgId }),
      });
      const data = await r.json().catch(() => ({}));
      if (data.vanished) {
        // Already gone — remove from state
        setMessages((prev) => {
          const copy = { ...prev };
          delete copy[msgId];
          return copy;
        });
        return;
      }
      if (data.ok && data.text !== undefined) {
        setMessages((prev) => {
          const existing = prev[msgId];
          if (!existing) return prev;
          return { ...prev, [msgId]: {
            ...existing, text: data.text, status: "opened", opened_at: data.opened_at,
            ttl_seconds: data.ttl_seconds ?? existing.ttl_seconds,
          }};
        });
      }
    } catch {
      // ignore — user can retry
    }
  }, []);

  const ordered = useMemo(() => {
    return Object.values(messages).sort((a, b) => a.sent_at.localeCompare(b.sent_at));
  }, [messages]);

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-black to-neutral-950 border border-fuchsia-500/20 rounded-2xl overflow-hidden" data-testid="vanishing-chat">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2">
        <Flame className="w-4 h-4 text-fuchsia-400" />
        <div className="text-xs font-mono uppercase tracking-widest text-fuchsia-300 font-bold">Vanishing chat</div>
        <span className="ml-auto text-[10px] text-neutral-500 font-mono">
          {wsReady ? "● LIVE" : "○ RECONNECTING"}
        </span>
      </div>
      <div className="px-4 py-2 text-[11px] text-neutral-500 border-b border-white/5">
        Messages to {peerName || "your partner"} self-destruct 3 min after they're opened.
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2" data-testid="vanishing-chat-list">
        {ordered.length === 0 && (
          <div className="text-center text-neutral-600 text-xs py-8" data-testid="vanishing-chat-empty">
            No messages yet. Say something that disappears.
          </div>
        )}
        {ordered.map((m) => {
          const mine = m.from_user_id === currentUserId;
          const opened = m.status === "opened" && m.opened_at;
          // Compute seconds remaining once per render (tickNow drives re-render)
          let remaining = 0;
          if (opened && m.opened_at) {
            const expires = new Date(m.opened_at).getTime() + (m.ttl_seconds || DEFAULT_TTL) * 1000;
            remaining = Math.max(0, Math.round((expires - tickNow) / 1000));
          }
          return (
            <div
              key={m.msg_id}
              className={`flex ${mine ? "justify-end" : "justify-start"}`}
              data-testid={`vanishing-msg-${m.msg_id}`}
            >
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                  mine
                    ? "bg-fuchsia-600/80 text-white"
                    : "bg-neutral-800/80 text-white"
                } ${!opened ? "cursor-pointer hover:brightness-125" : ""}`}
                onClick={() => { if (!opened) handleOpen(m.msg_id); }}
              >
                {!opened ? (
                  <div className="flex items-center gap-2 text-sm font-bold" data-testid="vanishing-msg-sealed">
                    <EyeOff className="w-4 h-4" />
                    {mine ? "Delivered — tap to preview" : "Tap to open (starts 3-min fuse)"}
                  </div>
                ) : (
                  <div>
                    <div className="text-sm break-words whitespace-pre-wrap" data-testid="vanishing-msg-body">
                      {m.text ?? <em className="opacity-60">(loading…)</em>}
                    </div>
                    <div className="mt-1.5 flex items-center gap-1 text-[10px] font-mono uppercase tracking-widest opacity-80">
                      <Flame className="w-3 h-3" />
                      <span data-testid={`vanishing-msg-timer-${m.msg_id}`}>{fmtRemaining(remaining)}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Composer */}
      <div className="p-3 border-t border-white/5 flex items-center gap-2">
        <QuickEmojiButton
          onPick={(e) => setDraft((m) => m + e)}
          className="p-2 rounded-xl bg-neutral-900 border border-white/10 text-neutral-300 hover:text-white hover:bg-neutral-800 transition"
          testIdPrefix="vanishing-chat-emoji"
        />
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          placeholder="Type… it'll vanish after 3 min"
          maxLength={2000}
          className="flex-1 bg-neutral-900 text-white rounded-xl px-4 py-2.5 text-sm placeholder:text-neutral-600 focus:outline-none focus:ring-1 focus:ring-fuchsia-500"
          data-testid="vanishing-chat-input"
        />
        <button
          onClick={handleSend}
          disabled={!draft.trim() || sending}
          className="shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-fuchsia-500 to-pink-500 text-white flex items-center justify-center disabled:opacity-40"
          data-testid="vanishing-chat-send"
          aria-label="Send"
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
};

export default VanishingChat;
