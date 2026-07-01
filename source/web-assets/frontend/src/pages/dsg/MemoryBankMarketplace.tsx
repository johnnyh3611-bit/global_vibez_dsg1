/**
 * MemoryBankMarketplace — v6.5 Phase 4 frontend.
 *
 * Browse + buy DRM-locked cinema. Buyers can view their library and
 * issue HMAC-signed playback URLs (1-hour TTL).
 */
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Film, Library, Plus, RefreshCcw, Tag, Clock,
  ShoppingCart, PlayCircle, Lock,
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

interface CinemaContent {
  content_id: string;
  creator_id: string;
  title: string;
  price: number;
  duration_minutes: number;
  genre: string;
  rating: string;
  cover_art_url?: string | null;
  is_active: boolean;
}

interface LibraryItem {
  license_id: string;
  content_id: string;
  title: string;
  duration_minutes: number;
  purchased_at: string;
  purchase_price: number;
  status: string;
}

type Tab = "browse" | "library";

export default function MemoryBankMarketplace() {
  const nav = useNavigate();
  const [tab, setTab] = useState<Tab>("browse");
  const [content, setContent] = useState<CinemaContent[]>([]);
  const [library, setLibrary] = useState<LibraryItem[]>([]);
  const [buyer, setBuyer] = useState<string>(() =>
    localStorage.getItem("dsg_user_id") || "buyer_demo"
  );
  const [loading, setLoading] = useState(false);
  const [showPublish, setShowPublish] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [playUrl, setPlayUrl] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [c, l] = await Promise.all([
        fetch(`${API}/api/memory-bank/content`).then(r => r.json()),
        fetch(`${API}/api/memory-bank/library/${encodeURIComponent(buyer)}`).then(r => r.json()),
      ]);
      setContent(c.content || []);
      setLibrary(l.library || []);
    } catch (e: any) {
      setError(e?.message || "Failed to load Memory Bank");
    } finally {
      setLoading(false);
    }
  }, [buyer]);

  useEffect(() => { load(); }, [load]);

  const purchase = useCallback(async (item: CinemaContent) => {
    setError(null); setFeedback(null);
    try {
      const r = await fetch(`${API}/api/memory-bank/purchase`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content_id: item.content_id, buyer_id: buyer }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || `HTTP ${r.status}`);
      setFeedback(`🎟 License issued · paid $${data.purchase_price} · creator earned $${data.creator_payout.toFixed(2)}`);
      load();
    } catch (e: any) {
      setError(e?.message || "Purchase failed");
    }
  }, [buyer, load]);

  const issuePlayback = useCallback(async (item: LibraryItem) => {
    setError(null); setPlayUrl(null);
    try {
      const r = await fetch(`${API}/api/memory-bank/playback/url`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ license_id: item.license_id }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || "Could not issue playback");
      setPlayUrl(data.url);
      setFeedback(`🔗 1-hour signed playback URL issued for "${item.title}"`);
    } catch (e: any) {
      setError(e?.message || "Playback issue failed");
    }
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-rose-950/15 to-black text-white" data-testid="memory-bank-page">
      {/* HEADER */}
      <div className="sticky top-0 z-30 backdrop-blur-md bg-black/70 border-b border-rose-500/20">
        <div className="max-w-6xl mx-auto px-5 py-3 flex items-center gap-4">
          <button onClick={() => nav(-1)} data-testid="mb-back-btn" className="p-2 rounded-lg hover:bg-white/10"><ArrowLeft className="w-5 h-5" /></button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Film className="w-5 h-5 text-rose-400" />
              <h1 className="text-lg font-black tracking-wide uppercase">Memory Bank</h1>
              <span className="text-[10px] font-mono uppercase tracking-widest text-rose-300 bg-rose-500/10 border border-rose-500/30 px-2 py-0.5 rounded">DSG TV</span>
            </div>
            <p className="text-xs text-neutral-400 mt-0.5">DRM cinema · 70% creator / 30% platform · HMAC-signed 1h playback</p>
          </div>
          <button onClick={load} disabled={loading} data-testid="mb-refresh" className="p-2 rounded-lg hover:bg-white/10"><RefreshCcw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /></button>
        </div>

        {/* TAB BAR */}
        <div className="max-w-6xl mx-auto px-5 pb-3 flex gap-2 items-center flex-wrap">
          <button onClick={() => setTab("browse")} data-testid="mb-tab-browse" className={`px-4 py-1.5 rounded-full text-xs uppercase tracking-widest font-bold flex items-center gap-1.5 ${tab === "browse" ? "bg-rose-500 text-white" : "bg-white/5 hover:bg-white/10"}`}>
            <ShoppingCart className="w-3 h-3" /> Browse ({content.length})
          </button>
          <button onClick={() => setTab("library")} data-testid="mb-tab-library" className={`px-4 py-1.5 rounded-full text-xs uppercase tracking-widest font-bold flex items-center gap-1.5 ${tab === "library" ? "bg-rose-500 text-white" : "bg-white/5 hover:bg-white/10"}`}>
            <Library className="w-3 h-3" /> My Library ({library.length})
          </button>
          <div className="flex items-center gap-2 ml-auto text-xs">
            <span className="text-neutral-500 uppercase tracking-widest">As</span>
            <input
              value={buyer}
              onChange={e => { setBuyer(e.target.value); localStorage.setItem("dsg_user_id", e.target.value); }}
              data-testid="mb-buyer-id"
              className="bg-black border border-white/20 rounded px-2 py-1 font-mono w-32"
            />
            <button onClick={() => setShowPublish(true)} data-testid="mb-publish-btn" className="px-3 py-1.5 rounded-full text-xs uppercase tracking-widest font-bold bg-emerald-500/20 text-emerald-200 border border-emerald-500/40 hover:bg-emerald-500/30 flex items-center gap-1">
              <Plus className="w-3 h-3" /> Publish
            </button>
          </div>
        </div>
      </div>

      {/* FEEDBACK */}
      <div className="max-w-6xl mx-auto px-5 mt-3 space-y-2">
        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} data-testid="mb-error" className="rounded-lg border border-rose-500/40 bg-rose-950/30 px-3 py-2 text-rose-200 text-sm flex justify-between">
              <span>{error}</span><button onClick={() => setError(null)}>×</button>
            </motion.div>
          )}
          {feedback && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} data-testid="mb-feedback" className="rounded-lg border border-emerald-500/40 bg-emerald-950/30 px-3 py-2 text-emerald-200 text-sm flex justify-between">
              <span>{feedback}</span><button onClick={() => setFeedback(null)}>×</button>
            </motion.div>
          )}
          {playUrl && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} data-testid="mb-play-url" className="rounded-lg border border-cyan-500/40 bg-cyan-950/20 px-3 py-2 text-cyan-200 text-xs">
              <div className="font-bold uppercase tracking-widest mb-1 flex items-center gap-1"><PlayCircle className="w-3 h-3" /> Signed Playback URL</div>
              <div className="font-mono break-all opacity-80">{playUrl}</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* CONTENT */}
      <div className="max-w-6xl mx-auto px-5 py-5">
        {tab === "browse" ? (
          content.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-black/30 p-8 text-center text-neutral-400 text-sm" data-testid="mb-empty-browse">
              No films yet. Click "Publish" to add the first one.
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3" data-testid="mb-browse-grid">
              {content.map(c => (
                <ContentCard key={c.content_id} item={c} onBuy={() => purchase(c)} owned={library.some(l => l.content_id === c.content_id)} />
              ))}
            </div>
          )
        ) : (
          library.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-black/30 p-8 text-center text-neutral-400 text-sm" data-testid="mb-empty-library">
              No purchases yet. Buy something from the Browse tab.
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3" data-testid="mb-library-grid">
              {library.map(l => <LibraryCard key={l.license_id} item={l} onPlay={() => issuePlayback(l)} />)}
            </div>
          )
        )}
      </div>

      {/* PUBLISH MODAL */}
      <AnimatePresence>
        {showPublish && (
          <PublishModal onClose={() => setShowPublish(false)} onSaved={(msg) => { setFeedback(msg); setShowPublish(false); load(); }} />
        )}
      </AnimatePresence>
    </div>
  );
}

