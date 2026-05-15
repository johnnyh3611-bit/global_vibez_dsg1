/**
 * AmbassadorCarePackagePage — Walking Advertisements / Founder's Circle.
 *
 * Surfaces every element from Ambassador_Care_Package.pdf (Feb 2026):
 *   1. "Welcome to the High Table" hero — you don't use the app, you own
 *      the streets.
 *   2. Universal Master QR Setup card (scan vendors / sponsors).
 *   3. Three onboarding tracks: Hungry Vibez · Yellow Pages · Vibe Sponsors.
 *   4. The 3-Month Diamond Challenge — three monthly milestones unlock
 *      Tier-2 Equity Status.
 *   5. Four ways Ambassadors make money (Chair Dividends · Referral
 *      Bounties · Override Commissions · Bonus DSG Tokens).
 *
 * Routed at /ambassador and /ambassador-care-package.
 * Linked from: landing page, dashboard tile, Volumetric Galaxy.
 */
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Crown,
  QrCode,
  Utensils,
  BookOpen,
  Megaphone,
  TrendingUp,
  CheckCircle2,
  Vote,
  Coins,
  Award,
  Sparkles,
  ChevronRight,
} from "lucide-react";

const MILESTONES = [
  {
    month: 1,
    label: "Month 1 · The Foundation",
    icon: CheckCircle2,
    target: "Onboard 3 Vendors",
    detail: "Hungry Vibez or Yellow Pages — your first 3 sign-ups via Master QR.",
    grad: "from-emerald-400 via-cyan-500 to-blue-500",
  },
  {
    month: 2,
    label: "Month 2 · The Volume",
    icon: TrendingUp,
    target: "Drive 1,000 $VIBEZ",
    detail: "Total in-app revenue through your referred vendors.",
    grad: "from-amber-400 via-orange-500 to-rose-500",
  },
  {
    month: 3,
    label: "Month 3 · The Governance",
    icon: Vote,
    target: "Cast Your First Vote",
    detail: "On the next 50k Chair Block release. Skin-in-the-game governance.",
    grad: "from-fuchsia-400 via-violet-500 to-indigo-500",
  },
];

const ONBOARDING_TRACKS = [
  {
    id: "hungry_vibez",
    title: "Hungry Vibez",
    audience: "FOR RESTAURANTS",
    description: "Setup menu, delivery zones, and $VIBEZ discount rates.",
    icon: Utensils,
    grad: "from-rose-500 via-orange-500 to-amber-400",
  },
  {
    id: "yellow_pages",
    title: "Yellow Pages",
    audience: "FOR BUSINESSES",
    description: "Create digital storefront, lead forms, and VR showroom.",
    icon: BookOpen,
    grad: "from-amber-300 via-yellow-500 to-orange-500",
  },
  {
    id: "vibe_sponsors",
    title: "Vibe Sponsors",
    audience: "FOR SPONSORS",
    description: "Select DSG TV ad slots, movie premieres, and board game branding.",
    icon: Megaphone,
    grad: "from-fuchsia-500 via-violet-500 to-indigo-500",
  },
];

const EARNINGS = [
  {
    id: "chair_dividends",
    title: "Chair Dividends",
    detail: "Quarterly payouts from the 30% House Split.",
    icon: Crown,
    accent: "text-amber-300 border-amber-300/30",
  },
  {
    id: "referral_bounties",
    title: "Referral Bounties",
    detail: "Instant $VIBEZ bonus for every vendor setup completed.",
    icon: Coins,
    accent: "text-emerald-300 border-emerald-300/30",
  },
  {
    id: "override_commissions",
    title: "Override Commissions",
    detail: "Earn a percentage of every transaction your vendors make.",
    icon: TrendingUp,
    accent: "text-cyan-300 border-cyan-300/30",
  },
  {
    id: "bonus_dsg_tokens",
    title: "Bonus DSG Tokens",
    detail: "Top performers after 90 days unlock bonus tokens + Pit Boss rights.",
    icon: Award,
    accent: "text-fuchsia-300 border-fuchsia-300/30",
  },
];

