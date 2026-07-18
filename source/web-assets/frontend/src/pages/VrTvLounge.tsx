/**
 * WebXR / Quest-friendly DSG TV lounge.
 *
 * Desktop: cinema-style HLS player + Agora date call dock.
 * Quest Browser: Enter VR → virtual theater frame (WebXR via createXRStore).
 *
 * Meta Ray-Ban glasses are not a full WebXR TV surface — use phone/Quest.
 */
import { Suspense, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Text } from "@react-three/drei";
import { XR, createXRStore, useXR } from "@react-three/xr";
import { ArrowLeft, Glasses, Tv } from "lucide-react";
import HLSPlayer from "@/components/streaming/HLSPlayer";
import CallButton from "@/components/voice/CallButton";
import { useGameTableCallVideo } from "@/components/video/GameTableCallVideo";
import GameVideoLayout from "@/components/video/GameVideoLayout";

const API = process.env.REACT_APP_BACKEND_URL;

// Module-level store so Enter VR button + Canvas share one session.
const xrStore = createXRStore();

function TheaterScreen({ hlsUrl }: { hlsUrl: string | null }) {
  const session = useXR((s) => s.session);
  const presenting = !!session;
  return (
    <group position={[0, 1.4, -3.2]}>
      <mesh>
        <planeGeometry args={[4.8, 2.7]} />
        <meshBasicMaterial color={hlsUrl ? "#0a0a0a" : "#111827"} />
      </mesh>
      <Text
        position={[0, 1.55, 0.02]}
        fontSize={0.12}
        color="#fbbf24"
        anchorX="center"
      >
        {presenting ? "DSG TV · VR Lounge" : "DSG TV · Preview"}
      </Text>
      <Text
        position={[0, 0, 0.02]}
        fontSize={0.09}
        color="#a3a3a3"
        maxWidth={4}
        anchorX="center"
        textAlign="center"
      >
        {hlsUrl
          ? "Live feed plays in the 2D player below — VR screen is your theater frame."
          : "Channel is off-air. Enter VR anyway to sit in the lounge with your date."}
      </Text>
    </group>
  );
}

export default function VrTvLounge() {
  const { channelId } = useParams<{ channelId: string }>();
  const navigate = useNavigate();
  const tableCallVideo = useGameTableCallVideo();
  const [hlsUrl, setHlsUrl] = useState<string | null>(null);
  const [channelName, setChannelName] = useState(channelId || "DSG TV");
  const [guestId, setGuestId] = useState("");
  const [xrSupported, setXrSupported] = useState(false);

  useEffect(() => {
    if (typeof navigator !== "undefined" && (navigator as Navigator & { xr?: { isSessionSupported?: (m: string) => Promise<boolean> } }).xr) {
      (navigator as Navigator & { xr: { isSessionSupported: (m: string) => Promise<boolean> } }).xr
        .isSessionSupported("immersive-vr")
        .then((ok) => setXrSupported(!!ok))
        .catch(() => setXrSupported(false));
    }
  }, []);

  useEffect(() => {
    if (!channelId) return;
    void (async () => {
      const [ch, np] = await Promise.all([
        fetch(`${API}/api/media-master/tv/channels`).then((r) => r.json()).catch(() => ({})),
        fetch(`${API}/api/media-master/tv/now-playing/${channelId}`).then((r) => r.json()).catch(() => null),
      ]);
      const found = (ch.channels || []).find((c: { channel_id: string; name?: string }) => c.channel_id === channelId);
      if (found?.name) setChannelName(found.name);
      setHlsUrl(np?.live_input?.hls_playback_url || null);
    })();
  }, [channelId]);

  const fallbackNote = useMemo(
    () =>
      xrSupported
        ? "Quest Browser detected WebXR — tap Enter VR."
        : "Open this page in Meta Quest Browser for Enter VR. On phone/desktop you still get the lounge player + date call.",
    [xrSupported],
  );

  return (
    <div className="min-h-screen bg-[#050508] text-white" data-testid="vr-tv-lounge">
      <div className="max-w-5xl mx-auto px-4 py-6">
        <button
          type="button"
          onClick={() => navigate(channelId ? `/dsg-tv/${channelId}` : "/media-master")}
          className="inline-flex items-center gap-1.5 text-xs text-white/60 hover:text-white"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to channel
        </button>

        <header className="mt-4 mb-6">
          <div className="flex items-center gap-2 text-fuchsia-300 text-xs uppercase tracking-widest">
            <Glasses className="w-4 h-4" /> WebXR TV Lounge
          </div>
          <h1 className="text-3xl font-light mt-2">{channelName}</h1>
          <p className="text-sm text-white/55 mt-2 max-w-xl">{fallbackNote}</p>
          <p className="text-[11px] text-white/40 mt-1">
            Tubi / Peacock / Netflix cannot stay inside our player (their rules). Hosted DSG TV + Agora date talk can.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              data-testid="vr-tv-enter-vr"
              onClick={() => {
                void xrStore.enterVR();
              }}
              className="text-xs px-3 py-2 rounded-full bg-fuchsia-500 text-black font-bold"
            >
              Enter VR
            </button>
            <Link
              to="/cinema-room"
              className="text-xs px-3 py-2 rounded-full border border-white/20 text-white/70"
            >
              Date cinema (stays in app)
            </Link>
          </div>
        </header>

        <GameVideoLayout video={tableCallVideo} testid="vr-tv-layout">
          <div className="rounded-2xl overflow-hidden border border-white/10 bg-black mb-4 h-[280px] sm:h-[360px]">
            <Canvas camera={{ position: [0, 1.5, 2.2], fov: 60 }}>
              <XR store={xrStore}>
                <color attach="background" args={["#050508"]} />
                <ambientLight intensity={0.6} />
                <Suspense fallback={null}>
                  <TheaterScreen hlsUrl={hlsUrl} />
                </Suspense>
                <OrbitControls enableZoom={false} />
              </XR>
            </Canvas>
          </div>

          {hlsUrl ? (
            <div className="rounded-2xl overflow-hidden border border-emerald-400/30 mb-4">
              <HLSPlayer src={hlsUrl} isLive autoPlay className="w-full" />
            </div>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-sm text-white/50 mb-4">
              <Tv className="w-6 h-6 mx-auto mb-2 text-white/40" />
              Off air — lounge is still open for voice/video with your date.
            </div>
          )}

          <div className="rounded-2xl border border-cyan-400/25 bg-cyan-500/5 p-4 flex flex-col sm:flex-row gap-3 sm:items-end">
            <div className="flex-1">
              <p className="text-[10px] uppercase tracking-widest text-cyan-300 font-bold">Date / friend call</p>
              <input
                value={guestId}
                onChange={(e) => setGuestId(e.target.value.trim())}
                placeholder="Their user id"
                className="mt-2 w-full rounded-lg bg-black/50 border border-white/15 px-3 py-2 text-sm"
                data-testid="vr-tv-guest-id"
              />
            </div>
            {guestId ? (
              <div className="flex gap-2">
                <CallButton userId={guestId} mediaType="voice" />
                <CallButton userId={guestId} mediaType="video" />
              </div>
            ) : null}
            <Link
              to="/streamer/studio"
              className="text-xs px-3 py-2 rounded-full border border-white/20 text-white/70"
            >
              Go stream instead
            </Link>
          </div>
        </GameVideoLayout>
      </div>
    </div>
  );
}
