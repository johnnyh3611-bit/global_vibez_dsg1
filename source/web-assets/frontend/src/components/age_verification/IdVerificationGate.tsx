/**
 * IdVerificationGate — blocks 18+ surfaces (dating, Just-For-The-Night, etc.)
 * until government ID + selfie is approved via /age-verification.
 *
 * Checks GET /api/verification/status (Bearer). Distinct from the 21+
 * restricted-goods AgeVerificationGate.
 */
import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ShieldCheck, Loader2, AlertTriangle } from "lucide-react";
import { authFetch, getUserId } from "@/utils/secureAuth";

const API = process.env.REACT_APP_BACKEND_URL ?? "";

type StatusBody = {
  status?: "approved" | "pending" | "denied" | "unverified" | string;
  message?: string;
};

export const IdVerificationGate = ({
  children,
  surfaceName = "this area",
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
    authFetch(`${API}/api/verification/status`)
      .then(async (r) => {
        if (cancelled) return;
        if (!r.ok) {
          if (failOpen) {
            setState("verified");
            return;
          }
          setState("blocked");
          setReason(`ID check failed (${r.status})`);
          return;
        }
        const body: StatusBody = await r.json();
        if (body.status === "approved") {
          setState("verified");
        } else {
          setState("blocked");
          setReason(
            body.status === "pending"
              ? "Your ID verification is under review (usually under 24 hours)."
              : body.status === "denied"
              ? "Your previous ID submission was declined. Please resubmit."
              : "Government ID + selfie verification is required."
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
        data-testid="id-gate-loading"
        className="min-h-[60vh] flex flex-col items-center justify-center text-amber-200 gap-3"
      >
        <Loader2 className="w-8 h-8 animate-spin" />
        <p className="text-xs uppercase tracking-widest opacity-70">Checking ID verification…</p>
      </div>
    );
  }

  if (state === "blocked") {
    return (
      <div
        data-testid="id-gate-not-verified"
        className="min-h-[60vh] flex items-center justify-center p-6"
      >
        <div className="max-w-md w-full rounded-3xl border border-amber-400/40 bg-gradient-to-br from-amber-950/60 via-black/70 to-rose-950/60 p-8 text-center">
          <AlertTriangle className="w-12 h-12 mx-auto text-amber-300 mb-4" />
          <h2 className="text-xl font-black text-amber-100 mb-2">18+ ID Verification Required</h2>
          <p className="text-sm text-amber-200/80 mb-1">
            To enter {surfaceName}, we must verify you are 18 or older with a government-issued ID.
          </p>
          {reason && (
            <p className="text-[11px] text-amber-300/60 mb-5" data-testid="id-gate-reason">
              {reason}
            </p>
          )}
          <Link
            to="/age-verification"
            data-testid="id-gate-cta"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 text-black font-black text-sm uppercase tracking-wide hover:scale-105 transition-transform"
          >
            <ShieldCheck className="w-4 h-4" />
            Verify ID Now
          </Link>
          <p className="text-[10px] text-amber-300/50 mt-4">
            Driver&apos;s license, passport, or state ID + selfie. Reviewed in under 24 hours.
          </p>
          <Link
            to="/verification/status"
            className="block mt-3 text-[11px] text-amber-200/70 underline hover:text-amber-100"
          >
            Check verification status
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default IdVerificationGate;
