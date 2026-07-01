/**
 * SmartcarCallback — lands here after the user approves vehicle access.
 * URL: /smartcar/callback?code=xxx&state=<user_id>
 *
 * Posts the code to /api/smartcar/exchange-code, stores the tokens server-side,
 * then redirects to /smartcar so the user sees their connected vehicles.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Car, Loader2, Check, X } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

const SmartcarCallback: React.FC = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"processing" | "ok" | "error">("processing");
  const [message, setMessage] = useState("Connecting your vehicle...");
  // OAuth codes are single-use — guard React 18 StrictMode double-invoke.
  const ran = useRef(false);

  const code = params.get("code");
  const err = params.get("error");

  const exchange = useCallback(async () => {
    if (err) {
      setStatus("error");
      setMessage(`Smartcar reported: ${err}`);
      return;
    }
    if (!code) {
      setStatus("error");
      setMessage("No authorization code returned. Did you cancel?");
      return;
    }
    try {
      const res = await fetch(`${API}/api/smartcar/exchange-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, state: params.get("state") }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || `Exchange failed (${res.status})`);
      setStatus("ok");
      setMessage("Vehicle connected. Redirecting...");
      setTimeout(() => navigate("/smartcar"), 1200);
    } catch (e) {
      setStatus("error");
      setMessage((e as Error).message);
    }
  }, [code, err, navigate, params]);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    exchange();
  }, [exchange]);

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center" data-testid="smartcar-callback">
      <div className="p-8 rounded-2xl bg-neutral-900/60 border border-white/5 text-center max-w-md">
        <Car className="w-12 h-12 mx-auto text-fuchsia-400 mb-4" />
        <div className="flex items-center justify-center gap-2 mb-3">
          {status === "processing" && <Loader2 className="w-5 h-5 animate-spin text-fuchsia-400" />}
          {status === "ok" && <Check className="w-5 h-5 text-emerald-400" />}
          {status === "error" && <X className="w-5 h-5 text-rose-400" />}
          <span className="font-bold uppercase tracking-widest text-xs">
            {status === "processing" ? "Processing" : status === "ok" ? "Connected" : "Failed"}
          </span>
        </div>
        <p className="text-neutral-400 text-sm">{message}</p>
        {status === "error" && (
          <button
            onClick={() => navigate("/smartcar")}
            className="mt-4 px-4 py-2 rounded-lg bg-fuchsia-500/20 border border-fuchsia-500/40 text-sm hover:bg-fuchsia-500/30"
          >
            Try again
          </button>
        )}
      </div>
    </div>
  );
};

export default SmartcarCallback;
