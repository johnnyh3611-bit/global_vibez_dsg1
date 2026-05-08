/**
 * LogDesignLesson — floating, admin-only hidden-until-hover button
 * that persists a design lesson to the agent's long-term memory.
 *
 * Visibility: opacity-10 by default, opacity-100 on hover — so it
 * doesn't clutter the UI but is always reachable.
 * Gating: POST /api/agent/learn requires the admin_session cookie;
 * non-admin users just get a 401 and a toast.
 */
import { useState } from "react";

const API = process.env.REACT_APP_BACKEND_URL;
const CATEGORIES = ["Visuals", "Flow", "Rules", "Treasury", "Games", "Other"];

export const LogDesignLesson = () => {
  const [open, setOpen] = useState(false);
  const [insight, setInsight] = useState("");
  const [category, setCategory] = useState("Visuals");
  const [msg, setMsg] = useState<string | null>(null);

  const submit = async () => {
    setMsg(null);
    if (insight.trim().length < 5) {
      setMsg("Please write at least 5 chars.");
      return;
    }
    try {
      const r = await fetch(`${API}/api/agent/learn`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ insight, category }),
      });
      if (!r.ok) {
        setMsg(r.status === 401 ? "Admin only — log in via /vibe-vault-admin." : `HTTP ${r.status}`);
        return;
      }
      setMsg("✓ Agent has evolved!");
      setInsight("");
    } catch (e: any) {
      setMsg(`✗ ${e.message}`);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        data-testid="log-design-lesson-toggle"
        className="fixed bottom-4 left-4 opacity-10 hover:opacity-100 text-[10px] text-cyan-400 uppercase tracking-widest bg-black/70 border border-cyan-500/30 px-3 py-1 rounded-full backdrop-blur-md z-50 transition-opacity"
      >
        Log design lesson
      </button>
    );
  }

  return (
    <div
      data-testid="log-design-lesson-panel"
      className="fixed bottom-4 left-4 w-80 bg-black/80 border border-cyan-500/40 rounded-xl p-4 backdrop-blur-xl z-50 space-y-3"
    >
      <div className="flex items-center justify-between">
        <h4 className="text-sm text-cyan-400 uppercase tracking-widest">Design Lesson</h4>
        <button
          onClick={() => setOpen(false)}
          data-testid="log-design-lesson-close"
          className="text-slate-500 hover:text-white text-xs"
        >
          ✕
        </button>
      </div>
      <select
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        data-testid="log-design-lesson-category"
        className="w-full bg-slate-950 border border-slate-700 text-white rounded-md text-sm p-2"
      >
        {CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      <textarea
        value={insight}
        onChange={(e) => setInsight(e.target.value)}
        placeholder="What did the agent learn?"
        data-testid="log-design-lesson-insight"
        className="w-full bg-slate-950 border border-slate-700 text-white rounded-md text-sm p-2 min-h-[80px]"
        maxLength={500}
      />
      <button
        onClick={submit}
        data-testid="log-design-lesson-submit"
        className="w-full bg-cyan-500 text-black font-bold text-sm py-2 rounded-md hover:shadow-[0_0_20px_#22d3ee] active:scale-95 transition-all"
      >
        Save to Agent Brain
      </button>
      {msg && <p className="text-xs text-slate-300">{msg}</p>}
    </div>
  );
};
