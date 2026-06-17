/**
 * ApexWishlistOptIn — modal that opens from a CTA button. Sends user
 * info to /api/apex/wishlist and shows a "you're #N on the list"
 * confirmation. Anonymous users can still opt in with email only.
 */
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, X, Check } from "lucide-react";
import { authFetch, getUserId } from "@/utils/secureAuth";

const API = process.env.REACT_APP_BACKEND_URL;

export default function ApexWishlistOptIn({
  trigger,
}: {
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [chairs, setChairs] = useState(1);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ ok: true; chairs_wanted: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const isLoggedIn = !!getUserId();

  const submit = async () => {
    setBusy(true);
    setErr(null);
    try {
      const fetcher = isLoggedIn ? authFetch : fetch;
      const r = await fetcher(`${API}/api/apex/wishlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email || undefined,
          chairs_wanted: chairs,
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErr(d.detail || "Could not save your spot. Try again.");
      } else {
        setDone({ ok: true, chairs_wanted: d.chairs_wanted });
      }
    } catch {
      setErr("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <span onClick={() => setOpen(true)} data-testid="apex-wishlist-trigger">
        {trigger || (
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-300 text-black text-[11px] uppercase tracking-widest font-black hover:bg-amber-200"
          >
            <Sparkles className="w-3.5 h-3.5" /> Reserve Apex
          </button>
        )}
      </span>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            data-testid="apex-wishlist-modal"
            className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.96, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, y: 10 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-md rounded-2xl border border-amber-300/40 bg-gradient-to-br from-rose-950 to-black p-6 shadow-[0_0_60px_rgba(252,211,77,0.35)]"
            >
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="absolute top-3 right-3 text-amber-200/60 hover:text-amber-100"
                data-testid="apex-wishlist-close"
              >
                <X className="w-4 h-4" />
              </button>

              {done ? (
                <div className="text-center py-6">
                  <div className="mx-auto w-12 h-12 rounded-full bg-amber-300/20 flex items-center justify-center">
                    <Check className="w-6 h-6 text-amber-300" />
                  </div>
                  <h3 className="text-amber-100 font-black uppercase tracking-widest text-lg mt-3">
                    You're on the list
                  </h3>
                  <p className="text-amber-100/70 text-sm mt-2">
                    We've got you down for{" "}
                    <span className="text-amber-300 font-black">
                      {done.chairs_wanted}
                    </span>{" "}
                    Apex chair{done.chairs_wanted === 1 ? "" : "s"}. We'll DM
                    you the moment evolution day arrives.
                  </p>
                </div>
              ) : (
                <>
                  <p className="text-[10px] uppercase tracking-[0.4em] text-amber-300/70 flex items-center gap-2">
                    <Sparkles className="w-3 h-3" /> Apex Pre-Sale Wishlist
                  </p>
                  <h3 className="text-2xl font-black text-amber-100 mt-1">
                    Reserve your spot.
                  </h3>
                  <p className="text-amber-100/65 text-[12px] mt-1 leading-relaxed">
                    Once Genius sells out, chair price moves to the live
                    Equity Master matrix — climbing with monthly revenue
                    from the $18 Floor → $99 Genesis → $360 Diamond → $1,800 Platinum.
                    Wishlist members get the first DM the moment Genius closes.
                  </p>

                  {!isLoggedIn && (
                    <label className="block mt-4">
                      <span className="text-[10px] uppercase tracking-widest text-amber-200/70">
                        Email *
                      </span>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        data-testid="apex-wishlist-email"
                        className="mt-1 w-full bg-black/50 border border-amber-300/30 rounded-lg px-3 py-2 text-amber-100 text-sm focus:outline-none focus:border-amber-300"
                        placeholder="you@example.com"
                      />
                    </label>
                  )}

                  <label className="block mt-4">
                    <span className="text-[10px] uppercase tracking-widest text-amber-200/70">
                      Chairs wanted (1–100)
                    </span>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={chairs}
                      onChange={(e) =>
                        setChairs(Math.max(1, Math.min(100, Number(e.target.value) || 1)))
                      }
                      data-testid="apex-wishlist-chairs"
                      className="mt-1 w-full bg-black/50 border border-amber-300/30 rounded-lg px-3 py-2 text-amber-100 text-sm focus:outline-none focus:border-amber-300"
                    />
                  </label>

                  {err && (
                    <p className="text-rose-300 text-[11px] mt-3" data-testid="apex-wishlist-error">
                      {err}
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={submit}
                    disabled={busy || (!isLoggedIn && !email)}
                    data-testid="apex-wishlist-submit"
                    className="w-full mt-5 py-2.5 rounded-full bg-amber-300 text-black font-black uppercase tracking-widest text-sm hover:bg-amber-200 disabled:opacity-50"
                  >
                    {busy ? "Saving…" : "Reserve my spot"}
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
