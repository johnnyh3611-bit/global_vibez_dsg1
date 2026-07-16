/**
 * AgeVerificationGate — page-level wrapper that blocks access to any
 * 18+ surface (dating, vault, restricted goods) until the user finishes
 * the /age-verification flow.
 *
 * Soft-launch note (July 2026): uses GET /api/age-verification/status
 * (Bearer auth). Dating stays ungated by default so Demo Login → discover
 * still works; wrap high-risk surfaces when KYC review is staffed.
 *
 * Three states:
 *  • LOADING      — status request in flight
 *  • VERIFIED     — children render
 *  • NOT_VERIFIED — CTA card → /age-verification
 */
import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ShieldCheck, Loader2, AlertTriangle } from "lucide-react";
import { authFetch, getUserId } from "@/utils/secureAuth";

const API = process.env.REACT_APP_BACKEND_URL ?? "";

type StatusBody = {
  status?: "verified" | "pending" | "rejected" | "not_submitted" | "appeal" | string;
  eligible_for_restricted?: boolean;
  age?: number | null;
};

export const AgeVerificationGate = ({
  children,
  surfaceName = "this area",
  /** When true, treat network/API errors as verified (soft-launch fail-open). */
  failOpen = false,
}: {
  children: ReactNode;
  surfaceName?: string;
  failOpen?: boolean;
}) => {
  const userId = getUserId();
  const [state, setState] = useState<"loading" | "verified" | "blocked">("loading");
  const [reason, setReason] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setState("blocked");
      setReason("Please sign in first.");
      return;
    }
    let cancelled = false;
    authFetch(`${API}/api/age-verification/status`)
      .then(async (r) => {
        if (cancelled) return;
        if (!r.ok) {
          if (failOpen) {
            setState("verified");
            return;
          }
          setState("blocked");
          setReason(`Eligibility check failed (${r.status})`);
          return;
        }
        const body: StatusBody = await r.json();
        if (body.status === "verified" || body.eligible_for_restricted) {
          setState("verified");
        } else {
          setState("blocked");
          setReason(
            body.status === "pending"
              ? "Your age verification is under review."
              : body.status === "rejected"
              ? "Your previous submission was declined."
              : "Age verification is required to enter."
          );
        }
      })
      .catch(() => {
        if (cancelled) return;
        if (failOpen) {
          setState("verified");
          return;
        }
        setState("blocked");
        setReason("Network error — please retry in a moment.");
      });
    return () => {
      cancelled = true;
    };
  }, [userId, failOpen]);

  if (state === "loading") {
    return (
      <div
        data-testid="avp-gate-loading"
        className="min-h-[60vh] flex flex-col items-center justify-center text-amber-200 gap-3"
      >
        <Loader2 className="w-8 h-8 animate-spin" />
        <p className="text-xs uppercase tracking-widest opacity-70">Checking eligibility…</p>
      </div>
    );
  }

  if (state === "blocked") {
    return (
      <div
        data-testid="avp-gate-not-verified"
        className="min-h-[60vh] flex items-center justify-center p-6"
      >
        <div className="max-w-md w-full rounded-3xl border border-amber-400/40 bg-gradient-to-br from-amber-950/60 via-black/70 to-rose-950/60 p-8 text-center">
          <AlertTriangle className="w-12 h-12 mx-auto text-amber-300 mb-4" />
          <h2 className="text-xl font-black text-amber-100 mb-2">18+ Verification Required</h2>
          <p className="text-sm text-amber-200/80 mb-1">
            To enter {surfaceName}, the law requires us to verify you're 18 or older.
          </p>
          {reason && (
            <p className="text-[11px] text-amber-300/60 mb-5" data-testid="avp-gate-reason">
              {reason}
            </p>
          )}
          <Link
            to="/age-verification"
            data-testid="avp-gate-cta"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 text-black font-black text-sm uppercase tracking-wide hover:scale-105 transition-transform"
          >
            <ShieldCheck className="w-4 h-4" />
            Verify Now (2 min)
          </Link>
          <p className="text-[10px] text-amber-300/50 mt-4">
            Government-issued ID + selfie required. Reviewed in under 24 hours.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default AgeVerificationGate;
