/**
 * VibeDriveHUD — Big-font dashboard-mount driver HUD.
 *
 * Designed for in-car, landscape, high-contrast viewing:
 *   - Massive odometer (primary)
 *   - Today's $DSG tick counter with pulse on award
 *   - Album art + track info
 *   - Wake-lock to prevent screen sleep while on
 *   - Minimal chrome, NO distracting scroll — everything fits in one frame
 *   - Auto-polls status every 15s (faster than the standard page)
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Sun, SunDim, Music, Car, AlertTriangle } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

interface HUDState {
  car_connected: boolean;
  spotify_connected: boolean;
  odometer_miles: number | null;
  last_odometer_miles: number | null;
  is_playing: boolean;
  approved_playlist: boolean;
  today_awarded: number;
  daily_cap: number;
  miles_per_vibez: number;
  awarded_vibez: number;
  reason: string | null;
  track_name?: string | null;
  artist_name?: string | null;
  album_name?: string | null;
  album_art_url?: string | null;
  progress_ms?: number | null;
  duration_ms?: number | null;
}

const REASON_COPY: Record<string, string> = {
  smartcar_not_connected: "Connect your car",
  spotify_not_connected: "Connect Spotify",
  nothing_playing: "Press play",
  playlist_not_approved: "Switch to a Global Vibez Drive playlist",
  first_ping_establishing_baseline: "Baseline locked. Drive to earn.",
  no_new_miles: "Waiting for miles…",
  daily_cap_reached: "Daily cap hit. Back tomorrow.",
  awarded: "$DSG mined",
};

// Minimal Wake Lock hook (no dependency). Graceful no-op if unsupported.
type WakeLockSentinel = { release: () => Promise<void> };
type WakeLockNav = Navigator & { wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinel> } };
function useWakeLock(enabled: boolean): { supported: boolean; active: boolean } {
  const [supported, setSupported] = useState(false);
  const [active, setActive] = useState(false);
  const sentinelRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    const nav = navigator as WakeLockNav;
    setSupported(Boolean(nav.wakeLock));
  }, []);

  useEffect(() => {
    const nav = navigator as WakeLockNav;
    if (!nav.wakeLock) return;
    let cancelled = false;

    const request = async () => {
      try {
        const s = await nav.wakeLock!.request("screen");
        if (cancelled) {
          await s.release();
          return;
        }
        sentinelRef.current = s;
        setActive(true);
      } catch {
        setActive(false);
      }
    };
    const release = async () => {
      if (sentinelRef.current) {
        try { await sentinelRef.current.release(); } catch {
          // noop — sentinel may already be released by the browser
        }
        sentinelRef.current = null;
      }
      setActive(false);
    };

    if (enabled) {
      request();
      const onVis = () => {
        if (document.visibilityState === "visible" && enabled && !sentinelRef.current) request();
      };
      document.addEventListener("visibilitychange", onVis);
      return () => {
        cancelled = true;
        document.removeEventListener("visibilitychange", onVis);
        release();
      };
    } else {
      release();
    }
  }, [enabled]);

  return { supported, active };
}

const fmtMiles = (m: number | null | undefined): string => {
  if (m === null || m === undefined) return "—";
  return m.toLocaleString(undefined, { maximumFractionDigits: 1 });
};

const VibeDriveHUD: React.FC = () => {
  const navigate = useNavigate();
  const [state, setState] = useState<HUDState | null>(null);
  const [awake, setAwake] = useState(true);
  const [dim, setDim] = useState(false);
  const [flash, setFlash] = useState(false);
  const flashTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { supported: wakeSupported, active: wakeActive } = useWakeLock(awake);

  const fetchState = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/vibe-drive/status`, {});
      if (!r.ok) return;
      const s: HUDState = await r.json();
      setState((prev) => {
        // Pulse the counter when new $DSG awarded this tick
        if (s.awarded_vibez > 0 && (!prev || s.awarded_vibez !== prev.awarded_vibez)) {
          setFlash(true);
          if (flashTimeout.current) clearTimeout(flashTimeout.current);
          flashTimeout.current = setTimeout(() => setFlash(false), 2400);
        }
        return s;
      });
    } catch {
      // network blip — silent, will retry on next interval
    }
  }, []);

  useEffect(() => {
    fetchState();
    const iv = setInterval(fetchState, 15000);
    return () => {
      clearInterval(iv);
      if (flashTimeout.current) clearTimeout(flashTimeout.current);
    };
  }, [fetchState]);

  // Derived
  const progressPct = state ? Math.min(100, (state.today_awarded / state.daily_cap) * 100) : 0;
  const songPct = state && state.duration_ms && state.progress_ms
    ? Math.min(100, (state.progress_ms / state.duration_ms) * 100)
    : 0;
  const canEarn = state && state.car_connected && state.spotify_connected && state.approved_playlist && state.is_playing;
  const reasonText = state?.reason ? (REASON_COPY[state.reason] ?? "") : "";

  return (
    <div
      className={`fixed inset-0 bg-black text-white overflow-hidden select-none ${dim ? "opacity-40" : "opacity-100"} transition-opacity duration-500`}
      data-testid="vibe-drive-hud"
    >
      {/* Background gradient / grain */}
      <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-950/60 via-black to-cyan-950/40 pointer-events-none" />
      {state?.album_art_url && (
        <div
          className="absolute inset-0 opacity-20 blur-3xl scale-125 pointer-events-none"
          style={{ backgroundImage: `url(${state.album_art_url})`, backgroundSize: "cover", backgroundPosition: "center" }}
        />
      )}

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 px-5 py-3 flex items-center justify-between z-20">
        <button
          onClick={() => navigate("/vibe-drive")}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-xs uppercase tracking-widest font-bold"
          data-testid="hud-exit-btn"
        >
          <ArrowLeft className="w-4 h-4" /> Exit HUD
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setAwake((w) => !w)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs uppercase tracking-widest font-bold ${
              wakeActive ? "bg-emerald-500/15 border-emerald-400/40 text-emerald-200" : "bg-white/5 border-white/10 text-neutral-400"
            }`}
            title={wakeSupported ? "Keep screen awake" : "Wake lock unsupported on this browser"}
            data-testid="hud-wakelock-btn"
          >
            <Sun className="w-4 h-4" />
            {wakeSupported ? (wakeActive ? "Awake" : "Sleep") : "N/A"}
          </button>
          <button
            onClick={() => setDim((d) => !d)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-xs uppercase tracking-widest font-bold"
            data-testid="hud-dim-btn"
          >
            <SunDim className="w-4 h-4" /> {dim ? "Wake" : "Dim"}
          </button>
        </div>
      </div>

      {/* Main grid: left = odometer + vibez, right = album art */}
      <div className="relative z-10 h-full grid grid-cols-[1.4fr_1fr] gap-8 px-8 pt-16 pb-8">
        {/* LEFT COLUMN */}
        <div className="flex flex-col justify-between min-w-0">
          {/* Odometer */}
          <div>
            <div className="text-[10px] sm:text-xs uppercase tracking-[0.4em] text-fuchsia-300/80 font-mono">
              Odometer · OEM-verified
            </div>
            <div
              className="mt-2 font-black italic tabular-nums tracking-tighter leading-none text-white"
              style={{ fontSize: "clamp(5rem, 16vw, 14rem)" }}
              data-testid="hud-odometer"
            >
              {fmtMiles(state?.odometer_miles ?? null)}
              <span className="text-fuchsia-400/80 ml-4" style={{ fontSize: "0.4em" }}>
                mi
              </span>
            </div>
            <div className="mt-1 text-sm font-mono text-neutral-500">
              Baseline: {fmtMiles(state?.last_odometer_miles ?? null)} mi
            </div>
          </div>

          {/* VIBEZ tick counter */}
          <div className="mt-6">
            <div className="flex items-baseline justify-between">
              <div className="text-[10px] sm:text-xs uppercase tracking-[0.4em] text-cyan-300/80 font-mono">
                Today · $DSG mined
              </div>
              <div className="text-xs font-mono text-neutral-500">
                1 / {state?.miles_per_vibez ?? 10} mi
              </div>
            </div>
            <div
              className={`mt-2 font-black italic tabular-nums tracking-tighter leading-none transition-all ${
                flash ? "text-emerald-300 drop-shadow-[0_0_30px_rgba(16,185,129,0.8)] scale-[1.04]" : "text-white"
              }`}
              style={{ fontSize: "clamp(4rem, 12vw, 10rem)" }}
              data-testid="hud-vibez-counter"
            >
              {(state?.today_awarded ?? 0).toFixed(2)}
              <span className="ml-3 text-cyan-400/80" style={{ fontSize: "0.35em" }}>
                / {state?.daily_cap ?? 5}
              </span>
            </div>
            <div className="mt-3 h-3 bg-white/5 rounded-full overflow-hidden ring-1 ring-white/10">
              <div
                className="h-full bg-gradient-to-r from-fuchsia-500 via-pink-500 to-cyan-400 transition-all duration-700"
                style={{ width: `${progressPct}%` }}
                data-testid="hud-progress-bar"
              />
            </div>
          </div>

          {/* Status footer (stoplight + reason) */}
          <div className="mt-6 flex items-center gap-3 text-sm" data-testid="hud-status-row">
            <StatusDot ok={!!state?.car_connected} icon={<Car className="w-4 h-4" />} label="Car" />
            <StatusDot ok={!!state?.spotify_connected} icon={<Music className="w-4 h-4" />} label="Spotify" />
            <StatusDot ok={!!state?.approved_playlist} label="Curated" />
            <StatusDot ok={!!state?.is_playing} label="Playing" />
            <div className={`ml-auto flex items-center gap-2 text-xs uppercase tracking-widest font-bold ${
              canEarn ? "text-emerald-300" : "text-amber-300"
            }`} data-testid="hud-reason">
              {!canEarn && <AlertTriangle className="w-3.5 h-3.5" />}
              {reasonText}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN — album art card */}
        <div className="flex flex-col items-stretch justify-start min-w-0">
          <div className="aspect-square w-full rounded-3xl overflow-hidden bg-neutral-900 ring-1 ring-white/10 relative shadow-2xl" data-testid="hud-album-art">
            {state?.album_art_url ? (
              <img
                src={state.album_art_url}
                alt={state.album_name ?? "Now playing"}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-neutral-600">
                <Music className="w-20 h-20" />
              </div>
            )}
            {/* vinyl glint */}
            <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          </div>
          <div className="mt-4 min-w-0">
            <div className="text-2xl font-black italic tracking-tight truncate" data-testid="hud-track-name">
              {state?.track_name ?? "—"}
            </div>
            <div className="text-base text-neutral-400 truncate" data-testid="hud-artist-name">
              {state?.artist_name ?? (state?.spotify_connected ? "Nothing playing" : "Spotify not connected")}
            </div>
            {state?.duration_ms ? (
              <div className="mt-3 h-1 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white/60 transition-all duration-1000"
                  style={{ width: `${songPct}%` }}
                />
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};

const StatusDot: React.FC<{ ok: boolean; label: string; icon?: React.ReactNode }> = ({ ok, label, icon }) => (
  <div
    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] uppercase tracking-widest font-bold ${
      ok
        ? "bg-emerald-500/15 border border-emerald-400/40 text-emerald-200"
        : "bg-white/5 border border-white/10 text-neutral-500"
    }`}
    data-testid={`hud-status-${label.toLowerCase()}`}
  >
    {icon}
    {label}
  </div>
);

export default VibeDriveHUD;
