/**
 * Vibe Venues — Venue Detail + Booking Calendar.
 *
 * Renders the full venue card (cover photo, 360° walkthrough,
 * description, amenities) plus an inline calendar that shows the next
 * 30 days of available hourly blocks. User picks a date + hourly block,
 * optionally adds a Vibe Artisan, and confirms — backend creates the
 * booking and routes them to the booking detail page for escrow lock.
 */
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Home,
  ArrowLeft,
  MapPin,
  Box,
  Clock,
  Calendar as CalendarIcon,
  ChefHat,
  AlertCircle,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

const API = process.env.REACT_APP_BACKEND_URL!;

type Venue = {
  venue_id: string;
  name: string;
  description: string;
  city: string;
  zip_code: string;
  capacity: number;
  cover_photo?: string;
  gallery_photos?: string[];
  walkthrough_3d_url?: string;
  base_hourly_rate_usd: number;
  amenities?: string[];
  refund_policy?: string;
};

type Calendar = {
  hourly_blocks: number[];
  booked_blocks: Array<{
    booking_id: string;
    start_at: string;
    block_hours: number;
    lifecycle_state: string;
  }>;
};

type Artisan = {
  artisan_id: string;
  display_name: string;
  artisan_type: string;
  base_service_rate_usd: number;
};

