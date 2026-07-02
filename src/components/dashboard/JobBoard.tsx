"use client";

import Link from "next/link";
import { GlobalCard } from "@/components/ui/GlobalCard";

interface JobBoardItem {
  id: string;
  category: "gaming" | "dating" | "streaming" | "earning";
  title: string;
  description: string;
  icon: string;
  cta: string;
  href: string;
  gradient: string;
  badge?: string;
}

const JOB_BOARD: JobBoardItem[] = [
  // Gaming
  {
    id: "dice-654",
    category: "gaming",
    title: "🎲 Dice 654",
    description: "Roll the dice against other players. Fast rounds, big wins.",
    icon: "🎲",
    cta: "Play Now",
    href: "/games/654",
    gradient: "from-cyan-500/40 to-blue-500/20",
    badge: "Popular",
  },
  {
    id: "spade-plus",
    category: "gaming",
    title: "♠️ Spade Plus",
    description: "High-stakes partnership spades. Call your bid, run the board.",
    icon: "♠️",
    cta: "Find Table",
    href: "/games/spade-plus",
    gradient: "from-brand-primary/40 to-brand-accent/20",
  },
  {
    id: "bid-whist",
    category: "gaming",
    title: "♥️ Bid Whist",
    description: "Trick-taking uptown rules. Out-strategize the competition.",
    icon: "♥️",
    cta: "Find Table",
    href: "/games/bid-whist",
    gradient: "from-rose-500/40 to-brand-primary/20",
  },

  // Dating
  {
    id: "discover-matches",
    category: "dating",
    title: "💕 Discover Matches",
    description: "Browse profiles. Swipe. Connect with someone new today.",
    icon: "💕",
    cta: "Start Browsing",
    href: "/dating/discover",
    gradient: "from-pink-500/40 to-rose-500/20",
    badge: "8 new",
  },
  {
    id: "speed-dating",
    category: "dating",
    title: "⚡ Speed Dating Rooms",
    description: "5 min conversations. Real connections. Quick vibes.",
    icon: "⚡",
    cta: "Join Room",
    href: "/dating/speed-dating",
    gradient: "from-amber-500/40 to-orange-500/20",
  },
  {
    id: "my-profile",
    category: "dating",
    title: "👤 My Profile",
    description: "Update your bio, photos, and preferences.",
    icon: "👤",
    cta: "Edit Profile",
    href: "/dating/profile",
    gradient: "from-purple-500/40 to-brand-primary/20",
  },

  // Streaming
  {
    id: "watch-streams",
    category: "streaming",
    title: "📺 Watch Live",
    description: "Discover creators. Tip and chat live. Earn rewards.",
    icon: "📺",
    cta: "Browse Streams",
    href: "/tv/discover",
    gradient: "from-red-500/40 to-pink-500/20",
    badge: "12 live",
  },
  {
    id: "go-live",
    category: "streaming",
    title: "🎥 Go Live",
    description: "Start your stream. Earn from tips and ads.",
    icon: "🎥",
    cta: "Start Broadcast",
    href: "/tv/broadcast",
    gradient: "from-green-500/40 to-emerald-500/20",
  },
  {
    id: "analytics",
    category: "streaming",
    title: "📊 Analytics",
    description: "Track your viewers, earnings, and engagement.",
    icon: "📊",
    cta: "View Stats",
    href: "/tv/analytics",
    gradient: "from-blue-500/40 to-indigo-500/20",
  },

  // Earning
  {
    id: "chair-holder",
    category: "earning",
    title: "💺 Chair Holder",
    description: "Own a chair, earn daily dividends from platform fees.",
    icon: "💺",
    cta: "Buy Chair",
    href: "/earn/chair",
    gradient: "from-amber-600/40 to-yellow-500/20",
    badge: "Top earner",
  },
  {
    id: "referral-bounty",
    category: "earning",
    title: "🎯 Referral Bounty",
    description: "Invite friends. Earn $5-$50 per signup.",
    icon: "🎯",
    cta: "Share Code",
    href: "/earn/referral",
    gradient: "from-green-500/40 to-lime-500/20",
  },
  {
    id: "game-winnings",
    category: "earning",
    title: "🏆 Game Winnings",
    description: "Win tournaments. Climb leaderboards. Cash out earnings.",
    icon: "🏆",
    cta: "Join Tournament",
    href: "/games/tournaments",
    gradient: "from-yellow-500/40 to-orange-500/20",
  },
  {
    id: "streamer-earnings",
    category: "earning",
    title: "💰 Streamer Revenue",
    description: "Earn from tips, ads, subscriptions, and sponsorships.",
    icon: "💰",
    cta: "Go Live",
    href: "/tv/broadcast",
    gradient: "from-cyan-500/40 to-teal-500/20",
  },
];

const CATEGORIES = [
  { id: "gaming", label: "🎮 Gaming", color: "text-blue-400" },
  { id: "dating", label: "💕 Dating", color: "text-pink-400" },
  { id: "streaming", label: "📺 Streaming", color: "text-red-400" },
  { id: "earning", label: "💸 Earning", color: "text-green-400" },
] as const;

export function JobBoard() {
  return (
    <div className="w-full space-y-12">
      {CATEGORIES.map((category) => {
        const items = JOB_BOARD.filter((item) => item.category === category.id);

        return (
          <section key={category.id}>
            <div className="mb-6">
              <h2 className={`text-xl font-bold ${category.color}`}>
                {category.label}
              </h2>
              <div className="mt-1 h-0.5 w-12 bg-gradient-to-r from-brand-primary to-brand-accent" />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((item) => (
                <Link key={item.id} href={item.href}>
                  <GlobalCard
                    interactive
                    className="group relative h-full overflow-hidden p-5 transition-all hover:shadow-brand-glow"
                  >
                    {/* Badge */}
                    {item.badge && (
                      <div className="absolute right-0 top-0 rounded-bl-lg bg-brand-primary px-3 py-1 text-xs font-semibold text-white">
                        {item.badge}
                      </div>
                    )}

                    {/* Icon + Title */}
                    <div className="mb-3 flex items-start gap-3">
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-glass bg-gradient-to-br ${item.gradient} text-lg shadow-brand-glow`}
                      >
                        {item.icon}
                      </div>
                      <h3 className="text-sm font-bold leading-tight text-white">
                        {item.title}
                      </h3>
                    </div>

                    {/* Description */}
                    <p className="mb-4 text-xs leading-relaxed text-white/70">
                      {item.description}
                    </p>

                    {/* CTA */}
                    <div className="flex items-center gap-2 text-xs font-semibold text-brand-accent transition-transform group-hover:gap-3">
                      <span>{item.cta}</span>
                      <span className="text-lg">→</span>
                    </div>
                  </GlobalCard>
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
