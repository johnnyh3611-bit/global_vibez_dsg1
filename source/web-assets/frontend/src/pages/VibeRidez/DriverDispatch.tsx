/**
 * DriverDispatch — real-time Vibe Ridez driver console.
 *
 * Features:
 *   • Big GO-LIVE toggle (cyber neon, hardware-locked footer).
 *   • Streams GPS via WebSocket /api/ws/vibe-ridez/driver/{driver_id}.
 *   • Wake-Lock so the screen stays on during a shift.
 *   • Earnings tracker with framer-motion spring counter.
 *   • Daily / Total view toggle.
 *   • Daily goal setter with +/- ₵ stepper.
 *   • Ride-alert overlay with 15-second countdown + Accept / Decline.
 */
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, useSpring, useTransform } from "framer-motion";
import { Bolt, ShieldCheck, Crosshair, Plus, Minus, Camera, Wallet } from "lucide-react";
import { authFetch } from "@/utils/secureAuth";

const API = process.env.REACT_APP_BACKEND_URL;
const WS = (API || "").replace(/^http/, "ws");

type RideOffer = {
  event: string;
  rider_id: string;
  rider_lat: number;
  rider_lon: number;
  pickup_label?: string;
  reward: number;
  distance_km?: number;
  expires_in_seconds: number;
};

const EarningsRing = ({
  daily,
  lifetime,
  goal,
  viewMode,
}: {
  daily: number;
  lifetime: number;
  goal: number;
  viewMode: "daily" | "total";
}) => {
  // Animated count-up
  const target = viewMode === "daily" ? daily : lifetime;
  const count = useSpring(0, { stiffness: 60, damping: 22 });
  const rounded = useTransform(count, (v) => Math.round(v).toLocaleString());
  useEffect(() => { count.set(target); }, [target, count]);

  // Ring math
  const RADIUS = 110;
  const CIRC = 2 * Math.PI * RADIUS;
  const progress = Math.min(100, (daily / Math.max(1, goal)) * 100);
  const offset = CIRC - (CIRC * progress) / 100;
  const isDaily = viewMode === "daily";

  return (
    <div className="relative flex items-center justify-center mb-6">
      <svg className="w-64 h-64 -rotate-90" viewBox="0 0 256 256">
        <circle
          cx="128" cy="128" r={RADIUS}
          stroke="currentColor" strokeWidth="12" fill="transparent"
          className="text-slate-800"
        />
        <motion.circle
          cx="128" cy="128" r={RADIUS}
          stroke="currentColor" strokeWidth="12" fill="transparent" strokeLinecap="round"
          strokeDasharray={CIRC}
          strokeDashoffset={offset}
          className={
            isDaily
              ? "text-cyan-400 drop-shadow-[0_0_10px_#0ff]"
              : "text-fuchsia-500 drop-shadow-[0_0_10px_#a855f7]"
          }
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <motion.span
          className="text-5xl font-black text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.5)] font-mono"
          data-testid="driver-earnings-counter"
        >
          {rounded}
        </motion.span>
        <span className="text-[10px] text-cyan-700 tracking-[0.4em] mt-1 uppercase">
          ₵ Vibez
        </span>
        {isDaily && (
          <span className="text-[9px] text-cyan-600 mt-1 uppercase tracking-widest">
            {Math.round(progress)}% of ₵{goal.toLocaleString()} goal
          </span>
        )}
      </div>
    </div>
  );
};

