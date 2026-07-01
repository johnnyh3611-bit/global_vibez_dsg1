"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useMemo } from "react";
import { DealerChat } from "@/components/dealer/DealerChat";
import { BrainSyncIndicator } from "@/components/dealer/BrainSyncIndicator";
import {
  ChatArchive,
  chatStorageKey,
  loadChatArchiveFromStorage,
  sanitizeChatHistory,
} from "@/lib/dealer/chat";
import { DealerName } from "@/lib/dealer/personas";
import { glassStyle } from "@/styles/design-tokens";

export function DealerInterface() {
  const [dealerName, setDealerName] = useState<DealerName>("Nova");
  const [chatByDealer, setChatByDealer] = useState<ChatArchive>(
    loadChatArchiveFromStorage
  );
  const isInitialRender = useRef(false);

  const chatHistory = useMemo(
    () => chatByDealer[dealerName] ?? [],
    [chatByDealer, dealerName]
  );

  useEffect(() => {
    // Skip the initial render so we don't overwrite localStorage on mount.
    if (!isInitialRender.current) {
      isInitialRender.current = true;
      return;
    }

    const sanitized = sanitizeChatHistory(chatHistory);
    localStorage.setItem(chatStorageKey(dealerName), JSON.stringify(sanitized));
  }, [chatHistory, dealerName]);

  return (
    <div className="relative flex min-h-screen flex-1 flex-col overflow-hidden bg-background-abyss text-white">
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
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/" className="text-lg font-bold tracking-[0.08em] text-white">
            Global <span className="text-brand-accent">Vibez</span> DSG
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <BrainSyncIndicator />
            <Link
              href="/dating"
              className="inline-flex min-h-11 items-center rounded-full border border-surface-glass-border bg-surface-glass px-4 text-xs font-semibold uppercase tracking-[0.18em] text-white/70 backdrop-blur-md transition-all hover:bg-surface-glass-strong hover:text-white"
            >
              Profiles
            </Link>
            <Link
              href="/dealer"
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-brand-primary/40 bg-brand-primary/10 px-4 text-xs font-semibold uppercase tracking-[0.18em] text-brand-glow shadow-brand-glow backdrop-blur-md transition-all hover:bg-brand-primary/20"
            >
              <span className="text-base">♠️</span>
              <span>Dealer Room</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="relative flex flex-1 flex-col items-center px-6 py-10">
        <div className={`${glassStyle} mb-8 max-w-3xl px-6 py-5 text-center`}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-brand-accent">
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
