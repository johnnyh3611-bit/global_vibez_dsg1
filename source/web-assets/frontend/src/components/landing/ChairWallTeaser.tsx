/**
 * ChairWallTeaser — landing-page accordion body for the public Chair
 * Wall. Pulls a small slice of /api/chairs/wall (limit=12) so the
 * visitor sees actual chair IDs + holder handles right inside the
 * accordion, with a CTA to open the full wall at /chair-wall.
 *
 * Same privacy invariants as the wall page — handles only, no
 * user_ids / emails / payment refs.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Crown } from "lucide-react";
import ChairOrb from "@/components/chairs/ChairOrb";

const API = process.env.REACT_APP_BACKEND_URL;

type Row = {
  chair_id: number;
  phase: string;
  weight: number;
  holder_handle: string;
  holder_chair_count: number;
  parked_at: string;
};

const PHASE_RING: Record<string, string> = {
  Genius: "ring-amber-400/60 from-amber-900/40 to-rose-900/30",
  Genesis: "ring-emerald-400/50 from-emerald-900/40 to-cyan-900/30",
  "Phase III": "ring-cyan-400/50 from-cyan-900/40 to-blue-900/30",
  "Phase IV": "ring-violet-400/50 from-violet-900/40 to-fuchsia-900/30",
  "Phase V": "ring-fuchsia-400/50 from-fuchsia-900/40 to-pink-900/30",
};

export default function ChairWallTeaser() {
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState<number>(0);

  useEffect(() => {
    fetch(`${API}/api/chairs/wall?limit=12`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) {
          setRows(d.rows || []);
          setTotal(d.total || 0);
        }
      })
      .catch(() => null);
  }, []);

  return (
    <div className="p-6 space-y-5" data-testid="chair-wall-teaser">
      <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-950/30 via-black to-rose-950/30 p-5">
        <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-amber-300 mb-2">
          Public believer wall · {total.toLocaleString()} chair
          {total === 1 ? "" : "s"} parked
        </p>
        <h3 className="text-xl font-black text-white">
          Every chair has a permanent ID.
        </h3>
        <p className="text-sm text-neutral-300 leading-relaxed mt-2">
          Stamped at the moment of purchase, never re-issued. Click a chair
          on the wall to see who parked it and how many they own. Earlier IDs
          = earlier believers.
        </p>
      </div>

      {/* Mini-orb constellation preview */}
      {rows.length > 0 && (
        <div
          className="flex flex-wrap justify-center gap-x-4 gap-y-6 py-2"
          data-testid="chair-wall-teaser-grid"
        >
          {rows.map((r, i) => (
            <ChairOrb
              key={r.chair_id}
              chairId={r.chair_id}
              phase={r.phase}
              size="sm"
              staggerIndex={i}
              testId={`chair-wall-teaser-card-${r.chair_id}`}
            />
          ))}
        </div>
      )}

      {rows.length === 0 && (
        <div
          className="rounded-2xl border border-slate-800 bg-slate-950/40 p-6 text-center"
          data-testid="chair-wall-teaser-empty"
        >
          <Crown className="w-8 h-8 mx-auto text-slate-600" />
          <p className="text-sm text-neutral-400 mt-3">
            Be the first believer. Park a chair → your ID lands on the wall
            forever.
          </p>
        </div>
      )}

      <Link
        to="/chair-wall"
        data-testid="chair-wall-teaser-cta"
        className="flex items-center justify-between gap-3 rounded-2xl border border-amber-500/40 bg-gradient-to-r from-amber-600 to-rose-600 p-4 hover:brightness-110 transition"
      >
        <div>
          <p className="text-[10px] font-mono uppercase tracking-widest text-amber-100">
            Explore
          </p>
          <p className="text-base font-black text-white">
            Open The Full Chair Wall
          </p>
        </div>
        <ArrowRight className="w-5 h-5 text-white" />
      </Link>
    </div>
  );
}
