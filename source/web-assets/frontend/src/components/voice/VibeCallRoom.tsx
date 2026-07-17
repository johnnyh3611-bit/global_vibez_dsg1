/**
 * <VibeCallRoom channel="…" enableVideo /> — Agora voice or FaceTime-style video.
 *
 * Workflow:
 *   1. POST /api/agora/rtc-token
 *   2. join channel, publish mic (+ camera when enableVideo)
 *   3. subscribe remote audio (+ video tiles)
 *
 * When Agora is not configured, shows a clear setup message instead of a cryptic error.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import AgoraRTC, {
  IAgoraRTCClient,
  IMicrophoneAudioTrack,
  ICameraVideoTrack,
  UID,
  IAgoraRTCRemoteUser,
} from "agora-rtc-sdk-ng";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  Loader2,
  AudioLines,
} from "lucide-react";
import { authFetch } from "@/utils/secureAuth";

const API = process.env.REACT_APP_BACKEND_URL;
const SPEAKING_THRESHOLD = 5;

type RoomState = "idle" | "joining" | "live" | "leaving" | "error";

type RemoteState = {
  uid: UID;
  speaking: boolean;
  hasVideo: boolean;
};

export default function VibeCallRoom({
  channel,
  onLeave,
  enableVideo = false,
  autoJoin = false,
}: {
  channel: string;
  onLeave?: () => void;
  /** FaceTime-style: publish/subscribe camera tracks */
  enableVideo?: boolean;
  /** Skip the Join button (used when call already accepted) */
  autoJoin?: boolean;
}) {
  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const micTrackRef = useRef<IMicrophoneAudioTrack | null>(null);
  const camTrackRef = useRef<ICameraVideoTrack | null>(null);
  const localVideoRef = useRef<HTMLDivElement | null>(null);
  const remoteVideoRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const [state, setState] = useState<RoomState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [hasCam, setHasCam] = useState(false);
  const [iSpeak, setISpeak] = useState(false);
  const [myUid, setMyUid] = useState<UID | null>(null);
  const [remotes, setRemotes] = useState<Record<string, RemoteState>>({});

  const leaveRoom = useCallback(async () => {
    setState("leaving");
    try {
      if (micTrackRef.current) {
        micTrackRef.current.close();
        micTrackRef.current = null;
      }
      if (camTrackRef.current) {
        camTrackRef.current.close();
        camTrackRef.current = null;
      }
      if (clientRef.current) {
        await clientRef.current.leave();
        clientRef.current.removeAllListeners();
        clientRef.current = null;
      }
    } catch {
      /* ignore */
    } finally {
      setRemotes({});
      setMyUid(null);
      setMuted(false);
      setCamOff(false);
      setHasCam(false);
      setISpeak(false);
      setState("idle");
      onLeave?.();
    }
  }, [onLeave]);

  const joinRoom = useCallback(async () => {
    setState("joining");
    setError(null);
    try {
      const r = await authFetch(`${API}/api/agora/rtc-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel, role: "publisher" }),
      });
      if (!r.ok) {
        const detail = await r.text();
        if (r.status === 503 || /not configured/i.test(detail)) {
          throw new Error(
            "Video/voice calling needs Agora credentials (AGORA_APP_ID + AGORA_APP_CERTIFICATE) on the backend. Signaling works — media is waiting on that setup."
          );
        }
        throw new Error(`Could not start call (${r.status})`);
      }
      const { app_id, token, uid } = await r.json();
      setMyUid(uid);

      const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
      clientRef.current = client;

      client.on("user-published", async (user, mediaType) => {
        await client.subscribe(user, mediaType);
        if (mediaType === "audio") {
          user.audioTrack?.play();
          setRemotes((p) => ({
            ...p,
            [String(user.uid)]: {
              uid: user.uid,
              speaking: p[String(user.uid)]?.speaking || false,
              hasVideo: p[String(user.uid)]?.hasVideo || false,
            },
          }));
        }
        if (mediaType === "video") {
          setRemotes((p) => ({
            ...p,
            [String(user.uid)]: {
              uid: user.uid,
              speaking: p[String(user.uid)]?.speaking || false,
              hasVideo: true,
            },
          }));
          // play into tile once ref exists
          requestAnimationFrame(() => {
            const el = remoteVideoRefs.current[String(user.uid)];
            if (el && user.videoTrack) {
              user.videoTrack.play(el);
            }
          });
        }
      });

      const dropUser = (user: IAgoraRTCRemoteUser) => {
        setRemotes((p) => {
          const n = { ...p };
          delete n[String(user.uid)];
          return n;
        });
      };
      client.on("user-unpublished", (user, mediaType) => {
        if (mediaType === "video") {
          setRemotes((p) => {
            const cur = p[String(user.uid)];
            if (!cur) return p;
            return { ...p, [String(user.uid)]: { ...cur, hasVideo: false } };
          });
        }
      });
      client.on("user-left", dropUser);

      client.enableAudioVolumeIndicator();
      client.on("volume-indicator", (vols) => {
        let mineSpeaking = false;
        const levels: Record<string, boolean> = {};
        for (const v of vols) {
          if (v.uid === uid) mineSpeaking = v.level > SPEAKING_THRESHOLD;
          else levels[String(v.uid)] = v.level > SPEAKING_THRESHOLD;
        }
        setISpeak(mineSpeaking);
        setRemotes((p) => {
          const merged = { ...p };
          for (const k of Object.keys(merged)) {
            merged[k] = { ...merged[k], speaking: !!levels[k] };
          }
          return merged;
        });
      });

      await client.join(app_id, channel, token, uid);

      const mic = await AgoraRTC.createMicrophoneAudioTrack({
        ANS: true,
        AEC: true,
      });
      micTrackRef.current = mic;

      if (enableVideo) {
        try {
          const cam = await AgoraRTC.createCameraVideoTrack({
            encoderConfig: "720p_1",
          });
          camTrackRef.current = cam;
          setHasCam(true);
          await client.publish([mic, cam]);
          requestAnimationFrame(() => {
            if (localVideoRef.current) cam.play(localVideoRef.current);
          });
        } catch (camErr) {
          // Mic still works if camera permission denied
          await client.publish(mic);
          setError(
            camErr instanceof Error
              ? `Camera unavailable — voice only. ${camErr.message}`
              : "Camera unavailable — voice only."
          );
        }
      } else {
        await client.publish(mic);
      }

      setState("live");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to join call";
      setError(msg);
      setState("error");
    }
  }, [channel, enableVideo]);

  useEffect(() => {
    return () => {
      if (clientRef.current || micTrackRef.current || camTrackRef.current) {
        leaveRoom();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (autoJoin && state === "idle") {
      joinRoom();
    }
  }, [autoJoin, state, joinRoom]);

  // Re-attach remote videos when remotes change
  useEffect(() => {
    const client = clientRef.current;
    if (!client || !enableVideo) return;
    for (const user of client.remoteUsers) {
      const el = remoteVideoRefs.current[String(user.uid)];
      if (el && user.videoTrack) user.videoTrack.play(el);
    }
  }, [remotes, enableVideo]);

  const toggleMute = useCallback(async () => {
    const mic = micTrackRef.current;
    if (!mic) return;
    const next = !muted;
    await mic.setMuted(next);
    setMuted(next);
  }, [muted]);

  const toggleCam = useCallback(async () => {
    const cam = camTrackRef.current;
    if (!cam) return;
    const next = !camOff;
    await cam.setEnabled(!next);
    setCamOff(next);
  }, [camOff]);

  const remoteList = Object.values(remotes);
  const isLive = state === "live";

  return (
    <div
      className={`rounded-2xl border border-cyan-500/30 bg-black/80 backdrop-blur-md p-4 ${
        enableVideo ? "max-w-lg w-full" : "max-w-md"
      }`}
      data-testid="vibe-call-room"
      data-video={enableVideo ? "true" : "false"}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {enableVideo ? (
            <Video className="w-4 h-4 text-fuchsia-300" />
          ) : (
            <AudioLines className="w-4 h-4 text-cyan-300" />
          )}
          <p className="text-[10px] uppercase tracking-widest text-cyan-300">
            {enableVideo ? "FaceTime · " : "Vibe Call · "}
            {channel.slice(0, 18)}
          </p>
        </div>
        <span
          className={`text-[10px] uppercase tracking-widest ${
            isLive ? "text-emerald-300" : "text-cyan-500"
          }`}
          data-testid="vibe-call-state"
        >
          {state}
        </span>
      </div>

      {enableVideo && isLive && (
        <div className="mt-3 relative aspect-video rounded-xl overflow-hidden bg-black border border-white/10">
          {/* Remote primary */}
          {remoteList.length > 0 ? (
            <div
              ref={(el) => {
                remoteVideoRefs.current[String(remoteList[0].uid)] = el;
              }}
              className="absolute inset-0 bg-slate-900"
              data-testid="vibe-call-remote-video"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-white/40 text-sm">
              Waiting for the other person…
            </div>
          )}
          {/* Local PiP */}
          <div
            ref={localVideoRef}
            className="absolute bottom-2 right-2 w-28 h-40 rounded-lg overflow-hidden border-2 border-white/30 bg-black shadow-lg"
            data-testid="vibe-call-local-video"
          />
        </div>
      )}

      {!enableVideo && isLive && (
        <div className="mt-4 grid grid-cols-3 gap-2" data-testid="vibe-call-participants">
          <div
            className={`text-center p-2 rounded-xl border transition-all ${
              iSpeak && !muted
                ? "border-cyan-300 bg-cyan-500/10"
                : "border-cyan-500/20 bg-black/40"
            }`}
          >
            <div className="mx-auto w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 to-yellow-600 flex items-center justify-center">
              {muted ? <MicOff className="w-5 h-5 text-black" /> : <Mic className="w-5 h-5 text-black" />}
            </div>
            <p className="text-[10px] text-cyan-300 mt-1">You</p>
          </div>
          {remoteList.map((r) => (
            <div
              key={String(r.uid)}
              className={`text-center p-2 rounded-xl border ${
                r.speaking ? "border-cyan-300 bg-cyan-500/10" : "border-cyan-500/20 bg-black/40"
              }`}
            >
              <div className="mx-auto w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500 to-blue-700 flex items-center justify-center">
                <Mic className="w-5 h-5 text-white" />
              </div>
              <p className="text-[10px] text-cyan-300 mt-1">{String(r.uid).slice(0, 6)}</p>
            </div>
          ))}
        </div>
      )}

      {error && (
        <p
          className="mt-3 text-[11px] text-rose-200 bg-rose-500/10 border border-rose-500/40 rounded-lg p-2 leading-relaxed"
          data-testid="vibe-call-error"
        >
          {error}
        </p>
      )}

      <div className="mt-4 flex items-center justify-center gap-2 flex-wrap">
        {state !== "live" && state !== "joining" && (
          <button
            type="button"
            onClick={joinRoom}
            disabled={state === "leaving"}
            className="px-4 py-2 rounded-full bg-gradient-to-r from-cyan-300 to-fuchsia-400 text-black text-xs font-black uppercase tracking-widest disabled:opacity-50 flex items-center gap-2"
            data-testid="vibe-call-join"
          >
            {enableVideo ? <Video className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            {enableVideo ? "Start video" : "Join call"}
          </button>
        )}
        {state === "joining" && (
          <span className="flex items-center gap-2 text-xs text-cyan-300">
            <Loader2 className="w-4 h-4 animate-spin" /> Connecting…
          </span>
        )}
        {state === "live" && (
          <>
            <button
              type="button"
              onClick={toggleMute}
              className={`px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest flex items-center gap-2 ${
                muted ? "bg-amber-500 text-black" : "bg-emerald-500 text-black"
              }`}
              data-testid="vibe-call-mute"
            >
              {muted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              {muted ? "Unmute" : "Mute"}
            </button>
            {enableVideo && hasCam && (
              <button
                type="button"
                onClick={toggleCam}
                className={`px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest flex items-center gap-2 ${
                  camOff ? "bg-amber-500 text-black" : "bg-fuchsia-500 text-white"
                }`}
                data-testid="vibe-call-cam"
              >
                {camOff ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
                {camOff ? "Cam on" : "Cam off"}
              </button>
            )}
            <button
              type="button"
              onClick={leaveRoom}
              className="px-4 py-2 rounded-full bg-rose-500 text-white text-xs font-black uppercase tracking-widest flex items-center gap-2"
              data-testid="vibe-call-leave"
            >
              <PhoneOff className="w-4 h-4" /> Leave
            </button>
          </>
        )}
      </div>
    </div>
  );
}
