/**
 * /merchant/ambassador — Field Ambassador Playbook.
 *
 * Implements `global_vibez_dsg_master_manual.pdf` (2026-05-16):
 *   • 5-Phase High-Conversion Script (Warm Hook → Disrupting Legacy →
 *     Edge & Vibe Shield → Closing Hammer → Seamless Enrollment).
 *   • Quick-Reference Objection-Handling Matrix.
 *   • Scan-Asset summary so the rep can flash it on their phone.
 *
 * This page is meant to live on the rep's phone in the field — clean
 * cards, large tappable phase chips, copy-to-clipboard so a rep can
 * paste a script line into iMessage if needed.
 */
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Crown,
  ShieldCheck,
  Megaphone,
  MapPin,
  QrCode,
  Copy,
  CheckCircle2,
  ChevronRight,
  Flame,
  Target,
  Handshake,
  Zap,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";

interface Phase {
  id: number;
  label: string;
  objective: string;
  script: string;
  icon: React.ReactNode;
  testId: string;
}

const PHASES: Phase[] = [
  {
    id: 1,
    label: "Warm Hook",
    objective: "Circumvent traditional sales filters and align with the decision-maker in under 15 seconds.",
    script:
      "Hey, good morning! I am not here to pitch you credit card processing or software web design. I am actually working with a new hyper-local network launching right here in our neighborhood called Global Vibez DSG, and we are currently hand-selecting a tiny group of core businesses—specifically the top restaurants, grocers, and tobacco shops—to lock in a founding stake with us. Is the owner or general manager around for just 60 seconds?",
    icon: <Flame className="h-5 w-5" />,
    testId: "phase-1-warm-hook",
  },
  {
    id: 2,
    label: "Disrupting the Legacy Model",
    objective: "Evoke the financial frustration caused by traditional predatory third-party applications.",
    script:
      "Appreciate your time. Look, we all know how corporate tech apps like UberEats, DoorDash, or Yelp operate. They walk into your establishment, hit you with hidden costs, strip away up to 30% of every order you process, and if a customer attempts a scam or chargeback, the corporation penalizes your store and leaves you holding the bag. Am I right? We are completely destroying that standard corporate format. We just deployed Hunger Vibez, Vibez Spots, and VibeRidez into one synchronized ecosystem, and we approach local business completely differently.",
    icon: <Target className="h-5 w-5" />,
    testId: "phase-2-disrupt-legacy",
  },
  {
    id: 3,
    label: "The Edge & Vibe Shield Utility",
    objective: "Detail the definitive technological advantages and financial security protocols.",
    script:
      "First off: We do not touch your hard-earned revenue with predatory commission fees. What you make is entirely yours. Second: We do not route anonymous, unverified transactions to your register. Everything here relies on our active security ring called the Vibe Shield. Every single platform user is fully authenticated. The Vibe Shield completely insulates your store, meaning zero fraudulent orders, zero sketchy chargebacks, and total protection for your staff. Our local mapping architecture automatically directs users who are actively streaming, playing, and winning DSG Tokens inside our virtual arenas straight to your counter to spend their balances in real time.",
    icon: <ShieldCheck className="h-5 w-5" />,
    testId: "phase-3-edge-vibe-shield",
  },
  {
    id: 4,
    label: "The Closing Hammer",
    objective: "Drop the ultimate hook—converting the vendor into an active owner in the ecosystem.",
    script:
      "But here is the primary reason we are out here connecting today: We run a partner-owned ecosystem. We believe the local business owners who actually anchor the community should own the platform itself. Right now, we are executing our initial Genius Phase rollout. When you activate your location today, you pay a one-time flat entry fee to launch your products on our system forever. No ongoing monthly tiers, no tricky contracts. But technically, that activation fee doesn't vanish into a corporate tech monopoly. It automatically purchases your official Genius Phase Chair at our table—valued at a fixed $20 baseline price marker. You aren't just an app vendor on a generic billboard anymore; you are a founding stakeholder. As Global Vibez DSG scales, your chair ensures you share in the structural upside of the entire ecosystem. Everyone buying in becomes an owner.",
    icon: <Handshake className="h-5 w-5" />,
    testId: "phase-4-closing-hammer",
  },
  {
    id: 5,
    label: "Seamless Enrollment",
    objective: "Transition seamlessly into immediate profile setup and payment capture.",
    script:
      "Individual investor positions are capped at 100 chairs to prevent corporate buyouts, and local launch slots are moving fast. All we need to do is scan this QR code right here on my terminal, input your baseline store details, and claim your founding chair. It takes less than five minutes to lock down your Vibe Shield and secure your seat. Let's map your store right now.",
    icon: <Zap className="h-5 w-5" />,
    testId: "phase-5-seamless-enrollment",
  },
];