export default function AmbassadorCarePackagePage() {
  const navigate = useNavigate();

  return (
    <div
      data-testid="ambassador-care-page"
      className="min-h-screen bg-[#06070d] text-white"
    >
      {/* Header */}
      <header className="sticky top-0 z-10 bg-gradient-to-b from-[#06070d] via-[#06070d]/90 to-transparent backdrop-blur-md border-b border-white/5">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            data-testid="ambassador-back-btn"
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-xs uppercase tracking-widest"
          >
            <ArrowLeft className="w-3 h-3" /> Dashboard
          </button>
          <div className="flex items-center gap-2 text-amber-300">
            <Sparkles className="w-3 h-3" />
            <span className="text-[10px] uppercase tracking-[0.4em]">
              Founder's Circle · Ambassador Care Package
            </span>
          </div>
          <div className="w-24" />
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-10 space-y-14">
        {/* Hero */}
        <section className="text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/15 border border-amber-300/30 text-amber-300 text-[10px] uppercase tracking-[0.4em] font-black mb-4"
          >
            <Crown className="w-3 h-3" /> Walking Advertisement
          </motion.div>
          <motion.h1
            className="text-4xl sm:text-5xl lg:text-6xl font-black bg-gradient-to-r from-amber-300 via-fuchsia-400 to-cyan-300 bg-clip-text text-transparent"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            Welcome to the High Table
          </motion.h1>
          <p className="mt-4 text-base md:text-lg text-white/70 max-w-3xl mx-auto leading-relaxed">
            You don't just use the app —{" "}
            <span className="text-amber-300 font-black">you own the streets.</span>{" "}
            This is your manual for turning your Founder Chairs into a lifetime of passive income.
          </p>
        </section>

        {/* Master QR Setup */}
        <section
          data-testid="ambassador-master-qr"
          className="rounded-3xl border-2 border-amber-300/30 bg-gradient-to-br from-amber-950/40 via-black/60 to-fuchsia-950/30 p-6 md:p-8"
        >
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="flex-shrink-0 w-28 h-28 md:w-32 md:h-32 rounded-2xl bg-white p-3 flex items-center justify-center shadow-[0_0_40px_-10px_rgba(251,191,36,0.5)]">
              <QrCode className="w-full h-full text-black" />
            </div>
            <div className="flex-1 text-center md:text-left">
              <div className="text-[10px] uppercase tracking-[0.4em] text-amber-300/80 mb-2">
                Step 1 · Universal Setup
              </div>
              <h2 className="text-2xl md:text-3xl font-black text-white mb-2">
                Your Master QR Code
              </h2>
              <p className="text-sm md:text-base text-white/70 leading-relaxed">
                Inside your app dashboard, find your Master QR Code. When you scan a vendor or sponsor, the app walks them through the specific setup for their business type — restaurants, businesses, or sponsors.
              </p>
            </div>
          </div>
        </section>

        {/* 3 Onboarding Tracks */}
        <section>
          <h2 className="text-lg font-bold uppercase tracking-[0.3em] text-white/80 mb-4 text-center">
            🎯 Three Tracks · One QR
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {ONBOARDING_TRACKS.map((t, i) => {
              const Icon = t.icon;
              return (
                <motion.div
                  key={t.id}
                  data-testid={`ambassador-track-${t.id}`}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08, duration: 0.4 }}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 relative overflow-hidden hover:border-amber-300/40 transition-colors"
                >
                  <div
                    className={`absolute -top-4 -right-4 w-32 h-32 rounded-full blur-3xl bg-gradient-to-br ${t.grad} opacity-25`}
                  />
                  <div className="relative">
                    <Icon className="w-8 h-8 text-white mb-3" />
                    <div className="text-[10px] uppercase tracking-widest text-fuchsia-300/80">
                      {t.audience}
                    </div>
                    <h3 className="text-2xl font-black text-white mt-1 mb-2">
                      {t.title}
                    </h3>
                    <p className="text-sm text-white/60 leading-relaxed">
                      {t.description}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </section>

        {/* 3-Month Diamond Challenge */}
        <section data-testid="ambassador-diamond-challenge">
          <div className="text-center mb-6">
            <h2 className="text-3xl md:text-4xl font-black text-white">
              The{" "}
              <span className="bg-gradient-to-r from-cyan-300 via-fuchsia-400 to-amber-300 bg-clip-text text-transparent">
                3-Month Diamond Challenge
              </span>
            </h2>
            <p className="text-sm text-white/60 mt-2 max-w-2xl mx-auto">
              Hit every monthly milestone to unlock{" "}
              <span className="text-amber-300 font-bold">Tier-2 Equity Status</span> at
              the end of 90 days.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {MILESTONES.map((m, i) => {
              const Icon = m.icon;
              return (
                <motion.div
                  key={m.month}
                  data-testid={`ambassador-milestone-month-${m.month}`}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1, duration: 0.4 }}
                  className="rounded-2xl border-2 border-white/10 bg-gradient-to-br from-white/[0.04] to-white/[0.01] p-5 relative"
                >
                  <div
                    className={`absolute top-3 right-3 px-2 py-0.5 rounded-full bg-gradient-to-r ${m.grad} text-black text-[9px] font-black uppercase tracking-widest`}
                  >
                    {`Month ${m.month}`}
                  </div>
                  <Icon className="w-7 h-7 text-white mb-3 mt-2" />
                  <div className="text-[10px] uppercase tracking-widest text-white/40">
                    {m.label}
                  </div>
                  <div className="text-xl font-black text-white mt-1">
                    {m.target}
                  </div>
                  <p className="text-xs text-white/60 mt-2 leading-relaxed">
                    {m.detail}
                  </p>
                </motion.div>
              );
            })}
          </div>
          <div className="mt-5 rounded-2xl border border-amber-300/30 bg-amber-500/5 p-4 md:p-5 text-center">
            <p className="text-sm md:text-base text-white/80 leading-relaxed">
              <span className="text-amber-300 font-black uppercase tracking-wide">
                Final Determination:
              </span>{" "}
              After 90 days, we review your <span className="text-white font-bold">Vibe Score</span>. Top performers receive{" "}
              <span className="text-fuchsia-300 font-bold">Bonus DSG Tokens</span> and exclusive{" "}
              <span className="text-cyan-300 font-bold">Pit Boss management rights.</span>
            </p>
          </div>
        </section>

        {/* 4 Ways to Earn */}
        <section data-testid="ambassador-earnings">
          <h2 className="text-lg font-bold uppercase tracking-[0.3em] text-white/80 mb-4 text-center">
            💰 Four Ways You Make Money
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {EARNINGS.map((e, i) => {
              const Icon = e.icon;
              return (
                <motion.div
                  key={e.id}
                  data-testid={`ambassador-earning-${e.id}`}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06, duration: 0.4 }}
                  className={`rounded-2xl border-2 ${e.accent} bg-white/[0.03] p-5 flex items-start gap-4`}
                >
                  <Icon className={`w-8 h-8 flex-shrink-0 ${e.accent.split(" ")[0]}`} />
                  <div>
                    <div className="text-base md:text-lg font-black text-white">
                      {e.title}
                    </div>
                    <p className="text-xs md:text-sm text-white/60 mt-1 leading-relaxed">
                      {e.detail}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </section>

        {/* CTA */}
        <section className="text-center">
          <button
            type="button"
            onClick={() => navigate("/equity")}
            data-testid="ambassador-cta-equity"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-amber-400 to-fuchsia-500 hover:from-amber-300 hover:to-fuchsia-400 text-black text-sm md:text-base font-black uppercase tracking-wider shadow-[0_0_30px_-8px_rgba(251,191,36,0.6)] transition-all"
          >
            See Your Equity & Governance <ChevronRight className="w-4 h-4" />
          </button>
          <p className="mt-4 text-[10px] uppercase tracking-[0.3em] text-white/30">
            Sourced from Ambassador_Care_Package.pdf · Founder's Circle
          </p>
        </section>
      </main>
    </div>
  );
}
