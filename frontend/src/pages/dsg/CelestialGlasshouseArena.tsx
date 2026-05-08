/**
 * CelestialGlasshouseArena — v7 Phase 9 frontend.
 *
 * Apex-tier gated VIP space. Users punch in their artist rank + chair count
 * → engine returns one of STREET / LEGEND / SOVEREIGN / HEADLINER seat
 * classes. Heads/tails of the v7 spec:
 *   - Vibe Legend = LEGEND artist rank
 *   - Vibe Sovereign = ≥100 chairs
 *   - APEX (HEADLINER) = both
 *
 * Apex-tier visitors see Power Couple declaration form + headliner-slot
 * booking; everyone below sees the velvet-rope view.
 */
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Crown, Sparkles, Lock, Heart, Calendar,
  RefreshCcw, Users,
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

type SeatClass = "STREET" | "LEGEND" | "SOVEREIGN" | "HEADLINER";

interface AccessResponse {
  tier: "basic" | "vibe_legend" | "vibe_sovereign" | "apex";
  is_legend: boolean;
  is_sovereign: boolean;
  celestial_glasshouse_access: boolean;
  holographic_crown: boolean;
  global_broadcast_eligible: boolean;
  chair_count: number;
  artist_rank: string | null;
  can_enter: boolean;
  arena_seat_class: SeatClass;
}

interface PowerCouple {
  couple_id: string;
  artist_a_id: string;
  artist_b_id: string;
  is_active: boolean;
  declared_at: string;
}

interface HeadlinerBooking {
  booking_id: string;
  couple_id: string;
  slot_index: number;
  booked_for_date: string;
}

const SEAT_COLORS: Record<SeatClass, { bg: string; border: string; text: string; label: string }> = {
  STREET: { bg: "from-zinc-900", border: "border-zinc-700", text: "text-zinc-400",
    label: "Public Floor — Watching from the street" },
  LEGEND: { bg: "from-fuchsia-950", border: "border-fuchsia-500", text: "text-fuchsia-300",
    label: "Vibe Legend — Apex artist · Holographic crown enabled" },
  SOVEREIGN: { bg: "from-amber-950", border: "border-amber-500", text: "text-amber-300",
    label: "Vibe Sovereign — Top chair holder · Front-row access" },
  HEADLINER: { bg: "from-cyan-950 via-fuchsia-950", border: "border-cyan-400", text: "text-cyan-300",
    label: "★ APEX HEADLINER ★ — Global broadcast eligible · 1% of 1%" },
};

