/**
 * AgeVerificationGate — page-level wrapper that blocks access to any
 * 18+ surface (casino tables, dating, vault) until the user finishes
 * the /age-verification flow.
 *
 * Rebuilt May 13 2026 (founder compliance ask). Replaces the version
 * that was deleted in the May-2026 dead-file sweep because nothing was
 * importing it. New strategy: any page that wants gating wraps its
 * content with `<AgeVerificationGate>` and the gate calls
 * `GET /api/age-verification/eligibility/{user_id}` to decide whether
 * to render the children, show a "verify your age" CTA, or kick the
 * user to /age-verification.
 *
 * Three states surfaced:
 *  • LOADING      — eligibility request in flight
 *  • VERIFIED     — children render
 *  • NOT_VERIFIED — CTA card with a "Verify Now" button → /age-verification
 *
 * This keeps the actual age-gating logic centralized; legal compliance
 * for state-by-state casino rules + app-store review.
 */
import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ShieldCheck, Loader2, AlertTriangle } from "lucide-react";
import { getUserId } from "@/utils/secureAuth";

const API = process.env.REACT_APP_BACKEND_URL ?? "";

type Eligibility = {
  verified: boolean;
  status?: "approved" | "pending" | "rejected" | "not_started";
  age?: number;
  jurisdiction_ok?: boolean;
};

export const AgeVerificationGate = ({
  children,
  surfaceName = "this area",
}: {
  children: ReactNode;
  surfaceName?: string;
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
    fetch(`${API}/api/age-verification/eligibility/${userId}`)
      .then(async (r) => {
        if (!r.ok) {
          setState("blocked");
          setReason(`Eligibility check failed (${r.status})`);
          return;
        }
        const body: Eligibility = await r.json();
        if (body.verified) {
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
        setState("blocked");
        setReason("Network error — please retry in a moment.");
      });
  }, [userId]);

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
