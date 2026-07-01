/**
 * StripeConnectWizard — guided payout setup flow for drivers / merchants /
 * hosts / streamers. Lifts the previously one-tap StripeConnectButton into
 * a proper 3-step wizard so users understand what's happening:
 *
 *   Step 1: What you'll need (ID, bank acct, tax info) + expectation setting
 *   Step 2: Redirect to Stripe-hosted onboarding (Stripe handles secure data)
 *   Step 3: Verification status with live polling + actionable requirements
 *
 * Route: /payouts/setup?role=driver|host|merchant|streamer
 * Used by: driver dashboard, merchant dashboard, host dashboard, streamer page.
 */
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  BadgeCheck,
  CheckCircle2,
  Clock3,
  FileCheck,
  IdCard,
  Loader2,
  ShieldCheck,
  Wallet as WalletIcon,
} from "lucide-react";
import { toast } from "sonner";
import { authFetch } from "@/utils/secureAuth";

const API = process.env.REACT_APP_BACKEND_URL;

type ConnectStatus = {
  success: boolean;
  configured: boolean;
  account_id: string | null;
  payouts_enabled: boolean;
  charges_enabled: boolean;
  details_submitted: boolean;
  requirements_currently_due?: string[];
};

type Role = "driver" | "host" | "merchant" | "streamer";

const ROLE_COPY: Record<Role, { label: string; payoutDesc: string }> = {
  driver: {
    label: "Vibez Ridez Driver",
    payoutDesc:
      "Ride fares + tips deposit to your bank account every Friday, minus the 2% Vibe Tax.",
  },
  host: {
    label: "Vibe Venues Host",
    payoutDesc:
      "Booking earnings release to your bank after each successful Vibe-Check, minus the platform fee.",
  },
  merchant: {
    label: "Hungry Vibez Merchant",
    payoutDesc:
      "Order proceeds deposit to your bank account weekly, minus the 2% Vibe Tax.",
  },
  streamer: {
    label: "DSG TV Streamer",
    payoutDesc:
      "Gift earnings and pay-per-view revenue payout monthly.",
  },
};