export default function CelestialGlasshouseArena() {
  const nav = useNavigate();
  const [rank, setRank] = useState("ROOKIE");
  const [chairs, setChairs] = useState(0);
  const [access, setAccess] = useState<AccessResponse | null>(null);
  const [couples, setCouples] = useState<PowerCouple[]>([]);
  const [bookings, setBookings] = useState<HeadlinerBooking[]>([]);
  const [showCoupleModal, setShowCoupleModal] = useState(false);
  const [showBookModal, setShowBookModal] = useState<PowerCouple | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const checkAccess = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/arena/access-check`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ artist_rank: rank, chair_count: chairs }),
      });
      const data: AccessResponse = await r.json();
      setAccess(data);
    } catch (e: any) {
      setError(e?.message || "Access check failed");
    } finally {
      setLoading(false);
    }
  }, [rank, chairs]);

  const loadArena = useCallback(async () => {
    try {
      const [c, sched] = await Promise.all([
        fetch(`${API}/api/arena/power-couples`).then(r => r.json()),
        fetch(`${API}/api/arena/headliner/schedule`).then(r => r.json()),
      ]);
      setCouples(c.couples || []);
      setBookings(sched.bookings || []);
    } catch (e: any) {
      setError(e?.message || "Failed to load arena state");
    }
  }, []);

  useEffect(() => { checkAccess(); loadArena(); }, [checkAccess, loadArena]);

  const seat = access ? SEAT_COLORS[access.arena_seat_class] : SEAT_COLORS.STREET;

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-purple-950/15 to-black text-white" data-testid="arena-page">
      {/* HEADER */}
      <div className="sticky top-0 z-30 backdrop-blur-md bg-black/70 border-b border-cyan-500/20">
        <div className="max-w-6xl mx-auto px-5 py-3 flex items-center gap-4">
          <button onClick={() => nav(-1)} data-testid="arena-back-btn" className="p-2 rounded-lg hover:bg-white/10"><ArrowLeft className="w-5 h-5" /></button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-cyan-300" />
              <h1 className="text-lg font-black tracking-wide uppercase bg-gradient-to-r from-cyan-300 via-fuchsia-300 to-yellow-300 bg-clip-text text-transparent">Celestial Glasshouse</h1>
              <span className="text-[10px] font-mono uppercase tracking-widest text-cyan-300 bg-cyan-500/10 border border-cyan-500/30 px-2 py-0.5 rounded">v7 ARENA</span>
            </div>
            <p className="text-xs text-neutral-400 mt-0.5">Apex-tier VIP · Power Couples · Headliner slots · top 1%</p>
          </div>
          <button onClick={() => { checkAccess(); loadArena(); }} disabled={loading} data-testid="arena-refresh" className="p-2 rounded-lg hover:bg-white/10"><RefreshCcw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /></button>
        </div>
      </div>

      {/* FEEDBACK BAR */}
      <div className="max-w-6xl mx-auto px-5 mt-3 space-y-2">
        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} data-testid="arena-error"
              className="rounded-lg border border-rose-500/40 bg-rose-950/30 px-3 py-2 text-rose-200 text-sm flex justify-between">
              <span>{error}</span><button onClick={() => setError(null)}>×</button>
            </motion.div>
          )}
          {feedback && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} data-testid="arena-feedback"
              className="rounded-lg border border-emerald-500/40 bg-emerald-950/30 px-3 py-2 text-emerald-200 text-sm flex justify-between">
              <span>{feedback}</span><button onClick={() => setFeedback(null)}>×</button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ACCESS CARD */}
      <div className="max-w-6xl mx-auto px-5 py-6 grid lg:grid-cols-[1fr_1fr] gap-5 items-start">
        <div className="rounded-2xl border-2 border-cyan-500/30 bg-black/60 p-5 space-y-4" data-testid="arena-access-card">
          <h2 className="text-xs uppercase tracking-widest text-cyan-300 font-bold flex items-center gap-1">
            <Crown className="w-3 h-3" /> Velvet Rope Check
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col text-xs">
              <span className="text-neutral-400 uppercase tracking-widest mb-1">Artist Rank</span>
              <select value={rank} onChange={e => setRank(e.target.value)} data-testid="arena-rank-select"
                className="bg-black border border-white/20 rounded-lg px-3 py-2 font-mono">
                {["ROOKIE", "PRO", "ELITE", "LEGEND"].map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </label>
            <label className="flex flex-col text-xs">
              <span className="text-neutral-400 uppercase tracking-widest mb-1">Chair Count</span>
              <input type="number" value={chairs} onChange={e => setChairs(parseInt(e.target.value) || 0)}
                data-testid="arena-chairs-input"
                className="bg-black border border-white/20 rounded-lg px-3 py-2 font-mono" />
            </label>
          </div>
          <button onClick={checkAccess} disabled={loading} data-testid="arena-check-btn"
            className="w-full py-2.5 rounded-full bg-gradient-to-r from-cyan-500 via-fuchsia-500 to-yellow-500 text-black font-black tracking-widest text-xs hover:brightness-110 disabled:opacity-50">
            {loading ? "CHECKING…" : "CHECK ACCESS"}
          </button>

          <AnimatePresence mode="wait">
            {access && (
              <motion.div
                key={access.arena_seat_class}
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                data-testid="arena-seat-class"
                className={`rounded-xl border-2 ${seat.border} bg-gradient-to-br ${seat.bg} via-black to-black p-4`}
              >
                <div className="flex items-center gap-2 mb-1">
                  {access.can_enter ? <Sparkles className={`w-4 h-4 ${seat.text}`} /> : <Lock className={`w-4 h-4 ${seat.text}`} />}
                  <span className={`text-lg font-black uppercase tracking-widest ${seat.text}`} data-testid="arena-seat-label">{access.arena_seat_class}</span>
                </div>
                <p className="text-xs text-neutral-300">{seat.label}</p>
                <div className="mt-3 grid grid-cols-3 gap-2 text-[10px] uppercase tracking-widest">
                  <Flag label="Crown" on={access.holographic_crown} />
                  <Flag label="Glasshouse" on={access.celestial_glasshouse_access} />
                  <Flag label="Broadcast" on={access.global_broadcast_eligible} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* POWER COUPLES + HEADLINERS */}
        <div className="rounded-2xl border border-fuchsia-500/30 bg-black/60 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs uppercase tracking-widest text-fuchsia-300 font-bold flex items-center gap-1">
              <Heart className="w-3 h-3" /> Power Couples
            </h2>
            <button onClick={() => setShowCoupleModal(true)} data-testid="arena-declare-couple-btn"
              className="px-3 py-1 rounded-full text-[10px] uppercase tracking-widest font-bold bg-fuchsia-500/20 text-fuchsia-200 border border-fuchsia-500/40 hover:bg-fuchsia-500/30">
              + Declare
            </button>
          </div>
          {couples.length === 0 ? (
            <div className="text-xs text-neutral-500 italic px-3 py-4 text-center bg-black/30 rounded-lg border border-white/5">
              No declared couples yet. Both artists need APEX tier (LEGEND + ≥100 chairs).
            </div>
          ) : (
            <ul className="space-y-2" data-testid="arena-couples-list">
              {couples.map(c => (
                <li key={c.couple_id} data-testid={`arena-couple-${c.couple_id}`}
                  className="rounded-lg bg-fuchsia-500/10 border border-fuchsia-500/30 p-3 flex items-center gap-2">
                  <Heart className="w-4 h-4 text-fuchsia-300" />
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-sm">{c.artist_a_id} <span className="text-fuchsia-400">×</span> {c.artist_b_id}</div>
                    <div className="text-[10px] text-neutral-500">declared {new Date(c.declared_at).toLocaleDateString()}</div>
                  </div>
                  <button onClick={() => setShowBookModal(c)} data-testid={`arena-book-${c.couple_id}`}
                    className="px-3 py-1 rounded text-[10px] uppercase tracking-widest font-bold bg-yellow-400 text-black hover:bg-yellow-300 flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> Headline
                  </button>
                </li>
              ))}
            </ul>
          )}

          {bookings.length > 0 && (
            <div className="pt-3 border-t border-white/10">
              <h3 className="text-[10px] uppercase tracking-widest text-neutral-400 mb-2 flex items-center gap-1">
                <Users className="w-3 h-3" /> Booked Headliner Slots
              </h3>
              <ul className="space-y-1" data-testid="arena-bookings-list">
                {bookings.map(b => (
                  <li key={b.booking_id} className="text-[11px] font-mono bg-black/40 rounded px-2 py-1 flex justify-between">
                    <span>{b.booked_for_date} · slot #{b.slot_index}</span>
                    <span className="text-neutral-500 truncate ml-2">{b.couple_id.slice(0, 8)}…</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showCoupleModal && (
          <DeclareCoupleModal
            onClose={() => setShowCoupleModal(false)}
            onSaved={(msg) => { setFeedback(msg); setShowCoupleModal(false); loadArena(); }}
          />
        )}
        {showBookModal && (
          <BookHeadlinerModal
            couple={showBookModal}
            onClose={() => setShowBookModal(null)}
            onSaved={(msg) => { setFeedback(msg); setShowBookModal(null); loadArena(); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function Flag({ label, on }: { label: string; on: boolean }) {
  return (
    <div className={`rounded px-2 py-1 text-center font-mono ${on ? "bg-emerald-500/20 text-emerald-200 border border-emerald-500/40" : "bg-white/5 text-neutral-500 border border-white/10"}`}>
      {on ? "✓" : "—"} {label}
    </div>
  );
}

function DeclareCoupleModal({ onClose, onSaved }: { onClose: () => void; onSaved: (msg: string) => void }) {
  const [a, setA] = useState({ id: "alice", rank: "LEGEND", chairs: 200 });
  const [b, setB] = useState({ id: "bob",   rank: "LEGEND", chairs: 200 });
  const [studios, setStudios] = useState("studio_alpha");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true); setErr(null);
    try {
      const r = await fetch(`${API}/api/arena/power-couple/declare`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artist_a_id: a.id, artist_b_id: b.id,
          artist_a_rank: a.rank, artist_a_chairs: a.chairs,
          artist_b_rank: b.rank, artist_b_chairs: b.chairs,
          shared_collab_studio_ids: studios.split(",").map(s => s.trim()).filter(Boolean),
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || "Declare failed");
      onSaved(`💖 Power Couple ${a.id} × ${b.id} declared`);
    } catch (e: any) {
      setErr(e?.message || "Declare failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}>
      <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} onClick={e => e.stopPropagation()}
        data-testid="arena-couple-modal"
        className="w-full max-w-lg rounded-2xl border-2 border-fuchsia-400/50 bg-black p-6 space-y-3">
        <h2 className="text-lg font-black uppercase tracking-widest">Declare Power Couple</h2>
        {err && <div className="text-sm text-rose-300">{err}</div>}
        <div className="grid grid-cols-2 gap-3">
          <ArtistFields title="Artist A" v={a} setV={setA} testid="arena-c-a" />
          <ArtistFields title="Artist B" v={b} setV={setB} testid="arena-c-b" />
        </div>
        <label className="block">
          <div className="text-[10px] uppercase tracking-widest text-neutral-400 mb-1">Shared Collab Studios (comma-sep)</div>
          <input value={studios} onChange={e => setStudios(e.target.value)} data-testid="arena-c-studios"
            className="w-full bg-black border border-white/20 rounded-lg px-3 py-2 font-mono text-sm" />
        </label>
        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-xs uppercase tracking-widest font-bold">Cancel</button>
          <button onClick={submit} disabled={busy} data-testid="arena-c-submit"
            className="flex-1 py-2 rounded-lg bg-fuchsia-500 text-white text-xs uppercase tracking-widest font-black disabled:opacity-50">
            {busy ? "Declaring…" : "Declare Couple"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function ArtistFields({ title, v, setV, testid }: { title: string; v: any; setV: (v: any) => void; testid: string }) {
  return (
    <div className="space-y-2">
      <div className="text-[10px] uppercase tracking-widest text-fuchsia-300 font-bold">{title}</div>
      <input value={v.id} onChange={e => setV({ ...v, id: e.target.value })} data-testid={`${testid}-id`}
        placeholder="user_id"
        className="w-full bg-black border border-white/20 rounded px-2 py-1 font-mono text-xs" />
      <select value={v.rank} onChange={e => setV({ ...v, rank: e.target.value })} data-testid={`${testid}-rank`}
        className="w-full bg-black border border-white/20 rounded px-2 py-1 font-mono text-xs">
        {["ROOKIE", "PRO", "ELITE", "LEGEND"].map(r => <option key={r} value={r}>{r}</option>)}
      </select>
      <input type="number" value={v.chairs} onChange={e => setV({ ...v, chairs: parseInt(e.target.value) || 0 })}
        data-testid={`${testid}-chairs`}
        placeholder="chairs"
        className="w-full bg-black border border-white/20 rounded px-2 py-1 font-mono text-xs" />
    </div>
  );
}

function BookHeadlinerModal({ couple, onClose, onSaved }: { couple: PowerCouple; onClose: () => void; onSaved: (msg: string) => void }) {
  const [slot, setSlot] = useState(0);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true); setErr(null);
    try {
      const r = await fetch(`${API}/api/arena/headliner/book`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ couple_id: couple.couple_id, slot_index: slot, booked_for_date: date }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || "Book failed");
      onSaved(`🎤 Booked headliner slot #${slot} on ${date}`);
    } catch (e: any) {
      setErr(e?.message || "Book failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}>
      <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} onClick={e => e.stopPropagation()}
        data-testid="arena-book-modal"
        className="w-full max-w-md rounded-2xl border-2 border-yellow-400/50 bg-black p-6 space-y-3">
        <h2 className="text-lg font-black uppercase tracking-widest">Book Headliner Slot</h2>
        <p className="text-xs text-neutral-400">{couple.artist_a_id} × {couple.artist_b_id}</p>
        {err && <div className="text-sm text-rose-300">{err}</div>}
        <label className="block">
          <div className="text-[10px] uppercase tracking-widest text-neutral-400 mb-1">Slot Index (0–3)</div>
          <select value={slot} onChange={e => setSlot(parseInt(e.target.value))} data-testid="arena-bk-slot"
            className="w-full bg-black border border-white/20 rounded-lg px-3 py-2 font-mono text-sm">
            {[0, 1, 2, 3].map(i => <option key={i} value={i}>Slot #{i}</option>)}
          </select>
        </label>
        <label className="block">
          <div className="text-[10px] uppercase tracking-widest text-neutral-400 mb-1">Date</div>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} data-testid="arena-bk-date"
            className="w-full bg-black border border-white/20 rounded-lg px-3 py-2 font-mono text-sm" />
        </label>
        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-xs uppercase tracking-widest font-bold">Cancel</button>
          <button onClick={submit} disabled={busy} data-testid="arena-bk-submit"
            className="flex-1 py-2 rounded-lg bg-yellow-400 text-black text-xs uppercase tracking-widest font-black disabled:opacity-50">
            {busy ? "Booking…" : "Book Slot"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
