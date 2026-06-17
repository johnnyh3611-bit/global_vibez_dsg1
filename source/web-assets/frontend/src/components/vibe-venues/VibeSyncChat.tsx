/**
 * VibeSyncChat — Architecture Phase chat between Customer + Artisan + Host
 * for a Vibe Venues booking.  Per Master Lock-In, opens once the booking
 * is escrowed so all parties can finalize menu, decor, special pricing.
 */
import React, { useEffect, useRef, useState } from "react";
import { Send, MessageSquare, Crown, ChefHat, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import QuickEmojiButton from "@/components/chat/QuickEmojiButton";

const API = process.env.REACT_APP_BACKEND_URL!;

type Msg = {
  message_id: string;
  sender_user_id: string;
  sender_role: string;
  text: string;
  at: string;
};

const ROLE_ICONS: Record<string, { Icon: React.ElementType; tone: string }> = {
  customer: { Icon: Heart, tone: "text-fuchsia-300" },
  artisan: { Icon: ChefHat, tone: "text-orange-300" },
  host: { Icon: Crown, tone: "text-cyan-300" },
  admin: { Icon: MessageSquare, tone: "text-emerald-300" },
};

export default function VibeSyncChat({
  bookingId,
  myRole,
}: {
  bookingId: string;
  myRole: "customer" | "artisan" | "host" | "admin";
}) {
  const userId = localStorage.getItem("user_id") || "guest";
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Array<{ sender_user_id: string; sender_role: string }>>([]);
  const lastTypingPingRef = useRef<number>(0);
  const endRef = useRef<HTMLDivElement>(null);

  const refresh = async () => {
    const r = await fetch(`${API}/api/vibe-venues/bookings/${bookingId}/chat`);
    const data = await r.json();
    setMsgs(data.messages || []);
  };

  const refreshTyping = async () => {
    try {
      const r = await fetch(
        `${API}/api/vibe-venues/bookings/${bookingId}/chat/typing`,
      );
      const data = await r.json();
      setTypingUsers(
        (data.typing || []).filter((t: any) => t.sender_user_id !== userId),
      );
    } catch {}
  };

  const pingTyping = () => {
    const now = Date.now();
    // Throttle: at most once every 2s
    if (now - lastTypingPingRef.current < 2000) return;
    lastTypingPingRef.current = now;
    fetch(`${API}/api/vibe-venues/bookings/${bookingId}/chat/typing`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sender_user_id: userId, sender_role: myRole }),
    }).catch(() => {});
  };

  useEffect(() => {
    refresh();
    refreshTyping();
    const t = setInterval(() => {
      refresh();
      refreshTyping();
    }, 3000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

  const send = async () => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      await fetch(`${API}/api/vibe-venues/bookings/${bookingId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sender_user_id: userId,
          sender_role: myRole,
          text: text.trim(),
        }),
      });
      setText("");
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="rounded-2xl bg-[#0F0720] border border-fuchsia-500/20 overflow-hidden"
      data-testid="vibe-sync-chat"
    >
      <div className="px-5 py-3 border-b border-fuchsia-500/15 flex items-center gap-2">
        <MessageSquare className="w-4 h-4 text-fuchsia-300" />
        <p className="text-xs font-mono uppercase tracking-[0.3em] text-fuchsia-300/80">
          Vibe-Sync · Architecture Phase
        </p>
      </div>
      <div className="h-72 overflow-y-auto px-5 py-4 space-y-3 bg-[#07030F]">
        {msgs.length === 0 ? (
          <p className="text-center text-sm text-purple-300/60 py-12">
            No messages yet — kick it off below.
          </p>
        ) : (
          msgs.map((m) => {
            const conf = ROLE_ICONS[m.sender_role] || ROLE_ICONS.customer;
            const Icon = conf.Icon;
            const mine = m.sender_user_id === userId;
            return (
              <div
                key={m.message_id}
                className={`flex ${mine ? "justify-end" : "justify-start"}`}
                data-testid={`vibe-sync-msg-${m.message_id}`}
              >
                <div
                  className={`max-w-[78%] p-3 rounded-2xl border ${
                    mine
                      ? "bg-fuchsia-500/10 border-fuchsia-400/30"
                      : "bg-[#0F0720] border-purple-500/15"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className={`w-3.5 h-3.5 ${conf.tone}`} />
                    <span className="text-[10px] uppercase tracking-widest text-purple-300/60">
                      {m.sender_role}
                    </span>
                    <span className="text-[10px] text-purple-300/40 ml-auto">
                      {new Date(m.at).toLocaleTimeString([], {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <p className="text-sm text-white whitespace-pre-wrap break-words">
                    {m.text}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>
      <div className="p-3 border-t border-fuchsia-500/15">
        {typingUsers.length > 0 && (
          <div
            className="text-[11px] text-fuchsia-300/70 italic mb-2 ml-1"
            data-testid="vibe-sync-typing-indicator"
          >
            <span className="inline-block w-1.5 h-1.5 bg-fuchsia-400 rounded-full animate-pulse mr-1" />
            {typingUsers.length === 1
              ? `${typingUsers[0].sender_role} is typing…`
              : `${typingUsers.length} people typing…`}
          </div>
        )}
        <div className="flex gap-2">
          <QuickEmojiButton
            onPick={(e) => setText((m) => m + e)}
            className="p-2 rounded-lg bg-[#1A0D2E] border border-fuchsia-500/20 text-fuchsia-200/80 hover:text-white hover:bg-[#241038] transition"
            testIdPrefix="vibe-sync-chat-emoji"
          />
          <input
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              if (e.target.value) pingTyping();
            }}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
            placeholder="Type a message…"
            className="flex-1 px-3 py-2 rounded-lg bg-[#1A0D2E] border border-fuchsia-500/20 text-white"
            data-testid="vibe-sync-chat-input"
          />
          <Button
            onClick={send}
            disabled={busy || !text.trim()}
            className="bg-fuchsia-600 hover:bg-fuchsia-500"
            data-testid="vibe-sync-chat-send-btn"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
