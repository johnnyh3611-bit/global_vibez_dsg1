/**
 * VibeTvScheduler — v6.5 Phase 6 frontend.
 *
 * 24/7 channel ops surface. Creators publish episodes ($5/30m fee block),
 * advertisers publish ads (zip-targeted), and the schedule timeline shows
 * the next 24 hours of the channel with AI-injected ads woven between
 * episodes (every 2 episodes = 1 ad slot per founder spec).
 */
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Tv, Plus, RefreshCcw, Megaphone, Clock, Film, Tag,
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

interface Episode {
  episode_id: string;
  creator_id: string;
  title: string;
  duration_minutes: number;
  duration_seconds: number;
  genre: string;
  listing_fee_paid: number;
  is_active: boolean;
}

interface Ad {
  ad_id: string;
  advertiser_id: string;
  title: string;
  target_zip_codes: string[];
  duration_seconds: number;
  is_active: boolean;
}

interface Slot {
  slot_id: string;
  kind: "episode" | "ad";
  payload_id: string;
  title: string;
  starts_at: string;
  duration_seconds: number;
}

type Tab = "schedule" | "episodes" | "ads";

export default function VibeTvScheduler() {
  const nav = useNavigate();
  const [tab, setTab] = useState<Tab>("schedule");
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [ads, setAds] = useState<Ad[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [zip, setZip] = useState("10001");
  const [hours, setHours] = useState(6);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [showEpisodeModal, setShowEpisodeModal] = useState(false);
  const [showAdModal, setShowAdModal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [e, a] = await Promise.all([
        fetch(`${API}/api/vibe-tv/episodes`).then(r => r.json()),
        fetch(`${API}/api/vibe-tv/ads`).then(r => r.json()),
      ]);
      setEpisodes(e.episodes || []);
      setAds(a.ads || []);
      // Schedule may 400 if no episodes — treat as empty
      try {
        const s = await fetch(`${API}/api/vibe-tv/schedule?hours=${hours}&viewer_zip=${encodeURIComponent(zip)}`).then(r => r.json());
        setSlots(s.slots || []);
      } catch {
        setSlots([]);
      }
    } catch (e: any) {
      setError(e?.message || "Failed to load Vibe TV");
    } finally {
      setLoading(false);
    }
  }, [hours, zip]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-blue-950/15 to-black text-white" data-testid="vibe-tv-page">
      {/* HEADER */}
      <div className="sticky top-0 z-30 backdrop-blur-md bg-black/70 border-b border-blue-500/20">
        <div className="max-w-6xl mx-auto px-5 py-3 flex items-center gap-4">
          <button onClick={() => nav(-1)} data-testid="tv-back-btn" className="p-2 rounded-lg hover:bg-white/10"><ArrowLeft className="w-5 h-5" /></button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Tv className="w-5 h-5 text-blue-400" />
              <h1 className="text-lg font-black tracking-wide uppercase">Vibe TV Scheduler</h1>
              <span className="text-[10px] font-mono uppercase tracking-widest text-blue-300 bg-blue-500/10 border border-blue-500/30 px-2 py-0.5 rounded">DSG TV</span>
            </div>
            <p className="text-xs text-neutral-400 mt-0.5">24/7 channel · $5/30m listing · zip-targeted AI ads · 2 eps then 1 ad</p>
          </div>
          <button onClick={load} disabled={loading} data-testid="tv-refresh" className="p-2 rounded-lg hover:bg-white/10"><RefreshCcw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /></button>
        </div>

        {/* TABS */}
        <div className="max-w-6xl mx-auto px-5 pb-3 flex gap-2 flex-wrap items-center">
          <button onClick={() => setTab("schedule")} data-testid="tv-tab-schedule" className={`px-4 py-1.5 rounded-full text-xs uppercase tracking-widest font-bold flex items-center gap-1.5 ${tab === "schedule" ? "bg-blue-500 text-white" : "bg-white/5 hover:bg-white/10"}`}>
            <Clock className="w-3 h-3" /> Schedule ({slots.length})
          </button>
          <button onClick={() => setTab("episodes")} data-testid="tv-tab-episodes" className={`px-4 py-1.5 rounded-full text-xs uppercase tracking-widest font-bold flex items-center gap-1.5 ${tab === "episodes" ? "bg-blue-500 text-white" : "bg-white/5 hover:bg-white/10"}`}>
            <Film className="w-3 h-3" /> Episodes ({episodes.length})
          </button>
          <button onClick={() => setTab("ads")} data-testid="tv-tab-ads" className={`px-4 py-1.5 rounded-full text-xs uppercase tracking-widest font-bold flex items-center gap-1.5 ${tab === "ads" ? "bg-blue-500 text-white" : "bg-white/5 hover:bg-white/10"}`}>
            <Megaphone className="w-3 h-3" /> Ads ({ads.length})
          </button>
          <div className="ml-auto flex items-center gap-2 text-[10px]">
            <button onClick={() => setShowEpisodeModal(true)} data-testid="tv-add-episode-btn"
              className="px-3 py-1 rounded-full uppercase tracking-widest font-bold bg-emerald-500/20 text-emerald-200 border border-emerald-500/40 hover:bg-emerald-500/30 flex items-center gap-1">
              <Plus className="w-3 h-3" /> Episode
            </button>
            <button onClick={() => setShowAdModal(true)} data-testid="tv-add-ad-btn"
              className="px-3 py-1 rounded-full uppercase tracking-widest font-bold bg-amber-500/20 text-amber-200 border border-amber-500/40 hover:bg-amber-500/30 flex items-center gap-1">
              <Plus className="w-3 h-3" /> Ad
            </button>
          </div>
        </div>
      </div>

      {/* FEEDBACK */}
      <div className="max-w-6xl mx-auto px-5 mt-3 space-y-2">
        <AnimatePresence>
          {error && (<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} data-testid="tv-error"
              className="rounded-lg border border-rose-500/40 bg-rose-950/30 px-3 py-2 text-rose-200 text-sm flex justify-between"><span>{error}</span><button onClick={() => setError(null)}>×</button></motion.div>)}
          {feedback && (<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} data-testid="tv-feedback"
              className="rounded-lg border border-emerald-500/40 bg-emerald-950/30 px-3 py-2 text-emerald-200 text-sm flex justify-between"><span>{feedback}</span><button onClick={() => setFeedback(null)}>×</button></motion.div>)}
        </AnimatePresence>
      </div>

      {/* CONTENT */}
      <div className="max-w-6xl mx-auto px-5 py-5">
        {tab === "schedule" && (
          <ScheduleView slots={slots} hours={hours} setHours={setHours} zip={zip} setZip={setZip} reload={load} />
        )}
        {tab === "episodes" && <EpisodesGrid episodes={episodes} />}
        {tab === "ads" && <AdsGrid ads={ads} />}
      </div>

      <AnimatePresence>
        {showEpisodeModal && (
          <PublishEpisodeModal onClose={() => setShowEpisodeModal(false)}
            onSaved={(msg) => { setFeedback(msg); setShowEpisodeModal(false); load(); }} />
        )}
        {showAdModal && (
          <PublishAdModal onClose={() => setShowAdModal(false)}
            onSaved={(msg) => { setFeedback(msg); setShowAdModal(false); load(); }} />
        )}
      </AnimatePresence>
    </div>
  );
}

