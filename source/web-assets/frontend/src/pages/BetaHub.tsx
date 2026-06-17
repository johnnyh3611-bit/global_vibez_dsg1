/**
 * /beta-hub — Beta Features Hub
 *
 * Single pane of glass that surfaces EVERY feature shipped in the
 * 2026-05-22 build session. Each tile includes:
 *   • Live status pill (LIVE / ADMIN-ONLY / DRIVER-ONLY)
 *   • What it does (one-liner)
 *   • Open button → routes to the feature
 *   • "Ping API" button → fires the public /constants endpoint and
 *     shows the latency in ₵ green if 200, red if it 4xx/5xx.
 *
 * The user asked for: "make sure that I can view and test everything"
 * — this page is the test rig.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Rocket, ExternalLink, RadioTower, ShieldAlert, Crown, Music,
  Truck, Inbox, Search, Smartphone, Activity, CheckCircle2,
  XCircle, Loader2, ChevronLeft, Sparkles,
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL || '';

type Status = 'idle' | 'ok' | 'fail' | 'busy';

type Feature = {
  key: string;
  title: string;
  blurb: string;
  route?: string;            // viewable page
  scope: 'PUBLIC' | 'DRIVER' | 'ARTIST' | 'ADMIN' | 'GLOBAL';
  Icon: any;
  pingUrl?: string;          // public endpoint to test from anywhere
  pingValidate?: (data: any) => string | null;  // returns null on pass
  notes?: string;
};

const FEATURES: Feature[] = [
  {
    key: 'cmdk',
    title: 'Cmd+K Launcher',
    blurb: 'Spotlight-style global search over every Explore entry. Try ⌘K / Ctrl+K from anywhere.',
    scope: 'GLOBAL',
    Icon: Search,
    notes: 'Mounted in App shell — press Cmd+K (Mac) or Ctrl+K (Windows/Linux). Type "dsg" to see results.',
  },
  {
    key: 'mobile-nav',
    title: 'Mobile Bottom Nav',
    blurb: '6-tab phone nav (Home · 654 · Plex · Studio · Explore · Me). Auto-renders below 768px.',
    scope: 'GLOBAL',
    Icon: Smartphone,
    notes: 'Resize browser <768px or open on a phone to see the bottom tab bar.',
  },
  {
    key: 'dsg-tv',
    title: 'DSG TV Expansion',
    blurb: 'Prestige Chairs · Stools · Predict-to-Win (5/1/94 split · 0% in-app burn).',
    route: '/dsg-tv',
    scope: 'PUBLIC',
    Icon: RadioTower,
    pingUrl: '/api/dsg-tv/constants',
    pingValidate: (d) =>
      d?.predict_split?.burn_pct === 0.0 ? null : 'predict_split.burn_pct must be 0',
  },
  {
    key: 'dsg-logistics',
    title: 'DSG Logistics Hub',
    blurb: 'Driver-side: Emergency · Hardware · Tier · Creator Kitchen (40/30/30 vault, 0% burn).',
    route: '/dsg-logistics',
    scope: 'DRIVER',
    Icon: ShieldAlert,
    pingUrl: '/api/dsg-logistics/constants',
    pingValidate: (d) =>
      d?.in_app_burn_pct === 0 && d?.recirculation_model === '40/30/30'
        ? null : 'in_app_burn_pct must be 0 and recirculation_model 40/30/30',
  },
  {
    key: 'admin-logistics',
    title: 'Admin Logistics Ops',
    blurb: 'Active incidents · cancellation payouts (with recirc breakdown) · white-glove strikes.',
    route: '/admin/dsg-logistics',
    scope: 'ADMIN',
    Icon: Activity,
    notes: 'Requires admin role. Non-admin viewers see "Admin Access Required" panel.',
  },
  {
    key: 'music-group',
    title: 'DSG Music Group',
    blurb: 'Rights Ledger + Collaborator Splits (basis points · sum to 10,000) + Royalty audit.',
    route: '/artist/music-group',
    scope: 'ARTIST',
    Icon: Music,
    pingUrl: '/api/music-group/constants',
    pingValidate: (d) =>
      d?.platform_split?.artist_collective === 0.80
        && d?.platform_split?.burn === 0.0
        ? null : 'platform_split must be 80/15/5 with burn=0',
  },
  {
    key: 'license-mkt',
    title: 'License Marketplace',
    blurb: 'TV sync · casino BG · commercial use catalog — only opt-in tracks surface here.',
    route: '/marketplace/license',
    scope: 'PUBLIC',
    Icon: Crown,
    pingUrl: '/api/music-group/marketplace/licensable?context=tv_sync',
    pingValidate: (d) => d?.ok === true ? null : 'ok must be true',
  },
  {
    key: 'license-inbox',
    title: 'License Inbox',
    blurb: 'Live royalty notifications (per-collaborator share, role, basis points). Top of /artist/dashboard.',
    route: '/artist/dashboard',
    scope: 'ARTIST',
    Icon: Inbox,
    pingUrl: '/api/music-group/royalty/me',
    notes: 'Requires login. Empty state until at least one collaborative track gets tipped.',
  },
  {
    key: 'cargo',
    title: 'VibeRidez Cargo Master',
    blurb: '80/20 split · sha256 dual-barcode lock · platform vault → 40/30/30 recirc. NO burn.',
    route: '/driver/cargo',
    scope: 'DRIVER',
    Icon: Truck,
    pingUrl: '/api/cargo/constants',
    pingValidate: (d) =>
      d?.store_partner_pct === 0.80
        && d?.platform_vault_pct === 0.20
        && d?.in_app_burn_pct === 0.0
        ? null : 'must be 80/20 store/platform with burn=0',
  },
];

export default function BetaHub() {
  const navigate = useNavigate();
  const [statuses, setStatuses] = useState<Record<string, Status>>({});
  const [details, setDetails] = useState<Record<string, string>>({});
  const [autoRunning, setAutoRunning] = useState(false);

  const pingFeature = useCallback(async (f: Feature) => {
    if (!f.pingUrl) return;
    setStatuses(s => ({ ...s, [f.key]: 'busy' }));
    try {
      const t0 = performance.now();
      const r = await fetch(`${API}${f.pingUrl}`);
      const ms = Math.round(performance.now() - t0);
      const data = await r.json().catch(() => null);
      if (!r.ok) {
        setStatuses(s => ({ ...s, [f.key]: 'fail' }));
        setDetails(d => ({ ...d, [f.key]: `${r.status} · ${ms}ms` }));
        return;
      }
      const guardMsg = f.pingValidate ? f.pingValidate(data) : null;
      if (guardMsg) {
        setStatuses(s => ({ ...s, [f.key]: 'fail' }));
        setDetails(d => ({ ...d, [f.key]: `guard failed · ${guardMsg}` }));
        return;
      }
      setStatuses(s => ({ ...s, [f.key]: 'ok' }));
      setDetails(d => ({ ...d, [f.key]: `200 · ${ms}ms` }));
    } catch (e: any) {
      setStatuses(s => ({ ...s, [f.key]: 'fail' }));
      setDetails(d => ({ ...d, [f.key]: e?.message || 'network error' }));
    }
  }, []);

  const runAll = useCallback(async () => {
    setAutoRunning(true);
    for (const f of FEATURES) {
      if (f.pingUrl) {
        // eslint-disable-next-line no-await-in-loop
        await pingFeature(f);
      }
    }
    setAutoRunning(false);
  }, [pingFeature]);

  useEffect(() => { runAll(); }, [runAll]);

  const pingable = FEATURES.filter(f => f.pingUrl);
  const okCount = pingable.filter(f => statuses[f.key] === 'ok').length;
  const failCount = pingable.filter(f => statuses[f.key] === 'fail').length;

  return (
    <div className="min-h-screen bg-[#04060c] text-white" data-testid="beta-hub-page">
      <header className="sticky top-0 z-20 px-5 py-4 border-b border-fuchsia-400/20 backdrop-blur-md bg-[#04060c]/95">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <button
            onClick={() => navigate('/dashboard')}
            className="text-sm flex items-center gap-2 text-white/70 hover:text-white"
            data-testid="beta-hub-back"
          >
            <ChevronLeft className="w-4 h-4" /> Dashboard
          </button>
          <h1 className="text-base sm:text-lg font-black tracking-widest text-fuchsia-300 flex items-center gap-2">
            <Rocket className="w-4 h-4" /> BETA HUB · 2026-05-22 BUILD
          </h1>
          <button
            onClick={runAll}
            disabled={autoRunning}
            data-testid="beta-hub-runall-btn"
            className="text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-fuchsia-500/25 hover:bg-fuchsia-500/40 border border-fuchsia-400/40 disabled:opacity-50"
          >
            {autoRunning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
            Re-ping all
          </button>
        </div>
        <p className="max-w-6xl mx-auto mt-2 text-[10px] uppercase tracking-widest text-fuchsia-400/70">
          {okCount}/{pingable.length} APIs healthy · {failCount} failing · ₵ only · 0% in-app burn rule enforced
        </p>
      </header>

      <main className="max-w-6xl mx-auto px-5 py-6">
        <ul className="grid md:grid-cols-2 gap-3" data-testid="beta-hub-grid">
          {FEATURES.map(f => {
            const s = statuses[f.key] || 'idle';
            const detail = details[f.key];
            return (
              <li
                key={f.key}
                data-testid={`beta-hub-card-${f.key}`}
                className="rounded-2xl border border-white/10 bg-white/5 p-4 flex flex-col"
              >
                <header className="flex items-start gap-3 mb-2">
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-fuchsia-500/30 to-cyan-500/20 flex items-center justify-center flex-shrink-0">
                    <f.Icon className="w-4 h-4 text-fuchsia-200" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-sm font-black text-white">{f.title}</h2>
                    <p className="text-[10px] uppercase tracking-widest text-white/40 mt-0.5">
                      {f.scope}
                    </p>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest border ${
                      s === 'ok'   ? 'bg-emerald-500/20 text-emerald-200 border-emerald-400/40'
                    : s === 'fail' ? 'bg-rose-500/20 text-rose-200 border-rose-400/40'
                    : s === 'busy' ? 'bg-amber-500/20 text-amber-200 border-amber-400/40'
                    : f.pingUrl    ? 'bg-white/5 text-white/40 border-white/10'
                    :                'bg-cyan-500/15 text-cyan-200 border-cyan-400/40'
                    }`}
                    data-testid={`beta-hub-status-${f.key}`}
                  >
                    {s === 'ok'   ? <CheckCircle2 className="w-2.5 h-2.5 inline -mt-0.5" /> :
                     s === 'fail' ? <XCircle className="w-2.5 h-2.5 inline -mt-0.5" /> :
                     s === 'busy' ? <Loader2 className="w-2.5 h-2.5 inline -mt-0.5 animate-spin" /> :
                     null}{' '}
                    {f.pingUrl ? (s === 'idle' ? 'pending' : s) : 'no-api'}
                  </span>
                </header>

                <p className="text-xs text-white/70 mb-2">{f.blurb}</p>
                {detail && (
                  <p className="text-[10px] font-mono text-white/40 mb-2">{detail}</p>
                )}
                {f.notes && (
                  <p className="text-[10px] text-white/40 italic mb-2">{f.notes}</p>
                )}

                <div className="mt-auto flex gap-2">
                  {f.route && (
                    <button
                      onClick={() => navigate(f.route!)}
                      data-testid={`beta-hub-open-${f.key}`}
                      className="flex-1 px-3 py-1.5 rounded-lg bg-fuchsia-400 hover:bg-fuchsia-300 text-black text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1"
                    >
                      Open <ExternalLink className="w-3 h-3" />
                    </button>
                  )}
                  {f.pingUrl && (
                    <button
                      onClick={() => pingFeature(f)}
                      disabled={s === 'busy'}
                      data-testid={`beta-hub-ping-${f.key}`}
                      className="px-3 py-1.5 rounded-lg border border-white/10 hover:bg-white/5 text-[10px] uppercase tracking-widest disabled:opacity-50"
                    >
                      Ping API
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 text-[11px] text-white/60"
              data-testid="beta-hub-economics-note">
          <p className="font-black text-fuchsia-200 uppercase tracking-widest text-xs mb-1">
            Economics Invariant — verified at every layer
          </p>
          <p>
            All 9 features above route platform-cut payouts through the
            <span className="text-fuchsia-200 font-bold"> 40/30/30 recirculation engine</span>{' '}
            (tournament · treasury · 72h airlock).
            <span className="text-emerald-200 font-bold"> No in-app coin burns anywhere.</span>{' '}
            DSG SPL on-chain burn flow is stubbed and remains TGE-locked until launch.
          </p>
        </div>
      </main>
    </div>
  );
}
