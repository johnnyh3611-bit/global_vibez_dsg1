/**
 * /admin/dsg-logistics — Single pane of glass for the Logistics safety
 * team. Live view of active emergency incidents, recent fair-share
 * payouts (with their 40/30/30 recirculation split), and white-glove
 * violations. Admin-only — hits /api/admin/dsg-logistics/* endpoints
 * which are guarded by `require_admin` on the backend.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity, AlertTriangle, ShieldCheck, RefreshCw, ChevronLeft,
  Coins, Megaphone,
} from 'lucide-react';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL || '';
const token = () => localStorage.getItem('auth_token') || '';
const fmt = (n: number | undefined) => (n ?? 0).toLocaleString('en-US');

type Incident = {
  incident_id: string;
  driver_id: string;
  kind: string;
  status: string;
  safety_loop_armed?: boolean;
  safety_stream_url?: string;
  created_at: string;
};

type Payout = {
  payout_id: string;
  job_id: string;
  driver_id: string;
  kind: string;
  fee_coins: number;
  driver_share_coins: number;
  platform_share_coins: number;
  recirculation?: { tournament: number; treasury: number; airlock: number };
  burn_coins: number;
  at: string;
};

export default function AdminDSGLogistics() {
  const navigate = useNavigate();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [busy, setBusy] = useState(false);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  // Manual cancellation processor form
  const [formJobId, setFormJobId] = useState('');
  const [formDriverId, setFormDriverId] = useState('');
  const [formRiderId, setFormRiderId] = useState('');
  const [formKind, setFormKind] = useState<
    'passenger_cancel_late' | 'passenger_no_show' | 'platform_emergency_redirect'
  >('passenger_cancel_late');
  const [formFee, setFormFee] = useState<number>(500);
  // White-glove violation form
  const [wgDriverId, setWgDriverId] = useState('');
  const [wgJobId, setWgJobId] = useState('');
  const [wgPhysical, setWgPhysical] = useState(false);
  const [wgNote, setWgNote] = useState('');

  const auth = useMemo(() => ({ Authorization: `Bearer ${token()}` }), []);

  const fetchAll = useCallback(async () => {
    try {
      const [inc, pay] = await Promise.all([
        fetch(`${API}/api/admin/dsg-logistics/incidents/active`, { headers: auth }).then(r => r.json()),
        fetch(`${API}/api/admin/dsg-logistics/cancellation/recent`, { headers: auth }).then(r => r.json()),
      ]);
      if (inc?.detail === 'not_admin' || pay?.detail === 'not_admin'
          || inc?.detail === 'Forbidden' || pay?.detail === 'Forbidden') {
        setIsAdmin(false);
        return;
      }
      setIsAdmin(true);
      setIncidents(inc?.rows || []);
      setPayouts(pay?.rows || []);
    } catch (e) {
      toast.error('Failed to load admin state — check admin session');
    }
  }, [auth]);

  useEffect(() => {
    fetchAll();
    const t = setInterval(fetchAll, 15_000); // 15s refresh
    return () => clearInterval(t);
  }, [fetchAll]);

  const processCancellation = async () => {
    if (!formJobId.trim() || !formDriverId.trim()) {
      toast.error('Job ID + Driver ID required');
      return;
    }
    setBusy(true);
    try {
      const r = await fetch(`${API}/api/admin/dsg-logistics/cancellation/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...auth },
        body: JSON.stringify({
          job_id: formJobId,
          driver_id: formDriverId,
          rider_id: formRiderId || null,
          kind: formKind,
          fee_coins: formFee,
        }),
      });
      const d = await r.json();
      if (d?.ok) {
        toast.success(`Payout ${d.payout_id} · ${fmt(d.driver_share_coins)} ₵ to driver`);
        setFormJobId(''); setFormDriverId(''); setFormRiderId('');
        fetchAll();
      } else toast.error(d?.reason || 'Process failed');
    } finally { setBusy(false); }
  };

  const logViolation = async () => {
    if (!wgDriverId.trim()) {
      toast.error('Driver ID required');
      return;
    }
    setBusy(true);
    try {
      const r = await fetch(`${API}/api/admin/dsg-logistics/white-glove/violation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...auth },
        body: JSON.stringify({
          driver_id: wgDriverId,
          job_id: wgJobId || null,
          physical_constraint_verified: wgPhysical,
          note: wgNote || '',
        }),
      });
      const d = await r.json();
      if (d?.ok) {
        if (d.exempt) toast.success('Exempt — physical constraint verified');
        else toast.success(`Strike logged · total=${d.total_strikes} · action=${d.action}`);
        setWgDriverId(''); setWgJobId(''); setWgNote(''); setWgPhysical(false);
      } else toast.error(d?.reason || 'Log failed');
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen bg-[#04060c] text-white" data-testid="admin-dsg-logistics-page">
      <header className="sticky top-0 z-20 px-5 py-4 border-b border-cyan-400/20 backdrop-blur-md bg-[#04060c]/95">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <button
            onClick={() => navigate('/admin')}
            className="text-sm flex items-center gap-2 text-white/70 hover:text-white"
            data-testid="admin-logistics-back"
          >
            <ChevronLeft className="w-4 h-4" /> Admin Console
          </button>
          <h1 className="text-base sm:text-lg font-black tracking-widest text-cyan-300">
            DSG LOGISTICS · OPS
          </h1>
          <button
            onClick={fetchAll}
            className="text-xs flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-white/10 hover:bg-white/5"
            data-testid="admin-logistics-refresh"
          >
            <RefreshCw className="w-3 h-3" /> Refresh
          </button>
        </div>
        <p className="max-w-6xl mx-auto mt-2 text-[10px] uppercase tracking-widest text-cyan-400/60">
          40/30/30 recirculation · 0% in-app burn · auto-refresh 15s
        </p>
      </header>

      {isAdmin === false ? (
        <main className="max-w-3xl mx-auto px-5 py-12 text-center" data-testid="admin-required-panel">
          <AlertTriangle className="w-10 h-10 text-amber-300 mx-auto mb-3" />
          <h2 className="text-base font-black uppercase tracking-widest text-amber-200">
            Admin Access Required
          </h2>
          <p className="text-xs text-white/50 mt-2">
            This dashboard is restricted to the Logistics safety team. If you
            should have access, ping the on-call admin to be added.
          </p>
      </main>
      ) : (      <main className="max-w-6xl mx-auto px-5 py-6 space-y-6">
        {/* ─── Active incidents ─── */}
        <section data-testid="admin-incidents-section">
          <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-rose-200 mb-3">
            <AlertTriangle className="w-4 h-4" />
            Active Incidents ({incidents.length})
          </h2>
          {incidents.length === 0 ? (
            <p className="text-xs text-white/40 rounded-xl border border-white/10 bg-white/5 p-4">
              No active incidents — fleet running clean.
            </p>
          ) : (
            <ul className="space-y-2">
              {incidents.map(i => (
                <li
                  key={i.incident_id}
                  data-testid={`incident-row-${i.incident_id}`}
                  className="rounded-xl border border-rose-400/30 bg-rose-950/15 px-4 py-3 flex flex-wrap items-center gap-3 text-xs"
                >
                  <span className="font-mono text-rose-300">{i.incident_id}</span>
                  <span className="px-2 py-0.5 rounded-full bg-rose-500/30 text-rose-100 font-bold uppercase tracking-widest text-[9px]">
                    {i.kind}
                  </span>
                  <span className="text-white/60">driver · {i.driver_id}</span>
                  <span className={`ml-auto ${i.safety_loop_armed ? 'text-emerald-300' : 'text-white/40'}`}>
                    {i.safety_loop_armed ? 'safety ARMED' : 'idle'}
                  </span>
                  <span className="text-white/40 font-mono text-[10px]">{i.created_at}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ─── Recent payouts (with recirculation breakdown) ─── */}
        <section data-testid="admin-payouts-section">
          <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-emerald-200 mb-3">
            <Coins className="w-4 h-4" />
            Recent Cancellation Payouts ({payouts.length})
          </h2>
          {payouts.length === 0 ? (
            <p className="text-xs text-white/40 rounded-xl border border-white/10 bg-white/5 p-4">
              No payouts yet — every cancellation will land here with its
              40/30/30 platform recirculation split.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-white/10">
              <table className="min-w-full text-xs">
                <thead className="bg-white/5 text-white/50 text-[10px] uppercase tracking-widest">
                  <tr>
                    <th className="px-3 py-2 text-left">Payout</th>
                    <th className="px-3 py-2 text-left">Kind</th>
                    <th className="px-3 py-2 text-right">Fee ₵</th>
                    <th className="px-3 py-2 text-right">Driver ₵</th>
                    <th className="px-3 py-2 text-right">Platform ₵</th>
                    <th className="px-3 py-2 text-right">Tournament</th>
                    <th className="px-3 py-2 text-right">Treasury</th>
                    <th className="px-3 py-2 text-right">Airlock</th>
                    <th className="px-3 py-2 text-right">Burn</th>
                  </tr>
                </thead>
                <tbody>
                  {payouts.map(p => (
                    <tr
                      key={p.payout_id}
                      data-testid={`payout-row-${p.payout_id}`}
                      className="border-t border-white/5"
                    >
                      <td className="px-3 py-2 font-mono text-emerald-300">{p.payout_id}</td>
                      <td className="px-3 py-2 text-white/70">{p.kind}</td>
                      <td className="px-3 py-2 text-right text-white">{fmt(p.fee_coins)}</td>
                      <td className="px-3 py-2 text-right text-emerald-200">{fmt(p.driver_share_coins)}</td>
                      <td className="px-3 py-2 text-right text-cyan-200">{fmt(p.platform_share_coins)}</td>
                      <td className="px-3 py-2 text-right text-amber-200">{fmt(p.recirculation?.tournament)}</td>
                      <td className="px-3 py-2 text-right text-blue-200">{fmt(p.recirculation?.treasury)}</td>
                      <td className="px-3 py-2 text-right text-purple-200">{fmt(p.recirculation?.airlock)}</td>
                      <td className="px-3 py-2 text-right text-rose-200 font-bold">{fmt(p.burn_coins)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* ─── Manual cancellation processor ─── */}
          <section className="rounded-2xl border border-white/10 bg-white/5 p-5"
                    data-testid="admin-cancel-form">
            <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-cyan-200 mb-3">
              <Activity className="w-4 h-4" /> Process Cancellation
            </h2>
            <div className="space-y-2">
              <input
                value={formJobId}
                onChange={e => setFormJobId(e.target.value)}
                placeholder="Job ID"
                data-testid="cancel-jobid-input"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm"
              />
              <input
                value={formDriverId}
                onChange={e => setFormDriverId(e.target.value)}
                placeholder="Driver ID"
                data-testid="cancel-driverid-input"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm"
              />
              <input
                value={formRiderId}
                onChange={e => setFormRiderId(e.target.value)}
                placeholder="Rider ID (optional)"
                data-testid="cancel-riderid-input"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm"
              />
              <select
                value={formKind}
                onChange={e => setFormKind(e.target.value as any)}
                data-testid="cancel-kind-select"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm"
              >
                <option value="passenger_cancel_late">Passenger cancel late (75/25)</option>
                <option value="passenger_no_show">Passenger no-show (80/20)</option>
                <option value="platform_emergency_redirect">Emergency redirect (30/70)</option>
              </select>
              <input
                type="number"
                value={formFee}
                onChange={e => setFormFee(parseInt(e.target.value) || 500)}
                placeholder="Fee in ₵"
                data-testid="cancel-fee-input"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm"
              />
              <button
                onClick={processCancellation}
                disabled={busy}
                data-testid="process-cancel-btn"
                className="w-full px-3 py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-black text-xs font-black uppercase tracking-widest disabled:opacity-50"
              >
                Process & Recirculate
              </button>
            </div>
          </section>

          {/* ─── White-glove violation ─── */}
          <section className="rounded-2xl border border-white/10 bg-white/5 p-5"
                    data-testid="admin-wg-form">
            <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-amber-200 mb-3">
              <ShieldCheck className="w-4 h-4" /> Log White-Glove Strike
            </h2>
            <div className="space-y-2">
              <input
                value={wgDriverId}
                onChange={e => setWgDriverId(e.target.value)}
                placeholder="Driver ID"
                data-testid="wg-driverid-input"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm"
              />
              <input
                value={wgJobId}
                onChange={e => setWgJobId(e.target.value)}
                placeholder="Job ID (optional)"
                data-testid="wg-jobid-input"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm"
              />
              <textarea
                value={wgNote}
                onChange={e => setWgNote(e.target.value)}
                placeholder="Note (max 280)"
                rows={2}
                data-testid="wg-note-input"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm"
              />
              <label className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 cursor-pointer">
                <span className="text-xs">Physical constraint verified (exempt)</span>
                <input
                  type="checkbox"
                  checked={wgPhysical}
                  onChange={e => setWgPhysical(e.target.checked)}
                  data-testid="wg-physical-checkbox"
                />
              </label>
              <button
                onClick={logViolation}
                disabled={busy}
                data-testid="log-wg-btn"
                className="w-full px-3 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-black text-xs font-black uppercase tracking-widest disabled:opacity-50"
              >
                <Megaphone className="w-3 h-3 inline mr-1" /> Log Strike
              </button>
            </div>
          </section>
        </div>
      </main>
      )}
    </div>
  );
}
