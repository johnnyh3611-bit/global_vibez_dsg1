/**
 * "Latest Additions" showcase for the landing page bottom.
 *
 * Lives in `LandingNeonGaming.tsx` between the hero/feature carousel and
 * the Mission Briefing. Surfaces every flagship feature added in 2026 so
 * a brand-new visitor can see at a glance what the platform offers.
 *
 * Design intent: glass cards on the dark neon grid, each with a single
 * gradient icon, one-line tagline, and a deep-link CTA to the relevant
 * section. We avoid shouting "$" anywhere — currency is always ₵.
 */
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Crown,
  Coins,
  Phone,
  Car,
  Sparkles,
  Dice5,
  Spade,
  Heart,
  Music2,
  ShieldCheck,
  Gem,
} from "lucide-react";

type Feature = {
  to: string;
  title: string;
  tag: string;
  body: string;
  icon: typeof Crown;
  color: string;
  testid: string;
};

const FEATURES: Feature[] = [
  {
    to: "/chair-vault",
    title: "Founder Chairs",
    tag: "Phase pricing · $20 → $100 → $250 (Genius → Genesis → Apex)",
    body:
      "Park a loyalty seat in the Vault. Stay Premium and active — get auto-paid every quarter from the community pool, weighted by chairs you own.",
    icon: Crown,
    color: "from-amber-400 to-rose-500",
    testid: "landing-feature-chairs",
  },
  {
    to: "/vibe-stakes",
    title: "Vibe Stakes",
    tag: "Earn loyalty · auto-paid quarterly",
    body:
      "Every game played, ride completed, deposit made, and minute on Vibe Phone earns Vibe Stakes. Surge multipliers, treasury report, anonymized leaderboard.",
    icon: Coins,
    color: "from-cyan-400 to-emerald-500",
    testid: "landing-feature-stakes",
  },
  {
    to: "/founders-pass",
    title: "Casino House Tiers",
    tag: "1.5× → 20× stake multipliers",
    body:
      "🃏 The Slots ($19) · 🎴 Blackjack ($99) · 🎲 Craps ($399) · ♠️ Spades Royale ($1,499). Sequential founder numbers, perks-for-life.",
    icon: Spade,
    color: "from-fuchsia-500 to-pink-500",
    testid: "landing-feature-founders-pass",
  },
  {
    to: "/spades",
    title: "Spades AAA",
    tag: "Premium oval table · live multiplayer",
    body:
      "AAA-grade hand-painted card art, live BidWhist multiplayer, Renegade detection, and animated trick-winner FX rolling out next.",
    icon: Heart,
    color: "from-violet-400 to-fuchsia-500",
    testid: "landing-feature-spades",
  },
  {
    to: "/games/vibez-654",
    title: "Vibez 654",
    tag: "Florida-style dice · friend-aware",
    body:
      "House-rake/burn dice rounds with anti-collusion checks, optional ad-watch unlocks, and friend-notifier when your crew is at the table.",
    icon: Dice5,
    color: "from-amber-300 to-yellow-500",
    testid: "landing-feature-vibez654",
  },
  {
    to: "/vibe-ridez",
    title: "VibeRidez · Creator Fleet",
    tag: "AR/VR streaming · Solana 70/20/10 fare splits · VibeXP",
    body:
      "Drive, stream, earn. Kill-Switch privacy with AI passenger masking. Celestial Glasshouse AR HUD. On-chain Rust contract splits every fare 70% driver / 20% platform / 10% liquidity pool. VibeXP converts to $DSG at TGE.",
    icon: Car,
    color: "from-violet-400 to-fuchsia-500",
    testid: "landing-feature-ridez",
  },
  {
    to: "/vibe-phone",
    title: "Vibe Phone",
    tag: "In-app voice + AI translation",
    body:
      "Encrypted in-app calling powered by Agora. Vibe Suites, JFTN gated rooms, and live AI voice mirroring across languages.",
    icon: Phone,
    color: "from-emerald-400 to-teal-500",
    testid: "landing-feature-phone",
  },
  {
    to: "/wallet",
    title: "₵ Solana Wallet",
    tag: "Real Solana SPL · Helius indexer",
    body:
      "Deposit SOL → mint Vibez Coins (₵) at 100:1, send SOL via QR, and stack stakes for every $1 you bring in (+10 stakes per $1).",
    icon: Gem,
    color: "from-purple-400 to-indigo-500",
    testid: "landing-feature-wallet",
  },
  {
    to: "/subscriptions",
    title: "Premium · Dynamic Pricing",
    tag: "$9.99 today · grandfathered forever",
    body:
      "Lock in today's rate before next quarter's bump. Premium adds 1.5× stake boost, premium voice models, and gates every reward distribution.",
    icon: Sparkles,
    color: "from-rose-400 to-fuchsia-500",
    testid: "landing-feature-premium",
  },
  {
    to: "/feed",
    title: "Music + Feed",
    tag: "Spotify-mirror · creator monetization",
    body:
      "Mirror your Spotify, drop Vibe Posts, build a Vibe Suite, and earn ₵ from creator-hosted JFTN rooms with 70/30 revenue share.",
    icon: Music2,
    color: "from-pink-400 to-rose-500",
    testid: "landing-feature-feed",
  },
  {
    to: "/admin",
    title: "God-Mode Audit",
    tag: "Every ₵ tracked, public ledger",
    body:
      "Treasury reserve dashboard, Vibe Health Index, full audit log of every escrow and payout. Admins see everything; members see anonymized totals.",
    icon: ShieldCheck,
    color: "from-amber-400 to-orange-500",
    testid: "landing-feature-godmode",
  },
];

