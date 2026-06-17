/**
 * CrazyEightsWildModal — small overlay shown after the user plays an 8.
 * Forces the player to declare a suit before the turn closes.
 */
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  open: boolean;
  busy: boolean;
  onPick: (suit: "clubs" | "diamonds" | "spades" | "hearts") => void;
}

const SUITS: Array<{
  id: "clubs" | "diamonds" | "spades" | "hearts";
  glyph: string;
  color: string;
  bg: string;
}> = [
  { id: "spades",   glyph: "♠", color: "text-slate-100", bg: "from-slate-700 to-slate-900" },
  { id: "hearts",   glyph: "♥", color: "text-rose-200",  bg: "from-rose-700 to-rose-900" },
  { id: "diamonds", glyph: "♦", color: "text-rose-200",  bg: "from-orange-600 to-rose-800" },
  { id: "clubs",    glyph: "♣", color: "text-slate-100", bg: "from-emerald-700 to-emerald-900" },
];

export default function CrazyEightsWildModal({ open, busy, onPick }: Props) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center px-4"
          data-testid="crazy-eights-wild-modal"
        >
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 10, opacity: 0 }}
            transition={{ type: "spring", stiffness: 220, damping: 22 }}
            className="w-full max-w-md bg-gradient-to-br from-slate-900 via-slate-950 to-black border-2 border-indigo-400/50 rounded-3xl shadow-[0_0_40px_rgba(99,102,241,0.45)] p-5"
          >
            <p
              className="text-[10px] uppercase tracking-[0.3em] text-indigo-300/80 font-bold"
              style={{ fontFamily: "'Cinzel', serif" }}
            >
              Crazy Eights · Wild
            </p>
            <h3
              className="text-2xl font-black text-indigo-100 leading-tight mb-4"
              style={{ fontFamily: "'Cinzel', serif" }}
            >
              Declare a suit
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {SUITS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => onPick(s.id)}
                  disabled={busy}
                  className={`relative h-24 rounded-xl bg-gradient-to-br ${s.bg} border-2 border-white/15 hover:border-white/40 hover:shadow-xl transition disabled:opacity-50 flex flex-col items-center justify-center gap-1`}
                  data-testid={`crazy-eights-wild-${s.id}`}
                >
                  <span className={`text-4xl ${s.color} drop-shadow`}>{s.glyph}</span>
                  <span className={`text-[10px] uppercase tracking-[0.25em] font-bold ${s.color}`}>
                    {s.id}
                  </span>
                </button>
              ))}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
