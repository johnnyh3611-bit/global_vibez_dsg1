"use client";

import { GlobalCard } from "@/components/ui/GlobalCard";

interface EarningsStats {
  balance: number;
  weeklyEarnings: number;
  totalEarned: number;
  chairDividends: number;
  referralBounty: number;
  gameWinnings: number;
  streamerRevenue: number;
}

interface EarningsWidgetProps {
  stats?: EarningsStats;
}

const DEFAULT_STATS: EarningsStats = {
  balance: 2450.5,
  weeklyEarnings: 245.75,
  totalEarned: 12340.0,
  chairDividends: 145.0,
  referralBounty: 85.5,
  gameWinnings: 15.25,
  streamerRevenue: 0.0,
};

export function EarningsWidget({ stats = DEFAULT_STATS }: EarningsWidgetProps) {
  return (
    <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* Main Balance */}
      <GlobalCard className="col-span-1 p-6 sm:col-span-2 lg:col-span-1">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">
          Your Balance
        </p>
        <p className="mt-2 text-3xl font-bold text-brand-accent">
          ${stats.balance.toFixed(2)}
        </p>
        <div className="mt-3 flex items-center gap-2">
          <span className="text-xs font-medium text-green-400">↑ +{stats.weeklyEarnings.toFixed(2)}</span>
          <span className="text-xs text-white/40">this week</span>
        </div>
      </GlobalCard>

      {/* Weekly Earnings */}
      <GlobalCard className="p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">
          Weekly Earnings
        </p>
        <p className="mt-2 text-2xl font-bold text-white">
          ${stats.weeklyEarnings.toFixed(2)}
        </p>
      </GlobalCard>

      {/* Total Earned */}
      <GlobalCard className="p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">
          Total Earned
        </p>
        <p className="mt-2 text-2xl font-bold text-white">
          ${stats.totalEarned.toFixed(2)}
        </p>
      </GlobalCard>

      {/* Earning Breakdown */}
      <GlobalCard className="p-6">
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-white/60">
          Earning Sources
        </p>
        <div className="space-y-2 text-xs">
          {stats.chairDividends > 0 && (
            <div className="flex justify-between">
              <span className="text-white/70">💺 Chair Dividends</span>
              <span className="font-medium text-green-400">
                ${stats.chairDividends.toFixed(2)}
              </span>
            </div>
          )}
          {stats.referralBounty > 0 && (
            <div className="flex justify-between">
              <span className="text-white/70">🎯 Referral Bounty</span>
              <span className="font-medium text-green-400">
                ${stats.referralBounty.toFixed(2)}
              </span>
            </div>
          )}
          {stats.gameWinnings > 0 && (
            <div className="flex justify-between">
              <span className="text-white/70">🏆 Game Winnings</span>
              <span className="font-medium text-green-400">
                ${stats.gameWinnings.toFixed(2)}
              </span>
            </div>
          )}
          {stats.streamerRevenue > 0 && (
            <div className="flex justify-between">
              <span className="text-white/70">💰 Streamer Revenue</span>
              <span className="font-medium text-green-400">
                ${stats.streamerRevenue.toFixed(2)}
              </span>
            </div>
          )}
          {Object.values({
            chairDividends: stats.chairDividends,
            referralBounty: stats.referralBounty,
            gameWinnings: stats.gameWinnings,
            streamerRevenue: stats.streamerRevenue,
          }).every((v) => v === 0) && (
            <p className="text-white/50">No earnings yet</p>
          )}
        </div>
      </GlobalCard>
    </div>
  );
}
