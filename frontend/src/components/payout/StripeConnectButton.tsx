/**
 * StripeConnectButton — drop-in "Set up payouts" pill for any role page.
 *
 * 2026-05-12 founder ask: "wire Stripe Connect Express onboarding into
 * /driver/wallet + /hungryvibes/merchant + /vibe-venues/host-dashboard
 * so payouts auto-deposit to driver/merchant/host bank accounts." Founder
 * approved scaffolding NOW so keys can be plugged in later.
 *
 * Behavior depends on backend's `configured` flag:
 *   • configured=false  → "Available after launch" disabled badge
 *   • payouts_enabled   → green "Payouts active · manage" pill (opens
 *                          Express dashboard via /login-link)
 *   • not_started       → primary "Set up payouts" button → /onboard →
 *                          window.location.assign(onboarding_url)
 *   • partially_done    → amber "Finish setup" button → /onboard again
 *
 * Polls /api/connect/status on mount + every 30s, so when the user
 * returns from Stripe with ?connect=ok the button auto-flips to green
 * without a refresh.
 */
import { useEffect, useState } from "react";
import { CheckCircle2, ExternalLink, Loader2, ShieldCheck, Wallet } from "lucide-react";
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

type Props = {
  role: "driver" | "host" | "merchant" | "streamer";
  variant?: "primary" | "compact";
};

export default function StripeConnectButton({ role, variant = "primary" }: Props) {
  const [status, setStatus] = useState<ConnectStatus | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await authFetch(`${API}/api/connect/status`);
        if (!res.ok) return;
        const d = await res.json();
        if (!cancelled) setStatus(d);
      } catch {
        /* silent — status simply stays null and the button auto-hides */
      }
    };
    load();
    const id = setInterval(load, 30000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (!status) return null;

  // Pre-launch banner (no live Stripe keys yet)
  if (!status.configured) {
    return (
      <div
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-700/40 border border-slate-500/40 text-slate-300 text-xs"
        data-testid="connect-not-configured"
      >
        <ShieldCheck className="w-3.5 h-3.5" />
        Stripe payouts — available after launch
      </div>
    );
  }

  // Already onboarded + payouts active
  if (status.account_id && status.payouts_enabled) {
    const openExpress = async () => {
      setBusy(true);
      try {
        const res = await authFetch(`${API}/api/connect/login-link`);
        const d = await res.json();
        if (d?.url) window.location.assign(d.url);
        else toast.error("Could not open Stripe dashboard");
      } finally {
        setBusy(false);
      }
    };
    return (
      <button
        type="button"
        onClick={openExpress}
        disabled={busy}
        data-testid="connect-manage-btn"
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/15 hover:bg-emerald-500/30 border border-emerald-400/50 text-emerald-200 text-xs font-bold transition-colors disabled:opacity-50"
      >
        <CheckCircle2 className="w-3.5 h-3.5" />
        Payouts active · manage
        <ExternalLink className="w-3 h-3" />
      </button>
    );
  }

  // Not started OR partial — start (or resume) onboarding.
  const startOnboarding = async () => {
    setBusy(true);
    try {
      const res = await authFetch(`${API}/api/connect/onboard`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.detail || "Could not start payout setup");
        return;
      }
      const d = await res.json();
      if (d.onboarding_url) {
        window.location.assign(d.onboarding_url);
      } else {
        toast.error(d.message || "Stripe not configured yet");
      }
    } finally {
      setBusy(false);
    }
  };

  const inProgress = status.account_id && status.details_submitted === false;
  const label = inProgress ? "Finish payout setup" : "Set up payouts";
  const cls = inProgress
    ? "bg-amber-500/20 hover:bg-amber-500/40 border-amber-400/50 text-amber-100"
    : "bg-fuchsia-500 hover:bg-fuchsia-400 border-fuchsia-400 text-white";

  if (variant === "compact") {
    return (
      <button
        type="button"
        onClick={startOnboarding}
        disabled={busy}
        data-testid="connect-onboard-btn"
        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full ${cls} border text-[10px] font-bold uppercase tracking-widest transition-colors disabled:opacity-50`}
      >
        {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wallet className="w-3 h-3" />}
        {label}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={startOnboarding}
      disabled={busy}
      data-testid="connect-onboard-btn"
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${cls} border text-sm font-bold transition-colors disabled:opacity-50`}
    >
      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wallet className="w-4 h-4" />}
      {label}
    </button>
  );
}