function ScheduleView({ slots, hours, setHours, zip, setZip, reload }: {
  slots: Slot[]; hours: number; setHours: (n: number) => void; zip: string; setZip: (z: string) => void; reload: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-white/10 bg-black/30 p-4 flex flex-wrap items-end gap-3">
        <label className="flex flex-col text-xs">
          <span className="text-neutral-400 uppercase tracking-widest mb-1">Horizon (hours)</span>
          <select value={hours} onChange={e => setHours(parseInt(e.target.value))} data-testid="tv-horizon"
            className="bg-black border border-white/20 rounded-lg px-3 py-2 font-mono">
            {[2, 6, 12, 24, 48].map(h => <option key={h} value={h}>{h}h</option>)}
          </select>
        </label>
        <label className="flex flex-col text-xs">
          <span className="text-neutral-400 uppercase tracking-widest mb-1">Viewer Zip</span>
          <input value={zip} onChange={e => setZip(e.target.value)} data-testid="tv-zip"
            className="bg-black border border-white/20 rounded-lg px-3 py-2 font-mono w-32" />
        </label>
        <button onClick={reload} data-testid="tv-regen-schedule"
          className="ml-auto px-5 py-2 rounded-full bg-blue-500 text-white text-xs uppercase tracking-widest font-black hover:bg-blue-400">
          Regenerate
        </button>
      </div>

      {slots.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-black/30 p-8 text-center text-neutral-400 text-sm" data-testid="tv-empty-schedule">
          Schedule is empty. Publish at least one episode to see the channel timeline.
        </div>
      ) : (
        <ul className="space-y-1.5" data-testid="tv-schedule-list">
          {slots.map(s => (
            <li key={s.slot_id} data-testid={`tv-slot-${s.slot_id}`}
              className={`rounded-lg border px-3 py-2 flex items-center gap-3 ${s.kind === "ad" ? "border-amber-500/30 bg-amber-950/20" : "border-blue-500/20 bg-blue-950/20"}`}>
              <span className={`text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded ${s.kind === "ad" ? "bg-amber-500/20 text-amber-200" : "bg-blue-500/20 text-blue-200"}`}>{s.kind}</span>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{s.title}</div>
                <div className="text-[10px] text-neutral-500">starts {new Date(s.starts_at).toLocaleTimeString()} · {Math.round(s.duration_seconds / 60)}min</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EpisodesGrid({ episodes }: { episodes: Episode[] }) {
  if (episodes.length === 0) return <Empty text="No episodes published yet." />;
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3" data-testid="tv-episodes-grid">
      {episodes.map(e => (
        <div key={e.episode_id} data-testid={`tv-episode-${e.episode_id}`}
          className="rounded-xl border border-blue-500/20 bg-black/40 p-3">
          <h3 className="font-bold text-sm">{e.title}</h3>
          <p className="text-[10px] text-neutral-500 font-mono">{e.creator_id}</p>
          <div className="flex flex-wrap gap-1.5 mt-2 text-[10px] uppercase tracking-widest">
            <span className="bg-white/5 border border-white/10 px-2 py-0.5 rounded">{e.genre}</span>
            <span className="bg-white/5 border border-white/10 px-2 py-0.5 rounded flex items-center gap-1"><Clock className="w-2.5 h-2.5" /> {e.duration_minutes}m</span>
            <span className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 px-2 py-0.5 rounded flex items-center gap-1"><Tag className="w-2.5 h-2.5" /> ${e.listing_fee_paid.toFixed(2)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function AdsGrid({ ads }: { ads: Ad[] }) {
  if (ads.length === 0) return <Empty text="No ads in rotation. Click '+ Ad' to publish a Mom & Pop spot." />;
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3" data-testid="tv-ads-grid">
      {ads.map(a => (
        <div key={a.ad_id} data-testid={`tv-ad-${a.ad_id}`}
          className="rounded-xl border border-amber-500/20 bg-black/40 p-3">
          <h3 className="font-bold text-sm">{a.title}</h3>
          <p className="text-[10px] text-neutral-500 font-mono">{a.advertiser_id}</p>
          <div className="flex flex-wrap gap-1.5 mt-2 text-[10px] uppercase tracking-widest">
            <span className="bg-white/5 border border-white/10 px-2 py-0.5 rounded">{a.duration_seconds}s</span>
            {a.target_zip_codes.length === 0 ? (
              <span className="bg-purple-500/10 border border-purple-500/30 text-purple-200 px-2 py-0.5 rounded">national</span>
            ) : a.target_zip_codes.map(z => (
              <span key={z} className="bg-amber-500/10 border border-amber-500/30 text-amber-200 px-2 py-0.5 rounded">📍 {z}</span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-2xl border border-white/10 bg-black/30 p-8 text-center text-neutral-400 text-sm" data-testid="tv-empty">{text}</div>;
}

function PublishEpisodeModal({ onClose, onSaved }: { onClose: () => void; onSaved: (msg: string) => void }) {
  const [creator, setCreator] = useState("creator_demo");
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState(30);
  const [genre, setGenre] = useState("drama");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    if (!title.trim()) { setErr("Title required"); return; }
    setBusy(true); setErr(null);
    try {
      const r = await fetch(`${API}/api/vibe-tv/episodes/publish`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creator_id: creator, title, duration_minutes: duration, genre }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || "Publish failed");
      onSaved(`📺 "${title}" published · listing fee $${data.listing_fee_paid}`);
    } catch (e: any) { setErr(e?.message || "Publish failed"); }
    finally { setBusy(false); }
  };

  return (
    <Modal title="Publish Episode" onClose={onClose} testid="tv-ep-modal" submit={submit} submitLabel="Publish" busy={busy} error={err} accent="blue">
      <Field label="Creator ID" v={creator} setV={setCreator} testid="tv-ep-creator" />
      <Field label="Title" v={title} setV={setTitle} testid="tv-ep-title" />
      <div className="grid grid-cols-2 gap-2">
        <Field label="Duration (min)" type="number" v={String(duration)} setV={v => setDuration(parseInt(v) || 30)} testid="tv-ep-duration" />
        <Field label="Genre" v={genre} setV={setGenre} testid="tv-ep-genre" />
      </div>
      <div className="text-[10px] text-neutral-400">Listing fee: ${Math.ceil(duration / 30) * 5}.00 (per founder spec — $5 / 30-min block)</div>
    </Modal>
  );
}

function PublishAdModal({ onClose, onSaved }: { onClose: () => void; onSaved: (msg: string) => void }) {
  const [advertiser, setAdvertiser] = useState("local_pizza_co");
  const [title, setTitle] = useState("");
  const [zips, setZips] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    if (!title.trim()) { setErr("Title required"); return; }
    setBusy(true); setErr(null);
    try {
      const r = await fetch(`${API}/api/vibe-tv/ads/publish`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          advertiser_id: advertiser, title,
          target_zip_codes: zips.split(",").map(z => z.trim()).filter(Boolean),
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || "Publish failed");
      onSaved(`📣 Ad "${title}" live · ${zips ? `targeting ${zips}` : "national"}`);
    } catch (e: any) { setErr(e?.message || "Publish failed"); }
    finally { setBusy(false); }
  };

  return (
    <Modal title="Publish Ad" onClose={onClose} testid="tv-ad-modal" submit={submit} submitLabel="Publish" busy={busy} error={err} accent="amber">
      <Field label="Advertiser ID" v={advertiser} setV={setAdvertiser} testid="tv-ad-advertiser" />
      <Field label="Title" v={title} setV={setTitle} testid="tv-ad-title" />
      <Field label="Target Zip Codes (comma-sep · empty = national)" v={zips} setV={setZips} testid="tv-ad-zips" />
    </Modal>
  );
}

function Modal({ title, onClose, testid, submit, submitLabel, busy, error, accent, children }: any) {
  const accentBorder = accent === "blue" ? "border-blue-400/50" : "border-amber-400/50";
  const accentBg = accent === "blue" ? "bg-blue-500" : "bg-amber-500";
  const accentTxt = accent === "blue" ? "text-white" : "text-black";
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} onClick={e => e.stopPropagation()}
        data-testid={testid}
        className={`w-full max-w-md rounded-2xl border-2 ${accentBorder} bg-black p-6 space-y-3`}>
        <h2 className="text-lg font-black uppercase tracking-widest">{title}</h2>
        {error && <div className="text-sm text-rose-300">{error}</div>}
        {children}
        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-xs uppercase tracking-widest font-bold">Cancel</button>
          <button onClick={submit} disabled={busy} data-testid={`${testid}-submit`}
            className={`flex-1 py-2 rounded-lg ${accentBg} ${accentTxt} text-xs uppercase tracking-widest font-black disabled:opacity-50`}>
            {busy ? `${submitLabel}…` : submitLabel}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function Field({ label, v, setV, testid, type = "text" }: { label: string; v: string; setV: (s: string) => void; testid: string; type?: string }) {
  return (
    <label className="block">
      <div className="text-[10px] uppercase tracking-widest text-neutral-400 mb-1">{label}</div>
      <input type={type} value={v} onChange={e => setV(e.target.value)} data-testid={testid}
        className="w-full bg-black border border-white/20 rounded-lg px-3 py-2 font-mono text-sm" />
    </label>
  );
}
