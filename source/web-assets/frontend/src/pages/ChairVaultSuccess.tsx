/**
 * /chair-vault/success — Helio/Solana redirect target after parking chairs.
 * Polls /api/chairs/checkout-status/{session_id}, then redirects to /chair-vault.
 */
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Sparkles, Check, Loader2 } from "lucide-react";
import { authFetch } from "@/utils/secureAuth";
import { getBackendUrl } from "@/config/backendUrl";

const API = getBackendUrl();

export default function ChairVaultSuccess() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"polling" | "activated" | "error">("polling");
  const [quantity, setQuantity] = useState<number>(0);

  useEffect(() => {
    let sessionId =
      params.get("session_id") ||
      params.get("payment_id") ||
      "";
    if (!sessionId) {
      try {
        sessionId = sessionStorage.getItem("chair_pending_payment_id") || "";
      } catch {
        sessionId = "";
      }
    }
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
          `${API}/api/chairs/checkout-status/${encodeURIComponent(sessionId)}`
        );
        if (cancelled) return;
        if (r.ok) {
          const body = await r.json();
          if (body.status === "activated") {
            setQuantity(Number(body.quantity) || 0);
            setStatus("activated");
            try {
              sessionStorage.removeItem("chair_pending_payment_id");
            } catch {
              /* ignore */
            }
            setTimeout(() => navigate("/chair-vault"), 2500);
            return;
          }
        }
      } catch {
        /* keep polling */
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
      data-testid="chair-vault-success"
      className="min-h-screen bg-[#050507] flex items-center justify-center text-cyan-100 px-6"
    >
      <div className="max-w-lg w-full rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-3xl p-8 text-center">
        {status === "polling" && (
          <>
            <Loader2 className="w-10 h-10 text-amber-300 animate-spin mx-auto" />
            <h1 className="mt-4 text-2xl font-black">Parking your chair…</h1>
            <p className="mt-2 text-sm text-cyan-300/80">
              Confirming Helio / Solana payment.
            </p>
          </>
        )}
        {status === "activated" && (
          <>
            <div className="w-14 h-14 mx-auto rounded-full bg-emerald-400/20 border border-emerald-400/40 flex items-center justify-center">
              <Check className="w-7 h-7 text-emerald-300" />
            </div>
            <h1 className="mt-4 text-2xl font-black">Chair parked.</h1>
            <p className="mt-2 text-sm text-cyan-300/80">
              {quantity > 0
                ? `${quantity} chair${quantity > 1 ? "s" : ""} locked in your Vault. Redirecting…`
                : "Locked in your Vault. Redirecting…"}
            </p>
          </>
        )}
        {status === "error" && (
          <>
            <Sparkles className="w-10 h-10 text-rose-300 mx-auto" />
            <h1 className="mt-4 text-2xl font-black">Couldn't confirm payment</h1>
            <p className="mt-2 text-sm text-cyan-300/80">
              If you were charged, contact support — your chairs will be parked manually.
            </p>
            <button
              onClick={() => navigate("/chair-vault")}
              className="mt-4 rounded-xl bg-amber-500 text-black px-4 py-2 text-sm font-bold"
              data-testid="chair-vault-success-back"
            >
              Back to Chair Vault
            </button>
          </>
        )}
      </div>
    </div>
  );
}
