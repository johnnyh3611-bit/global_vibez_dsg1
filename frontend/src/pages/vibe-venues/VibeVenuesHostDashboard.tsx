/**
 * Vibe Venues — Host Dashboard.
 *
 * 2026-05-12 founder ask: "for the people that have the Airbnbs or the
 * Vibrants, their dashboards also made."
 *
 * The existing /vibe-venues/host route is a one-time LISTING form. This
 * page is the RECURRING management dashboard a host returns to:
 *   - Properties tab: every venue I've listed, with cover photo + price
 *   - Bookings tab: incoming bookings across all my properties (state pill,
 *     deep-link to existing /vibe-venues/booking/:id for chat + actions)
 *   - Earnings tile: escrowed / released / paid-out USD + venue count
 *
 * Talks ONLY to the new read-only endpoints under /api/vibe-venues/host/*.
 * All write actions (release prep, vibe-check) happen on the existing
 * booking-detail page so we don't duplicate logic.
 */
import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Home,
  Calendar,
  Wallet,
  ExternalLink,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { authFetch } from "@/utils/secureAuth";
import StripeConnectButton from "@/components/payout/StripeConnectButton";

const API = process.env.REACT_APP_BACKEND_URL;

type TabKey = "venues" | "bookings";

interface Venue {
  venue_id: string;
  name: string;
  description?: string;
  city?: string;
  zip_code?: string;
  base_hourly_rate_usd: number;
  cover_photo?: string;
  capacity?: number;
  created_at?: string;
}

interface Booking {
  booking_id: string;
  venue_id: string;
  venue_name?: string;
  customer_user_id: string;
  artisan_user_id?: string | null;
  block_hours: number;
  state: string;
  pricing?: { grand_total?: number; host_payout?: number };
  start_at?: string;
  created_at?: string;
}

interface EarningsSummary {
  escrowed_usd: number;
  released_usd: number;
  paid_out_usd: number;
  active_count: number;
  all_time_count: number;
  venue_count: number;
  platform_fee_pct: number;
  prep_fee_pct: number;
}

const STATE_TINT: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-300 border-amber-400/40",
  escrowed: "bg-cyan-500/15 text-cyan-300 border-cyan-400/40",
  prep_released: "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-400/40",
  in_progress: "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-400/40",
  completed: "bg-emerald-500/15 text-emerald-300 border-emerald-400/40",
  paid_out: "bg-emerald-500/15 text-emerald-300 border-emerald-400/40",
  cancelled: "bg-rose-500/15 text-rose-300 border-rose-400/40",
  disputed: "bg-rose-500/15 text-rose-300 border-rose-400/40",
};

