/**
 * TopUpSuccess — Stripe success-redirect handler.
 *
 * Polls /api/coins/topup/status/{session_id} until the backend has
 * credited the user's wallet, then redirects them back to wherever
 * they came from (or /dashboard).
 */
import React, { useEffect, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Coins, Loader2, CheckCircle2 } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function TopUpSuccess() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");
  const [status, setStatus] = useState<"polling" | "credited" | "failed">("polling");
  const [coinsCredited, setCoinsCredited] = useState(0);
  const [attempts, setAttempts] = useState(0);

  const poll = useCallback(async () => {
    if (!sessionId) {
      setStatus("failed");
      return;
    }
    try {
      const r = await fetch(`${API}/coins/topup/status/${sessionId}`);
      const d = await r.json();
      if (d.credited) {
        setCoinsCredited(d.coins || 0);
        setStatus("credited");
        return;
      }
    } catch {
      /* retry */
    }
    setAttempts((a) => a + 1);
  }, [sessionId]);

  useEffect(() => {
    poll();
  }, [poll]);

  useEffect(() => {
    if (status !== "polling") return;
    if (attempts >= 8) {
      setStatus("failed");
      return;
    }
    const t = setTimeout(poll, 1500);
    return () => clearTimeout(t);
  }, [attempts, status, poll]);

  useEffect(() => {
    if (status !== "credited") return;
    const t = setTimeout(() => navigate("/dashboard", { replace: true }), 3000);
    return () => clearTimeout(t);
  }, [status, navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-black text-white flex items-center justify-center p-6" data-testid="topup-success-page">
      <div className="max-w-md w-full text-center">
        {status === "polling" && (
          <>
            <Loader2 className="mx-auto w-12 h-12 text-yellow-400 animate-spin mb-4" />
            <h1 className="text-2xl font-bold mb-2">Confirming your payment…</h1>
            <p className="text-slate-400">Stripe is processing — coins land in your wallet in a few seconds.</p>
          </>
        )}
        {status === "credited" && (
          <>
            <CheckCircle2 className="mx-auto w-14 h-14 text-emerald-400 mb-4" />
            <h1 className="text-3xl font-bold mb-2 text-yellow-300">
              ₵{coinsCredited.toLocaleString()} credited!
            </h1>
            <p className="text-slate-300">
              Your wallet has been topped up. Redirecting to dashboard…
            </p>
            <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-yellow-500/15 border border-yellow-400/40 text-yellow-200">
              <Coins className="w-4 h-4" />
              <span className="font-bold">+{coinsCredited.toLocaleString()} ₵</span>
            </div>
          </>
        )}
        {status === "failed" && (
          <>
            <h1 className="text-2xl font-bold mb-2 text-rose-300">Couldn't confirm payment</h1>
            <p className="text-slate-400">
              If your card was charged, your coins will be credited within a minute via Stripe webhook. Refresh the page or
              check back shortly.
            </p>
            <button
              onClick={() => navigate("/dashboard")}
              className="mt-6 px-5 py-2.5 rounded-lg bg-yellow-500 text-slate-950 font-bold hover:bg-yellow-400"
            >
              Back to dashboard
            </button>
          </>
        )}
      </div>
    </div>
  );
}