export default function DriverDispatch() {
  const navigate = useNavigate();
  const [isOnline, setIsOnline] = useState(false);
  // Payout wallet gate — drivers cannot go ONLINE without a registered
  // Solana wallet. Read from GET /api/driver/wallet once on mount;
  // refetched when the user returns from /driver/wallet.
  const [hasWallet, setHasWallet] = useState<boolean | null>(null);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [offer, setOffer] = useState<RideOffer | null>(null);
  // Stamped when the driver accepts a ride (server emits EARNINGS_PENDING
  // with the ride_id). Cleared on EARNINGS_CREDITED. Drives the inline
  // "Go Live POV" pill so the driver can dashcam-stream the active ride.
  const [activeRideId, setActiveRideId] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [viewMode, setViewMode] = useState<"daily" | "total">("daily");
  const [dailyGoal, setDailyGoal] = useState(500);
  const [dailyEarnings, setDailyEarnings] = useState(0);
  const [lifetimeEarnings, setLifetimeEarnings] = useState(0);
  const [pendingEarnings, setPendingEarnings] = useState(0);
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);

  const driverIdRef = useRef<string>(
    localStorage.getItem("vibe_driver_id") || `drv_${Math.random().toString(36).slice(2, 10)}`,
  );
  const wsRef = useRef<WebSocket | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const watchIdRef = useRef<number | null>(null);

  useEffect(() => {
    localStorage.setItem("vibe_driver_id", driverIdRef.current);
  }, []);

  // Payout wallet gate — poll once on mount + whenever the tab becomes
  // visible (so returning from /driver/wallet flips the gate instantly).
  useEffect(() => {
    const check = async () => {
      try {
        const r = await authFetch(`${API}/api/driver/wallet`);
        if (r.ok) {
          const d = await r.json();
          setHasWallet(!!d.solana_wallet_address);
        } else {
          setHasWallet(false);
        }
      } catch {
        setHasWallet(false);
      }
    };
    check();
    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  // Poll earnings every 10s while online
  useEffect(() => {
    if (!isOnline) return;
    const fetchEarnings = async () => {
      try {
        const r = await fetch(`${API}/api/ridez/earnings/${driverIdRef.current}`);
        if (r.ok) {
          const d = await r.json();
          setDailyEarnings(d.daily_earned || 0);
          setLifetimeEarnings(d.total_earned || 0);
          setPendingEarnings(d.pending_earned || 0);
          if (d.daily_goal) setDailyGoal(d.daily_goal);
        }
      } catch { /* ignore */ }
    };
    fetchEarnings();
    const t = setInterval(fetchEarnings, 10000);
    return () => clearInterval(t);
  }, [isOnline]);

  // Persist daily goal to backend on change
  useEffect(() => {
    fetch(`${API}/api/ridez/goal/${driverIdRef.current}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ daily_goal: dailyGoal }),
    }).catch(() => { /* offline OK */ });
  }, [dailyGoal]);

  // Connect WebSocket + start GPS stream when online; tear down on offline.
  useEffect(() => {
    if (!isOnline) {
      wsRef.current?.close();
      wsRef.current = null;
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      return;
    }

    const ws = new WebSocket(`${WS}/api/ws/vibe-ridez/driver/${driverIdRef.current}`);
    wsRef.current = ws;
    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.event === "NEW_RIDE") {
          setOffer(data);
          setCountdown(Math.round(data.expires_in_seconds || 15));
        } else if (data.event === "REQUEST_EXPIRED") {
          setOffer(null);
        } else if (data.event === "EARNINGS_PENDING") {
          // Driver just accepted — reward sits in escrow until rider
          // marks the ride complete. Show pending overlay.
          if (typeof data.pending_earned === "number") {
            setPendingEarnings(data.pending_earned);
          }
          if (typeof data.ride_id === "string") {
            setActiveRideId(data.ride_id);
          }
        } else if (data.event === "EARNINGS_CREDITED") {
          // Rider hit Complete — escrow releases into daily/total.
          if (typeof data.daily_earned === "number") {
            setDailyEarnings(data.daily_earned);
          }
          if (typeof data.total_earned === "number") {
            setLifetimeEarnings(data.total_earned);
          }
          if (typeof data.pending_earned === "number") {
            setPendingEarnings(data.pending_earned);
          }
          // Ride completed → clear the Go-Live target.
          setActiveRideId(null);
        }
      } catch {
        /* ignore malformed */
      }
    };
    ws.onopen = () => {
      // Send initial status
      ws.send(JSON.stringify({ status: "AVAILABLE", type: "real" }));
    };

    if ("geolocation" in navigator) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lon = pos.coords.longitude;
          setCoords({ lat, lon });
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ lat, lng: lon, type: "real" }));
          }
        },
        () => { /* user denied */ },
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 },
      );
    }

    return () => {
      ws.close();
      wsRef.current = null;
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [isOnline]);

  // Wake-Lock during shift
  useEffect(() => {
    const acquire = async () => {
      try {
        const nav = navigator as Navigator & { wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinel> } };
        if (nav.wakeLock) {
          wakeLockRef.current = await nav.wakeLock.request("screen");
        }
      } catch {
        /* ignore — not supported on iOS Safari < 16.4 */
      }
    };
    if (isOnline) acquire();
    else {
      wakeLockRef.current?.release().catch(() => {});
      wakeLockRef.current = null;
    }
  }, [isOnline]);

  // Countdown ticker for the offer modal
  useEffect(() => {
    if (!offer || countdown <= 0) return;
    const t = setInterval(() => setCountdown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [offer, countdown]);

  const respond = async (accepted: boolean) => {
    setOffer(null);
    setCountdown(0);
    try {
      await fetch(`${API}/api/ridez/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ driver_id: driverIdRef.current, accepted }),
      });
    } catch { /* ignore */ }
  };

  const toggleStatus = async () => {
    const next = !isOnline;
    // Wallet gate — refuse to go ONLINE without a registered payout
    // wallet. Going OFFLINE is always allowed.
    if (next && !hasWallet) {
      setWalletError(
        "Connect a Solana wallet before going online — that's where your payouts land.",
      );
      return;
    }
    setWalletError(null);
    setIsOnline(next);
    try {
      await fetch(`${API}/api/ridez/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          driver_id: driverIdRef.current,
          status: next ? "AVAILABLE" : "OFFLINE",
          type: "real",
          lat: coords?.lat,
          lon: coords?.lon,
        }),
      });
    } catch { /* ignore */ }
  };

  return (
    <div
      className="min-h-screen bg-black text-cyan-400 p-6 flex flex-col items-center font-mono relative overflow-hidden"
      data-testid="driver-dispatch-root"
    >
      <h1 className="text-xl font-bold tracking-[0.3em] mb-8 mt-4 uppercase">
        Vibe Ridez Dispatch
      </h1>

      {/* Earnings */}
      <div className="w-full max-w-md mb-6">
        <div
          className="flex bg-black p-1 rounded-full mb-4 w-48 mx-auto border border-cyan-900/50"
          data-testid="driver-earnings-toggle"
        >
          <button
            onClick={() => setViewMode("daily")}
            className={`flex-1 py-1.5 rounded-full text-[10px] font-bold tracking-widest uppercase transition-all ${
              viewMode === "daily"
                ? "bg-cyan-500 text-black shadow-[0_0_15px_cyan]"
                : "text-cyan-900"
            }`}
          >
            Daily
          </button>
          <button
            onClick={() => setViewMode("total")}
            className={`flex-1 py-1.5 rounded-full text-[10px] font-bold tracking-widest uppercase transition-all ${
              viewMode === "total"
                ? "bg-purple-600 text-white shadow-[0_0_15px_purple]"
                : "text-cyan-900"
            }`}
          >
            Total
          </button>
        </div>
        <EarningsRing
          daily={dailyEarnings}
          lifetime={lifetimeEarnings}
          goal={dailyGoal}
          viewMode={viewMode}
        />
        {pendingEarnings > 0 && (
          <div
            className="mx-auto mt-2 max-w-[260px] text-center"
            data-testid="driver-pending-pill"
          >
            <p className="text-[10px] uppercase tracking-widest text-amber-300/90 bg-amber-500/10 border border-amber-400/40 rounded-full px-3 py-1 inline-block">
              ₵{pendingEarnings.toLocaleString()} in escrow · awaiting rider complete
            </p>
          </div>
        )}

        {/* Active-ride POV stream pill — only shows once driver accepts */}
        {activeRideId && (
          <div className="mt-3 flex justify-center" data-testid="driver-go-live-pov-slot">
            <Link
              to={`/driver/dashcam/${activeRideId}`}
              className="inline-flex items-center gap-2 rounded-full border border-rose-500/50 bg-rose-500/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-rose-300 hover:bg-rose-500/20"
              data-testid="driver-go-live-pov-btn"
            >
              <Camera className="h-3 w-3" />
              Go Live POV
            </Link>
          </div>
        )}

        {/* Earnings shortcut + wallet status — always visible */}
        <div className="mt-3 flex flex-wrap items-center justify-center gap-3" data-testid="driver-earnings-link-slot">
          <Link
            to="/driver/earnings"
            className="text-[10px] uppercase tracking-widest text-cyan-400/70 hover:text-cyan-300"
            data-testid="driver-earnings-link"
          >
            View earnings receipt →
          </Link>
          {hasWallet === false && (
            <Link
              to="/driver/wallet"
              className="inline-flex items-center gap-1 rounded-full border border-amber-500/50 bg-amber-500/10 px-2 py-1 text-[10px] uppercase tracking-widest text-amber-300 hover:bg-amber-500/20"
              data-testid="driver-wallet-missing-link"
            >
              <Wallet className="h-3 w-3" /> Connect payout wallet
            </Link>
          )}
          {hasWallet === true && (
            <Link
              to="/driver/wallet"
              className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-[10px] uppercase tracking-widest text-emerald-300 hover:bg-emerald-500/20"
              data-testid="driver-wallet-ok-link"
            >
              <Wallet className="h-3 w-3" /> Wallet connected
            </Link>
          )}
        </div>

        {walletError && (
          <div
            className="mx-auto mt-3 max-w-md rounded-lg border border-amber-500/40 bg-amber-950/40 px-3 py-2 text-center text-xs text-amber-200"
            data-testid="driver-wallet-error-banner"
          >
            {walletError}{" "}
            <button
              type="button"
              onClick={() => navigate("/driver/wallet")}
              className="ml-1 font-semibold underline hover:text-amber-100"
              data-testid="driver-wallet-error-cta"
            >
              Connect now →
            </button>
          </div>
        )}
      </div>

      {/* GO LIVE toggle */}
      <button
        onClick={toggleStatus}
        className={`w-48 h-48 rounded-full border-4 transition-all ${
          isOnline
            ? "border-emerald-500 text-emerald-300 shadow-[0_0_40px_rgba(16,185,129,0.45)]"
            : "border-red-500 text-red-400 shadow-[0_0_25px_rgba(239,68,68,0.35)]"
        }`}
        data-testid="driver-online-toggle"
      >
        <div className="text-2xl font-black">{isOnline ? "ONLINE" : "GO LIVE"}</div>
        <div className="text-[10px] mt-2 uppercase tracking-widest">
          {isOnline ? "Streaming GPS" : "Tap to dispatch"}
        </div>
      </button>

      {/* Daily goal stepper */}
      <div
        className="mt-8 flex flex-col items-center bg-black/80 p-5 rounded-3xl border border-cyan-500/30 max-w-sm w-full"
        data-testid="driver-goal-stepper"
      >
        <h3 className="text-[10px] font-bold text-cyan-500 uppercase tracking-widest mb-3">
          Set Your Shift Target
        </h3>
        <div className="flex items-center gap-6 mb-4">
          <button
            onClick={() => setDailyGoal((p) => Math.max(100, p - 100))}
            className="w-9 h-9 rounded-full border border-cyan-500 text-cyan-400 flex items-center justify-center"
            data-testid="driver-goal-decrement"
          >
            <Minus className="w-4 h-4" />
          </button>
          <div className="text-center">
            <span className="text-3xl font-black text-white font-mono">
              ₵{dailyGoal.toLocaleString()}
            </span>
            <p className="text-[9px] text-cyan-700 uppercase tracking-widest">
              Proposed Vibez
            </p>
          </div>
          <button
            onClick={() => setDailyGoal((p) => p + 100)}
            className="w-9 h-9 rounded-full border border-cyan-500 text-cyan-400 flex items-center justify-center"
            data-testid="driver-goal-increment"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <div className="w-full h-1 bg-cyan-900/40 rounded-full overflow-hidden">
          <div
            className="h-full bg-cyan-400"
            style={{ width: `${Math.min(100, (dailyEarnings / dailyGoal) * 100)}%` }}
          />
        </div>
        <p className="text-[10px] text-cyan-700 mt-2">
          Progress: ₵{dailyEarnings.toLocaleString()} / ₵{dailyGoal.toLocaleString()}
        </p>
      </div>

      {/* Footer */}
      <div className="mt-auto pt-6 flex flex-col items-center text-[10px] text-cyan-900 uppercase tracking-widest">
        <span className="flex items-center gap-2">
          <ShieldCheck className="w-3 h-3" /> Hardware Locked · Chromebook-Auth v2.6
        </span>
        <span className="mt-1 flex items-center gap-2">
          <Crosshair className="w-3 h-3" />
          {coords
            ? `${coords.lat.toFixed(4)}, ${coords.lon.toFixed(4)}`
            : "Awaiting GPS lock…"}
        </span>
        <span className="mt-1 font-mono">Driver ID: {driverIdRef.current}</span>
      </div>

      {/* Ride alert overlay */}
      {offer && (
        <div
          className="absolute inset-0 bg-black/95 flex items-center justify-center p-6 z-50"
          data-testid="driver-ride-alert"
        >
          <div className="border-2 border-cyan-400 p-8 w-full max-w-md bg-gray-900 rounded-2xl text-center shadow-[0_0_50px_rgba(0,255,255,0.4)]">
            <div className="text-[10px] uppercase tracking-[0.4em] text-fuchsia-400 mb-2">
              New Ride Alert
            </div>
            <h2 className="text-3xl font-black text-white mb-1">
              <Bolt className="inline w-7 h-7 text-yellow-400 mr-1" />
              ₵{offer.reward.toLocaleString()} Reward
            </h2>
            {offer.pickup_label && (
              <p className="text-cyan-300 mb-4 text-sm">
                Pickup: {offer.pickup_label}
              </p>
            )}
            {typeof offer.distance_km === "number" && (
              <p className="text-cyan-500 text-xs mb-4">
                Distance: {offer.distance_km.toFixed(1)} km · ETA{" "}
                {(offer.distance_km * 2).toFixed(0)} min
              </p>
            )}
            <div className="text-amber-400 font-mono text-3xl mb-5">
              {countdown}s
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => respond(true)}
                className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-black font-black py-3 rounded uppercase tracking-widest"
                data-testid="driver-ride-accept"
              >
                Accept
              </button>
              <button
                onClick={() => respond(false)}
                className="flex-1 bg-red-500 hover:bg-red-400 text-black font-black py-3 rounded uppercase tracking-widest"
                data-testid="driver-ride-decline"
              >
                Decline
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
