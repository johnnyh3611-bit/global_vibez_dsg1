"use client";

import { Dispatch, FormEvent, SetStateAction, useEffect, useMemo, useRef, useState } from "react";
import { ChatArchive, ChatMessage } from "@/lib/dealer/chat";
import { DEALERS, DealerName } from "@/lib/dealer/personas";

interface DealerChatProps {
  dealerName: DealerName;
  setDealerName: Dispatch<SetStateAction<DealerName>>;
  chatByDealer: ChatArchive;
  setChatByDealer: Dispatch<SetStateAction<ChatArchive>>;
}

export function DealerChat({
  dealerName,
  setDealerName,
  chatByDealer,
  setChatByDealer,
}: DealerChatProps) {
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const selectedDealer = DEALERS.find((dealer) => dealer.name === dealerName)!;
  const messages = chatByDealer[dealerName];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming, dealerName]);

  const updateDealerChat = (
    name: DealerName,
    updater: (current: ChatMessage[]) => ChatMessage[]
  ) => {
    setChatByDealer((archive) => ({
      ...archive,
      [name]: updater(archive[name] ?? []),
    }));
  };

  function handleDealerChange(name: DealerName) {
    setDealerName(name);
    setError(null);
    setInput("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const userMessage = input.trim();
    if (!userMessage || streaming) return;

    const activeDealer = dealerName;
    setInput("");
    setError(null);

    updateDealerChat(activeDealer, (current) => [
      ...current,
      { role: "user", content: userMessage },
      { role: "dealer", content: "", streaming: true },
    ]);
    setStreaming(true);

    try {
      const response = await fetch("/api/dealer/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dealerName: activeDealer, userMessage }),
      });

      const contentType = response.headers.get("content-type") ?? "";

      if (!response.ok || !response.body || !contentType.includes("text/plain")) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error ?? "Dealer connection failed");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let dealerText = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          dealerText += decoder.decode(value, { stream: true });
          const snapshot = dealerText;

          updateDealerChat(activeDealer, (current) => {
            const next = [...current];
            const lastIndex = next.length - 1;
            if (lastIndex >= 0 && next[lastIndex].role === "dealer") {
              next[lastIndex] = {
                role: "dealer",
                content: snapshot,
                streaming: true,
              };
            }
            return next;
          });
        }
      } finally {
        reader.releaseLock();
      }

      updateDealerChat(activeDealer, (current) => {
        const next = [...current];
        const lastIndex = next.length - 1;
        if (lastIndex >= 0 && next[lastIndex].role === "dealer") {
          next[lastIndex] = {
            role: "dealer",
            content: dealerText.trim() || "...",
            streaming: false,
          };
        }
        return next;
      });
    } catch (err) {
      updateDealerChat(activeDealer, (current) => {
        const next = [...current];
        if (next.at(-1)?.role === "dealer" && next.at(-1)?.streaming) {
          next.pop();
        }
        return next;
      });
      setError(err instanceof Error ? err.message : "Dealer connection failed");
    } finally {
      setStreaming(false);
    }
  }

  const dealerUnread = useMemo(
    () =>
      DEALERS.reduce(
        (counts, dealer) => {
          counts[dealer.name] = chatByDealer[dealer.name]?.length ?? 0;
          return counts;
        },
        {} as Record<DealerName, number>
      ),
    [chatByDealer]
  );

  return (
    <div className="relative w-full max-w-3xl">
      <div
        className={`pointer-events-none absolute -inset-8 rounded-[2rem] bg-gradient-to-br ${selectedDealer.accent} opacity-30 blur-3xl`}
        aria-hidden
      />

      <div className="relative overflow-hidden rounded-[1.75rem] border border-white/15 bg-black/45 shadow-[0_0_80px_rgba(168,85,247,0.18)] backdrop-blur-[10px]">
        <div className="border-b border-white/10 px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-white/50">
                Terminal // Dealer Link
              </p>
              <h2 className="mt-2 text-2xl font-bold tracking-wide text-white">
                {selectedDealer.name}
              </h2>
              <p className="mt-1 text-sm text-white/70">{selectedDealer.title}</p>
              <p className="mt-2 text-xs uppercase tracking-[0.2em] text-white/45">
                {selectedDealer.vibe}
              </p>
            </div>
            <div className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[10px] uppercase tracking-[0.25em] text-emerald-300/90 backdrop-blur-[10px]">
              {streaming ? "Live Feed" : "Channel Open"}
            </div>
          </div>
        </div>

        <div className="border-b border-white/10 px-4 py-3 backdrop-blur-[10px]">
          <div className="flex flex-wrap gap-2">
            {DEALERS.map((dealer) => {
              const active = dealer.name === dealerName;
              const historyCount = dealerUnread[dealer.name];

              return (
                <button
                  key={dealer.name}
                  type="button"
                  onClick={() => handleDealerChange(dealer.name)}
                  className={`group relative inline-flex min-h-11 items-center overflow-hidden rounded-full border px-4 text-xs font-semibold uppercase tracking-[0.18em] transition-all duration-300 ${
                    active
                      ? "border-white/30 bg-white/15 text-white shadow-[0_0_24px_rgba(255,255,255,0.12)]"
                      : "border-white/10 bg-white/5 text-white/60 hover:border-white/20 hover:bg-white/10 hover:text-white"
                  }`}
                  style={{ backdropFilter: "blur(10px)" }}
                >
                  {dealer.name}
                  {historyCount > 0 && !active && (
                    <span className="ml-2 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-purple-500/30 px-1 text-[10px] text-purple-100">
                      {historyCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="relative h-[460px] overflow-y-auto px-5 py-5">
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_55%)]"
            aria-hidden
          />

          {messages.length === 0 && !streaming && (
            <p className="relative text-center text-sm text-white/45">
              Signal {selectedDealer.name}. Replies stream in live — first token may
              take a moment while the model loads.
            </p>
          )}

          <div className="relative space-y-3">
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}-${message.content.slice(0, 12)}`}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl border px-4 py-3 text-sm leading-relaxed ${
                    message.role === "user"
                      ? "border-purple-400/20 bg-purple-500/15 text-purple-50 shadow-[0_0_30px_rgba(168,85,247,0.15)]"
                      : "border-white/10 bg-white/10 text-white/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                  }`}
                  style={{ backdropFilter: "blur(10px)" }}
                >
                  {message.content || (
                    <span className="inline-flex items-center gap-2 text-white/50">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-purple-300" />
                      Connecting...
                    </span>
                  )}
                  {message.streaming && message.content && (
                    <span className="ml-1 inline-block h-4 w-[2px] animate-pulse bg-purple-300 align-middle" />
                  )}
                </div>
              </div>
            ))}
          </div>

          <div ref={bottomRef} />
        </div>

        {error && (
          <p className="px-5 pb-2 text-sm text-rose-300" role="alert">
            {error}
          </p>
        )}

        <form
          onSubmit={handleSubmit}
          className="border-t border-white/10 p-4 backdrop-blur-[10px]"
        >
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/35 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
            <input
              type="text"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={`Transmit to ${selectedDealer.name}...`}
              disabled={streaming}
              className="min-h-11 flex-1 bg-transparent px-3 text-sm text-white outline-none placeholder:text-white/30 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={streaming || !input.trim()}
              className="inline-flex min-h-11 items-center rounded-xl border border-brand-primary/40 bg-brand-primary/20 px-5 text-xs font-semibold uppercase tracking-[0.22em] text-brand-glow transition-all duration-300 hover:border-brand-accent/50 hover:bg-brand-primary/30 hover:shadow-brand-glow disabled:cursor-not-allowed disabled:opacity-40"
              style={{ backdropFilter: "blur(10px)" }}
            >
              Send
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
