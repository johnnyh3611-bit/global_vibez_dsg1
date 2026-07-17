/**
 * Confirm leave for partnership card games — surfaces the agreed
 * 15% house penalty + partner/opponent redistribution before quit.
 */
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, LogOut, X } from "lucide-react";
import { formatForfeitWarning } from "@/lib/forfeitPolicy";

type Props = {
  open: boolean;
  entryFee?: number;
  midGame?: boolean;
  gameLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function QuitForfeitDialog({
  open,
  entryFee = 0,
  midGame = true,
  gameLabel = "game",
  onConfirm,
  onCancel,
}: Props) {
  const fee = Math.max(0, Number(entryFee) || 0);
  const applies = midGame && fee > 0;
  const w = formatForfeitWarning(fee);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          data-testid="quit-forfeit-dialog"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            aria-label="Dismiss"
            onClick={onCancel}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="quit-forfeit-title"
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            className="relative w-full max-w-md rounded-2xl border-2 border-rose-500/40 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 shadow-2xl overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-rose-500/30 bg-rose-950/40">
              <div className="flex items-center gap-2 text-rose-200">
                <AlertTriangle className="w-5 h-5" />
                <h2
                  id="quit-forfeit-title"
                  className="text-sm font-bold tracking-wide"
                  style={{ fontFamily: "'Cinzel', serif" }}
                >
                  Leave {gameLabel}?
                </h2>
              </div>
              <button
                type="button"
                onClick={onCancel}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3 text-sm text-slate-200">
              {applies ? (
                <>
                  <p className="leading-relaxed text-slate-300">{w.summary}</p>
                  <dl className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg bg-black/30 border border-white/10 px-3 py-2">
                      <dt className="text-slate-400 uppercase tracking-wider">Entry forfeited</dt>
                      <dd className="text-amber-300 font-bold text-base tabular-nums">{w.entry}</dd>
                    </div>
                    <div className="rounded-lg bg-black/30 border border-white/10 px-3 py-2">
                      <dt className="text-slate-400 uppercase tracking-wider">House penalty (15%)</dt>
                      <dd className="text-rose-300 font-bold text-base tabular-nums">+{w.penalty}</dd>
                    </div>
                    <div className="rounded-lg bg-black/30 border border-white/10 px-3 py-2">
                      <dt className="text-slate-400 uppercase tracking-wider">To partner</dt>
                      <dd className="text-emerald-300 font-bold text-base tabular-nums">{w.partnerShare}</dd>
                    </div>
                    <div className="rounded-lg bg-black/30 border border-white/10 px-3 py-2">
                      <dt className="text-slate-400 uppercase tracking-wider">To opponents</dt>
                      <dd className="text-cyan-300 font-bold text-base tabular-nums">{w.opponentPool}</dd>
                    </div>
                  </dl>
                  <p className="text-[11px] text-slate-500">
                    Total impact: {w.total} credits (entry already in pot + new 15% debit).
                  </p>
                </>
              ) : (
                <p className="leading-relaxed text-slate-300">
                  {midGame
                    ? "Leave this free table? No entry fee or house penalty applies."
                    : "Leave the lobby? You can rejoin anytime."}
                </p>
              )}
            </div>

            <div className="flex gap-2 p-4 pt-0">
              <button
                type="button"
                onClick={onCancel}
                className="flex-1 rounded-xl border border-white/15 px-3 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-200 hover:bg-white/5"
                data-testid="quit-forfeit-cancel"
              >
                Stay
              </button>
              <button
                type="button"
                onClick={onConfirm}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-rose-400/50 bg-rose-600/80 px-3 py-2.5 text-xs font-bold uppercase tracking-wider text-white hover:bg-rose-500"
                data-testid="quit-forfeit-confirm"
              >
                <LogOut className="w-3.5 h-3.5" />
                {applies ? "Quit & pay penalty" : "Leave"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
