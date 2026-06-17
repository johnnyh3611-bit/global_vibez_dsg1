/**
 * BeatVaultMarketplace — combined surface for v6.5 Phase 3 (Beat Vault
 * $0.50/use) and v7 Phase 8 (sealed-bid Beat Auctions).
 *
 * Producers list beats, artists buy uses or open exclusive-rights auctions,
 * everyone can see live bid counts (NEVER amounts — sealed-bid privacy).
 */
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Music4, Gavel, ShoppingBag, Plus, RefreshCcw,
  Tag, Activity, Coins,
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

interface Beat {
  beat_id: string;
  producer_id: string;
  title: string;
  bpm: number;
  genre: string;
  use_count: number;
  is_active: boolean;
}

interface Auction {
  auction_id: string;
  beat_id: string;
  producer_id: string;
  reserve_price: number;
  opens_at: string;
  closes_at: string;
  status: "live" | "settled" | "voided";
  bid_count: number;
  is_open: boolean;
}

type Tab = "vault" | "auctions";

export default function BeatVaultMarketplace() {
  const nav = useNavigate();
  const [tab, setTab] = useState<Tab>("vault");
  const [beats, setBeats] = useState<Beat[]>([]);
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddBeat, setShowAddBeat] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [b, a] = await Promise.all([
        fetch(`${API}/api/freestyle/beats`).then(r => r.json()),
        fetch(`${API}/api/auctions/`).then(r => r.json()),
      ]);
      setBeats(b.beats || []);
      setAuctions(a.auctions || []);
    } catch (e: any) {
      setError(e?.message || "Failed to load marketplace");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const useBeat = useCallback(async (beat: Beat) => {
    setFeedback(null);
    const r = await fetch(`${API}/api/freestyle/beats/${beat.beat_id}/use`, { method: "POST" });
    if (!r.ok) { setError("Could not record beat use"); return; }
    const data = await r.json();
    setFeedback(`✅ Used "${beat.title}" — producer paid $${data.producer_payout.toFixed(2)}`);
    load();
  }, [load]);

  const openAuction = useCallback(async (beat: Beat) => {
    const reserveStr = window.prompt(`Reserve price for exclusive rights to "${beat.title}" ($USD)?`, "50");
    if (!reserveStr) return;
    const reserve = parseFloat(reserveStr);
    if (Number.isNaN(reserve) || reserve <= 0) { setError("Reserve must be a positive number"); return; }
    setFeedback(null);
    const r = await fetch(`${API}/api/auctions/open`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        beat_id: beat.beat_id, producer_id: beat.producer_id,
        reserve_price: reserve, window_hours: 24,
      }),
    });
    if (!r.ok) { setError("Auction open failed"); return; }
    setFeedback(`✅ Auction opened for "${beat.title}" · 24h window · reserve $${reserve}`);
    setTab("auctions");
    load();
  }, [load]);

  const submitBid = useCallback(async (a: Auction) => {
    const bidStr = window.prompt(`Sealed bid for auction (reserve $${a.reserve_price})?`, `${a.reserve_price + 10}`);
    if (!bidStr) return;
    const amount = parseFloat(bidStr);
    if (Number.isNaN(amount) || amount <= 0) return;
    const bidder = window.prompt("Your bidder ID?", "artist_anon");
    if (!bidder) return;
    setFeedback(null);
    const r = await fetch(`${API}/api/auctions/bid`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ auction_id: a.auction_id, bidder_id: bidder, amount }),
    });
    if (!r.ok) { setError("Bid rejected (closed, self-bid, or invalid)"); return; }
    setFeedback(`🤐 Sealed bid placed · amount hidden until settle`);
    load();
  }, [load]);

  const settle = useCallback(async (a: Auction) => {
    if (!window.confirm(`Settle auction now? This is irreversible.`)) return;
    const r = await fetch(`${API}/api/auctions/settle?auction_id=${a.auction_id}`, { method: "POST" });
    const data = await r.json();
    if (!r.ok) { setError(data.detail || "Settle failed"); return; }
    if (data.status === "voided") {
      setFeedback(`⚠ Auction voided · no qualifying bids · beat returned to vault`);
    } else {
      setFeedback(`🏆 ${data.winner_id} won at $${data.winning_amount} · producer paid $${data.producer_payout}`);
    }
    load();
  }, [load]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-amber-950/15 to-black text-white" data-testid="beat-vault-page">
      {/* HEADER */}
      <div className="sticky top-0 z-30 backdrop-blur-md bg-black/70 border-b border-amber-500/20">
        <div className="max-w-6xl mx-auto px-5 py-3 flex items-center gap-4">
          <button onClick={() => nav(-1)} data-testid="bv-back-btn" className="p-2 rounded-lg hover:bg-white/10"><ArrowLeft className="w-5 h-5" /></button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Music4 className="w-5 h-5 text-amber-400" />
              <h1 className="text-lg font-black tracking-wide uppercase">Beat Vault Marketplace</h1>
              <span className="text-[10px] font-mono uppercase tracking-widest text-amber-300 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded">DSG MUSIC GROUP</span>
            </div>
            <p className="text-xs text-neutral-400 mt-0.5">$0.50/use · 70% to producer · sealed-bid auctions for exclusive rights</p>
          </div>
          <button onClick={load} disabled={loading} data-testid="bv-refresh" className="p-2 rounded-lg hover:bg-white/10"><RefreshCcw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /></button>
        </div>

        {/* TAB BAR */}
        <div className="max-w-6xl mx-auto px-5 pb-3 flex gap-2">
          <button onClick={() => setTab("vault")} data-testid="bv-tab-vault" className={`px-4 py-1.5 rounded-full text-xs uppercase tracking-widest font-bold flex items-center gap-1.5 ${tab === "vault" ? "bg-amber-500 text-black" : "bg-white/5 hover:bg-white/10"}`}>
            <ShoppingBag className="w-3 h-3" /> Vault ({beats.length})
          </button>
          <button onClick={() => setTab("auctions")} data-testid="bv-tab-auctions" className={`px-4 py-1.5 rounded-full text-xs uppercase tracking-widest font-bold flex items-center gap-1.5 ${tab === "auctions" ? "bg-amber-500 text-black" : "bg-white/5 hover:bg-white/10"}`}>
            <Gavel className="w-3 h-3" /> Auctions ({auctions.filter(a => a.status === "live").length} live)
          </button>
          <button onClick={() => setShowAddBeat(true)} data-testid="bv-add-btn" className="ml-auto px-4 py-1.5 rounded-full text-xs uppercase tracking-widest font-bold bg-emerald-500/20 text-emerald-200 border border-emerald-500/40 hover:bg-emerald-500/30 flex items-center gap-1.5">
            <Plus className="w-3 h-3" /> Upload Beat
          </button>
        </div>
      </div>

      {/* FEEDBACK */}
      <div className="max-w-6xl mx-auto px-5 mt-3 space-y-2">
        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} data-testid="bv-error"
              className="rounded-lg border border-rose-500/40 bg-rose-950/30 px-3 py-2 text-rose-200 text-sm flex items-center justify-between">
              <span>{error}</span><button onClick={() => setError(null)} className="text-rose-400 text-lg leading-none">×</button>
            </motion.div>
          )}
          {feedback && (
            <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} data-testid="bv-feedback"
              className="rounded-lg border border-emerald-500/40 bg-emerald-950/30 px-3 py-2 text-emerald-200 text-sm flex items-center justify-between">
              <span>{feedback}</span><button onClick={() => setFeedback(null)} className="text-emerald-400 text-lg leading-none">×</button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* CONTENT */}
      <div className="max-w-6xl mx-auto px-5 py-5">
        {tab === "vault" ? (
          beats.length === 0 ? (
            <EmptyState text="No beats in the vault yet. Click 'Upload Beat' to get started." />
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3" data-testid="bv-beats-grid">
              {beats.map(b => (
                <BeatCard key={b.beat_id} beat={b} onUse={() => useBeat(b)} onAuction={() => openAuction(b)} />
              ))}
            </div>
          )
        ) : (
          auctions.length === 0 ? (
            <EmptyState text="No auctions yet. Promote a vault beat to auction from the Vault tab." />
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3" data-testid="bv-auctions-grid">
              {auctions.map(a => {
                const beat = beats.find(b => b.beat_id === a.beat_id);
                return (
                  <AuctionCard key={a.auction_id} auction={a} beat={beat}
                    onBid={() => submitBid(a)} onSettle={() => settle(a)} />
                );
              })}
            </div>
          )
        )}
      </div>

      {/* UPLOAD MODAL */}
      <AnimatePresence>
        {showAddBeat && (
          <UploadBeatModal
            onClose={() => setShowAddBeat(false)}
            onSaved={(msg) => { setFeedback(msg); setShowAddBeat(false); load(); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-8 text-center text-neutral-400 text-sm" data-testid="bv-empty">
      {text}
    </div>
  );
}

function BeatCard({ beat, onUse, onAuction }: { beat: Beat; onUse: () => void; onAuction: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      data-testid={`beat-card-${beat.beat_id}`}
      className="rounded-2xl border border-amber-500/20 bg-gradient-to-br from-black via-black to-amber-950/30 p-4 hover:border-amber-400/50 transition-colors group"
    >
      <div className="flex items-start justify-between mb-2">
        <div>
          <h3 className="font-bold text-base">{beat.title}</h3>
          <p className="text-[10px] uppercase tracking-widest text-neutral-500 font-mono">{beat.producer_id}</p>
        </div>
        <span className="text-[10px] font-mono bg-amber-500/10 text-amber-200 border border-amber-500/30 px-2 py-0.5 rounded">{beat.bpm} BPM</span>
      </div>
      <div className="flex flex-wrap gap-1.5 mb-3 text-[10px] uppercase tracking-widest">
        <span className="bg-white/5 border border-white/10 px-2 py-0.5 rounded">{beat.genre}</span>
        <span className="bg-white/5 border border-white/10 px-2 py-0.5 rounded flex items-center gap-1"><Activity className="w-2.5 h-2.5" /> {beat.use_count} uses</span>
      </div>
      <div className="flex gap-2">
        <button onClick={onUse} data-testid={`beat-use-${beat.beat_id}`}
          className="flex-1 py-2 rounded-lg bg-amber-500 text-black text-xs font-black tracking-widest uppercase hover:bg-amber-400 flex items-center justify-center gap-1">
          <Coins className="w-3 h-3" /> Use $0.50
        </button>
        <button onClick={onAuction} data-testid={`beat-auction-${beat.beat_id}`}
          className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold uppercase tracking-widest flex items-center gap-1">
          <Gavel className="w-3 h-3" /> Auction
        </button>
      </div>
    </motion.div>
  );
}

function AuctionCard({ auction, beat, onBid, onSettle }: { auction: Auction; beat?: Beat; onBid: () => void; onSettle: () => void }) {
  const statusColor = auction.status === "live" ? "text-emerald-300 bg-emerald-500/10 border-emerald-500/40" :
                      auction.status === "settled" ? "text-cyan-300 bg-cyan-500/10 border-cyan-500/40" :
                      "text-rose-300 bg-rose-500/10 border-rose-500/40";
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      data-testid={`auction-card-${auction.auction_id}`}
      className="rounded-2xl border border-fuchsia-500/30 bg-gradient-to-br from-black via-black to-fuchsia-950/30 p-4 hover:border-fuchsia-400/60 transition-colors"
    >
      <div className="flex items-start justify-between mb-2">
        <div className="min-w-0">
          <h3 className="font-bold text-base truncate">{beat?.title ?? "Beat #" + auction.beat_id.slice(-6)}</h3>
          <p className="text-[10px] uppercase tracking-widest text-neutral-500 font-mono truncate">producer: {auction.producer_id}</p>
        </div>
        <span className={`text-[9px] font-mono uppercase tracking-widest border px-2 py-0.5 rounded ${statusColor}`}>{auction.status}</span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs font-mono mb-3">
        <div><div className="text-[10px] text-neutral-500 uppercase">Reserve</div><b className="text-yellow-300 flex items-center gap-1"><Tag className="w-3 h-3" /> ${auction.reserve_price.toFixed(2)}</b></div>
        <div><div className="text-[10px] text-neutral-500 uppercase">Bids (sealed)</div><b className="text-fuchsia-300">{auction.bid_count}</b></div>
      </div>
      <div className="flex gap-2">
        <button onClick={onBid} disabled={!auction.is_open} data-testid={`auction-bid-${auction.auction_id}`}
          className="flex-1 py-2 rounded-lg bg-fuchsia-500 text-white text-xs font-black tracking-widest uppercase hover:bg-fuchsia-400 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1">
          <Gavel className="w-3 h-3" /> Sealed Bid
        </button>
        <button onClick={onSettle} disabled={auction.status !== "live"} data-testid={`auction-settle-${auction.auction_id}`}
          className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold uppercase tracking-widest disabled:opacity-40">
          Settle
        </button>
      </div>
    </motion.div>
  );
}

function UploadBeatModal({ onClose, onSaved }: { onClose: () => void; onSaved: (msg: string) => void }) {
  const [producer, setProducer] = useState("prod_demo");
  const [title, setTitle] = useState("");
  const [bpm, setBpm] = useState(140);
  const [genre, setGenre] = useState("trap");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    if (!title.trim()) { setErr("Title required"); return; }
    setBusy(true); setErr(null);
    try {
      const r = await fetch(`${API}/api/freestyle/beats/upload`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ producer_id: producer, title, bpm, genre }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      onSaved(`🎶 Beat "${title}" uploaded by ${producer}`);
    } catch (e: any) {
      setErr(e?.message || "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}>
      <motion.div initial={{ scale: 0.9, y: 12 }} animate={{ scale: 1, y: 0 }}
        onClick={e => e.stopPropagation()}
        data-testid="bv-upload-modal"
        className="w-full max-w-md rounded-2xl border-2 border-amber-400/50 bg-black p-6 space-y-3">
        <h2 className="text-lg font-black uppercase tracking-widest">Upload Beat</h2>
        {err && <div className="text-sm text-rose-300">{err}</div>}
        <Field label="Producer ID" value={producer} onChange={setProducer} testid="bv-up-producer" />
        <Field label="Beat Title" value={title} onChange={setTitle} testid="bv-up-title" />
        <Field label="BPM" type="number" value={String(bpm)} onChange={v => setBpm(parseInt(v) || 140)} testid="bv-up-bpm" />
        <Field label="Genre" value={genre} onChange={setGenre} testid="bv-up-genre" />
        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-xs uppercase tracking-widest font-bold">Cancel</button>
          <button onClick={submit} disabled={busy} data-testid="bv-up-submit"
            className="flex-1 py-2 rounded-lg bg-amber-500 text-black text-xs uppercase tracking-widest font-black disabled:opacity-50">
            {busy ? "Uploading…" : "Upload"}
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
        className="w-full bg-black border border-white/20 rounded-lg px-3 py-2 font-mono text-sm focus:border-amber-400 outline-none"
      />
    </label>
  );
}
