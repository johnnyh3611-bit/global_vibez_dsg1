import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Phone, Video, Shield, Radio } from "lucide-react";
import VibePhoneCard from "@/components/voice/VibePhoneCard";
import { authFetch } from "@/utils/secureAuth";

const API = process.env.REACT_APP_BACKEND_URL;

/**
 * Vibe Phone hub — your masked number, Agora media status, and how
 * FaceTime-style dating calls work. Global IncomingCallModal in App.js
 * rings for inbound calls app-wide.
 */
export default function VibePhonePage() {
  const navigate = useNavigate();
  const [agoraOk, setAgoraOk] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`${API}/api/agora/health`);
        if (!r.ok) {
          if (!cancelled) setAgoraOk(false);
          return;
        }
        const j = await r.json();
        if (!cancelled) setAgoraOk(!!j.configured);
      } catch {
        if (!cancelled) setAgoraOk(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Ensure number is provisioned when landing here
  useEffect(() => {
    authFetch(`${API}/api/vibe-phone/provision`, { method: "POST" }).catch(
      () => null
    );
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-cyan-950/40 to-black text-white p-4 pb-24">
      <div className="max-w-lg mx-auto space-y-6 pt-6">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="text-white/50 hover:text-white text-sm"
        >
          ← Back
        </button>

        <div>
          <h1 className="text-3xl font-black flex items-center gap-2">
            <Phone className="w-8 h-8 text-cyan-300" />
            Vibe Phone
          </h1>
          <p className="text-white/60 text-sm mt-2">
            Privacy-masked calling for dating and rooms. Voice and FaceTime-style
            video both go through the same system.
          </p>
        </div>

        <VibePhoneCard />

        <div
          className={`rounded-2xl border p-4 text-sm ${
            agoraOk
              ? "border-emerald-500/40 bg-emerald-950/30 text-emerald-100"
              : "border-amber-500/40 bg-amber-950/30 text-amber-100"
          }`}
          data-testid="agora-status"
        >
          <div className="flex items-center gap-2 font-bold mb-1">
            <Radio className="w-4 h-4" />
            Media status
          </div>
          {agoraOk === null && <p>Checking…</p>}
          {agoraOk === true && (
            <p>
              Agora is configured — voice and video calls can connect live.
            </p>
          )}
          {agoraOk === false && (
            <p>
              Signaling is live (ring / accept / decline). Live media needs{" "}
              <code className="text-xs">AGORA_APP_ID</code> +{" "}
              <code className="text-xs">AGORA_APP_CERTIFICATE</code> on the
              backend. Until then, calls ring but audio/video won&apos;t join.
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/40 p-4 space-y-3 text-sm text-white/70">
          <p className="font-bold text-white flex items-center gap-2">
            <Video className="w-4 h-4 text-fuchsia-300" />
            How to call someone
          </p>
          <ol className="list-decimal list-inside space-y-2">
            <li>
              Open{" "}
              <button
                type="button"
                className="text-fuchsia-300 underline"
                onClick={() => navigate("/dating/matches")}
              >
                Dating Matches
              </button>{" "}
              and tap <strong>Video</strong> or <strong>Call</strong>.
            </li>
            <li>
              They get a full-screen ringer (works anywhere in the app).
            </li>
            <li>
              Accept → FaceTime-style video (or voice) over Agora.
            </li>
          </ol>
          <p className="flex items-start gap-2 text-xs text-white/50 pt-2">
            <Shield className="w-4 h-4 shrink-0 mt-0.5" />
            Your real phone number stays private — callers see your Vibe number
            only. Real PSTN (calling cell phones) is Phase 2 / Premium.
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigate("/voice-mirror")}
          className="w-full py-3 rounded-xl border border-white/15 text-sm text-white/60 hover:text-white"
        >
          Voice Mirror (translate) is separate →
        </button>
      </div>
    </div>
  );
}