export default function VibeVenuesVenueDetail() {
  const { venueId } = useParams<{ venueId: string }>();
  const navigate = useNavigate();
  const [venue, setVenue] = useState<Venue | null>(null);
  const [calendar, setCalendar] = useState<Calendar | null>(null);
  const [artisans, setArtisans] = useState<Artisan[]>([]);
  const [pickedDate, setPickedDate] = useState("");
  const [pickedHour, setPickedHour] = useState("18:00");
  const [block, setBlock] = useState<number>(3);
  const [artisanId, setArtisanId] = useState<string>("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!venueId) return;
    (async () => {
      const v = await fetch(`${API}/api/vibe-venues/venues/${venueId}`).then((r) => r.json());
      setVenue(v);
      const c = await fetch(`${API}/api/vibe-venues/venues/${venueId}/calendar`).then((r) =>
        r.json(),
      );
      setCalendar(c);
      const a = await fetch(
        `${API}/api/vibe-venues/artisans?zip_code=${encodeURIComponent(v.zip_code)}`,
      ).then((r) => r.json());
      setArtisans(a.artisans || []);
    })();
  }, [venueId]);

  const userId = localStorage.getItem("user_id") || "guest";

  const startTimestamp = useMemo(() => {
    if (!pickedDate) return "";
    return `${pickedDate}T${pickedHour}:00Z`;
  }, [pickedDate, pickedHour]);

  // Detect overlap with existing bookings
  const conflict = useMemo(() => {
    if (!startTimestamp || !calendar) return null;
    const start = new Date(startTimestamp).getTime();
    const end = start + block * 3600_000;
    for (const bk of calendar.booked_blocks) {
      const bs = new Date(bk.start_at).getTime();
      const be = bs + bk.block_hours * 3600_000;
      if (start < be && bs < end) return bk;
    }
    return null;
  }, [startTimestamp, block, calendar]);

  const artisan = artisans.find((a) => a.artisan_id === artisanId) || null;
  const houseTotal = (venue?.base_hourly_rate_usd ?? 0) * block;
  const artisanTotal = artisan?.base_service_rate_usd ?? 0;
  const grandTotal = houseTotal + artisanTotal;

  const confirmBooking = async () => {
    if (!venueId || !startTimestamp) {
      toast.error("Pick a date and time");
      return;
    }
    if (conflict) {
      toast.error("That window overlaps an existing booking — pick another time");
      return;
    }
    setBusy(true);
    try {
      const r = await fetch(`${API}/api/vibe-venues/bookings/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_user_id: userId,
          venue_id: venueId,
          artisan_id: artisanId || null,
          artisan_service_total_usd: artisanTotal,
          start_at: startTimestamp,
          block_hours: block,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || "Booking failed");
      toast.success("Booking created — lock the escrow next");
      navigate(`/vibe-venues/booking/${data.booking.booking_id}`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (!venue || !calendar)
    return (
      <div className="min-h-screen bg-[#07030F] flex items-center justify-center">
        <div className="animate-spin w-12 h-12 border-4 border-fuchsia-500 border-t-transparent rounded-full" />
      </div>
    );

  return (
    <div className="min-h-screen bg-[#07030F] text-white pb-24" data-testid="vv-venue-detail-page">
      <div className="max-w-5xl mx-auto px-4 py-10">
        <button
          onClick={() => navigate("/vibe-venues")}
          className="flex items-center gap-2 text-purple-300/70 hover:text-white mb-6"
          data-testid="vv-detail-back-btn"
        >
          <ArrowLeft className="w-4 h-4" /> All venues
        </button>

        {/* Cover */}
        {venue.cover_photo ? (
          <img
            src={venue.cover_photo}
            alt={venue.name}
            className="w-full h-72 md:h-96 object-cover rounded-2xl mb-6"
          />
        ) : (
          <div className="w-full h-64 bg-gradient-to-br from-fuchsia-900/60 to-purple-900/60 rounded-2xl mb-6 flex items-center justify-center">
            <Home className="w-20 h-20 text-fuchsia-300/70" />
          </div>
        )}

        {/* Title */}
        <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
          <div>
            <h1 className="text-4xl font-black mb-1">{venue.name}</h1>
            <div className="flex items-center gap-2 text-sm text-purple-300/80">
              <MapPin className="w-4 h-4" />
              {venue.city} · {venue.zip_code} · capacity {venue.capacity}
            </div>
          </div>
          <div className="text-right">
            <p className="text-3xl font-black text-fuchsia-300">
              ${venue.base_hourly_rate_usd}
              <span className="text-purple-300/60 text-sm font-normal"> / hr</span>
            </p>
            {venue.walkthrough_3d_url && (
              <a
                href={venue.walkthrough_3d_url}
                target="_blank"
                rel="noreferrer"
                className="text-xs uppercase tracking-widest text-cyan-300 hover:underline mt-2 inline-flex items-center gap-1"
                data-testid="vv-detail-3d-link"
              >
                <Box className="w-3 h-3" /> 360° Walkthrough
              </a>
            )}
          </div>
        </div>

        {/* Description + amenities */}
        <Card className="p-5 bg-[#0F0720] border border-fuchsia-500/15 rounded-2xl mb-6">
          <p className="text-sm text-purple-100/85 leading-relaxed mb-3">
            {venue.description || "No description."}
          </p>
          {venue.amenities?.length ? (
            <div className="flex flex-wrap gap-2 mt-3">
              {venue.amenities.map((a) => (
                <span
                  key={a}
                  className="text-xs uppercase tracking-wider bg-fuchsia-500/10 text-fuchsia-300 px-2 py-1 rounded-full border border-fuchsia-500/20"
                >
                  {a}
                </span>
              ))}
            </div>
          ) : null}
        </Card>

        {/* Gallery */}
        {venue.gallery_photos && venue.gallery_photos.length > 0 && (
          <Card
            className="p-4 bg-[#0F0720] border border-fuchsia-500/15 rounded-2xl mb-6"
            data-testid="vv-detail-gallery"
          >
            <p className="text-xs font-mono uppercase tracking-[0.3em] text-purple-300/80 mb-3">
              Gallery · {venue.gallery_photos.length} photos
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {venue.gallery_photos.map((url, i) => (
                <a
                  key={i}
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="block aspect-square rounded-lg overflow-hidden border border-fuchsia-500/10 hover:border-fuchsia-400/50 transition"
                  data-testid={`vv-detail-gallery-photo-${i}`}
                >
                  <img
                    src={url}
                    alt={`${venue.name} photo ${i + 1}`}
                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                  />
                </a>
              ))}
            </div>
          </Card>
        )}

        {/* Refund policy banner */}
        <Card
          className="p-4 bg-gradient-to-r from-cyan-500/10 via-fuchsia-500/10 to-cyan-500/10 border border-cyan-400/25 rounded-2xl mb-6 flex items-start gap-3"
          data-testid="vv-detail-refund-policy"
        >
          <ShieldCheck className="w-5 h-5 text-cyan-300 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-mono uppercase tracking-[0.3em] text-cyan-300/90 mb-1">
              Refund Policy · {(venue.refund_policy || "moderate").toUpperCase()}
            </p>
            <p className="text-sm text-cyan-100/85">
              {venue.refund_policy === "flexible"
                ? "Full refund up to 24 hours before start time. 50% refund inside 24 hours."
                : venue.refund_policy === "strict"
                ? "Full refund up to 7 days before start time. No refund inside the 7-day window."
                : "Full refund up to 5 days before start. 50% refund up to 48 hours before. No refund inside 48 hours."}
            </p>
            <p className="text-[10px] text-cyan-100/60 mt-1 italic">
              All funds held in $DSG escrow until Vibe-Check confirms or a dispute resolves.
            </p>
          </div>
        </Card>

        {/* Booking widget */}
        <Card className="p-6 bg-[#0F0720] border border-fuchsia-400/30 rounded-2xl mb-6" data-testid="vv-booking-widget">
          <div className="flex items-center gap-2 mb-4">
            <CalendarIcon className="w-5 h-5 text-fuchsia-300" />
            <h3 className="text-lg font-black">Book This Venue</h3>
          </div>

          <div className="grid md:grid-cols-3 gap-4 mb-5">
            <div>
              <label className="block text-xs font-mono uppercase tracking-widest text-purple-300/80 mb-2">
                Date
              </label>
              <input
                type="date"
                value={pickedDate}
                onChange={(e) => setPickedDate(e.target.value)}
                min={new Date().toISOString().slice(0, 10)}
                className="w-full p-3 rounded-lg bg-[#1A0D2E] border border-fuchsia-500/30 text-white"
                data-testid="vv-pick-date"
              />
            </div>
            <div>
              <label className="block text-xs font-mono uppercase tracking-widest text-purple-300/80 mb-2">
                Start Time
              </label>
              <input
                type="time"
                value={pickedHour}
                onChange={(e) => setPickedHour(e.target.value)}
                className="w-full p-3 rounded-lg bg-[#1A0D2E] border border-fuchsia-500/30 text-white"
                data-testid="vv-pick-time"
              />
            </div>
            <div>
              <label className="block text-xs font-mono uppercase tracking-widest text-purple-300/80 mb-2">
                Block
              </label>
              <select
                value={block}
                onChange={(e) => setBlock(parseInt(e.target.value))}
                className="w-full p-3 rounded-lg bg-[#1A0D2E] border border-fuchsia-500/30 text-white"
                data-testid="vv-pick-block"
              >
                {calendar.hourly_blocks.map((h) => (
                  <option key={h} value={h}>
                    {h} hr
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Artisan picker */}
          <div className="mb-4">
            <label className="block text-xs font-mono uppercase tracking-widest text-purple-300/80 mb-2">
              <ChefHat className="w-3 h-3 inline mr-1" /> Add a Vibe Artisan (optional)
            </label>
            <select
              value={artisanId}
              onChange={(e) => setArtisanId(e.target.value)}
              className="w-full p-3 rounded-lg bg-[#1A0D2E] border border-orange-500/30 text-white"
              data-testid="vv-pick-artisan"
            >
              <option value="">No Artisan</option>
              {artisans.map((a) => (
                <option key={a.artisan_id} value={a.artisan_id}>
                  {a.display_name} ({a.artisan_type}) · ${a.base_service_rate_usd}
                </option>
              ))}
            </select>
          </div>

          {/* Conflict warning */}
          {conflict && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/40 mb-4 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-300 mt-0.5" />
              <p className="text-sm text-red-200">
                This window overlaps an existing booking on{" "}
                <span className="font-mono">
                  {new Date(conflict.start_at).toLocaleString()}
                </span>{" "}
                ({conflict.block_hours} hr · {conflict.lifecycle_state}).
                Pick a different time.
              </p>
            </div>
          )}

          {/* Total */}
          <div className="p-4 rounded-xl bg-[#0B0618] border border-fuchsia-500/20 flex items-center justify-between mb-4">
            <div>
              <p className="text-xs uppercase tracking-widest text-purple-300/80">
                Estimated Total
              </p>
              <p className="text-[10px] text-purple-300/50 mt-0.5">
                <Clock className="w-3 h-3 inline" /> {block} hr × ${venue.base_hourly_rate_usd}
                {artisanTotal ? ` + $${artisanTotal} artisan` : ""}
              </p>
            </div>
            <p className="text-3xl font-black text-white" data-testid="vv-est-total">
              ${grandTotal.toFixed(2)}
            </p>
          </div>

          <Button
            onClick={confirmBooking}
            disabled={busy || !!conflict || !pickedDate}
            className="w-full bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-bold py-6 rounded-xl shadow-[0_0_22px_rgba(217,70,239,0.45)]"
            data-testid="vv-confirm-booking-btn"
          >
            {busy ? "Creating booking…" : "Continue → Lock $DSG Escrow"}
          </Button>
        </Card>

        {/* Booked windows */}
        {calendar.booked_blocks.length > 0 && (
          <Card className="p-5 bg-[#0F0720] border border-purple-500/15 rounded-2xl">
            <p className="text-xs font-mono uppercase tracking-[0.3em] text-purple-300/80 mb-3">
              Already Booked (Next 30 Days)
            </p>
            <div className="space-y-2">
              {calendar.booked_blocks.map((b) => (
                <div
                  key={b.booking_id}
                  className="flex items-center justify-between text-sm py-2 border-b border-purple-500/10 last:border-b-0"
                >
                  <span>{new Date(b.start_at).toLocaleString()}</span>
                  <span className="text-fuchsia-300/80 font-mono text-xs">
                    {b.block_hours} hr · {b.lifecycle_state}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
