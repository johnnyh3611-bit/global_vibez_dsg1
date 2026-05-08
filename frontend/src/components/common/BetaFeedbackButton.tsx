/**
 * <BetaFeedbackButton /> — floating bug-report bubble.
 *
 * Mount once (e.g. in App.js). Click → modal with category + comment.
 * POSTs to /api/beta/feedback. Stamps current page automatically.
 */
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bug, X, Send, Check, Loader2 } from "lucide-react";
import { authFetch, getUserId } from "@/utils/secureAuth";

const API = process.env.REACT_APP_BACKEND_URL;

const CATEGORIES = [
  { id: "UI_GLITCH", label: "UI glitch" },
  { id: "GAME_BALANCE", label: "Game balance" },
  { id: "TOKEN_ISSUE", label: "Token / ₵ issue" },
  { id: "FEATURE_REQUEST", label: "Feature request" },
  { id: "OTHER", label: "Other" },
];

export default function BetaFeedbackButton() {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState(CATEGORIES[0].id);
  const [severity, setSeverity] = useState<"low" | "normal" | "high" | "critical">("normal");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  // Hide entirely for anonymous visitors — feedback flow needs auth.
  if (!getUserId()) return null;

  const submit = async () => {
    if (comment.trim().length < 3) return;
    setBusy(true);
    try {
      const r = await authFetch(`${API}/api/beta/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          severity,
          comment: comment.trim(),
          page: typeof window !== "undefined" ? window.location.pathname : null,
        }),
      });
      if (r.ok) {
        setDone(true);
        setComment("");
        setTimeout(() => { setOpen(false); setDone(false); }, 1800);
      }
    } finally { setBusy(false); }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-4 left-4 z-[9990] w-11 h-11 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 text-black shadow-[0_0_20px_rgba(255,165,0,0.5)] flex items-center justify-center hover:scale-110 transition"
        title="Report an issue / request a feature"
        data-testid="beta-feedback-toggle"
      >
        <Bug className="w-5 h-5" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-md flex items-center justify-center px-4"
            onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
            data-testid="beta-feedback-modal"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="glass-panel p-6 w-full max-w-md"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.3em] text-amber-300">
                    Beta Feedback
                  </p>
                  <h2 className="text-xl font-black text-white">Help build Global Vibez</h2>
                </div>
                <button onClick={() => setOpen(false)} className="text-cyan-400">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {done ? (
                <div className="text-center py-8" data-testid="beta-feedback-thanks">
                  <Check className="w-12 h-12 text-emerald-400 mx-auto" />
                  <p className="mt-3 text-emerald-300 font-bold">Thank you!</p>
                </div>
              ) : (
                <>
                  <label className="text-[10px] uppercase tracking-widest text-cyan-500">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="mt-1 w-full bg-black/60 border border-cyan-500/40 rounded-lg px-3 py-2 text-cyan-100 text-sm"
                    data-testid="beta-feedback-category"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>

                  <label className="block text-[10px] uppercase tracking-widest text-cyan-500 mt-3">Severity</label>
                  <div className="mt-1 flex gap-1">
                    {(["low", "normal", "high", "critical"] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => setSeverity(s)}
                        className={`flex-1 px-2 py-1 rounded-lg text-[10px] uppercase tracking-widest font-bold transition ${
                          severity === s
                            ? "bg-amber-500 text-black"
                            : "bg-black/40 text-cyan-400 border border-cyan-500/20"
                        }`}
                        data-testid={`beta-feedback-severity-${s}`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>

                  <label className="block text-[10px] uppercase tracking-widest text-cyan-500 mt-3">What happened?</label>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={4}
                    maxLength={2000}
                    placeholder="Be specific — what page, what you did, what you expected, what happened instead."
                    className="mt-1 w-full bg-black/60 border border-cyan-500/40 rounded-lg px-3 py-2 text-cyan-100 text-sm"
                    data-testid="beta-feedback-comment"
                  />

                  <button
                    onClick={submit}
                    disabled={busy || comment.trim().length < 3}
                    className="mt-4 w-full py-3 rounded-full bg-gradient-to-r from-cyan-300 to-fuchsia-400 text-black font-black uppercase tracking-widest text-xs disabled:opacity-50 flex items-center justify-center gap-2"
                    data-testid="beta-feedback-submit"
                  >
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    {busy ? "Sending…" : "Send feedback"}
                  </button>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
