/**
 * /merchant/dashboard — Genius Phase Merchant Dashboard.
 *
 * Companion to /merchant/join. Implements the post-onboard portal from
 * `dsg_merchant_strategy.pdf` (2026-05-16):
 *   • Chair counter + Acquire Chair flow ($20 each, ceiling 100)
 *   • DSG TV ad-flight purchase
 *   • Hyper-Local Push Blast purchase + send (3-mile radius)
 *   • Genius Phase progress strip
 *
 * Handles three return paths from Stripe:
 *   ?merchant_session=…&kind=merchant_activation   → /onboard/verify
 *   ?merchant_session=…&kind=merchant_chair        → /acquire-chair/verify
 *   ?merchant_session=…&kind=merchant_addon_*      → /addon/verify
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";
import {
  Crown,
  Coins,
  Radio,
  Send,
  Loader2,
  Sparkles,
  TrendingUp,
  ShieldCheck,
  MapPin,
  Plus,
  Tv,
  QrCode,
  Megaphone,
  Copy,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";

const API = process.env.REACT_APP_BACKEND_URL;

interface Merchant {
  merchant_id: string;
  business_name: string;
  service: string;
  chairs_held: number;
  activation_fee_paid: number;
  push_radius_miles: number;
  vibe_shield_enabled: boolean;
  dsg_tv_placement: boolean;
  lat?: number | null;
  lng?: number | null;
  onboarded_at: string;
  credits: { dsg_tv_flights: number; push_blasts: number };
}

interface GeniusPhase {
  cap: number;
  claimed: number;
  remaining: number;
  claimed_pct: number;
  chair_price_usd: number;
  individual_ceiling: number;
  push_radius_miles: number;
  addons: { dsg_tv_flight_usd: number; push_blast_usd: number };
  stripe_configured: boolean;
}

export default function MerchantDashboard() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [phase, setPhase] = useState<GeniusPhase | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  // composers
  const [chairsToBuy, setChairsToBuy] = useState(1);
  const [flightsToBuy, setFlightsToBuy] = useState(1);
  const [blastsToBuy, setBlastsToBuy] = useState(1);
  const [blastHeadline, setBlastHeadline] = useState("");
  const [blastBody, setBlastBody] = useState("");
  const [adTitle, setAdTitle] = useState("");
  const [adZips, setAdZips] = useState("");
  const [qrCopied, setQrCopied] = useState(false);

  // recent activity
  const [recentBlasts, setRecentBlasts] = useState<any[]>([]);
  const [recentAds, setRecentAds] = useState<any[]>([]);

  // merchant id — read from localStorage (set by MerchantJoin) or URL.
  const storedId = useMemo(() => {
    try {
      return localStorage.getItem("dsg_merchant_id") || "";
    } catch {
      return "";
    }
  }, []);
  const [merchantId, setMerchantId] = useState(
    params.get("merchant_id") || storedId
  );

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const phaseRes = await fetch(`${API}/api/merchant/genius-phase`);
      setPhase(await phaseRes.json());
      if (merchantId) {
        const r = await fetch(`${API}/api/merchant/me/${encodeURIComponent(merchantId)}`);
        if (r.ok) {
          setMerchant(await r.json());
          // Load recent activity timelines in parallel.
          const [bRes, aRes] = await Promise.all([
            fetch(`${API}/api/merchant/push-blast/recent/${encodeURIComponent(merchantId)}?limit=10`),
            fetch(`${API}/api/merchant/dsg-tv/ads/${encodeURIComponent(merchantId)}?limit=10`),
          ]);
          setRecentBlasts(bRes.ok ? await bRes.json() : []);
          setRecentAds(aRes.ok ? await aRes.json() : []);
        } else {
          setMerchant(null);
        }
      }
    } catch (e: any) {
      toast.error(e?.message || "Failed to load merchant data");
    } finally {
      setLoading(false);
    }
  }, [merchantId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // ─── Handle Stripe return ────────────────────────────────────────
  useEffect(() => {
    const sid = params.get("merchant_session");
    const kind = params.get("kind");
    if (!sid || !kind || !merchantId || verifying) return;

    let endpoint = "";
    if (kind === "merchant_activation") endpoint = "/api/merchant/onboard/verify";
    else if (kind === "merchant_chair") endpoint = "/api/merchant/acquire-chair/verify";
    else if (kind.startsWith("merchant_addon")) endpoint = "/api/merchant/addon/verify";
    else return;

    setVerifying(true);
    fetch(`${API}${endpoint}`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sid, merchant_id: merchantId }),
    })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.detail || "Verification failed");
        if (kind === "merchant_activation") toast.success("Onboarded! Your $20 Chair is live.");
        else if (kind === "merchant_chair") toast.success(`Granted ${data.chairs_acquired} chair(s).`);
        else toast.success("Credit added to your account.");
      })
      .catch((e) => toast.error(e?.message || "Could not verify session"))
      .finally(() => {
        // Clear query params + reload state.
        setParams({}, { replace: true });
        setVerifying(false);
        loadAll();
      });
  }, [params, merchantId, verifying, setParams, loadAll]);

  // ─── Actions ────────────────────────────────────────────────────
  async function buyChairs() {
    if (!merchant) return;
    setBusy("chairs");
    try {
      const r = await fetch(`${API}/api/merchant/acquire-chair/checkout`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ merchant_id: merchant.merchant_id, chairs: chairsToBuy }),
      });
      const data = await r.json();
      if (!r.ok || !data.checkout_url) throw new Error(data.detail || "Checkout failed");
      window.location.href = data.checkout_url;
    } catch (e: any) {
      toast.error(e?.message || "Could not start checkout");
    } finally {
      setBusy(null);
    }
  }

  async function buyAddon(kind: "dsg-tv" | "push-blast") {
    if (!merchant) return;
    const qty = kind === "dsg-tv" ? flightsToBuy : blastsToBuy;
    setBusy(kind);
    try {
      const r = await fetch(`${API}/api/merchant/addon/${kind}/checkout`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ merchant_id: merchant.merchant_id, quantity: qty }),
      });
      const data = await r.json();
      if (!r.ok || !data.checkout_url) throw new Error(data.detail || "Checkout failed");
      window.location.href = data.checkout_url;
    } catch (e: any) {
      toast.error(e?.message || "Could not start checkout");
    } finally {
      setBusy(null);
    }
  }

  async function sendBlast() {
    if (!merchant) return;
    if (blastHeadline.length < 2 || blastBody.length < 2) {
      toast.error("Headline and body required");
      return;
    }
    setBusy("send");
    try {
      const r = await fetch(`${API}/api/merchant/push-blast/send`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          merchant_id: merchant.merchant_id,
          headline: blastHeadline,
          body: blastBody,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || "Could not send blast");
      const fan = data.fanout || {};
      toast.success(
        `Blast sent · ${fan.tokens_targeted ?? 0} devices targeted · ${fan.fcm_sent ?? 0} delivered`
      );
      setBlastHeadline("");
      setBlastBody("");
      loadAll();
    } catch (e: any) {
      toast.error(e?.message || "Could not send blast");
    } finally {
      setBusy(null);
    }
  }

  async function publishAd() {
    if (!merchant) return;
    if (adTitle.trim().length < 2) {
      toast.error("Ad title required");
      return;
    }
    setBusy("publish-ad");
    try {
      const zips = adZips
        .split(",")
        .map((z) => z.trim())
        .filter((z) => z.length > 0);
      const r = await fetch(`${API}/api/merchant/dsg-tv/publish-ad`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          merchant_id: merchant.merchant_id,
          title: adTitle.trim(),
          target_zip_codes: zips,
          duration_seconds: 15,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || "Could not publish ad");
      toast.success(
        `Ad scheduled to DSG TV · ${data.remaining_credits} flight(s) left`
      );
      setAdTitle("");
      setAdZips("");
      loadAll();
    } catch (e: any) {
      toast.error(e?.message || "Could not publish ad");
    } finally {
      setBusy(null);
    }
  }

  const referralUrl = useMemo(() => {
    if (!merchant) return "";
    const base = typeof window !== "undefined" ? window.location.origin : "";
    return `${base}/merchant/join?ref=${encodeURIComponent(merchant.merchant_id)}`;
  }, [merchant]);

  async function copyReferral() {
    if (!referralUrl) return;
    try {
      await navigator.clipboard.writeText(referralUrl);
      setQrCopied(true);
      setTimeout(() => setQrCopied(false), 1500);
    } catch {
      toast.error("Could not copy link");
    }
  }

  // ─── Empty state ─────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0716] text-white flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-fuchsia-300" />
      </div>
    );
  }

  if (!merchant) {
    return (
      <div
        data-testid="merchant-dashboard-empty"
        className="min-h-screen bg-[#0a0716] text-white flex items-center justify-center px-6"
      >
        <div className="max-w-md text-center space-y-5">
          <Crown className="mx-auto h-10 w-10 text-amber-300" />
          <h1 className="text-3xl font-bold">No merchant on file</h1>
          <p className="text-white/60">
            Enter your merchant ID to load your Genius Phase dashboard, or
            head back to the Business Brief to secure your chair.
          </p>
          <div className="flex gap-2">
            <input
              data-testid="merchant-dashboard-id-input"
              value={merchantId}
              onChange={(e) => setMerchantId(e.target.value)}
              placeholder="merchant-id"
              className="flex-1 rounded-xl bg-white/5 border border-white/10 px-4 py-3 outline-none focus:border-fuchsia-300"
            />
            <button
              data-testid="merchant-dashboard-load-btn"
              onClick={() => {
                try {
                  localStorage.setItem("dsg_merchant_id", merchantId);
                } catch {
                  /* ignore */
                }
                loadAll();
              }}
              className="rounded-xl bg-fuchsia-500 px-5 py-3 font-semibold text-black"
            >
              Load
            </button>
          </div>
          <button
            data-testid="merchant-dashboard-join-cta"
            onClick={() => navigate("/merchant/join")}
            className="text-sm text-cyan-300 underline"
          >
            ← back to Business Brief
          </button>
        </div>
      </div>
    );
  }

  const chairsCapped = merchant.chairs_held >= (phase?.individual_ceiling ?? 100);

  return (
    <div
      data-testid="merchant-dashboard-page"
      className="min-h-screen bg-gradient-to-br from-[#0c0716] via-[#120a23] to-[#070514] text-white"
    >
      {/* Header */}
      <header className="border-b border-white/5">
        <div className="mx-auto max-w-6xl px-6 py-6 flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-fuchsia-200">
              <Sparkles className="h-3.5 w-3.5" /> Genius Phase Dashboard
            </div>
            <h1 className="mt-1 text-2xl sm:text-3xl font-bold">
              {merchant.business_name}
            </h1>
            <div className="text-xs text-white/50 mt-1">
              id: {merchant.merchant_id} · {merchant.service}
            </div>
          </div>
          <button
            data-testid="merchant-dashboard-back"
            onClick={() => navigate("/merchant/join")}
            className="text-sm text-white/60 hover:text-white"
          >
            ← Business Brief
          </button>
        </div>
      </header>

      {/* Top stats */}
      <section className="mx-auto max-w-6xl px-6 py-8 grid gap-4 md:grid-cols-4">
        <StatCard
          testId="stat-chairs"
          icon={<Crown className="h-5 w-5 text-amber-300" />}
          label="Chairs Held"
          value={merchant.chairs_held.toString()}
          sub={`ceiling ${phase?.individual_ceiling ?? 100}`}
        />
        <StatCard
          testId="stat-radius"
          icon={<MapPin className="h-5 w-5 text-cyan-300" />}
          label="Push Radius"
          value={`${merchant.push_radius_miles} mi`}
          sub="hyper-local matching"
        />
        <StatCard
          testId="stat-dsg-tv"
          icon={<Tv className="h-5 w-5 text-fuchsia-300" />}
          label="DSG TV Flights"
          value={merchant.credits.dsg_tv_flights.toString()}
          sub="ready to broadcast"
        />
        <StatCard
          testId="stat-blasts"
          icon={<Radio className="h-5 w-5 text-emerald-300" />}
          label="Push Blasts"
          value={merchant.credits.push_blasts.toString()}
          sub="credits in account"
        />
      </section>

      {/* Genius Phase strip */}
      {phase && (
        <section className="mx-auto max-w-6xl px-6">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="flex justify-between text-xs text-white/60 mb-2">
              <span className="inline-flex items-center gap-2">
                <TrendingUp className="h-3.5 w-3.5" /> Genius Phase global
                progress
              </span>
              <span>
                {phase.claimed.toLocaleString()} / {phase.cap.toLocaleString()} ·{" "}
                {phase.claimed_pct.toFixed(2)}%
              </span>
            </div>
            <div className="h-2 rounded-full bg-white/10 overflow-hidden">
              <motion.div
                animate={{ width: `${Math.min(100, phase.claimed_pct)}%` }}
                transition={{ duration: 0.6 }}
                className="h-full bg-gradient-to-r from-fuchsia-400 via-pink-400 to-cyan-300"
              />
            </div>
          </div>
        </section>
      )}

      {/* Action grid */}
      <section className="mx-auto max-w-6xl px-6 py-8 grid gap-5 lg:grid-cols-2">
        {/* Acquire Chair */}
        <Panel
          testId="panel-acquire-chair"
          icon={<Crown className="h-5 w-5 text-amber-300" />}
          title="Acquire More Chairs"
          subtitle={`$${phase?.chair_price_usd ?? 20} each · uncapped equity · max ${
            phase?.individual_ceiling ?? 100
          } per merchant`}
        >
          <div className="flex items-center gap-3">
            <input
              data-testid="acquire-chair-qty"
              type="number"
              min={1}
              max={
                (phase?.individual_ceiling ?? 100) - merchant.chairs_held
              }
              value={chairsToBuy}
              onChange={(e) => setChairsToBuy(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-24 rounded-lg bg-white/5 border border-white/10 px-3 py-2 outline-none focus:border-amber-300"
            />
            <div className="flex-1 text-sm text-white/60">
              total: <strong className="text-white">${chairsToBuy * (phase?.chair_price_usd ?? 20)}</strong>
            </div>
            <button
              data-testid="acquire-chair-cta"
              disabled={busy === "chairs" || chairsCapped}
              onClick={buyChairs}
              className="inline-flex items-center gap-1 rounded-lg bg-amber-300 px-4 py-2 font-semibold text-black hover:brightness-110 disabled:opacity-40"
            >
              {busy === "chairs" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Buy chairs
            </button>
          </div>
          {chairsCapped && (
            <div className="mt-2 text-xs text-amber-300">
              You've hit the 100-chair individual ceiling.
            </div>
          )}
        </Panel>

        {/* DSG TV Add-on */}
        <Panel
          testId="panel-dsg-tv"
          icon={<Tv className="h-5 w-5 text-fuchsia-300" />}
          title="DSG TV Automated Media Placement"
          subtitle={`$${phase?.addons.dsg_tv_flight_usd ?? 49} per 15-sec flight · 24/7 broadcast network`}
        >
          <div className="flex items-center gap-3">
            <input
              data-testid="dsg-tv-qty"
              type="number"
              min={1}
              max={100}
              value={flightsToBuy}
              onChange={(e) => setFlightsToBuy(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-24 rounded-lg bg-white/5 border border-white/10 px-3 py-2 outline-none focus:border-fuchsia-300"
            />
            <div className="flex-1 text-sm text-white/60">
              total: <strong className="text-white">${(flightsToBuy * (phase?.addons.dsg_tv_flight_usd ?? 49)).toFixed(2)}</strong>
            </div>
            <button
              data-testid="dsg-tv-cta"
              disabled={busy === "dsg-tv"}
              onClick={() => buyAddon("dsg-tv")}
              className="inline-flex items-center gap-1 rounded-lg bg-fuchsia-400 px-4 py-2 font-semibold text-black hover:brightness-110 disabled:opacity-40"
            >
              {busy === "dsg-tv" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Buy flights
            </button>
          </div>
        </Panel>

        {/* Push Blast Add-on (purchase) */}
        <Panel
          testId="panel-push-blast-buy"
          icon={<Radio className="h-5 w-5 text-cyan-300" />}
          title="Buy Hyper-Local Push Blasts"
          subtitle={`$${phase?.addons.push_blast_usd ?? 19} per blast · ${merchant.push_radius_miles}-mile radius`}
        >
          <div className="flex items-center gap-3">
            <input
              data-testid="push-blast-qty"
              type="number"
              min={1}
              max={100}
              value={blastsToBuy}
              onChange={(e) => setBlastsToBuy(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-24 rounded-lg bg-white/5 border border-white/10 px-3 py-2 outline-none focus:border-cyan-300"
            />
            <div className="flex-1 text-sm text-white/60">
              total: <strong className="text-white">${(blastsToBuy * (phase?.addons.push_blast_usd ?? 19)).toFixed(2)}</strong>
            </div>
            <button
              data-testid="push-blast-cta"
              disabled={busy === "push-blast"}
              onClick={() => buyAddon("push-blast")}
              className="inline-flex items-center gap-1 rounded-lg bg-cyan-300 px-4 py-2 font-semibold text-black hover:brightness-110 disabled:opacity-40"
            >
              {busy === "push-blast" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Buy blasts
            </button>
          </div>
        </Panel>

        {/* Push Blast Compose + Send */}
        <Panel
          testId="panel-push-blast-send"
          icon={<Send className="h-5 w-5 text-emerald-300" />}
          title="Compose & Send Push Blast"
          subtitle={`uses 1 credit · pings every device in ${merchant.push_radius_miles}-mile radius`}
        >
          <input
            data-testid="blast-headline-input"
            value={blastHeadline}
            onChange={(e) => setBlastHeadline(e.target.value)}
            maxLength={120}
            placeholder="Tonight only — 30% off any large pie"
            className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 outline-none focus:border-emerald-300 mb-2"
          />
          <textarea
            data-testid="blast-body-input"
            value={blastBody}
            onChange={(e) => setBlastBody(e.target.value)}
            maxLength={300}
            rows={2}
            placeholder="Show this push at the counter from 8pm-close."
            className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 outline-none focus:border-emerald-300"
          />
          <button
            data-testid="blast-send-cta"
            disabled={busy === "send" || merchant.credits.push_blasts < 1}
            onClick={sendBlast}
            className="mt-3 inline-flex items-center gap-1 rounded-lg bg-emerald-300 px-4 py-2 font-semibold text-black hover:brightness-110 disabled:opacity-40"
          >
            {busy === "send" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Send Blast
          </button>
          {merchant.credits.push_blasts < 1 && (
            <div className="mt-2 text-xs text-amber-300">
              No credits — buy push blasts above first.
            </div>
          )}
        </Panel>
      </section>

      {/* DSG TV publish + QR Code row */}
      <section className="mx-auto max-w-6xl px-6 pb-8 grid gap-5 lg:grid-cols-2">
        {/* DSG TV publish-ad */}
        <Panel
          testId="panel-dsg-tv-publish"
          icon={<Megaphone className="h-5 w-5 text-fuchsia-300" />}
          title="Publish DSG TV Ad-Flight"
          subtitle="uses 1 flight credit · inserts into the 24/7 schedule"
        >
          <input
            data-testid="dsg-tv-ad-title"
            value={adTitle}
            onChange={(e) => setAdTitle(e.target.value)}
            maxLength={200}
            placeholder="Tonight's special — try our new lunch box"
            className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 outline-none focus:border-fuchsia-300 mb-2"
          />
          <input
            data-testid="dsg-tv-ad-zips"
            value={adZips}
            onChange={(e) => setAdZips(e.target.value)}
            placeholder="Target ZIPs (comma-separated, optional)"
            className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 outline-none focus:border-fuchsia-300"
          />
          <button
            data-testid="dsg-tv-publish-cta"
            disabled={busy === "publish-ad" || merchant.credits.dsg_tv_flights < 1}
            onClick={publishAd}
            className="mt-3 inline-flex items-center gap-1 rounded-lg bg-fuchsia-400 px-4 py-2 font-semibold text-black hover:brightness-110 disabled:opacity-40"
          >
            {busy === "publish-ad" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Megaphone className="h-4 w-4" />
            )}
            Schedule Ad
          </button>
          {merchant.credits.dsg_tv_flights < 1 && (
            <div className="mt-2 text-xs text-amber-300">
              No flight credits — buy DSG TV flights above first.
            </div>
          )}
        </Panel>

        {/* QR Code card */}
        <Panel
          testId="merchant-qr-card"
          icon={<QrCode className="h-5 w-5 text-cyan-300" />}
          title="Scan-Code · Recruit Neighbors"
          subtitle="Print this on receipts + storefront — prospects land on the Business Brief"
        >
          <div className="flex items-center gap-4">
            <div
              data-testid="merchant-qr-svg-wrap"
              className="rounded-xl bg-white p-3 flex items-center justify-center"
              style={{ width: 132, height: 132 }}
            >
              {referralUrl && (
                <QRCodeSVG value={referralUrl} size={108} includeMargin={false} />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-white/60 mb-1">Referral URL</div>
              <div className="truncate text-xs text-white/80">{referralUrl}</div>
              <button
                data-testid="merchant-qr-copy-btn"
                onClick={copyReferral}
                className="mt-2 inline-flex items-center gap-1 rounded-md bg-white/10 hover:bg-white/20 px-3 py-1.5 text-xs font-semibold"
              >
                {qrCopied ? (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />{" "}
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" /> Copy link
                  </>
                )}
              </button>
              <a
                href={`/merchant/join?ref=${encodeURIComponent(merchant.merchant_id)}`}
                target="_blank"
                rel="noreferrer"
                data-testid="merchant-qr-preview-link"
                className="ml-2 text-xs text-cyan-300 underline"
              >
                preview
              </a>
            </div>
          </div>
        </Panel>
      </section>

      {/* Recent activity timeline */}
      <section
        data-testid="recent-activity-section"
        className="mx-auto max-w-6xl px-6 pb-8 grid gap-5 lg:grid-cols-2"
      >
        <Panel
          testId="recent-blasts-panel"
          icon={<Radio className="h-5 w-5 text-cyan-300" />}
          title="Recent Push Blasts"
          subtitle="last 10 hyper-local pings with fan-out reach"
        >
          {recentBlasts.length === 0 ? (
            <div className="text-xs text-white/50 py-4 text-center">
              No blasts sent yet. Send your first push above.
            </div>
          ) : (
            <ul className="space-y-2 max-h-64 overflow-y-auto">
              {recentBlasts.map((b: any) => (
                <li
                  key={b.id}
                  data-testid="recent-blast-row"
                  className="rounded-lg bg-white/[0.03] border border-white/5 p-3"
                >
                  <div className="flex justify-between items-baseline gap-2">
                    <div className="font-semibold text-sm truncate">{b.headline}</div>
                    <div className="text-[10px] text-white/50 whitespace-nowrap">
                      {b.sent_at?.slice(0, 16).replace("T", " ")}
                    </div>
                  </div>
                  <div className="text-xs text-white/60 truncate">{b.body}</div>
                  {b.fanout && (
                    <div className="mt-1 text-[10px] text-cyan-300">
                      {b.fanout.tokens_targeted ?? 0} devices targeted ·{" "}
                      {b.fanout.fcm_sent ?? 0} delivered ·{" "}
                      {b.fanout.candidates_in_radius ?? 0} in radius
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          testId="recent-ads-panel"
          icon={<Tv className="h-5 w-5 text-fuchsia-300" />}
          title="Recent DSG TV Ad-Flights"
          subtitle="last 10 commercials scheduled to the 24/7 broadcast"
        >
          {recentAds.length === 0 ? (
            <div className="text-xs text-white/50 py-4 text-center">
              No ad-flights yet. Schedule your first commercial above.
            </div>
          ) : (
            <ul className="space-y-2 max-h-64 overflow-y-auto">
              {recentAds.map((a: any) => (
                <li
                  key={a.ad_id}
                  data-testid="recent-ad-row"
                  className="rounded-lg bg-white/[0.03] border border-white/5 p-3"
                >
                  <div className="flex justify-between items-baseline gap-2">
                    <div className="font-semibold text-sm truncate">{a.title}</div>
                    <div className="text-[10px] text-white/50 whitespace-nowrap">
                      {a.published_at?.slice(0, 16).replace("T", " ")}
                    </div>
                  </div>
                  <div className="text-xs text-white/60">
                    {a.duration_seconds}s ·{" "}
                    {a.target_zip_codes && a.target_zip_codes.length > 0
                      ? `ZIPs: ${a.target_zip_codes.join(", ")}`
                      : "no ZIP targeting"}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </section>

      {/* Benefits */}
      <section className="mx-auto max-w-6xl px-6 pb-12">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-300" /> Active Benefits
          </h3>
          <ul className="grid gap-2 sm:grid-cols-2 text-sm text-white/80">
            <li className="flex items-center gap-2">
              <Coins className="h-4 w-4 text-amber-300" /> ${merchant.activation_fee_paid} flat activation paid · no subscription
            </li>
            <li className="flex items-center gap-2">
              <Crown className="h-4 w-4 text-amber-300" /> Founding stakeholder ({merchant.chairs_held} × $20 Chair)
            </li>
            <li className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-300" /> Vibe Shield commercial threat protection
            </li>
            <li className="flex items-center gap-2">
              <Tv className="h-4 w-4 text-fuchsia-300" /> DSG TV placement enabled
            </li>
          </ul>
        </div>
      </section>
    </div>
  );
}

function StatCard({
  testId,
  icon,
  label,
  value,
  sub,
}: {
  testId: string;
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div
      data-testid={testId}
      className="rounded-2xl border border-white/10 bg-white/5 p-5"
    >
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-white/60">
        {icon} {label}
      </div>
      <div className="mt-2 text-3xl font-black">{value}</div>
      <div className="text-xs text-white/40 mt-1">{sub}</div>
    </div>
  );
}

function Panel({
  testId,
  icon,
  title,
  subtitle,
  children,
}: {
  testId: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div
      data-testid={testId}
      className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-transparent p-5"
    >
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <h3 className="font-bold">{title}</h3>
      </div>
      <div className="text-xs text-white/50 mb-4">{subtitle}</div>
      {children}
    </div>
  );
}
