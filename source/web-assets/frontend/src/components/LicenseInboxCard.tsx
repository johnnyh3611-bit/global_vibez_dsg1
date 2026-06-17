/**
 * <LicenseInboxCard /> — Notification card for the Artist Studio.
 *
 * Polls `/api/music-group/royalty/me` and surfaces the most recent
 * collective-royalty events (MME auto-splits, License Marketplace
 * sales, and admin disbursements). Per row: track title, source,
 * total payout, and the per-collaborator split — so the artist sees
 * proof every collaborator was credited correctly in real time.
 *
 * Drop-in: `<LicenseInboxCard />` — no props.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Inbox, Coins, Users, ExternalLink, RefreshCw } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL || '';
const token = () => localStorage.getItem('auth_token') || '';
const fmt = (n: number | undefined) => (n ?? 0).toLocaleString('en-US');

type PayoutRow = { user_id: string; role: string;
                   basis_points: number; share_coins: number };

type Royalty = {
  payout_id: string;
  track_id: string;
  track_title?: string;
  source: string;
  payout_coins: number;
  collaborator_count: number;
  payouts: PayoutRow[];
  burn_coins: number;
  at: string;
};

const SOURCE_LABEL: Record<string, string> = {
  mme_auto_split: 'Fan tip',
  manual_admin: 'Admin disbursement',
  fan_transaction: 'Fan transaction',
};

export function LicenseInboxCard() {
  const navigate = useNavigate();
  const auth = useMemo(() => ({ Authorization: `Bearer ${token()}` }), []);
  const [rows, setRows] = useState<Royalty[]>([]);
  const [loading, setLoading] = useState(true);
  const [openRow, setOpenRow] = useState<string | null>(null);

  const fetchInbox = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/music-group/royalty/me`, { headers: auth });
      const d = await r.json();
      setRows(d?.rows || []);
    } catch { /* */ }
    finally { setLoading(false); }
  }, [auth]);

  useEffect(() => {
    fetchInbox();
    const t = setInterval(fetchInbox, 30_000);
    return () => clearInterval(t);
  }, [fetchInbox]);

  return (
    <section
      className="rounded-2xl border border-fuchsia-400/30 bg-gradient-to-br from-fuchsia-950/30 via-purple-950/15 to-[#06080f] p-5"
      data-testid="license-inbox-card"
    >
      <header className="flex items-center justify-between mb-3">
        <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-fuchsia-200">
          <Inbox className="w-4 h-4" /> License Inbox
          <span className="text-[10px] text-fuchsia-300/60 font-bold">({rows.length})</span>
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/artist/music-group')}
            className="text-[10px] uppercase tracking-widest text-fuchsia-300 hover:text-fuchsia-200 flex items-center gap-1"
            data-testid="inbox-manage-splits-link"
          >
            Manage splits <ExternalLink className="w-3 h-3" />
          </button>
          <button
            onClick={fetchInbox}
            className="p-1.5 rounded-full border border-white/10 hover:bg-white/5"
            data-testid="inbox-refresh-btn"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      {loading && rows.length === 0 ? (
        <p className="text-xs text-white/40 py-3">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-xs text-white/50 py-3" data-testid="inbox-empty">
          No collective royalty events yet. Once your first fan tip lands on a
          track with collaborator splits, you'll see the live distribution
          breakdown here.
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.slice(0, 8).map(r => (
            <li
              key={r.payout_id}
              data-testid={`inbox-row-${r.payout_id}`}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2"
            >
              <button
                onClick={() => setOpenRow(openRow === r.payout_id ? null : r.payout_id)}
                className="w-full flex items-center gap-3 text-left"
                data-testid={`inbox-row-toggle-${r.payout_id}`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-white truncate">
                    {r.track_title || r.track_id}
                  </p>
                  <div className="flex items-center gap-2 text-[10px] text-white/50 mt-0.5">
                    <span className="px-1.5 py-0.5 rounded-full bg-fuchsia-500/15 text-fuchsia-200 uppercase tracking-widest text-[9px]">
                      {SOURCE_LABEL[r.source] || r.source}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" /> {r.collaborator_count}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-amber-200">
                    <Coins className="w-3 h-3 inline mb-0.5" /> {fmt(r.payout_coins)} ₵
                  </p>
                  <p className="text-[9px] text-rose-200 font-bold">
                    burn {fmt(r.burn_coins)}
                  </p>
                </div>
              </button>

              {openRow === r.payout_id && (
                <div className="mt-2 pt-2 border-t border-white/10 space-y-1"
                      data-testid={`inbox-row-detail-${r.payout_id}`}>
                  {r.payouts.map((p, i) => (
                    <div
                      key={`${r.payout_id}-${i}`}
                      className="flex items-center gap-2 text-[11px] font-mono"
                    >
                      <span className="text-white/40">{p.role || 'collaborator'}</span>
                      <span className="text-white/70 truncate flex-1">{p.user_id}</span>
                      <span className="text-purple-300">{p.basis_points} bps</span>
                      <span className="text-emerald-300 font-bold">+{fmt(p.share_coins)} ₵</span>
                    </div>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
