/**
 * /privacy — public privacy policy page used for 3rd-party API approvals
 * (Uber Developer dashboard, Google OAuth consent screen, Privy, etc.).
 *
 * Hosted at:  /privacy   (public, no auth)
 * Last reviewed: April 2026
 */
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ShieldCheck } from "lucide-react";

const SECTIONS: { id: string; title: string; body: React.ReactNode }[] = [
  {
    id: "overview",
    title: "1. Overview",
    body: (
      <>
        <p>
          Global Vibez DSG (“we”, “our”, “the platform”) operates a social
          gaming, dating and ride-sharing experience. This Privacy Policy
          explains what personal information we collect, how we use it, and
          the choices you have. By using the platform you agree to the
          practices described here.
        </p>
      </>
    ),
  },
  {
    id: "data-we-collect",
    title: "2. Information We Collect",
    body: (
      <ul className="list-disc pl-6 space-y-2">
        <li>
          <strong>Account data:</strong> email, username, hashed password,
          profile photos and basic profile metadata you provide.
        </li>
        <li>
          <strong>Authentication data:</strong> session tokens, Privy
          decentralized identifiers (DIDs) and any social-login identities
          (Google, etc.) you elect to link.
        </li>
        <li>
          <strong>Wallet data:</strong> Solana wallet public addresses you
          voluntarily connect via any supported Solana wallet. We never request, see,
          or store private keys.
        </li>
        <li>
          <strong>Location data:</strong> precise GPS coordinates while you
          use the Vibe Ridez driver console or the Rider Tracking screen.
          Location is streamed in real-time only while a shift or ride is
          active and is discarded server-side after the ride completes.
        </li>
        <li>
          <strong>Ride request data:</strong> pickup/drop-off coordinates,
          fare estimates, ETA, and (when you elect to use Uber) the same
          parameters forwarded to the Uber Rides API to fetch live pricing.
        </li>
        <li>
          <strong>Gameplay & wagering data:</strong> ₵ Vibez Coin balances,
          game results, escrow lock states, reward queue entries.
        </li>
        <li>
          <strong>Device data:</strong> IP address, user-agent, locale, and
          general telemetry (page views, latency) used for abuse prevention
          and product improvement.
        </li>
      </ul>
    ),
  },
  {
    id: "how-we-use",
    title: "3. How We Use Your Information",
    body: (
      <ul className="list-disc pl-6 space-y-2">
        <li>Operate, maintain and secure the platform.</li>
        <li>
          Match riders with drivers in real time and calculate ₵ Vibez Coin
          fares using the platform's own dispatch and pricing engine.
        </li>
        <li>Process Vibez Coin escrows, payouts and on-chain SPL transfers.</li>
        <li>
          Detect fraud, abuse and self-exclusion violations under our
          responsible-gaming framework.
        </li>
        <li>Send transactional emails (e.g. password reset) via Resend.</li>
        <li>Improve the product through aggregated, de-identified analytics.</li>
      </ul>
    ),
  },
  {
    id: "third-parties",
    title: "4. Third-Party Services",
    body: (
      <ul className="list-disc pl-6 space-y-2">
        <li>
          <strong>Mapbox</strong> — Map tiles and geocoding for the rider
          tracking screen.
        </li>
        <li>
          <strong>Privy</strong> — Hybrid web3 / social authentication.
        </li>
        <li>
          <strong>Stripe</strong> — Payment processing for fiat top-ups.
        </li>
        <li>
          <strong>Resend</strong> — Transactional email delivery.
        </li>
        <li>
          <strong>Solana RPC providers (Helius)</strong> — On-chain reads and
          SPL token transfers for Vibez Coin payouts.
        </li>
      </ul>
    ),
  },
  {
    id: "sharing",
    title: "5. How We Share Information",
    body: (
      <p>
        We do not sell personal information. We share data only with the
        third-party processors listed above, with law enforcement when we
        believe in good faith that disclosure is required by law, or with
        your explicit consent. Driver and rider profile basics (name,
        rating, vehicle) are visible to the matched counter-party for the
        duration of an active ride.
      </p>
    ),
  },
  {
    id: "retention",
    title: "6. Data Retention",
    body: (
      <p>
        Account data is retained for the life of your account plus 30 days
        after deletion (for chargeback / dispute handling). Real-time
        location pings are kept in-memory and discarded after the ride
        completes. Aggregated analytics and on-chain transaction records are
        kept indefinitely.
      </p>
    ),
  },
  {
    id: "your-rights",
    title: "7. Your Rights",
    body: (
      <p>
        You may access, correct, export or delete your personal data at any
        time from your account settings, or by emailing us at{" "}
        <a
          href="mailto:privacy@globalvibez.com"
          className="text-cyan-400 underline"
        >
          privacy@globalvibez.com
        </a>
        . EU/UK residents have GDPR rights; California residents have CCPA
        rights — including the right to know, delete and opt out of any
        sale or sharing of personal information (we do not sell or share
        for cross-context behavioral advertising).
      </p>
    ),
  },
  {
    id: "security",
    title: "8. Security",
    body: (
      <p>
        Passwords are hashed with bcrypt. Session tokens are stored in
        httpOnly cookies. All traffic to and from the platform is served
        over TLS. Solana private keys never leave your wallet provider.
      </p>
    ),
  },
  {
    id: "children",
    title: "9. Children",
    body: (
      <p>
        The platform is not directed to anyone under 18. We do not knowingly
        collect personal information from minors. If you believe a minor has
        provided us data, contact{" "}
        <a
          href="mailto:privacy@globalvibez.com"
          className="text-cyan-400 underline"
        >
          privacy@globalvibez.com
        </a>{" "}
        and we will delete it.
      </p>
    ),
  },
  {
    id: "changes",
    title: "10. Changes to This Policy",
    body: (
      <p>
        We may update this policy from time to time. Material changes will
        be announced in-app at least 14 days before they take effect.
      </p>
    ),
  },
  {
    id: "contact",
    title: "11. Contact",
    body: (
      <p>
        Global Vibez DSG · privacy@globalvibez.com · For data-protection
        requests please put “Privacy Request” in the subject line.
      </p>
    ),
  },
];

