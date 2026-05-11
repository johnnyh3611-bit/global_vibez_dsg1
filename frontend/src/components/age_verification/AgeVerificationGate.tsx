/**
 * AgeVerificationGate — inline gate for restricted-goods features.
 *
 * Wraps any UI that should only render for 21+ verified users:
 *
 *   <AgeVerificationGate category="alcohol">
 *     <CheckoutButton ... />
 *   </AgeVerificationGate>
 *
 * Behaviors:
 *   - eligible → renders children
 *   - not submitted / pending → renders a banner with a CTA to /restricted-goods-verification
 *   - rejected → renders the decline copy + "appeal" CTA
 *
 * Hits `/api/age-verification/eligibility/{category}` so the actual
 * shadow-gate logic stays on the server.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldAlert, ShieldCheck, Clock3, AlertTriangle, ArrowRight } from "lucide-react";
import { authFetch } from "@/utils/secureAuth";

const API = process.env.REACT_APP_BACKEND_URL;

interface Props {
  category: "alcohol" | "tobacco" | string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface EligibilityResp {
  eligible: boolean;
  category: string;
  status?: string;
  reason?: string;
}

export default function AgeVerificationGate({ category, children, fallback }: Props) {
  const navigate = useNavigate();
  const [data, setData] = useState<EligibilityResp | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await authFetch(`${API}/api/age-verification/eligibility/${category}`);
        if (!res.ok) {
          if (!cancelled) setData({ eligible: false, category, reason: "not_submitted" });
        } else if (!cancelled) {
          setData((await res.json()) as EligibilityResp);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [category]);

  if (loading) {
    return (
      <div
        className="rounded-xl border border-fuchsia-500/15 bg-[#0F0720] p-3 animate-pulse text-xs text-purple-300/70"
        data-testid={`avp-gate-loading-${category}`}
      >
        Checking 21+ verification…
      </div>
    );
  }

  if (data?.eligible) {
    return <>{children}</>;
  }

  if (fallback) return <>{fallback}</>;

  // Status-aware fallback banner.
  const reason = data?.reason || "not_submitted";

  if (reason === "pending_review") {
    return (
      <div
        className="rounded-xl border border-cyan-400/30 bg-cyan-500/10 p-3 flex items-start gap-2.5"
        data-testid={`avp-gate-pending-${category}`}
      >
        <Clock3 className="w-4 h-4 text-cyan-300 mt-0.5 flex-shrink-0" />
        <div className="flex-1 text-xs">
          <p className="font-bold text-cyan-100">Awaiting review</p>
          <p className="text-cyan-100/75 mt-0.5">
            Your 21+ verification is being reviewed — usually within 24 hours.
          </p>
        </div>
      </div>
    );
  }

  if (data?.status === "rejected") {
    return (
      <div
        className="rounded-xl border border-red-500/30 bg-red-500/10 p-3"
        data-testid={`avp-gate-rejected-${category}`}
      >
        <div className="flex items-start gap-2.5 mb-2">
          <ShieldAlert className="w-4 h-4 text-red-300 mt-0.5 flex-shrink-0" />
          <div className="flex-1 text-xs">
            <p className="font-bold text-red-100">21+ verification declined</p>
            <p className="text-red-100/80 mt-0.5">You may appeal the decision.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigate("/restricted-goods-verification")}
          className="w-full inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-full bg-red-500 hover:bg-red-400 text-white text-[11px] font-bold"
          data-testid={`avp-gate-appeal-${category}`}
        >
          Appeal <ArrowRight className="w-3 h-3" />
        </button>
      </div>
    );
  }

  // not_submitted / underage / default
  return (
    <div
      className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-3"
      data-testid={`avp-gate-not-verified-${category}`}
    >
      <div className="flex items-start gap-2.5 mb-2">
        {reason === "underage" ? (
          <ShieldAlert className="w-4 h-4 text-amber-300 mt-0.5 flex-shrink-0" />
        ) : (
          <AlertTriangle className="w-4 h-4 text-amber-300 mt-0.5 flex-shrink-0" />
        )}
        <div className="flex-1 text-xs">
          <p className="font-bold text-amber-100">
            {reason === "underage"
              ? "21+ required"
              : `Verify your age to unlock ${category}`}
          </p>
          <p className="text-amber-100/80 mt-0.5">
            {reason === "underage"
              ? "Alcohol and tobacco delivery requires verified 21+ accounts."
              : "Submit your ID and a selfie — most reviews finish within 24 hours."}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => navigate("/restricted-goods-verification")}
        className="w-full inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-full bg-amber-400 hover:bg-amber-300 text-amber-950 text-[11px] font-bold"
        data-testid={`avp-gate-verify-${category}`}
      >
        <ShieldCheck className="w-3 h-3" /> Verify now
      </button>
    </div>
  );
}
