"use client";

import Link from "next/link";
import { GlobalCard } from "@/components/ui/GlobalCard";

interface EarningPath {
  id: string;
  title: string;
  description: string;
  icon: string;
  shortHint: string;
  gradient: string;
  earnings: string;
  href: string;
  features: string[];
}

const EARNING_PATHS: EarningPath[] = [
  {
    id: "chair-holder",
    title: "💺 Chair Holder",
    description:
      "Own a chair and earn daily dividends from platform fees. Perfect for passive income.",
    icon: "💺",
    shortHint: "Own once, earn forever",
    gradient: "from-amber-600/40 to-yellow-500/20",
    earnings: "$50-500/month",
    href: "/earn/chair",
    features: [
      "Daily dividends (platform fee share)",
      "Lifetime ownership",
      "Chair trading on secondary market",
      "VIP status + perks",
    ],
  },
  {
    id: "referral-bounty",
    title: "🎯 Referral Bounty",
    description:
      "Invite friends to Global Vibez DSG and earn $5-$50 per successful signup.",
    icon: "🎯",
    shortHint: "Share. They join. You earn.",
    gradient: "from-green-500/40 to-lime-500/20",
    earnings: "$5-50/invite",
    href: "/earn/referral",
    features: [
      "$5 per referral signup",
      "$50 bonus if referred friend buys chair",
      "Unlimited earning potential",
      "Real-time referral tracking",
    ],
  },
  {
    id: "game-winnings",
    title: "🏆 Game Winnings",
    description:
      "Win at Dice 654, Spade Plus, Bid Whist, and climb the leaderboards to cash out earnings.",
    icon: "🏆",
    shortHint: "Beat others. Take the pot.",
    gradient: "from-yellow-500/40 to-orange-500/20",
    earnings: "$1-500/game",
    href: "/games",
    features: [
      "Win cash from players at your table",
      "Entry fees collected into jackpot",
      "Weekly tournament prizes",
      "Leaderboard bonuses",
    ],
  },
  {
    id: "streamer-revenue",
    title: "💰 Streamer Revenue",
    description:
      "Go live on Global Vibez DSG. Earn from tips, ads, and subscriptions.",
    icon: "💰",
    shortHint: "Broadcast. Viewers tip. You earn.",
    gradient: "from-cyan-500/40 to-teal-500/20",
    earnings: "$50-5000/month",
    href: "/tv/broadcast",
    features: [
      "100% of viewer tips",
      "$2-5 per ad view",
      "$0.50/subscriber/month",
      "Sponsorship opportunities",
    ],
  },
];

const ADVANCED_PATHS = [
  {
    id: "ambassador",
    title: "🌟 Ambassador",
    description: "Become a Global Vibez DSG brand ambassador.",
    icon: "🌟",
    href: "/ambassador",
  },
  {
    id: "override-commission",
    title: "💎 Override Commission",
    description: "Earn from your team's activity.",
    icon: "💎",
    href: "/earn/override",
  },
  {
    id: "equity",
    title: "🚀 Equity",
    description: "Own a piece of Global Vibez DSG.",
    icon: "🚀",
    href: "/earn/equity",
  },
];

