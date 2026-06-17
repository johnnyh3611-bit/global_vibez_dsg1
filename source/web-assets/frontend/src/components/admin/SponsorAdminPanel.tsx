/**
 * SponsorAdminPanel — God Mode UI for managing Vibe Sponsors
 * (replaces the curl-only `pending → verified` flow).
 *
 * Endpoints (admin-cookie gated):
 *   GET  /api/admin/sponsors[?status=pending|verified|rejected]
 *   POST /api/sponsors/{id}/verify   { commission_bps }
 *   POST /api/admin/sponsors/{id}/reject { reason }
 *
 * Mounted as a card inside the GodModeDashboard "Founder Controls" tab.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, Title, Text, Badge, Button } from "@tremor/react";
import { CheckCircle2, XCircle, Loader2, RefreshCw, Building2 } from "lucide-react";
import { fetchWithAuth, BACKEND_URL } from "@/utils/adminAPI";

type Sponsor = {
  sponsor_id: string;
  ambassador_id: string;
  business_name: string;
  business_type: string;
  contact_email?: string | null;
  contact_phone?: string | null;
  notes?: string | null;
  status: "pending" | "verified" | "rejected";
  commission_bps?: number;
  linked_at: string;
  verified_at?: string | null;
};

type Counts = { pending: number; verified: number; total: number };
type StatusFilter = "all" | "pending" | "verified" | "rejected";

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: "pending", label: "Pending" },
  { id: "verified", label: "Verified" },
  { id: "rejected", label: "Rejected" },
  { id: "all", label: "All" },
];

const StatusBadge = ({ status }: { status: Sponsor["status"] }) => {
  if (status === "verified") return <Badge color="emerald" data-testid={`sponsor-status-${status}`}>Verified</Badge>;
  if (status === "rejected") return <Badge color="rose" data-testid={`sponsor-status-${status}`}>Rejected</Badge>;
  return <Badge color="amber" data-testid={`sponsor-status-${status}`}>Pending</Badge>;
};

export const SponsorAdminPanel = () => {
  const [rows, setRows] = useState<Sponsor[]>([]);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [filter, setFilter] = useState<StatusFilter>("pending");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [commissionDraft, setCommissionDraft] = useState<Record<string, number>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const url = filter === "all"
        ? `${BACKEND_URL}/api/admin/sponsors`
        : `${BACKEND_URL}/api/admin/sponsors?status=${filter}`;
      const res = await fetchWithAuth(url);
      const data = await res.json();
      setRows(data.rows || []);
      setCounts(data.counts || null);
    } catch {
      /* fetchWithAuth bounces 401s */
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const handleVerify = useCallback(async (sponsor: Sponsor) => {
    setBusyId(sponsor.sponsor_id);
    try {
      const bps = commissionDraft[sponsor.sponsor_id] ?? sponsor.commission_bps ?? 50;
      await fetchWithAuth(`${BACKEND_URL}/api/sponsors/${sponsor.sponsor_id}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commission_bps: bps }),
      });
      await load();
    } finally {
      setBusyId(null);
    }
  }, [commissionDraft, load]);

  const handleReject = useCallback(async (sponsor: Sponsor) => {
    const reason = window.prompt(`Reject "${sponsor.business_name}"? Optional reason:`) ?? "";
    if (reason === null) return;
    setBusyId(sponsor.sponsor_id);
    try {
      await fetchWithAuth(`${BACKEND_URL}/api/admin/sponsors/${sponsor.sponsor_id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      await load();
    } finally {
      setBusyId(null);
    }
  }, [load]);

  const summary = useMemo(() => {
    if (!counts) return null;
    return (
      <div className="flex items-center gap-3 flex-wrap text-sm" data-testid="sponsor-admin-summary">
        <span className="px-2 py-1 rounded bg-amber-500/15 text-amber-200 font-semibold">
          Pending {counts.pending}
        </span>
        <span className="px-2 py-1 rounded bg-emerald-500/15 text-emerald-200 font-semibold">
          Verified {counts.verified}
        </span>
        <span className="px-2 py-1 rounded bg-slate-700/30 text-slate-200 font-semibold">
          Total {counts.total}
        </span>
      </div>
    );
  }, [counts]);

  return (
    <Card data-testid="sponsor-admin-panel">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
        <div className="flex items-center gap-3">
          <Building2 className="w-5 h-5 text-amber-400" />
          <div>
            <Title>Sponsor Admin · Verify Vibe Sponsors</Title>
            <Text className="text-xs text-slate-400 mt-0.5">
              Promote ambassador-linked businesses from <em>pending</em> to <em>verified</em>.
              Reaching 5 verified per ambassador unlocks 1 free chair (cap 3 / 15).
            </Text>
          </div>
        </div>
        <Button
          icon={RefreshCw}
          variant="secondary"
          onClick={load}
          loading={loading}
          data-testid="sponsor-admin-refresh-btn"
        >
          Refresh
        </Button>
      </div>

      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.id}
            data-testid={`sponsor-admin-filter-${f.id}`}
            onClick={() => setFilter(f.id)}
            className={`px-3 py-1.5 rounded text-xs font-semibold uppercase tracking-wide transition-colors ${
              filter === f.id
                ? "bg-amber-500 text-slate-900"
                : "bg-slate-800/60 text-slate-300 hover:bg-slate-700/80"
            }`}
          >
            {f.label}
          </button>
        ))}
        {summary}
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-slate-400 py-4" data-testid="sponsor-admin-loading">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading sponsors…
        </div>
      )}

      {!loading && rows.length === 0 && (
        <div className="text-sm text-slate-400 py-6 text-center" data-testid="sponsor-admin-empty">
          No sponsors {filter === "all" ? "" : `with status "${filter}"`} yet.
        </div>
      )}

      <div className="space-y-3" data-testid="sponsor-admin-list">
        {rows.map((sponsor) => (
          <div
            key={sponsor.sponsor_id}
            data-testid={`sponsor-row-${sponsor.sponsor_id}`}
            className="rounded-lg border border-white/10 bg-black/30 p-4 flex flex-wrap items-start justify-between gap-3"
          >
            <div className="flex-1 min-w-[240px]">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-white text-base">
                  {sponsor.business_name}
                </span>
                <StatusBadge status={sponsor.status} />
                <span className="text-xs text-slate-400">{sponsor.business_type}</span>
              </div>
              <div className="text-xs text-slate-400 mt-1">
                Ambassador: <span className="font-mono text-slate-300">{sponsor.ambassador_id}</span>
              </div>
              {(sponsor.contact_email || sponsor.contact_phone) && (
                <div className="text-xs text-slate-500 mt-1">
                  {sponsor.contact_email}{sponsor.contact_email && sponsor.contact_phone ? " · " : ""}
                  {sponsor.contact_phone}
                </div>
              )}
              {sponsor.notes && (
                <div className="text-xs text-slate-500 italic mt-1 line-clamp-2">{sponsor.notes}</div>
              )}
              <div className="text-[11px] text-slate-600 mt-1">
                Linked {new Date(sponsor.linked_at).toLocaleString()}
              </div>
            </div>

            {sponsor.status === "pending" && (
              <div className="flex flex-col gap-2 items-end">
                <label className="text-[11px] text-slate-400">
                  Commission (bps, 10-200):
                  <input
                    type="number"
                    min={10}
                    max={200}
                    defaultValue={sponsor.commission_bps ?? 50}
                    onChange={(e) =>
                      setCommissionDraft((d) => ({
                        ...d,
                        [sponsor.sponsor_id]: parseInt(e.target.value || "50", 10),
                      }))
                    }
                    data-testid={`sponsor-commission-input-${sponsor.sponsor_id}`}
                    className="ml-2 w-20 rounded bg-slate-900/80 border border-slate-700 px-2 py-1 text-xs text-emerald-200"
                  />
                </label>
                <div className="flex gap-2">
                  <Button
                    icon={CheckCircle2}
                    color="emerald"
                    size="xs"
                    loading={busyId === sponsor.sponsor_id}
                    disabled={busyId !== null && busyId !== sponsor.sponsor_id}
                    onClick={() => handleVerify(sponsor)}
                    data-testid={`sponsor-verify-btn-${sponsor.sponsor_id}`}
                  >
                    Verify
                  </Button>
                  <Button
                    icon={XCircle}
                    color="rose"
                    size="xs"
                    variant="secondary"
                    loading={busyId === sponsor.sponsor_id}
                    disabled={busyId !== null && busyId !== sponsor.sponsor_id}
                    onClick={() => handleReject(sponsor)}
                    data-testid={`sponsor-reject-btn-${sponsor.sponsor_id}`}
                  >
                    Reject
                  </Button>
                </div>
              </div>
            )}
            {sponsor.status === "verified" && (
              <div className="text-xs text-emerald-300 font-semibold" data-testid={`sponsor-verified-stamp-${sponsor.sponsor_id}`}>
                ✓ {(sponsor.commission_bps ?? 50) / 100}% commission · {sponsor.verified_at ? new Date(sponsor.verified_at).toLocaleDateString() : ""}
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
};

export default SponsorAdminPanel;
