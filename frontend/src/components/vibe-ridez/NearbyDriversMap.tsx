/**
 * NearbyDriversMap — stylized geo-proximity preview for the ride booking
 * flow. Shows the rider's pin in the center + nearby AVAILABLE drivers as
 * floating dots around it, with live count + nearest distance + ETA.
 *
 * Polls /api/ridez/nearby-drivers every 8s. Coordinates returned by the
 * backend are already fuzzed to ~110m so we never expose a driver's exact
 * block on a public surface.
 *
 * Designed to give a confidence signal BEFORE the rider commits ("12
 * drivers within 4 km · nearest 1.2 km, ~3 min away").
 */
import { useEffect, useState } from "react";
import { Car, Loader2 } from "lucide-react";

interface NearbyDriver {
  lat: number;
  lon: number;
  distance_km: number;
  type: "real" | "virtual";
}

interface NearbyResponse {
  count: number;
  nearest_km: number | null;
  estimated_eta_minutes: number | null;
  radius_km: number;
  drivers: NearbyDriver[];
}

interface Props {
  lat: number | null;
  lng: number | null;
  radiusKm?: number;
  pickupLabel?: string;
}

const API = process.env.REACT_APP_BACKEND_URL;

export default function NearbyDriversMap({ lat, lng, radiusKm = 8, pickupLabel }: Props) {
  const [data, setData] = useState<NearbyResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (lat == null || lng == null) return;
    let cancelled = false;
    const fetchNearby = async () => {
      try {
        const url = `${API}/api/ridez/nearby-drivers?lat=${lat}&lon=${lng}&radius_km=${radiusKm}&limit=25`;
        const res = await fetch(url);
        if (!res.ok) {
          if (!cancelled) setData({ count: 0, nearest_km: null, estimated_eta_minutes: null, radius_km: radiusKm, drivers: [] });
          return;
        }
        const d = (await res.json()) as NearbyResponse;
        if (!cancelled) setData(d);
      } catch {
        if (!cancelled) setData({ count: 0, nearest_km: null, estimated_eta_minutes: null, radius_km: radiusKm, drivers: [] });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchNearby();
    const id = setInterval(fetchNearby, 8000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [lat, lng, radiusKm]);

  if (lat == null || lng == null) {
    return (
      <div
        className="rounded-xl border border-amber-400/15 bg-black/30 p-6 text-center text-sm text-amber-100/70"
        data-testid="nearby-drivers-map-empty"
      >
        Enable location to see drivers near you.
      </div>
    );
  }

  // Project each driver onto a 0..1 square relative to a radius_km bounding box
  const project = (drvLat: number, drvLon: number) => {
    if (!data) return { x: 0.5, y: 0.5 };
    const dx = drvLon - lng;
    const dy = drvLat - lat;
    // ~1 deg lat = 111 km; lon shrinks with cos(lat)
    const kmPerDegLon = 111 * Math.cos((lat * Math.PI) / 180) || 1;
    const xKm = dx * kmPerDegLon;
    const yKm = dy * 111;
    const r = data.radius_km || 8;
    return {
      x: 0.5 + xKm / (2 * r),
      y: 0.5 - yKm / (2 * r),
    };
  };

  return (
    <div
      className="rounded-xl overflow-hidden border border-amber-400/20 bg-gradient-to-br from-[#0a1525] via-[#0d1d33] to-[#0a1525]"
      data-testid="nearby-drivers-map"
    >
      {/* Stat header */}
      <div className="grid grid-cols-3 gap-2 px-3 py-2 bg-black/40 border-b border-white/5 text-center">
        <div data-testid="nearby-drivers-count">
          <p className="text-2xl font-black text-amber-300">
            {loading ? <Loader2 className="w-5 h-5 animate-spin inline" /> : data?.count ?? 0}
          </p>
          <p className="text-[9px] uppercase tracking-widest text-amber-100/60">Drivers near</p>
        </div>
        <div data-testid="nearby-drivers-nearest">
          <p className="text-2xl font-black text-emerald-300">
            {data?.nearest_km != null ? `${data.nearest_km.toFixed(1)} km` : "—"}
          </p>
          <p className="text-[9px] uppercase tracking-widest text-amber-100/60">Nearest</p>
        </div>
        <div data-testid="nearby-drivers-eta">
          <p className="text-2xl font-black text-fuchsia-300">
            {data?.estimated_eta_minutes != null ? `${data.estimated_eta_minutes}m` : "—"}
          </p>
          <p className="text-[9px] uppercase tracking-widest text-amber-100/60">Avg ETA</p>
        </div>
      </div>

      {/* Stylized radar map */}
      <div className="relative w-full aspect-square max-h-72 bg-[#0a1525] overflow-hidden">
        {/* Concentric range rings */}
        {[0.25, 0.5, 0.75, 1.0].map((r) => (
          <div
            key={r}
            className="absolute left-1/2 top-1/2 rounded-full border border-amber-300/10"
            style={{
              width: `${r * 90}%`,
              height: `${r * 90}%`,
              transform: "translate(-50%, -50%)",
            }}
          />
        ))}

        {/* Crosshairs */}
        <div className="absolute left-0 right-0 top-1/2 border-t border-amber-300/5" />
        <div className="absolute top-0 bottom-0 left-1/2 border-l border-amber-300/5" />

        {/* Driver dots */}
        {data?.drivers.map((drv, i) => {
          const { x, y } = project(drv.lat, drv.lon);
          if (x < 0 || x > 1 || y < 0 || y > 1) return null;
          return (
            <div
              key={i}
              className="absolute -translate-x-1/2 -translate-y-1/2 group"
              style={{ left: `${x * 100}%`, top: `${y * 100}%` }}
              data-testid={`nearby-driver-dot-${i}`}
              title={`${drv.distance_km} km away`}
            >
              <div className="absolute -inset-2 rounded-full bg-amber-400/25 animate-ping" />
              <Car className="relative w-3.5 h-3.5 text-amber-300 drop-shadow-[0_0_4px_rgba(251,191,36,0.8)]" />
            </div>
          );
        })}

        {/* Rider pin (center) */}
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
          data-testid="nearby-rider-pin"
        >
          <div className="absolute -inset-3 rounded-full bg-emerald-400/30 animate-pulse" />
          <div className="relative w-4 h-4 rounded-full bg-emerald-400 border-2 border-white shadow-lg" />
        </div>

        {/* Pickup label badge */}
        {pickupLabel && (
          <div className="absolute bottom-2 left-2 right-2 bg-black/60 backdrop-blur-sm rounded px-2 py-1 text-[10px] text-emerald-200 truncate">
            📍 {pickupLabel}
          </div>
        )}

        {/* Empty state overlay */}
        {!loading && data && data.count === 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <p className="text-sm text-amber-100/70 text-center px-4">
              No drivers within {data.radius_km} km.<br />
              <span className="text-xs text-amber-100/50">Try expanding the radius or check back shortly.</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
