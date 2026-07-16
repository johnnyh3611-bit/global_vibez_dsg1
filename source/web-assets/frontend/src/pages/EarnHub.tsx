/**
 * EarnHub — /earn monetization landing.
 *
 * Surfaces the four earning paths from DESIGN_STRATEGY without inventing
 * new backend surface. Every CTA points at a route that already mounts.
 * Phase 3: persona-ordered paths, chair ROI calculator, social proof.
 */
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { DollarSign, Users, Trophy, Radio, Armchair } from "lucide-react";
import AppFooter from "@/components/AppFooter";
import { triggerHaptic } from "@/hooks/useGestures";
import { ChairRoiCalculator } from "@/components/earn/ChairRoiCalculator";
import { SocialProofStrip } from "@/components/common/SocialProofStrip";
import {
  earnPathOrderForPersona,
  PERSONA_LABEL,
  resolvePersona,
} from "@/lib/persona";
import { readRecentGames } from "@/hooks/useRecommendedGames";

const PATHS = [
  {
    id: "chair",
    title: "Chair Holder",
    blurb: "Own a chair and earn passive dividends from platform fees.",
    cta: "Browse chairs",
    href: "/chair-vault",
    Icon: Armchair,
    accent: "text-amber-300 border-amber-400/40 bg-amber-500/10",
  },
  {
    id: "referral",
    title: "Referral Bounty",
    blurb: "Invite friends and earn when they join and play.",
    cta: "Get your code",
    href: "/referral",
    Icon: Users,
    accent: "text-emerald-300 border-emerald-400/40 bg-emerald-500/10",
  },
  {
    id: "games",
    title: "Game Winnings",
    blurb: "Win tables and tournaments, then cash out through your wallet.",
    cta: "Open games",
    href: "/games",
    Icon: Trophy,
    accent: "text-yellow-300 border-yellow-400/40 bg-yellow-500/10",
  },
  {
    id: "stream",
    title: "Streamer Revenue",
    blurb: "Go live, earn tips, and track performance in studio analytics.",
    cta: "Open studio",
    href: "/streamer/studio",
    Icon: Radio,
    accent: "text-cyan-300 border-cyan-400/40 bg-cyan-500/10",
  },
] as const;

export default function EarnHub() {
  const persona = useMemo(
    () =>
      resolvePersona({
        recentGameCount: readRecentGames().length,
      }),
    []
  );

  const orderedPaths = useMemo(() => {
    const order = earnPathOrderForPersona(persona);
    return [...PATHS].sort(
      (a, b) => order.indexOf(a.id) - order.indexOf(b.id)
    );
  }, [persona]);

  return (
    <div
      className="min-h-screen bg-[radial-gradient(ellipse_at_top,_#1a1030_0%,_#050508_55%,_#000_100%)] text-white"
      data-testid="earn-hub-page"
    >
      <div className="container mx-auto max-w-5xl px-4 py-10 sm:py-14">
        <header className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-400">
            Play to earn
          </p>
          <h1 className="mt-3 flex items-center gap-3 text-3xl font-bold sm:text-5xl">
            <DollarSign className="h-8 w-8 text-emerald-400 sm:h-10 sm:w-10" />
            Earn on Global Vibez
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-white/65 sm:text-base">
            Four direct paths — chairs, referrals, games, and streaming. Sorted
            for a{" "}
            <span className="font-semibold text-white/85">
              {PERSONA_LABEL[persona]}
            </span>
            .
          </p>
        </header>

        <SocialProofStrip className="mb-8" />

        <div className="mb-8">
          <ChairRoiCalculator />
        </div>

        <section className="grid gap-4 sm:grid-cols-2" aria-label="Earning paths">
          {orderedPaths.map(
            ({ id, title, blurb, cta, href, Icon, accent }, index) => (
              <motion.div
                key={id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  delay: index * 0.06,
                  type: "spring",
                  stiffness: 260,
                  damping: 24,
                }}
              >
                <Link
                  to={href}
                  data-testid={`earn-path-${id}`}
                  onClick={() => triggerHaptic("medium")}
                  className={`block rounded-2xl border p-5 transition hover:scale-[1.01] hover:bg-white/5 active:scale-[0.99] ${accent}`}
                >
                  <div className="mb-3 flex items-center gap-3">
                    <Icon className="h-5 w-5" />
                    <h2 className="text-lg font-bold text-white">{title}</h2>
                  </div>
                  <p className="mb-4 text-sm text-white/70">{blurb}</p>
                  <span className="text-sm font-semibold text-white">
                    {cta} →
                  </span>
                </Link>
              </motion.div>
            )
          )}
        </section>

        <div className="mt-10 flex flex-wrap gap-3 text-sm">
          <Link
            to="/wallet"
            className="rounded-full border border-white/15 px-4 py-2 text-white/80 hover:bg-white/5"
          >
            Open wallet
          </Link>
          <Link
            to="/dashboard"
            className="rounded-full border border-white/15 px-4 py-2 text-white/80 hover:bg-white/5"
          >
            Back to dashboard
          </Link>
          <Link
            to="/how-chairs-work"
            className="rounded-full border border-white/15 px-4 py-2 text-white/80 hover:bg-white/5"
          >
            How chairs work
          </Link>
        </div>
      </div>
      <AppFooter />
    </div>
  );
}
