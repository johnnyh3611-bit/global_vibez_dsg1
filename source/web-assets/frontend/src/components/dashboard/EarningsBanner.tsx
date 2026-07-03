"use client";

import Link from "next/link";
import { GlobalCard } from "@/components/ui/GlobalCard";

interface EarningsBannerProps {
  variant?: "compact" | "full";
  hideOnEarnPage?: boolean;
}

export function EarningsBanner({
  variant = "compact",
  hideOnEarnPage = true,
}: EarningsBannerProps) {
  // Don't show banner on /earn page to avoid redundancy
  if (hideOnEarnPage && typeof window !== "undefined") {
    if (window.location.pathname === "/earn") return null;
  }

  if (variant === "compact") {
    return (
      <div className="mb-8 rounded-glass border border-green-500/30 bg-gradient-to-r from-green-500/10 to-emerald-500/10 p-4 sm:p-6">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-green-400">
              💸 Play to Earn
            </p>
            <h3 className="mt-1 text-base font-bold text-white sm:text-lg">
              Earn real money while playing
            </h3>
            <p className="mt-1 text-xs text-white/60 sm:text-sm">
              Win games, refer friends, stream, or buy chairs for passive income.
            </p>
          </div>
          <Link
            href="/earn"
            className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-full bg-green-500/20 px-6 font-semibold text-green-400 transition-all hover:bg-green-500/30 hover:text-white"
          >
            Learn More →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-12 space-y-4">
      <GlobalCard className="overflow-hidden p-0">
        <div className="flex flex-col sm:flex-row">
          {/* Left: Copy */}
          <div className="flex-1 p-6 sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-accent">
              💸 Monetization Hub
            </p>
            <h2 className="mt-2 text-2xl font-bold text-white">
              Every vibe pays.
            </h2>
            <p className="mt-3 text-sm text-white/70">
              Win at games. Stream for tips. Refer friends. Own a chair. There are four
              direct ways to earn on Global Vibez DSG — passive and active.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.1em] text-white/50">
                  Avg Monthly
                </p>
                <p className="mt-1 text-xl font-bold text-green-400">
                  $50-500
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.1em] text-white/50">
                  Earning Paths
                </p>
                <p className="mt-1 text-xl font-bold text-green-400">4 Ways</p>
              </div>
            </div>
            <Link
              href="/earn"
              className="mt-6 inline-flex min-h-11 items-center justify-center rounded-full bg-green-500 px-8 font-semibold text-black transition-all hover:scale-105 hover:bg-green-400"
            >
              Explore Earning Options
            </Link>
          </div>

          {/* Right: Quick Links */}
          <div className="border-t border-surface-glass-border bg-surface-glass/30 p-6 sm:border-l sm:border-t-0 sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">
              Quick Start
            </p>
            <div className="mt-4 space-y-3">
              <Link
                href="/games"
                className="block rounded-glass border border-surface-glass-border px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-surface-glass"
              >
                🎲 Play First Game
              </Link>
              <Link
                href="/earn/referral"
                className="block rounded-glass border border-surface-glass-border px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-surface-glass"
              >
                🎯 Share & Earn $5+
              </Link>
              <Link
                href="/tv/broadcast"
                className="block rounded-glass border border-surface-glass-border px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-surface-glass"
              >
                📺 Go Live
              </Link>
              <Link
                href="/earn/chair"
                className="block rounded-glass border border-surface-glass-border px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-surface-glass"
              >
                💺 Buy Chair
              </Link>
            </div>
          </div>
        </div>
      </GlobalCard>
    </div>
  );
}
