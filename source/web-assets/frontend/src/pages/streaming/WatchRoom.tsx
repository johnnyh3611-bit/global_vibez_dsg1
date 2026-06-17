/**
 * WatchRoom — single-stream viewer page. Big HLS player + simple
 * metadata card. Looks up the live input by ID from the backend so
 * users can deep-link / share a specific stream URL.
 */
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronLeft, Radio, AlertTriangle, Share2, Bell, BellOff } from "lucide-react";
import HLSPlayer from "@/components/streaming/HLSPlayer";
import { getUserId } from "@/utils/secureAuth";

const API = process.env.REACT_APP_BACKEND_URL;

interface LiveStream {
  input_id: string;
  streamer_id: string;
  name: string;
  hls_playback_url: string | null;
  is_live: boolean;
  last_status?: string;
}

export default function WatchRoom() {
  const nav = useNavigate();
  const { inputId } = useParams<{ inputId: string }>();
  const [stream, setStream] = useState<LiveStream | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [following, setFollowing] = useState<boolean | null>(null);
  const [followBusy, setFollowBusy] = useState(false);
  const me = getUserId();

  useEffect(() => {
    if (!inputId) return;
    const load = async () => {
      try {
        // The list endpoint returns sanitized rows (no RTMP key);
        // that's exactly what we want for a viewer page.
        const r = await fetch(`${API}/api/streaming/cloudflare/live-inputs`, {
          cache: "no-store",
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = await r.json();
        const found = (data.streams as LiveStream[]).find(
          (s) => s.input_id === inputId,
        );
        if (!found) {
          setErr("Stream not found or already offline.");
        } else {
          setStream(found);
        }
      } catch (e: unknown) {
        setErr((e as Error)?.message || "Failed to load stream");
      }
    };
    load();
    const id = window.setInterval(load, 10000);
    return () => window.clearInterval(id);
  }, [inputId]);

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — silent */
    }
  };

  // Follow state — preload on mount so the Bell icon reflects reality.
  useEffect(() => {
    if (!me || !stream?.streamer_id) return;
    fetch(`${API}/api/streamer-follow/is-following/${me}/${stream.streamer_id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j && setFollowing(Boolean(j.following)))
      .catch(() => {});
  }, [me, stream?.streamer_id]);

  const toggleFollow = async () => {
    if (!me || !stream?.streamer_id || followBusy) return;
    setFollowBusy(true);
    const path = following ? "unfollow" : "follow";
    try {
      const r = await fetch(`${API}/api/streamer-follow/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: me, streamer_id: stream.streamer_id }),
      });
      if (r.ok) setFollowing(!following);
    } catch {
      /* silent — user can retry */
    } finally {
      setFollowBusy(false);
    }
  };

  return (
    <div
      className="min-h-screen bg-[#070012] text-white font-mono"
      data-testid="watch-room-root"
    >
      <header className="sticky top-0 z-20 backdrop-blur-xl bg-black/60 border-b border-red-500/20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
          <button
            onClick={() => nav(-1)}
            className="text-red-200/70 hover:text-white inline-flex items-center gap-1 text-xs uppercase tracking-widest"
            data-testid="watch-room-back"
          >
            <ChevronLeft className="w-4 h-4" /> Back
          </button>
          <Link
            to="/streams/live"
            className="text-[10px] uppercase tracking-widest text-red-200/70 hover:text-white"
            data-testid="watch-room-wall-link"
          >
            ← Live Now Wall
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-4">
        {err && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-red-500/40 bg-red-900/20 text-red-200 px-3 py-2 text-xs flex items-center gap-2"
            data-testid="watch-room-error"
          >
            <AlertTriangle className="w-4 h-4" /> {err}
          </motion.div>
        )}

        {stream && (
          <>
            <HLSPlayer src={stream.hls_playback_url} isLive autoPlay />

            <div className="rounded-2xl border border-red-500/20 bg-black/40 p-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-lg font-black tracking-widest uppercase text-white truncate">
                  {stream.name}
                </h1>
                <p className="text-xs text-red-200/70 mt-1">@{stream.streamer_id}</p>
                <p
                  className={`mt-2 inline-flex items-center gap-1 text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full ${
                    stream.is_live
                      ? "bg-red-600/30 border border-red-500/50 text-red-100"
                      : "bg-zinc-700/30 border border-zinc-500/40 text-zinc-300"
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      stream.is_live ? "bg-red-400 animate-pulse" : "bg-zinc-400"
                    }`}
                  />
                  {stream.is_live ? "Live" : stream.last_status || "Offline"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {me && stream.streamer_id !== me && (
                  <button
                    onClick={toggleFollow}
                    disabled={followBusy || following === null}
                    className={`px-3 py-2 rounded-full border text-[10px] uppercase tracking-widest flex items-center gap-1.5 transition-all ${
                      following
                        ? "bg-amber-500/15 border-amber-400/50 text-amber-200 hover:bg-amber-500/25"
                        : "bg-emerald-500/15 border-emerald-400/60 text-emerald-100 hover:bg-emerald-500/30"
                    } disabled:opacity-60`}
                    data-testid="watch-room-follow-btn"
                    title={
                      following
                        ? "You'll get a phone-buzz next time this creator goes live"
                        : "Follow to get a push notification when this creator goes live"
                    }
                  >
                    {following ? <Bell className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
                    {following === null ? "…" : following ? "Following" : "Follow"}
                  </button>
                )}
                <button
                  onClick={share}
                  className="px-3 py-2 rounded-full border border-red-500/30 hover:bg-red-500/10 text-[10px] uppercase tracking-widest flex items-center gap-1.5"
                  data-testid="watch-room-share"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  {copied ? "Copied!" : "Share"}
                </button>
              </div>
            </div>
          </>
        )}

        <Link
          to="/streamer/studio"
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full border border-fuchsia-500/40 text-fuchsia-200 hover:bg-fuchsia-500/10 text-[11px] uppercase tracking-widest"
          data-testid="watch-room-go-live-cta"
        >
          <Radio className="w-3.5 h-3.5" /> Want to broadcast? Open your Studio →
        </Link>
      </main>
    </div>
  );
}