const OBJECTIONS = [
  {
    testId: "objection-time",
    q: "I don't have time to manage another separate tablet or delivery interface.",
    a: "That is precisely why we designed it this way. Our merchant dashboard is fully optimized to run on a single smartphone. It manages itself, processes orders smoothly, and the built-in Vibe Shield identifies and wipes out fraudulent customer activity before it ever touches your workflow. It preserves your operational time, it doesn't consume it.",
  },
  {
    testId: "objection-hidden-costs",
    q: "What hidden costs or fees hit my business down the line?",
    a: "Zero on your core entry framework. Your initial flat fee keeps your storefront on the master hyper-local map, maintains your DSG Token acceptance, and locks your Vibe Shield protection in place permanently. Later on, once you see the order volume proving itself, you have the option to run premium 24/7 video ads on our DSG TV broadcast network or launch localized hyper-push blasts, but those are completely self-directed upgrades for when you are ready to expand your reach.",
  },
];

export default function MerchantAmbassador() {
  const navigate = useNavigate();
  const [activePhase, setActivePhase] = useState(1);
  const [copiedPhaseId, setCopiedPhaseId] = useState<number | null>(null);

  const phase = useMemo(
    () => PHASES.find((p) => p.id === activePhase) || PHASES[0],
    [activePhase]
  );

  const joinUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/merchant/join`;
  }, []);

  async function copyScript(p: Phase) {
    try {
      await navigator.clipboard.writeText(p.script);
      setCopiedPhaseId(p.id);
      setTimeout(() => setCopiedPhaseId(null), 1500);
    } catch {
      toast.error("Could not copy script");
    }
  }

  return (
    <div
      data-testid="merchant-ambassador-page"
      className="min-h-screen bg-gradient-to-br from-[#0c0716] via-[#120a23] to-[#070514] text-white"
    >
      {/* Header */}
      <header className="border-b border-white/5">
        <div className="mx-auto max-w-5xl px-6 py-6 flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.25em] text-fuchsia-200">
              Field Ambassador · Genius Phase
            </div>
            <h1 className="mt-1 text-2xl sm:text-3xl font-black">
              High-Conversion Playbook
            </h1>
          </div>
          <button
            data-testid="ambassador-back-btn"
            onClick={() => navigate("/merchant/join")}
            className="text-sm text-white/60 hover:text-white"
          >
            ← Business Brief
          </button>
        </div>
      </header>

      {/* Phase pills */}
      <section className="mx-auto max-w-5xl px-6 pt-6">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {PHASES.map((p) => (
            <button
              key={p.id}
              data-testid={`ambassador-phase-pill-${p.id}`}
              onClick={() => setActivePhase(p.id)}
              className={`shrink-0 inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold uppercase tracking-wider transition ${
                activePhase === p.id
                  ? "bg-fuchsia-400 text-black"
                  : "bg-white/5 border border-white/10 hover:border-white/30"
              }`}
            >
              {p.icon}
              Phase {p.id} · {p.label}
            </button>
          ))}
        </div>
      </section>

      {/* Active phase card */}
      <section className="mx-auto max-w-5xl px-6 py-6">
        <div
          data-testid={phase.testId}
          className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-fuchsia-400 text-black">
              {phase.icon}
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-white/50">
                Phase {phase.id}
              </div>
              <h2 className="text-xl font-bold">{phase.label}</h2>
            </div>
          </div>
          <div className="rounded-xl bg-fuchsia-300/5 border border-fuchsia-300/20 p-4 mb-4">
            <div className="text-xs uppercase tracking-wider text-fuchsia-200 mb-1">
              Objective
            </div>
            <div className="text-sm text-white/90">{phase.objective}</div>
          </div>
          <div className="rounded-xl bg-white/5 border border-white/10 p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs uppercase tracking-wider text-white/50">
                Script
              </div>
              <button
                data-testid={`ambassador-copy-${phase.id}`}
                onClick={() => copyScript(phase)}
                className="inline-flex items-center gap-1 text-xs text-cyan-300 hover:text-cyan-200"
              >
                {copiedPhaseId === phase.id ? (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5" /> Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" /> Copy script
                  </>
                )}
              </button>
            </div>
            <p className="text-sm leading-relaxed text-white/85 whitespace-pre-line">
              {phase.script}
            </p>
          </div>
          <div className="mt-4 flex justify-between">
            <button
              disabled={phase.id <= 1}
              onClick={() => setActivePhase(Math.max(1, phase.id - 1))}
              className="text-xs text-white/50 hover:text-white disabled:opacity-30"
            >
              ← previous phase
            </button>
            <button
              data-testid={`ambassador-next-${phase.id}`}
              disabled={phase.id >= PHASES.length}
              onClick={() => setActivePhase(Math.min(PHASES.length, phase.id + 1))}
              className="inline-flex items-center gap-1 text-xs font-bold text-cyan-300 hover:text-cyan-200 disabled:opacity-30"
            >
              next phase <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </section>

      {/* Scan asset summary */}
      <section className="mx-auto max-w-5xl px-6 pb-6">
        <div
          data-testid="ambassador-scan-asset"
          className="rounded-3xl border border-fuchsia-300/30 bg-fuchsia-400/[0.06] p-6"
        >
          <div className="flex items-center gap-2 mb-3">
            <QrCode className="h-5 w-5 text-fuchsia-300" />
            <h3 className="text-lg font-bold">Scan Asset · Merchant Onboarding Portal</h3>
          </div>
          <div className="grid gap-6 sm:grid-cols-[160px_1fr]">
            <div className="rounded-xl bg-white p-3 flex items-center justify-center" style={{ width: 160, height: 160 }}>
              <QRCodeSVG value={joinUrl} size={132} includeMargin={false} />
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-fuchsia-200 mb-2">
                Ecosystem Status
              </div>
              <div className="text-sm font-bold text-white mb-3">
                Active Genius Phase Launch Architecture
              </div>
              <div className="text-xs uppercase tracking-wider text-fuchsia-200 mb-2">
                Core Deliverables
              </div>
              <ul className="space-y-1.5 text-sm text-white/85">
                <li className="flex items-center gap-2" data-testid="deliverable-hyper-local">
                  <MapPin className="h-4 w-4 text-cyan-300" /> Permanent Hyper-Local Indexing
                </li>
                <li className="flex items-center gap-2" data-testid="deliverable-vibe-shield">
                  <ShieldCheck className="h-4 w-4 text-emerald-300" /> Vibe Shield Transactional Safety Ring
                </li>
                <li className="flex items-center gap-2" data-testid="deliverable-dsg-token">
                  <Megaphone className="h-4 w-4 text-fuchsia-300" /> DSG Token Instant POS Integration
                </li>
                <li className="flex items-center gap-2" data-testid="deliverable-chair">
                  <Crown className="h-4 w-4 text-amber-300" /> 1 Automated Founder's Chair Asset ($20 Value Covered)
                </li>
              </ul>
              <button
                data-testid="ambassador-launch-cta"
                onClick={() => navigate("/merchant/join")}
                className="mt-5 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-fuchsia-500 to-cyan-400 px-6 py-3 font-bold text-black hover:brightness-110"
              >
                CLAIM FOUNDING SEAT &amp; LAUNCH STORE DASHBOARD
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Objection matrix */}
      <section className="mx-auto max-w-5xl px-6 pb-12">
        <div className="flex items-center gap-2 mb-3">
          <Target className="h-5 w-5 text-amber-300" />
          <h3 className="text-lg font-bold">Quick-Reference Objection Matrix</h3>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {OBJECTIONS.map((o) => (
            <div
              key={o.testId}
              data-testid={o.testId}
              className="rounded-2xl border border-white/10 bg-white/5 p-5"
            >
              <div className="text-xs uppercase tracking-wider text-amber-200 mb-2">
                Objection
              </div>
              <p className="text-sm text-white/90 mb-3">"{o.q}"</p>
              <div className="text-xs uppercase tracking-wider text-emerald-200 mb-2">
                Response
              </div>
              <p className="text-sm text-white/80 leading-relaxed">{o.a}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
