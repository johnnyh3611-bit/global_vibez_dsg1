/**
 * MapboxSafeMap — binds REACT_APP_MAPBOX_TOKEN without unhandled tile errors.
 * Renders a friendly empty state when the token is missing or Mapbox fails.
 */
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

const MAPBOX_TOKEN = (process.env.REACT_APP_MAPBOX_TOKEN || "").trim();

type Props = {
  className?: string;
  style?: CSSProperties;
  center?: [number, number];
  zoom?: number;
  mapStyle?: string;
  children?: (map: mapboxgl.Map) => ReactNode;
  onReady?: (map: mapboxgl.Map) => void;
  emptyLabel?: string;
};

export function mapboxTokenPresent(): boolean {
  return Boolean(MAPBOX_TOKEN);
}

export default function MapboxSafeMap({
  className,
  style,
  center = [-97.7431, 30.2672],
  zoom = 11,
  mapStyle = "mapbox://styles/mapbox/dark-v11",
  onReady,
  emptyLabel = "Map unavailable — set REACT_APP_MAPBOX_TOKEN to enable live tiles.",
}: Props) {
  const nodeRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [error, setError] = useState<string | null>(
    MAPBOX_TOKEN ? null : emptyLabel,
  );

  useEffect(() => {
    if (!MAPBOX_TOKEN || !nodeRef.current || mapRef.current) return;
    let cancelled = false;
    try {
      mapboxgl.accessToken = MAPBOX_TOKEN;
      const map = new mapboxgl.Map({
        container: nodeRef.current,
        style: mapStyle,
        center,
        zoom,
        attributionControl: true,
      });
      map.addControl(new mapboxgl.NavigationControl(), "top-right");
      map.on("error", (e) => {
        const msg =
          (e as { error?: { message?: string } })?.error?.message ||
          "Map tile error";
        // Don't crash the page — surface a quiet banner.
        if (!cancelled) setError(msg);
      });
      map.on("load", () => {
        if (cancelled) return;
        setError(null);
        onReady?.(map);
      });
      mapRef.current = map;
    } catch (err) {
      setError(err instanceof Error ? err.message : emptyLabel);
    }
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [MAPBOX_TOKEN]);

  if (!MAPBOX_TOKEN) {
    return (
      <div
        className={className}
        style={style}
        data-testid="mapbox-missing-token"
        role="status"
      >
        <div className="flex h-full min-h-[180px] items-center justify-center rounded-xl border border-white/10 bg-black/40 px-4 text-center text-sm text-white/60">
          {emptyLabel}
        </div>
      </div>
    );
  }

  return (
    <div className={className} style={style} data-testid="mapbox-safe-map">
      <div ref={nodeRef} className="h-full min-h-[180px] w-full rounded-xl overflow-hidden" />
      {error && (
        <p className="mt-2 text-xs text-amber-200/90" data-testid="mapbox-error">
          {error}
        </p>
      )}
    </div>
  );
}
