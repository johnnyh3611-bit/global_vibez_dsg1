/**
 * Vibe Venues — Become a Vibe Artisan ($20/mo).
 * Spec: Vibe_Venues_Master_Lock_In.pdf
 */
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChefHat, ArrowLeft, CheckCircle2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import DirectUpload from "@/components/uploads/DirectUpload";

const API = process.env.REACT_APP_BACKEND_URL;

export default function VibeVenuesArtisan() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [coverIsAuto, setCoverIsAuto] = useState(false);
  const [form, setForm] = useState({
    user_id: localStorage.getItem("user_id") || "guest",
    artisan_type: "chef",
    display_name: "",
    bio: "",
    signature_dishes: "",
    cover_photo: "",
    commercial_video_url: "",
    service_area_zips: "",
    base_service_rate_usd: 100,
  });

  const submit = async () => {
    if (!form.display_name || !form.bio) {
      toast.error("Display name and bio are required");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        signature_dishes: form.signature_dishes.split(",").map((s) => s.trim()).filter(Boolean),
        service_area_zips: form.service_area_zips.split(",").map((s) => s.trim()).filter(Boolean),
      };
      const res = await fetch(`${API}/api/vibe-venues/artisans/onboard`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed");
      setDone(data.artisan.artisan_id);
      toast.success("Artisan profile created - complete your $20/mo membership next");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const goToCheckout = async () => {
    if (!done) return;
    setSubmitting(true);
    try {
      const r = await fetch(`${API}/api/vibe-venues/artisans/${done}/checkout`, {
        method: "POST",
      });
      const data = await r.json();
      if (!r.ok || !data.checkout_url) throw new Error(data.detail || "Stripe checkout failed");
      window.location.href = data.checkout_url;
    } catch (e: any) {
      toast.error(e.message);
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen bg-[#07030F] text-white flex items-center justify-center p-4">
        <Card className="max-w-lg w-full p-8 text-center bg-[#0F0720] border border-orange-500/30 rounded-2xl">
          <CheckCircle2 className="w-16 h-16 mx-auto mb-4 text-orange-400" />
          <h2 className="text-3xl font-black mb-2">Profile Created</h2>
          <p className="text-orange-100/80 mb-2">
            Welcome to the Vibe Artisans, {form.display_name}.
          </p>
          <p className="text-purple-300/70 text-sm mb-6">
            ID: <span className="font-mono text-orange-300">{done}</span>
          </p>
          <div className="p-4 rounded-lg bg-orange-500/10 border border-orange-400/30 mb-6 text-left">
            <p className="text-xs uppercase tracking-widest text-orange-300/90 mb-1 font-mono">
              Next Step · $20.00 / Month
            </p>
            <p className="text-sm text-orange-100/85">
              Membership unlocks Signature Commercials, Perfect-Mate dispatch,
              and 1–2hr early-access prep windows. Stripe checkout opens in the
              next phase.
            </p>
          </div>
          <div className="flex gap-3 justify-center">
            <Button
              onClick={goToCheckout}
              disabled={submitting}
              className="bg-orange-500 hover:bg-orange-400 text-white font-bold"
              data-testid="vv-artisan-stripe-btn"
            >
              {submitting ? "Redirecting…" : "Pay $20 / mo with Stripe"}
            </Button>
            <Button
              onClick={() => navigate("/vibe-venues")}
              variant="outline"
              className="border-fuchsia-500/30 text-purple-200"
              data-testid="vv-artisan-done-browse"
            >
              Browse Venues
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#07030F] text-white pb-24" data-testid="vibe-venues-artisan-page">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <button
          onClick={() => navigate("/vibe-venues")}
          className="flex items-center gap-2 text-purple-300/70 hover:text-white mb-6"
          data-testid="vv-artisan-back-btn"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Vibe Venues
        </button>

        <div className="flex items-center gap-3 mb-2">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-fuchsia-600 shadow-[0_0_18px_rgba(249,115,22,0.55)]">
            <ChefHat className="w-7 h-7 text-white" />
          </div>
          <div>
            <p className="text-xs font-mono uppercase tracking-[0.3em] text-orange-300/90">
              Artisan Onboarding · $20 / mo
            </p>
            <h1 className="text-3xl md:text-4xl font-black">Become a Vibe Artisan</h1>
          </div>
        </div>
        <p className="text-sm text-orange-100/80 mb-8 max-w-2xl">
          Chefs · Decorators · Setters. Flat <span className="text-orange-300 font-bold">$20/month</span> unlocks
          Signature Commercials, Perfect-Mate auto-dispatch, and the 1–2hr
          early-access prep window per booking.
        </p>

        {/* Perks */}
        <div className="grid md:grid-cols-3 gap-3 mb-6">
          <Perk icon={Sparkles} title="Signature Commercials" body="Run Dish Overlays inside venue 360° walkthroughs." />
          <Perk icon={ChefHat} title="Perfect-Mate Match" body="AI auto-pairs you with bookings that fit your style." />
          <Perk icon={CheckCircle2} title="Prep-Fee Up Front" body="Non-refundable percentage releases on confirm." />
        </div>

        <Card className="p-6 bg-[#0F0720] border border-orange-500/20 rounded-2xl space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <Field label="Artisan Type">
              <select
                value={form.artisan_type}
                onChange={(e) => setForm({ ...form, artisan_type: e.target.value })}
                className="w-full p-3 rounded-lg bg-[#1A0D2E] border border-orange-500/30 text-white"
                data-testid="vv-artisan-type"
              >
                <option value="chef">Chef</option>
                <option value="decorator">Decorator</option>
                <option value="setter">Setter</option>
              </select>
            </Field>
            <Field label="Display Name *">
              <input
                value={form.display_name}
                onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                placeholder="Chef Marie"
                className="w-full p-3 rounded-lg bg-[#1A0D2E] border border-orange-500/30 text-white"
                data-testid="vv-artisan-name"
              />
            </Field>
          </div>

          <Field label="Bio *">
            <textarea
              value={form.bio}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
              placeholder="French-Caribbean fusion, 8 yrs catering NYC private dinners…"
              rows={3}
              className="w-full p-3 rounded-lg bg-[#1A0D2E] border border-orange-500/30 text-white"
              data-testid="vv-artisan-bio"
            />
          </Field>

          <Field label="Signature Dishes (comma-separated)">
            <input
              value={form.signature_dishes}
              onChange={(e) => setForm({ ...form, signature_dishes: e.target.value })}
              placeholder="Coconut-braised oxtail, Saffron risotto, Tiramisu"
              className="w-full p-3 rounded-lg bg-[#1A0D2E] border border-orange-500/30 text-white"
              data-testid="vv-artisan-dishes"
            />
          </Field>

          <Field label="Service Area Zips (comma-separated)">
            <input
              value={form.service_area_zips}
              onChange={(e) => setForm({ ...form, service_area_zips: e.target.value })}
              placeholder="94110, 94117, 94103"
              className="w-full p-3 rounded-lg bg-[#1A0D2E] border border-orange-500/30 text-white"
              data-testid="vv-artisan-zips"
            />
          </Field>

          <div className="grid md:grid-cols-2 gap-4">
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
                testid="vv-artisan-photo-upload"
              />
            </Field>
            <Field label="Signature Commercial Video">
              <DirectUpload
                kind="commercial"
                accept="video"
                cameraCapture
                value={form.commercial_video_url}
                onChange={(u) => setForm({ ...form, commercial_video_url: u })}
                onThumbnail={(thumb) => {
                  setForm((prev) => {
                    if (!prev.cover_photo) {
                      setCoverIsAuto(true);
                      return { ...prev, cover_photo: thumb };
                    }
                    return prev;
                  });
                }}
                testid="vv-artisan-video-upload"
              />
            </Field>
          </div>

          <Field label="Base Service Rate (USD)">
            <input
              type="number"
              value={form.base_service_rate_usd}
              onChange={(e) => setForm({ ...form, base_service_rate_usd: parseFloat(e.target.value) || 0 })}
              className="w-full p-3 rounded-lg bg-[#1A0D2E] border border-orange-500/30 text-white"
              data-testid="vv-artisan-rate"
            />
          </Field>

          <Button
            onClick={submit}
            disabled={submitting}
            className="w-full bg-orange-500 hover:bg-orange-400 text-white font-bold py-6 rounded-xl shadow-[0_0_22px_rgba(249,115,22,0.45)]"
            data-testid="vv-artisan-submit-btn"
          >
            {submitting ? "Creating…" : "Create Artisan Profile"}
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

const Perk: React.FC<{ icon: React.ElementType; title: string; body: string }> = ({
  icon: Icon,
  title,
  body,
}) => (
  <div className="p-4 rounded-2xl bg-[#0F0720] border border-orange-500/20">
    <Icon className="w-5 h-5 text-orange-300 mb-2" />
    <p className="text-sm font-black text-white mb-1">{title}</p>
    <p className="text-xs text-orange-100/80 leading-relaxed">{body}</p>
  </div>
);
