/**
 * Vibe Venues — List Your House (Host onboarding).
 * Spec: Vibe_Venues_Master_Lock_In.pdf
 */
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Home, Box, ArrowLeft, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import DirectUpload from "@/components/uploads/DirectUpload";

const API = process.env.REACT_APP_BACKEND_URL;

export default function VibeVenuesHost() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [coverIsAuto, setCoverIsAuto] = useState(false);
  const [form, setForm] = useState({
    host_user_id: localStorage.getItem("user_id") || "guest",
    name: "",
    description: "",
    address: "",
    city: "",
    zip_code: "",
    capacity: 4,
    base_hourly_rate_usd: 50,
    walkthrough_3d_url: "",
    cover_photo: "",
    gallery_photos: [] as string[],
    amenities: "",
    refund_policy: "moderate",
  });

  const submit = async () => {
    if (!form.name || !form.city || !form.zip_code) {
      toast.error("Name, city, and zip are required");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        amenities: form.amenities
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      };
      const res = await fetch(`${API}/api/vibe-venues/venues/list`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed");
      setDone(data.venue.venue_id);
      toast.success("House listed!");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen bg-[#07030F] text-white flex items-center justify-center p-4">
        <Card className="max-w-lg w-full p-8 text-center bg-[#0F0720] border border-fuchsia-500/30 rounded-2xl">
          <CheckCircle2 className="w-16 h-16 mx-auto mb-4 text-fuchsia-400" />
          <h2 className="text-3xl font-black mb-2">House Listed</h2>
          <p className="text-purple-300/80 mb-6">
            Your venue is live and ready for hourly bookings. ID:{" "}
            <span className="font-mono text-fuchsia-300">{done}</span>
          </p>
          <div className="flex gap-3 justify-center">
            <Button onClick={() => navigate("/vibe-venues")} className="bg-fuchsia-600 hover:bg-fuchsia-500">
              View Listings
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setDone(null);
                setForm({ ...form, name: "", description: "", address: "" });
              }}
              className="border-fuchsia-500/30 text-purple-200"
            >
              List Another
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#07030F] text-white pb-24" data-testid="vibe-venues-host-page">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <button
          onClick={() => navigate("/vibe-venues")}
          className="flex items-center gap-2 text-purple-300/70 hover:text-white mb-6"
          data-testid="vv-host-back-btn"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Vibe Venues
        </button>

        <div className="flex items-center gap-3 mb-2">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-fuchsia-600 to-purple-700 shadow-[0_0_18px_rgba(217,70,239,0.55)]">
            <Home className="w-7 h-7 text-white" />
          </div>
          <div>
            <p className="text-xs font-mono uppercase tracking-[0.3em] text-fuchsia-400/80">
              Host Onboarding
            </p>
            <h1 className="text-3xl md:text-4xl font-black">List Your House</h1>
          </div>
        </div>
        <p className="text-sm text-purple-300/80 mb-8 max-w-2xl">
          Hourly blocks, $DSG escrow, and a Vibe Artisan partner if you want one.
          Platform retains a flat percentage per booking — the rest settles to you
          after Vibe-Check.
        </p>

        <Card className="p-6 bg-[#0F0720] border border-fuchsia-500/20 rounded-2xl space-y-4">
          <Field label="House Name *">
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="The Loft on Mission"
              className="w-full p-3 rounded-lg bg-[#1A0D2E] border border-fuchsia-500/30 text-white"
              data-testid="vv-host-name"
            />
          </Field>

          <Field label="Description">
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Curated 2BR loft, rooftop terrace, mood lighting…"
              rows={3}
              className="w-full p-3 rounded-lg bg-[#1A0D2E] border border-fuchsia-500/30 text-white"
              data-testid="vv-host-desc"
            />
          </Field>

          <div className="grid md:grid-cols-2 gap-4">
            <Field label="Address">
              <input
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="w-full p-3 rounded-lg bg-[#1A0D2E] border border-fuchsia-500/30 text-white"
                data-testid="vv-host-address"
              />
            </Field>
            <Field label="City *">
              <input
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                className="w-full p-3 rounded-lg bg-[#1A0D2E] border border-fuchsia-500/30 text-white"
                data-testid="vv-host-city"
              />
            </Field>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <Field label="Zip *">
              <input
                value={form.zip_code}
                onChange={(e) => setForm({ ...form, zip_code: e.target.value })}
                className="w-full p-3 rounded-lg bg-[#1A0D2E] border border-fuchsia-500/30 text-white"
                data-testid="vv-host-zip"
              />
            </Field>
            <Field label="Capacity">
              <input
                type="number"
                value={form.capacity}
                onChange={(e) => setForm({ ...form, capacity: parseInt(e.target.value) || 1 })}
                className="w-full p-3 rounded-lg bg-[#1A0D2E] border border-fuchsia-500/30 text-white"
                data-testid="vv-host-capacity"
              />
            </Field>
            <Field label="Hourly Rate (USD)">
              <input
                type="number"
                value={form.base_hourly_rate_usd}
                onChange={(e) => setForm({ ...form, base_hourly_rate_usd: parseFloat(e.target.value) || 0 })}
                className="w-full p-3 rounded-lg bg-[#1A0D2E] border border-fuchsia-500/30 text-white"
                data-testid="vv-host-rate"
              />
            </Field>
          </div>

          <Field label="360° Walkthrough Video">
            <DirectUpload
              kind="walkthrough"
              accept="video"
              cameraCapture
              value={form.walkthrough_3d_url}
              onChange={(u) => setForm({ ...form, walkthrough_3d_url: u })}
              onThumbnail={(thumb) => {
                setForm((prev) => {
                  if (!prev.cover_photo) {
                    setCoverIsAuto(true);
                    return { ...prev, cover_photo: thumb };
                  }
                  return prev;
                });
              }}
              testid="vv-host-3d-upload"
            />
          </Field>

          <Field label="Cover Photo">
            <DirectUpload
              kind="cover"
              accept="image"
              cameraCapture
              value={form.cover_photo}
              onChange={(u) => {
                setForm({ ...form, cover_photo: u });
                setCoverIsAuto(false);
              }}
              isAutoGenerated={coverIsAuto && !!form.cover_photo}
              testid="vv-host-photo-upload"
            />
          </Field>

          <Field label="Gallery Photos (up to 8 — show the rooms, the view, the vibe)">
            <div className="space-y-2" data-testid="vv-host-gallery-wrapper">
              {form.gallery_photos.map((url, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 p-2 rounded-lg bg-[#1A0D2E] border border-fuchsia-500/20"
                >
                  <img
                    src={url}
                    alt={`Gallery ${idx + 1}`}
                    className="w-16 h-16 object-cover rounded"
                  />
                  <span className="text-xs text-purple-300/70 flex-1 truncate font-mono">
                    {url.split("/").pop()}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setForm({
                        ...form,
                        gallery_photos: form.gallery_photos.filter((_, i) => i !== idx),
                      })
                    }
                    className="text-xs uppercase tracking-widest text-red-300 hover:text-red-200"
                    data-testid={`vv-host-gallery-remove-${idx}`}
                  >
                    Remove
                  </button>
                </div>
              ))}
              {form.gallery_photos.length < 8 && (
                <DirectUpload
                  kind="gallery"
                  accept="image"
                  cameraCapture
                  value=""
                  onChange={(u) => {
                    if (u) {
                      setForm({
                        ...form,
                        gallery_photos: [...form.gallery_photos, u],
                      });
                    }
                  }}
                  testid="vv-host-gallery-upload"
                />
              )}
              <p className="text-[10px] text-purple-300/50 italic">
                {form.gallery_photos.length}/8 photos added.
              </p>
            </div>
          </Field>

          <Field label="Refund Policy">
            <div className="grid md:grid-cols-3 gap-2" data-testid="vv-host-refund-policy-wrapper">
              {[
                {
                  id: "flexible",
                  label: "Flexible",
                  summary: "Full refund up to 24 h before",
                },
                {
                  id: "moderate",
                  label: "Moderate",
                  summary: "Full refund 5 days · 50% inside 48 h",
                },
                {
                  id: "strict",
                  label: "Strict",
                  summary: "Full refund up to 7 days · then no refund",
                },
              ].map((p) => {
                const active = form.refund_policy === p.id;
                return (
                  <button
                    type="button"
                    key={p.id}
                    onClick={() => setForm({ ...form, refund_policy: p.id })}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      active
                        ? "bg-fuchsia-500/20 border-fuchsia-400 shadow-[0_0_18px_rgba(217,70,239,0.3)]"
                        : "bg-[#1A0D2E] border-fuchsia-500/15 hover:border-fuchsia-500/40"
                    }`}
                    data-testid={`vv-host-refund-${p.id}`}
                  >
                    <p className="text-sm font-bold text-fuchsia-200">{p.label}</p>
                    <p className="text-[11px] text-purple-300/70 mt-1">{p.summary}</p>
                  </button>
                );
              })}
            </div>
          </Field>

          <Field label="Amenities (comma-separated)">
            <input
              value={form.amenities}
              onChange={(e) => setForm({ ...form, amenities: e.target.value })}
              placeholder="rooftop, kitchen, projector, balcony"
              className="w-full p-3 rounded-lg bg-[#1A0D2E] border border-fuchsia-500/30 text-white"
              data-testid="vv-host-amenities"
            />
          </Field>

          <Button
            onClick={submit}
            disabled={submitting}
            className="w-full bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-bold py-6 rounded-xl shadow-[0_0_22px_rgba(217,70,239,0.45)]"
            data-testid="vv-host-submit-btn"
          >
            {submitting ? "Listing…" : "List My House"}
          </Button>
        </Card>
      </div>
    </div>
  );
}

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <label className="block text-xs font-mono uppercase tracking-widest text-purple-300/80 mb-2">
      {label}
    </label>
    {children}
  </div>
);