export default function VibeVenuesHostDashboard() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabKey>("venues");
  const [venues, setVenues] = useState<Venue[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [earnings, setEarnings] = useState<EarningsSummary | null>(null);
  const [loading, setLoading] = useState(true);

  // The host's user_id is resolved from the existing session helper that
  // every other page uses. We pull it out of localStorage to stay
  // consistent with how /vibe-venues/host writes its onboarding payload.
  const userId = useMemo(
    () => localStorage.getItem("user_id") || "guest",
    [],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [vRes, bRes, eRes] = await Promise.all([
        authFetch(`${API}/api/vibe-venues/host/venues/${userId}`),
        authFetch(`${API}/api/vibe-venues/host/bookings/${userId}`),
        authFetch(`${API}/api/vibe-venues/host/earnings/${userId}`),
      ]);
      if (vRes.ok) {
        const d = await vRes.json();
        setVenues(d.venues || []);
      }
      if (bRes.ok) {
        const d = await bRes.json();
        setBookings(d.bookings || []);
      }
      if (eRes.ok) {
        const d = await eRes.json();
        setEarnings(d);
      }
    } catch {
      toast.error("Could not load your host dashboard");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-[#0a0815] via-[#170a23] to-[#0d061a] text-white px-4 py-6 md:px-8"
      data-testid="vibe-venues-host-dashboard"
    >
      <div className="max-w-5xl mx-auto">
        <button
          type="button"
          onClick={() => navigate("/dashboard")}
          className="flex items-center gap-1 text-fuchsia-200/70 hover:text-white text-sm mb-4"
          data-testid="vvhd-back"
        >
          <ArrowLeft className="w-4 h-4" /> Dashboard
        </button>

        <div className="flex items-end justify-between mb-6 flex-wrap gap-3">
          <div>
            <p className="text-fuchsia-200/70 uppercase tracking-[0.3em] text-xs font-bold">
              Vibe Venues · Host
            </p>
            <h1 className="text-3xl md:text-4xl font-black mt-1">
              Your Properties &amp; Bookings
            </h1>
          </div>
          <button
            type="button"
            onClick={() => navigate("/vibe-venues/host")}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-fuchsia-500 hover:bg-fuchsia-400 text-white text-sm font-bold transition-colors"
            data-testid="vvhd-list-new"
          >
            <Plus className="w-4 h-4" /> List a new property
          </button>
          {/* 2026-05-12 backlog #11: Stripe Connect Express — host gets
              auto-deposit to their bank instead of manual payout approval.
              Auto-shows "available after launch" until live keys are in. */}
          <StripeConnectButton role="host" variant="compact" />
        </div>

        {/* Test Booking — drops a synthetic 6h booking onto the host's newest
            venue so a brand-new host can practice the escrow loop without
            needing a real customer to lock USDC via Solflare. Only renders
            once the host has at least one property. */}
        {venues.length > 0 && (
          <div className="mb-4 flex justify-end">
            <button
              type="button"
              onClick={async () => {
                const res = await authFetch(
                  `${API}/api/vibe-venues/host/test-booking/${userId}`,
                  { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" },
                );
                if (!res.ok) {
                  const err = await res.json().catch(() => ({}));
                  toast.error(err.detail || "Could not drop test booking");
                  return;
                }
                toast.success("Test booking dropped — open it to walk the escrow loop");
                await load();
                setTab("bookings");
              }}
              data-testid="vvhd-drop-test-booking"
              className="text-[10px] uppercase tracking-widest font-bold bg-fuchsia-400/15 text-fuchsia-200 hover:bg-fuchsia-400 hover:text-white border border-fuchsia-400/40 px-3 py-1 rounded-full transition-colors"
            >
              + Drop test booking
            </button>
          </div>
        )}

        {/* Earnings summary tiles */}
        <div
          className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6"
          data-testid="vvhd-earnings"
        >
          <EarningsTile
            label="Escrowed"
            value={earnings ? `$${earnings.escrowed_usd.toFixed(2)}` : "—"}
            sub="Locked until prep_released"
            tint="text-cyan-300"
          />
          <EarningsTile
            label="Released"
            value={earnings ? `$${earnings.released_usd.toFixed(2)}` : "—"}
            sub="In-flight bookings"
            tint="text-fuchsia-300"
          />
          <EarningsTile
            label="Paid out"
            value={earnings ? `$${earnings.paid_out_usd.toFixed(2)}` : "—"}
            sub="Lifetime settled"
            tint="text-emerald-300"
          />
          <EarningsTile
            label="Properties"
            value={String(earnings?.venue_count ?? venues.length)}
            sub={`${earnings?.active_count ?? 0} active bookings`}
            tint="text-amber-300"
          />
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-5" data-testid="vvhd-tabs">
          <TabPill
            active={tab === "venues"}
            onClick={() => setTab("venues")}
            icon={<Home className="w-4 h-4" />}
            label={`My properties · ${venues.length}`}
            testId="vvhd-tab-venues"
          />
          <TabPill
            active={tab === "bookings"}
            onClick={() => setTab("bookings")}
            icon={<Calendar className="w-4 h-4" />}
            label={`Bookings · ${bookings.length}`}
            testId="vvhd-tab-bookings"
          />
        </div>

        {loading ? (
          <p className="text-fuchsia-200/60 text-sm py-12 text-center">Loading…</p>
        ) : tab === "venues" ? (
          <VenuesPanel venues={venues} navigate={navigate} />
        ) : (
          <BookingsPanel bookings={bookings} navigate={navigate} />
        )}
      </div>
    </div>
  );
}

function EarningsTile({
  label,
  value,
  sub,
  tint,
}: {
  label: string;
  value: string;
  sub: string;
  tint: string;
}) {
  return (
    <div
      className="rounded-2xl border border-white/10 bg-black/30 backdrop-blur-md p-4"
      data-testid={`vvhd-tile-${label.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <p className="text-[10px] uppercase tracking-widest text-fuchsia-200/60 mb-1">
        {label}
      </p>
      <p className={`text-2xl font-black ${tint}`}>{value}</p>
      <p className="text-[10px] text-white/40 mt-1">{sub}</p>
    </div>
  );
}

function TabPill({
  active,
  onClick,
  icon,
  label,
  testId,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  testId: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest transition-colors ${
        active
          ? "bg-fuchsia-500 text-white"
          : "bg-black/30 text-fuchsia-200/70 border border-white/10 hover:text-white"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function VenuesPanel({
  venues,
  navigate,
}: {
  venues: Venue[];
  navigate: ReturnType<typeof useNavigate>;
}) {
  if (venues.length === 0) {
    return (
      <div
        className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-10 text-center"
        data-testid="vvhd-venues-empty"
      >
        <Home className="w-8 h-8 mx-auto text-fuchsia-300 mb-3" />
        <p className="text-fuchsia-100/80 mb-4">
          You haven't listed any properties yet.
        </p>
        <button
          type="button"
          onClick={() => navigate("/vibe-venues/host")}
          className="px-5 py-2 rounded-full bg-fuchsia-500 hover:bg-fuchsia-400 text-white text-sm font-bold"
          data-testid="vvhd-empty-cta"
        >
          List your first property
        </button>
      </div>
    );
  }
  return (
    <div className="grid md:grid-cols-2 gap-4" data-testid="vvhd-venues-list">
      {venues.map((v) => (
        <button
          key={v.venue_id}
          type="button"
          onClick={() => navigate(`/vibe-venues/${v.venue_id}`)}
          className="text-left rounded-2xl overflow-hidden border border-white/10 bg-black/40 backdrop-blur-md hover:border-fuchsia-400/50 transition-colors group"
          data-testid={`vvhd-venue-${v.venue_id}`}
        >
          <div className="aspect-video bg-gradient-to-br from-fuchsia-900/40 via-purple-900/40 to-indigo-900/40 relative overflow-hidden">
            {v.cover_photo && (
              <img
                src={v.cover_photo}
                alt={v.name}
                className="absolute inset-0 w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
              />
            )}
            <div className="absolute bottom-2 right-2 px-2 py-1 rounded-full bg-black/70 text-amber-200 text-xs font-bold">
              ${v.base_hourly_rate_usd.toFixed(0)}/hr
            </div>
          </div>
          <div className="p-4">
            <h3 className="font-bold text-lg">{v.name}</h3>
            <p className="text-xs text-fuchsia-100/60 mt-1 truncate">
              {[v.city, v.zip_code].filter(Boolean).join(" · ") || "—"}
              {v.capacity ? ` · sleeps ${v.capacity}` : ""}
            </p>
          </div>
        </button>
      ))}
    </div>
  );
}

function BookingsPanel({
  bookings,
  navigate,
}: {
  bookings: Booking[];
  navigate: ReturnType<typeof useNavigate>;
}) {
  if (bookings.length === 0) {
    return (
      <div
        className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-10 text-center"
        data-testid="vvhd-bookings-empty"
      >
        <Wallet className="w-8 h-8 mx-auto text-fuchsia-300 mb-3" />
        <p className="text-fuchsia-100/80">
          No bookings yet — once a guest books one of your properties, it'll
          show up here in real time.
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-3" data-testid="vvhd-bookings-list">
      {bookings.map((b) => {
        const tint = STATE_TINT[b.state] || STATE_TINT.pending;
        return (
          <button
            key={b.booking_id}
            type="button"
            onClick={() => navigate(`/vibe-venues/booking/${b.booking_id}`)}
            className="w-full text-left rounded-2xl border border-white/10 bg-black/40 backdrop-blur-md p-4 hover:border-fuchsia-400/50 transition-colors"
            data-testid={`vvhd-booking-${b.booking_id}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span
                    className={`text-[10px] uppercase tracking-widest font-bold border px-2 py-0.5 rounded-full ${tint}`}
                  >
                    {b.state}
                  </span>
                  <span className="text-amber-100 font-bold">
                    ${(b.pricing?.host_payout ?? 0).toFixed(2)} payout
                  </span>
                  <span className="text-fuchsia-200/70 text-xs">
                    · {b.block_hours}h block
                  </span>
                </div>
                <p className="text-sm font-semibold truncate">
                  {b.venue_name || "Property"}
                </p>
                <p className="text-xs text-fuchsia-100/50 truncate">
                  Booking {b.booking_id.slice(0, 8)}
                  {b.start_at
                    ? ` · ${new Date(b.start_at).toLocaleString([], {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}`
                    : ""}
                </p>
              </div>
              <ExternalLink className="w-4 h-4 text-fuchsia-300/60 shrink-0" />
            </div>
          </button>
        );
      })}
    </div>
  );
}
