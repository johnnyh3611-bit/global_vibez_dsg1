/**
 * ChairHolderVoting — God-Mode admin panel for polling chair holders.
 *
 * Founder composes a yes/no question, pushes it live. Only chair
 * holders see it in their dashboard banner. Live tally streams here
 * (headcount + weighted + per-voter breakdown).
 *
 * Endpoints (all admin-only via verify_admin_cookie):
 *   POST /api/admin/chair-holder-votes             create
 *   GET  /api/admin/chair-holder-votes             list
 *   GET  /api/admin/chair-holder-votes/{id}/results  tally + responses
 *   POST /api/admin/chair-holder-votes/{id}/close    force-close
 *
 * Default duration: 72h (matches the platform's Vibe Check cadence).
 * Weighted toggle uses `weighted_chairs` so Genius 3× / Genesis 2×
 * votes carry proportional weight — off by default for 1-holder-1-vote.
 */
import { useCallback, useEffect, useState } from "react";
import {
  MessageSquare,
  Send,
  Lock,
  ThumbsUp,
  ThumbsDown,
  Minus,
  X,
  Scale,
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

type Tally = {
  yes: number;
  no: number;
  abstain: number;
  yes_weight: number;
  no_weight: number;
  abstain_weight: number;
  holders_voted: number;
};

type Vote = {
  vote_id: string;
  question: string;
  context: string;
  weighted: boolean;
  opens_at: string;
  closes_at: string;
  status: "open" | "closed";
  created_by_handle: string;
  tally: Tally;
};

export default function ChairHolderVoting() {
  const [votes, setVotes] = useState<Vote[]>([]);
  const [question, setQuestion] = useState("");
  const [context, setContext] = useState("");
  const [durationHours, setDurationHours] = useState(72);
  const [weighted, setWeighted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch(`${API}/api/admin/chair-holder-votes`, {
    });
    if (r.ok) {
      const j = await r.json();
      setVotes(j.votes || []);
    }
  }, []);

  useEffect(() => {
    load();
    // Poll every 15s so the live tally updates without a refresh.
    const t = setInterval(load, 15_000);
    return () => clearInterval(t);
  }, [load]);

  const send = async () => {
    if (question.trim().length < 10) {
      alert("Question must be at least 10 characters.");
      return;
    }
    setBusy(true);
    try {
      const r = await fetch(`${API}/api/admin/chair-holder-votes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: question.trim(),
          context: context.trim() || null,
          duration_hours: durationHours,
          weighted,
        }),
      });
      if (!r.ok) {
        alert("Failed to send: " + r.status);
        return;
      }
      setQuestion("");
      setContext("");
      await load();
    } finally {
      setBusy(false);
    }
  };

  const close = async (vote_id: string) => {
    if (!window.confirm("Close this vote now? Holders cannot vote after close.")) return;
    await fetch(`${API}/api/admin/chair-holder-votes/${vote_id}/close`, {
      method: "POST",
    });
    await load();
  };

  return (
    <div
      className="rounded-2xl border border-fuchsia-500/30 bg-slate-900/70 p-6"
      data-testid="chair-holder-voting-panel"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-fuchsia-300" />
          <h2 className="text-lg font-black text-white">
            Chair-Holder Broadcast · Voting
          </h2>
        </div>
        <span className="text-[10px] font-mono uppercase tracking-widest text-fuchsia-400">
          Chair-holder only
        </span>
      </div>

      <p className="text-xs text-slate-400 mb-4 leading-relaxed">
        Post a yes/no question to every active chair holder. They'll see
        it on their dashboard banner and the tally streams here in real
        time. Use weighted mode to give Genius (3×) and Genesis (2×)
        holders proportional pull.
      </p>

      {/* Compose form */}
      <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/50 p-4 mb-6">
        <div>
          <label
            htmlFor="sv-question"
            className="block text-[10px] font-mono uppercase tracking-widest text-fuchsia-300 mb-1"
          >
            The question
          </label>
          <input
            id="sv-question"
            data-testid="sv-question-input"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            maxLength={500}
            placeholder="Should we launch the Big Wheel Lounge on June 1?"
            className="w-full rounded-lg bg-black border border-slate-700 px-3 py-2 text-sm text-white focus:border-fuchsia-500 focus:outline-none"
          />
        </div>

        <div>
          <label
            htmlFor="sv-context"
            className="block text-[10px] font-mono uppercase tracking-widest text-fuchsia-300 mb-1"
          >
            Context (optional)
          </label>
          <textarea
            id="sv-context"
            data-testid="sv-context-input"
            value={context}
            onChange={(e) => setContext(e.target.value)}
            maxLength={2000}
            rows={3}
            placeholder="Why I'm asking + what yes/no will change…"
            className="w-full rounded-lg bg-black border border-slate-700 px-3 py-2 text-xs text-white focus:border-fuchsia-500 focus:outline-none resize-none"
          />
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          <div>
            <label
              htmlFor="sv-duration"
              className="block text-[10px] font-mono uppercase tracking-widest text-fuchsia-300 mb-1"
            >
              Duration (hours)
            </label>
            <input
              id="sv-duration"
              data-testid="sv-duration-input"
              type="number"
              min={1}
              max={720}
              value={durationHours}
              onChange={(e) =>
                setDurationHours(Math.max(1, parseInt(e.target.value || "72", 10)))
              }
              className="w-24 rounded-lg bg-black border border-slate-700 px-3 py-2 text-sm font-mono text-white focus:border-fuchsia-500 focus:outline-none"
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer mt-5">
            <input
              type="checkbox"
              checked={weighted}
              onChange={(e) => setWeighted(e.target.checked)}
              data-testid="sv-weighted-toggle"
              className="w-4 h-4 accent-fuchsia-500"
            />
            <Scale className="w-3.5 h-3.5 text-fuchsia-300" />
            <span className="text-xs text-slate-200">
              Weight by chairs (Genius 3× / Genesis 2×)
            </span>
          </label>
          <button
            type="button"
            onClick={send}
            disabled={busy || question.trim().length < 10}
            data-testid="sv-send-btn"
            className="ml-auto mt-5 flex items-center gap-1.5 rounded-full bg-gradient-to-r from-fuchsia-500 to-cyan-500 px-5 py-2 text-xs font-black uppercase tracking-widest text-white disabled:opacity-40 hover:brightness-110"
          >
            <Send className="w-3.5 h-3.5" />
            {busy ? "Sending…" : "Send to holders"}
          </button>
        </div>
      </div>

      {/* Existing votes */}
      <h3 className="text-xs font-bold uppercase tracking-widest text-slate-300 mb-3">
        Live polls ({votes.filter((v) => v.status === "open").length} open
        · {votes.filter((v) => v.status === "closed").length} closed)
      </h3>

      <div className="space-y-2" data-testid="sv-votes-list">
        {votes.length === 0 && (
          <p className="text-xs text-slate-500 py-4 text-center">
            No chair-holder votes yet. Compose one above to broadcast.
          </p>
        )}
        {votes.map((v) => (
          <VoteCard
            key={v.vote_id}
            vote={v}
            expanded={expanded === v.vote_id}
            onToggle={() =>
              setExpanded(expanded === v.vote_id ? null : v.vote_id)
            }
            onClose={() => close(v.vote_id)}
          />
        ))}
      </div>
    </div>
  );
}

function VoteCard({
  vote,
  expanded,
  onToggle,
  onClose,
}: {
  vote: Vote;
  expanded: boolean;
  onToggle: () => void;
  onClose: () => void;
}) {
  const t = vote.tally;
  const total = t.yes + t.no + t.abstain || 1;
  const yesPct = ((t.yes / total) * 100).toFixed(0);
  const noPct = ((t.no / total) * 100).toFixed(0);
  const abstainPct = ((t.abstain / total) * 100).toFixed(0);
  const closed = vote.status === "closed";

  return (
    <div
      className="rounded-xl border border-slate-700 bg-slate-950/50 overflow-hidden"
      data-testid={`sv-vote-${vote.vote_id}`}
    >
      <button
        type="button"
        onClick={onToggle}
        className="w-full p-4 text-left hover:bg-white/5 transition"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span
                className={`rounded-full px-2 py-0.5 text-[9px] font-mono uppercase tracking-widest ${
                  closed
                    ? "bg-slate-700 text-slate-300"
                    : "bg-emerald-500/20 text-emerald-300"
                }`}
              >
                {closed ? "Closed" : "Open"}
              </span>
              {vote.weighted && (
                <span className="rounded-full bg-amber-500/20 text-amber-300 px-2 py-0.5 text-[9px] font-mono uppercase tracking-widest">
                  Weighted
                </span>
              )}
              <span className="text-[10px] text-slate-500">
                {t.holders_voted} holder{t.holders_voted === 1 ? "" : "s"} voted
              </span>
            </div>
            <p className="text-sm font-bold text-white truncate">
              {vote.question}
            </p>
          </div>
          {!closed && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  onClose();
                }
              }}
              data-testid={`sv-close-${vote.vote_id}`}
              className="flex-shrink-0 rounded-full bg-rose-500/20 text-rose-300 px-3 py-1 text-[10px] font-bold uppercase tracking-widest hover:bg-rose-500/30 cursor-pointer"
            >
              <Lock className="w-3 h-3 inline mr-1" /> Close
            </span>
          )}
        </div>

        {/* 3-bar tally */}
        <div className="mt-3 space-y-1.5">
          <TallyBar
            Icon={ThumbsUp}
            label="Yes"
            count={t.yes}
            weight={t.yes_weight}
            pct={yesPct}
            weighted={vote.weighted}
            color="bg-emerald-500"
          />
          <TallyBar
            Icon={ThumbsDown}
            label="No"
            count={t.no}
            weight={t.no_weight}
            pct={noPct}
            weighted={vote.weighted}
            color="bg-rose-500"
          />
          <TallyBar
            Icon={Minus}
            label="Abstain"
            count={t.abstain}
            weight={t.abstain_weight}
            pct={abstainPct}
            weighted={vote.weighted}
            color="bg-slate-500"
          />
        </div>
      </button>

      {expanded && (
        <VoteDetail vote={vote} />
      )}
    </div>
  );
}

function TallyBar({
  Icon,
  label,
  count,
  weight,
  pct,
  weighted,
  color,
}: {
  Icon: typeof ThumbsUp;
  label: string;
  count: number;
  weight: number;
  pct: string;
  weighted: boolean;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 flex items-center gap-1 text-xs text-slate-300">
        <Icon className="w-3 h-3" /> {label}
      </div>
      <div className="flex-1 h-5 rounded bg-slate-800 overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="w-28 text-right text-[11px] font-mono text-slate-200">
        {count}
        {weighted && ` · ${weight.toFixed(1)}w`}
        <span className="ml-1 text-slate-500">({pct}%)</span>
      </div>
    </div>
  );
}

function VoteDetail({ vote }: { vote: Vote }) {
  const [rows, setRows] = useState<
    {
      choice: string;
      handle: string;
      weight_at_cast: number;
      locked_chairs_at_cast: number;
      cast_at: string;
    }[]
  >([]);

  useEffect(() => {
    fetch(`${API}/api/admin/chair-holder-votes/${vote.vote_id}/results`, {
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setRows(d.responses || []))
      .catch(() => null);
  }, [vote.vote_id]);

  return (
    <div
      className="border-t border-slate-700 p-4 bg-black/40"
      data-testid={`sv-detail-${vote.vote_id}`}
    >
      {vote.context && (
        <p className="text-xs text-slate-400 mb-3 leading-relaxed italic">
          "{vote.context}"
        </p>
      )}
      <div className="text-[11px] text-slate-500 mb-2 flex items-center justify-between">
        <span>
          Closes: {new Date(vote.closes_at).toLocaleString()}
        </span>
        <span>{rows.length} response{rows.length === 1 ? "" : "s"}</span>
      </div>
      <div className="max-h-60 overflow-y-auto space-y-1">
        {rows.map((r, i) => (
          <div
            key={i}
            className="flex items-center justify-between text-[11px] font-mono text-slate-300 px-2 py-1 rounded bg-slate-900"
          >
            <span className="truncate">{r.handle}</span>
            <span className="flex items-center gap-2">
              {vote.weighted && (
                <span className="text-amber-300">
                  {r.weight_at_cast.toFixed(1)}w
                </span>
              )}
              <span className="text-slate-500">
                ({r.locked_chairs_at_cast} chairs)
              </span>
              <ChoiceBadge choice={r.choice} />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChoiceBadge({ choice }: { choice: string }) {
  const map: Record<string, { bg: string; text: string; Icon: typeof ThumbsUp }> = {
    yes: { bg: "bg-emerald-500/30", text: "text-emerald-200", Icon: ThumbsUp },
    no: { bg: "bg-rose-500/30", text: "text-rose-200", Icon: ThumbsDown },
    abstain: { bg: "bg-slate-600/40", text: "text-slate-200", Icon: Minus },
  };
  const cfg = map[choice] || map.abstain;
  const C = cfg.Icon;
  return (
    <span
      className={`rounded px-1.5 py-0.5 flex items-center gap-1 ${cfg.bg} ${cfg.text}`}
    >
      <C className="w-2.5 h-2.5" /> {choice}
    </span>
  );
}

// Suppress ts-unused warnings for icons kept for future expansion.
export const _unused = X;
