/**
 * SpotifyCallback — mirrors SmartcarCallback for Spotify OAuth return.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Music, Loader2, Check, X } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

const SpotifyCallback: React.FC = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"processing" | "ok" | "error">("processing");
  const [message, setMessage] = useState("Connecting your Spotify...");
  // StrictMode in React 18 double-invokes effects. OAuth codes are single-use
  // so the second call would fail with "code already used" AND potentially
  // race on the Response body. Latch the exchange to run exactly once.
  const ran = useRef(false);

  const code = params.get("code");
  const err = params.get("error");

  const exchange = useCallback(async () => {
    if (err) {
      setStatus("error");
      setMessage(`Spotify reported: ${err}`);
      return;
    }
    if (!code) {
      setStatus("error");
      setMessage("No authorization code returned. Did you cancel?");
      return;
    }
    try {
      const res = await fetch(`${API}/api/spotify/exchange-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, state: params.get("state") }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || `Exchange failed (${res.status})`);
      setStatus("ok");
      setMessage("Spotify connected. Redirecting...");
      setTimeout(() => navigate("/spotify"), 1200);
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
    <div className="min-h-screen bg-black text-white flex items-center justify-center" data-testid="spotify-callback">
      <div className="p-8 rounded-2xl bg-neutral-900/60 border border-white/5 text-center max-w-md">
        <Music className="w-12 h-12 mx-auto text-emerald-400 mb-4" />
        <div className="flex items-center justify-center gap-2 mb-3">
          {status === "processing" && <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />}
          {status === "ok" && <Check className="w-5 h-5 text-emerald-400" />}
          {status === "error" && <X className="w-5 h-5 text-rose-400" />}
          <span className="font-bold uppercase tracking-widest text-xs">
            {status === "processing" ? "Processing" : status === "ok" ? "Connected" : "Failed"}
          </span>
        </div>
        <p className="text-neutral-400 text-sm">{message}</p>
        {status === "error" && (
          <button
            onClick={() => navigate("/spotify")}
            className="mt-4 px-4 py-2 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-sm hover:bg-emerald-500/30"
          >
            Try again
          </button>
        )}
      </div>
    </div>
  );
};

export default SpotifyCallback;
