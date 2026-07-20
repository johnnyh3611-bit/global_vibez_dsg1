/**
 * Sponsored Vibez Spots carousel — premium venue / streamer visibility.
 * Feeds from GET /api/venue-sponsorship/carousel.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, Sparkles, Gift } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

export type SponsoredSpot = {
  spot_id: string;
  venue_name: string;
  tier_id?: string;
  tier_label?: string;
  city?: string | null;
  perk_title?: string;
  perk_description?: string;
  exclusive_offer?: string | null;
  category?: string;
  is_demo?: boolean;
};

type Props = {
  limit?: number;
  className?: string;
  compact?: boolean;
};

export default function SponsoredSpotsCarousel({
  limit = 6,
  className = "",
  compact = false,
}: Props) {
  const navigate = useNavigate();
  const [spots, setSpots] = useState<SponsoredSpot[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `${API}/api/venue-sponsorship/carousel?limit=${limit}`,
        );
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setSpots(data.spots || []);
      } catch {
        /* carousel is non-blocking */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [limit]);

  if (spots.length === 0) return null;

  return (
    <div
      className={className}
      data-testid="sponsored-spots-carousel"
    >
      <div className="flex items-center justify-between mb-2 gap-2">
        <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-fuchsia-300">
          Sponsored Vibez Spots
        </span>
        <button
          type="button"
          onClick={() => navigate("/vibe-spots")}
          className="text-[11px] text-fuchsia-200/70 hover:text-white underline"
          data-testid="sponsored-spots-see-all"
        >
          See all
        </button>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1">
        {spots.map((s, idx) => (
          <button
            key={s.spot_id}
            type="button"
            data-testid={`sponsored-spot-${s.spot_id}`}
            onClick={() => navigate(`/vibe-spots?spot=${s.spot_id}`)}
            className={`shrink-0 text-left rounded-xl border border-fuchsia-500/30 bg-gradient-to-br from-[#1a0a24] via-[#0f0720] to-[#120818] hover:border-fuchsia-400/60 transition-all ${
              compact ? "w-56 px-3 py-2.5" : "w-64 px-4 py-3"
            }`}
            style={{ animationDelay: `${idx * 40}ms` }}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] uppercase tracking-widest text-amber-200/90">
                {s.tier_label || s.tier_id || "Partner"}
                {s.is_demo ? " · demo" : ""}
              </span>
              <Sparkles className="w-3.5 h-3.5 text-fuchsia-300" />
            </div>
            <p className="font-bold text-sm text-white truncate flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-fuchsia-300 shrink-0" />
              {s.venue_name}
            </p>
            {s.city && (
              <p className="text-[11px] text-purple-200/60 mt-0.5">{s.city}</p>
            )}
            {(s.exclusive_offer || s.perk_title) && (
              <p className="mt-2 text-[11px] text-emerald-200/90 flex items-start gap-1.5 leading-snug">
                <Gift className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span className="line-clamp-2">
                  {s.exclusive_offer || s.perk_title}
                </span>
              </p>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
