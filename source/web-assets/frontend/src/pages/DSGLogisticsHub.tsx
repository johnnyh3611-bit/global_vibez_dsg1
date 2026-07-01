/**
 * /dsg-logistics — Driver Logistics Hub
 * VibeRidez + Hunger Vibez safety net (Emergency · Hardware · Tier ·
 * Override Console · Creator Kitchen). Routes the platform cut of
 * every payout through the 40/30/30 recirculation engine — no in-app
 * burns, ₵ only.
 *
 * Tabs:
 *   Override  → snapshot of active incident + camera + strikes
 *   Hardware  → dual-lens compliance verify form
 *   Tier      → driver tier matrix card
 *   Kitchen   → Hunger Vibez Creator Kitchen onboarding + featured dish
 *   Constants → blueprint splits (transparency for ops)
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldAlert, Camera, Crown, Utensils, ChevronLeft, Activity,
  AlertTriangle, Megaphone, Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';

type Tab = 'override' | 'hardware' | 'tier' | 'kitchen' | 'constants';

const API = process.env.REACT_APP_BACKEND_URL || '';

const token = () => localStorage.getItem('auth_token') || '';

const fmt = (n: number | undefined) =>
  (n ?? 0).toLocaleString('en-US');

const TABS: { key: Tab; label: string; Icon: any }[] = [
  { key: 'override', label: 'Override', Icon: ShieldAlert },
  { key: 'hardware', label: 'Hardware', Icon: Camera },
  { key: 'tier', label: 'Tier', Icon: Crown },
  { key: 'kitchen', label: 'Creator Kitchen', Icon: Utensils },
  { key: 'constants', label: 'Blueprint', Icon: Activity },
];

export default function DSGLogisticsHub() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('override');
  const [constants, setConstants] = useState<any>(null);
  const [overrideState, setOverrideState] = useState<any>(null);
  const [hardware, setHardware] = useState<any>(null);
  const [tier, setTier] = useState<any>(null);
  const [kitchen, setKitchen] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  // Forms
  const [hwInterior, setHwInterior] = useState(true);
  const [hwExterior, setHwExterior] = useState(true);
  const [hwId, setHwId] = useState('cam_dual_001');
  const [kitchenName, setKitchenName] = useState('');
  const [kitchenBio, setKitchenBio] = useState('');
  const [dishName, setDishName] = useState('');
  const [dishPrice, setDishPrice] = useState<number>(15000);
  const [delayMin, setDelayMin] = useState<number>(15);

  const auth = useMemo(() => ({
    Authorization: `Bearer ${token()}`,
  }), []);

  const fetchAll = async () => {
    try {
      const [c, o, t, ti, kit] = await Promise.all([
        fetch(`${API}/api/dsg-logistics/constants`).then(r => r.json()),
        fetch(`${API}/api/dsg-logistics/override-console/me`, { headers: auth }).then(r => r.json()),
        fetch(`${API}/api/dsg-logistics/hardware/me`, { headers: auth }).then(r => r.json()),
        fetch(`${API}/api/dsg-logistics/tier/me`, { headers: auth }).then(r => r.json()),
        fetch(`${API}/api/dsg-logistics/creator-kitchen/me`, { headers: auth }).then(r => r.json()),
      ]);
      setConstants(c);
      setOverrideState(o);
      setHardware(t?.compliance);
      setTier(ti);
      setKitchen(kit?.kitchen || null);
    } catch (e) {
      toast.error('Failed to load logistics state');
    }
  };

  useEffect(() => { fetchAll(); /* eslint-disable-next-line */ }, []);

  // ─── Module 1+2: Trigger breakdown + arm safety loop ───
  const triggerBreakdown = async (kind: 'vibe_ridez' | 'hunger_vibez') => {
    setBusy(true);
    try {
      const r = await fetch(`${API}/api/dsg-logistics/breakdown/trigger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...auth },
        body: JSON.stringify({ kind }),
      });
      const d = await r.json();
      if (d?.ok) {
        toast.success(`Breakdown logged (${kind}) — incident ${d.incident_id}`);
        // Auto-arm the 15s safety loop
        await fetch(`${API}/api/dsg-logistics/safety/arm`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...auth },
          body: JSON.stringify({
            incident_id: d.incident_id,
            stream_url: `safety://stream/${d.incident_id}`,
          }),
        });
        fetchAll();
      } else toast.error(d?.reason || 'Trigger failed');
    } finally { setBusy(false); }
  };

  const overrideIncident = async (incident_id: string) => {
    setBusy(true);
    try {
      const r = await fetch(`${API}/api/dsg-logistics/safety/override`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...auth },
        body: JSON.stringify({ incident_id, note: 'Driver override from console' }),
      });
      const d = await r.json();
      if (d?.ok) { toast.success('Override sent'); fetchAll(); }
      else toast.error(d?.reason || 'Override failed');
    } finally { setBusy(false); }
  };

  // ─── Module 3: Hardware verify ───
  const verifyHardware = async () => {
    setBusy(true);
    try {
      const r = await fetch(`${API}/api/dsg-logistics/hardware/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...auth },
        body: JSON.stringify({
          interior_lens_ok: hwInterior,
          exterior_lens_ok: hwExterior,
          hardware_id: hwId,
        }),
      });
      const d = await r.json();
      if (d?.ok) {
        toast.success(`Hardware ${d.status}`);
        fetchAll();
      } else toast.error(d?.reason || 'Verify failed');
    } finally { setBusy(false); }
  };

  // ─── Module 8: Creator Kitchen ───
  const registerKitchen = async () => {
    if (!kitchenName.trim()) { toast.error('Name required'); return; }
    setBusy(true);
    try {
      const r = await fetch(`${API}/api/dsg-logistics/creator-kitchen/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...auth },
        body: JSON.stringify({ name: kitchenName, bio: kitchenBio }),
      });
      const d = await r.json();
      if (d?.ok) {
        toast.success(`Kitchen registered → ${d.deep_link}`);
        fetchAll();
      } else toast.error(d?.reason || 'Register failed');
    } finally { setBusy(false); }
  };

  const setFeatured = async () => {
    if (!kitchen?.kitchen_id) return;
    if (!dishName.trim()) { toast.error('Dish name required'); return; }
    setBusy(true);
    try {
      const r = await fetch(`${API}/api/dsg-logistics/creator-kitchen/featured-dish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...auth },
        body: JSON.stringify({
          kitchen_id: kitchen.kitchen_id,
          dish_name: dishName,
          price_coins: dishPrice,
        }),
      });
      const d = await r.json();
      if (d?.ok) { toast.success(`Featured @ ${fmt(d.price_coins)} ₵`); fetchAll(); }
      else toast.error(d?.reason || 'Feature failed');
    } finally { setBusy(false); }
  };

  const pushDelay = async () => {
    if (!kitchen?.kitchen_id) return;
    setBusy(true);
    try {
      const r = await fetch(`${API}/api/dsg-logistics/creator-kitchen/delay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...auth },
        body: JSON.stringify({
          kitchen_id: kitchen.kitchen_id,
          prep_minutes: delayMin,
        }),
      });
      const d = await r.json();
      if (d?.ok) toast.success(`Delay pushed: ${d.prep_minutes} min`);
      else toast.error(d?.reason || 'Delay failed');
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen bg-[#04060c] text-white" data-testid="dsg-logistics-page">
      <header className="sticky top-0 z-20 px-5 py-4 border-b border-cyan-400/20 backdrop-blur-md bg-[#04060c]/95">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <button
            onClick={() => navigate('/dashboard')}
            className="text-sm flex items-center gap-2 text-white/70 hover:text-white"
            data-testid="logistics-back"
          >
            <ChevronLeft className="w-4 h-4" /> Dashboard
          </button>
          <h1 className="text-base sm:text-lg font-black tracking-widest text-cyan-300">
            DSG LOGISTICS HUB
          </h1>
          <span className="text-[10px] uppercase font-bold text-cyan-400/70">
            40/30/30 · NO BURN
          </span>
        </div>
        <div className="max-w-5xl mx-auto mt-3 flex gap-2 overflow-x-auto" data-testid="logistics-tabs">
          {TABS.map(({ key, label, Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              data-testid={`logistics-tab-${key}`}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] uppercase tracking-widest font-bold border transition-colors ${
                tab === key
                  ? 'bg-cyan-500/30 border-cyan-400/60 text-cyan-100'
                  : 'bg-white/5 border-white/10 text-white/60'
              }`}
            >
              <Icon className="w-3 h-3" /> {label}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-5 py-6 space-y-5">
        {/* ─── Override Console ─── */}
        {tab === 'override' && (
          <section className="space-y-4" data-testid="logistics-override-section">
            <div className="rounded-2xl border border-rose-400/40 bg-rose-950/20 p-5">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-rose-300" />
                <h2 className="text-sm font-black uppercase tracking-widest text-rose-200">
                  Emergency Breakdown
                </h2>
              </div>
              <p className="text-xs text-white/60 mb-4">
                Triggers the 15-second safety countdown and live-streams to
                the safety team. VibeRidez auto-zeroes passenger fare;
                Hunger Vibez auto-recovers food or remakes the order.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  disabled={busy}
                  onClick={() => triggerBreakdown('vibe_ridez')}
                  data-testid="trigger-vibe-ridez-breakdown"
                  className="px-3 py-2 rounded-lg bg-rose-500 hover:bg-rose-400 text-black text-xs font-black uppercase tracking-widest disabled:opacity-50"
                >
                  Trigger VibeRidez Breakdown
                </button>
                <button
                  disabled={busy}
                  onClick={() => triggerBreakdown('hunger_vibez')}
                  data-testid="trigger-hunger-vibez-breakdown"
                  className="px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-black uppercase tracking-widest disabled:opacity-50"
                >
                  Trigger Hunger Vibez Breakdown
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-5"
                  data-testid="override-state-card">
              <h3 className="text-xs uppercase tracking-widest font-black text-white/80 mb-3">
                Override Console State
              </h3>
              {overrideState?.active_incident ? (
                <div className="space-y-3 text-xs">
                  <div className="flex justify-between border-b border-white/10 pb-2">
                    <span className="text-white/50">Incident</span>
                    <span className="font-mono text-cyan-200">{overrideState.active_incident.incident_id}</span>
                  </div>
                  <div className="flex justify-between border-b border-white/10 pb-2">
                    <span className="text-white/50">Kind</span>
                    <span className="font-bold text-white">{overrideState.active_incident.kind}</span>
                  </div>
                  <div className="flex justify-between border-b border-white/10 pb-2">
                    <span className="text-white/50">Safety loop</span>
                    <span className={overrideState.active_incident.safety_loop_armed ? 'text-emerald-300' : 'text-white/40'}>
                      {overrideState.active_incident.safety_loop_armed ? `ARMED · ${overrideState.countdown_seconds}s` : 'idle'}
                    </span>
                  </div>
                  <button
                    onClick={() => overrideIncident(overrideState.active_incident.incident_id)}
                    disabled={busy}
                    data-testid="override-active-incident-btn"
                    className="w-full px-3 py-2 rounded-lg bg-white text-black text-xs font-black uppercase tracking-widest disabled:opacity-50"
                  >
                    Manual Override
                  </button>
                </div>
              ) : (
                <p className="text-xs text-white/50">No active incident — drive safe.</p>
              )}

              <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-white/10">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-white/40">Camera</p>
                  <p className={`text-sm font-bold ${overrideState?.hardware?.status === 'compliant' ? 'text-emerald-300' : 'text-rose-300'}`}>
                    {overrideState?.hardware?.status || 'unverified'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-white/40">White-Glove Strikes</p>
                  <p className="text-sm font-bold text-white">{overrideState?.white_glove_strikes ?? 0}</p>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ─── Hardware ─── */}
        {tab === 'hardware' && (
          <section className="space-y-4" data-testid="logistics-hardware-section">
            <div className="rounded-2xl border border-emerald-400/40 bg-emerald-950/20 p-5">
              <h2 className="text-sm font-black uppercase tracking-widest text-emerald-200 mb-2">
                Dual-Lens Verification
              </h2>
              <p className="text-xs text-white/60 mb-4">
                Both lenses must be online for you to remain on-grid.
                Verification is valid for {constants?.hardware_verification_ttl_days ?? 7} days.
              </p>
              <div className="grid sm:grid-cols-3 gap-3">
                <label className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 cursor-pointer">
                  <span className="text-xs">Interior Lens</span>
                  <input
                    type="checkbox"
                    checked={hwInterior}
                    onChange={e => setHwInterior(e.target.checked)}
                    data-testid="hw-interior-checkbox"
                  />
                </label>
                <label className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 cursor-pointer">
                  <span className="text-xs">Exterior Lens</span>
                  <input
                    type="checkbox"
                    checked={hwExterior}
                    onChange={e => setHwExterior(e.target.checked)}
                    data-testid="hw-exterior-checkbox"
                  />
                </label>
                <input
                  type="text"
                  value={hwId}
                  onChange={e => setHwId(e.target.value)}
                  placeholder="hardware id"
                  data-testid="hw-id-input"
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs"
                />
              </div>
              <button
                onClick={verifyHardware}
                disabled={busy}
                data-testid="verify-hardware-btn"
                className="mt-3 w-full px-3 py-2 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-black text-xs font-black uppercase tracking-widest disabled:opacity-50"
              >
                Verify Dash Cam
              </button>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <h3 className="text-xs uppercase tracking-widest font-black text-white/80 mb-3">
                Current Compliance
              </h3>
              <pre className="text-[11px] font-mono text-white/70 overflow-auto">
                {JSON.stringify(hardware || {}, null, 2)}
              </pre>
            </div>
          </section>
        )}

        {/* ─── Tier ─── */}
        {tab === 'tier' && (
          <section className="space-y-4" data-testid="logistics-tier-section">
            <div className="rounded-2xl border border-amber-400/40 bg-amber-950/10 p-5">
              <div className="flex items-center gap-2 mb-3">
                <Crown className="w-5 h-5 text-amber-300" />
                <h2 className="text-sm font-black uppercase tracking-widest text-amber-200">
                  Driver Tier · {tier?.tier?.replace('_', ' ').toUpperCase() || 'STANDARD'}
                </h2>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <Stat label="Rating" value={(tier?.rating ?? 0).toFixed(2)} />
                <Stat label="Trips" value={fmt(tier?.trips_completed ?? 0)} />
                <Stat label="White-Glove Score" value={(tier?.white_glove_score ?? 0).toFixed(2)} />
                <Stat label="Camera Flags" value={fmt(tier?.camera_flags ?? 0)} />
              </div>
              <div className="mt-4 pt-4 border-t border-white/10">
                <p className="text-[10px] uppercase tracking-widest text-white/40 mb-1">Perks</p>
                <ul className="text-xs text-amber-100 space-y-1">
                  {(tier?.perks || []).map((p: string) => (
                    <li key={p} className="flex items-center gap-2">
                      <Sparkles className="w-3 h-3 text-amber-300" /> {p}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        )}

        {/* ─── Creator Kitchen ─── */}
        {tab === 'kitchen' && (
          <section className="space-y-4" data-testid="logistics-kitchen-section">
            {!kitchen ? (
              <div className="rounded-2xl border border-orange-400/40 bg-orange-950/20 p-5">
                <h2 className="text-sm font-black uppercase tracking-widest text-orange-200 mb-2">
                  Register Your Kitchen
                </h2>
                <p className="text-xs text-white/60 mb-3">
                  Get a deep-link your followers can tap to land on your
                  storefront from DSG TV, IG, or TikTok.
                </p>
                <div className="space-y-2">
                  <input
                    value={kitchenName}
                    onChange={e => setKitchenName(e.target.value)}
                    placeholder="Kitchen name"
                    data-testid="kitchen-name-input"
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm"
                  />
                  <textarea
                    value={kitchenBio}
                    onChange={e => setKitchenBio(e.target.value)}
                    placeholder="Bio (optional)"
                    rows={2}
                    data-testid="kitchen-bio-input"
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm"
                  />
                  <button
                    onClick={registerKitchen}
                    disabled={busy}
                    data-testid="register-kitchen-btn"
                    className="w-full px-3 py-2 rounded-lg bg-orange-400 hover:bg-orange-300 text-black text-xs font-black uppercase tracking-widest disabled:opacity-50"
                  >
                    Register Kitchen
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="rounded-2xl border border-orange-400/40 bg-orange-950/20 p-5"
                      data-testid="kitchen-summary-card">
                  <p className="text-xs uppercase tracking-widest text-orange-200/70">Kitchen</p>
                  <h2 className="text-lg font-black text-white">{kitchen.name}</h2>
                  <p className="text-[10px] font-mono text-orange-300/70 mt-1">{kitchen.deep_link}</p>
                  <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-white/10 text-xs">
                    <Stat label="Orders fulfilled" value={fmt(kitchen.total_orders_fulfilled)} />
                    <Stat label="Featured dish" value={kitchen.featured_dish_name || '—'} />
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <h3 className="text-xs uppercase tracking-widest font-black text-white/80 mb-3">
                    Featured Dish ({fmt(constants?.creator_featured_dish_coins)} ₵ default)
                  </h3>
                  <div className="grid sm:grid-cols-3 gap-2 mb-2">
                    <input
                      value={dishName}
                      onChange={e => setDishName(e.target.value)}
                      placeholder="Dish name"
                      data-testid="dish-name-input"
                      className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm sm:col-span-2"
                    />
                    <input
                      type="number"
                      value={dishPrice}
                      onChange={e => setDishPrice(parseInt(e.target.value) || 15000)}
                      data-testid="dish-price-input"
                      className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm"
                    />
                  </div>
                  <button
                    onClick={setFeatured}
                    disabled={busy}
                    data-testid="set-featured-dish-btn"
                    className="w-full px-3 py-2 rounded-lg bg-orange-400 hover:bg-orange-300 text-black text-xs font-black uppercase tracking-widest disabled:opacity-50"
                  >
                    Set Featured Dish
                  </button>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <h3 className="text-xs uppercase tracking-widest font-black text-white/80 mb-3 flex items-center gap-2">
                    <Megaphone className="w-3 h-3" /> Push Delay to Drivers
                  </h3>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={delayMin}
                      onChange={e => setDelayMin(parseInt(e.target.value) || 15)}
                      data-testid="delay-minutes-input"
                      className="w-24 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm"
                    />
                    <span className="text-xs text-white/60">minutes</span>
                    <button
                      onClick={pushDelay}
                      disabled={busy}
                      data-testid="push-delay-btn"
                      className="ml-auto px-3 py-2 rounded-lg bg-white text-black text-xs font-black uppercase tracking-widest disabled:opacity-50"
                    >
                      Push
                    </button>
                  </div>
                </div>
              </>
            )}
          </section>
        )}

        {/* ─── Constants ─── */}
        {tab === 'constants' && constants && (
          <section className="space-y-4" data-testid="logistics-constants-section">
            <div className="rounded-2xl border border-cyan-400/40 bg-cyan-950/10 p-5">
              <h2 className="text-sm font-black uppercase tracking-widest text-cyan-200 mb-3">
                Blueprint Constants
              </h2>
              <p className="text-[11px] text-white/50 mb-3">
                Recirculation model · <span className="text-cyan-200 font-bold">{constants.recirculation_model}</span>
                {' · '} In-app burn · <span className="text-emerald-200 font-bold">{(constants.in_app_burn_pct * 100).toFixed(0)}%</span>
              </p>
              <pre className="text-[10px] font-mono text-white/70 overflow-auto max-h-[60vh]">
                {JSON.stringify(constants, null, 2)}
              </pre>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
      <p className="text-[9px] uppercase tracking-widest text-white/40">{label}</p>
      <p className="text-sm font-bold text-white truncate">{value}</p>
    </div>
  );
}
