/**
 * SpotifyConnect — user-facing connect page at /spotify.
 * Connect button → Spotify OAuth → callback exchanges code → shows now-playing.
 */
import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Music, Play, Pause, Plus, ArrowLeft, Loader2, Car } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

interface Me {
  connected: boolean;
  id?: string;
  display_name?: string;
  product?: string;
  email?: string;
  avatar_url?: string | null;
}

interface NowPlaying {
  connected: boolean;
  is_playing?: boolean;
  device?: string;
  track?: {
    id: string;
    name: string;
    artist: string;
    album: string;
    album_art: string;
    uri: string;
    progress_ms: number;
    duration_ms: number;
  };
}

const fmtTime = (ms: number): string => {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
};

const SpotifyConnect: React.FC = () => {
  const navigate = useNavigate();
  const [me, setMe] = useState<Me | null>(null);
  const [np, setNp] = useState<NowPlaying | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pushing, setPushing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [meRes, npRes] = await Promise.all([
        fetch(`${API}/api/spotify/me`, {}).then((r) => r.json().catch(() => ({}))),
        fetch(`${API}/api/spotify/now-playing`, {}).then((r) => r.json().catch(() => ({}))),
      ]);
      setMe(meRes);
      setNp(npRes);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const iv = setInterval(load, 8000);
    return () => clearInterval(iv);
  }, [load]);

  const connect = async () => {
    try {
      const res = await fetch(`${API}/api/spotify/auth-url`, {});
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.detail || `Sign in to your Global Vibez account first (${res.status})`);
      if (!body.url) throw new Error("No auth URL");
      window.location.href = body.url;
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const pushToCar = async () => {
    if (!np?.track) return;
    setPushing(true);
    try {
      const res = await fetch(`${API}/api/spotify/push-to-car`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ track_uri: np.track.uri }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.detail || "Push failed");
      alert(`Pushed to ${body.status}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPushing(false);
    }
  };

  const track = np?.track;
  const progress = track ? (track.progress_ms / Math.max(1, track.duration_ms)) * 100 : 0;

  return (
    <div className="min-h-screen bg-black text-white" data-testid="spotify-connect">
      <div className="max-w-3xl mx-auto px-6 py-14">
        <button
          onClick={() => navigate(-1)}
          className="text-sm text-neutral-400 hover:text-white mb-6 flex items-center gap-1"
          data-testid="spotify-back-btn"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <div className="flex items-center gap-2 text-emerald-400 font-mono text-xs uppercase tracking-widest mb-4">
          <Music className="w-4 h-4" /> Spotify
        </div>
        <h1 className="text-4xl md:text-5xl font-black italic uppercase tracking-tighter leading-none">
          Push the soundtrack
          <br />
          <span className="text-transparent bg-gradient-to-r from-emerald-400 to-green-600 bg-clip-text">
            anywhere.
          </span>
        </h1>
        <p className="mt-4 text-neutral-400 max-w-xl">
          Connect your Spotify. What you play here can push to any device you're logged into — including your
          Smartcar-paired vehicle dash once both are connected.
        </p>

        {error && (
          <div className="mt-6 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm" data-testid="spotify-error">
            {error}
          </div>
        )}

        {loading && !me ? (
          <div className="mt-10 flex items-center gap-2 text-neutral-400" data-testid="spotify-loading">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading...
          </div>
        ) : !me?.connected ? (
          <div className="mt-10 p-8 rounded-3xl bg-gradient-to-br from-emerald-500/10 via-green-500/10 to-teal-500/10 border border-white/10 text-center" data-testid="spotify-empty">
            <Music className="w-12 h-12 mx-auto text-emerald-400 mb-3" />
            <h2 className="text-xl font-bold">Spotify not connected</h2>
            <p className="text-sm text-neutral-400 mt-2 mb-6">
              Link your Spotify account to get now-playing, push-to-dash, and future Vibe Drive bonuses.
            </p>
            <button
              onClick={connect}
              data-testid="spotify-connect-btn"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 font-bold uppercase tracking-wide text-sm hover:scale-105 transition-transform"
            >
              <Plus className="w-4 h-4" /> Connect Spotify
            </button>
          </div>
        ) : (
          <div className="mt-10 space-y-6" data-testid="spotify-dashboard">
            {/* Account card */}
            <div className="p-5 rounded-2xl bg-neutral-900/60 border border-white/5 flex items-center gap-4" data-testid="spotify-account-card">
              {me.avatar_url ? (
                <img src={me.avatar_url} alt="" className="w-14 h-14 rounded-full" />
              ) : (
                <div className="w-14 h-14 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <Music className="w-7 h-7 text-emerald-400" />
                </div>
              )}
              <div className="flex-1">
                <div className="font-bold text-lg">{me.display_name}</div>
                <div className="text-xs text-neutral-500">
                  {me.product?.toUpperCase() || "ACCOUNT"}
                  {me.email && <> · {me.email}</>}
                </div>
              </div>
              <button
                onClick={connect}
                className="text-xs text-neutral-400 hover:text-white"
                data-testid="spotify-reconnect-btn"
              >
                Reconnect
              </button>
            </div>

            {/* Now playing */}
            <div className="p-5 rounded-2xl bg-gradient-to-br from-neutral-900 to-black border border-emerald-500/20" data-testid="spotify-now-playing-card">
              {track ? (
                <div className="flex gap-4 items-center">
                  {track.album_art && (
                    <img src={track.album_art} alt={track.album} className="w-20 h-20 rounded-xl" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-xs uppercase tracking-widest text-emerald-400 flex items-center gap-1.5">
                      {np?.is_playing ? (
                        <>
                          <Play className="w-3 h-3" /> Now playing
                        </>
                      ) : (
                        <>
                          <Pause className="w-3 h-3" /> Paused
                        </>
                      )}
                      {np?.device && <span className="ml-2 text-neutral-500">· {np.device}</span>}
                    </div>
                    <div className="text-lg font-bold truncate mt-1" data-testid="spotify-track-name">{track.name}</div>
                    <div className="text-sm text-neutral-400 truncate">{track.artist} — {track.album}</div>
                    <div className="mt-3 h-1 bg-neutral-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-400 to-green-600 transition-all duration-500"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-neutral-500 mt-1 font-mono">
                      <span>{fmtTime(track.progress_ms)}</span>
                      <span>{fmtTime(track.duration_ms)}</span>
                    </div>
                  </div>
                  <button
                    onClick={pushToCar}
                    disabled={pushing}
                    data-testid="spotify-push-to-car-btn"
                    className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl bg-fuchsia-500/15 border border-fuchsia-500/40 text-fuchsia-300 text-xs font-semibold hover:bg-fuchsia-500/25 disabled:opacity-40"
                  >
                    {pushing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Car className="w-4 h-4" />}
                    Push to car
                  </button>
                </div>
              ) : (
                <div className="text-center py-8 text-neutral-500 text-sm" data-testid="spotify-not-playing">
                  Nothing is playing right now. Press play in Spotify on any device.
                </div>
              )}
            </div>
          </div>
        )}

        <div className="mt-10 text-[11px] text-neutral-600">
          Tokens are encrypted. We only request the scopes needed for playback + now-playing.
        </div>
      </div>
    </div>
  );
};

export default SpotifyConnect;
