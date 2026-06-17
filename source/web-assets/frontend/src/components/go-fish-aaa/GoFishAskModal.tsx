/**
 * GoFishAskModal — pick a rank you hold + a target opponent to ask.
 * Replaces the bid modal in the universal prototype for Go Fish.
 */
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, X } from "lucide-react";
import type { SpadesPosition } from "@/components/spades/types";

interface Props {
  open: boolean;
  busy: boolean;
  askableRanks: string[];
  askableTargets: SpadesPosition[];
  positionLabel: Record<SpadesPosition, string>;
  onSubmit: (target: SpadesPosition, rank: string) => void;
  onClose: () => void;
}

export default function GoFishAskModal({
  open, busy, askableRanks, askableTargets, positionLabel, onSubmit, onClose,
}: Props) {
  const [rank, setRank] = useState<string | null>(null);
  const [target, setTarget] = useState<SpadesPosition | null>(null);

  const submit = () => {
    if (!rank || !target || busy) return;
    onSubmit(target, rank);
  };

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center px-4"
          data-testid="go-fish-ask-modal"
        >
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 10, opacity: 0 }}
            transition={{ type: "spring", stiffness: 220, damping: 22 }}
            className="w-full max-w-lg bg-gradient-to-br from-slate-900 via-cyan-950/40 to-slate-950 border-2 border-cyan-400/50 rounded-3xl shadow-[0_0_40px_rgba(34,211,238,0.45)] p-5"
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.3em] text-cyan-300/80 font-bold" style={{ fontFamily: "'Cinzel', serif" }}>
                  Go Fish · Your Turn
                </p>
                <h3 className="text-2xl font-black text-cyan-100 leading-tight" style={{ fontFamily: "'Cinzel', serif" }}>
                  Ask for a card
                </h3>
              </div>
              <button onClick={onClose} className="text-cyan-300/60 hover:text-white" data-testid="go-fish-ask-close">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-3">
              <p className="text-[10px] uppercase tracking-[0.25em] text-cyan-300 font-bold mb-2">
                1 · Rank you already hold
              </p>
              <div className="grid grid-cols-7 gap-2">
                {askableRanks.map((r) => (
                  <button
                    key={r}
                    onClick={() => setRank(r)}
                    className={`h-10 rounded-md font-black text-sm transition border-2 ${
                      rank === r
                        ? "bg-cyan-500 border-cyan-300 text-slate-950 shadow-[0_0_15px_rgba(34,211,238,0.55)]"
                        : "bg-slate-800/70 border-slate-700 text-cyan-200 hover:border-cyan-400"
                    }`}
                    data-testid={`go-fish-rank-${r}`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <p className="text-[10px] uppercase tracking-[0.25em] text-cyan-300 font-bold mb-2">
                2 · Player to ask
              </p>
              <div className="grid grid-cols-3 gap-2">
                {askableTargets.map((t) => (
                  <button
                    key={t}
                    onClick={() => setTarget(t)}
                    className={`h-12 rounded-lg font-black uppercase tracking-widest text-xs transition border-2 ${
                      target === t
                        ? "bg-cyan-500 border-cyan-300 text-slate-950 shadow-[0_0_15px_rgba(34,211,238,0.55)]"
                        : "bg-slate-800/70 border-slate-700 text-cyan-200 hover:border-cyan-400"
                    }`}
                    data-testid={`go-fish-target-${t}`}
                  >
                    {positionLabel[t]}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={submit}
              disabled={!rank || !target || busy}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-400 via-teal-400 to-cyan-400 hover:from-cyan-300 hover:to-teal-300 text-slate-950 font-black uppercase tracking-widest text-sm shadow-[0_0_24px_rgba(34,211,238,0.45)] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              style={{ fontFamily: "'Cinzel', serif" }}
              data-testid="go-fish-ask-submit"
            >
              <Send className="w-4 h-4" />
              {rank && target
                ? `Ask ${positionLabel[target]}: any ${rank}s?`
                : "Pick rank + target"}
            </button>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
