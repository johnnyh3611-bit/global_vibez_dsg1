/**
 * RidePOVPiP — picture-in-picture driver-POV subscriber for embedding
 * in the rider's RideChat / SafeRideTracking page. Renders a tiny
 * draggable-style square in the corner that subscribes to the same
 * Agora channel the DriverDashcam publishes on.
 *
 * If the driver never goes live, this component renders nothing
 * (silent no-op) — passengers without a live POV just see chat as before.
 */
import { useEffect, useRef, useState } from "react";
import AgoraRTC, {
  IAgoraRTCClient,
  IAgoraRTCRemoteUser,
} from "agora-rtc-sdk-ng";
import { Tv, Maximize2 } from "lucide-react";
import { Link } from "react-router-dom";
import { authFetch } from "@/utils/secureAuth";

const API = process.env.REACT_APP_BACKEND_URL;

export default function RidePOVPiP({ rideId }: { rideId: string }) {
  const channel = rideId ? `ride_${rideId}` : "";
  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const playerRef = useRef<HTMLDivElement | null>(null);
  const [hasStream, setHasStream] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const join = async () => {
      if (!channel) return;
      try {
        const r = await authFetch(`${API}/api/agora/rtc-token`, {
          method: "POST",
          body: JSON.stringify({ channel, role: "subscriber" }),
        });
        if (!r.ok) return; // PiP is best-effort — silent no-op on failure
        const { app_id, token, uid } = await r.json();

        const client = AgoraRTC.createClient({ mode: "live", codec: "vp8" });
        clientRef.current = client;
        await client.setClientRole("audience");

        client.on("user-published", async (user: IAgoraRTCRemoteUser, mediaType) => {
          await client.subscribe(user, mediaType);
          if (mediaType === "video" && playerRef.current && !cancelled) {
            user.videoTrack?.play(playerRef.current);
            setHasStream(true);
          }
          // PiP intentionally MUTES audio — the rider already has the
          // driver in-car / via RideChat voice. Audio in PiP would echo.
        });
        client.on("user-unpublished", () => {
          if (!cancelled) setHasStream(false);
        });

        await client.join(app_id, channel, token, uid);
      } catch {
        /* swallow — PiP is non-critical */
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

  if (!hasStream) return null;

  return (
    <div
      className={`fixed bottom-6 right-6 z-40 overflow-hidden rounded-xl border border-cyan-500/40 bg-black shadow-[0_0_30px_rgba(14,165,233,0.4)] transition-all ${
        collapsed ? "h-10 w-32" : "h-44 w-64"
      }`}
      data-testid="ride-pov-pip"
    >
      <div className="absolute left-0 right-0 top-0 z-10 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent px-2 py-1 text-[10px] uppercase tracking-wider text-white">
        <span className="inline-flex items-center gap-1">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-400" />
          Driver POV
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            className="rounded p-0.5 hover:bg-white/10"
            title={collapsed ? "Expand" : "Collapse"}
            data-testid="ride-pov-pip-collapse-btn"
          >
            <Tv className="h-3 w-3" />
          </button>
          <Link
            to={`/live-pov/${rideId}`}
            className="rounded p-0.5 hover:bg-white/10"
            title="Open full viewer"
            data-testid="ride-pov-pip-fullscreen-link"
          >
            <Maximize2 className="h-3 w-3" />
          </Link>
        </div>
      </div>
      <div ref={playerRef} className="absolute inset-0" />
    </div>
  );
}
