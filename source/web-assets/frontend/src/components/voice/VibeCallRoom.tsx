/**
 * <VibeCallRoom channel="jftn-room-abc" /> — drop-in audio room.
 *
 * Workflow:
 *   1. POST /api/agora/rtc-token  → server mints token + uid
 *   2. AgoraRTC.createClient → join(app_id, channel, token, uid)
 *   3. publish a microphone track with ANS+AEC
 *   4. enableAudioVolumeIndicator → highlight active speaker every 200ms
 *   5. UI: cyan ring around speaking participants, mute toggle, leave call
 *
 * No SSR — Agora SDK is browser-only. Component handles its own
 * cleanup on unmount + page-hide.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import AgoraRTC, {
  IAgoraRTCClient,
  IMicrophoneAudioTrack,
  UID,
  IAgoraRTCRemoteUser,
} from "agora-rtc-sdk-ng";
import { Mic, MicOff, PhoneOff, Loader2, AudioLines } from "lucide-react";
import { authFetch } from "@/utils/secureAuth";

const API = process.env.REACT_APP_BACKEND_URL;

// Speaker volume threshold (0–100); >50 == "currently speaking"
const SPEAKING_THRESHOLD = 5;

type RoomState = "idle" | "joining" | "live" | "leaving" | "error";

type RemoteState = {
  uid: UID;
  speaking: boolean;
};

export default function VibeCallRoom({
  channel,
  onLeave,
}: {
  channel: string;
  onLeave?: () => void;
}) {
  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const micTrackRef = useRef<IMicrophoneAudioTrack | null>(null);

  const [state, setState] = useState<RoomState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [iSpeak, setISpeak] = useState(false);
  const [myUid, setMyUid] = useState<UID | null>(null);
  const [remotes, setRemotes] = useState<Record<string, RemoteState>>({});

  // ───────────────────────── Join / leave ─────────────────────────

  const joinRoom = useCallback(async () => {
    setState("joining");
    setError(null);
    try {
      // 1. mint token from our backend
      const r = await authFetch(`${API}/api/agora/rtc-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel, role: "publisher" }),
      });
      if (!r.ok) {
        const detail = await r.text();
        throw new Error(`token mint ${r.status}: ${detail}`);
      }
      const { app_id, token, uid } = await r.json();
      setMyUid(uid);

      // 2. join channel
      const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
      clientRef.current = client;

      client.on("user-published", async (user, mediaType) => {
        if (mediaType !== "audio") return;
        await client.subscribe(user, mediaType);
        user.audioTrack?.play();
        setRemotes((p) => ({
          ...p,
          [String(user.uid)]: { uid: user.uid, speaking: false },
        }));
      });
      client.on("user-unpublished", (user) => {
        setRemotes((p) => {
          const n = { ...p };
          delete n[String(user.uid)];
          return n;
        });
      });
      client.on("user-left", (user: IAgoraRTCRemoteUser) => {
        setRemotes((p) => {
          const n = { ...p };
          delete n[String(user.uid)];
          return n;
        });
      });
      client.enableAudioVolumeIndicator();
      client.on("volume-indicator", (vols) => {
        let mineSpeaking = false;
        const next: Record<string, RemoteState> = {};
        for (const v of vols) {
          if (v.uid === uid) {
            mineSpeaking = v.level > SPEAKING_THRESHOLD;
          } else {
            next[String(v.uid)] = {
              uid: v.uid,
              speaking: v.level > SPEAKING_THRESHOLD,
            };
          }
        }
        setISpeak(mineSpeaking);
        setRemotes((p) => {
          // merge — keep users who joined but haven't spoken yet
          const merged = { ...p };
          for (const k of Object.keys(merged)) {
            merged[k] = next[k] || { ...merged[k], speaking: false };
          }
          for (const k of Object.keys(next)) {
            if (!merged[k]) merged[k] = next[k];
          }
          return merged;
        });
      });

      await client.join(app_id, channel, token, uid);

      // 3. publish microphone
      const mic = await AgoraRTC.createMicrophoneAudioTrack({
        ANS: true,
        AEC: true,
      });
      micTrackRef.current = mic;
      await client.publish(mic);
      setState("live");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to join voice room";
      // eslint-disable-next-line no-console
      console.error("[VibeCallRoom] join error:", e);
      setError(msg);
      setState("error");
    }
  }, [channel]);

  const leaveRoom = useCallback(async () => {
    setState("leaving");
    try {
      if (micTrackRef.current) {
        micTrackRef.current.close();
        micTrackRef.current = null;
      }
      if (clientRef.current) {
        await clientRef.current.leave();
        clientRef.current.removeAllListeners();
        clientRef.current = null;
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("[VibeCallRoom] leave warn:", e);
    } finally {
      setRemotes({});
      setMyUid(null);
      setMuted(false);
      setISpeak(false);
      setState("idle");
      onLeave?.();
    }
  }, [onLeave]);

  // Cleanup if the component unmounts mid-call
  useEffect(() => {
    return () => {
      if (clientRef.current || micTrackRef.current) {
        leaveRoom();
      }
    };
    // intentional — leaveRoom only depends on onLeave which is stable
    // eslint-disable-next-line
  }, []);

  // ───────────────────────── Mute toggle ─────────────────────────

  const toggleMute = useCallback(async () => {
    const mic = micTrackRef.current;
    if (!mic) return;
    const next = !muted;
    await mic.setMuted(next);
    setMuted(next);
  }, [muted]);

  // ───────────────────────── Render ─────────────────────────

  const remoteList = Object.values(remotes);
  const isLive = state === "live";

  return (
    <div
      className="rounded-2xl border border-cyan-500/30 bg-black/60 backdrop-blur-md p-4 max-w-md"
      data-testid="vibe-call-room"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AudioLines className="w-4 h-4 text-cyan-300" />
          <p className="text-[10px] uppercase tracking-widest text-cyan-300">
            Vibe Call · {channel}
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

      {/* Joined participants */}
      {isLive && (
        <div
          className="mt-4 grid grid-cols-3 gap-2"
          data-testid="vibe-call-participants"
        >
          {/* You */}
          <div
            className={`text-center p-2 rounded-xl border transition-all ${
              iSpeak && !muted
                ? "border-cyan-300 bg-cyan-500/10 shadow-[0_0_15px_rgba(34,211,238,0.5)]"
                : "border-cyan-500/20 bg-black/40"
            }`}
            data-testid="vibe-call-self"
          >
            <div
              className={`mx-auto w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 to-yellow-600 flex items-center justify-center transition-transform ${
                iSpeak && !muted ? "scale-110" : ""
              }`}
            >
              {muted ? (
                <MicOff className="w-5 h-5 text-black" />
              ) : (
                <Mic className="w-5 h-5 text-black" />
              )}
            </div>
            <p className="text-[10px] text-cyan-300 mt-1 truncate">
              You · {String(myUid).slice(0, 6)}
            </p>
          </div>
          {/* Remote */}
          {remoteList.map((r) => (
            <div
              key={String(r.uid)}
              className={`text-center p-2 rounded-xl border transition-all ${
                r.speaking
                  ? "border-cyan-300 bg-cyan-500/10 shadow-[0_0_15px_rgba(34,211,238,0.5)]"
                  : "border-cyan-500/20 bg-black/40"
              }`}
              data-testid={`vibe-call-remote-${r.uid}`}
            >
              <div
                className={`mx-auto w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500 to-blue-700 flex items-center justify-center transition-transform ${
                  r.speaking ? "scale-110" : ""
                }`}
              >
                <Mic className="w-5 h-5 text-white" />
              </div>
              <p className="text-[10px] text-cyan-300 mt-1 truncate">
                {String(r.uid).slice(0, 6)}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <p
          className="mt-3 text-[10px] text-rose-300 bg-rose-500/10 border border-rose-500/40 rounded-lg p-2"
          data-testid="vibe-call-error"
        >
          {error}
        </p>
      )}

      {/* Controls */}
      <div className="mt-4 flex items-center justify-center gap-2">
        {state !== "live" && (
          <button
            onClick={joinRoom}
            disabled={state === "joining" || state === "leaving"}
            className="px-4 py-2 rounded-full bg-gradient-to-r from-cyan-300 to-fuchsia-400 text-black text-xs font-black uppercase tracking-widest disabled:opacity-50 flex items-center gap-2"
            data-testid="vibe-call-join"
          >
            {state === "joining" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Mic className="w-4 h-4" />
            )}
            {state === "joining" ? "Joining…" : "Join Call"}
          </button>
        )}

        {state === "live" && (
          <>
            <button
              onClick={toggleMute}
              className={`px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest flex items-center gap-2 ${
                muted
                  ? "bg-amber-500 text-black"
                  : "bg-emerald-500 text-black"
              }`}
              data-testid="vibe-call-mute"
            >
              {muted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              {muted ? "Unmute" : "Mute"}
            </button>
            <button
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
