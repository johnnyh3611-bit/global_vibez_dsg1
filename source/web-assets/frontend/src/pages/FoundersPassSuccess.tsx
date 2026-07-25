/**
 * /founders-pass/success — legacy Stripe redirect target.
 * Stripe checkout is retired; send users to Helio/Solana wallet top-up.
 */
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Sparkles, Check, Loader2 } from "lucide-react";
import { authFetch } from "@/utils/secureAuth";
import {
  isStripeRetiredResponse,
  stripeRetiredMessage,
  WALLET_TOPUP_PATH,
} from "@/utils/stripeRetired";

const API = process.env.REACT_APP_BACKEND_URL;

export default function FoundersPassSuccess() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"polling" | "activated" | "error" | "retired">(
    "polling",
  );
  const [tierName, setTierName] = useState<string>("");
  const [retiredMsg, setRetiredMsg] = useState("");

  useEffect(() => {
    const sessionId = params.get("session_id");
    if (!sessionId) {
      setStatus("error");
      return;
    }
    let cancelled = false;
    let attempts = 0;
    const poll = async () => {
      attempts += 1;
      try {
        const r = await authFetch(
          `${API}/api/founders-pass/checkout-status/${encodeURIComponent(sessionId)}`,
        );
        if (cancelled) return;
        const body = await r.json().catch(() => ({}));
        if (isStripeRetiredResponse(r.status, body)) {
          setRetiredMsg(stripeRetiredMessage(body));
          setStatus("retired");
          setTimeout(() => navigate(WALLET_TOPUP_PATH), 2500);
          return;
        }
        if (r.ok) {
          if (body.status === "activated") {
            setTierName(body.tier);
            setStatus("activated");
            setTimeout(() => navigate("/founders-pass"), 2500);
            return;
          }
        }
      } catch {
        /* noop */
      }
      if (attempts < 20) setTimeout(poll, 1500);
      else if (!cancelled) setStatus("error");
    };
    poll();
    return () => {
      cancelled = true;
    };
  }, [params, navigate]);

  return (
    <div
      data-testid="founders-pass-success"
      className="min-h-screen bg-[#050507] flex items-center justify-center text-cyan-100 px-6"
    >
      <div className="max-w-lg w-full rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-3xl p-8 text-center">
        {status === "polling" && (
          <>
            <Loader2 className="w-10 h-10 text-amber-300 animate-spin mx-auto" />
            <h1 className="mt-4 text-2xl font-black">Locking in your House Tier…</h1>
            <p className="mt-2 text-sm text-cyan-300/80">Confirming payment.</p>
          </>
        )}
        {status === "activated" && (
          <>
            <div className="w-14 h-14 mx-auto rounded-full bg-emerald-400/20 border border-emerald-400/40 flex items-center justify-center">
              <Check className="w-7 h-7 text-emerald-300" />
            </div>
            <h1 className="mt-4 text-2xl font-black">You're in.</h1>
            <p className="mt-2 text-sm text-cyan-300/80">
              {tierName.replace(/_/g, " ")} unlocked. Multiplier active. Redirecting…
            </p>
          </>
        )}
        {status === "retired" && (
          <>
            <Sparkles className="w-10 h-10 text-amber-300 mx-auto" />
            <h1 className="mt-4 text-2xl font-black">Checkout moved</h1>
            <p className="mt-2 text-sm text-cyan-300/80">
              {retiredMsg || "Stripe checkout is retired. Redirecting to wallet…"}
            </p>
          </>
        )}
        {status === "error" && (
          <>
            <Sparkles className="w-10 h-10 text-rose-300 mx-auto" />
            <h1 className="mt-4 text-2xl font-black">Could not confirm</h1>
            <p className="mt-2 text-sm text-cyan-300/80">
              Top up with Helio or Solana from your wallet, then try again.
            </p>
            <button
              type="button"
              className="mt-6 text-amber-300 underline"
              onClick={() => navigate(WALLET_TOPUP_PATH)}
            >
              Open wallet
            </button>
          </>
        )}
      </div>
    </div>
  );
}
