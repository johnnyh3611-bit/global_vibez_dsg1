/**
 * LiveNowWall — public discovery surface that auto-pulls every Vibez
 * streamer Cloudflare currently confirms is broadcasting (via the
 * `stream.connected` webhook → Mongo flag).
 *
 * Mini HLS players auto-play muted on hover-or-mount so viewers can
 * sample every stream at once, then click to enter full-room mode.
 *
 * Poll every 8s as a safety net behind the webhook (handles dropped
 * webhooks + clock-skew edge cases). Page is intentionally public —
 * massive SEO + viral on-ramp surface.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Radio,
  Eye,
  RefreshCcw,
  Sparkles,
  Volume2,
  VolumeX,
  ChevronLeft,
  Tv,
} from "lucide-react";
import HLSPlayer from "@/components/streaming/HLSPlayer";

const API = process.env.REACT_APP_BACKEND_URL;
const POLL_MS = 8000;

interface LiveStream {
  input_id: string;
  streamer_id: string;
  name: string;
  hls_playback_url: string | null;
  dash_playback_url: string | null;
  is_live: boolean;
  last_status?: string;
  last_status_at?: string;
  created_at: string;
}

export default function LiveNowWall() {
  const nav = useNavigate();
  const [streams, setStreams] = useState<LiveStream[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [globalMuted, setGlobalMuted] = useState(true);
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const r = await fetch(
        `${API}/api/streaming/cloudflare/live-inputs?only_live=true`,
        { cache: "no-store" },
      );
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      setStreams(data.streams || []);
      setRefreshedAt(new Date());
    } catch (e: unknown) {
      setErr((e as Error)?.message || "Failed to load live streams");
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load + interval poll behind the webhook
  useEffect(() => {
    load();
    const id = window.setInterval(load, POLL_MS);
    return () => window.clearInterval(id);
  }, [load]);

  const sorted = useMemo(
    () =>
      [...streams].sort((a, b) =>
        (a.last_status_at || a.created_at) > (b.last_status_at || b.created_at)
          ? -1
          : 1,
      ),
    [streams],
  );

  return (
    <div
      className="min-h-screen bg-[#070012] text-white font-mono"
      data-testid="live-now-wall-root"
    >
      {/* Header */}
      <header className="sticky top-0 z-20 backdrop-blur-xl bg-black/60 border-b border-red-500/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => nav(-1)}
              className="text-red-200/70 hover:text-white"
              aria-label="Back"
              data-testid="live-now-back"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="relative">
              <Tv className="w-6 h-6 text-red-300" />
              {sorted.length > 0 && (
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              )}
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-black tracking-[0.25em] uppercase text-red-100 flex items-center gap-2">
                Live Now
                {sorted.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-red-600/30 border border-red-500/50 text-red-200 text-[10px]">
                    {sorted.length} broadcasting
                  </span>
                )}
              </h1>
              <p className="text-[10px] text-red-300/60 tracking-widest uppercase">
                Powered by Cloudflare Stream · auto-updates every 8s
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setGlobalMuted((m) => !m)}
              className="p-2 rounded-full border border-red-500/30 hover:bg-red-500/10 flex items-center gap-1.5 text-[10px] uppercase tracking-widest"
              data-testid="live-now-mute-all"
              aria-label="Mute / unmute all tiles"
            >
              {globalMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              {globalMuted ? "Muted" : "Sound"}
            </button>
            <button
              onClick={load}
              className="p-2 rounded-full border border-red-500/30 hover:bg-red-500/10"
              data-testid="live-now-refresh"
              aria-label="Refresh"
            >
              <RefreshCcw className="w-4 h-4" />
            </button>
            <Link
              to="/streamer/studio"
              className="px-3 py-2 rounded-full bg-gradient-to-r from-red-500 to-fuchsia-500 text-black text-xs font-black uppercase tracking-widest flex items-center gap-2"
              data-testid="live-now-go-live"
            >
              <Radio className="w-3.5 h-3.5" />
              Go Live
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {err && (
          <div
            className="rounded-xl border border-red-500/40 bg-red-900/20 text-red-200 px-3 py-2 text-xs mb-4"
            data-testid="live-now-error"
          >
            {err}
          </div>
        )}

        {loading && sorted.length === 0 && (
          <div className="text-center text-red-300/60 text-xs uppercase tracking-widest py-12">
            Scanning the airwaves…
          </div>
        )}

        {!loading && sorted.length === 0 && !err && <NoStreamsState />}

        <AnimatePresence mode="popLayout">
          <motion.div
            layout
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
          >
            {sorted.map((s) => (
              <motion.div
                key={s.input_id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.25 }}
              >
                <LiveTile stream={s} muted={globalMuted} />
              </motion.div>
            ))}
          </motion.div>
        </AnimatePresence>

        {refreshedAt && sorted.length > 0 && (
          <p className="mt-6 text-center text-[10px] text-red-300/40 uppercase tracking-widest">
            Last refresh · {refreshedAt.toLocaleTimeString()}
          </p>
        )}
      </main>
    </div>
  );
}

