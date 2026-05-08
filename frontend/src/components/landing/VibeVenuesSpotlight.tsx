/**
 * VibeVenuesSpotlight — landing page surface for the Vibe Venues
 * utility room (hourly private-space rentals + Vibe Artisan services).
 *
 * Spec source: Global_Vibez_DSG_Vibe_Venues_Manifesto.pdf
 *              Global_Vibez_DSG_VibeVenues_Logic.pdf
 *
 * Key rules rendered here:
 *   • Hourly rental blocks: [3, 6, 9, 12, 24]
 *   • Artisan membership: $20 / month
 *   • Artisan early-access prep window: 1–2 hours
 *   • Smart Escrow of $DSG until Vibe-Check
 *   • Architecture Phase chat between User + Artisan
 *   • AAA Visual Standards (3D/360° Walkthroughs + Dish Overlays)
 *   • AI-driven "Perfect Mate" setup
 */
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Home,
  ChefHat,
  Lock,
  MessageSquare,
  Box,
  Sparkles,
  Clock,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";

const HOURLY_BLOCKS = [3, 6, 9, 12, 24];

const BOOKING_FLOW = [
  {
    step: 1,
    title: "Lock $DSG in Smart Escrow",
    body: "User books a Vibe Venue + optional Vibe Artisan. Platform locks the total $DSG in smart escrow until the event's Vibe-Check.",
    icon: Lock,
  },
  {
    step: 2,
    title: "Open Architecture-Phase Chat",
    body: "Private Vibe-Sync Chat opens between User and Artisan to finalize setup, decor, menu, and any special pricing.",
    icon: MessageSquare,
  },
  {
    step: 3,
    title: "Artisan Early-Access Prep",
    body: "Artisan granted 1–2hr early entry — preps food, decor, and the curated date environment before the User arrives.",
    icon: ChefHat,
  },
  {
    step: 4,
    title: "Vibe-Check Releases Funds",
    body: "At event start, Vibe-Check confirms everyone delivered. Escrow releases: Host gets Venue Fee, Artisan gets Service Fee, Platform retains its % (50K Chair holders share in it).",
    icon: ShieldCheck,
  },
];

