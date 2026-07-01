/**
 * MilestoneQueue — admin tab for queued phase-milestone social posts.
 *
 * Shows every phase milestone (Genius 25%, 50%, 75%, 100%, …) detected
 * by the hourly scanner. Each card has the auto-rendered OG image, the
 * pre-written copy, and a one-click "Post on X" intent + "Mark posted"
 * button so you don't have to re-tap the same milestone twice.
 */
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Twitter, Check, X as XIcon, RefreshCw, Image as ImageIcon } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

type Milestone = {
  milestone_id: string;
  phase: string;
  threshold_pct: number;
  phase_price_usd: number;
  phase_weight: number;
  seats_sold_total_at_trigger: number;
  share_text_short: string;
  og_image_url: string;
  twitter_intent: string;
  status: "queued" | "posted" | "skipped";
  posted_at: string | null;
  created_at: string;
};

type Filter = "queued" | "posted" | "skipped" | "all";

export default function MilestoneQueue() {
  const [rows, setRows] = useState<Milestone[] | null>(null);
  const [filter, setFilter] = useState<Filter>("queued");
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    const params = new URLSearchParams();
    if (filter !== "all") params.set("status", filter);
    const r = await fetch(`${API}/api/admin/milestones/queue?${params}`, {
    });
    if (r.ok) {
      const d = await r.json();
      setRows(d.rows || []);
    } else {
      setRows([]);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line
  }, [filter]);

  const triggerScan = async () => {
    setBusy("scan");
    try {
      await fetch(`${API}/api/admin/milestones/check-now`, {
        method: "POST",
      });
      await load();
    } finally {
      setBusy(null);
    }
  };

  const markPosted = async (id: string) => {
    setBusy(id);
    try {
      await fetch(`${API}/api/admin/milestones/${id}/mark-posted`, {
        method: "POST",
      });
      await load();
    } finally {
      setBusy(null);
    }
  };

  const skip = async (id: string) => {
    if (!window.confirm("Skip this milestone (don't post)?")) return;
    setBusy(id);
    try {
      await fetch(`${API}/api/admin/milestones/${id}/skip`, {
        method: "POST",
      });
      await load();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div data-testid="milestone-queue" className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-2">
          {(["queued", "posted", "skipped", "all"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-[11px] uppercase tracking-widest px-3 py-1.5 rounded-full font-bold transition ${
                filter === f
                  ? "bg-cyan-500 text-black"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <button
          onClick={triggerScan}
          disabled={busy === "scan"}
          data-testid="milestone-scan-now"
          className="flex items-center gap-1 text-[11px] uppercase tracking-widest px-3 py-1.5 rounded-full bg-amber-500 text-black font-black hover:brightness-110 disabled:opacity-50"
        >
          <RefreshCw className={`w-3 h-3 ${busy === "scan" ? "animate-spin" : ""}`} />
          Scan now
        </button>
      </div>

      {rows === null ? (
        <p className="text-slate-400 text-sm">Loading milestone queue…</p>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-8 text-center">
          <ImageIcon className="w-8 h-8 mx-auto text-slate-500" />
          <p className="mt-3 text-slate-400 text-sm">
            No {filter === "all" ? "" : filter} milestones yet.
          </p>
          <p className="text-slate-500 text-[11px] mt-1">
            Auto-detection runs hourly. "Scan now" triggers it manually.
          </p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {rows.map((m, i) => (
            <motion.div
              key={m.milestone_id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.04 }}
              className="rounded-xl border border-slate-700 bg-slate-900/60 overflow-hidden"
              data-testid={`milestone-card-${m.milestone_id}`}
            >
              <div className="relative aspect-[1200/630] bg-black">
                <img
                  src={`${API}${m.og_image_url}`}
                  alt={`${m.phase} ${m.threshold_pct}% milestone`}
                  className="w-full h-full object-cover"
                />
                <span
                  className={`absolute top-2 right-2 text-[10px] uppercase tracking-widest font-black px-2 py-1 rounded-full ${
                    m.status === "queued"
                      ? "bg-amber-400 text-black"
                      : m.status === "posted"
                      ? "bg-emerald-400 text-black"
                      : "bg-slate-600 text-white"
                  }`}
                >
                  {m.status}
                </span>
              </div>

              <div className="p-4">
                <p className="text-[10px] uppercase tracking-widest text-cyan-400 font-bold">
                  {m.phase} · {m.threshold_pct}% · ${m.phase_price_usd.toFixed(0)} ·{" "}
                  {m.phase_weight}× earn
                </p>
                <p className="mt-2 text-[12px] text-slate-200 leading-relaxed">
                  {m.share_text_short}
                </p>
                <p className="mt-2 text-[10px] text-slate-500">
                  Triggered at {m.seats_sold_total_at_trigger.toLocaleString()} chairs ·{" "}
                  {new Date(m.created_at).toLocaleString()}
                </p>

                {m.status === "queued" ? (
                  <div className="mt-3 flex gap-2 flex-wrap">
                    <a
                      href={m.twitter_intent}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => markPosted(m.milestone_id)}
                      className="flex items-center gap-1 rounded-full bg-sky-500 text-black px-3 py-1.5 text-[11px] font-black uppercase tracking-widest hover:brightness-110"
                    >
                      <Twitter className="w-3 h-3" /> Post on X
                    </a>
                    <button
                      onClick={() => markPosted(m.milestone_id)}
                      disabled={busy === m.milestone_id}
                      className="flex items-center gap-1 rounded-full bg-emerald-500/80 text-black px-3 py-1.5 text-[11px] font-black uppercase tracking-widest hover:bg-emerald-500 disabled:opacity-50"
                    >
                      <Check className="w-3 h-3" /> Mark posted
                    </button>
                    <button
                      onClick={() => skip(m.milestone_id)}
                      disabled={busy === m.milestone_id}
                      className="flex items-center gap-1 rounded-full bg-slate-700 text-slate-200 px-3 py-1.5 text-[11px] font-black uppercase tracking-widest hover:bg-slate-600 disabled:opacity-50"
                    >
                      <XIcon className="w-3 h-3" /> Skip
                    </button>
                  </div>
                ) : m.posted_at ? (
                  <p className="mt-3 text-[11px] text-emerald-300">
                    ✓ Posted {new Date(m.posted_at).toLocaleString()}
                  </p>
                ) : null}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
