/**
 * AgeVerificationQueueCard — God Mode admin tool for the 21+ Restricted
 * Goods Delivery Standard. Shows pending submissions + an approve /
 * reject pair so an admin can clear the queue without leaving the page.
 */
import { useEffect, useState } from "react";
import { ShieldCheck, ShieldX, Loader2, IdCard, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { authFetch } from "@/utils/secureAuth";

const API = process.env.REACT_APP_BACKEND_URL;

interface AvpRecord {
  user_id: string;
  status: string;
  age: number | null;
  dob: string | null;
  id_document_url?: string | null;
  selfie_url?: string | null;
  submitted_at?: string | null;
  appeal_message?: string | null;
}

interface AvpConstants {
  decline_reasons: Record<string, string>;
}

const FILTERS: Array<{ id: string; label: string }> = [
  { id: "pending", label: "Pending" },
  { id: "appeal", label: "Appeals" },
  { id: "verified", label: "Approved" },
  { id: "rejected", label: "Rejected" },
];

export default function AgeVerificationQueueCard() {
  const [filter, setFilter] = useState("pending");
  const [items, setItems] = useState<AvpRecord[]>([]);
  const [constants, setConstants] = useState<AvpConstants | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyUser, setBusyUser] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [qRes, cRes] = await Promise.all([
        authFetch(`${API}/api/age-verification/admin/queue?status_filter=${filter}&limit=50`),
        fetch(`${API}/api/age-verification/constants`),
      ]);
      if (qRes.ok) {
        const d = await qRes.json();
        setItems(d.items || []);
      } else {
        setItems([]);
      }
      if (cRes.ok) setConstants(await cRes.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const decide = async (
    user_id: string,
    decision: "verified" | "rejected",
    rejected_reason?: string
  ) => {
    setBusyUser(user_id);
    try {
      const res = await authFetch(`${API}/api/age-verification/admin/decide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id, decision, rejected_reason }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.detail || "Decision failed");
        return;
      }
      toast.success(decision === "verified" ? "Approved" : "Rejected");
      await load();
    } finally {
      setBusyUser(null);
    }
  };

  return (
    <div
      className="rounded-2xl border border-amber-400/25 bg-gradient-to-br from-[#1a1308] via-[#0F0720] to-[#150629] p-5 md:p-6"
      data-testid="age-verification-queue-card"
    >
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] font-bold text-amber-300/90">
            Compliance · 21+ Verification
          </p>
          <h3 className="text-xl md:text-2xl font-black text-white mt-0.5">
            Age Verification Queue
          </h3>
        </div>
        <div className="flex gap-1.5 flex-wrap" data-testid="avp-queue-filters">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`px-2.5 py-1 rounded-full text-[10px] uppercase tracking-widest font-bold border transition-colors ${
                filter === f.id
                  ? "bg-amber-400 text-amber-950 border-amber-300"
                  : "bg-black/30 text-amber-200 border-amber-400/30 hover:bg-amber-500/10"
              }`}
              data-testid={`avp-queue-filter-${f.id}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10 text-purple-300/70">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading queue…
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-10 text-purple-300/60 text-sm" data-testid="avp-queue-empty">
          No items in {filter} queue.
        </div>
      ) : (
        <div className="space-y-3" data-testid="avp-queue-list">
          {items.map((r) => (
            <div
              key={r.user_id}
              className="rounded-xl bg-black/30 border border-amber-400/15 p-3 flex flex-col md:flex-row items-start md:items-center gap-3"
              data-testid={`avp-queue-row-${r.user_id}`}
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs font-mono text-amber-100/90">
                  user_id: <span className="text-amber-300 font-bold">{r.user_id.slice(0, 14)}…</span>
                </p>
                <p className="text-[11px] text-purple-300/75 mt-0.5">
                  Age: <span className="text-white font-bold">{r.age ?? "—"}</span> · DOB:{" "}
                  {r.dob || "—"} · Submitted: {r.submitted_at ? r.submitted_at.slice(0, 16) : "—"}
                </p>
                {r.appeal_message && (
                  <p className="text-[11px] italic text-cyan-300/80 mt-1 line-clamp-2">
                    Appeal: "{r.appeal_message}"
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                {r.id_document_url && (
                  <a
                    href={r.id_document_url}
                    target="_blank"
                    rel="noreferrer"
                    className="px-2 py-1 rounded-md bg-white/5 hover:bg-white/15 text-[10px] text-amber-100 flex items-center gap-1"
                    data-testid={`avp-queue-id-${r.user_id}`}
                  >
                    <IdCard className="w-3 h-3" /> ID
                  </a>
                )}
                {r.selfie_url && (
                  <a
                    href={r.selfie_url}
                    target="_blank"
                    rel="noreferrer"
                    className="px-2 py-1 rounded-md bg-white/5 hover:bg-white/15 text-[10px] text-amber-100 flex items-center gap-1"
                    data-testid={`avp-queue-selfie-${r.user_id}`}
                  >
                    <ImageIcon className="w-3 h-3" /> Selfie
                  </a>
                )}
              </div>
              {(filter === "pending" || filter === "appeal") && (
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    disabled={busyUser === r.user_id}
                    onClick={() => decide(r.user_id, "verified")}
                    className="px-3 py-1.5 rounded-full bg-emerald-500 hover:bg-emerald-400 text-[#072A1E] text-[10px] font-bold disabled:opacity-50 flex items-center gap-1"
                    data-testid={`avp-queue-approve-${r.user_id}`}
                  >
                    <ShieldCheck className="w-3 h-3" /> Approve
                  </button>
                  <select
                    disabled={busyUser === r.user_id}
                    onChange={(e) => {
                      if (e.target.value) decide(r.user_id, "rejected", e.target.value);
                    }}
                    defaultValue=""
                    className="px-2 py-1.5 rounded-full bg-red-500/80 hover:bg-red-400 text-white text-[10px] font-bold disabled:opacity-50"
                    data-testid={`avp-queue-reject-${r.user_id}`}
                  >
                    <option value="">Reject…</option>
                    {Object.keys(constants?.decline_reasons || {}).map((k) => (
                      <option key={k} value={k}>{k.replace(/_/g, " ")}</option>
                    ))}
                  </select>
                </div>
              )}
              {r.status === "rejected" && (
                <span className="px-2 py-1 rounded-full bg-red-500/15 text-red-200 border border-red-400/30 text-[9px] uppercase tracking-widest font-bold">
                  <ShieldX className="w-3 h-3 inline mr-1" /> Rejected
                </span>
              )}
              {r.status === "verified" && (
                <span className="px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-200 border border-emerald-400/30 text-[9px] uppercase tracking-widest font-bold">
                  <ShieldCheck className="w-3 h-3 inline mr-1" /> Verified
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
