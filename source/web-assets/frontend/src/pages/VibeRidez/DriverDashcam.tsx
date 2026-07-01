/**
 * Driver Dashcam — driver-side WebRTC publisher.
 *
 * Driver opens this page on their phone (landscape), taps "Go Live",
 * the page joins an Agora video channel `ride_<rideId>` as a publisher
 * with the rear camera. Riders who hold the same ride_id can subscribe
 * via the RideChat PiP (small) or the dedicated /live-pov/<rideId>
 * full-page route (cinema view).
 *
 * Stack notes:
 *   - Reuses /api/agora/rtc-token endpoint already wired for VibeCallRoom.
 *   - Channel name normalized to "ride_<rideId>" so subscribers always
 *     know where to look.
 *   - Default publishes BACK camera (`facingMode: "environment"`) for
 *     dashcam vibes; toggle button flips to selfie mode.
 *
 * The same Agora channel is reusable later by a native smart-glass app
 * (Ray-Bans, Vuzix) that publishes WebRTC video using the same uid scheme.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import AgoraRTC, {
  IAgoraRTCClient,
  ICameraVideoTrack,
  IMicrophoneAudioTrack,
} from "agora-rtc-sdk-ng";
import {
  Camera,
  CameraOff,
  ArrowLeft,
  Mic,
  MicOff,
  RotateCw,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { authFetch } from "@/utils/secureAuth";

const API = process.env.REACT_APP_BACKEND_URL;

type State = "idle" | "joining" | "live" | "leaving" | "error";

export default function DriverDashcam() {
  const { rideId } = useParams<{ rideId: string }>();
  const navigate = useNavigate();
  const channel = rideId ? `ride_${rideId}` : "";

  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const camTrackRef = useRef<ICameraVideoTrack | null>(null);
  const micTrackRef = useRef<IMicrophoneAudioTrack | null>(null);
  const localPlayerRef = useRef<HTMLDivElement | null>(null);

  const [state, setState] = useState<State>("idle");
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [facing, setFacing] = useState<"environment" | "user">("environment");

  const goLive = useCallback(async () => {
    if (!channel) {
      setError("Missing ride id");
      return;
    }
    setState("joining");
    setError(null);
    try {
      // 1. mint token
      const r = await authFetch(`${API}/api/agora/rtc-token`, {
        method: "POST",
        body: JSON.stringify({ channel, role: "publisher" }),
      });
      if (!r.ok) throw new Error(`token mint ${r.status}`);
      const { app_id, token, uid } = await r.json();

      // 2. join channel
      const client = AgoraRTC.createClient({ mode: "live", codec: "vp8" });
      clientRef.current = client;
      await client.setClientRole("host");
      await client.join(app_id, channel, token, uid);

      // 3. capture camera + mic. Rear camera by default for dashcam vibes.
      const cam = await AgoraRTC.createCameraVideoTrack({
        encoderConfig: "720p_2",
        facingMode: facing,
      } as any);
      const mic = await AgoraRTC.createMicrophoneAudioTrack({
        encoderConfig: "music_standard",
        AEC: true,
        ANS: true,
      });
      camTrackRef.current = cam;
      micTrackRef.current = mic;

      // 4. preview locally + publish
      if (localPlayerRef.current) cam.play(localPlayerRef.current);
      await client.publish([cam, mic]);

      setState("live");
    } catch (e: any) {
      setError(e?.message || "Failed to go live");
      setState("error");
    }
  }, [channel, facing]);

  const stopLive = useCallback(async () => {
    setState("leaving");
    try {
      camTrackRef.current?.stop();
      camTrackRef.current?.close();
      micTrackRef.current?.stop();
      micTrackRef.current?.close();
      camTrackRef.current = null;
      micTrackRef.current = null;
      if (clientRef.current) {
        await clientRef.current.leave();
        clientRef.current = null;
      }
    } catch {
      /* swallow — best-effort cleanup */
    }
    setState("idle");
  }, []);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      stopLive();
    };
  }, [stopLive]);

  const toggleMute = () => {
    if (!micTrackRef.current) return;
    const next = !muted;
    micTrackRef.current.setEnabled(!next);
    setMuted(next);
  };

  const toggleCam = () => {
    if (!camTrackRef.current) return;
    const next = !camOff;
    camTrackRef.current.setEnabled(!next);
    setCamOff(next);
  };

  const flipCam = async () => {
    // Switch facingMode by recreating the camera track. Agora SDK
    // doesn't have a clean swap-facing-mode API, so we rebuild.
    if (state !== "live" || !camTrackRef.current || !clientRef.current) {
      setFacing((f) => (f === "environment" ? "user" : "environment"));
      return;
    }
    try {
      await clientRef.current.unpublish(camTrackRef.current);
      camTrackRef.current.stop();
      camTrackRef.current.close();
      const nextFacing = facing === "environment" ? "user" : "environment";
      const cam = await AgoraRTC.createCameraVideoTrack({
        encoderConfig: "720p_2",
        facingMode: nextFacing,
      } as any);
      camTrackRef.current = cam;
      if (localPlayerRef.current) cam.play(localPlayerRef.current);
      await clientRef.current.publish(cam);
      setFacing(nextFacing);
    } catch (e: any) {
      setError(e?.message || "Camera flip failed");
    }
  };

  return (
    <div
      className="min-h-screen bg-black text-white"
      data-testid="driver-dashcam-page"
    >
      <div className="flex items-center justify-between border-b border-white/10 bg-slate-950/80 px-4 py-3">
        <button
          type="button"
          onClick={async () => {
            await stopLive();
            navigate(-1);
          }}
          className="inline-flex items-center gap-2 text-sm text-slate-300 hover:text-white"
          data-testid="dashcam-back-btn"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <div className="flex items-center gap-2 text-xs">
          {state === "live" && (
            <span
              className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/20 px-2 py-1 font-semibold text-rose-300"
              data-testid="dashcam-live-indicator"
            >
              <span className="h-2 w-2 animate-pulse rounded-full bg-rose-400" />
              LIVE · {channel}
            </span>
          )}
          <Link
            to={`/live-pov/${rideId}`}
            className="rounded-full border border-cyan-500/40 px-2 py-1 text-cyan-300 hover:bg-cyan-500/10"
            data-testid="dashcam-viewer-link"
          >
            Open viewer
          </Link>
        </div>
      </div>

      {/* Video preview */}
      <div className="relative h-[calc(100vh-56px)] w-full bg-slate-950">
        <div
          ref={localPlayerRef}
          className="absolute inset-0"
          data-testid="dashcam-local-preview"
        />
        {state === "idle" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-slate-950/85 p-6 text-center">
            <Camera className="h-10 w-10 text-cyan-300" />
            <h2 className="text-2xl font-bold">Driver POV — Go Live</h2>
            <p className="max-w-sm text-sm text-slate-300">
              Stream your dashcam view to the rider in this ride. Audio + 720p
              video, channel <span className="font-mono text-cyan-200">{channel || "—"}</span>.
            </p>
            <button
              type="button"
              onClick={goLive}
              disabled={!channel}
              className="rounded-full bg-rose-600 px-6 py-3 text-sm font-bold uppercase tracking-wider hover:bg-rose-500 disabled:opacity-50"
              data-testid="dashcam-go-live-btn"
            >
              Go Live
            </button>
          </div>
        )}
        {state === "joining" && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80">
            <Loader2 className="h-8 w-8 animate-spin text-cyan-300" />
          </div>
        )}
        {state === "error" && error && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/90 p-6 text-center"
            data-testid="dashcam-error-state"
          >
            <AlertTriangle className="h-10 w-10 text-rose-400" />
            <p className="text-sm text-rose-200">{error}</p>
            <button
              type="button"
              onClick={() => setState("idle")}
              className="rounded-full border border-white/20 px-4 py-2 text-sm hover:bg-white/10"
            >
              Try again
            </button>
          </div>
        )}

        {/* Controls */}
        {state === "live" && (
          <div
            className="absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-full border border-white/20 bg-slate-950/90 px-3 py-2 backdrop-blur"
            data-testid="dashcam-controls"
          >
            <CtrlBtn
              onClick={toggleMute}
              active={!muted}
              label={muted ? "Unmute" : "Mute"}
              icon={muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              testid="dashcam-mute-btn"
            />
            <CtrlBtn
              onClick={toggleCam}
              active={!camOff}
              label={camOff ? "Camera on" : "Camera off"}
              icon={
                camOff ? <CameraOff className="h-4 w-4" /> : <Camera className="h-4 w-4" />
              }
              testid="dashcam-cam-toggle-btn"
            />
            <CtrlBtn
              onClick={flipCam}
              active
              label="Flip"
              icon={<RotateCw className="h-4 w-4" />}
              testid="dashcam-flip-btn"
            />
            <button
              type="button"
              onClick={stopLive}
              className="rounded-full bg-rose-600 px-4 py-2 text-xs font-bold uppercase tracking-wider hover:bg-rose-500"
              data-testid="dashcam-end-btn"
            >
              End
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function CtrlBtn({
  onClick,
  active,
  label,
  icon,
  testid,
}: {
  onClick: () => void;
  active: boolean;
  label: string;
  icon: React.ReactNode;
  testid: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={`flex h-10 w-10 items-center justify-center rounded-full transition ${
        active
          ? "bg-white/10 text-white hover:bg-white/20"
          : "bg-rose-500/30 text-rose-200 hover:bg-rose-500/50"
      }`}
      data-testid={testid}
    >
      {icon}
    </button>
  );
}
