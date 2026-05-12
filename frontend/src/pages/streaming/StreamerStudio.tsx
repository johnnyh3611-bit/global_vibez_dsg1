/**
 * StreamerStudio — the "go live in 60 seconds" surface.
 *
 * Provisions (or reads) the streamer's Cloudflare live input, then
 * shows the RTMP + SRT ingest credentials they need to paste into:
 *   • OBS Studio       (Desktop — PC/Mac/Linux)
 *   • Streamlabs       (Desktop or Mobile)
 *   • Larix Broadcaster (iOS / Android RTMP/SRT)
 *   • vMix / XSplit / Wirecast
 *   • Elgato Cam Link + Stream Deck
 *   • Console capture cards (Elgato HD60X → OBS → RTMP)
 *
 * Below the credentials we mount the HLSPlayer pointing at the same
 * live input, so the streamer can watch themselves go live as a
 * smoke test before announcing to their audience.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Radio, Copy, Check, Eye, EyeOff, ShieldCheck, RefreshCcw, Loader2, AlertTriangle, Sparkles, Cast, Star, X } from "lucide-react";
import { getUserId } from "@/utils/secureAuth";
import HLSPlayer from "@/components/streaming/HLSPlayer";

const API = process.env.REACT_APP_BACKEND_URL;

interface LiveInput {
  input_id: string;
  streamer_id: string;
  name: string;
  rtmps_url: string | null;
  rtmps_key: string | null;
  srt_url: string | null;
  srt_stream_id: string | null;
  srt_passphrase: string | null;
  hls_playback_url: string | null;
  dash_playback_url: string | null;
  is_live: boolean;
  mode: "live" | "stub";
  created_at: string;
}

export default function StreamerStudio() {
  const nav = useNavigate();
  const [input, setInput] = useState<LiveInput | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [showRtmpKey, setShowRtmpKey] = useState(false);
  const [showSrtPass, setShowSrtPass] = useState(false);
  const [provisioning, setProvisioning] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setErr(null);
    try {
      const uid = getUserId() || "anonymous";
      const r = await fetch(`${API}/api/streaming/cloudflare/live-inputs/by-streamer/${uid}`);
      if (r.status === 404) {
        setInput(null);
      } else if (!r.ok) {
        throw new Error(`Failed to load live input (${r.status})`);
      } else {
        const data = await r.json();
        setInput(data);
      }
    } catch (e: unknown) {
      setErr((e as Error)?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const provision = async () => {
    setProvisioning(true);
    setErr(null);
    try {
      const uid = getUserId() || "anonymous";
      const r = await fetch(`${API}/api/streaming/cloudflare/live-inputs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ streamer_id: uid, name: `${uid} · Vibez Live` }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => null);
        throw new Error(d?.detail || `Provision failed (${r.status})`);
      }
      const data = await r.json();
      setInput(data);
    } catch (e: unknown) {
      setErr((e as Error)?.message || "Provision failed");
    } finally {
      setProvisioning(false);
    }
  };

  const copy = async (label: string, value: string | null) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(label);
      setTimeout(() => setCopiedField(null), 1500);
    } catch {
      /* silent */
    }
  };

  return (
    <div className="min-h-screen bg-[#070012] text-white font-mono" data-testid="streamer-studio-root">
      {/* Header */}
      <header className="sticky top-0 z-20 backdrop-blur-xl bg-black/60 border-b border-fuchsia-500/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => nav(-1)}
              className="text-fuchsia-200/70 hover:text-white"
              aria-label="Back"
              data-testid="streamer-studio-back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <Cast className="w-6 h-6 text-fuchsia-300" />
            <div>
              <h1 className="text-base sm:text-lg font-black tracking-[0.25em] uppercase text-fuchsia-100">
                Streamer Studio
              </h1>
              <p className="text-[10px] text-fuchsia-300/60 tracking-widest uppercase">
                RTMP + SRT ingest · auto HLS playback · every device
              </p>
            </div>
          </div>
          <button
            onClick={load}
            className="p-2 rounded-full border border-fuchsia-500/30 hover:bg-fuchsia-500/10"
            data-testid="streamer-studio-refresh"
            aria-label="Refresh"
          >
            <RefreshCcw className="w-4 h-4" />
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {err && (
          <div className="rounded-xl border border-red-500/40 bg-red-900/20 text-red-200 px-3 py-2 text-xs flex items-center gap-2" data-testid="streamer-studio-error">
            <AlertTriangle className="w-4 h-4" /> {err}
          </div>
        )}

        {loading && (
          <div className="flex items-center gap-2 text-fuchsia-300/60 text-xs uppercase tracking-widest">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading studio…
          </div>
        )}

        {!loading && !input && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-fuchsia-500/30 bg-black/40 p-8 text-center"
            data-testid="streamer-studio-empty"
          >
            <Sparkles className="w-8 h-8 text-fuchsia-300 mx-auto" />
            <h2 className="mt-3 text-lg font-black uppercase tracking-widest">
              No live input provisioned
            </h2>
            <p className="text-xs text-fuchsia-200/70 mt-2 max-w-md mx-auto">
              We'll generate a private RTMP + SRT ingest URL for you. Paste
              it into OBS, Streamlabs, Larix, vMix, or any RTMP-capable
              device and you're live on Vibez TV.
            </p>
            <button
              onClick={provision}
              disabled={provisioning}
              className="mt-5 px-5 py-2.5 rounded-full bg-gradient-to-r from-fuchsia-500 to-cyan-400 text-black text-xs font-black uppercase tracking-widest disabled:opacity-50 inline-flex items-center gap-2"
              data-testid="streamer-studio-provision"
            >
              {provisioning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Radio className="w-4 h-4" />}
              {provisioning ? "Provisioning…" : "Provision My Ingest"}
            </button>
          </motion.div>
        )}

        {input && (
          <>
            {/* Mode banner */}
            {input.mode === "stub" && (
              <div
                className="rounded-xl border border-amber-500/40 bg-amber-900/20 text-amber-100 px-3 py-2 text-xs flex items-start gap-2"
                data-testid="streamer-studio-stub-banner"
              >
                <AlertTriangle className="w-4 h-4 mt-0.5" />
                <div>
                  <p className="font-bold uppercase tracking-widest text-[10px]">Demo mode</p>
                  <p className="text-amber-100/80 mt-0.5">
                    These credentials are placeholders. The platform owner is finishing the
                    Cloudflare Stream key wire-up. Once live, your ingest URL will activate
                    automatically with no action needed.
                  </p>
                </div>
              </div>
            )}

            {/* Live preview */}
            <section data-testid="streamer-studio-preview">
              <SectionTitle icon={<Eye className="w-4 h-4" />} label="Live preview" />
              <HLSPlayer
                src={input.hls_playback_url}
                isLive
                autoPlay
                className="mt-2"
              />
              <p className="mt-2 text-[11px] text-fuchsia-300/60">
                What viewers will see. ~3–5 second glass-to-glass latency on Cloudflare's
                global edge.
              </p>
            </section>

            {/* RTMP */}
            <section data-testid="streamer-studio-rtmp">
              <SectionTitle icon={<Radio className="w-4 h-4" />} label="RTMP ingest (OBS / Streamlabs / vMix / XSplit)" />
              <CredField
                testId="streamer-studio-rtmp-url"
                label="Server URL"
                value={input.rtmps_url}
                onCopy={(v) => copy("rtmp-url", v)}
                copied={copiedField === "rtmp-url"}
              />
              <CredField
                testId="streamer-studio-rtmp-key"
                label="Stream Key (keep secret)"
                value={input.rtmps_key}
                secret
                revealed={showRtmpKey}
                onToggleReveal={() => setShowRtmpKey((s) => !s)}
                onCopy={(v) => copy("rtmp-key", v)}
                copied={copiedField === "rtmp-key"}
              />
            </section>

            {/* SRT */}
            <section data-testid="streamer-studio-srt">
              <SectionTitle icon={<ShieldCheck className="w-4 h-4" />} label="SRT ingest (Larix · pro broadcast · low-latency)" />
              <CredField
                testId="streamer-studio-srt-url"
                label="SRT URL"
                value={input.srt_url}
                onCopy={(v) => copy("srt-url", v)}
                copied={copiedField === "srt-url"}
              />
              <CredField
                testId="streamer-studio-srt-streamid"
                label="Stream ID"
                value={input.srt_stream_id}
                onCopy={(v) => copy("srt-streamid", v)}
                copied={copiedField === "srt-streamid"}
              />
              <CredField
                testId="streamer-studio-srt-passphrase"
                label="Passphrase (encryption)"
                value={input.srt_passphrase}
                secret
                revealed={showSrtPass}
                onToggleReveal={() => setShowSrtPass((s) => !s)}
                onCopy={(v) => copy("srt-pass", v)}
                copied={copiedField === "srt-pass"}
              />
            </section>

            {/* Device cheat-sheet */}
            <section
              className="rounded-xl border border-fuchsia-500/20 bg-black/40 p-4"
              data-testid="streamer-studio-cheatsheet"
            >
              <h3 className="text-xs font-black uppercase tracking-widest text-fuchsia-100">
                Device cheat-sheet
              </h3>
              <ul className="mt-3 space-y-2 text-[11px] text-fuchsia-200/80">
                <li><b>OBS / Streamlabs Desktop:</b> Settings → Stream → Service: Custom → paste Server URL + Stream Key above.</li>
                <li><b>Larix Broadcaster (iOS / Android):</b> + New connection → choose RTMPS or SRT → paste credentials.</li>
                <li><b>PS5 / Xbox:</b> Use Elgato HD60X capture card → OBS on a PC → paste credentials.</li>
                <li><b>DSLR / mirrorless camera:</b> Cam Link / NDI HX Capture → OBS → paste credentials.</li>
                <li><b>vMix / XSplit / Wirecast:</b> Add stream destination → Custom RTMP → paste credentials.</li>
              </ul>
            </section>

            {/* Featured-tier upsell */}
            <FeaturedUpsell streamerId={input.streamer_id} />
          </>
        )}
      </main>
    </div>
  );
}

