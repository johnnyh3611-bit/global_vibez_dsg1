/**
 * HLSPlayer — universal HLS playback for Cloudflare Stream live inputs
 * + recordings. Uses native `<video>` HLS on Safari/iOS and falls back
 * to hls.js everywhere else.
 *
 * Designed to be drop-in: pass an `.m3u8` URL and it just plays. Hooks
 * for autoplay, mute, and live-edge resync are exposed for hosts.
 */
import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { motion } from "framer-motion";
import { Radio, Volume2, VolumeX, Maximize2, Loader2, AlertTriangle } from "lucide-react";

export interface HLSPlayerProps {
  src: string | null;
  /** Show the red LIVE pill + low-latency mode (default true). */
  isLive?: boolean;
  /** Try to autoplay muted (browser policy permits this). */
  autoPlay?: boolean;
  /** Optional poster image (Cloudflare provides a thumbnail URL). */
  poster?: string;
  /** Optional className applied to the outer wrapper. */
  className?: string;
  /** Fires when the stream comes online (manifest first parses). */
  onLive?: () => void;
  /** Fires when playback stalls past `stallThresholdMs`. */
  onStall?: () => void;
  stallThresholdMs?: number;
}

export default function HLSPlayer({
  src,
  isLive = true,
  autoPlay = true,
  poster,
  className,
  onLive,
  onStall,
  stallThresholdMs = 8000,
}: HLSPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [muted, setMuted] = useState<boolean>(autoPlay);
  const [loading, setLoading] = useState<boolean>(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;
    setErr(null);
    setLoading(true);

    let hls: Hls | null = null;
    let stallTimer: number | null = null;

    const armStallTimer = () => {
      if (stallTimer) window.clearTimeout(stallTimer);
      stallTimer = window.setTimeout(() => {
        onStall?.();
      }, stallThresholdMs);
    };

    if (Hls.isSupported()) {
      hls = new Hls({
        // Cloudflare delivers ~3-5s glass-to-glass latency in low-latency mode.
        enableWorker: true,
        lowLatencyMode: isLive,
        backBufferLength: isLive ? 15 : 60,
      });
      hlsRef.current = hls;
      hls.loadSource(src);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setLoading(false);
        onLive?.();
        if (autoPlay) {
          video.muted = true;
          video.play().catch(() => {
            /* autoplay blocked — user must tap */
          });
        }
      });

      hls.on(Hls.Events.ERROR, (_evt, data) => {
        if (data.fatal) {
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            // Live streams may bounce when the broadcaster cuts/resumes;
            // best-effort recover before showing an error.
            hls?.startLoad();
          } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            hls?.recoverMediaError();
          } else {
            setErr("Stream offline");
            setLoading(false);
          }
        }
      });
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      // Safari / iOS — native HLS.
      video.src = src;
      video.addEventListener(
        "loadedmetadata",
        () => {
          setLoading(false);
          onLive?.();
        },
        { once: true },
      );
      if (autoPlay) {
        video.muted = true;
        video.play().catch(() => {});
      }
    } else {
      setErr("Your browser cannot play HLS streams.");
      setLoading(false);
    }

    const onWaiting = () => armStallTimer();
    const onPlaying = () => stallTimer && window.clearTimeout(stallTimer);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("playing", onPlaying);

    return () => {
      if (stallTimer) window.clearTimeout(stallTimer);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("playing", onPlaying);
      hls?.destroy();
      hlsRef.current = null;
    };
  }, [src, isLive, autoPlay, onLive, onStall, stallThresholdMs]);

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  };

  const requestFullscreen = () => {
    const v = videoRef.current;
    if (!v) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      v.requestFullscreen().catch(() => {});
    }
  };

  if (!src) {
    return (
      <div
        className={`relative aspect-video bg-black/80 flex items-center justify-center text-fuchsia-300/60 text-sm ${className || ""}`}
        data-testid="hls-player-empty"
      >
        No live source yet — paste your RTMP key into OBS to go live.
      </div>
    );
  }

  return (
    <div
      className={`relative aspect-video bg-black rounded-xl overflow-hidden border border-fuchsia-500/30 shadow-[0_0_30px_rgba(217,70,239,0.25)] ${className || ""}`}
      data-testid="hls-player"
    >
      <video
        ref={videoRef}
        poster={poster}
        playsInline
        muted={muted}
        className="w-full h-full object-cover bg-black"
      />

      {/* LIVE pill */}
      {isLive && !err && (
        <div className="absolute top-3 left-3 flex items-center gap-1 px-2 py-1 rounded-full bg-red-600 text-white text-[10px] font-black uppercase tracking-widest">
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> Live
        </div>
      )}

      {/* Loading */}
      {loading && !err && (
        <div className="absolute inset-0 flex items-center justify-center text-fuchsia-200/80 bg-black/30">
          <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.5, repeat: Infinity }} className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-xs uppercase tracking-widest">Connecting…</span>
          </motion.div>
        </div>
      )}

      {/* Error */}
      {err && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-red-200 gap-2">
          <AlertTriangle className="w-6 h-6" />
          <p className="text-xs uppercase tracking-widest">{err}</p>
        </div>
      )}

      {/* Controls */}
      <div className="absolute bottom-3 right-3 flex items-center gap-2">
        <button
          type="button"
          onClick={toggleMute}
          aria-label={muted ? "Unmute" : "Mute"}
          className="w-9 h-9 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur text-white flex items-center justify-center"
          data-testid="hls-player-mute"
        >
          {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>
        <button
          type="button"
          onClick={requestFullscreen}
          aria-label="Fullscreen"
          className="w-9 h-9 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur text-white flex items-center justify-center"
          data-testid="hls-player-fullscreen"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>

      {/* Idle / signal-lost indicator on the bottom-left */}
      <div className="absolute bottom-3 left-3 flex items-center gap-1 text-[10px] uppercase tracking-widest text-fuchsia-200/70">
        <Radio className="w-3 h-3" /> Cloudflare Stream
      </div>
    </div>
  );
}
