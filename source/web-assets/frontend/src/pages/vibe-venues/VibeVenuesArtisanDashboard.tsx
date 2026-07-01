/**
 * Vibe Artisan Partner Dashboard
 *
 * Spec source: Restaurant_Payment_Video_Implementation v1+v2.pdf
 *   "Locked Revenue" (escrowed bookings awaiting Vibe-Check) vs
 *   "Cleared Funds" (paid-out balances).
 *
 * Surfaces:
 *   • Header w/ artisan name + membership state pill
 *   • Big number cards: Locked Revenue · Cleared Funds · Upcoming Bookings
 *   • Booking list (grouped by lifecycle state)
 *   • Pause membership button (TODO: wire to Stripe portal)
 */
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ChefHat,
  ArrowLeft,
  Lock,
  CheckCircle2,
  Calendar,
  Clock,
  Crown,
  AlertCircle,
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL!;

type Booking = {
  booking_id: string;
  venue_name: string;
  start_at: string;
  block_hours: number;
  pricing: {
    artisan_prep_fee_usd: number;
    artisan_balance_usd: number;
    artisan_service_total_usd: number;
  };
  lifecycle_state: string;
  review?: { rating: number } | null;
};

type Artisan = {
  artisan_id: string;
  display_name: string;
  artisan_type: string;
  membership_status: string;
  completed_jobs?: number;
  average_rating?: number;
};

const LOCKED_STATES = ["pending", "escrowed", "prep_released", "in_progress", "completed"];
const CLEARED_STATES = ["paid_out"];