export default function PrivacyPolicy() {
  const navigate = useNavigate();
  const lastUpdated = "April 26, 2026";

  return (
    <div
      className="min-h-screen bg-[#050507] text-cyan-100 font-sans relative overflow-hidden"
      data-testid="privacy-policy-root"
    >
      <div
        className="absolute inset-0 opacity-25 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(34,211,238,0.18) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.18) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(34,211,238,0.08),transparent_60%)] pointer-events-none" />

      <header className="relative z-10 max-w-3xl mx-auto px-6 pt-10">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-cyan-300 hover:text-cyan-100 text-sm"
          data-testid="privacy-back"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="flex items-center gap-3 mt-6">
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-400/40 flex items-center justify-center">
            <ShieldCheck className="w-6 h-6 text-cyan-300" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-white">Privacy Policy</h1>
            <p className="text-xs uppercase tracking-[0.3em] text-cyan-500 mt-1">
              Global Vibez DSG · Last updated {lastUpdated}
            </p>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-3xl mx-auto px-6 py-10">
        <nav
          className="mb-8 grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]"
          data-testid="privacy-toc"
        >
          {SECTIONS.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="text-cyan-400/80 hover:text-cyan-200 truncate"
            >
              {s.title}
            </a>
          ))}
        </nav>

        <article className="space-y-10 text-sm leading-relaxed text-cyan-100/90">
          {SECTIONS.map((s) => (
            <section
              key={s.id}
              id={s.id}
              data-testid={`privacy-section-${s.id}`}
              className="scroll-mt-24"
            >
              <h2 className="text-lg font-bold text-cyan-300 mb-3">
                {s.title}
              </h2>
              <div>{s.body}</div>
            </section>
          ))}
        </article>

        <footer className="mt-16 pt-6 border-t border-cyan-500/15 text-[11px] text-cyan-600 uppercase tracking-widest">
          © {new Date().getFullYear()} Global Vibez DSG · All rights reserved.
        </footer>
      </main>
    </div>
  );
}
