/**
 * BetaWaitlistAdmin — God Mode dashboard tile for managing the public
 * /beta-tester waitlist. Lives at /vibe-vault-admin/beta-waitlist.
 *
 * Founder ask 2026-02-17: "I want to see live waitlist stats, top
 * interests, recent signups, top referral sources, and bulk-invite
 * signups with one click — each invite auto-dispatches a personalized
 * 'Your seat is ready' Resend email with a unique magic-link token."
 *
 * Endpoints used (all admin-gated, HttpOnly cookie):
 *   GET  /api/admin/beta-waitlist/stats
 *   GET  /api/admin/beta-waitlist?limit=&skip=&status=
 *   POST /api/admin/beta-waitlist/bulk-invite
 *   POST /api/admin/beta-waitlist/{id}/mark-invited
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Users, Sparkles, Mail, Send, Crown, ArrowLeft,
  RefreshCw, Check, X, ChevronLeft, ChevronRight, Loader2,
} from 'lucide-react';
import { fetchWithAuth } from '@/utils/adminAPI';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL as string;

interface Stats {
  total_signups: number;
  waitlisted: number;
  invited: number;
  redeemed: number;
  conversion_pct: number;
  top_interests: { interest: string; count: number }[];
  top_referrals: { referral: string; count: number }[];
}

interface Signup {
  signup_id: string;
  email: string;
  name: string;
  interests: string[];
  referral?: string | null;
  position: number;
  status: 'waitlisted' | 'invited' | 'redeemed';
  created_at: string;
  invited_at?: string | null;
  redeemed_at?: string | null;
}

interface ListResponse {
  rows: Signup[];
  total: number;
  limit: number;
  skip: number;
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  waitlisted: { label: 'WAITLISTED', color: 'bg-amber-500/15 text-amber-300 border-amber-500/40' },
  invited:    { label: 'INVITED',    color: 'bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/40' },
  redeemed:   { label: 'REDEEMED',   color: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40' },
};

const PAGE_SIZE = 50;

export default function BetaWaitlistAdmin() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats | null>(null);
  const [list, setList] = useState<ListResponse | null>(null);
  const [filter, setFilter] = useState<'' | 'waitlisted' | 'invited' | 'redeemed'>('');
  const [skip, setSkip] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmInvite, setConfirmInvite] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadStats = useCallback(async () => {
    try {
      const r = await fetchWithAuth(`${BACKEND_URL}/api/admin/beta-waitlist/stats`);
      if (r.ok) setStats(await r.json());
    } catch {
      // 401 redirects via fetchWithAuth
    }
  }, []);

  const loadList = useCallback(async () => {
    try {
      const qs = new URLSearchParams({
        limit: String(PAGE_SIZE),
        skip: String(skip),
      });
      if (filter) qs.set('status', filter);
      const r = await fetchWithAuth(`${BACKEND_URL}/api/admin/beta-waitlist?${qs.toString()}`);
      if (r.ok) setList(await r.json());
    } catch {
      // 401 redirects via fetchWithAuth
    }
  }, [filter, skip]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadStats(), loadList()]);
    setRefreshing(false);
  }, [loadStats, loadList]);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadStats(), loadList()]).finally(() => setLoading(false));
  }, [loadStats, loadList]);

  const allSelected = list && list.rows.length > 0 &&
    list.rows.filter((r) => r.status === 'waitlisted').every((r) => selected.has(r.signup_id));

  const toggleAll = () => {
    if (!list) return;
    const eligible = list.rows.filter((r) => r.status === 'waitlisted').map((r) => r.signup_id);
    setSelected((prev) => {
      const next = new Set(prev);
      const allOn = eligible.every((id) => next.has(id));
      if (allOn) eligible.forEach((id) => next.delete(id));
      else eligible.forEach((id) => next.add(id));
      return next;
    });
  };

  const toggleOne = (id: string, status: string) => {
    if (status !== 'waitlisted') return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const runBulkInvite = async () => {
    if (selected.size === 0) return;
    setInviting(true);
    try {
      const r = await fetchWithAuth(`${BACKEND_URL}/api/admin/beta-waitlist/bulk-invite`, {
        method: 'POST',
        body: JSON.stringify({ signup_ids: [...selected] }),
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body?.detail || 'Bulk invite failed');
      setToast(
        `Sent ${body.sent_count} · Skipped ${body.skipped_count} · Failed ${body.failed_count}`,
      );
      setSelected(new Set());
      setConfirmInvite(false);
      await refresh();
      setTimeout(() => setToast(null), 5000);
    } catch (e: any) {
      setToast(`Error: ${e.message || 'Bulk invite failed'}`);
      setTimeout(() => setToast(null), 5000);
    } finally {
      setInviting(false);
    }
  };

  const markInvited = async (signup_id: string) => {
    try {
      const r = await fetchWithAuth(
        `${BACKEND_URL}/api/admin/beta-waitlist/${signup_id}/mark-invited`,
        { method: 'POST' },
      );
      if (!r.ok) throw new Error('Mark-invited failed');
      await refresh();
    } catch (e: any) {
      setToast(`Error: ${e.message}`);
      setTimeout(() => setToast(null), 5000);
    }
  };

  const fmtDate = (iso?: string | null) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString(undefined, {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
      });
    } catch { return iso; }
  };

  const maxInterest = useMemo(
    () => stats?.top_interests?.[0]?.count || 1,
    [stats],
  );
  const maxReferral = useMemo(
    () => stats?.top_referrals?.[0]?.count || 1,
    [stats],
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-[#07030F] flex items-center justify-center" data-testid="beta-admin-loading">
        <Loader2 className="w-8 h-8 text-fuchsia-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#07030F] p-6 text-white" data-testid="beta-admin-dashboard">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/vibe-vault-admin/dashboard')}
            data-testid="beta-admin-back"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-white/10 hover:border-white/30 text-sm text-white/70"
          >
            <ArrowLeft className="w-4 h-4" /> God Mode
          </button>
          <div>
            <h1 className="text-3xl font-black tracking-tight">
              <span className="text-white">Beta Waitlist</span>{' '}
              <span className="text-transparent bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text">
                Control Tower
              </span>
            </h1>
            <p className="text-amber-400/70 text-xs uppercase tracking-[0.3em]">
              Bulk Invite · Magic-Link Tokens · Live Stats
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refresh}
            disabled={refreshing}
            data-testid="beta-admin-refresh"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-white/10 hover:border-white/30 text-sm transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <Link
            to="/beta-tester"
            target="_blank"
            data-testid="beta-admin-public-link"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-sm text-amber-300"
          >
            <Sparkles className="w-4 h-4" />
            View public page
          </Link>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <motion.div
          initial={{ y: -10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          data-testid="beta-admin-toast"
          className="fixed top-6 right-6 z-50 rounded-xl bg-black/90 border border-fuchsia-500/40 px-4 py-3 text-sm shadow-2xl"
        >
          {toast}
        </motion.div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8" data-testid="beta-admin-stats">
        {[
          { id: 'total', label: 'Total signups', value: stats?.total_signups ?? 0, icon: Users, color: 'from-cyan-500 to-blue-500' },
          { id: 'waitlisted', label: 'Waitlisted', value: stats?.waitlisted ?? 0, icon: Mail, color: 'from-amber-500 to-orange-500' },
          { id: 'invited', label: 'Invited', value: stats?.invited ?? 0, icon: Send, color: 'from-fuchsia-500 to-purple-500' },
          { id: 'redeemed', label: 'Redeemed', value: stats?.redeemed ?? 0, icon: Crown, color: 'from-emerald-500 to-teal-500' },
        ].map((card) => (
          <motion.div
            key={card.id}
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            data-testid={`beta-admin-stat-${card.id}`}
            className="rounded-2xl border border-white/10 bg-white/[0.02] p-4"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] uppercase tracking-[0.3em] text-white/50">{card.label}</span>
              <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${card.color} flex items-center justify-center`}>
                <card.icon className="w-4 h-4 text-white" />
              </div>
            </div>
            <div className="text-3xl font-black tabular-nums">{card.value.toLocaleString()}</div>
          </motion.div>
        ))}
      </div>

      {/* Conversion bar */}
      <div className="mb-8 rounded-2xl border border-white/10 bg-white/[0.02] p-5" data-testid="beta-admin-conversion">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] uppercase tracking-widest text-white/50 font-black">Invite → Redeem Conversion</span>
          <span className="text-2xl font-black text-emerald-300 tabular-nums" data-testid="beta-admin-conversion-pct">
            {stats?.conversion_pct ?? 0}%
          </span>
        </div>
        <div className="h-2 rounded-full bg-black/40 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-amber-400 to-emerald-400 transition-all"
            style={{ width: `${Math.min(100, stats?.conversion_pct ?? 0)}%` }}
          />
        </div>
      </div>

      {/* Top interests + referrals */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5" data-testid="beta-admin-top-interests">
          <h3 className="text-sm font-black uppercase tracking-widest text-white/70 mb-4">Top Interests</h3>
          {(stats?.top_interests || []).length === 0 ? (
            <p className="text-xs text-white/40">No data yet — interests will appear once signups start picking pills.</p>
          ) : (
            <div className="space-y-2">
              {(stats?.top_interests || []).map((row) => (
                <div key={row.interest} className="flex items-center gap-3">
                  <span className="w-32 shrink-0 text-xs text-white/70 truncate capitalize">{row.interest.replace('-', ' ')}</span>
                  <div className="flex-1 h-2 rounded-full bg-black/40 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-fuchsia-500 to-amber-400"
                      style={{ width: `${(row.count / maxInterest) * 100}%` }}
                    />
                  </div>
                  <span className="w-10 text-right text-xs font-black tabular-nums">{row.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5" data-testid="beta-admin-top-referrals">
          <h3 className="text-sm font-black uppercase tracking-widest text-white/70 mb-4">Top Referral Sources</h3>
          {(stats?.top_referrals || []).length === 0 ? (
            <p className="text-xs text-white/40">No referrals captured yet.</p>
          ) : (
            <div className="space-y-2">
              {(stats?.top_referrals || []).map((row) => (
                <div key={row.referral} className="flex items-center gap-3">
                  <span className="w-32 shrink-0 text-xs text-white/70 truncate">{row.referral}</span>
                  <div className="flex-1 h-2 rounded-full bg-black/40 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-400 to-emerald-400"
                      style={{ width: `${(row.count / maxReferral) * 100}%` }}
                    />
                  </div>
                  <span className="w-10 text-right text-xs font-black tabular-nums">{row.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Ambassador leaderboard widget — Feb 2026 Late × 3 viral funnel */}
      <AmbassadorLeaderboardWidget />

      {/* Founder weekly digest — Feb 2026 Late × 4 */}
      <WeeklyDigestPanel />

      {/* Filter + Bulk-invite bar */}
      <div className="flex flex-wrap items-center gap-3 mb-4" data-testid="beta-admin-toolbar">
        <div className="flex items-center gap-1.5 rounded-full bg-black/40 border border-white/10 p-1">
          {(['', 'waitlisted', 'invited', 'redeemed'] as const).map((f) => (
            <button
              key={f || 'all'}
              onClick={() => { setFilter(f); setSkip(0); setSelected(new Set()); }}
              data-testid={`beta-admin-filter-${f || 'all'}`}
              className={
                'px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-widest transition-colors ' +
                (filter === f ? 'bg-white text-black' : 'text-white/60 hover:text-white')
              }
            >
              {f || 'All'}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <span className="text-xs text-white/50" data-testid="beta-admin-selected-count">
          {selected.size} selected
        </span>
        <button
          onClick={() => setConfirmInvite(true)}
          disabled={selected.size === 0}
          data-testid="beta-admin-bulk-invite-btn"
          className="inline-flex items-center gap-2 px-5 py-2 rounded-lg font-black text-xs uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          style={{
            background: 'linear-gradient(135deg,#FF8A1F 0%,#FFD33D 100%)',
            color: '#0A0A0F',
          }}
        >
          <Send className="w-4 h-4" />
          Bulk Invite ({selected.size})
        </button>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
        <table className="w-full text-sm" data-testid="beta-admin-table">
          <thead>
            <tr className="bg-black/30 text-[10px] uppercase tracking-widest text-white/50">
              <th className="px-4 py-3 text-left w-10">
                <input
                  type="checkbox"
                  checked={!!allSelected}
                  onChange={toggleAll}
                  data-testid="beta-admin-select-all"
                  className="accent-amber-400"
                />
              </th>
              <th className="px-4 py-3 text-left">#</th>
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">Email</th>
              <th className="px-4 py-3 text-left">Interests</th>
              <th className="px-4 py-3 text-left">Referral</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Signed up</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(list?.rows || []).map((row) => (
              <tr
                key={row.signup_id}
                data-testid={`beta-admin-row-${row.signup_id}`}
                className="border-t border-white/5 hover:bg-white/[0.03] transition-colors"
              >
                <td className="px-4 py-3">
                  {row.status === 'waitlisted' ? (
                    <input
                      type="checkbox"
                      checked={selected.has(row.signup_id)}
                      onChange={() => toggleOne(row.signup_id, row.status)}
                      data-testid={`beta-admin-select-${row.signup_id}`}
                      className="accent-amber-400"
                    />
                  ) : <span className="text-white/20">—</span>}
                </td>
                <td className="px-4 py-3 text-white/40 tabular-nums">{row.position}</td>
                <td className="px-4 py-3 font-bold">{row.name}</td>
                <td className="px-4 py-3 text-white/80 font-mono text-xs">{row.email}</td>
                <td className="px-4 py-3 text-xs text-white/60">
                  {(row.interests || []).slice(0, 3).join(' · ') || '—'}
                </td>
                <td className="px-4 py-3 text-xs text-white/50 truncate max-w-[140px]">
                  {row.referral || '—'}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-block px-2 py-0.5 rounded-md border text-[10px] font-black ${STATUS_LABEL[row.status]?.color || 'bg-white/10 text-white/70 border-white/20'}`}>
                    {STATUS_LABEL[row.status]?.label || row.status.toUpperCase()}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-white/50">{fmtDate(row.created_at)}</td>
                <td className="px-4 py-3 text-right">
                  {row.status === 'waitlisted' && (
                    <button
                      onClick={() => markInvited(row.signup_id)}
                      data-testid={`beta-admin-mark-${row.signup_id}`}
                      className="text-xs text-fuchsia-300 hover:text-fuchsia-200 underline-offset-2 hover:underline"
                    >
                      Mark invited
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {(list?.rows || []).length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-white/40 text-sm" data-testid="beta-admin-empty">
                  No signups in this filter yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {list && list.total > PAGE_SIZE && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-white/10 text-xs text-white/60" data-testid="beta-admin-pagination">
            <span>
              Showing {skip + 1}–{Math.min(skip + PAGE_SIZE, list.total)} of {list.total}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSkip(Math.max(0, skip - PAGE_SIZE))}
                disabled={skip === 0}
                data-testid="beta-admin-page-prev"
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-white/10 hover:border-white/30 disabled:opacity-30"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Prev
              </button>
              <button
                onClick={() => setSkip(skip + PAGE_SIZE)}
                disabled={skip + PAGE_SIZE >= list.total}
                data-testid="beta-admin-page-next"
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-white/10 hover:border-white/30 disabled:opacity-30"
              >
                Next <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Confirm modal */}
      {confirmInvite && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center p-6"
          data-testid="beta-admin-confirm-modal"
          style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)' }}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="rounded-2xl border border-amber-500/40 bg-[#13131A] p-7 max-w-md w-full"
          >
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-amber-500/20 mb-4">
              <Send className="w-6 h-6 text-amber-300" />
            </div>
            <h3 className="text-2xl font-black mb-2">Send {selected.size} invites?</h3>
            <p className="text-sm text-white/60 mb-5 leading-relaxed">
              Each selected signup will be marked <strong className="text-fuchsia-300">invited</strong> and
              receive a personalized magic-link email valid for 14 days. This can't be undone — but already-invited
              records are skipped automatically.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmInvite(false)}
                disabled={inviting}
                data-testid="beta-admin-confirm-cancel"
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-white/15 hover:border-white/30 text-sm font-bold disabled:opacity-50"
              >
                <X className="w-4 h-4" /> Cancel
              </button>
              <button
                onClick={runBulkInvite}
                disabled={inviting}
                data-testid="beta-admin-confirm-send"
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-black uppercase tracking-widest disabled:opacity-50"
                style={{
                  background: 'linear-gradient(135deg,#FF8A1F 0%,#FFD33D 100%)',
                  color: '#0A0A0F',
                }}
              >
                {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {inviting ? 'Sending…' : 'Send invites'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}


// ── Ambassador Leaderboard widget ────────────────────────────────────────
interface LeaderboardRow {
  rank: number;
  name: string;
  referred_count: number;
  is_ambassador: boolean;
  position?: number;
}
interface LeaderboardResponse {
  rows: LeaderboardRow[];
  ambassador_threshold: number;
  total_ambassadors: number;
}

function AmbassadorLeaderboardWidget() {
  const [board, setBoard] = useState<LeaderboardResponse | null>(null);

  useEffect(() => {
    let alive = true;
    const fetchBoard = () => {
      fetch(`${BACKEND_URL}/api/beta-waitlist/leaderboard?limit=10`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d: LeaderboardResponse | null) => {
          if (alive && d) setBoard(d);
        })
        .catch(() => { /* silent */ });
    };
    fetchBoard();
    const id = setInterval(fetchBoard, 30000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  return (
    <div
      data-testid="beta-admin-leaderboard"
      className="rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/[0.05] to-orange-500/[0.02] p-5 mb-8"
    >
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.4em] text-amber-300 font-black mb-1">
            Viral Funnel
          </div>
          <h3 className="text-xl font-black">Ambassador Leaderboard</h3>
          <p className="text-xs text-white/50 mt-1">
            {board?.total_ambassadors ?? 0} ambassadors so far · threshold {board?.ambassador_threshold ?? 5}+
          </p>
        </div>
      </div>
      {(board?.rows || []).length === 0 ? (
        <p
          data-testid="beta-admin-leaderboard-empty"
          className="text-xs text-white/40 py-6 text-center"
        >
          No referrals yet — share `/beta-tester?ref=YOUR_CODE` links to start the funnel.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {board!.rows.map((row) => (
            <div
              key={`${row.rank}-${row.name}`}
              data-testid={`beta-admin-leaderboard-row-${row.rank}`}
              className="flex items-center gap-3 rounded-lg border border-white/5 bg-black/30 px-3 py-2.5"
            >
              <span
                className={
                  'w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-black tabular-nums shrink-0 ' +
                  (row.rank === 1
                    ? 'bg-amber-400 text-black'
                    : row.rank === 2
                    ? 'bg-slate-300 text-black'
                    : row.rank === 3
                    ? 'bg-orange-400 text-black'
                    : 'bg-white/10 text-white/60')
                }
              >
                #{row.rank}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-sm truncate">{row.name}</span>
                  {row.is_ambassador && (
                    <Crown className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                  )}
                </div>
              </div>
              <span className="text-amber-300 font-black tabular-nums text-sm">
                {row.referred_count}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}



// ── Founder Weekly Digest panel ──────────────────────────────────────────
interface DigestPayload {
  week_signups: number;
  prev_week_signups: number;
  delta_pct: number;
  total_signups: number;
  total_ambassadors: number;
  avg_redemption_hours: number | null;
  zero_days: string[];
  top_climbers: { name: string; referred_count: number; is_ambassador: boolean }[];
  new_ambassadors: { name: string; referred_count: number }[];
  conversion_pct: number;
  generated_at: string;
}
interface DigestPreviewResponse {
  ok: boolean;
  payload: DigestPayload;
  last_run: {
    generated_at?: string;
    recipient?: string;
    email_sent?: boolean;
    iso_week?: string;
    week_signups?: number;
    error?: string | null;
  } | null;
}

function WeeklyDigestPanel() {
  const [data, setData] = useState<DigestPreviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [recipient, setRecipient] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  const loadPreview = useCallback(async () => {
    try {
      const r = await fetchWithAuth(`${BACKEND_URL}/api/admin/beta-waitlist/digest/preview`);
      if (r.ok) setData(await r.json());
    } catch {
      // 401 redirects via fetchWithAuth
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadPreview(); }, [loadPreview]);

  const sendNow = async () => {
    setSending(true);
    try {
      const r = await fetchWithAuth(`${BACKEND_URL}/api/admin/beta-waitlist/digest/send`, {
        method: 'POST',
        body: JSON.stringify({ recipient: recipient.trim() || null }),
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body?.detail || 'Digest send failed');
      const a = body.audit || {};
      setToast(
        a.email_sent
          ? `Digest sent → ${a.recipient}`
          : `Digest dispatch failed: ${a.error || 'unknown error'}`,
      );
      setTimeout(() => setToast(null), 5000);
      await loadPreview();
    } catch (e: any) {
      setToast(`Error: ${e.message}`);
      setTimeout(() => setToast(null), 5000);
    } finally {
      setSending(false);
    }
  };

  const fmtAt = (iso?: string) => {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleString(); } catch { return iso; }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 mb-8 text-xs text-white/50">
        <Loader2 className="w-4 h-4 inline-block animate-spin mr-2" />
        Loading weekly digest preview…
      </div>
    );
  }

  const p = data?.payload;
  const lr = data?.last_run;

  return (
    <div
      data-testid="beta-admin-digest"
      className="rounded-2xl border border-cyan-500/30 bg-gradient-to-br from-cyan-500/[0.05] to-blue-500/[0.02] p-5 mb-8"
    >
      {toast && (
        <div
          data-testid="beta-admin-digest-toast"
          className="mb-4 rounded-lg bg-black/60 border border-cyan-500/40 px-4 py-2.5 text-sm text-cyan-200"
        >
          {toast}
        </div>
      )}

      <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
        <div>
          <div className="text-[10px] uppercase tracking-[0.4em] text-cyan-300 font-black mb-1">
            Founder Pulse · Auto-Mondays 09:00 UTC
          </div>
          <h3 className="text-xl font-black">Weekly Digest</h3>
          <p className="text-xs text-white/50 mt-1">
            One-glance signal of the funnel. Auto-emailed every Monday — preview the next one below or send a one-off now.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <input
            type="email"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder="recipient@email.com (optional)"
            data-testid="beta-admin-digest-recipient"
            className="rounded-lg bg-black/50 border border-white/15 px-3 py-2 text-xs font-mono text-white/80 placeholder-white/30 focus:border-cyan-400 focus:outline-none"
          />
          <button
            onClick={sendNow}
            disabled={sending}
            data-testid="beta-admin-digest-send-btn"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            style={{
              background: 'linear-gradient(135deg,#22D3EE 0%,#3B82F6 100%)',
              color: '#0A0A0F',
            }}
          >
            {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            {sending ? 'Sending…' : 'Send digest now'}
          </button>
        </div>
      </div>

      {/* Last run status */}
      <div
        data-testid="beta-admin-digest-last-run"
        className="rounded-lg border border-white/10 bg-black/30 px-4 py-3 mb-4 text-xs"
      >
        {lr ? (
          <span className="text-white/70">
            <span className={lr.email_sent ? 'text-emerald-300' : 'text-rose-300'}>
              {lr.email_sent ? '✓ Last sent' : '✗ Last attempt failed'}
            </span>
            {' · '}
            <span className="text-white">{fmtAt(lr.generated_at)}</span>
            {lr.recipient && (<> {' → '}<span className="font-mono">{lr.recipient}</span></>)}
            {lr.iso_week && (<> {' · '}<span className="text-white/50">{lr.iso_week}</span></>)}
            {lr.error && (<> {' · '}<span className="text-rose-300">{lr.error}</span></>)}
          </span>
        ) : (
          <span className="text-white/50">No digest dispatched yet — click "Send digest now" to fire one immediately.</span>
        )}
      </div>

      {/* Preview cards */}
      {p && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <div className="rounded-lg border border-white/10 bg-black/30 p-3">
            <div className="text-[10px] uppercase tracking-widest text-white/50 font-black">This week</div>
            <div className="text-lg font-black text-white tabular-nums">{p.week_signups}</div>
            <div className={(p.delta_pct >= 0 ? 'text-emerald-300' : 'text-rose-300') + ' text-[10px] font-black'}>
              {p.delta_pct >= 0 ? '▲' : '▼'} {Math.abs(p.delta_pct)}% vs prev
            </div>
          </div>
          <div className="rounded-lg border border-white/10 bg-black/30 p-3">
            <div className="text-[10px] uppercase tracking-widest text-white/50 font-black">Top climber</div>
            <div className="text-sm font-black text-white truncate">
              {p.top_climbers[0]?.name || '—'}
            </div>
            <div className="text-amber-300 text-[10px] font-black">
              {p.top_climbers[0]?.referred_count ?? 0} refs
            </div>
          </div>
          <div className="rounded-lg border border-white/10 bg-black/30 p-3">
            <div className="text-[10px] uppercase tracking-widest text-white/50 font-black">Avg redeem</div>
            <div className="text-lg font-black text-white tabular-nums">
              {p.avg_redemption_hours != null ? `${p.avg_redemption_hours}h` : '—'}
            </div>
          </div>
          <div className="rounded-lg border border-white/10 bg-black/30 p-3">
            <div className="text-[10px] uppercase tracking-widest text-white/50 font-black">Zero-signup days</div>
            <div className={(p.zero_days.length > 0 ? 'text-rose-300' : 'text-emerald-300') + ' text-lg font-black tabular-nums'}>
              {p.zero_days.length}
            </div>
            <div className="text-[10px] text-white/40">last 7 days</div>
          </div>
        </div>
      )}
    </div>
  );
}
