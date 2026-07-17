/**
 * DriverComplianceGate — blocks offering rides until driver license AND
 * vehicle insurance are both verified (GET /api/insurance-verification/check-eligibility).
 */
import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ShieldCheck, Loader2, AlertTriangle, Car } from "lucide-react";
import { authFetch, getUserId } from "@/utils/secureAuth";

const API = process.env.REACT_APP_BACKEND_URL ?? "";

type EligibilityBody = {
  eligible?: boolean;
  driver_license_verified?: boolean;
  insurance_verified?: boolean;
  missing_verifications?: string[];
  message?: string;
};

export const DriverComplianceGate = ({
  children,
  surfaceName = "driver tools",
  failOpen = false,
}: {
  children: ReactNode;
  surfaceName?: string;
  failOpen?: boolean;
}) => {
  const userId = getUserId();
  const [state, setState] = useState<"loading" | "verified" | "blocked">("loading");
  const [body, setBody] = useState<EligibilityBody | null>(null);
  const [reason, setReason] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setState("blocked");
      setReason("Please sign in first.");
      return;
    }
    let cancelled = false;
    authFetch(`${API}/api/insurance-verification/check-eligibility`)
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
        const data: EligibilityBody = await r.json();
        setBody(data);
        if (data.eligible) {
          setState("verified");
        } else {
          setState("blocked");
          setReason(data.message || "Complete driver license and insurance verification.");
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
        data-testid="driver-compliance-loading"
        className="min-h-[60vh] flex flex-col items-center justify-center text-cyan-200 gap-3"
      >
        <Loader2 className="w-8 h-8 animate-spin" />
        <p className="text-xs uppercase tracking-widest opacity-70">Checking driver compliance…</p>
      </div>
    );
  }

  if (state === "blocked") {
    const needLicense = !body?.driver_license_verified;
    const needInsurance = !body?.insurance_verified;
    return (
      <div
        data-testid="driver-compliance-blocked"
        className="min-h-[60vh] flex items-center justify-center p-6"
      >
        <div className="max-w-md w-full rounded-3xl border border-cyan-400/40 bg-gradient-to-br from-cyan-950/60 via-black/70 to-indigo-950/60 p-8 text-center">
          <AlertTriangle className="w-12 h-12 mx-auto text-cyan-300 mb-4" />
          <h2 className="text-xl font-black text-cyan-100 mb-2">Driver Verification Required</h2>
          <p className="text-sm text-cyan-200/80 mb-1">
            To use {surfaceName}, complete license and insurance verification.
          </p>
          {reason && (
            <p className="text-[11px] text-cyan-300/60 mb-5" data-testid="driver-compliance-reason">
              {reason}
            </p>
          )}
          <div className="flex flex-col gap-3">
            {needLicense && (
              <Link
                to="/driver-license-verification"
                data-testid="driver-compliance-license-cta"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 text-black font-black text-sm uppercase tracking-wide hover:scale-105 transition-transform"
              >
                <Car className="w-4 h-4" />
                Verify Driver License
              </Link>
            )}
            {!needLicense && needInsurance && (
              <Link
                to="/insurance-verification"
                data-testid="driver-compliance-insurance-cta"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 text-black font-black text-sm uppercase tracking-wide hover:scale-105 transition-transform"
              >
                <ShieldCheck className="w-4 h-4" />
                Submit Vehicle Insurance
              </Link>
            )}
            {!needLicense && !needInsurance && (
              <Link
                to="/insurance-verification/status"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 text-black font-black text-sm uppercase tracking-wide"
              >
                Check Status
              </Link>
            )}
          </div>
          <p className="text-[10px] text-cyan-300/50 mt-4">
            Required for rider safety and insurance compliance.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default DriverComplianceGate;
