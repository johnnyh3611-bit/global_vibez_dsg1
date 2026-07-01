/**
 * ChairWall — public 3D-grid showcase of every parked chair.
 *
 * Each chair floats in a labeled grid card showing its permanent ID
 * (e.g. "Chair #00027 · Genius") and the holder's display handle.
 * Click a chair → modal with full detail (holder + how many total
 * chairs that holder owns).
 *
 * Privacy invariants enforced server-side at /api/chairs/wall:
 *   • No user_id / email / payment ref leaks
 *   • Holders who set users.public_chair_holder=false render as
 *     "Anonymous Founder" (default is public unless explicit opt-out)
 *   • Only chair_id + phase + weight + handle + holder's total count
 *
 * Route registered in routes/chairsRoutes (or monetizationRoutes — the
 * /chair-vault sibling).
 */
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { Crown, Sparkles, X, ArrowLeft, Users } from "lucide-react";
import ChairOrb from "@/components/chairs/ChairOrb";

const API = process.env.REACT_APP_BACKEND_URL;

type WallRow = {
  chair_id: number;
  phase: string;
  weight: number;
  parked_at: string;
  holder_handle: string;
  holder_chair_count: number;
};

type WallResponse = {
  rows: WallRow[];
  total: number;
  offset: number;
  limit: number;
  phase_filter: string | null;
};

const PHASE_TONES: Record<string, { ring: string; bg: string; accent: string }> = {
  Genius: {
    ring: "ring-amber-400/60",
    bg: "from-amber-900/40 via-rose-900/30 to-black",
    accent: "text-amber-300",
  },
  Genesis: {
    ring: "ring-emerald-400/50",
    bg: "from-emerald-900/40 via-cyan-900/30 to-black",
    accent: "text-emerald-300",
  },
  "Phase III": {
    ring: "ring-cyan-400/50",
    bg: "from-cyan-900/40 via-blue-900/30 to-black",
    accent: "text-cyan-300",
  },
  "Phase IV": {
    ring: "ring-violet-400/50",
    bg: "from-violet-900/40 via-fuchsia-900/30 to-black",
    accent: "text-violet-300",
  },
  "Phase V": {
    ring: "ring-fuchsia-400/50",
    bg: "from-fuchsia-900/40 via-pink-900/30 to-black",
    accent: "text-fuchsia-300",
  },
};

const FILTERS = ["All", "Genius", "Genesis", "Phase III", "Phase IV", "Phase V"];

function fmtChairId(id: number): string {
  return `#${String(id).padStart(5, "0")}`;
}