export default function LatestAdditions() {
  return (
    <section
      className="relative z-10 px-6 py-20 border-t border-purple-500/30"
      data-testid="landing-latest-additions"
    >
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 bg-fuchsia-500/10 border border-fuchsia-400/30 rounded-full px-3 py-1 text-[10px] uppercase tracking-widest text-fuchsia-300">
            <Sparkles className="w-3 h-3" /> Now live · 11 flagship systems
          </div>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black mt-4 leading-tight">
            <span className="text-white">Everything we've built</span>{" "}
            <span className="text-transparent bg-gradient-to-r from-fuchsia-500 via-amber-400 to-cyan-400 bg-clip-text">
              for you.
            </span>
          </h2>
          <p className="text-base sm:text-lg text-purple-200/80 mt-4 max-w-3xl mx-auto">
            Sign up once. Get the games, the rides, the chairs, the wallet,
            the voice phone, and the loyalty payouts — all powered by ₵
            Vibez Coins. No app store. No ads. No middleman.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((f, i) => {
            const Icon = f.icon;
            return (
              <motion.div
                key={f.to}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.04 }}
              >
                <Link
                  to={f.to}
                  data-testid={f.testid}
                  className="group block h-full rounded-2xl border border-purple-500/20 bg-white/[0.03] backdrop-blur-3xl p-6 hover:border-fuchsia-400/60 hover:bg-white/[0.06] transition-all"
                >
                  <div
                    className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${f.color} flex items-center justify-center shadow-lg`}
                  >
                    <Icon className="w-6 h-6 text-black" />
                  </div>
                  <p className="mt-4 text-[10px] uppercase tracking-widest text-fuchsia-300 font-bold">
                    {f.tag}
                  </p>
                  <h3 className="mt-1 text-xl font-black text-white">{f.title}</h3>
                  <p className="mt-2 text-[13px] text-purple-200/80 leading-relaxed">
                    {f.body}
                  </p>
                  <p className="mt-4 text-[11px] uppercase tracking-widest text-amber-300/80 group-hover:text-amber-300 transition-colors">
                    Explore →
                  </p>
                </Link>
              </motion.div>
            );
          })}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mt-12 text-center"
        >
          <p className="text-sm text-purple-300/70">
            All features powered by{" "}
            <span className="text-amber-300 font-bold">₵ Vibez Coins</span>{" "}
            — the in-platform utility currency. Sign up free, earn through
            play.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
