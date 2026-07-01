/**
 * ContentRightsDmcaQueueCard — God Mode admin tool for DMCA notices.
 * Pending notices with Uphold / Dismiss actions + the 3-strike roster.
 */
import { useEffect, useState } from "react";
import { Gavel, ShieldX, Loader2, ShieldCheck, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { authFetch } from "@/utils/secureAuth";

const API = process.env.REACT_APP_BACKEND_URL;

interface DmcaNotice {
  notice_id: string;
  asset_id: string;
  seller_id: string;
  claimant_name: string;
  claimant_email: string;
  claim_text: string;
  claim_proof_url?: string | null;
  status: string;
  submitted_at: string;
  sla_deadline: string;
}

interface StrikeRow {
  seller_id: string;
  strikes: Array<{ asset_id: string; notice_id: string; ts: string }>;
  terminated?: boolean;
  terminated_at?: string;
}

const FILTERS = [
  { id: "pending", label: "Pending" },
  { id: "upheld", label: "Upheld" },
  { id: "dismissed", label: "Dismissed" },
];

export default function ContentRightsDmcaQueueCard() {
  const [filter, setFilter] = useState("pending");
  const [items, setItems] = useState<DmcaNotice[]>([]);
  const [strikes, setStrikes] = useState<StrikeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [qRes, sRes] = await Promise.all([
        authFetch(`${API}/api/content-rights/admin/dmca/queue?status_filter=${filter}&limit=50`),
        authFetch(`${API}/api/content-rights/admin/strikes?limit=50`),
      ]);
      if (qRes.ok) setItems((await qRes.json()).items || []);
      else setItems([]);
      if (sRes.ok) setStrikes((await sRes.json()).strikes || []);
      else setStrikes([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const decide = async (notice_id: string, decision: "upheld" | "dismissed") => {
    setBusy(notice_id);
    try {
      const res = await authFetch(`${API}/api/content-rights/admin/dmca/decide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notice_id, decision }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.detail || "Decision failed");
        return;
      }
      toast.success(decision === "upheld" ? "Takedown upheld — listing removed." : "Dismissed.");
      await load();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div
      className="rounded-2xl border border-fuchsia-400/25 bg-gradient-to-br from-[#150629] via-[#0F0720] to-[#1a1308] p-5 md:p-6"
      data-testid="content-rights-dmca-queue-card"
    >
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] font-bold text-fuchsia-300/90">
            Compliance · Anti-Piracy
          </p>
          <h3 className="text-xl md:text-2xl font-black text-white mt-0.5">
            Content Rights · DMCA Queue
          </h3>
        </div>
        <div className="flex gap-1.5 flex-wrap" data-testid="content-rights-dmca-filters">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`px-2.5 py-1 rounded-full text-[10px] uppercase tracking-widest font-bold border ${
                filter === f.id
                  ? "bg-fuchsia-400 text-[#1A0D2E] border-fuchsia-300"
                  : "bg-black/30 text-fuchsia-200 border-fuchsia-400/30 hover:bg-fuchsia-500/10"
              }`}
              data-testid={`content-rights-dmca-filter-${f.id}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10 text-purple-300/70">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading notices…
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-10 text-purple-300/60 text-sm" data-testid="content-rights-dmca-empty">
          No {filter} notices.
        </div>
      ) : (
        <div className="space-y-3 mb-5" data-testid="content-rights-dmca-list">
          {items.map((n) => (
            <div
              key={n.notice_id}
              className="rounded-xl bg-black/30 border border-fuchsia-400/15 p-3"
              data-testid={`content-rights-dmca-row-${n.notice_id}`}
            >
              <div className="flex items-start justify-between gap-2 mb-2 flex-wrap">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-mono text-fuchsia-100/90">
                    Asset: <span className="font-bold text-fuchsia-300">{n.asset_id.slice(0, 18)}…</span>
                  </p>
                  <p className="text-[11px] text-purple-300/75 mt-0.5">
                    Filed by{" "}
                    <a href={`mailto:${n.claimant_email}`} className="text-amber-200 underline">
                      {n.claimant_name}
                    </a>{" "}
                    · {n.submitted_at.slice(0, 16)} · SLA: {n.sla_deadline.slice(0, 16)}
                  </p>
                </div>
                {filter === "pending" && (
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      disabled={busy === n.notice_id}
                      onClick={() => decide(n.notice_id, "upheld")}
                      className="px-3 py-1.5 rounded-full bg-red-500 hover:bg-red-400 text-white text-[10px] font-bold flex items-center gap-1 disabled:opacity-50"
                      data-testid={`content-rights-uphold-${n.notice_id}`}
                    >
                      <Gavel className="w-3 h-3" /> Uphold
                    </button>
                    <button
                      type="button"
                      disabled={busy === n.notice_id}
                      onClick={() => decide(n.notice_id, "dismissed")}
                      className="px-3 py-1.5 rounded-full bg-emerald-500 hover:bg-emerald-400 text-[#072A1E] text-[10px] font-bold flex items-center gap-1 disabled:opacity-50"
                      data-testid={`content-rights-dismiss-${n.notice_id}`}
                    >
                      <ShieldCheck className="w-3 h-3" /> Dismiss
                    </button>
                  </div>
                )}
              </div>
              <p className="text-[11px] text-purple-100/80 italic line-clamp-3">"{n.claim_text}"</p>
              {n.claim_proof_url && (
                <a
                  href={n.claim_proof_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[10px] text-amber-200 underline mt-1 inline-block"
                >
                  Proof of ownership →
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 3-strike roster */}
      <div className="rounded-xl bg-black/40 border border-red-400/15 p-3">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="w-4 h-4 text-red-300" />
          <p className="text-[10px] uppercase tracking-widest font-bold text-red-300">
            Repeat-Infringer Roster · 3-strike termination
          </p>
        </div>
        {strikes.length === 0 ? (
          <p className="text-[11px] text-red-100/50 italic">No sellers with active strikes.</p>
        ) : (
          <ul className="space-y-1" data-testid="content-rights-strikes-list">
            {strikes.map((s) => (
              <li
                key={s.seller_id}
                className="text-[11px] font-mono text-red-100/85 flex items-center justify-between"
              >
                <span>
                  {s.seller_id.slice(0, 18)}… · {s.strikes.length} strike{s.strikes.length === 1 ? "" : "s"}
                </span>
                {s.terminated ? (
                  <span className="text-[9px] uppercase tracking-widest font-bold text-red-300">
                    <ShieldX className="w-3 h-3 inline mr-0.5" /> Terminated
                  </span>
                ) : (
                  <span className="text-[9px] uppercase tracking-widest text-amber-300">
                    Active
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
