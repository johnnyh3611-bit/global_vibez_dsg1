/**
 * /merchant/join — Business Brief Landing Page.
 *
 * Implements the "Scan Code Destination" section of
 * `dsg_merchant_strategy.pdf` (2026-05-16):
 *   • The Shift: What You Are Joining
 *   • Direct Merchant Edge — Hyper-Local Command, Vibe Shield, DSG Token
 *   • Founder's Stake Included — flat $100–$150 fee includes a $20 Chair
 *   • CTA: Launch Merchant Dashboard & Secure Chair
 *
 * Backend: /api/merchant/genius-phase + /api/merchant/onboard/checkout
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Crown,
  ShieldCheck,
  Radio,
  Coins,
  MapPin,
  Sparkles,
  ArrowRight,
  Loader2,
  Trophy,
} from "lucide-react";
import { toast } from "sonner";

const API = process.env.REACT_APP_BACKEND_URL;

interface GeniusPhase {
  phase: string;
  cap: number;
  claimed: number;
  remaining: number;
  claimed_pct: number;
  chair_price_usd: number;
  activation_fee_usd: { min: number; max: number };
  individual_ceiling: number;
  push_radius_miles: number;
  services: { id: string; label: string; desc: string }[];
  addons: { dsg_tv_flight_usd: number; push_blast_usd: number };
  stripe_configured: boolean;
}

export default function MerchantJoin() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [phase, setPhase] = useState<GeniusPhase | null>(null);
  const [busy, setBusy] = useState(false);

  // form
  const [merchantId, setMerchantId] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [service, setService] = useState("hunger_vibez");
  const [tier, setTier] = useState<100 | 125 | 150>(100);

  // Referral attribution — picks up `?ref=<merchant_id>` from QR-code
  // scans and persists it across the Stripe redirect.
  const refFromUrl = searchParams.get("ref") || "";
  const [referredBy, setReferredBy] = useState(refFromUrl);

  useEffect(() => {
    if (refFromUrl) {
      try {
        localStorage.setItem("dsg_merchant_ref", refFromUrl);
      } catch {
        /* ignore */
      }
      setReferredBy(refFromUrl);
    } else {
      try {
        const stored = localStorage.getItem("dsg_merchant_ref") || "";
        if (stored) setReferredBy(stored);
      } catch {
        /* ignore */
      }
    }
  }, [refFromUrl]);

  useEffect(() => {
    fetch(`${API}/api/merchant/genius-phase`)
      .then((r) => r.json())
      .then(setPhase)
      .catch(() => toast.error("Could not load Genius Phase status"));
  }, []);

  const remainingLabel = useMemo(() => {
    if (!phase) return "…";
    return `${phase.remaining.toLocaleString()} / ${phase.cap.toLocaleString()} chairs left`;
  }, [phase]);

  async function startCheckout() {
    if (!merchantId.trim() || !businessName.trim()) {
      toast.error("Enter a merchant ID and business name");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`${API}/api/merchant/onboard/checkout`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          merchant_id: merchantId.trim(),
          business_name: businessName.trim(),
          service,
          activation_fee_usd: tier,
          referred_by: referredBy || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.checkout_url) {
        if (res.status === 401) {
          toast.error("Please sign in to claim a merchant chair.");
          navigate("/auth/sign-in?next=/merchant/join");
          return;
        }
        throw new Error(data.detail || "Checkout failed");
      }
      // Remember the id so the dashboard can pick up after the redirect.
      try {
        localStorage.setItem("dsg_merchant_id", merchantId.trim());
      } catch (_e) {
        /* ignore */
      }
      window.location.href = data.checkout_url;
    } catch (e: any) {
      toast.error(e?.message || "Could not start checkout");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      data-testid="merchant-join-page"
      className="min-h-screen bg-gradient-to-br from-[#0c0716] via-[#120a23] to-[#070514] text-white"
    >
      {/* Hero */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 opacity-30 pointer-events-none">
          <div className="absolute -top-20 -left-20 w-96 h-96 rounded-full bg-fuchsia-500 blur-3xl" />
          <div className="absolute top-40 right-0 w-96 h-96 rounded-full bg-cyan-400 blur-3xl" />
        </div>
        <div className="relative mx-auto max-w-6xl px-6 pt-20 pb-14">
          <span className="inline-flex items-center gap-2 rounded-full border border-fuchsia-400/40 bg-fuchsia-400/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-fuchsia-200">
            <Sparkles className="h-3.5 w-3.5" /> Genius Phase — {remainingLabel}
          </span>
          <h1 className="mt-6 text-4xl sm:text-5xl lg:text-6xl font-black leading-tight">
            Stop renting space.<br />
            <span className="bg-gradient-to-r from-fuchsia-300 via-pink-200 to-cyan-200 bg-clip-text text-transparent">
              Own a chair at the table.
            </span>
          </h1>
          <p className="mt-6 max-w-2xl text-base text-white/70">
            Global Vibez DSG dismantles the predatory app model. One flat
            activation fee — no commissions, no subscriptions — buys you
            a <strong className="text-white">founding $20 Chair</strong>, permanent
            placement in your <strong className="text-white">3-mile</strong>{" "}
            hyper-local matching radius, Vibe Shield commercial protection,
            and DSG Token liquidity straight into your cash register.
          </p>

          {/* Live progress bar */}
          {phase && (
            <div className="mt-8 max-w-xl">
              <div className="flex justify-between text-xs text-white/60 mb-2">
                <span>Genius Phase chairs claimed</span>
                <span>{phase.claimed_pct.toFixed(2)}%</span>
              </div>
              <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, phase.claimed_pct)}%` }}
                  transition={{ duration: 0.8 }}
                  className="h-full bg-gradient-to-r from-fuchsia-400 via-pink-400 to-cyan-300"
                />
              </div>
            </div>
          )}

          {/* Referral attribution badge — visible when arriving from a QR scan */}
          {referredBy && (
            <div
              data-testid="merchant-join-ref-badge"
              className="mt-6 inline-flex items-center gap-2 rounded-full border border-emerald-300/40 bg-emerald-300/10 px-4 py-2 text-xs text-emerald-200"
            >
              <Trophy className="h-3.5 w-3.5" /> Referred by{" "}
              <strong className="text-white">{referredBy}</strong> · your activation
              will credit their recruiter leaderboard
            </div>
          )}
        </div>
      </header>

      {/* Three pillars */}
      <section className="mx-auto max-w-6xl px-6 py-10">
        <div className="grid gap-5 md:grid-cols-3">
          <PillarCard
            testId="pillar-hyper-local"
            icon={<MapPin className="h-6 w-6" />}
            title="Hyper-Local Command"
            body="Pinpoint routing matches your menu, inventory, and listings to users inside your exact neighborhood block."
          />
          <PillarCard
            testId="pillar-vibe-shield"
            icon={<ShieldCheck className="h-6 w-6" />}
            title="Vibe Shield Network"
            body="Verified customer profiles, strict security routing, and localized safety eliminate fraudulent orders and chargebacks."
          />
          <PillarCard
            testId="pillar-dsg-token"
            icon={<Coins className="h-6 w-6" />}
            title="DSG Token Liquidity"
            body="Users earn DSG tokens in gaming arenas and spend them directly at your register in real-time on Solana Token-2022."
          />
        </div>
      </section>

      {/* Founder's Stake — pricing */}
      <section className="mx-auto max-w-6xl px-6 py-6">
        <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-8 backdrop-blur">
          <div className="flex items-center gap-3">
            <Crown className="h-6 w-6 text-amber-300" />
            <h2 className="text-2xl font-bold">Founder's Stake Included</h2>
          </div>
          <p className="mt-3 max-w-2xl text-white/70">
            Your one-time activation fee automatically allocates{" "}
            <strong className="text-white">1 Genius Phase Chair ($20 value)</strong>{" "}
            to your business ledger. You're a stakeholder, not a renter.
            Scale up to {phase?.individual_ceiling ?? 100} chairs at $20
            each anytime from your dashboard.
          </p>

          {/* Form */}
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wider text-white/60">
                Merchant ID
              </label>
              <input
                data-testid="merchant-join-id"
                value={merchantId}
                onChange={(e) => setMerchantId(e.target.value)}
                placeholder="my-cafe-bk"
                className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 outline-none focus:border-fuchsia-300"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wider text-white/60">
                Business Name
              </label>
              <input
                data-testid="merchant-join-name"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="Brooklyn Vibez Café"
                className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 outline-none focus:border-fuchsia-300"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-xs uppercase tracking-wider text-white/60">
                Service Pillar
              </label>
              <div className="grid gap-2 sm:grid-cols-3">
                {(phase?.services ?? []).map((s) => (
                  <button
                    key={s.id}
                    data-testid={`merchant-join-service-${s.id}`}
                    onClick={() => setService(s.id)}
                    className={`rounded-xl border px-4 py-3 text-left transition ${
                      service === s.id
                        ? "border-fuchsia-300 bg-fuchsia-300/10"
                        : "border-white/10 bg-white/5 hover:border-white/30"
                    }`}
                  >
                    <div className="font-semibold">{s.label}</div>
                    <div className="text-xs text-white/60 mt-1">{s.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-xs uppercase tracking-wider text-white/60">
                Activation Tier (one-time, no subscription)
              </label>
              <div className="grid gap-2 sm:grid-cols-3">
                {[100, 125, 150].map((t) => (
                  <button
                    key={t}
                    data-testid={`merchant-join-tier-${t}`}
                    onClick={() => setTier(t as 100 | 125 | 150)}
                    className={`rounded-xl border px-4 py-4 text-center transition ${
                      tier === t
                        ? "border-amber-300 bg-amber-300/10"
                        : "border-white/10 bg-white/5 hover:border-white/30"
                    }`}
                  >
                    <div className="text-2xl font-black">${t}</div>
                    <div className="text-[10px] uppercase tracking-widest text-white/60 mt-1">
                      flat · includes 1 Chair
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button
            data-testid="merchant-join-cta"
            onClick={startCheckout}
            disabled={busy || !phase?.stripe_configured}
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-fuchsia-500 to-cyan-400 px-8 py-4 font-bold text-black shadow-[0_0_40px_-10px_rgba(244,114,182,0.7)] hover:shadow-[0_0_60px_-5px_rgba(244,114,182,0.9)] transition disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <ArrowRight className="h-5 w-5" />
            )}
            CLAIM FOUNDING SEAT &amp; LAUNCH STORE DASHBOARD
          </button>
          {!phase?.stripe_configured && (
            <p className="mt-3 text-xs text-amber-300">
              Stripe checkout is not configured in this environment. Add
              STRIPE_API_KEY to backend/.env to enable live payments.
            </p>
          )}
        </div>
      </section>

      {/* Add-ons preview */}
      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="flex items-center gap-3 mb-4">
          <Radio className="h-5 w-5 text-cyan-300" />
          <h3 className="text-xl font-bold">Scale-up Add-ons (post-onboard)</h3>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <AddonPreview
            testId="addon-preview-dsg-tv"
            title="DSG TV Automated Media Placement"
            price={`$${phase?.addons.dsg_tv_flight_usd ?? 49} / flight`}
            body="Drop a 15-second commercial into the 24/7 DSG TV broadcast network. Reaches local gamers, streaming hubs, and live tournaments inside your matching radius."
          />
          <AddonPreview
            testId="addon-preview-push-blast"
            title="Hyper-Local Push Blast"
            price={`$${phase?.addons.push_blast_usd ?? 19} / blast`}
            body={`Send one targeted push to every active user inside your ${phase?.push_radius_miles ?? 3}-mile radius. Flash specials, last-minute inventory, or grand opening pings.`}
          />
        </div>
      </section>

      <footer className="border-t border-white/5 py-6 text-center text-xs text-white/40">
        Genius Phase ledger · 50,000 chair hard-cap · 100-chair individual ceiling
        <button
          onClick={() => navigate("/merchant/ambassador")}
          className="ml-3 underline hover:text-white/70"
          data-testid="merchant-join-ambassador-link"
        >
          field ambassador playbook
        </button>
        <button
          onClick={() => navigate("/merchant/leaderboard")}
          className="ml-3 underline hover:text-white/70"
          data-testid="merchant-join-leaderboard-link"
        >
          recruiter leaderboard
        </button>
        <button
          onClick={() => navigate("/")}
          className="ml-3 underline hover:text-white/70"
          data-testid="merchant-join-back-home"
        >
          back to home
        </button>
      </footer>
    </div>
  );
}

function PillarCard({
  icon,
  title,
  body,
  testId,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  testId: string;
}) {
  return (
    <motion.div
      data-testid={testId}
      whileHover={{ y: -4 }}
      className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur"
    >
      <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500/30 to-cyan-500/30 text-white">
        {icon}
      </div>
      <h3 className="mt-4 text-lg font-bold">{title}</h3>
      <p className="mt-2 text-sm text-white/70 leading-relaxed">{body}</p>
    </motion.div>
  );
}

function AddonPreview({
  title,
  price,
  body,
  testId,
}: {
  title: string;
  price: string;
  body: string;
  testId: string;
}) {
  return (
    <div
      data-testid={testId}
      className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-transparent p-5"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h4 className="font-bold">{title}</h4>
        <span className="text-sm text-cyan-300 whitespace-nowrap">{price}</span>
      </div>
      <p className="mt-2 text-sm text-white/70 leading-relaxed">{body}</p>
    </div>
  );
}