function fmtDate(iso: string | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

export default function ChairWall() {
  const [data, setData] = useState<WallResponse | null>(null);
  const [filter, setFilter] = useState<string>("All");
  const [selected, setSelected] = useState<WallRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const url = new URL(`${API}/api/chairs/wall`);
    url.searchParams.set("limit", "500");
    if (filter !== "All") url.searchParams.set("phase", filter);
    fetch(url.toString())
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) setData(d);
      })
      .catch(() => null)
      .finally(() => setLoading(false));
  }, [filter]);

  const totalsByPhase = useMemo(() => {
    if (!data) return {};
    const out: Record<string, number> = {};
    for (const r of data.rows) out[r.phase] = (out[r.phase] || 0) + 1;
    return out;
  }, [data]);

  return (
    <main
      className="min-h-screen bg-black text-white"
      data-testid="chair-wall-page"
    >
      {/* Hero */}
      <section className="px-6 py-16 max-w-6xl mx-auto">
        <Link
          to="/chair-vault"
          className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-cyan-300 hover:text-cyan-200"
          data-testid="chair-wall-back"
        >
          <ArrowLeft className="w-3 h-3" /> Back to Vault
        </Link>
        <p className="text-xs font-mono uppercase tracking-[0.4em] text-fuchsia-400 mt-6 mb-3">
          Public Believer Wall
        </p>
        <h1 className="text-5xl sm:text-6xl font-black italic uppercase tracking-tighter">
          The Chair Wall
        </h1>
        <p className="text-neutral-400 mt-5 text-base sm:text-lg leading-relaxed max-w-2xl">
          Every chair has a permanent ID, locked at the moment of purchase.
          Click any chair to see who parked it and how many they own. Earlier
          IDs = earlier believers — this is on-chain history made human.
        </p>

        {/* Top stats */}
        <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-3" data-testid="chair-wall-stats">
          <Stat
            label="Total chairs parked"
            value={data?.total?.toLocaleString() ?? "—"}
            Icon={Crown}
            tone="amber"
          />
          <Stat
            label="Genius cohort"
            value={(totalsByPhase["Genius"] ?? 0).toLocaleString()}
            Icon={Sparkles}
            tone="rose"
          />
          <Stat
            label="Genesis cohort"
            value={(totalsByPhase["Genesis"] ?? 0).toLocaleString()}
            Icon={Sparkles}
            tone="emerald"
          />
          <Stat
            label="Active circulation"
            value="500K"
            Icon={Users}
            tone="cyan"
          />
        </div>
      </section>

      {/* Phase filter */}
      <section className="px-6 pb-6 max-w-6xl mx-auto">
        <div
          className="flex gap-2 overflow-x-auto pb-2"
          data-testid="chair-wall-filters"
        >
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              data-testid={`chair-wall-filter-${f.replace(/\s+/g, "-")}`}
              className={`flex-shrink-0 rounded-full border px-4 py-1.5 text-xs font-bold uppercase tracking-widest transition ${
                filter === f
                  ? "border-fuchsia-400 bg-fuchsia-500/20 text-white"
                  : "border-slate-700 text-slate-300 hover:border-slate-500"
              }`}
            >
              {f}
              {f !== "All" && (
                <span className="ml-2 opacity-60">
                  {totalsByPhase[f] ?? 0}
                </span>
              )}
            </button>
          ))}
        </div>
      </section>

      {/* The wall — 3D-floating chair grid */}
      <section className="px-6 pb-24 max-w-6xl mx-auto">
        {loading && (
          <p
            className="text-center text-neutral-500 py-20 text-sm"
            data-testid="chair-wall-loading"
          >
            Loading the wall…
          </p>
        )}

        {!loading && data && data.rows.length === 0 && (
          <div
            className="text-center py-20 rounded-2xl border border-slate-800 bg-slate-950/40"
            data-testid="chair-wall-empty"
          >
            <Crown className="w-10 h-10 mx-auto text-slate-600" />
            <p className="text-lg font-bold text-white mt-4">
              No chairs parked yet
            </p>
            <p className="text-sm text-neutral-500 mt-2">
              Be the first believer. Park a chair and your seat lands here forever.
            </p>
            <Link
              to="/chair-vault"
              className="inline-block mt-6 rounded-full bg-fuchsia-500 px-6 py-2.5 text-sm font-bold text-white hover:brightness-110"
            >
              Park a Chair
            </Link>
          </div>
        )}

        {!loading && data && data.rows.length > 0 && (
          <div
            className="flex flex-wrap justify-center gap-x-6 gap-y-10 md:gap-x-10 md:gap-y-14 py-4"
            data-testid="chair-wall-grid"
          >
            {data.rows.map((r, i) => (
              <ChairOrb
                key={r.chair_id}
                chairId={r.chair_id}
                phase={r.phase}
                size="md"
                holderHandle={r.holder_handle}
                weightLabel={`${r.weight}×`}
                staggerIndex={i}
                onClick={() => setSelected(r)}
                testId={`chair-wall-card-${r.chair_id}`}
              />
            ))}
          </div>
        )}
      </section>

      {/* Detail modal */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={() => setSelected(null)}
            data-testid="chair-wall-modal-backdrop"
          >
            <motion.div
              initial={{ scale: 0.92, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.92, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className={`relative w-full max-w-md rounded-3xl border-2 ring-2 ${(PHASE_TONES[selected.phase] || PHASE_TONES["Phase V"]).ring} border-white/10 bg-gradient-to-br ${(PHASE_TONES[selected.phase] || PHASE_TONES["Phase V"]).bg} p-8`}
              data-testid="chair-wall-modal"
            >
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="absolute top-4 right-4 text-neutral-400 hover:text-white"
                data-testid="chair-wall-modal-close"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>

              <p
                className={`text-[10px] font-mono uppercase tracking-[0.3em] ${(PHASE_TONES[selected.phase] || PHASE_TONES["Phase V"]).accent}`}
              >
                {selected.phase} · {selected.weight}× weight
              </p>
              <p className="text-5xl font-black font-mono text-white mt-2">
                {fmtChairId(selected.chair_id)}
              </p>

              <div className="mt-6 space-y-3 border-t border-white/10 pt-6">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-neutral-400">
                    Holder
                  </p>
                  <p
                    className="text-xl font-bold text-white mt-0.5"
                    data-testid="chair-wall-modal-handle"
                  >
                    {selected.holder_handle}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-neutral-400">
                    This holder owns
                  </p>
                  <p
                    className="text-xl font-bold text-white mt-0.5"
                    data-testid="chair-wall-modal-count"
                  >
                    {selected.holder_chair_count.toLocaleString()}{" "}
                    <span className="text-sm text-neutral-400 font-normal">
                      chair{selected.holder_chair_count === 1 ? "" : "s"} total
                    </span>
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-neutral-400">
                    Parked on
                  </p>
                  <p className="text-sm font-mono text-white mt-0.5">
                    {fmtDate(selected.parked_at)}
                  </p>
                </div>
              </div>

              <p className="mt-6 text-[11px] text-neutral-500 leading-relaxed">
                Founder Chairs are non-transferable loyalty seats.
                Discretionary quarterly distributions only. Not securities.
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

function Stat({
  label,
  value,
  Icon,
  tone,
}: {
  label: string;
  value: string;
  Icon: typeof Crown;
  tone: "amber" | "rose" | "emerald" | "cyan";
}) {
  const tones: Record<typeof tone, string> = {
    amber: "border-amber-500/30 text-amber-300",
    rose: "border-rose-500/30 text-rose-300",
    emerald: "border-emerald-500/30 text-emerald-300",
    cyan: "border-cyan-500/30 text-cyan-300",
  };
  return (
    <div className={`rounded-xl border ${tones[tone]} bg-black/40 p-3`}>
      <div className="flex items-center justify-between">
        <p className="text-[9px] font-mono uppercase tracking-widest text-neutral-400">
          {label}
        </p>
        <Icon className="w-3.5 h-3.5 opacity-60" />
      </div>
      <p className="text-2xl font-black text-white font-mono mt-1">{value}</p>
    </div>
  );
}