export default function VibeVenuesSpotlight() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6" data-testid="vibe-venues-spotlight">
      {/* Hero strip */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="p-6 rounded-2xl bg-gradient-to-br from-purple-950/70 via-fuchsia-950/50 to-[#0F0720] border border-fuchsia-400/30"
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-xl bg-fuchsia-500/15 border border-fuchsia-400/40 flex items-center justify-center">
            <Home className="w-6 h-6 text-fuchsia-300" />
          </div>
          <div>
            <p className="text-xs font-mono uppercase tracking-[0.3em] text-fuchsia-300/90">
              Utility Room · Manifesto v1
            </p>
            <h3 className="text-2xl font-black text-white">Vibe Venues</h3>
          </div>
        </div>
        <p className="text-sm text-fuchsia-100/85 leading-relaxed max-w-3xl">
          Private space rentals on an{" "}
          <span className="text-white font-semibold">hourly high-turnover</span>{" "}
          model. Pair any House with a{" "}
          <span className="text-fuchsia-300 font-semibold">Vibe Artisan</span>{" "}
          (chef / setter) who arrives 1–2 hrs early and turns the space into a
          curated date environment before you walk in. Every booking is held in{" "}
          <span className="text-cyan-300 font-semibold">$DSG smart escrow</span>{" "}
          until the event's Vibe-Check clears — no deposits disappearing, no
          chargebacks.
        </p>
      </motion.div>

      {/* Hourly block pills */}
      <div className="p-5 rounded-2xl bg-[#0B0618] border border-fuchsia-500/25">
        <div className="flex items-center gap-2 mb-3">
          <Clock className="w-4 h-4 text-fuchsia-300" />
          <p className="text-xs font-mono uppercase tracking-[0.3em] text-fuchsia-300/80">
            Hourly Rental Blocks
          </p>
        </div>
        <div className="flex flex-wrap gap-2" data-testid="vv-hourly-blocks">
          {HOURLY_BLOCKS.map((h) => (
            <span
              key={h}
              className="px-4 py-2 rounded-full text-sm font-black bg-fuchsia-500/10 text-fuchsia-200 border border-fuchsia-500/30"
            >
              {h} hr
            </span>
          ))}
        </div>
        <p className="text-xs text-purple-300/70 mt-3">
          Pick the block that fits your date, event, or shoot. High turnover =
          premium houses stay bookable instead of sitting idle for a weekend.
        </p>
      </div>

      {/* Two-track revenue model */}
      <div className="grid md:grid-cols-2 gap-4">
        <RevenueCard
          icon={Home}
          tone="fuchsia"
          eyebrow="Host Track"
          title="List a House"
          amount="% per booking"
          body="Rent out your curated space by the hour. Platform retains a service %; the rest settles to you in $DSG after Vibe-Check."
          testid="vv-host-card"
        />
        <RevenueCard
          icon={ChefHat}
          tone="orange"
          eyebrow="Artisan Track"
          title="Become a Vibe Artisan"
          amount="$20 / month"
          body="Chefs, decorators, setters. Flat monthly unlocks Signature Commercials + Perfect-Mate dispatch + 1-2hr early access prep window."
          testid="vv-artisan-card"
        />
      </div>

      {/* Booking flow — 4 steps */}
      <div>
        <p className="text-xs font-mono uppercase tracking-[0.3em] text-fuchsia-300/80 mb-3">
          Smart Escrow Booking Flow
        </p>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3" data-testid="vv-booking-flow">
          {BOOKING_FLOW.map((s) => {
            const Icon = s.icon;
            return (
              <div
                key={s.step}
                className="p-4 rounded-2xl bg-[#0B0618] border border-fuchsia-500/20 hover:border-fuchsia-400/50 transition-all"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-7 h-7 rounded-full bg-fuchsia-500/20 text-fuchsia-300 text-xs font-black flex items-center justify-center border border-fuchsia-500/40">
                    {s.step}
                  </span>
                  <Icon className="w-4 h-4 text-fuchsia-300" />
                </div>
                <p className="text-sm font-black text-white mb-1">{s.title}</p>
                <p className="text-[11px] text-purple-300/80 leading-relaxed">
                  {s.body}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* AAA Visual Standards + AI Perfect Mate */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="p-5 rounded-2xl bg-[#0B0618] border border-cyan-500/25">
          <div className="flex items-center gap-2 mb-2">
            <Box className="w-4 h-4 text-cyan-300" />
            <p className="text-xs font-mono uppercase tracking-[0.3em] text-cyan-300/80">
              AAA Visual Standards
            </p>
          </div>
          <p className="text-sm text-cyan-100/85 leading-relaxed">
            Every listing ships with a{" "}
            <span className="text-white font-semibold">3D / 360° walkthrough</span>{" "}
            of the space plus{" "}
            <span className="text-white font-semibold">Dish Overlays</span>{" "}
            from artisans — you see the actual meal on the actual table in the
            actual room before you book.
          </p>
        </div>
        <div className="p-5 rounded-2xl bg-[#0B0618] border border-purple-500/25">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-purple-300" />
            <p className="text-xs font-mono uppercase tracking-[0.3em] text-purple-300/80">
              AI-Driven "Perfect Mate"
            </p>
          </div>
          <p className="text-sm text-purple-100/85 leading-relaxed">
            Pick a vibe — the platform auto-matches your House with a Vibe
            Artisan whose Signature Commercials fit the date. One tap,
            curated environment, no coordination headaches.
          </p>
        </div>
      </div>

      {/* Technical infrastructure snippet */}
      <div className="p-5 rounded-2xl bg-[#0B0618] border border-fuchsia-500/25">
        <p className="text-xs font-mono uppercase tracking-[0.3em] text-fuchsia-300/80 mb-3">
          Technical Infrastructure
        </p>
        <pre
          className="text-[11px] leading-5 p-4 rounded-lg bg-black/60 border border-fuchsia-500/15 text-fuchsia-200 font-mono overflow-x-auto"
          data-testid="vv-tech-infra"
        >
{`// VIBE VENUES — Integrated Booking System
const VibeVenuesSystem = {
  propertyRental: "Hourly (Percentage Fee)",
  vibeArtisan:    "Monthly Membership ($20.00)",
  safety:         "Specialized Crew Dispute Resolution",
  visuals:        "3D Walkthrough + Dish Overlay",
  escrow:         "Smart $DSG lock → Vibe-Check release",
  earlyAccess:    "1–2hr artisan prep window",
};`}
        </pre>
      </div>

      {/* CTAs */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => navigate("/vibe-venues")}
          className="px-5 py-3 rounded-xl bg-fuchsia-500 hover:bg-fuchsia-400 text-white font-bold shadow-[0_0_22px_rgba(217,70,239,0.45)] transition-all flex items-center gap-2"
          data-testid="vv-spotlight-explore-btn"
        >
          <Home className="w-4 h-4" /> Browse Vibe Venues
        </button>
        <button
          onClick={() => navigate("/vibe-venues/host")}
          className="px-5 py-3 rounded-xl border border-fuchsia-400/40 text-fuchsia-200 hover:bg-fuchsia-500/10 hover:text-white font-bold transition-all flex items-center gap-2"
          data-testid="vv-host-cta-btn"
        >
          List a House <ArrowRight className="w-4 h-4" />
        </button>
        <button
          onClick={() => navigate("/vibe-venues/artisan")}
          className="px-5 py-3 rounded-xl border border-orange-400/40 text-orange-200 hover:bg-orange-500/10 hover:text-white font-bold transition-all flex items-center gap-2"
          data-testid="vv-artisan-cta-btn"
        >
          <ChefHat className="w-4 h-4" /> Become a Vibe Artisan · $20/mo
        </button>
      </div>
    </div>
  );
}

const RevenueCard: React.FC<{
  icon: React.ElementType;
  tone: "fuchsia" | "orange";
  eyebrow: string;
  title: string;
  amount: string;
  body: string;
  testid?: string;
}> = ({ icon: Icon, tone, eyebrow, title, amount, body, testid }) => {
  const tones = {
    fuchsia: "border-fuchsia-500/30 bg-fuchsia-500/5 text-fuchsia-300",
    orange: "border-orange-500/30 bg-orange-500/5 text-orange-300",
  }[tone];
  return (
    <div
      className={`p-5 rounded-2xl border ${tones} bg-[#0B0618]`}
      data-testid={testid}
    >
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-5 h-5" />
        <p className="text-xs font-mono uppercase tracking-[0.3em]">{eyebrow}</p>
      </div>
      <p className="text-lg font-black text-white">{title}</p>
      <p className={`text-sm font-bold mb-2`}>{amount}</p>
      <p className="text-xs text-purple-200/80 leading-relaxed">{body}</p>
    </div>
  );
};
