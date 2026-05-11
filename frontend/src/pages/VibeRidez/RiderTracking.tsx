/**
 * RiderTracking — passenger-side live map for VibeRidez Real-Time Dispatch.
 *
 * Flow:
 *   1. User picks pickup (or hits "Use my location") + chooses ₵ reward.
 *   2. POST /api/ridez/request → backend cascades through 3 nearest drivers.
 *   3. On MATCHED, we drop a cyan driver pin on the Mapbox map and poll
 *      /api/ridez/driver-location/{driver_id} every 2s so the marker
 *      glides in toward the pickup.
 *   4. Status pill updates live (SEARCHING / MATCHED / NO_DRIVERS).
 */
import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { motion } from "framer-motion";
import { Crosshair, Bolt, Loader2, Car, MapPin, X, History, Star, Check } from "lucide-react";
import { authFetch, getUserId } from "@/utils/secureAuth";
import VibeDriveTipControls from "@/components/vibe-drive/VibeDriveTipControls";
import PushNotificationsPrompt from "@/components/notifications/PushNotificationsPrompt";

const API = process.env.REACT_APP_BACKEND_URL;
const MAPBOX_TOKEN = process.env.REACT_APP_MAPBOX_TOKEN;

type DispatchResult = {
  status: "MATCHED" | "SEARCHING" | "NO_DRIVERS";
  ride_id?: string;
  driver_id?: string;
  distance_km?: number;
  eta_minutes?: number;
  reward?: number;
  driver_lat?: number;
  driver_lon?: number;
  message?: string;
};

type RecentRide = {
  ride_id: string;
  driver_id: string;
  distance_km: number;
  eta_minutes: number;
  reward: number;
  status: string;
  matched_at: string;
  pickup_label?: string;
  rating?: number;
};

