/**
 * RideSafetyBar — Call-driver + SOS controls for an active ride.
 *
 * Drops into SafeRideTracking (and by extension the LivePOVViewer
 * chat panel). Talks to:
 *   POST /api/twilio/voice/bridge  (one-tap masked proxy call)
 *   POST /api/twilio/sos           (panic button + SMS alert)
 *
 * Defensively renders nothing if Twilio isn't configured on the
 * backend — /api/twilio/status drives the feature flag.
 */
import { useEffect, useState } from "react";
import { Phone, ShieldAlert, Loader2, Check, X } from "lucide-react";
import { authFetch } from "@/utils/secureAuth";

const API = process.env.REACT_APP_BACKEND_URL;

type Props = {
  rideId: string;
  /** The caller's E.164 phone (rider when passengers are using the
   *  page, driver when drivers use it). Optional — we fall back to
   *  asking the user if it's missing. */
  callerNumber?: string;
  /** The other party's E.164 phone. If omitted we show a disabled
   *  "Call driver" button with a tooltip. */
  calleeNumber?: string;
  /** Metadata handed to the SOS payload so admins can respond fast. */
  driverName?: string;
  lat?: number;
  lon?: number;
};

type CallState = "idle" | "placing" | "ringing" | "ok" | "error";
type SosState = "idle" | "sending" | "sent" | "error";

export default function RideSafetyBar({
  rideId,
  callerNumber,
  calleeNumber,
  driverName,
  lat,
  lon,
}: Props) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [callState, setCallState] = useState<CallState>("idle");
  const [callError, setCallError] = useState<string | null>(null);
  const [sosState, setSosState] = useState<SosState>("idle");
  const [sosError, setSosError] = useState<string | null>(null);

  // Feature flag: only render if Twilio is wired up on the backend.
  useEffect(() => {
    let active = true;
    fetch(`${API}/api/twilio/status`)
      .then((r) => r.json())
      .then((d) => {
        if (active) setEnabled(!!d.configured);
      })
      .catch(() => {
        if (active) setEnabled(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (!enabled) return null;

  const callDriver = async () => {
    if (!callerNumber || !calleeNumber) {
      setCallError("Phone numbers missing for this ride.");
      setCallState("error");
      return;
    }
    setCallState("placing");
    setCallError(null);
    try {
      const r = await authFetch(`${API}/api/twilio/voice/bridge`, {
        method: "POST",
        body: JSON.stringify({
          ride_id: rideId,
          caller_number: callerNumber,
          callee_number: calleeNumber,
        }),
      });
      const d = await r.json();
      if (!r.ok || !d.ok) {
        throw new Error(d?.error || d?.detail || "Call failed");
      }
      setCallState("ringing");
      // Auto-reset UI after a few seconds so the button is usable again
      setTimeout(() => setCallState("ok"), 3000);
      setTimeout(() => setCallState("idle"), 10000);
    } catch (e: any) {
      setCallError(String(e?.message || e).slice(0, 140));
      setCallState("error");
    }
  };

  const triggerSos = async () => {
    if (sosState === "sending" || sosState === "sent") return;
    setSosState("sending");
    setSosError(null);
    try {
      const r = await authFetch(`${API}/api/twilio/sos`, {
        method: "POST",
        body: JSON.stringify({
          ride_id: rideId,
          lat: lat,
          lon: lon,
          driver_name: driverName,
        }),
      });
      const d = await r.json();
      if (!r.ok || !d.ok) {
        throw new Error(d?.detail?.error || d?.error || "SOS failed");
      }
      setSosState("sent");
      // Keep the "sent" confirmation visible for 15s so the user sees it.
      setTimeout(() => setSosState("idle"), 15000);
    } catch (e: any) {
      setSosError(String(e?.message || e).slice(0, 140));
      setSosState("error");
    }
  };

  return (
    <div
      className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-950/70 p-2"
      data-testid="ride-safety-bar"
    >
      {/* Call driver (masked proxy) */}
      <button
        type="button"
        onClick={callDriver}
        disabled={callState === "placing" || !calleeNumber}
        className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
          callState === "ok" || callState === "ringing"
            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
            : "bg-cyan-500/10 text-cyan-200 border border-cyan-500/40 hover:bg-cyan-500/20 disabled:opacity-50"
        }`}
        data-testid="ride-call-driver-btn"
        title={
          calleeNumber
            ? "Call without sharing your real number"
            : "Driver phone not on file"
        }
      >
        {callState === "placing" ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : callState === "ok" ? (
          <Check className="h-3.5 w-3.5" />
        ) : (
          <Phone className="h-3.5 w-3.5" />
        )}
        {callState === "placing"
          ? "Calling…"
          : callState === "ringing" || callState === "ok"
          ? "Ringing"
          : "Call driver"}
      </button>

      {/* SOS */}
      <button
        type="button"
        onClick={triggerSos}
        disabled={sosState === "sending"}
        className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
          sosState === "sent"
            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
            : "bg-rose-500/10 text-rose-300 border border-rose-500/50 hover:bg-rose-500/20 disabled:opacity-50"
        }`}
        data-testid="ride-sos-btn"
        title="Alert the safety team with your live location"
      >
        {sosState === "sending" ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : sosState === "sent" ? (
          <Check className="h-3.5 w-3.5" />
        ) : (
          <ShieldAlert className="h-3.5 w-3.5" />
        )}
        {sosState === "sending"
          ? "Sending…"
          : sosState === "sent"
          ? "SOS sent"
          : "SOS"}
      </button>

      {(callError || sosError) && (
        <div
          className="flex items-center gap-1 text-[10px] text-rose-300"
          data-testid="ride-safety-error"
        >
          <X className="h-3 w-3" />
          {callError || sosError}
        </div>
      )}
    </div>
  );
}
