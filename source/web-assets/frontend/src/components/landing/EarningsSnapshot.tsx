/**
 * EarningsSnapshot — always-visible grid of every way a user earns on
 * Global Vibez. Founder asked for this to live above the fold so
 * visitors don't need to click into the Welcome Letter or Ways To Earn
 * accordion to see the full earning surface area.
 *
 * Sourced from the v12 Sovereign Final Vault + production-live economy
 * endpoints. Each card is skim-friendly (4-5 words per headline) with
 * the mechanic one layer down.
 */
import {
  Sparkles, Crown, Car, Music, Users, Flame, DollarSign, Gift,
  Pickaxe, Gauge, Banknote, Landmark,
} from "lucide-react";

type Card = {
  Icon: React.ComponentType<{ className?: string }>;
  headline: string;
  rate: string;
  body: string;
  tone: string;
  testId: string;
};

const CARDS: Card[] = [
  {
    Icon: Pickaxe,
    headline: "5× Chair Mining",
    rate: "Daily ₵ pool",
    body: "Holders earn 5× the daily ₵ pool vs non-holders. Weight stacks by tier: Genius 3× / Genesis 2× / Apex 1×.",
    tone: "border-amber-500/40 bg-amber-950/20 text-amber-200",
    testId: "earnings-chair-mining",
  },
  {
    Icon: Landmark,
    headline: "13.5% Sovereign Tax",
    rate: "Every game + tip + ride",
    body: "Every taxable transaction throws 13.5% to the Treasury Vault, weighted back to chair holders by tier.",
    tone: "border-rose-500/40 bg-rose-950/20 text-rose-200",
    testId: "earnings-sovereign-tax",
  },
  {
    Icon: Users,
    headline: "3.5% Ambassador Dividend",
    rate: "+ free chair at 5 sponsors",
    body: "Refer 5 verified sponsors → 1 free chair unlocked + 3.5% of the tax bucket on their activity, forever.",
    tone: "border-fuchsia-500/40 bg-fuchsia-950/20 text-fuchsia-200",
    testId: "earnings-ambassador-dividend",
  },
  {
    Icon: Gauge,
    headline: "5% Ambassador Override",
    rate: "Mining kickback",
    body: "Extra 5% kickback on mining activity you drive through the network. Stacks with the 3.5% dividend.",
    tone: "border-violet-500/40 bg-violet-950/20 text-violet-200",
    testId: "earnings-ambassador-override",
  },
  {
    Icon: Car,
    headline: "70/30 Ride Split",
    rate: "30% VibeRidez tax",
    body: "Drivers keep 70% of every post-tax fare. Live Solana on-chain split. Stream the drive → viewers tip.",
    tone: "border-emerald-500/40 bg-emerald-950/20 text-emerald-200",
    testId: "earnings-ride-split",
  },
  {
    Icon: Music,
    headline: "Tip-to-Skip / Tip-to-Add",
    rate: "100 ₵ / 50 ₵ · 70% driver",
    body: "Passengers pay 100 ₵ to skip, 50 ₵ to queue a track. Driver earns 70% post-tax on every tip.",
    tone: "border-cyan-500/40 bg-cyan-950/20 text-cyan-200",
    testId: "earnings-tip-skip",
  },
  {
    Icon: Crown,
    headline: "4:1 Bridge + 1.5× Genius",
    rate: "₵ → DSG on Solana",
    body: "Convert ₵ to DSG at 4:1. Genius-phase holders get an additional 1.5× bonus during the Genius window.",
    tone: "border-indigo-500/40 bg-indigo-950/20 text-indigo-200",
    testId: "earnings-bridge",
  },
  {
    Icon: Flame,
    headline: "Power Hour Multipliers",
    rate: "All earn rates ×",
    body: "Scheduled windows when every ₵ earn rate multiplies. Chair weights stack with the Power Hour boost.",
    tone: "border-orange-500/40 bg-orange-950/20 text-orange-200",
    testId: "earnings-power-hour",
  },
  {
    Icon: Sparkles,
    headline: "Game Win Payouts",
    rate: "Post-tax, pre-animation",
    body: "Spades / Bid Whist / Vibez 654 wins hit your wallet post-tax. Win animation shows the real net ₵.",
    tone: "border-lime-500/40 bg-lime-950/20 text-lime-200",
    testId: "earnings-game-payouts",
  },
  {
    Icon: Gift,
    headline: "Reserve Drip",
    rate: "200M DSG · 12 months",
    body: "When chair #50,000 sells the 200M Founder Vault starts a 12-month drip to holders. 25% immediate, balance monthly.",
    tone: "border-pink-500/40 bg-pink-950/20 text-pink-200",
    testId: "earnings-reserve-drip",
  },
  {
    Icon: DollarSign,
    headline: "Creator Revenue Share",
    rate: "30% prep / 70% on Vibe-Check",
    body: "$20/mo Signature membership unlocks bookings. 30% prep-fee on confirm, 70% on Vibe-Check completion.",
    tone: "border-teal-500/40 bg-teal-950/20 text-teal-200",
    testId: "earnings-creator-share",
  },
  {
    Icon: Banknote,
    headline: "Loyalty Stakes",
    rate: "Converts each quarter",
    body: "+200 per Premium renewal, +30/$1 creator rev, +10/$1 deposit, +3/hand, +2/ride, +1/JFTN visit. Auto-accrued.",
    tone: "border-sky-500/40 bg-sky-950/20 text-sky-200",
    testId: "earnings-loyalty-stakes",
  },
];

export default function EarningsSnapshot() {
  return (
    <section
      className="bg-gradient-to-b from-black via-neutral-950 to-black py-12 px-6 border-t border-neutral-900"
      data-testid="earnings-snapshot-section"
    >
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <p className="text-[10px] font-mono uppercase tracking-[0.4em] text-emerald-400">
            every way you earn
          </p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black italic text-white uppercase tracking-tighter mt-1">
            12 Earn Paths. One Platform.
          </h2>
          <p className="text-sm text-neutral-400 mt-3 max-w-2xl mx-auto">
            Every mechanic below is live in the backend right now. No waitlist.
            No "coming soon." Own a chair → earn from all of them.
          </p>
        </div>

        <div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
          data-testid="earnings-snapshot-grid"
        >
          {CARDS.map((c) => (
            <div
              key={c.testId}
              data-testid={c.testId}
              className={`rounded-xl border ${c.tone} p-4 flex gap-3 items-start transition hover:brightness-125`}
            >
              <div className="w-10 h-10 rounded-lg border border-white/10 bg-black/30 flex items-center justify-center flex-shrink-0">
                <c.Icon className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="font-black text-base text-white uppercase tracking-tight">
                  {c.headline}
                </h3>
                <p className="text-[10px] font-mono uppercase tracking-wider opacity-70 mt-0.5">
                  {c.rate}
                </p>
                <p className="text-xs text-neutral-300 mt-1.5 leading-relaxed">
                  {c.body}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 text-center text-xs text-neutral-500">
          Full mechanics, monthly scenarios, and locked regression tests in the
          <strong className="text-emerald-400"> Ways To Earn </strong>
          section below.
        </div>
      </div>
    </section>
  );
}