function ContentCard({ item, onBuy, owned }: { item: CinemaContent; onBuy: () => void; owned: boolean }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      data-testid={`mb-content-${item.content_id}`}
      className="rounded-2xl border border-rose-500/20 bg-gradient-to-br from-black via-black to-rose-950/30 overflow-hidden hover:border-rose-400/60 transition-colors group">
      <div className="aspect-video bg-gradient-to-br from-rose-900/40 via-purple-900/40 to-fuchsia-900/40 flex items-center justify-center">
        {item.cover_art_url ? <img src={item.cover_art_url} alt={item.title} className="w-full h-full object-cover" /> : <Film className="w-12 h-12 text-rose-300/50" />}
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between mb-1">
          <h3 className="font-bold text-base">{item.title}</h3>
          <span className="text-[9px] font-mono bg-white/10 px-1.5 py-0.5 rounded">{item.rating}</span>
        </div>
        <p className="text-[10px] uppercase tracking-widest text-neutral-500 font-mono">{item.creator_id}</p>
        <div className="flex flex-wrap gap-1.5 mt-2 text-[10px] uppercase tracking-widest">
          <span className="bg-white/5 border border-white/10 px-2 py-0.5 rounded">{item.genre}</span>
          <span className="bg-white/5 border border-white/10 px-2 py-0.5 rounded flex items-center gap-1"><Clock className="w-2.5 h-2.5" /> {item.duration_minutes}m</span>
        </div>
        <button onClick={onBuy} disabled={owned} data-testid={`mb-buy-${item.content_id}`}
          className="mt-3 w-full py-2 rounded-lg bg-rose-500 text-white text-xs font-black uppercase tracking-widest disabled:bg-emerald-700/50 disabled:cursor-default hover:bg-rose-400 flex items-center justify-center gap-1">
          {owned ? <><Lock className="w-3 h-3" /> Owned</> : <><Tag className="w-3 h-3" /> ${item.price.toFixed(2)}</>}
        </button>
      </div>
    </motion.div>
  );
}

