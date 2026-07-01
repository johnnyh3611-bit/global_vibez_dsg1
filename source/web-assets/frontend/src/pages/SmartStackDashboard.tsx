/**
 * SmartStack Driver Dashboard.
 *
 * Implements both PDFs:
 *   • GlobalVibez_Driver_SmartStack_Dashboard.pdf — driver-side panel
 *   • GlobalVibez_Smart_Logistics_Stacking.pdf  — algorithm view
 *
 * Three sections:
 *   1. Active-Ride strip — pickup / dropoff / payout. "Start Demo Ride"
 *      seeds a ride if none exists so testers can see the alert flow.
 *   2. **SMART STACK DETECTED!** overlay (only when best_offer exists)
 *      — added_distance_mi, added_minutes, added_profit_usd, profit_boost.
 *      Buttons: ACCEPT_BOTH, DISMISS.
 *   3. Stacking Stats + History strip — total stacks accepted, total
 *      bonus profit, last 25 acceptances.
 *
 * Polls /smartstack/driver/dashboard every 8s.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Bot,
  Car,
  CheckCircle2,
  Clock,
  DollarSign,
  Loader2,
  MapPin,
  PackageCheck,
  Sparkles,
  TrendingUp,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { authFetch } from "@/utils/secureAuth";

const API = process.env.REACT_APP_BACKEND_URL;
const POLL_MS = 8000;

interface GeoPoint { lat: number; lng: number }
interface ActiveRide {
  ride_id: string;
  pickup: GeoPoint;
  dropoff: GeoPoint;
  ride_payout_usd: number;
  started_at: string;
}
interface SmartStackOffer {
  offer_id: string;
  order_id: string;
  added_distance_mi: number;
  added_minutes: number;
  added_profit_usd: number;
  profit_boost: number;
  ride_payout_usd: number;
  food_payout_usd: number;
  pickup_at: GeoPoint;
  deliver_to: GeoPoint;
  expires_at: string;
}
interface AcceptedStack {
  acceptance_id: string;
  ride_id: string;
  order_id: string;
  added_profit_usd: number;
  added_distance_mi: number;
  added_minutes: number;
  profit_boost: number;
  accepted_at: string;
}
interface DashboardData {
  active_ride: ActiveRide | null;
  best_offer: SmartStackOffer | null;
  available_order_count: number;
  history: AcceptedStack[];
  stats: {
    stacks_accepted: number;
    total_added_profit_usd: number;
    max_detour_mi: number;
    min_profit_boost: number;
  };
}

// Demo seed coordinates — Times Sq → Brooklyn Bridge route. Used by
// the "Start Demo Ride" button so testers can see the alert overlay.
const DEMO_RIDE = {
  pickup: { lat: 40.758, lng: -73.9855 },
  dropoff: { lat: 40.7061, lng: -73.9969 },
  ride_payout_usd: 8.0,
};
const DEMO_ORDER = {
  merchant_id: "demo_merchant_smartstack",
  pickup_at: { lat: 40.7506, lng: -73.9939 },     // Penn
  deliver_to: { lat: 40.7527, lng: -73.9772 },    // Grand Central
  food_payout_usd: 14.0,
};

export default function SmartStackDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [busy, setBusy] = useState(false);
  const [seenOfferIds] = useState(() => new Set<string>());
  const overlayShownRef = useRef<string | null>(null);
  const [overlayOffer, setOverlayOffer] = useState<SmartStackOffer | null>(null);

  const load = useCallback(async () => {
    const res = await authFetch(`${API}/api/smartstack/driver/dashboard`);
    if (!res.ok) return;
    const next = (await res.json()) as DashboardData;
    setData(next);
    // Surface the alert overlay on first detection of a new offer.
    if (next.best_offer && !seenOfferIds.has(next.best_offer.offer_id)) {
      seenOfferIds.add(next.best_offer.offer_id);
      overlayShownRef.current = next.best_offer.offer_id;
      setOverlayOffer(next.best_offer);
    }
  }, [seenOfferIds]);

  useEffect(() => {
    void load();
    const t = window.setInterval(load, POLL_MS);
    return () => window.clearInterval(t);
  }, [load]);

  const startDemoRide = useCallback(async () => {
    setBusy(true);
    try {
      const res = await authFetch(`${API}/api/smartstack/driver/start-ride`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(DEMO_RIDE),
      });
      if (!res.ok) { toast.error("Couldn't start demo ride"); return; }
      // Seed a HV order so the matcher has something to match against.
      await authFetch(`${API}/api/hungryvibes/orders/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(DEMO_ORDER),
      });
      toast.success("Demo ride active · scanning for stacks");
      await load();
    } finally { setBusy(false); }
  }, [load]);

  const endRide = useCallback(async () => {
    setBusy(true);
    try {
      await authFetch(`${API}/api/smartstack/driver/end-ride`, { method: "POST" });
      toast.info("Ride ended");
      await load();
    } finally { setBusy(false); }
  }, [load]);

  const acceptStack = useCallback(async () => {
    if (!overlayOffer || busy) return;
    setBusy(true);
    try {
      const res = await authFetch(`${API}/api/smartstack/driver/accept-stack`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offer_id: overlayOffer.offer_id }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`+$${data.acceptance.added_profit_usd.toFixed(2)} stack accepted`);
        setOverlayOffer(null);
        await load();
      } else {
        toast.error(data.detail ?? "Couldn't accept");
      }
    } finally { setBusy(false); }
  }, [overlayOffer, busy, load]);

  const dismissOverlay = useCallback(async () => {
    if (!overlayOffer) return;
    await authFetch(`${API}/api/smartstack/driver/dismiss-offer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ offer_id: overlayOffer.offer_id }),
    });
    setOverlayOffer(null);
  }, [overlayOffer]);

  if (!data) {
    return (
      <div className="min-h-screen bg-[#040712] flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-cyan-400 animate-spin" />
      </div>
    );
  }

  const stats = data.stats;
  const ride = data.active_ride;
  const history = data.history;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#040712] via-[#0a1228] to-[#04080f] text-white" data-testid="smartstack-dashboard">
      <div className="max-w-5xl mx-auto px-4 md:px-6 py-6">
        {/* Header */}
        <button onClick={() => navigate("/dashboard")} className="flex items-center gap-1.5 text-cyan-300/70 hover:text-white text-xs font-bold mb-3" data-testid="smartstack-back-btn">
          <ArrowLeft className="w-4 h-4" /> Dashboard
        </button>
        <div className="flex items-center gap-4 mb-7">
          <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-400 via-indigo-500 to-fuchsia-600 shadow-[0_0_30px_rgba(34,211,238,0.45)]">
            <Zap className="w-8 h-8 text-white" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-cyan-300/80 font-bold" style={{ fontFamily: "'Cinzel', serif" }}>
              VibeRidez Logistics · v1.2
            </p>
            <h1 className="text-2xl md:text-3xl font-black leading-tight" style={{ fontFamily: "'Cinzel', serif" }}>
              SmartStack Driver
            </h1>
            <p className="text-xs text-cyan-100/60 mt-0.5">
              Detour cap <strong className="text-cyan-200">{stats.max_detour_mi}mi</strong> · Min profit boost <strong className="text-cyan-200">{stats.min_profit_boost}x</strong>
            </p>
          </div>
        </div>

        {/* Stats hero */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <StatCard icon={<PackageCheck />} label="Stacks taken" value={stats.stacks_accepted.toString()} testId="smartstack-stat-accepted" />
          <StatCard icon={<DollarSign />} label="Bonus profit" value={`$${stats.total_added_profit_usd.toFixed(2)}`} testId="smartstack-stat-bonus" highlight />
          <StatCard icon={<MapPin />} label="Pending orders" value={data.available_order_count.toString()} testId="smartstack-stat-orders" />
          <StatCard icon={<TrendingUp />} label="Active ride" value={ride ? "Live" : "—"} testId="smartstack-stat-ride" />
        </div>

        {/* Active ride strip */}
        {ride ? (
          <div className="mb-6 p-5 rounded-2xl bg-white/[0.03] border border-cyan-400/30" data-testid="smartstack-active-ride">
            <div className="flex flex-wrap items-center gap-3 justify-between mb-3">
              <p className="text-xs uppercase tracking-[0.3em] text-cyan-300/80 font-bold flex items-center gap-1.5" style={{ fontFamily: "'Cinzel', serif" }}>
                <Car className="w-4 h-4" /> Active Ride · ${ride.ride_payout_usd.toFixed(2)}
              </p>
              <button onClick={endRide} disabled={busy} className="text-rose-300 text-[10px] uppercase font-bold tracking-widest hover:text-rose-200 disabled:opacity-50" data-testid="smartstack-end-ride-btn">
                End Ride
              </button>
            </div>
            <div className="text-xs space-y-1 font-mono">
              <p>📍 Pickup · {ride.pickup.lat.toFixed(4)}, {ride.pickup.lng.toFixed(4)}</p>
              <p>🏁 Dropoff · {ride.dropoff.lat.toFixed(4)}, {ride.dropoff.lng.toFixed(4)}</p>
            </div>
            {data.best_offer && !overlayOffer ? (
              <button onClick={() => setOverlayOffer(data.best_offer)} className="mt-3 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-400 to-fuchsia-500 text-white font-black text-xs uppercase tracking-widest" data-testid="smartstack-show-offer-btn">
                Show stack offer · +${data.best_offer.added_profit_usd}
              </button>
            ) : null}
          </div>
        ) : (
          <div className="mb-6 p-5 rounded-2xl bg-white/[0.03] border border-cyan-400/20 text-center" data-testid="smartstack-no-ride">
            <Car className="w-10 h-10 mx-auto mb-2 text-cyan-300/60" />
            <p className="text-cyan-100/70 mb-3">No active ride. Start one to see SmartStack matching live.</p>
            <button onClick={startDemoRide} disabled={busy} className="px-5 py-2.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-900 font-black text-xs uppercase tracking-widest disabled:opacity-50" data-testid="smartstack-start-demo-ride-btn">
              {busy ? "Starting…" : "Start Demo Ride"}
            </button>
          </div>
        )}

        {/* Recent acceptance history */}
        <div className="p-5 rounded-2xl bg-white/[0.03] border border-cyan-400/15" data-testid="smartstack-history">
          <p className="text-xs uppercase tracking-[0.3em] text-cyan-300/80 font-bold mb-3" style={{ fontFamily: "'Cinzel', serif" }}>
            Recent Stacks
          </p>
          {history.length === 0 ? (
            <p className="text-cyan-100/50 text-sm text-center py-4" data-testid="smartstack-history-empty">
              Stack acceptances will appear here.
            </p>
          ) : (
            <div className="space-y-1.5">
              {history.map((h) => (
                <div key={h.acceptance_id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-black/30 text-xs" data-testid={`smartstack-history-row-${h.acceptance_id}`}>
                  <div>
                    <p className="font-mono text-cyan-100">Order {h.order_id.slice(0, 12)}…</p>
                    <p className="text-cyan-100/50 text-[10px]">{new Date(h.accepted_at).toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-emerald-300 font-black tabular-nums">+${h.added_profit_usd.toFixed(2)}</p>
                    <p className="text-cyan-100/50 text-[10px] tabular-nums">+{h.added_distance_mi.toFixed(1)}mi · +{h.added_minutes}min · {h.profit_boost}x</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* SMART STACK DETECTED overlay — the centrepiece per the PDF */}
      <AnimatePresence>
        {overlayOffer ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
            data-testid="smartstack-overlay"
          >
            <motion.div
              initial={{ scale: 0.85, y: 30 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.85, y: 30 }}
              transition={{ type: "spring", stiffness: 320, damping: 22 }}
              className="max-w-md w-full p-6 rounded-3xl bg-gradient-to-br from-cyan-950 via-indigo-950 to-fuchsia-950 border-2 border-cyan-400/60 shadow-[0_0_60px_rgba(34,211,238,0.45)]"
            >
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-6 h-6 text-cyan-300" />
                <p className="text-xs uppercase tracking-[0.3em] text-cyan-300 font-black" style={{ fontFamily: "'Cinzel', serif" }}>
                  Smart Stack Detected!
                </p>
              </div>
              <h2 className="text-3xl font-black mb-4 leading-tight" style={{ fontFamily: "'Cinzel', serif" }}>
                +${overlayOffer.added_profit_usd.toFixed(2)} <span className="text-cyan-300">/</span> {overlayOffer.profit_boost}× boost
              </h2>
              <div className="grid grid-cols-3 gap-2 mb-5">
                <Metric icon={<MapPin />} label="Detour" value={`${overlayOffer.added_distance_mi}mi`} />
                <Metric icon={<Clock />}  label="Added time" value={`${overlayOffer.added_minutes}min`} />
                <Metric icon={<DollarSign />} label="Food fee" value={`$${overlayOffer.food_payout_usd.toFixed(2)}`} />
              </div>
              <p className="text-xs text-cyan-100/60 mb-5">
                Pickup at <span className="font-mono text-cyan-200">{overlayOffer.pickup_at.lat.toFixed(4)}, {overlayOffer.pickup_at.lng.toFixed(4)}</span> · drop at <span className="font-mono text-cyan-200">{overlayOffer.deliver_to.lat.toFixed(4)}, {overlayOffer.deliver_to.lng.toFixed(4)}</span>
              </p>
              <div className="flex gap-2">
                <button
                  onClick={acceptStack}
                  disabled={busy}
                  data-testid="smartstack-accept-both-btn"
                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-emerald-400 via-cyan-400 to-indigo-500 hover:to-fuchsia-500 text-slate-900 font-black uppercase tracking-widest text-sm shadow-[0_0_22px_rgba(52,211,153,0.55)] disabled:opacity-50 inline-flex items-center justify-center gap-2"
                  style={{ fontFamily: "'Cinzel', serif" }}
                >
                  <CheckCircle2 className="w-4 h-4" /> Accept Both
                </button>
                <button
                  onClick={dismissOverlay}
                  disabled={busy}
                  data-testid="smartstack-dismiss-btn"
                  className="px-5 py-3 rounded-xl border border-cyan-400/40 text-cyan-200 hover:bg-white/5 font-bold uppercase tracking-widest text-xs disabled:opacity-50"
                >
                  Pass
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function StatCard({ icon, label, value, testId, highlight = false }: { icon: React.ReactNode; label: string; value: string; testId: string; highlight?: boolean }) {
  return (
    <div className={`p-4 rounded-2xl border ${highlight ? "bg-emerald-500/10 border-emerald-400/40" : "bg-white/[0.03] border-cyan-400/20"}`} data-testid={testId}>
      <div className={`flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] font-bold mb-1 ${highlight ? "text-emerald-300" : "text-cyan-300/80"}`}>
        <span className="w-3.5 h-3.5">{icon}</span> {label}
      </div>
      <p className="text-2xl font-black tabular-nums" style={{ fontFamily: "'Cinzel', serif" }}>{value}</p>
    </div>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="p-3 rounded-xl bg-black/40 border border-cyan-400/20 text-center">
      <div className="text-cyan-300 mb-1 inline-flex items-center justify-center"><span className="w-4 h-4">{icon}</span></div>
      <p className="text-[9px] uppercase tracking-[0.2em] text-cyan-100/60 font-bold">{label}</p>
      <p className="text-lg font-black tabular-nums">{value}</p>
    </div>
  );
}
