/**
 * AdminSeatGrid — God-Mode widget that polls /api/admin/live-seats every
 * 15 s and renders a grid of SeatCards. One card per occupied seat across
 * the most-recent active card-game tables.
 *
 * Each card shows the player's username, ruleset badge, multiplier (if
 * they hold a Founder Chair), session earnings, and a "SPECTATE" CTA
 * that drops the founder straight into the table.
 */
import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Spade, Sparkles, Circle, Eye, RefreshCcw } from "lucide-react";
import { useNavigate } from "react-router-dom";

const API = process.env.REACT_APP_BACKEND_URL;

type Seat = {
  seat_id: string;
  table_id: string;
  seat_number: number;
  position: string;
  is_live: boolean;
  game_type: string;
  ruleset: string;
  spectate_url: string;
  wager: number;
  pot: number;
  session_earnings: number;
  username: string;
  chair_phase: string | null;
  chair_multiplier: number | null;
};

const PHASE_MULTIPLIER_FALLBACK: Record<string, number> = {
  Genius:    3.0,
  Genesis:   2.0,
  Vanguard:  2.0,
  Global:    1.0,
  Stellar:   1.0,
  Celestial: 1.0,
  Apex:      1.0,
};

const SeatCard = ({ seat }: { seat: Seat }) => {
  const navigate = useNavigate();
  const isBigWheel = seat.ruleset === "BIG_WHEEL";
  const multiplier =
    seat.chair_multiplier ??
    (seat.chair_phase ? PHASE_MULTIPLIER_FALLBACK[seat.chair_phase] : null);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      data-testid={`admin-seat-card-${seat.seat_id}`}
      className={`relative p-4 rounded-xl backdrop-blur-md border ${
        isBigWheel
          ? "border-amber-300/40 bg-amber-500/[0.05]"
          : "border-yellow-500/40 bg-black/40"
      }`}
    >
      <div className="flex justify-between items-center mb-2">
        <span
          className={`text-[10px] font-black uppercase tracking-widest ${
            isBigWheel ? "text-amber-300" : "text-yellow-300"
          }`}
        >
          {seat.chair_phase ? `${seat.chair_phase} Chair` : "Open Seat"} #
          {seat.seat_number}
        </span>
        <Circle
          className={`w-2 h-2 fill-current ${
            seat.is_live ? "text-emerald-400 animate-pulse" : "text-slate-500"
          }`}
        />
      </div>

      <h3 className="text-white text-base font-black truncate">
        {seat.username}
      </h3>
      <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-0.5">
        {seat.game_type}
        {isBigWheel && (
          <span className="ml-2 inline-flex items-center gap-1 text-amber-300">
            <Sparkles className="w-3 h-3" /> Big Wheel
          </span>
        )}
      </p>

      <div className="grid grid-cols-2 gap-2 mt-3">
        <div>
          <p className="text-[9px] uppercase tracking-widest text-white/50">
            Multiplier
          </p>
          <p
            className={`font-black text-sm ${
              isBigWheel ? "text-amber-300" : "text-yellow-400"
            }`}
          >
            {multiplier ? `${multiplier.toFixed(1)}×` : "—"}
          </p>
        </div>
        <div>
          <p className="text-[9px] uppercase tracking-widest text-white/50">
            Session
          </p>
          <p className="font-black text-sm text-emerald-400">
            +{seat.session_earnings} ₵
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => navigate(seat.spectate_url)}
        data-testid={`admin-seat-spectate-${seat.seat_id}`}
        className={`w-full mt-3 py-1.5 rounded text-[10px] font-black uppercase tracking-widest transition flex items-center justify-center gap-1.5 ${
          isBigWheel
            ? "bg-amber-300 text-black hover:bg-amber-200"
            : "bg-yellow-500 text-black hover:bg-white"
        }`}
      >
        <Eye className="w-3 h-3" /> Spectate Table
      </button>
    </motion.div>
  );
};

export default function AdminSeatGrid() {
  const [seats, setSeats] = useState<Seat[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const r = await fetch(`${API}/api/admin/live-seats?limit=24`, {
      });
      if (r.ok) {
        const d = await r.json();
        setSeats(d.seats || []);
      }
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 15_000);
    return () => clearInterval(t);
  }, [load]);

  return (
    <div data-testid="admin-seat-grid">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] text-slate-400">
          Live across all active card-game tables. Auto-refreshes every 15 s.
        </p>
        <button
          type="button"
          onClick={load}
          data-testid="admin-seat-grid-refresh"
          className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-cyan-300 hover:text-cyan-200"
        >
          <RefreshCcw
            className={`w-3 h-3 ${refreshing ? "animate-spin" : ""}`}
          />
          Refresh
        </button>
      </div>

      {seats === null ? (
        <p className="text-slate-400 text-sm">Loading live seats…</p>
      ) : seats.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-black/40 p-6 text-center">
          <Spade className="w-6 h-6 text-slate-500 mx-auto mb-2" />
          <p className="text-slate-400 text-sm">No active card-game tables right now.</p>
          <p className="text-slate-500 text-[11px] mt-1">
            Tables show up here the moment a player creates one.
          </p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          <AnimatePresence>
            {seats.map((s) => (
              <SeatCard key={s.seat_id} seat={s} />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
