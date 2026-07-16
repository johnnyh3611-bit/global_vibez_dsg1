/**
 * /terms — public Terms of Service for soft-launch trust + app-store / Stripe.
 *
 * Hosted at: /terms (public, no auth)
 * Last reviewed: July 2026
 */
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft, ScrollText } from "lucide-react";

const SECTIONS: { id: string; title: string; body: React.ReactNode }[] = [
  {
    id: "acceptance",
    title: "1. Acceptance of Terms",
    body: (
      <p>
        By accessing or using Global Vibez DSG (“the platform”, “we”, “us”),
        you agree to these Terms of Service. If you do not agree, do not use
        the platform. These terms apply to our website, apps, and related
        services including gaming, dating, streaming, and earning features.
      </p>
    ),
  },
  {
    id: "eligibility",
    title: "2. Eligibility & Age",
    body: (
      <ul className="list-disc pl-6 space-y-2">
        <li>
          You must be at least <strong>18 years old</strong> to create an
          account or use dating, social, or earning features.
        </li>
        <li>
          Certain surfaces (for example restricted-goods delivery) may require
          additional age verification (21+) under applicable law.
        </li>
        <li>
          You are responsible for providing accurate date-of-birth and identity
          information when requested.
        </li>
      </ul>
    ),
  },
  {
    id: "accounts",
    title: "3. Accounts",
    body: (
      <p>
        You are responsible for safeguarding your login credentials and for
        activity under your account. Demo accounts are for evaluation only and
        may be reset. We may suspend or terminate accounts that abuse the
        platform, violate these terms, or create safety risk for other users.
      </p>
    ),
  },
  {
    id: "virtual-currency",
    title: "4. Vibez Coins (₵) & Wallet",
    body: (
      <ul className="list-disc pl-6 space-y-2">
        <li>
          ₵ Vibez Coins are in-app credits used for gameplay, tips, and
          platform features. They are not legal tender.
        </li>
        <li>
          Coin purchases (when Stripe checkout is available) are generally
          non-refundable except where required by law.
        </li>
        <li>
          A planned 1:1 conversion of ₵ to $DSG at token generation event
          (TGE) is a product roadmap item, not a guarantee of value, listing,
          or investment return.
        </li>
      </ul>
    ),
  },
  {
    id: "founder-chairs",
    title: "5. Founder Chairs",
    body: (
      <p>
        Founder Chairs are loyalty seats with utility perks (multipliers,
        early access, gated features). They are <strong>not</strong>{" "}
        securities, equity, or investment contracts. Quarterly distributions
        are discretionary loyalty bonuses and may be paused or adjusted with
        notice. Purchases are one-time, non-transferable, and non-refundable
        except where required by law.
      </p>
    ),
  },
  {
    id: "conduct",
    title: "6. Acceptable Use",
    body: (
      <ul className="list-disc pl-6 space-y-2">
        <li>No harassment, hate speech, scams, or illegal activity.</li>
        <li>No underage users; report suspected minors immediately.</li>
        <li>No cheating, botting, or exploitation of games or payments.</li>
        <li>No reverse engineering or scraping that harms the service.</li>
      </ul>
    ),
  },
  {
    id: "dating",
    title: "7. Dating & Social Features",
    body: (
      <p>
        Dating and social features are for adults. You must interact
        respectfully, obtain consent for communications and media, and comply
        with our safety and moderation policies. We may remove content or ban
        accounts that violate community standards.
      </p>
    ),
  },
  {
    id: "disclaimers",
    title: "8. Disclaimers",
    body: (
      <p>
        The platform is provided “as is”. Soft-launch features may change,
        pause, or be removed. We do not warrant uninterrupted availability.
        To the fullest extent permitted by law, we disclaim liability for
        indirect or consequential damages arising from use of the platform.
      </p>
    ),
  },
  {
    id: "privacy",
    title: "9. Privacy",
    body: (
      <p>
        How we collect and use personal data is described in our{" "}
        <Link to="/privacy" className="text-cyan-300 underline hover:text-cyan-100">
          Privacy Policy
        </Link>
        .
      </p>
    ),
  },
  {
    id: "changes",
    title: "10. Changes",
    body: (
      <p>
        We may update these Terms. Continued use after changes become
        effective constitutes acceptance. Material changes will be noted by
        updating the “Last updated” date on this page.
      </p>
    ),
  },
  {
    id: "contact",
    title: "11. Contact",
    body: (
      <p>
        Global Vibez DSG · legal@globalvibez.com · Put “Terms of Service” in
        the subject line for contract or compliance questions.
      </p>
    ),
  },
];

export default function TermsOfService() {
  const navigate = useNavigate();
  const lastUpdated = "July 16, 2026";

  return (
    <div
      className="min-h-screen bg-[#050507] text-cyan-100 font-sans relative overflow-hidden"
      data-testid="terms-of-service-root"
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
          data-testid="terms-back"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="flex items-center gap-3 mt-6">
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-400/40 flex items-center justify-center">
            <ScrollText className="w-6 h-6 text-cyan-300" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-white">Terms of Service</h1>
            <p className="text-xs uppercase tracking-[0.3em] text-cyan-500 mt-1">
              Global Vibez DSG · Last updated {lastUpdated}
            </p>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-3xl mx-auto px-6 py-10">
        <nav
          className="mb-8 grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]"
          data-testid="terms-toc"
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
              data-testid={`terms-section-${s.id}`}
              className="scroll-mt-24"
            >
              <h2 className="text-lg font-bold text-cyan-300 mb-3">{s.title}</h2>
              <div>{s.body}</div>
            </section>
          ))}
        </article>

        <footer className="mt-16 pt-6 border-t border-cyan-500/15 text-[11px] text-cyan-600 uppercase tracking-widest">
          © {new Date().getFullYear()} Global Vibez DSG ·{" "}
          <Link to="/privacy" className="text-cyan-400 hover:text-cyan-200 normal-case tracking-normal">
            Privacy
          </Link>
        </footer>
      </main>
    </div>
  );
}