function LibraryCard({ item, onPlay }: { item: LibraryItem; onPlay: () => void }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      data-testid={`mb-library-${item.license_id}`}
      className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-black via-black to-emerald-950/20 p-4 hover:border-emerald-400/60 transition-colors">
      <div className="flex items-start justify-between mb-2">
        <h3 className="font-bold text-base">{item.title}</h3>
        <span className="text-[9px] font-mono bg-emerald-500/20 text-emerald-200 border border-emerald-500/40 px-1.5 py-0.5 rounded uppercase tracking-widest">{item.status}</span>
      </div>
      <div className="text-[10px] text-neutral-500 font-mono mb-3">
        Bought {new Date(item.purchased_at).toLocaleDateString()} · ${item.purchase_price.toFixed(2)} · {item.duration_minutes}m
      </div>
      <button onClick={onPlay} data-testid={`mb-play-${item.license_id}`}
        className="w-full py-2 rounded-lg bg-emerald-500 text-black text-xs font-black uppercase tracking-widest hover:bg-emerald-400 flex items-center justify-center gap-1">
        <PlayCircle className="w-3 h-3" /> Issue Playback URL
      </button>
    </motion.div>
  );
}

function PublishModal({ onClose, onSaved }: { onClose: () => void; onSaved: (msg: string) => void }) {
  const [creator, setCreator] = useState("creator_demo");
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState(10.0);
  const [duration, setDuration] = useState(90);
  const [genre, setGenre] = useState("drama");
  const [rating, setRating] = useState("PG-13");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    if (!title.trim()) { setErr("Title required"); return; }
    setBusy(true); setErr(null);
    try {
      const r = await fetch(`${API}/api/memory-bank/content/publish`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creator_id: creator, title, price, duration_minutes: duration, genre, rating }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      onSaved(`📽 "${title}" published by ${creator} · $${price.toFixed(2)}`);
    } catch (e: any) {
      setErr(e?.message || "Publish failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <motion.div initial={{ scale: 0.9, y: 12 }} animate={{ scale: 1, y: 0 }} onClick={e => e.stopPropagation()}
        data-testid="mb-publish-modal"
        className="w-full max-w-md rounded-2xl border-2 border-rose-400/50 bg-black p-6 space-y-3">
        <h2 className="text-lg font-black uppercase tracking-widest">Publish Film</h2>
        {err && <div className="text-sm text-rose-300">{err}</div>}
        <Field label="Creator ID" value={creator} onChange={setCreator} testid="mb-pub-creator" />
        <Field label="Title" value={title} onChange={setTitle} testid="mb-pub-title" />
        <div className="grid grid-cols-2 gap-2">
          <Field label="Price ($)" type="number" value={String(price)} onChange={v => setPrice(parseFloat(v) || 10)} testid="mb-pub-price" />
          <Field label="Duration (min)" type="number" value={String(duration)} onChange={v => setDuration(parseInt(v) || 90)} testid="mb-pub-duration" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Genre" value={genre} onChange={setGenre} testid="mb-pub-genre" />
          <Field label="Rating" value={rating} onChange={setRating} testid="mb-pub-rating" />
        </div>
        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-xs uppercase tracking-widest font-bold">Cancel</button>
          <button onClick={submit} disabled={busy} data-testid="mb-pub-submit"
            className="flex-1 py-2 rounded-lg bg-rose-500 text-white text-xs uppercase tracking-widest font-black disabled:opacity-50">
            {busy ? "Publishing…" : "Publish"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function Field({ label, value, onChange, testid, type = "text" }: { label: string; value: string; onChange: (v: string) => void; testid: string; type?: string }) {
  return (
    <label className="block">
      <div className="text-[10px] uppercase tracking-widest text-neutral-400 mb-1">{label}</div>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        data-testid={testid}
        className="w-full bg-black border border-white/20 rounded-lg px-3 py-2 font-mono text-sm focus:border-rose-400 outline-none"
      />
    </label>
  );
}
