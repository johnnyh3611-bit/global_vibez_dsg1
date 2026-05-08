/**
 * WalletMemoCard — small persisted notepad on /wallet. The memo travels
 * with the user across devices so they can jot a deposit memo (e.g. the
 * GVZ-XXXXXXXX tag from SolanaDepositPanel) on desktop and read it back
 * on their phone five minutes later.
 *
 * Saves on blur or after 1.5s of idle typing — no save button.
 * Anonymous (logged-out) users get a localStorage-only fallback so the
 * UX is never broken.
 */
import { useEffect, useRef, useState } from "react";
import { authFetch, getUserId } from "@/utils/secureAuth";
import { Save, NotebookPen } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;
const LOCAL_KEY = "wallet_memo_local_v1";

export default function WalletMemoCard() {
  const [memo, setMemo] = useState<string>("");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const isLoggedIn = !!getUserId();
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initial load
  useEffect(() => {
    let alive = true;
    const init = async () => {
      if (!isLoggedIn) {
        setMemo(localStorage.getItem(LOCAL_KEY) || "");
        return;
      }
      try {
        const r = await authFetch(`${API}/api/preferences/wallet-memo`);
        if (!r.ok) return;
        const d = await r.json();
        if (alive) setMemo(d.memo || "");
      } catch {
        /* silent */
      }
    };
    init();
    return () => {
      alive = false;
    };
  }, [isLoggedIn]);

  const save = async (next: string) => {
    setBusy(true);
    try {
      if (!isLoggedIn) {
        localStorage.setItem(LOCAL_KEY, next);
      } else {
        await authFetch(`${API}/api/preferences/wallet-memo`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ memo: next }),
        });
      }
      setSavedAt(new Date().toLocaleTimeString());
    } finally {
      setBusy(false);
    }
  };

  const onChange = (v: string) => {
    setMemo(v);
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => save(v), 1500);
  };

  return (
    <div
      className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-2xl p-4"
      data-testid="wallet-memo-card"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <NotebookPen className="w-4 h-4 text-cyan-300" />
          <h3 className="text-[12px] uppercase tracking-widest text-cyan-300 font-bold">
            Wallet memo
          </h3>
        </div>
        <p className="text-[10px] text-slate-500">
          {busy
            ? "Saving…"
            : savedAt
            ? `Saved · ${savedAt}`
            : isLoggedIn
            ? "Auto-saves while you type"
            : "Logged out — saves locally only"}
        </p>
      </div>
      <textarea
        data-testid="wallet-memo-textarea"
        value={memo}
        onChange={(e) => onChange(e.target.value)}
        onBlur={(e) => save(e.target.value)}
        rows={3}
        maxLength={500}
        placeholder="Jot a SOL deposit memo, a reminder to redeem stakes, or anything else for next time you open this page…"
        className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-[13px] text-cyan-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-400/50"
      />
      <div className="flex items-center justify-between mt-1">
        <p className="text-[10px] text-slate-500">{memo.length}/500</p>
        <button
          type="button"
          onClick={() => save(memo)}
          disabled={busy}
          data-testid="wallet-memo-save"
          className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-cyan-300 hover:text-cyan-200 disabled:opacity-50"
        >
          <Save className="w-3 h-3" /> Save now
        </button>
      </div>
    </div>
  );
}
