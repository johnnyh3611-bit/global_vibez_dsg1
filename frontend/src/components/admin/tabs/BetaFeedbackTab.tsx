/**
 * BetaFeedbackTab — admin view of all beta feedback rows.
 *
 * Reads `GET /api/beta/feedback` (gated by admin_session cookie via
 * verify_admin_cookie). Lets the founder filter by status and skim
 * recent submissions. Markup intentionally simple — this is for the
 * crew triage, not for end users.
 */
import { useCallback, useEffect, useState } from "react";
import { Card, Title, Text, Badge } from "@tremor/react";
import { Loader2, MessageSquareWarning, RefreshCw } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

type Status = "ALL" | "UNREAD" | "TRIAGED" | "RESOLVED";

interface FeedbackRow {
  user_id: string;
  category: string;
  severity: string;
  page: string | null;
  comment: string;
  status: string;
  submitted_at: string;
}

const SEVERITY_COLOR: Record<string, "gray" | "amber" | "rose" | "red"> = {
  low: "gray",
  normal: "amber",
  high: "rose",
  critical: "red",
};

export default function BetaFeedbackTab() {
  const [rows, setRows] = useState<FeedbackRow[]>([]);
  const [filter, setFilter] = useState<Status>("ALL");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const url = `${API}/api/beta/feedback?limit=200${filter === "ALL" ? "" : `&status=${filter}`}`;
      // admin_session cookie is HttpOnly Secure — must include credentials.
      const res = await fetch(url, {});
      if (res.ok) {
        const data = await res.json();
        setRows(data.rows ?? []);
      } else {
        setRows([]);
      }
    } finally {
      setBusy(false);
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  const totals = rows.reduce(
    (acc, r) => {
      const s = (r.severity ?? "normal").toLowerCase();
      acc[s] = (acc[s] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    <div className="space-y-5" data-testid="vault-beta-feedback-tab">
      <Card>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <Title>Beta Feedback Inbox</Title>
            <Text className="mt-1">
              Messages submitted via the floating bug-report bubble on every page.
              Filter by status and triage from here.
            </Text>
          </div>
          <button
            onClick={load}
            disabled={busy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 text-xs font-bold uppercase tracking-wider disabled:opacity-50"
            data-testid="vault-beta-feedback-refresh"
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Refresh
          </button>
        </div>

        <div className="flex gap-2 mt-4 flex-wrap" role="tablist">
          {(["ALL", "UNREAD", "TRIAGED", "RESOLVED"] as Status[]).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider ${
                filter === s
                  ? "bg-cyan-500 text-black"
                  : "bg-slate-800 text-cyan-300 border border-cyan-500/20"
              }`}
              data-testid={`vault-beta-feedback-filter-${s.toLowerCase()}`}
            >
              {s}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-4">
          {(["low", "normal", "high", "critical"] as const).map((sev) => (
            <div key={sev} className="px-3 py-2 rounded-lg bg-slate-800/40 border border-slate-700">
              <p className="text-[10px] uppercase tracking-widest text-slate-400">{sev}</p>
              <p className="text-xl font-black text-white tabular-nums">{totals[sev] ?? 0}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        {rows.length === 0 ? (
          <div className="text-center py-10 text-slate-500" data-testid="vault-beta-feedback-empty">
            <MessageSquareWarning className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No feedback in this filter yet.</p>
          </div>
        ) : (
          <div className="space-y-2" data-testid="vault-beta-feedback-list">
            {rows.map((r, idx) => (
              <div
                key={`${r.user_id}-${r.submitted_at}-${idx}`}
                className="p-3 rounded-lg bg-slate-800/50 border border-slate-700"
              >
                <div className="flex items-center gap-2 flex-wrap mb-1.5">
                  <Badge color={SEVERITY_COLOR[r.severity] ?? "gray"}>
                    {r.severity?.toUpperCase()}
                  </Badge>
                  <Badge color="cyan">{r.category}</Badge>
                  {r.status === "UNREAD" ? <Badge color="amber">UNREAD</Badge> : null}
                  <span className="text-xs text-slate-400 font-mono">{r.user_id}</span>
                  <span className="text-xs text-slate-500">·</span>
                  <span className="text-xs text-slate-500">
                    {new Date(r.submitted_at).toLocaleString()}
                  </span>
                  {r.page ? (
                    <>
                      <span className="text-xs text-slate-500">·</span>
                      <code className="text-xs text-cyan-400">{r.page}</code>
                    </>
                  ) : null}
                </div>
                <p className="text-sm text-white leading-relaxed">{r.comment}</p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