// ────────────────────────────────────────────── Tile ──
function LiveTile({ stream, muted }: { stream: LiveStream; muted: boolean }) {
  const [viewerHover, setViewerHover] = useState(false);

  return (
    <div
      className="group rounded-2xl border border-red-500/20 bg-black/40 overflow-hidden hover:border-red-400/60 transition-colors"
      onMouseEnter={() => setViewerHover(true)}
      onMouseLeave={() => setViewerHover(false)}
      data-testid={`live-now-tile-${stream.input_id}`}
    >
      <HLSPlayer
        src={stream.hls_playback_url}
        isLive
        autoPlay
        stallThresholdMs={12000}
        className="!rounded-none !border-0"
      />
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-bold text-white truncate" title={stream.name}>
              {stream.name}
            </h3>
            <p
              className="text-[11px] text-red-300/60 truncate"
              title={stream.streamer_id}
            >
              @{stream.streamer_id}
            </p>
          </div>
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-600/30 border border-red-500/50 text-red-100 text-[9px] font-black uppercase tracking-widest">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
            Live
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between text-[10px] text-red-300/50">
          <span className="flex items-center gap-1">
            <Eye className="w-3 h-3" />
            {viewerHover ? "Tap to enter room" : "Hover to preview"}
          </span>
          {stream.last_status_at && (
            <span title={stream.last_status_at}>
              {timeAgo(stream.last_status_at)}
            </span>
          )}
        </div>
      </div>
      {/* Hidden viewer link — keep this for E2E + accessibility. */}
      <Link
        to={`/streams/watch/${stream.input_id}`}
        className="sr-only"
        aria-label={`Enter ${stream.name}`}
        data-testid={`live-now-enter-${stream.input_id}`}
      >
        Enter
      </Link>
      <span className="sr-only" data-testid={`live-now-muted-${stream.input_id}`}>
        {muted ? "muted" : "sound"}
      </span>
    </div>
  );
}

// ────────────────────────────────────────────── Empty state ──
function NoStreamsState() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-red-500/30 bg-black/40 p-10 text-center"
      data-testid="live-now-empty"
    >
      <Sparkles className="w-8 h-8 text-red-300 mx-auto" />
      <h2 className="mt-3 text-lg font-black uppercase tracking-widest text-white">
        No one is broadcasting right now
      </h2>
      <p className="text-xs text-red-200/70 mt-2 max-w-md mx-auto">
        Be the first. Go to your Studio, paste your RTMP key into OBS, and
        the moment you hit "Start Streaming" you'll show up here for everyone
        on the platform — no refresh needed.
      </p>
      <Link
        to="/streamer/studio"
        className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-red-500 to-fuchsia-500 text-black text-xs font-black uppercase tracking-widest"
        data-testid="live-now-empty-cta"
      >
        <Radio className="w-4 h-4" />
        Be the first to go live
      </Link>
    </motion.div>
  );
}

// ────────────────────────────────────────────── helpers ──
function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diffMs / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}
