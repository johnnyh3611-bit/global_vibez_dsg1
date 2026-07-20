/**
 * VibeSpotsPage — Vibez Spots bookings + Venue Partnership sponsorship.
 *
 * Routes: /vibe-spots
 * APIs: /api/vibe-spots/mine, /api/venue-sponsorship/*
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  MapPin,
  Sparkles,
  Calendar,
  Loader2,
  Gift,
  Building2,
  Check,
} from "lucide-react";
import { authFetch, getUserId } from "@/utils/secureAuth";
import SponsoredSpotsCarousel from "@/components/venues/SponsoredSpotsCarousel";

const API = process.env.REACT_APP_BACKEND_URL;

interface VibeSpotBooking {
  booking_id: string;
  spot_id: string;
  spot_name?: string;
  starts_at?: string;
  ends_at?: string;
  status: string;
}

interface Tier {
  id: string;
  label: string;
  usd_month: number;
  perks: string[];
  platform_commission_bps: number;
}

export default function VibeSpotsPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const focusSpot = params.get("spot");

  const [bookings, setBookings] = useState<VibeSpotBooking[]>([]);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [coinsPerUsd, setCoinsPerUsd] = useState(1000);
  const [loading, setLoading] = useState(true);
  const [venueName, setVenueName] = useState("");
  const [city, setCity] = useState("");
  const [tierId, setTierId] = useState("partner");
  const [offer, setOffer] = useState("Free welcome drink for in-app bookings");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [claimBusy, setClaimBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [mine, tierRes] = await Promise.all([
          authFetch(`${API}/api/vibe-spots/mine`),
          fetch(`${API}/api/venue-sponsorship/tiers`),
        ]);
        if (!cancelled && mine.ok) {
          const d = await mine.json();
          setBookings(d.bookings || d.rows || d.items || []);
        }
        if (!cancelled && tierRes.ok) {
          const t = await tierRes.json();
          setTiers(t.tiers || []);
          setCoinsPerUsd(t.coins_per_usd || 1000);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedTier = useMemo(
    () => tiers.find((t) => t.id === tierId) || tiers[0],
    [tiers, tierId],
  );

  const activateCoins = selectedTier
    ? Math.round(selectedTier.usd_month * coinsPerUsd)
    : 0;

  const claimPerk = async () => {
    if (!focusSpot) return;
    setClaimBusy(true);
    setErr("");
    setMsg("");
    try {
      const res = await authFetch(`${API}/api/venue-sponsorship/convert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          spot_id: focusSpot,
          kind: "perk_claim",
          notes: "Claimed from Vibez Spots page",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.detail || "Could not claim perk");
        return;
      }
      setMsg("Perk claimed — show this screen to the venue host.");
    } catch (e: any) {
      setErr(e?.message || "Network error");
    } finally {
      setClaimBusy(false);
    }
  };

  const becomePartner = async () => {
    setBusy(true);
    setErr("");
    setMsg("");
    try {
      if (!venueName.trim()) {
        setErr("Enter your venue or streamer name");
        return;
      }
      const create = await authFetch(`${API}/api/venue-sponsorship/spots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          venue_name: venueName.trim(),
          city: city.trim() || undefined,
          tier_id: selectedTier?.id || "partner",
          exclusive_offer: offer.trim() || undefined,
          category: "venue",
        }),
      });
      const created = await create.json().catch(() => ({}));
      if (!create.ok) {
        setErr(created.detail || "Could not create sponsored spot");
        return;
      }
      const spotId = created.spot?.spot_id;
      const act = await authFetch(
        `${API}/api/venue-sponsorship/spots/${spotId}/activate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ payment_method: "vibez_coins" }),
        },
      );
      const activated = await act.json().catch(() => ({}));
      if (!act.ok) {
        setErr(
          typeof activated.detail === "string"
            ? activated.detail
            : "Spot created but activation failed — top up ₵ and retry.",
        );
        return;
      }
      setMsg(
        `${created.spot?.venue_name} is live on the Sponsored carousel for 30 days.`,
      );
      setVenueName("");
    } catch (e: any) {
      setErr(e?.message || "Network error");
    } finally {
      setBusy(false);
    }
  };

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
              Sponsored premium experiences
            </p>
            <h1 className="text-3xl md:text-4xl font-black">Vibez Spots</h1>
          </div>
        </div>
        <p className="text-sm text-purple-200/80 mb-6 max-w-xl">
          Book private experiences at partner venues — or claim platform-only
          perks. Venues buy carousel visibility; we earn commission when you
          convert.
        </p>

        <SponsoredSpotsCarousel className="mb-6" limit={8} />

        {focusSpot && (
          <div
            className="mb-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4"
            data-testid="vibe-spots-focus-perk"
          >
            <p className="text-xs font-mono uppercase tracking-widest text-emerald-300 mb-2">
              Platform-only perk
            </p>
            <p className="text-sm text-white/90 mb-3">
              Spot <span className="font-mono text-emerald-200">{focusSpot}</span>
            </p>
            <button
              type="button"
              disabled={claimBusy || !getUserId()}
              onClick={claimPerk}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-500/90 hover:bg-emerald-400 text-black font-bold text-sm px-4 py-2 disabled:opacity-40"
              data-testid="vibe-spots-claim-perk"
            >
              <Gift className="w-4 h-4" />
              {claimBusy ? "Claiming…" : "Claim exclusive perk"}
            </button>
          </div>
        )}

        {/* Partner CTA */}
        <div
          className="rounded-2xl border border-amber-500/25 bg-[#120818] p-5 mb-6"
          data-testid="vibe-spots-partner-cta"
        >
          <div className="flex items-center gap-2 mb-2">
            <Building2 className="w-5 h-5 text-amber-300" />
            <h2 className="text-lg font-bold text-amber-100">
              Venue / Streamer Partnership
            </h2>
          </div>
          <p className="text-xs text-purple-200/70 mb-4">
            Buy premium carousel visibility. Offer a reserved table or free
            drink — we take a small commission when members convert.
          </p>

          <div className="grid gap-2 sm:grid-cols-3 mb-4">
            {tiers.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTierId(t.id)}
                data-testid={`vibe-spots-tier-${t.id}`}
                className={`rounded-xl border p-3 text-left transition ${
                  tierId === t.id
                    ? "border-amber-400/70 bg-amber-500/15"
                    : "border-white/10 bg-black/30 hover:border-white/25"
                }`}
              >
                <p className="font-bold text-sm">{t.label}</p>
                <p className="text-amber-200 text-xs mt-0.5">
                  ${t.usd_month}/mo
                </p>
                <ul className="mt-2 space-y-1">
                  {(t.perks || []).slice(0, 2).map((p) => (
                    <li
                      key={p}
                      className="text-[11px] text-purple-200/70 flex gap-1"
                    >
                      <Check className="w-3 h-3 shrink-0 mt-0.5 text-emerald-300" />
                      {p}
                    </li>
                  ))}
                </ul>
              </button>
            ))}
          </div>

          <div className="grid gap-2 sm:grid-cols-2 mb-3">
            <input
              value={venueName}
              onChange={(e) => setVenueName(e.target.value)}
              placeholder="Venue or streamer name"
              className="rounded-lg bg-black/40 border border-white/15 px-3 py-2 text-sm"
              data-testid="vibe-spots-venue-name"
            />
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="City (optional)"
              className="rounded-lg bg-black/40 border border-white/15 px-3 py-2 text-sm"
              data-testid="vibe-spots-city"
            />
          </div>
          <input
            value={offer}
            onChange={(e) => setOffer(e.target.value)}
            placeholder="Exclusive offer (e.g. Free welcome drink)"
            className="w-full rounded-lg bg-black/40 border border-white/15 px-3 py-2 text-sm mb-3"
            data-testid="vibe-spots-offer"
          />
          <button
            type="button"
            disabled={busy}
            onClick={becomePartner}
            className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-fuchsia-600 font-bold py-2.5 text-sm disabled:opacity-50"
            data-testid="vibe-spots-activate-partner"
          >
            {busy
              ? "Activating…"
              : `Go live — ₵${activateCoins.toLocaleString()} / 30 days`}
          </button>
          {msg && (
            <p
              className="mt-3 text-xs text-emerald-200"
              data-testid="vibe-spots-partner-msg"
              role="status"
            >
              {msg}
            </p>
          )}
          {err && (
            <p
              className="mt-3 text-xs text-rose-300"
              data-testid="vibe-spots-partner-err"
              role="alert"
            >
              {err}
            </p>
          )}
        </div>

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
            <div
              className="text-center py-8 text-sm text-purple-300/70"
              data-testid="vibe-spots-empty"
            >
              <Sparkles className="w-6 h-6 mx-auto mb-2 text-fuchsia-300" />
              No bookings yet. Browse Sponsored Spots above or scan a venue QR.
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
                      {b.starts_at
                        ? b.starts_at.slice(0, 16)
                        : "Schedule pending"}{" "}
                      · {b.status}
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
