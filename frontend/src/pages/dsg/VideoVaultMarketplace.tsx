/**
 * VideoVaultMarketplace — sibling surface to BeatVaultMarketplace, but
 * for filmmakers, motion-graphics artists, B-roll stockers, stream
 * overlay designers, VFX template makers, tutorial creators.
 *
 * Every listing routes through the Content Rights ledger (DMCA queue
 * + signed time-limited download URLs + 10-day escrow), so when real
 * uploads land we already have IP protection wired.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Film,
  Plus,
  RefreshCcw,
  Coins,
  Layers,
  Tag,
  Sparkles,
  Lock,
  ShieldCheck,
  X,
} from "lucide-react";
import { getUserId } from "@/utils/secureAuth";

const API = process.env.REACT_APP_BACKEND_URL;

interface VideoListing {
  video_id: string;
  creator_id: string;
  title: string;
  description: string;
  category: string;
  license_tier: "standard" | "extended" | "exclusive";
  price_usd: number;
  duration_seconds: number;
  thumbnail_url?: string;
  preview_url?: string;
  tags: string[];
  use_count: number;
  is_active: boolean;
  created_at: string;
}

interface Stats {
  active_listings: number;
  by_category: Record<string, number>;
  valid_categories: string[];
  license_tiers: Record<string, number>;
}

const CATEGORY_LABELS: Record<string, string> = {
  clip: "Clips",
  b_roll: "B-Roll",
  motion_graphics: "Motion Graphics",
  music_video: "Music Videos",
  tutorial: "Tutorials",
  vfx_template: "VFX Templates",
  stream_overlay: "Stream Overlays",
  short_film: "Short Films",
};

const TIER_BADGE: Record<string, string> = {
  standard: "border-cyan-400/40 text-cyan-200 bg-cyan-500/10",
  extended: "border-amber-400/40 text-amber-200 bg-amber-500/10",
  exclusive: "border-fuchsia-400/50 text-fuchsia-200 bg-fuchsia-500/15",
};

function formatDuration(s: number) {
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m === 0) return `${r}s`;
  return `${m}m ${r.toString().padStart(2, "0")}s`;
}

export default function VideoVaultMarketplace() {
  const nav = useNavigate();
  const [videos, setVideos] = useState<VideoListing[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [showList, setShowList] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = new URL(`${API}/api/video-vault/videos`);
      if (categoryFilter) url.searchParams.set("category", categoryFilter);
      const [v, s] = await Promise.all([
        fetch(url.toString()).then((r) => r.json()),
        fetch(`${API}/api/video-vault/stats`).then((r) => r.json()),
      ]);
      setVideos(v.videos || []);
      setStats(s);
    } catch (e: unknown) {
      setError((e as Error)?.message || "Failed to load Video Vault");
    } finally {
      setLoading(false);
    }
  }, [categoryFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const purchase = useCallback(
    async (v: VideoListing) => {
      setFeedback(null);
      setError(null);
      const buyer = getUserId() || "anonymous";
      try {
        const r = await fetch(`${API}/api/video-vault/videos/${v.video_id}/use`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ buyer_user_id: buyer }),
        });
        if (!r.ok) {
          const d = await r.json().catch(() => null);
          throw new Error(d?.detail || `Purchase failed (${r.status})`);
        }
        const data = await r.json();
        setFeedback(
          `✅ Licensed "${v.title}" — download token expires in 5 min. Token: ${data.download_token?.slice(0, 18)}…`,
        );
        load();
      } catch (e: unknown) {
        setError((e as Error)?.message || "Purchase failed");
      }
    },
    [load],
  );

  const totalCount = useMemo(() => stats?.active_listings ?? 0, [stats]);

  return (
    <div
      className="min-h-screen bg-[#070012] text-white font-mono"
      data-testid="video-vault-root"
    >
      {/* Header */}
      <header className="sticky top-0 z-20 backdrop-blur-xl bg-black/60 border-b border-fuchsia-500/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => nav(-1)}
              className="text-fuchsia-200/70 hover:text-white"
              data-testid="video-vault-back"
              aria-label="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <Film className="w-6 h-6 text-fuchsia-300" />
            <div>
              <h1 className="text-base sm:text-lg font-black tracking-[0.25em] uppercase text-fuchsia-100">
                Video Vault
              </h1>
              <p className="text-[10px] text-fuchsia-300/60 tracking-widest uppercase">
                {totalCount} listings · DMCA-protected · signed downloads
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={load}
              className="p-2 rounded-full border border-fuchsia-500/30 hover:bg-fuchsia-500/10"
              data-testid="video-vault-refresh"
              aria-label="Refresh"
            >
              <RefreshCcw className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowList(true)}
              className="px-3 py-2 rounded-full bg-gradient-to-r from-fuchsia-500 to-cyan-400 text-black text-xs font-black uppercase tracking-widest flex items-center gap-2"
              data-testid="video-vault-list-cta"
            >
              <Plus className="w-4 h-4" /> List a Video
            </button>
          </div>
        </div>
      </header>

      {/* Category filter strip */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-4 pb-2 overflow-x-auto">
        <div className="flex items-center gap-2 min-w-max">
          <CategoryChip
            label="All"
            active={categoryFilter === ""}
            count={totalCount}
            onClick={() => setCategoryFilter("")}
            testId="video-vault-cat-all"
          />
          {stats?.valid_categories.map((c) => (
            <CategoryChip
              key={c}
              label={CATEGORY_LABELS[c] || c}
              count={stats.by_category[c] || 0}
              active={categoryFilter === c}
              onClick={() => setCategoryFilter(c)}
              testId={`video-vault-cat-${c}`}
            />
          ))}
        </div>
      </div>

      {/* Feedback / error banners */}
      {error && (
        <div
          className="max-w-7xl mx-auto px-4 sm:px-6 py-2 text-xs text-red-300"
          data-testid="video-vault-error"
        >
          {error}
        </div>
      )}
      {feedback && (
        <div
          className="max-w-7xl mx-auto px-4 sm:px-6 py-2 text-xs text-emerald-300"
          data-testid="video-vault-feedback"
        >
          {feedback}
        </div>
      )}

      {/* Grid */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pb-24">
        {loading && (
          <div className="text-center text-fuchsia-300/60 text-xs uppercase tracking-widest py-12">
            Loading vault…
          </div>
        )}
        {!loading && videos.length === 0 && (
          <EmptyState onListClick={() => setShowList(true)} />
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
          {videos.map((v) => (
            <VideoCard key={v.video_id} v={v} onPurchase={purchase} />
          ))}
        </div>
      </main>

      <AnimatePresence>
        {showList && (
          <ListVideoModal onClose={() => setShowList(false)} onListed={load} />
        )}
      </AnimatePresence>
    </div>
  );
}

// ──────────────────────────────────────────────  Components ──

function CategoryChip({
  label,
  count,
  active,
  onClick,
  testId,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  testId: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      className={`px-3 py-1.5 rounded-full border text-[10px] uppercase tracking-widest whitespace-nowrap ${
        active
          ? "bg-fuchsia-500/30 border-fuchsia-400 text-white"
          : "border-fuchsia-500/20 text-fuchsia-200/70 hover:bg-fuchsia-500/10"
      }`}
    >
      {label} · {count}
    </button>
  );
}

function VideoCard({
  v,
  onPurchase,
}: {
  v: VideoListing;
  onPurchase: (v: VideoListing) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-fuchsia-500/20 bg-gradient-to-br from-fuchsia-900/15 via-black/40 to-black/20 backdrop-blur-md overflow-hidden"
      data-testid={`video-vault-card-${v.video_id}`}
    >
      <div className="relative aspect-video bg-black/60 flex items-center justify-center overflow-hidden">
        {v.thumbnail_url ? (
          <img
            src={v.thumbnail_url}
            alt={v.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <Film className="w-12 h-12 text-fuchsia-500/40" />
        )}
        <span
          className={`absolute top-2 right-2 px-2 py-0.5 rounded-full border text-[9px] uppercase tracking-widest ${TIER_BADGE[v.license_tier]}`}
        >
          {v.license_tier}
        </span>
        <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded-full bg-black/70 text-[10px] text-white font-mono">
          {formatDuration(v.duration_seconds)}
        </span>
      </div>

      <div className="p-3">
        <h3 className="text-sm font-bold text-white truncate" title={v.title}>
          {v.title}
        </h3>
        <p
          className="text-[11px] text-fuchsia-300/60 mt-0.5 line-clamp-2"
          title={v.description}
        >
          {v.description || "No description"}
        </p>

        <div className="mt-2 flex flex-wrap gap-1">
          <span className="text-[9px] uppercase tracking-widest text-fuchsia-200/70 border border-fuchsia-500/30 rounded-full px-2 py-0.5">
            {CATEGORY_LABELS[v.category] || v.category}
          </span>
          {v.tags.slice(0, 2).map((t) => (
            <span
              key={t}
              className="text-[9px] uppercase tracking-widest text-cyan-200/70 border border-cyan-400/30 rounded-full px-2 py-0.5"
            >
              <Tag className="w-2.5 h-2.5 inline -mt-0.5 mr-1" />
              {t}
            </span>
          ))}
        </div>

        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-1 text-white font-black">
            <Coins className="w-4 h-4 text-amber-300" />
            <span data-testid={`video-vault-price-${v.video_id}`}>
              ${v.price_usd.toFixed(2)}
            </span>
          </div>
          <button
            type="button"
            onClick={() => onPurchase(v)}
            className="px-3 py-1.5 rounded-full bg-gradient-to-r from-cyan-400 to-fuchsia-500 text-black text-[10px] font-black uppercase tracking-widest flex items-center gap-1"
            data-testid={`video-vault-buy-${v.video_id}`}
          >
            <Lock className="w-3 h-3" /> License
          </button>
        </div>

        <div className="mt-2 text-[10px] text-fuchsia-300/40 flex items-center gap-3">
          <span className="flex items-center gap-1">
            <Layers className="w-3 h-3" /> {v.use_count} uses
          </span>
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3 h-3" /> DMCA-protected
          </span>
        </div>
      </div>
    </motion.div>
  );
}

function EmptyState({ onListClick }: { onListClick: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="mt-8 mx-auto max-w-xl text-center rounded-2xl border border-fuchsia-500/20 bg-black/40 p-8"
      data-testid="video-vault-empty"
    >
      <Sparkles className="w-8 h-8 text-fuchsia-300 mx-auto" />
      <h2 className="mt-3 text-lg font-black uppercase tracking-widest text-white">
        The vault is empty
      </h2>
      <p className="text-xs text-fuchsia-200/70 mt-2">
        Be the first creator to list a clip, B-roll pack, motion graphics
        template, or stream overlay. Every listing ships with DMCA
        protection + signed download URLs.
      </p>
      <button
        type="button"
        onClick={onListClick}
        className="mt-5 px-4 py-2 rounded-full bg-gradient-to-r from-fuchsia-500 to-cyan-400 text-black text-xs font-black uppercase tracking-widest"
        data-testid="video-vault-empty-list-cta"
      >
        List the first video
      </button>
    </motion.div>
  );
}

function ListVideoModal({
  onClose,
  onListed,
}: {
  onClose: () => void;
  onListed: () => void;
}) {
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "clip",
    license_tier: "standard",
    base_price_usd: 5,
    duration_seconds: 30,
    thumbnail_url: "",
    preview_url: "",
    master_url: "",
    tags: "",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setErr(null);
    try {
      const creator = getUserId() || "anonymous";
      const url = new URL(`${API}/api/video-vault/videos`);
      url.searchParams.set("creator_id", creator);
      const body = {
        ...form,
        tags: form.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      };
      const r = await fetch(url.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => null);
        throw new Error(d?.detail || `Listing failed (${r.status})`);
      }
      onListed();
      onClose();
    } catch (e: unknown) {
      setErr((e as Error)?.message || "Listing failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 30, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-2xl border border-fuchsia-500/30 bg-[#0a0018] p-5 max-h-[90vh] overflow-y-auto"
        data-testid="video-vault-list-modal"
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-black uppercase tracking-widest text-white">
            List a Video
          </h2>
          <button
            onClick={onClose}
            className="text-fuchsia-200/60 hover:text-white"
            aria-label="Close"
            data-testid="video-vault-list-close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3">
          <Field
            label="Title"
            value={form.title}
            onChange={(v) => setForm({ ...form, title: v })}
            testId="video-vault-form-title"
          />
          <Field
            label="Description"
            value={form.description}
            onChange={(v) => setForm({ ...form, description: v })}
            multiline
            testId="video-vault-form-description"
          />
          <div className="grid grid-cols-2 gap-3">
            <SelectField
              label="Category"
              value={form.category}
              options={Object.keys(CATEGORY_LABELS).map((k) => ({
                value: k,
                label: CATEGORY_LABELS[k],
              }))}
              onChange={(v) => setForm({ ...form, category: v })}
              testId="video-vault-form-category"
            />
            <SelectField
              label="License Tier"
              value={form.license_tier}
              options={[
                { value: "standard", label: "Standard (1x)" },
                { value: "extended", label: "Extended (3x)" },
                { value: "exclusive", label: "Exclusive (10x)" },
              ]}
              onChange={(v) => setForm({ ...form, license_tier: v })}
              testId="video-vault-form-tier"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Base Price (USD)"
              value={String(form.base_price_usd)}
              type="number"
              onChange={(v) => setForm({ ...form, base_price_usd: Number(v) || 0 })}
              testId="video-vault-form-price"
            />
            <Field
              label="Duration (sec)"
              value={String(form.duration_seconds)}
              type="number"
              onChange={(v) => setForm({ ...form, duration_seconds: Number(v) || 0 })}
              testId="video-vault-form-duration"
            />
          </div>
          <Field
            label="Thumbnail URL"
            value={form.thumbnail_url}
            onChange={(v) => setForm({ ...form, thumbnail_url: v })}
            testId="video-vault-form-thumbnail"
          />
          <Field
            label="Preview (watermarked sample) URL"
            value={form.preview_url}
            onChange={(v) => setForm({ ...form, preview_url: v })}
            testId="video-vault-form-preview"
          />
          <Field
            label="Master File URL (private)"
            value={form.master_url}
            onChange={(v) => setForm({ ...form, master_url: v })}
            testId="video-vault-form-master"
          />
          <Field
            label="Tags (comma-separated)"
            value={form.tags}
            onChange={(v) => setForm({ ...form, tags: v })}
            testId="video-vault-form-tags"
          />

          {err && (
            <div className="text-red-300 text-xs" data-testid="video-vault-form-error">
              {err}
            </div>
          )}

          <button
            type="button"
            onClick={submit}
            disabled={busy || !form.title || !form.master_url}
            className="w-full mt-2 py-2.5 rounded-full bg-gradient-to-r from-fuchsia-500 to-cyan-400 text-black text-xs font-black uppercase tracking-widest disabled:opacity-50"
            data-testid="video-vault-form-submit"
          >
            {busy ? "Listing…" : "List Video"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function Field({
  label,
  value,
  onChange,
  multiline,
  type = "text",
  testId,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  type?: string;
  testId: string;
}) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-widest text-fuchsia-300/70">
        {label}
      </span>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          data-testid={testId}
          className="mt-1 w-full px-3 py-2 rounded-lg bg-black/50 border border-fuchsia-500/30 text-white text-xs focus:outline-none focus:border-cyan-400"
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          data-testid={testId}
          className="mt-1 w-full px-3 py-2 rounded-lg bg-black/50 border border-fuchsia-500/30 text-white text-xs focus:outline-none focus:border-cyan-400"
        />
      )}
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
  testId,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  testId: string;
}) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-widest text-fuchsia-300/70">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        data-testid={testId}
        className="mt-1 w-full px-3 py-2 rounded-lg bg-black/50 border border-fuchsia-500/30 text-white text-xs focus:outline-none focus:border-cyan-400"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-black">
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
