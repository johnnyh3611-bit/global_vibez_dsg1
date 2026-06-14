"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useMemo } from "react";
import { DealerChat } from "@/components/dealer/DealerChat";
import {
  ChatArchive,
  chatStorageKey,
  loadChatArchiveFromStorage,
  sanitizeChatHistory,
} from "@/lib/dealer/chat";
import { DealerName } from "@/lib/dealer/personas";

export function DealerInterface() {
  const [dealerName, setDealerName] = useState<DealerName>("Nova");
  const [chatByDealer, setChatByDealer] = useState<ChatArchive>(
    loadChatArchiveFromStorage
  );
  const canPersist = useRef(false);

  const chatHistory = useMemo(
    () => chatByDealer[dealerName] ?? [],
    [chatByDealer, dealerName]
  );

  useEffect(() => {
    if (!canPersist.current) return;

    const sanitized = sanitizeChatHistory(chatHistory);
    localStorage.setItem(chatStorageKey(dealerName), JSON.stringify(sanitized));
  }, [chatHistory, dealerName]);

  return (
    <div className="relative flex min-h-screen flex-1 flex-col overflow-hidden bg-[#050508] text-white">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(124,58,237,0.22),transparent_35%),radial-gradient(circle_at_80%_10%,rgba(6,182,212,0.16),transparent_30%),radial-gradient(circle_at_50%_100%,rgba(236,72,153,0.14),transparent_40%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
        aria-hidden
      />

      <header
        className="relative border-b border-white/10 bg-black/30 backdrop-blur-[10px]"
        style={{ backdropFilter: "blur(10px)" }}
      >
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-lg font-bold tracking-[0.08em] text-white">
            Global <span className="text-purple-400">Vibez</span> DSG
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/dating"
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/70 transition-all hover:border-white/20 hover:bg-white/10 hover:text-white"
              style={{ backdropFilter: "blur(10px)" }}
            >
              Profiles
            </Link>
            <Link
              href="/dealer"
              className="flex items-center gap-2 rounded-full border border-purple-400/30 bg-purple-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-purple-200 shadow-[0_0_24px_rgba(168,85,247,0.18)] transition-all hover:border-purple-300/40 hover:bg-purple-500/20"
              style={{ backdropFilter: "blur(10px)" }}
            >
              <span className="text-base">♠️</span>
              <span>Dealer Room</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="relative flex flex-1 flex-col items-center px-6 py-10">
        <div
          className="mb-8 max-w-3xl rounded-3xl border border-white/10 bg-white/5 px-6 py-5 text-center shadow-[0_0_60px_rgba(168,85,247,0.12)]"
          style={{ backdropFilter: "blur(10px)" }}
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-purple-300/80">
            AAA Plus // Club Floor
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-wide">Dealer Lounge</h1>
          <p className="mt-3 text-sm text-white/60">
            Four live terminals. One encrypted room. Pick your dealer and keep every
            conversation archived on the floor.
          </p>
        </div>

        <DealerChat
          dealerName={dealerName}
          setDealerName={setDealerName}
          chatByDealer={chatByDealer}
          setChatByDealer={setChatByDealer}
        />
      </main>
    </div>
  );
}