export default function StripeConnectWizard() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const roleRaw = (params.get("role") || "driver") as Role;
  const role: Role = ["driver", "host", "merchant", "streamer"].includes(roleRaw)
    ? roleRaw
    : "driver";

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [status, setStatus] = useState<ConnectStatus | null>(null);
  const [busy, setBusy] = useState(false);

  // Auto-poll status — when the user returns from Stripe we jump to step 3.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await authFetch(`${API}/api/connect/status`);
        if (!res.ok) return;
        const d = (await res.json()) as ConnectStatus;
        if (cancelled) return;
        setStatus(d);
        // If they've already started + come back here, jump to step 3.
        if (d.account_id && step === 1) setStep(3);
      } catch {
        /* silent */
      }
    };
    load();
    const id = setInterval(load, 8000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [step]);

  const startOnboarding = async () => {
    setBusy(true);
    setStep(2);
    try {
      const res = await authFetch(`${API}/api/connect/onboard`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.detail || "Could not start payout setup");
        setStep(1);
        return;
      }
      const d = await res.json();
      if (d.onboarding_url) {
        window.location.assign(d.onboarding_url);
      } else {
        toast.info(d.message || "Stripe is not configured yet — coming soon.");
        setStep(1);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-[#07030F] via-[#0a0815] to-[#170a23] text-white px-4 py-8"
      data-testid="stripe-connect-wizard"
    >
      <div className="max-w-2xl mx-auto">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-purple-300/70 hover:text-white text-sm mb-4"
          data-testid="connect-wizard-back"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-fuchsia-600 to-purple-700 shadow-[0_0_20px_rgba(217,70,239,0.45)] flex items-center justify-center">
            <WalletIcon className="w-7 h-7 text-white" />
          </div>
          <div>
            <p className="text-xs font-mono uppercase tracking-[0.3em] text-fuchsia-400/80">
              Payouts · {ROLE_COPY[role].label}
            </p>
            <h1 className="text-3xl md:text-4xl font-black">Set up bank deposits</h1>
          </div>
        </div>
        <p className="text-sm text-purple-200/80 mb-8">{ROLE_COPY[role].payoutDesc}</p>

        {/* Stepper */}
        <div className="flex items-center justify-between mb-8" data-testid="connect-wizard-stepper">
          {[
            { n: 1, label: "Get ready", icon: FileCheck },
            { n: 2, label: "Verify identity", icon: IdCard },
            { n: 3, label: "Activate", icon: BadgeCheck },
          ].map((s, i, arr) => {
            const Icon = s.icon;
            const active = step >= s.n;
            return (
              <div key={s.n} className="flex items-center flex-1 last:flex-initial">
                <div
                  className={`flex flex-col items-center gap-1.5 ${
                    active ? "text-fuchsia-200" : "text-white/30"
                  }`}
                  data-testid={`connect-step-${s.n}`}
                >
                  <div
                    className={`w-10 h-10 rounded-full border-2 flex items-center justify-center ${
                      active
                        ? "border-fuchsia-400 bg-fuchsia-500/20 shadow-[0_0_18px_rgba(217,70,239,0.45)]"
                        : "border-white/15 bg-white/5"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] uppercase tracking-widest font-bold">
                    {s.label}
                  </span>
                </div>
                {i < arr.length - 1 && (
                  <div
                    className={`flex-1 h-px mx-2 ${
                      step > s.n ? "bg-fuchsia-400" : "bg-white/15"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Step bodies */}
        {step === 1 && (
          <Step1
            role={role}
            busy={busy}
            status={status}
            onStart={startOnboarding}
          />
        )}

        {step === 2 && <Step2 />}

        {step === 3 && <Step3 status={status} role={role} navigate={navigate} />}
      </div>
    </div>
  );
}

function Step1({
  role,
  busy,
  status,
  onStart,
}: {
  role: Role;
  busy: boolean;
  status: ConnectStatus | null;
  onStart: () => void;
}) {
  // Pre-launch banner if no Stripe keys yet
  const notConfigured = status && !status.configured;

  return (
    <div
      className="rounded-2xl border border-fuchsia-500/20 bg-[#0F0720] p-6 space-y-4"
      data-testid="connect-step-1-card"
    >
      <h2 className="text-xl font-black">What you'll need</h2>

      <div className="grid sm:grid-cols-2 gap-3">
        <Requirement icon={IdCard} label="Government ID" hint="Driver's license, passport, or state ID" />
        <Requirement icon={Banknote} label="Bank account" hint="Routing + account number for deposits" />
        <Requirement icon={ShieldCheck} label="Tax info" hint="SSN or EIN (US) — required by Stripe" />
        <Requirement icon={Clock3} label="~5 minutes" hint="Most users finish in one sitting" />
      </div>

      <div className="rounded-xl bg-cyan-500/10 border border-cyan-400/25 p-3 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-cyan-300 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-cyan-100/85">
          Your bank + tax info is collected by <b>Stripe directly</b> on their
          secure servers. Global Vibez DSG never sees or stores it.
        </p>
      </div>

      {notConfigured ? (
        <div
          className="rounded-xl bg-amber-500/10 border border-amber-400/30 p-4 text-center"
          data-testid="connect-not-configured-banner"
        >
          <p className="text-sm font-bold text-amber-200 mb-1">
            Available right after launch
          </p>
          <p className="text-xs text-amber-100/70">
            We're activating Stripe payouts during the public launch. Until then,
            your earnings accrue safely in your Vibe Account and we settle via
            manual transfer on request.
          </p>
        </div>
      ) : (
        <button
          type="button"
          onClick={onStart}
          disabled={busy}
          className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-fuchsia-500 hover:bg-fuchsia-400 text-white text-sm font-bold transition-colors disabled:opacity-50 shadow-[0_0_22px_rgba(217,70,239,0.45)]"
          data-testid="connect-wizard-start-btn"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
          Start verification
        </button>
      )}
    </div>
  );
}

function Step2() {
  return (
    <div
      className="rounded-2xl border border-fuchsia-500/20 bg-[#0F0720] p-10 text-center space-y-4"
      data-testid="connect-step-2-card"
    >
      <Loader2 className="w-10 h-10 mx-auto animate-spin text-fuchsia-300" />
      <h2 className="text-xl font-black">Opening Stripe…</h2>
      <p className="text-sm text-purple-200/70">
        We're redirecting you to Stripe's secure verification portal. You'll come
        back here automatically once you're done.
      </p>
    </div>
  );
}

function Step3({
  status,
  role,
  navigate,
}: {
  status: ConnectStatus | null;
  role: Role;
  navigate: ReturnType<typeof useNavigate>;
}) {
  if (!status) {
    return (
      <div className="rounded-2xl border border-fuchsia-500/20 bg-[#0F0720] p-10 text-center">
        <Loader2 className="w-10 h-10 mx-auto animate-spin text-fuchsia-300" />
        <p className="mt-3 text-sm text-purple-200/70">Checking your account status…</p>
      </div>
    );
  }

  const finishExpress = async () => {
    const res = await authFetch(`${API}/api/connect/onboard`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    const d = await res.json();
    if (d.onboarding_url) window.location.assign(d.onboarding_url);
  };

  if (status.payouts_enabled) {
    return (
      <div
        className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-8 text-center space-y-4"
        data-testid="connect-step-3-success"
      >
        <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-300" />
        <h2 className="text-2xl font-black text-emerald-200">Payouts active</h2>
        <p className="text-sm text-emerald-100/80 max-w-md mx-auto">
          You're verified. Future {ROLE_COPY[role].label.toLowerCase()} earnings
          will deposit automatically to your bank account.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="px-5 py-2 rounded-full bg-emerald-500 hover:bg-emerald-400 text-[#072A1E] text-sm font-bold"
            data-testid="connect-success-go-dashboard"
          >
            Back to dashboard
          </button>
          <button
            type="button"
            onClick={async () => {
              const res = await authFetch(`${API}/api/connect/login-link`);
              const d = await res.json();
              if (d?.url) window.location.assign(d.url);
            }}
            className="px-5 py-2 rounded-full bg-white/5 hover:bg-white/15 border border-white/15 text-sm text-emerald-100"
            data-testid="connect-success-manage"
          >
            Manage in Stripe
          </button>
        </div>
      </div>
    );
  }

  const due = status.requirements_currently_due ?? [];

  return (
    <div
      className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-6 space-y-4"
      data-testid="connect-step-3-pending"
    >
      <div className="flex items-center gap-3">
        <Clock3 className="w-8 h-8 text-amber-300" />
        <div>
          <h2 className="text-xl font-black text-amber-200">Almost there</h2>
          <p className="text-xs text-amber-100/70">
            Stripe needs a few more pieces of information before activating payouts.
          </p>
        </div>
      </div>

      {due.length > 0 ? (
        <ul className="space-y-1.5 text-sm" data-testid="connect-requirements-due-list">
          {due.map((r) => (
            <li key={r} className="flex items-center gap-2 text-amber-100/85">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-300" />
              <span className="font-mono text-xs">{r.replace(/[._]/g, " ")}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-amber-100/70">
          We're still receiving your verification status from Stripe — refresh in
          a few seconds.
        </p>
      )}

      <button
        type="button"
        onClick={finishExpress}
        className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-amber-400 hover:bg-amber-300 text-amber-950 text-sm font-bold transition-colors"
        data-testid="connect-finish-setup-btn"
      >
        Finish in Stripe <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
}

function Requirement({
  icon: Icon,
  label,
  hint,
}: {
  icon: typeof IdCard;
  label: string;
  hint: string;
}) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl bg-[#1A0D2E] border border-fuchsia-500/10">
      <Icon className="w-5 h-5 text-fuchsia-300 mt-0.5 flex-shrink-0" />
      <div>
        <p className="text-sm font-bold text-purple-100">{label}</p>
        <p className="text-[11px] text-purple-300/65">{hint}</p>
      </div>
    </div>
  );
}