export default function VibeVenuesArtisanDashboard() {
  const navigate = useNavigate();
  const userId = localStorage.getItem("user_id") || "guest";
  const [artisan, setArtisan] = useState<Artisan | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        // Find this user's artisan profile + their bookings
        const [artisanRes, bookingsRes] = await Promise.all([
          fetch(`${API}/api/vibe-venues/artisans?limit=200`).then((r) => r.json()),
          fetch(`${API}/api/vibe-venues/bookings/mine/${userId}`).then((r) => r.json()),
        ]);
        const mine = (artisanRes.artisans || []).find((a: any) => a.user_id === userId);
        setArtisan(mine || null);
        setBookings(bookingsRes.bookings || []);
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  if (loading)
    return (
      <div className="min-h-screen bg-[#07030F] flex items-center justify-center text-white">
        <div className="animate-spin w-12 h-12 border-4 border-fuchsia-500 border-t-transparent rounded-full" />
      </div>
    );

  if (!artisan) {
    return (
      <div className="min-h-screen bg-[#07030F] text-white flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-8 text-center bg-[#0F0720] border border-orange-500/30">
          <ChefHat className="w-16 h-16 mx-auto mb-4 text-orange-400" />
          <h2 className="text-2xl font-black mb-2">Not yet a Vibe Artisan</h2>
          <p className="text-orange-100/80 mb-6">
            Create your $20/mo Artisan profile to access the dashboard.
          </p>
          <Button
            onClick={() => navigate("/vibe-venues/artisan")}
            className="bg-orange-500 hover:bg-orange-400 w-full"
            data-testid="vv-dash-onboard-cta"
          >
            Become a Vibe Artisan
          </Button>
        </Card>
      </div>
    );
  }

  const myBookings = bookings.filter((b) => b.pricing.artisan_service_total_usd > 0);
  const lockedRevenue = myBookings
    .filter((b) => LOCKED_STATES.includes(b.lifecycle_state))
    .reduce(
      (acc, b) =>
        acc +
        (b.lifecycle_state === "prep_released" ||
        b.lifecycle_state === "in_progress" ||
        b.lifecycle_state === "completed"
          ? b.pricing.artisan_balance_usd
          : b.pricing.artisan_service_total_usd),
      0,
    );
  const clearedFunds = myBookings
    .filter((b) => CLEARED_STATES.includes(b.lifecycle_state))
    .reduce((acc, b) => acc + b.pricing.artisan_service_total_usd, 0);
  const upcoming = myBookings.filter(
    (b) =>
      LOCKED_STATES.includes(b.lifecycle_state) &&
      new Date(b.start_at).getTime() > Date.now(),
  ).length;

  return (
    <div className="min-h-screen bg-[#07030F] text-white pb-24" data-testid="vv-artisan-dashboard">
      <div className="max-w-6xl mx-auto px-4 py-10">
        <button
          onClick={() => navigate("/vibe-venues")}
          className="flex items-center gap-2 text-purple-300/70 hover:text-white mb-6"
          data-testid="vv-dash-back-btn"
        >
          <ArrowLeft className="w-4 h-4" /> Vibe Venues
        </button>

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4 mb-8">
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-gradient-to-br from-orange-500 to-fuchsia-600 shadow-[0_0_18px_rgba(249,115,22,0.55)]">
              <ChefHat className="w-8 h-8 text-white" />
            </div>
            <div>
              <p className="text-xs font-mono uppercase tracking-[0.3em] text-orange-300/90">
                Vibe Artisan · {artisan.artisan_type}
              </p>
              <h1 className="text-3xl md:text-4xl font-black">{artisan.display_name}</h1>
            </div>
          </div>
          <MembershipPill status={artisan.membership_status} />
        </div>

        {/* KPI grid */}
        <div className="grid md:grid-cols-3 gap-4 mb-8" data-testid="vv-dash-kpis">
          <KPI
            icon={Lock}
            label="Locked Revenue"
            value={`$${lockedRevenue.toFixed(2)}`}
            sub="Held in $DSG escrow until Vibe-Check"
            tone="fuchsia"
            testid="kpi-locked"
          />
          <KPI
            icon={CheckCircle2}
            label="Cleared Funds"
            value={`$${clearedFunds.toFixed(2)}`}
            sub="Paid out lifetime"
            tone="emerald"
            testid="kpi-cleared"
          />
          <KPI
            icon={Calendar}
            label="Upcoming Bookings"
            value={String(upcoming)}
            sub="Future events on your calendar"
            tone="cyan"
            testid="kpi-upcoming"
          />
        </div>

        {/* Bookings list */}
        <div className="space-y-3" data-testid="vv-dash-bookings-list">
          <h2 className="text-2xl font-black mb-2">Your Bookings</h2>
          {myBookings.length === 0 ? (
            <Card className="p-12 text-center bg-[#0F0720] border border-orange-500/20">
              <Crown className="w-12 h-12 mx-auto mb-4 text-orange-400" />
              <h3 className="text-lg font-bold mb-2">No bookings yet</h3>
              <p className="text-orange-100/70 text-sm">
                When customers add you to a Vibe Venue booking, it'll show up
                here automatically.
              </p>
            </Card>
          ) : (
            myBookings.map((b) => (
              <Card
                key={b.booking_id}
                onClick={() => navigate(`/vibe-venues/booking/${b.booking_id}`)}
                className="p-5 bg-[#0F0720] border border-fuchsia-500/15 hover:border-fuchsia-400/50 cursor-pointer transition-all"
                data-testid={`vv-dash-booking-${b.booking_id}`}
              >
                <div className="flex items-start justify-between flex-wrap gap-3">
                  <div>
                    <p className="text-base font-black text-white">{b.venue_name}</p>
                    <div className="flex items-center gap-3 text-xs text-purple-300/70 mt-1">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />{" "}
                        {new Date(b.start_at).toLocaleString()}
                      </span>
                      <span>· {b.block_hours} hr</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-black text-white">
                      ${b.pricing.artisan_service_total_usd}
                    </p>
                    <StateChip state={b.lifecycle_state} />
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

const KPI: React.FC<{
  icon: React.ElementType;
  label: string;
  value: string;
  sub: string;
  tone: "fuchsia" | "emerald" | "cyan";
  testid?: string;
}> = ({ icon: Icon, label, value, sub, tone, testid }) => {
  const tones = {
    fuchsia: "border-fuchsia-500/40 bg-fuchsia-500/5 text-fuchsia-300",
    emerald: "border-emerald-500/40 bg-emerald-500/5 text-emerald-300",
    cyan: "border-cyan-500/40 bg-cyan-500/5 text-cyan-300",
  }[tone];
  return (
    <div className={`p-5 rounded-2xl border bg-[#0F0720] ${tones}`} data-testid={testid}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4" />
        <p className="text-xs font-mono uppercase tracking-[0.3em]">{label}</p>
      </div>
      <p className="text-3xl font-black text-white">{value}</p>
      <p className="text-[11px] text-purple-300/70 mt-1">{sub}</p>
    </div>
  );
};

const MembershipPill: React.FC<{ status: string }> = ({ status }) => {
  const map: Record<string, { label: string; cls: string; Icon: React.ElementType }> = {
    active: {
      label: "Active · $20/mo",
      cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
      Icon: CheckCircle2,
    },
    pending_payment: {
      label: "Pending Payment",
      cls: "bg-orange-500/15 text-orange-300 border-orange-500/30",
      Icon: AlertCircle,
    },
  };
  const v = map[status] || map.pending_payment;
  const Icon = v.Icon;
  return (
    <span
      className={`px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-widest border flex items-center gap-2 ${v.cls}`}
      data-testid="vv-dash-membership-pill"
    >
      <Icon className="w-3.5 h-3.5" />
      {v.label}
    </span>
  );
};

const StateChip: React.FC<{ state: string }> = ({ state }) => {
  const map: Record<string, string> = {
    pending: "bg-purple-500/15 text-purple-200",
    escrowed: "bg-fuchsia-500/15 text-fuchsia-200",
    prep_released: "bg-orange-500/15 text-orange-200",
    in_progress: "bg-cyan-500/15 text-cyan-200",
    completed: "bg-cyan-500/15 text-cyan-200",
    paid_out: "bg-emerald-500/15 text-emerald-200",
    cancelled: "bg-gray-500/15 text-gray-300",
    disputed: "bg-red-500/15 text-red-200",
  };
  return (
    <span
      className={`text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-full mt-1 inline-block ${
        map[state] ?? map.pending
      }`}
    >
      {state.replace("_", " ")}
    </span>
  );
};
