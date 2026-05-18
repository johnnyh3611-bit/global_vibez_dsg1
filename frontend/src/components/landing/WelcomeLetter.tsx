/**
 * WelcomeLetter — onboarding explainer for the Vibez chair economy.
 *
 * Replaces the "see all 10 tiers right away" approach with a friendlier
 * narrative that walks a brand-new visitor through:
 *   1. What is a chair, plain English
 *   2. Why the price ramps over time (early-believer reward)
 *   3. The current entry price + what they get
 *   4. The Reserve Vault concept (community-locked future supply)
 *   5. The eventual ceiling (we tell them the FINAL price quietly so
 *      they understand the upside without being hit with a chart of
 *      10 numbers)
 *
 * Designed to be read in 30 seconds. Encourages sign-up without
 * implying yield/capital appreciation (legal hygiene).
 */
import { useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  Crown,
  Sparkles,
  Lock,
  TrendingUp,
  HeartHandshake,
  ChevronDown,
  ChevronUp,
  Calculator,
  DollarSign,
  Shield,
} from "lucide-react";

export default function WelcomeLetter() {
  const [showCeiling, setShowCeiling] = useState(false);

  return (
    <section
      className="bg-gradient-to-b from-black via-fuchsia-950/10 to-black py-24 px-6 border-t border-neutral-900"
      data-testid="welcome-letter-section"
    >
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-12">
          <p className="text-xs font-mono uppercase tracking-[0.4em] text-fuchsia-400 mb-3">
            A Letter from the Founders
          </p>
          <h2 className="text-4xl sm:text-5xl font-black italic text-white uppercase tracking-tighter">
            How a Chair Works
          </h2>
          <p className="text-neutral-400 mt-4">
            30 seconds of plain-English context — no jargon, no charts.
          </p>
        </div>

        <div className="space-y-8">
          <Beat
            Icon={HeartHandshake}
            title="A chair is your seat at the table"
            body="Holding a chair means you helped fund the platform when it was a seed. As the platform grows, chair-holders get a share of platform revenue, voting rights on big decisions, and lifetime perks like priority queue, custom badges, and access to exclusive events. You don't have to log in every day — your chair earns in the background while you live your life."
            tone="emerald"
            testId="welcome-beat-what"
          />

          <Beat
            Icon={Sparkles}
            title="One floor seat. Then live valuation takes over."
            body="Genius is the only fixed-supply phase — 50,000 seats at a flat $20, ever. The moment Genius sells out, chair price flips to the live Equity Master matrix: derived from monthly app revenue every quarter. Anchored milestones — $18 Floor at $500K/mo, $99 Genesis at $2.75M/mo, $360 Diamond at $10M/mo, $1,800 Platinum at $50M/mo. Early believers lock in a $20 seat whose dividend climbs with the platform. No supply guesswork, no $5-stair-step grind."
            tone="cyan"
            testId="welcome-beat-why-ramp"
          />

          <Beat
            Icon={Crown}
            title="Genius is open right now — $20 a chair"
            body="If you're reading this in early access, you're a Genius-eligible buyer. Chairs at this tier carry the 3× earn-rate multiplier for life. That weight is locked at purchase time — even after Genius sells out and the price moves to live revenue-driven valuation, your chair never loses its multiplier. Cap: 100 chairs per wallet during Genius to protect early equity from whales."
            tone="fuchsia"
            testId="welcome-beat-current-price"
          />

          <Beat
            Icon={Lock}
            title="Genius is the gate that unlocks everything"
            body={
              "Genius caps at 50,000 chairs ($1M ceiling raise). The instant chair #50,000 sells, two things flip simultaneously: chair pricing switches from flat $20 to the live Equity Master valuation, AND the 200M DSG Founder Vault begins a 12-month release (25% immediate, balance monthly). Crew wallets hold 50M DSG exempt from ownership caps. This protects the floor for early holders AND roughly 2×'s payouts when we cross critical mass."
            }
            tone="amber"
            testId="welcome-beat-reserve"
          />

          <Beat
            Icon={DollarSign}
            title="Every way your chair earns you money"
            body={
              <ul className="mt-2 space-y-1.5 text-sm text-fuchsia-100/90 list-disc list-outside ml-5">
                <li><strong>5× Mining Multiplier</strong> — daily ₵ pool distribution scales 5× for chair holders vs non-holders.</li>
                <li><strong>13.5% Sovereign Tax recirculation</strong> — every card-game pot, tip, and ride the platform processes throws 13.5% back into the Treasury; chair weight determines your cut.</li>
                <li><strong>3.5% Ambassador Dividend</strong> — refer 5 verified sponsors, earn a free chair + 3.5% of the tax bucket on their activity, forever.</li>
                <li><strong>5% Ambassador Override</strong> — an additional 5% mining-kickback on network activity you drive (stacks with the dividend).</li>
                <li><strong>30% VibeRidez Tax + 70/30 split</strong> — drive or tip-to-skip inside Vibe Ridez; 70% of every ride after tax pays the driver.</li>
                <li><strong>Tip-to-Skip / Tip-to-Add</strong> — 100 ₵ instantly skips the track; 50 ₵ queues a passenger pick. Driver gets 70% post-tax.</li>
                <li><strong>Spotify Auto-DJ royalties</strong> — Auto-DJ seeds from your last-5-played plus the driver's vibe genre; engagement cycles back to the treasury.</li>
                <li><strong>4:1 Solana Bridge with 1.5× Genius Bonus</strong> — convert ₵ to DSG at 4:1 ratio; Genius holders get 1.5× during the Genius Phase window.</li>
                <li><strong>Power Hour</strong> — scheduled event windows where all earn rates multiply. Chair weights stack.</li>
                <li><strong>Game wins</strong> — Spades, Bid Whist, Vibez 654, Blackjack payouts hit your wallet post-tax (tax pre-animates so the number you see is the number you get).</li>
                <li><strong>Founder Vault drip</strong> — when chair #50,000 sells, the 200M Founder Vault begins a 12-month release; chair holders receive weighted distributions.</li>
              </ul>
            }
            tone="emerald"
            testId="welcome-beat-earning-methods"
          />

          <Beat
            Icon={Shield}
            title="For Chair Holders & Premium Members — the deep mechanics"
            body={
              <>
                <p className="mt-2 text-sm text-fuchsia-100/90 leading-relaxed">
                  If you own a chair or hold Premium — you're parked at the
                  table. These are the internal safety rails and money-flow
                  mechanics you're actually sitting in. Every one of these is
                  live in production code today.
                </p>
                <ul className="mt-3 space-y-2 text-sm text-fuchsia-100/90 list-disc list-outside ml-5">
                  <li>
                    <strong>40-30-30 Treasury Allocation.</strong> Every dollar
                    of platform revenue is split automatically:
                    <span className="text-white"> 40% Platform Operations</span>
                    (servers, RPC, marketing, support),
                    <span className="text-white"> 30% Team</span> — which is
                    further sub-split into <span className="text-white">13% Founder's Draw + 17% Core Team</span>
                    — and <span className="text-white">30% Reserve / Chair Holder Rewards Pool</span>.
                    Source of truth lives in <code className="text-fuchsia-300 text-xs">services/treasury_split.py</code>.
                  </li>
                  <li>
                    <strong>$20,000/month Founder Cap.</strong> Once monthly
                    platform revenue crosses <strong>$1,000,000</strong>, the
                    Founder's Draw auto-caps at $20K/mo. Every dollar above
                    that threshold flows directly into the
                    <span className="text-white"> Chair Holder Rewards Pool</span>
                    — not back to the Founder. This is enforced at the ledger
                    level; it isn't a pinky-promise.
                  </li>
                  <li>
                    <strong>Live Ledger Flow.</strong> Every taxed transaction
                    writes a row to <code className="text-fuchsia-300 text-xs">sovereign_treasury_ledger</code>
                    with gross, tax, ambassador dividend, and payout. Running
                    totals live in <code className="text-fuchsia-300 text-xs">sovereign_treasury_state</code>.
                    Full audit trail — anyone with founder keys can run the
                    full stack of "where did my ₵ go" queries in seconds.
                  </li>
                  <li>
                    <strong>AI Governor Burn-Slide.</strong> DSG supply has a
                    programmed burn ceiling of <strong>5%</strong> at 750M
                    circulating that linearly declines to <strong>0%</strong>
                    at the 350M floor. Formula:
                    <code className="text-fuchsia-300 text-xs"> min(5%, (supply − 350M) / 50M × 1%)</code>.
                    Deflationary pressure is maximum early, tapers to zero at
                    the floor — protects long-term holders from late-game
                    dilution.
                  </li>
                  <li>
                    <strong>Inactivity Reap (12-month sweep).</strong> Wallets
                    dormant ≥ 365 days on both login AND activity get their ₵
                    balance swept to fund the community —
                    <span className="text-white"> 50% to the Giveaway Fund,
                    50% to Leadership Dividends</span>. Race-safe with
                    CAS + re-benchmark so a user logging in mid-sweep gets
                    skipped, not reaped.
                  </li>
                  <li>
                    <strong>Anti-Whale Wallet Caps.</strong> Maximum DSG per
                    wallet is <strong>2M (standard)</strong> /
                    <strong> 5M (chair holder)</strong>. Crew wallets are
                    exempt (sentinel -1). Prevents any single holder —
                    including future whales — from cornering the supply and
                    destabilising the floor for early Genius buyers.
                  </li>
                  <li>
                    <strong>Dry-Run Safety Gates on All On-Chain Ops.</strong>
                    Bridge broadcasts, burn executions, and any other
                    movement of real SPL tokens on Solana is gated behind
                    <code className="text-fuchsia-300 text-xs"> SOVEREIGN_OPS_DRY_RUN=1</code>
                    by default. Unlocking live broadcast requires an
                    explicit Founder safe-phrase AND a Squads 2-of-2 multisig
                    cosigner — no single person can move real tokens.
                  </li>
                  <li>
                    <strong>Solana Bridge Queue.</strong> ₵ → DSG bridge
                    requests debit your in-app ₵ immediately and stage into
                    a Founder-approval queue. Approved requests go to
                    broadcast; rejected requests refund your coins. Zero
                    "pending forever" scenarios — every queued request has
                    a terminal state.
                  </li>
                  <li>
                    <strong>200M DSG Founder Vault.</strong> Locked until
                    chair #50,000 sells. On unlock: <strong>25% releases
                    immediately</strong>, the remaining 75% drips
                    <strong> monthly over 11 months</strong>. Chair holders
                    get weighted distributions during the drip, stacked on
                    top of the 30% chair-pool allocation.
                  </li>
                </ul>
                <p className="mt-3 text-[11px] text-fuchsia-300/80 italic leading-relaxed">
                  All nine mechanisms are wired and flowing in production
                  today. If any of them stop working or a constant changes,
                  the regression shield (<code className="text-fuchsia-300 text-xs">tests/regression_shield.py</code>)
                  fails the deploy — we can't ship a regression by accident.
                </p>
              </>
            }
            tone="cyan"
            testId="welcome-beat-chairholder-mechanics"
          />

          <Beat
            Icon={TrendingUp}
            title="The upside, told once and quietly"
            body={
              <>
                Founders ask "where does this end?" — fair question. Click below
                to see the final ceiling. No flashing chart, no countdown
                clock, no urgency theater. Just a number.
                <button
                  type="button"
                  onClick={() => setShowCeiling((v) => !v)}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-fuchsia-500/30 bg-fuchsia-950/30 px-3 py-1.5 text-xs text-fuchsia-200 hover:bg-fuchsia-900/40"
                  data-testid="welcome-show-ceiling-btn"
                >
                  {showCeiling ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                  {showCeiling ? "Hide" : "Show me the ceiling"}
                </button>
                {showCeiling && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    transition={{ duration: 0.25 }}
                    className="mt-4 rounded-xl border border-fuchsia-500/30 bg-fuchsia-950/20 p-4"
                    data-testid="welcome-ceiling-block"
                  >
                    <p className="text-xs uppercase tracking-widest text-fuchsia-300 font-bold mb-2">
                      The Platinum milestone (live valuation)
                    </p>
                    <p className="text-3xl font-black text-white font-mono">
                      $1,800
                      <span className="text-base text-fuchsia-300 font-normal ml-2">
                        per chair @ $50M / month app revenue
                      </span>
                    </p>
                    <p className="text-xs text-fuchsia-100/80 mt-3 leading-relaxed">
                      That's a <strong>90×</strong> climb from the Genius $20
                      floor. We don't promise demand takes you there —
                      that depends on you and everyone you invite. We
                      promise the Equity Master formula, the Genius cap,
                      and the multiplier guarantee for early buyers.
                    </p>
                  </motion.div>
                )}
              </>
            }
            tone="violet"
            testId="welcome-beat-ceiling"
          />
        </div>

        <p
          className="mt-10 text-center text-[10px] font-mono uppercase tracking-[0.3em] text-neutral-600"
          data-testid="welcome-letter-disclaimer"
        >
          A chair is not a security. Multipliers reward activity, not capital.
        </p>

        <div
          className="mt-8 flex justify-center"
          data-testid="welcome-calculator-cta-wrap"
        >
          <Link
            to="/how-chairs-work"
            className="inline-flex items-center gap-2 rounded-full border border-fuchsia-500/40 bg-fuchsia-500/10 px-5 py-2.5 text-sm font-bold text-fuchsia-200 hover:bg-fuchsia-500/20 transition"
            data-testid="welcome-calculator-cta"
          >
            <Calculator className="w-4 h-4" />
            Run the numbers · Interactive ROI calculator
          </Link>
        </div>
      </div>
    </section>
  );
}

function Beat({
  Icon,
  title,
  body,
  tone,
  testId,
}: {
  Icon: typeof Crown;
  title: string;
  body: React.ReactNode;
  tone: "emerald" | "cyan" | "fuchsia" | "amber" | "violet";
  testId: string;
}) {
  const colors: Record<typeof tone, string> = {
    emerald: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
    cyan: "text-cyan-400 bg-cyan-500/10 border-cyan-500/30",
    fuchsia: "text-fuchsia-400 bg-fuchsia-500/10 border-fuchsia-500/30",
    amber: "text-amber-400 bg-amber-500/10 border-amber-500/30",
    violet: "text-violet-400 bg-violet-500/10 border-violet-500/30",
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.3 }}
      className="flex gap-4"
      data-testid={testId}
    >
      <div
        className={`flex-shrink-0 w-12 h-12 rounded-xl border flex items-center justify-center ${colors[tone]}`}
      >
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1">
        <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
        <div className="text-sm text-neutral-300 leading-relaxed">{body}</div>
      </div>
    </motion.div>
  );
}