export default function RiderTracking() {
  const mapNode = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const riderMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const driverMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const pollRef = useRef<number | null>(null);

  const [pickup, setPickup] = useState<{ lat: number; lon: number } | null>(null);
  const [reward, setReward] = useState<number>(75);
  const [requesting, setRequesting] = useState(false);
  const [match, setMatch] = useState<DispatchResult | null>(null);
  const [statusMsg, setStatusMsg] = useState<string>("Tap “Use my location” to begin.");

  // Init map once
  useEffect(() => {
    if (!mapNode.current || mapRef.current || !MAPBOX_TOKEN) return;
    mapboxgl.accessToken = MAPBOX_TOKEN;
    const m = new mapboxgl.Map({
      container: mapNode.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [-74.006, 40.7128], // NYC default
      zoom: 11,
    });
    m.addControl(new mapboxgl.NavigationControl(), "top-right");
    mapRef.current = m;
    return () => {
      m.remove();
      mapRef.current = null;
    };
  }, []);

  // Lock to user GPS
  const useMyLocation = () => {
    if (!("geolocation" in navigator)) {
      setStatusMsg("Geolocation not supported in this browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        setPickup({ lat, lon });
        setStatusMsg("Pickup locked. Set your reward and request a Vibe Ridez.");
        const m = mapRef.current;
        if (m) {
          m.flyTo({ center: [lon, lat], zoom: 14 });
          if (riderMarkerRef.current) riderMarkerRef.current.remove();
          riderMarkerRef.current = new mapboxgl.Marker({ color: "#f43f5e" })
            .setLngLat([lon, lat])
            .setPopup(new mapboxgl.Popup().setHTML("<strong>Pickup</strong>"))
            .addTo(m);
        }
      },
      () => setStatusMsg("Location permission denied."),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  const requestRide = async () => {
    if (!pickup) return;
    setRequesting(true);
    setMatch(null);
    setStatusMsg("Searching for nearest Vibe Ridez…");
    try {
      // Prefer the authenticated user's id so this ride shows up in their
      // history; fall back to the anonymous local id otherwise.
      const riderId =
        getUserId() ||
        localStorage.getItem("vibe_rider_id") ||
        `rdr_${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem("vibe_rider_id", riderId);

      const res = await fetch(`${API}/api/ridez/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rider_id: riderId,
          rider_lat: pickup.lat,
          rider_lon: pickup.lon,
          ride_type: "any",
          reward,
          max_radius_km: 15,
          timeout_per_driver: 15,
        }),
      });
      const data = (await res.json()) as DispatchResult;
      setMatch(data);
      if (data.status === "MATCHED") {
        setStatusMsg(`Matched · ETA ${data.eta_minutes} min · ₵${data.reward} reward`);
      } else if (data.status === "NO_DRIVERS") {
        setStatusMsg("No Vibe Ridez nearby. Try again in a moment.");
      } else {
        setStatusMsg(data.message || "All nearby drivers declined. Retry shortly.");
      }
    } catch {
      setStatusMsg("Network error contacting dispatch.");
    } finally {
      setRequesting(false);
    }
  };

  // ───────── recent rides + complete flow ─────────

  const [recent, setRecent] = useState<RecentRide[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [rating, setRating] = useState<number | null>(null);

  const fetchHistory = async () => {
    try {
      const r = await authFetch(`${API}/api/ridez/my-history?limit=10`);
      if (!r.ok) return;
      const d = await r.json();
      setRecent(d.rides || []);
    } catch {
      /* anon — no history */
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const completeRide = async () => {
    if (!match?.ride_id) return;
    setCompleting(true);
    try {
      const r = await authFetch(`${API}/api/ridez/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ride_id: match.ride_id, rated: rating }),
      });
      if (r.ok) {
        setStatusMsg("Ride complete. Driver paid out. ⭐");
        setMatch(null);
        setRating(null);
        if (driverMarkerRef.current) {
          driverMarkerRef.current.remove();
          driverMarkerRef.current = null;
        }
        if (pollRef.current !== null) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
        await fetchHistory();
      }
    } finally {
      setCompleting(false);
    }
  };

  // When matched: drop driver marker + start polling driver location
  useEffect(() => {
    if (!match || match.status !== "MATCHED" || !match.driver_id) return;
    const m = mapRef.current;
    if (!m) return;

    // Initial driver marker pinned at the lat/lon returned by the dispatcher.
    if (typeof match.driver_lat === "number" && typeof match.driver_lon === "number") {
      if (driverMarkerRef.current) driverMarkerRef.current.remove();
      driverMarkerRef.current = new mapboxgl.Marker({ color: "#22d3ee" })
        .setLngLat([match.driver_lon, match.driver_lat])
        .setPopup(new mapboxgl.Popup().setHTML(`<strong>Driver</strong><br/>${match.driver_id}`))
        .addTo(m);
      m.fitBounds(
        [
          [Math.min(match.driver_lon, pickup!.lon), Math.min(match.driver_lat, pickup!.lat)],
          [Math.max(match.driver_lon, pickup!.lon), Math.max(match.driver_lat, pickup!.lat)],
        ],
        { padding: 80, maxZoom: 15 },
      );
    }

    const tick = async () => {
      try {
        const r = await fetch(`${API}/api/ridez/driver-location/${match.driver_id}`);
        if (!r.ok) return;
        const d = await r.json();
        if (typeof d.lat !== "number" || typeof d.lon !== "number") return;
        if (driverMarkerRef.current) {
          driverMarkerRef.current.setLngLat([d.lon, d.lat]);
        } else if (mapRef.current) {
          driverMarkerRef.current = new mapboxgl.Marker({ color: "#22d3ee" })
            .setLngLat([d.lon, d.lat])
            .addTo(mapRef.current);
        }
      } catch {
        /* ignore */
      }
    };
    tick();
    pollRef.current = window.setInterval(tick, 2000);
    return () => {
      if (pollRef.current !== null) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [match, pickup]);

  const cancel = () => {
    setMatch(null);
    setStatusMsg("Request cancelled. Pickup is still locked — request again whenever.");
    if (driverMarkerRef.current) {
      driverMarkerRef.current.remove();
      driverMarkerRef.current = null;
    }
    if (pollRef.current !== null) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  return (
    <div
      className="min-h-screen bg-black text-cyan-300 font-mono relative overflow-hidden"
      data-testid="rider-tracking-root"
    >
      {/* Map */}
      <div ref={mapNode} className="absolute inset-0" data-testid="rider-tracking-map" />

      {/* Top control card */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="absolute top-4 left-4 right-4 sm:left-6 sm:right-auto sm:w-[360px] z-10 bg-black/80 border border-cyan-500/40 rounded-2xl p-4 backdrop-blur-md shadow-[0_0_30px_rgba(0,255,255,0.25)]"
      >
        <h1 className="text-sm font-bold tracking-[0.3em] uppercase text-cyan-300">
          <Car className="w-4 h-4 inline -mt-1 mr-2" /> Vibe Ridez · Tracking
        </h1>
        <p className="text-[11px] text-cyan-500/80 mt-2" data-testid="rider-tracking-status">
          {statusMsg}
        </p>

        <div className="mt-3">
          <PushNotificationsPrompt context="ride status" />
        </div>

        {!pickup && (
          <button
            onClick={useMyLocation}
            className="mt-3 w-full bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/50 rounded-full py-2 text-xs uppercase tracking-widest flex items-center justify-center gap-2"
            data-testid="rider-tracking-locate"
          >
            <Crosshair className="w-3.5 h-3.5" /> Use my location
          </button>
        )}

        {pickup && !match?.driver_id && (
          <div className="mt-3 space-y-3">
            <div className="flex items-center justify-between text-[11px]">
              <span className="opacity-70 flex items-center gap-1">
                <MapPin className="w-3 h-3" /> Pickup
              </span>
              <span className="font-mono">
                {pickup.lat.toFixed(4)}, {pickup.lon.toFixed(4)}
              </span>
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-widest text-cyan-500/80">
                ₵ Reward Offered
              </label>
              <div className="flex items-center gap-2 mt-1">
                <button
                  onClick={() => setReward((r) => Math.max(25, r - 25))}
                  className="w-7 h-7 rounded-full border border-cyan-500/50 text-cyan-300"
                  data-testid="rider-tracking-reward-down"
                >
                  −
                </button>
                <div className="flex-1 text-center text-2xl font-black text-white">
                  ₵{reward}
                </div>
                <button
                  onClick={() => setReward((r) => r + 25)}
                  className="w-7 h-7 rounded-full border border-cyan-500/50 text-cyan-300"
                  data-testid="rider-tracking-reward-up"
                >
                  +
                </button>
              </div>
            </div>

            <button
              onClick={requestRide}
              disabled={requesting}
              className="w-full bg-gradient-to-r from-fuchsia-500 to-cyan-400 text-black font-black uppercase tracking-widest text-xs py-2.5 rounded-full disabled:opacity-50 flex items-center justify-center gap-2"
              data-testid="rider-tracking-request"
            >
              {requesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bolt className="w-4 h-4" />}
              {requesting ? "Dispatching…" : "Request Vibe Ridez"}
            </button>
          </div>
        )}

        {match?.status === "MATCHED" && (
          <div
            className="mt-3 border border-emerald-500/40 bg-emerald-900/20 rounded-xl p-3"
            data-testid="rider-tracking-match-card"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-emerald-400">Matched</p>
                <p className="text-sm font-bold text-white mt-0.5">{match.driver_id}</p>
                <p className="text-[11px] text-emerald-200/80 mt-1">
                  ETA {match.eta_minutes} min · {match.distance_km?.toFixed(1)} km · ₵
                  {match.reward}
                </p>
              </div>
              <button
                onClick={cancel}
                className="text-red-300 hover:text-red-200"
                data-testid="rider-tracking-cancel"
                title="Cancel"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Rating + complete */}
            <div className="mt-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1" data-testid="rider-tracking-rating">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    onClick={() => setRating(n)}
                    className={`p-1 ${
                      (rating || 0) >= n ? "text-amber-300" : "text-cyan-700 hover:text-amber-200"
                    }`}
                    data-testid={`rider-tracking-star-${n}`}
                    aria-label={`Rate ${n}`}
                  >
                    <Star
                      className="w-4 h-4"
                      fill={(rating || 0) >= n ? "currentColor" : "none"}
                    />
                  </button>
                ))}
              </div>
              <button
                onClick={completeRide}
                disabled={completing}
                className="px-3 py-1.5 rounded-full bg-emerald-500 text-black text-[10px] uppercase tracking-widest font-bold disabled:opacity-50 flex items-center gap-1"
                data-testid="rider-tracking-complete"
              >
                <Check className="w-3 h-3" />
                {completing ? "Completing…" : "Complete Ride"}
              </button>
            </div>
          </div>
        )}

        {/* Recent rides accordion */}
        {recent.length > 0 && (
          <div
            className="mt-4 border-t border-cyan-500/20 pt-3"
            data-testid="rider-tracking-history"
          >
            <button
              onClick={() => setShowHistory((s) => !s)}
              className="w-full flex items-center justify-between text-[10px] uppercase tracking-widest text-cyan-400/80 hover:text-cyan-200"
              data-testid="rider-tracking-history-toggle"
            >
              <span className="flex items-center gap-2">
                <History className="w-3 h-3" /> Recent rides ({recent.length})
              </span>
              <span>{showHistory ? "−" : "+"}</span>
            </button>
            {showHistory && (
              <ul className="mt-2 space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {recent.map((r) => (
                  <li
                    key={r.ride_id}
                    className="text-[10px] text-cyan-300/80 bg-black/40 rounded px-2 py-1.5 flex items-center justify-between"
                    data-testid={`rider-tracking-history-row-${r.ride_id}`}
                  >
                    <span className="truncate max-w-[150px]">
                      {new Date(r.matched_at).toLocaleDateString()} · {r.distance_km.toFixed(1)} km
                    </span>
                    <span className="text-amber-300 font-mono">₵{r.reward}</span>
                    <span
                      className={`uppercase ${
                        r.status === "completed" ? "text-emerald-400" : "text-cyan-500"
                      }`}
                    >
                      {r.status === "completed" ? "Done" : "Active"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}