export default function EarnPage() {
  return (
    <main className="min-h-[calc(100vh-64px)] w-full bg-background-deep px-4 py-8 text-white sm:px-6">
      <div className="mx-auto w-full max-w-6xl space-y-16">
        {/* Hero */}
        <section>
          <h1 className="text-4xl font-bold sm:text-5xl">
            Play <span className="text-brand-accent">to Earn</span>
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-white/70">
            Four direct paths to income. Pick your style. Earn daily. Cash out anytime.
          </p>
        </section>

        {/* Core Earning Paths */}
        <section className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold">Core Earning Paths</h2>
            <div className="mt-1 h-0.5 w-24 bg-gradient-to-r from-brand-primary to-brand-accent" />
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {EARNING_PATHS.map((path) => (
              <Link key={path.id} href={path.href}>
                <GlobalCard
                  interactive
                  className="group relative h-full overflow-hidden p-6 transition-all hover:shadow-brand-glow"
                >
                  {/* Earnings Badge */}
                  <div className="absolute right-0 top-0 rounded-bl-lg bg-brand-primary px-4 py-2 text-sm font-bold text-white">
                    {path.earnings}
                  </div>

                  {/* Title + Icon */}
                  <div className="mb-2 flex items-center gap-3">
                    <div
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-glass bg-gradient-to-br ${path.gradient} text-2xl shadow-brand-glow`}
                    >
                      {path.icon}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">
                        {path.title}
                      </h3>
                      <p className="text-xs font-medium text-brand-accent">
                        {path.shortHint}
                      </p>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="mb-4 text-sm leading-relaxed text-white/70">
                    {path.description}
                  </p>

                  {/* Features */}
                  <ul className="mb-4 space-y-2">
                    {path.features.map((feature, idx) => (
                      <li
                        key={idx}
                        className="flex gap-2 text-xs text-white/60"
                      >
                        <span className="text-brand-accent">✓</span>
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  <div className="flex items-center gap-2 font-semibold text-brand-accent transition-transform group-hover:gap-3">
                    <span>Learn More</span>
                    <span className="text-lg">→</span>
                  </div>
                </GlobalCard>
              </Link>
            ))}
          </div>
        </section>

        {/* Comparison Matrix */}
        <section className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold">Pick Your Earning Style</h2>
            <div className="mt-1 h-0.5 w-24 bg-gradient-to-r from-brand-primary to-brand-accent" />
          </div>

          <div className="overflow-x-auto rounded-glass border border-surface-glass-border">
            <table className="w-full text-sm">
              <thead className="border-b border-surface-glass-border bg-surface-glass-strong">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-white/80">
                    Earning Path
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-white/80">
                    Effort
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-white/80">
                    Potential
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-white/80">
                    Passive?
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-surface-glass-border hover:bg-surface-glass/30">
                  <td className="px-4 py-3 text-white">💺 Chair Holder</td>
                  <td className="px-4 py-3 text-white/70">One-time buy</td>
                  <td className="px-4 py-3 text-green-400">
                    $50-500/month
                  </td>
                  <td className="px-4 py-3 text-green-400">100% passive</td>
                </tr>
                <tr className="border-b border-surface-glass-border hover:bg-surface-glass/30">
                  <td className="px-4 py-3 text-white">🎯 Referral Bounty</td>
                  <td className="px-4 py-3 text-white/70">Share link</td>
                  <td className="px-4 py-3 text-green-400">Unlimited</td>
                  <td className="px-4 py-3 text-green-400">
                    Semi-passive
                  </td>
                </tr>
                <tr className="border-b border-surface-glass-border hover:bg-surface-glass/30">
                  <td className="px-4 py-3 text-white">🏆 Game Winnings</td>
                  <td className="px-4 py-3 text-white/70">Active play</td>
                  <td className="px-4 py-3 text-green-400">$1-500/game</td>
                  <td className="px-4 py-3 text-red-400">Active only</td>
                </tr>
                <tr className="hover:bg-surface-glass/30">
                  <td className="px-4 py-3 text-white">💰 Streamer Revenue</td>
                  <td className="px-4 py-3 text-white/70">Go live</td>
                  <td className="px-4 py-3 text-green-400">
                    $50-5000/month
                  </td>
                  <td className="px-4 py-3 text-yellow-400">During stream</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className="rounded-glass border border-brand-primary/30 bg-brand-primary/10 px-4 py-3 text-sm text-white/80">
            💡 <strong>Pro tip:</strong> Combine paths! Buy a chair (passive), stream games
            (active + tips), refer friends (semi-passive). Maximize your income.
          </p>
        </section>

        {/* Advanced Programs */}
        <section className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-white/60">
              Advanced Programs (Coming Soon)
            </h2>
            <div className="mt-1 h-0.5 w-24 bg-gradient-to-r from-white/30 to-white/10" />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {ADVANCED_PATHS.map((path) => (
              <GlobalCard key={path.id} className="p-4 opacity-50">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{path.icon}</span>
                  <div>
                    <h3 className="font-bold text-white">{path.title}</h3>
                    <p className="text-xs text-white/60">{path.description}</p>
                  </div>
                </div>
              </GlobalCard>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold">FAQ</h2>
            <div className="mt-1 h-0.5 w-24 bg-gradient-to-r from-brand-primary to-brand-accent" />
          </div>

          <div className="space-y-4">
            {[
              {
                q: "When can I cash out?",
                a: "Anytime! Earnings are available in your wallet once you complete a round or transaction.",
              },
              {
                q: "What's the minimum earning?",
                a: "No minimum. Earn $1 on your first game, or buy a chair for $100+ to start passive income.",
              },
              {
                q: "Are there fees?",
                a: "Minimal. 2% platform fee on game winnings. Chair dividends are calculated after fees.",
              },
              {
                q: "Do I need to be a streamer to earn?",
                a: "No. Chair holders earn passively. Game winners earn actively. Referrals pay for sharing.",
              },
            ].map((faq, idx) => (
              <GlobalCard key={idx} className="p-4 sm:p-6">
                <h3 className="mb-2 font-bold text-white">{faq.q}</h3>
                <p className="text-sm text-white/70">{faq.a}</p>
              </GlobalCard>
            ))}
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="rounded-glass border border-brand-primary/40 bg-gradient-to-r from-brand-primary/15 to-brand-accent/10 p-8 text-center sm:p-12">
          <h2 className="text-2xl font-bold text-white">Ready to start earning?</h2>
          <p className="mt-2 text-white/70">
            Pick a path. Join now. Earn today.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:justify-center sm:flex-row">
            <Link
              href="/dashboard"
              className="inline-flex min-h-12 items-center justify-center rounded-full bg-brand-primary px-8 font-semibold text-white transition-all hover:scale-105 hover:bg-brand-primary-hover"
            >
              Go to Dashboard
            </Link>
            <Link
              href="/games"
              className="inline-flex min-h-12 items-center justify-center rounded-full border border-brand-primary bg-transparent px-8 font-semibold text-brand-primary transition-all hover:bg-brand-primary/10"
            >
              Play Your First Game
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
