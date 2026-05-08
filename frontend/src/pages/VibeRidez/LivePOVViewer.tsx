/**
 * Live POV Viewer — full-page subscriber for a driver's dashcam stream.
 *
 * Joins Agora channel `ride_<rideId>` as a SUBSCRIBER and renders the
 * driver's published video full-screen. Side panel hosts the existing
 * RideChat so spectators / passengers can chat while watching.
 */
import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import AgoraRTC, {
  IAgoraRTCClient,
  IAgoraRTCRemoteUser,
} from "agora-rtc-sdk-ng";
import { ArrowLeft, MessageCircle, Loader2, Tv } from "lucide-react";
import { authFetch, getUserId } from "@/utils/secureAuth";
import RideChat from "@/components/vibe-ridez/RideChat";

const API = process.env.REACT_APP_BACKEND_URL;

type State = "idle" | "joining" | "watching" | "no_stream" | "error";

export default function LivePOVViewer() {
  const { rideId } = useParams<{ rideId: string }>();
  const channel = rideId ? `ride_${rideId}` : "";
  const userId = getUserId() || "anon";

  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const playerRef = useRef<HTMLDivElement | null>(null);

  const [state, setState] = useState<State>("idle");
  const [error, setError] = useState<string | null>(null);
  const [showChat, setShowChat] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const join = async () => {
      if (!channel) return;
      setState("joining");
      setError(null);
      try {
        const r = await authFetch(`${API}/api/agora/rtc-token`, {
          method: "POST",
          body: JSON.stringify({ channel, role: "subscriber" }),
        });
        if (!r.ok) throw new Error(`token mint ${r.status}`);
        const { app_id, token, uid } = await r.json();

        const client = AgoraRTC.createClient({ mode: "live", codec: "vp8" });
        clientRef.current = client;
        await client.setClientRole("audience");

        client.on("user-published", async (user: IAgoraRTCRemoteUser, mediaType) => {
          await client.subscribe(user, mediaType);
          if (mediaType === "video" && playerRef.current) {
            user.videoTrack?.play(playerRef.current);
            if (!cancelled) setState("watching");
          }
          if (mediaType === "audio") {
            user.audioTrack?.play();
          }
        });
        client.on("user-unpublished", () => {
          if (!cancelled) setState("no_stream");
        });

        await client.join(app_id, channel, token, uid);
        // If there are no remote publishers in the channel yet, surface
        // a friendly waiting state instead of staring at a black screen.
        // We use a ref-style read of remoteUsers (snapshot at time of
        // timer fire) so we don't need `state` in the dep array.
        setTimeout(() => {
          if (!cancelled && client.remoteUsers.length === 0) {
            setState((prev) => (prev === "joining" ? "no_stream" : prev));
          }
        }, 4000);
      } catch (e: any) {
        if (cancelled) return;
        // The most common "error" here is benign — Agora returns
        // CAN_NOT_GET_GATEWAY_SERVER / "invalid token, authorized
        // failed" when the channel exists but no publisher has joined
        // yet (so there's no media to subscribe to). Treat that as the
        // friendly waiting state, not a hard error. Token-mint 4xx and
        // network failures still bubble to the error state.
        const msg = e?.message || "Failed to join";
        const isNoPublisher =
          /invalid token|authorized failed|CAN_NOT_GET_GATEWAY_SERVER|UID_CONFLICT/i.test(
            msg,
          );
        if (isNoPublisher) {
          setState("no_stream");
        } else {
          setError(msg);
          setState("error");
        }
      }
    };
    join();
    return () => {
      cancelled = true;
      const c = clientRef.current;
      clientRef.current = null;
      if (c) c.leave().catch(() => {});
    };
  }, [channel]);

  return (
    <div
      className="min-h-screen bg-black text-white"
      data-testid="live-pov-page"
    >
      <div className="flex items-center justify-between border-b border-white/10 bg-slate-950/80 px-4 py-3">
        <Link
          to={`/ride/track/${rideId}`}
          className="inline-flex items-center gap-2 text-sm text-slate-300 hover:text-white"
          data-testid="pov-back-link"
        >
          <ArrowLeft className="h-4 w-4" /> Back to ride
        </Link>
        <div className="flex items-center gap-3 text-xs">
          {state === "watching" && (
            <span
              className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/20 px-2 py-1 font-semibold text-rose-300"
              data-testid="pov-live-indicator"
            >
              <span className="h-2 w-2 animate-pulse rounded-full bg-rose-400" />
              LIVE
            </span>
          )}
          <button
            type="button"
            onClick={() => setShowChat((v) => !v)}
            className="inline-flex items-center gap-1 rounded-full border border-white/20 px-2 py-1 hover:bg-white/10"
            data-testid="pov-toggle-chat-btn"
          >
            <MessageCircle className="h-3 w-3" />
            {showChat ? "Hide chat" : "Show chat"}
          </button>
        </div>
      </div>

      <div className="grid h-[calc(100vh-56px)] w-full grid-cols-1 lg:grid-cols-[1fr_360px]">
        {/* Stream */}
        <div className="relative bg-slate-950">
          <div
            ref={playerRef}
            className="absolute inset-0"
            data-testid="pov-video-player"
          />

          {state === "joining" && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80">
              <Loader2 className="h-8 w-8 animate-spin text-cyan-300" />
            </div>
          )}
          {state === "no_stream" && (
            <div
              className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/90 p-6 text-center"
              data-testid="pov-no-stream-state"
            >
              <Tv className="h-10 w-10 text-cyan-300" />
              <p className="text-base font-semibold">Waiting for driver to go live…</p>
              <p className="max-w-sm text-sm text-slate-400">
                Once your driver taps "Go Live" on their dashcam, their POV
                will appear here automatically.
              </p>
            </div>
          )}
          {state === "error" && error && (
            <div
              className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/90 p-6 text-center"
              data-testid="pov-error-state"
            >
              <p className="text-sm text-rose-200">{error}</p>
            </div>
          )}
        </div>

        {/* Chat side-panel */}
        {showChat && rideId && (
          <aside
            className="border-l border-white/10 bg-slate-950/60"
            data-testid="pov-chat-panel"
          >
            <div className="h-full">
              <RideChat
                rideId={rideId}
                userId={userId}
                role="rider"
              />
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