// ────────────────────────────────────────────── Featured upsell ──
interface FeatureStatus {
  streamer_id: string;
  is_featured: boolean;
  featured_until: string | null;
}

function FeaturedUpsell({ streamerId }: { streamerId: string }) {
  const [status, setStatus] = useState<FeatureStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API}/api/featured-streamers/status/${streamerId}`)
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => {});
  }, [streamerId]);

  const purchase = async () => {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(`${API}/api/featured-streamers/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          streamer_id: streamerId,
          return_url: `${window.location.origin}/streams/live`,
        }),
      });
      const data = await r.json();
      if (!r.ok || !data.checkout_url) {
        throw new Error(data?.detail || "Checkout failed");
      }
      // Redirect to Stripe-hosted page for the payment.
      window.location.href = data.checkout_url;
    } catch (e: unknown) {
      setErr((e as Error)?.message || "Checkout failed");
      setBusy(false);
    }
  };

  const daysLeft = status?.featured_until
    ? Math.max(
        0,
        Math.ceil(
          (new Date(status.featured_until).getTime() - Date.now()) / 86_400_000,
        ),
      )
    : 0;

  return (
    <section
      className="rounded-2xl border border-amber-300/40 bg-gradient-to-br from-amber-900/20 via-fuchsia-900/15 to-black/40 p-5 relative overflow-hidden"
      data-testid="streamer-studio-featured-upsell"
    >
      <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-amber-400/15 blur-3xl pointer-events-none" />
      <div className="relative flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0 flex-1">
          <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-amber-100">
            <Star className="w-4 h-4 text-amber-300" />
            {status?.is_featured ? "You're Featured" : "Featured Streamer Tier"}
          </h3>
          {status?.is_featured ? (
            <p
              className="text-xs text-amber-100/90 mt-2 leading-relaxed"
              data-testid="streamer-studio-featured-active"
            >
              You're pinned to the top of the Live Now Wall with a glowing
              gold badge. {daysLeft} day{daysLeft === 1 ? "" : "s"} left on
              your current grant. Extend now to stack 30 more days on top —
              no overlap penalty.
            </p>
          ) : (
            <p className="text-xs text-amber-100/80 mt-2 leading-relaxed">
              Get a glowing pinned position at the top of the Live Now Wall
              for 30 days. Featured streamers float above every other live
              broadcast, get a gold "★ Featured" badge, and become the first
              thing every new visitor to /streams/live sees.
            </p>
          )}
          {err && (
            <p
              className="mt-2 text-[11px] text-red-300"
              data-testid="streamer-studio-featured-error"
            >
              {err}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <div className="text-right">
            <div className="text-3xl font-black text-amber-200 leading-none">
              $5
            </div>
            <div className="text-[10px] uppercase tracking-widest text-amber-300/70 mt-1">
              / 30 days
            </div>
          </div>
          <button
            type="button"
            onClick={purchase}
            disabled={busy}
            className="px-4 py-2 rounded-full bg-gradient-to-r from-amber-400 to-amber-300 text-black text-xs font-black uppercase tracking-widest inline-flex items-center gap-2 hover:from-amber-300 hover:to-amber-200 disabled:opacity-50 transition-colors"
            data-testid="streamer-studio-featured-purchase"
          >
            {busy ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Star className="w-4 h-4" />
            )}
            {status?.is_featured ? "Extend 30 Days" : "Get Featured"}
          </button>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-3 text-[10px] uppercase tracking-widest text-amber-300/60">
        <span className="flex items-center gap-1">
          <ShieldCheck className="w-3 h-3" /> Stripe Checkout · PCI-compliant
        </span>
        <span>·</span>
        <span>Cancel anytime · No card on file required</span>
      </div>
    </section>
  );
}

