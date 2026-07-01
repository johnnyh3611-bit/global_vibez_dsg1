/**
 * VibeDrive — bonus $DSG for verified miles driven while streaming
 * Global Vibez curated playlists. Auto-polls the tick endpoint every 30s.
 */
import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Gauge,
  Music,
  Car,
  Sparkles,
  ArrowLeft,
  Check,
  X,
  Loader2,
  Flame,
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

interface VibeDriveState {
  car_connected: boolean;
  spotify_connected: boolean;
  odometer_miles: number | null;
  last_odometer_miles: number | null;
  is_playing: boolean;
  playlist_uri: string | null;
  approved_playlist: boolean;
  today_awarded: number;
  daily_cap: number;
  miles_per_vibez: number;
  awarded_vibez: number;
  reason: string | null;
}

interface VDSession {
  created_at: string;
  miles_verified: number;
  mined: number;
  status: string;
}

const REASON_COPY: Record<string, string> = {
  smartcar_not_connected: "Connect your car to Smartcar to start earning",
  spotify_not_connected: "Connect Spotify so we know what's playing",
  nothing_playing: "Press play in Spotify to start the clock",
  playlist_not_approved: "Switch to a Global Vibez Drive playlist to unlock the bonus",
  first_ping_establishing_baseline: "Baseline set — every new mile counts from here",
  no_new_miles: "Waiting for you to roll...",
  daily_cap_reached: "Daily cap reached — new miles count again tomorrow",
  awarded: "$DSG awarded — check your balance",
};

