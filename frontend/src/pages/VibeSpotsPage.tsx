/**
 * VibeSpotsPage — landing page for the Vibez Spots booking flow.
 *
 * Backend routes already exist (`/api/vibe-spots/book|cancel|complete|mine`)
 * but no frontend was wired. This page surfaces the user's active +
 * historical bookings via `/vibe-spots/mine` and explains what Vibez Spots
 * is.
 *
 * Route: /vibe-spots
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, MapPin, Sparkles, Calendar, Loader2 } from "lucide-react";
import { authFetch } from "@/utils/secureAuth";

const API = process.env.REACT_APP_BACKEND_URL;

interface VibeSpotBooking {
  booking_id: string;
  spot_id: string;
  spot_name?: string;
  starts_at?: string;
  ends_at?: string;
  status: string;
}

export default function VibeSpotsPage() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<VibeSpotBooking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await authFetch(`${API}/api/vibe-spots/mine`);
        if (res.ok && !cancelled) {
          const d = await res.json();
          setBookings(d.bookings || d.items || []);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-[#07030F] via-[#0a0815] to-[#170a23] text-white px-4 py-8"
      data-testid="vibe-spots-page"
    >
      <div className="max-w-3xl mx-auto">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-purple-300/70 hover:text-white text-sm mb-4"
          data-testid="vibe-spots-back"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-fuchsia-600 shadow-[0_0_20px_rgba(217,70,239,0.45)] flex items-center justify-center">
            <MapPin className="w-7 h-7 text-white" />
          </div>
          <div>
            <p className="text-xs font-mono uppercase tracking-[0.3em] text-fuchsia-400/80">
              Real-world hot spots
            </p>
            <h1 className="text-3xl md:text-4xl font-black">Vibez Spots</h1>
          </div>
        </div>
        <p className="text-sm text-purple-200/80 mb-6 max-w-xl">
          Scan a Vibez Spot QR code at participating venues to earn double
          coins, unlock exclusive drops, and book private experiences.
        </p>

        {/* Bookings list */}
        <div
          className="rounded-2xl border border-fuchsia-500/20 bg-[#0F0720] p-5"
          data-testid="vibe-spots-bookings"
        >
          <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-fuchsia-300/85 mb-3">
            Your Bookings
          </p>
          {loading ? (
            <div className="flex items-center justify-center py-8 text-purple-300/70">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
            </div>
          ) : bookings.length === 0 ? (
            <div className="text-center py-8 text-sm text-purple-300/70" data-testid="vibe-spots-empty">
              <Sparkles className="w-6 h-6 mx-auto mb-2 text-fuchsia-300" />
              No bookings yet. Scan a Vibez Spot QR code at a participating venue to get started.
            </div>
          ) : (
            <ul className="space-y-2" data-testid="vibe-spots-bookings-list">
              {bookings.map((b) => (
                <li
                  key={b.booking_id}
                  className="flex items-center gap-3 p-3 rounded-xl bg-black/30 border border-fuchsia-500/15"
                  data-testid={`vibe-spots-booking-${b.booking_id}`}
                >
                  <Calendar className="w-4 h-4 text-fuchsia-300 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-fuchsia-100 truncate">
                      {b.spot_name || b.spot_id}
                    </p>
                    <p className="text-[11px] text-purple-300/70">
                      {b.starts_at ? b.starts_at.slice(0, 16) : "Schedule pending"} · {b.status}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