function SectionTitle({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <h2 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-fuchsia-100">
      {icon} {label}
    </h2>
  );
}

function CredField({
  label,
  value,
  secret,
  revealed,
  onToggleReveal,
  onCopy,
  copied,
  testId,
}: {
  label: string;
  value: string | null;
  secret?: boolean;
  revealed?: boolean;
  onToggleReveal?: () => void;
  onCopy: (v: string) => void;
  copied: boolean;
  testId: string;
}) {
  const masked = secret && !revealed && value ? "•".repeat(Math.min(value.length, 28)) : value || "";
  return (
    <div className="mt-2">
      <label className="text-[10px] uppercase tracking-widest text-fuchsia-300/70">{label}</label>
      <div className="mt-1 flex items-center gap-2">
        <code
          className="flex-1 px-3 py-2 rounded-lg bg-black/60 border border-fuchsia-500/30 text-xs text-white truncate"
          data-testid={testId}
        >
          {masked || "—"}
        </code>
        {secret && (
          <button
            type="button"
            onClick={onToggleReveal}
            className="px-2 py-2 rounded-lg border border-fuchsia-500/30 text-fuchsia-200 hover:bg-fuchsia-500/10"
            aria-label={revealed ? "Hide" : "Reveal"}
            data-testid={`${testId}-reveal`}
          >
            {revealed ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        )}
        <button
          type="button"
          onClick={() => value && onCopy(value)}
          disabled={!value}
          className="px-2 py-2 rounded-lg border border-fuchsia-500/30 text-fuchsia-200 hover:bg-fuchsia-500/10 disabled:opacity-30"
          aria-label="Copy"
          data-testid={`${testId}-copy`}
        >
          {copied ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}
