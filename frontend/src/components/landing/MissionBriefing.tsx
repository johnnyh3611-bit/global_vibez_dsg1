import React from "react";

interface FutureFeatureProps {
  title: string;
  date: string;
  desc: string;
}

const FutureFeature: React.FC<FutureFeatureProps> = ({ title, date, desc }) => (
  <div
    className="border-l-2 border-purple-900 pl-6 py-4"
    data-testid={`future-feature-${date.replace(/\s+/g, "-").toLowerCase()}`}
  >
    <span className="text-xs font-mono text-purple-500 uppercase tracking-widest">
      {date}
    </span>
    <h4 className="text-xl font-bold text-white mt-1">{title}</h4>
    <p className="text-neutral-400 text-sm mt-2">{desc}</p>
  </div>
);

export default function MissionBriefing() {
  return (
    <section
      className="bg-black py-24 px-6 border-t border-neutral-900"
      data-testid="mission-briefing-section"
    >
      <div className="max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-20">
          {/* Left: Ecosystem Mechanics */}
          <div data-testid="mission-briefing-mechanics">
            <h2 className="text-3xl font-black italic text-white uppercase tracking-tighter mb-8">
              The Ecosystem Mechanics
            </h2>
            <div className="space-y-8">
              <div>
                <h3 className="text-purple-500 font-bold uppercase text-sm tracking-widest mb-2">
                  01. Engagement Mining
                </h3>
                <p className="text-neutral-300 leading-relaxed">
                  Your activity is your value. In Global Vibez, "Mining" isn't
                  done by hardware; it's done by your interaction. Every hand
                  of Spades, every 3D Glass Emoji sent, and every Bilingual
                  chat generates <strong>Vibe Credits</strong>.
                </p>
              </div>
              <div>
                <h3 className="text-purple-500 font-bold uppercase text-sm tracking-widest mb-2">
                  02. The Loyalty Loop
                </h3>
                <p className="text-neutral-300 leading-relaxed">
                  Credits are held in a 72-hour "Vibe Check" to ensure
                  community safety. Once cleared, they can be redeemed as{" "}
                  <strong>Loyalty Gifts</strong>. Express redemptions are
                  available for Elite members with a 12% convenience fee.
                </p>
              </div>
              <div data-testid="mission-briefing-currency-stack">
                <h3 className="text-purple-500 font-bold uppercase text-sm tracking-widest mb-2">
                  03. The Currency Stack
                </h3>
                <p className="text-neutral-300 leading-relaxed">
                  Three names, three distinct layers. <strong>₵ Vibe Coins</strong>{" "}
                  are the in-app credits you earn today (off-chain).{" "}
                  <strong className="text-emerald-300">$DSG</strong> is the public
                  Solana SPL token — your ₵ balance converts <strong>1:1 to $DSG</strong>{" "}
                  at the Token Generation Event.{" "}
                  <strong className="text-cyan-300">Global Vibez DSG™</strong>{" "}
                  is the company and brand behind both. Earn ₵ now → hold $DSG on day 1.
                </p>
              </div>
            </div>
          </div>

          {/* Right: Roadmap */}
          <div
            className="bg-neutral-900/30 p-10 rounded-3xl border border-white/5 backdrop-blur-sm"
            data-testid="mission-briefing-roadmap"
          >
            <h2 className="text-3xl font-black italic text-white uppercase tracking-tighter mb-8">
              What's Next
            </h2>
            <div className="space-y-8">
              <FutureFeature
                date="Live Now"
                title="Squads Multi-Sig Treasury"
                desc="Founder treasury secured by an on-chain 2-of-2 multisig on Solana mainnet. Every founder draw + payroll batch requires both cosigners."
              />
              <FutureFeature
                date="Coming Soon"
                title="$DSG Token Generation Event"
                desc="Mint of the public $DSG SPL token. Vibez Coins (₵) earned today convert 1:1 to $DSG for verified accounts at TGE."
              />
              <FutureFeature
                date="Post-Milestone"
                title="Escape Velocity"
                desc="500,000 chairs unlock once the platform hits major user milestones — distributed via community-voted events, never bulk-sold."
              />
            </div>
          </div>
        </div>

        {/* Founder's Commitment — equity, agency, collective growth. Sets the
             philosophical framing before the mechanical "how you get paid"
             letter that follows. */}
        <div
          className="mt-20 pt-10 border-t border-neutral-900"
          data-testid="founders-commitment-section"
        >
          <p className="text-xs font-mono uppercase tracking-[0.4em] text-cyan-400 mb-3">
            The Founder's Commitment
          </p>
          <h2 className="text-3xl md:text-4xl font-black italic text-white uppercase tracking-tighter mb-6">
            Equity. Agency. Collective Growth.
          </h2>

          <div className="prose prose-invert max-w-none text-neutral-300 leading-relaxed text-base space-y-5">
            <p className="text-lg text-white/90">
              At the heart of this platform lies a fundamental belief:{" "}
              <strong className="text-cyan-300">
                a digital community should be owned and shaped by the people
                who give it life.
              </strong>{" "}
              To ensure this vision remains protected from the start, we have
              implemented a <strong>Genius Phase</strong> with a strict{" "}
              <strong>100-chair maximum per individual</strong>.
            </p>

            <h3
              className="text-cyan-400 font-bold uppercase text-sm tracking-widest mt-8 mb-2"
              data-testid="commitment-protect"
            >
              Protecting the Ecosystem
            </h3>
            <p>
              The decision to limit initial ownership is a deliberate move to
              prioritize <strong>safety and equity</strong>. By capping early
              participation, we prevent institutional entities and "big wheels"
              from monopolizing the platform's future. We are not building a
              playground for the few; we are building a table where there is a
              seat for everyone. This phase ensures the platform's value is
              distributed across a diverse foundation of early believers,
              keeping power in the hands of the community.
            </p>

            <h3
              className="text-cyan-400 font-bold uppercase text-sm tracking-widest mt-8 mb-2"
              data-testid="commitment-ambassadors"
            >
              The Role of Our Ambassadors
            </h3>
            <p>
              Our chair holders are more than investors — they are the{" "}
              <strong className="text-white">Ambassadors</strong> of this
              vision. You are the heartbeat, the voice, and the boots on the
              ground. As an Ambassador, your influence is the engine of our
              growth:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-neutral-300">
              <li>
                <strong className="text-white">Digital Presence:</strong>{" "}
                Through your networks on X, TikTok, Facebook, and beyond, you
                carry our message to the world.
              </li>
              <li>
                <strong className="text-white">Real-World Connectivity:</strong>{" "}
                Whether you're out in the community or engaging online, your
                unique referral code is the key to expanding our borders. One
                scan is an invitation to a fairer digital future.
              </li>
              <li>
                <strong className="text-white">The Face of the Platform:</strong>{" "}
                You are the promoters and the pioneers. When the platform
                succeeds, we succeed as a collective.
              </li>
            </ul>

            <h3
              className="text-cyan-400 font-bold uppercase text-sm tracking-widest mt-8 mb-2"
              data-testid="commitment-prosperity"
            >
              Prosperity Through Participation
            </h3>
            <p>
              This is an <strong>employee-owned mindset</strong>. We move away
              from the traditional model of passive ownership and toward a
              future of active contribution. By ensuring no single entity can
              buy their way into a majority, we protect the "Genius" of our
              early adopters.
            </p>
            <p>
              This is our shared table. It is built to be prosperous for every
              person seated here. We aren't just building an app — we are
              building a legacy where the value we create together is the
              value we share together.
            </p>

            <p
              className="text-center text-xl font-black italic text-white mt-8 tracking-wide uppercase"
              data-testid="commitment-rally-cry"
            >
              We are the voice. We are the feet. We are the platform.
            </p>
          </div>
        </div>

        {/* Letter from the Founder — every way you can earn on the platform */}
        <div
          className="mt-20 pt-10 border-t border-neutral-900"
          data-testid="mission-briefing-earn-letter"
        >
          <p className="text-xs font-mono uppercase tracking-[0.4em] text-amber-400 mb-3">
            Letter from the Founder
          </p>
          <h2 className="text-3xl font-black italic text-white uppercase tracking-tighter mb-6">
            Every Way You Get Paid On Global Vibez
          </h2>

          <div className="prose prose-invert max-w-none text-neutral-300 leading-relaxed text-base space-y-4">
            <p>
              I built this so the people who show up early get paid for showing
              up. Not in promises — in <strong>twelve separate income streams
              </strong> that all run on the same account. Read the whole thing.
              I want you to know exactly what you're stepping into before you
              spend a dollar.
            </p>

            <h3 className="text-purple-400 font-bold uppercase text-sm tracking-widest mt-8 mb-2">
              01. Park a Founder Chair
            </h3>
            <p>
              The headline earner. Pay $20–$250 once for a chair, get a
              permanent slice of every quarterly distribution forever. The
              chair-holder profit share starts at <strong>14% of platform
              profit</strong>, distributed by weight (Genius 3× / Genesis 2× /
              Phase III 1.5× / Phase IV 1.25× / Phase V 1×) — and the moment we
              hit Escape Velocity, that share auto-bumps to{" "}
              <strong>30%</strong>. Same chair, ~2× the payout from that day
              forward. Distributed by weight, never by who paid most.
            </p>

            <h3 className="text-purple-400 font-bold uppercase text-sm tracking-widest mt-8 mb-2">
              02. Drive on VibeRidez
            </h3>
            <p>
              Three income streams from a single trip. <strong>70% of every
              fare</strong> hits your wallet via the Solana on-chain split
              (20% platform, 10% community liquidity pool). Stream POV from
              your AR/VR HUD and earn virtual gifts from viewers in real time.
              Plus: <strong>100 VibeXP per safe ride + 10 XP per streamed
              mile</strong>, which converts 1:1 to $DSG tokens at TGE.
              Triple-stream income on a single trip.
            </p>

            <h3 className="text-orange-400 font-bold uppercase text-sm tracking-widest mt-8 mb-2">
              03. Deliver Hungry Vibez (Same Fleet, Second Task)
            </h3>
            <p>
              The same VibeRidez driver app gets a second task type. Pick up
              from Mom &amp; Pop partner kitchens, drop off to customers, keep{" "}
              <strong>70% of the delivery fee</strong> via the same on-chain
              split. Plus restaurant tips and the <strong>$DSG payout token
              </strong>. Flat-fee partner restaurants ($30/mo) pay no predatory
              per-order rake — drivers see more per drop, no idle rides between
              fares.
            </p>

            <h3 className="text-fuchsia-400 font-bold uppercase text-sm tracking-widest mt-8 mb-2">
              04. Host a Vibe Venue (Hourly Rental)
            </h3>
            <p>
              Got a curated space? List it on Vibe Venues — pick your block
              (<strong>3 / 6 / 9 / 12 / 24 hr</strong>). Customer pays full
              rent up front into <strong>$DSG smart escrow</strong>. After
              their Vibe-Check, you get <strong>80% of the house rental
              </strong> as on-chain payout. Platform retains 20% which feeds
              the chair-pool. Zero per-event hassle, no security-deposit
              fights.
            </p>

            <h3 className="text-orange-400 font-bold uppercase text-sm tracking-widest mt-8 mb-2">
              05. Become a Vibe Artisan ($20/mo)
            </h3>
            <p>
              Chefs, decorators, setters. Flat <strong>$20/month</strong>{" "}
              membership unlocks Signature Commercials inside venue 360°
              walkthroughs, AI-driven "Perfect Mate" auto-matching, and a
              1–2hr early-access prep window per booking. <strong>30% prep-fee
              releases on confirm</strong> (covers groceries / supplies),{" "}
              <strong>70% balance on Vibe-Check</strong>. You get paid the
              moment a customer locks the booking.
            </p>

            <h3 className="text-fuchsia-400 font-bold uppercase text-sm tracking-widest mt-8 mb-2">
              06. Become a Date Spot Partner ($30/mo)
            </h3>
            <p>
              Restaurant or entertainment venue (bar, lounge, pool hall,
              bowling, arcade, rooftop)? Flat <strong>$30/month
              partnership</strong> on the Date Spot Finder unlocks the{" "}
              <strong>Neon Purple Vibe-Ring</strong>, priority placement in
              zip-code search, and in-app commercials. Pays for itself in
              2–3 customer visits.
            </p>

            <h3 className="text-purple-400 font-bold uppercase text-sm tracking-widest mt-8 mb-2">
              07. Stream &amp; Create
            </h3>
            <p>
              Glasshouse sessions, 3D Glass Emoji events, Bilingual Chat
              audiences, in-vehicle livestreams. Every $1 you earn as a
              creator pays you back <strong>30 loyalty stakes</strong> —
              that's 3× the rate someone gets for depositing $1. Highest
              accrual multiplier in the whole platform. Creators pulling $500
              cash/month earn ~15K stakes/month on top.
            </p>

            <h3 className="text-purple-400 font-bold uppercase text-sm tracking-widest mt-8 mb-2">
              08. Play Games &amp; Hang Out (Engagement Mining)
            </h3>
            <p>
              You play, you earn. Real production rates — every Spades or
              BidWhist hand pays <strong>+3 stakes</strong>, every VibeRidez
              ride <strong>+2</strong>, JFTN-room visits / Vibe Calls /
              Vibez 654 rounds <strong>+1 each</strong>. No mining rigs, no
              hidden meters. Casual play earns hundreds of stakes/month;
              competitive players clear 5K+. Stakes settle to ₵ Vibez Coins
              every quarter.
            </p>

            <h3 className="text-purple-400 font-bold uppercase text-sm tracking-widest mt-8 mb-2">
              09. Stake The Coin (Premium Tier)
            </h3>
            <p>
              An active <strong>Premium subscription (Diamond / Gold /
              Premium tier)</strong> applies a permanent <strong>1.5×
              multiplier</strong> on every loyalty stake you accrue, AND
              keeps your chair payouts active each quarter. Premium renewal
              alone earns <strong>+200 stakes/month</strong> — covers the
              subscription cost in stakes alone. Without active Premium your
              chair holds its weight but skips that quarter's distribution.
            </p>

            <h3 className="text-purple-400 font-bold uppercase text-sm tracking-widest mt-8 mb-2">
              10. Hold ₵ Vibez Coins → Convert to $DSG at TGE
            </h3>
            <p>
              Every Vibez Coin (₵) sitting in your account today converts{" "}
              <strong>1:1 to the public $DSG SPL token</strong> at the
              Token Generation Event for verified accounts. Chair payouts,
              loyalty redemptions, driver fares, gameplay rewards — all
              denominated in ₵, all become $DSG on day 1. Earn now, redeem
              when the token mints. This is the multiplier event.
            </p>

            <h3 className="text-purple-400 font-bold uppercase text-sm tracking-widest mt-8 mb-2">
              11. Refer Friends (Genius Kit)
            </h3>
            <p>
              Open your <strong>Genius Kit</strong> (chair holders only) →
              get a unique invite QR + share link. Every friend who scans
              your code AND parks their first chair earns you{" "}
              <strong>+10 loyalty stakes</strong>. Compound it: 50 referred
              chair buyers = 500 stakes of pure pass-through earn. No
              ongoing effort, no funnel work — your QR does the lifting.
            </p>

            <h3 className="text-purple-400 font-bold uppercase text-sm tracking-widest mt-8 mb-2">
              12. Deposit USD → Get Paid To Hold
            </h3>
            <p>
              Drop USD into the platform via the Solana indexer and you
              earn <strong>+10 stakes per $1 deposited</strong>. Reload
              gameplay credit, pre-fund a VibeRidez trip, top up for a
              Premium upgrade — every dollar earns. (Cap at typical use
              levels; not a yield product.)
            </p>

            <h3 className="text-amber-400 font-bold uppercase text-sm tracking-widest mt-10 mb-2">
              What To Expect — Honest Math
            </h3>
            <p>
              Early days are <em>small dollars</em>. At $50K/month platform
              profit, a Genius chair pays ~$0.05/month. At $1M/month —{" "}
              <strong>$0.96/month pre-Escape-Velocity, $2.06/month
              post-EV</strong> per chair. At $5M/month: <strong>~$10.29/month
              per chair, $1.2K/year on 10 chairs</strong>. Loyalty stakes are
              the daily earn — active users with Premium + games + driving
              easily clear <strong>1,000–10,000 stakes/month</strong>. None
              of these are guaranteed. Founder Chairs are non-transferable
              loyalty seats with discretionary distributions, not securities.
              We earn, you earn. The math is the math.
            </p>

            <p className="text-amber-300 italic mt-6 text-base">
              — As I make, you make. That's the whole pitch.
            </p>
          </div>
        </div>

        {/* Bottom: Founder's Trust */}
        <div
          className="mt-20 pt-10 border-t border-neutral-900 text-center"
          data-testid="mission-briefing-trust"
        >
          <p className="text-xs text-neutral-600 uppercase tracking-[0.3em]">
            Skill-Based Gaming • Non-Gambling Ecosystem • Global Connection
          </p>
        </div>
      </div>
    </section>
  );
}