const Gate: React.FC<{ ok: boolean; label: string }> = ({ ok, label }) => (
  <div
    className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${
      ok
        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
        : "bg-neutral-800/60 border-neutral-700 text-neutral-500"
    }`}
  >
    {ok ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
    <span className="text-xs uppercase tracking-widest font-semibold">{label}</span>
  </div>
);

const VibeDrive: React.FC = () => {
  const navigate = useNavigate();
  const [state, setState] = useState<VibeDriveState | null>(null);
  const [history, setHistory] = useState<VDSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      const [s, h] = await Promise.all([
        fetch(`${API}/api/vibe-drive/status`, {}).then((r) => r.json()),
        fetch(`${API}/api/vibe-drive/history`, {})
          .then((r) => (r.ok ? r.json() : { sessions: [] }))
          .catch(() => ({ sessions: [] })),
      ]);
      setState(s);
      setHistory(h.sessions || []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const iv = setInterval(fetchAll, 30000);
    return () => clearInterval(iv);
  }, [fetchAll]);

  const progress = state ? (state.today_awarded / state.daily_cap) * 100 : 0;

  return (
    <div className="min-h-screen bg-black text-white" data-testid="vibe-drive-page">
      {/* Hero */}
      <section className="relative border-b border-neutral-900 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-900/30 via-black to-cyan-900/20" />
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              "repeating-linear-gradient(-20deg, rgba(236,72,153,0.15) 0 1px, transparent 1px 80px)",
          }}
        />
        <div className="relative max-w-4xl mx-auto px-6 py-16">
          <button
            onClick={() => navigate(-1)}
            className="text-sm text-neutral-400 hover:text-white mb-6 flex items-center gap-1"
            data-testid="vibe-drive-back-btn"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <div className="flex items-center gap-2 text-fuchsia-400 font-mono text-xs uppercase tracking-widest mb-4">
            <Flame className="w-4 h-4" /> Vibe Drive
          </div>
          <h1 className="text-5xl md:text-6xl font-black italic uppercase tracking-tighter leading-none">
            Drive to the music.
            <br />
            <span className="text-transparent bg-gradient-to-r from-fuchsia-500 via-pink-500 to-cyan-400 bg-clip-text">
              Earn the VIBEZ.
            </span>
          </h1>
          <p className="mt-4 text-neutral-400 max-w-xl">
            Connect your car + Spotify. Put on a <strong>Global Vibez Drive</strong> playlist. Every
            verified mile earns you $DSG — no GPS spoofing possible, odometer is OEM-backed.
          </p>
          <button
            onClick={() => navigate("/vibe-drive/hud")}
            className="mt-6 inline-flex items-center gap-2 px-5 py-3 rounded-full bg-gradient-to-r from-fuchsia-500 to-cyan-400 text-black font-black italic uppercase tracking-wider hover:scale-[1.02] transition-transform"
            data-testid="vibe-drive-launch-hud-btn"
          >
            <Gauge className="w-5 h-5" /> Launch Driver HUD
          </button>
        </div>
      </section>

      {loading && !state ? (
        <div className="max-w-4xl mx-auto px-6 py-12 flex items-center gap-2 text-neutral-400" data-testid="vibe-drive-loading">
          <Loader2 className="w-4 h-4 animate-spin" /> Syncing car + music...
        </div>
      ) : state ? (
        <div className="max-w-4xl mx-auto px-6 py-10 space-y-6">
          {/* Gates row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" data-testid="vibe-drive-gates">
            <Gate ok={state.car_connected} label="Car" />
            <Gate ok={state.spotify_connected} label="Spotify" />
            <Gate ok={state.is_playing} label="Playing" />
            <Gate ok={state.approved_playlist} label="Curated" />
          </div>

          {/* Main dashboard */}
          <div className="grid md:grid-cols-[1fr_300px] gap-6">
            {/* Status + reason */}
            <div className="p-6 rounded-3xl bg-gradient-to-br from-neutral-900 to-black border border-fuchsia-500/20" data-testid="vibe-drive-status-card">
              <div className="flex items-center gap-3 mb-4">
                <Gauge className="w-6 h-6 text-fuchsia-300" />
                <h3 className="text-lg font-bold uppercase tracking-tighter">Live Status</h3>
                {state.awarded_vibez > 0 && (
                  <span
                    className="ml-auto px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-xs font-bold uppercase tracking-widest flex items-center gap-1"
                    data-testid="vibe-drive-awarded-badge"
                  >
                    <Sparkles className="w-3 h-3" /> +{state.awarded_vibez.toFixed(2)} $DSG
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs font-mono text-neutral-500 uppercase tracking-widest">Odometer</div>
                  <div className="text-2xl font-black mt-1 tabular-nums" data-testid="vibe-drive-odometer">
                    {state.odometer_miles !== null
                      ? state.odometer_miles.toLocaleString(undefined, { maximumFractionDigits: 1 })
                      : "—"}
                    <span className="text-sm text-neutral-500 ml-1">mi</span>
                  </div>
                </div>
                <div>
                  <div className="text-xs font-mono text-neutral-500 uppercase tracking-widest">Baseline</div>
                  <div className="text-2xl font-black mt-1 tabular-nums text-neutral-400">
                    {state.last_odometer_miles !== null
                      ? state.last_odometer_miles.toLocaleString(undefined, { maximumFractionDigits: 1 })
                      : "—"}
                    <span className="text-sm text-neutral-600 ml-1">mi</span>
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs font-mono text-fuchsia-400 uppercase tracking-widest">Today</span>
                  <span className="text-sm tabular-nums font-bold">
                    {state.today_awarded.toFixed(2)} / {state.daily_cap.toFixed(0)} $DSG
                  </span>
                </div>
                <div className="mt-2 h-2 bg-neutral-900 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-fuchsia-500 to-cyan-400 transition-all duration-500"
                    style={{ width: `${Math.min(100, progress)}%` }}
                    data-testid="vibe-drive-progress"
                  />
                </div>
              </div>

              <div
                className="mt-5 text-sm text-neutral-300 p-3 rounded-xl bg-neutral-900/40 border border-white/5"
                data-testid="vibe-drive-reason"
              >
                {state.reason ? (REASON_COPY[state.reason] ?? state.reason) : "Initializing..."}
              </div>
            </div>

            {/* Quick Connect panel */}
            <div className="space-y-3" data-testid="vibe-drive-quick-connect">
              <QuickLink
                to="/smartcar"
                icon={<Car className="w-4 h-4" />}
                label="Car"
                status={state.car_connected ? "Connected" : "Not connected"}
                ok={state.car_connected}
              />
              <QuickLink
                to="/spotify"
                icon={<Music className="w-4 h-4" />}
                label="Spotify"
                status={state.spotify_connected ? "Connected" : "Not connected"}
                ok={state.spotify_connected}
              />
              <div className="p-4 rounded-xl bg-neutral-900/50 border border-white/5 text-xs text-neutral-400">
                <div className="font-bold uppercase tracking-widest text-[10px] text-fuchsia-400 mb-1">
                  Math
                </div>
                1 $DSG per {state.miles_per_vibez} verified miles. Capped at {state.daily_cap} $DSG / day.
              </div>
            </div>
          </div>

          {/* History */}
          <div className="p-5 rounded-2xl bg-neutral-900/40 border border-white/5" data-testid="vibe-drive-history">
            <h3 className="text-sm font-bold uppercase tracking-widest text-fuchsia-400 mb-3">
              Recent Drives
            </h3>
            {history.length === 0 ? (
              <div className="text-neutral-500 text-sm" data-testid="vibe-drive-history-empty">
                No Vibe Drives yet. First qualifying mile will show up here.
              </div>
            ) : (
              <div className="divide-y divide-neutral-800">
                {history.map((s, i) => (
                  <div
                    key={`${s.created_at}_${i}`}
                    className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 py-2.5 text-sm"
                  >
                    <span className="text-neutral-500 font-mono text-xs">
                      {new Date(s.created_at).toLocaleString()}
                    </span>
                    <span className="text-neutral-400 text-xs">
                      {s.miles_verified?.toFixed(2) ?? "—"} mi
                    </span>
                    <span className="text-fuchsia-300 tabular-nums font-bold">
                      +{s.mined?.toFixed(2) ?? "—"}
                    </span>
                    <span className={`text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full ${
                      s.status === "CLEARED"
                        ? "bg-emerald-500/20 text-emerald-300"
                        : "bg-amber-500/20 text-amber-300"
                    }`}>
                      {s.status === "PENDING_VIBE_CHECK" ? "72h Hold" : s.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}

      {error && (
        <div className="max-w-4xl mx-auto px-6 py-4 text-rose-400 text-sm" data-testid="vibe-drive-error">
          {error}
        </div>
      )}
    </div>
  );
};

const QuickLink: React.FC<{ to: string; icon: React.ReactNode; label: string; status: string; ok: boolean }> = ({
  to,
  icon,
  label,
  status,
  ok,
}) => {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate(to)}
      className={`w-full flex items-center gap-3 p-4 rounded-xl border text-left transition-colors ${
        ok
          ? "bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/15"
          : "bg-neutral-900/60 border-neutral-800 hover:border-fuchsia-500/40"
      }`}
      data-testid={`vibe-drive-quick-${label.toLowerCase()}`}
    >
      {icon}
      <div className="flex-1">
        <div className="text-sm font-bold">{label}</div>
        <div className={`text-xs ${ok ? "text-emerald-300" : "text-neutral-500"}`}>{status}</div>
      </div>
      <span className="text-xs text-neutral-500">→</span>
    </button>
  );
};

export default VibeDrive;
