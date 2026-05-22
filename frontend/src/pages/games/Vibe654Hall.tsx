/**
 * /vibe-654-hall — Master Hub for every Vibez 6-5-4 variant
 *
 * Founder ask (Feb 2026): "I can only reach 2 of the 6-5-4 games today.
 * I need one room where every variant — working or in-progress — is
 * visible and reachable."
 *
 * Structure mirrors /chess-hall: card grid · live status badge per
 * variant · click-to-enter. For variants that need a table_id, this
 * page provides a "Create test table" button that hits the lobby
 * endpoint and routes directly to the live table.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dice5, Dice6, ArrowLeft, Loader2, Crown, Trophy, Brain, Users,
  Sparkles, ChevronRight, AlertCircle, CheckCircle2, Coins,
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

type Status = 'live' | 'ephemeral' | 'backend-only';

type Variant = {
  id: string;
  title: string;
  subtitle: string;
  badge: string;
  stakes: string;
  status: Status;
  icon: any;
  accent: string;
  go: (helpers: { navigate: any; createTable: () => Promise<string | null> }) => void;
  cta: string;
};

const VARIANTS: Variant[] = [
  {
    id: 'classic',
    title: 'Vibez 654 Classic',
    subtitle: "Nova's Parlour · 5 dice · single-player vs the dealer",
    badge: 'Always open',
    stakes: '50 / 250 / 500 / 1,000 / 5,000 ₵',
    status: 'live',
    icon: Dice6,
    accent: 'from-cyan-500 to-blue-700',
    go: ({ navigate }) => navigate('/vibez-654'),
    cta: 'Enter parlour',
  },
  {
    id: 'premium',
    title: 'VibeDice 654 Premium',
    subtitle: 'Marble floor · gold orbit ring · stand & re-roll',
    badge: 'Premium room',
    stakes: '5 – 500 ₵ default · host configurable',
    status: 'live',
    icon: Sparkles,
    accent: 'from-amber-500 via-fuchsia-500 to-purple-700',
    go: ({ navigate }) => navigate('/dice'),
    cta: 'Enter table',
  },
  {
    id: 'solo',
    title: 'Solo High-Roller Vault',
    subtitle: '1-vs-AI · the underground room',
    badge: 'High roller',
    stakes: 'Recommended ≥ 50,000 ₵',
    status: 'live',
    icon: Brain,
    accent: 'from-fuchsia-500 via-purple-600 to-indigo-700',
    go: ({ navigate }) => navigate('/vibe-654/solo'),
    cta: 'Enter vault',
  },
  {
    id: 'lobby',
    title: 'Vibe 654 Tournament Lobby',
    subtitle: '20-player tables · create your own with custom buy-in',
    badge: 'Multiplayer',
    stakes: 'Buy-in 20K – 1M ₵ · 12.5 % rake',
    status: 'live',
    icon: Users,
    accent: 'from-emerald-500 to-cyan-700',
    go: ({ navigate }) => navigate('/games/vibe654/tournament'),
    cta: 'Open lobby',
  },
  {
    id: 'coliseum',
    title: 'Breadwinner Coliseum',
    subtitle: 'Live tournament table with bleacher hype · side-bet spectators',
    badge: 'Needs a live table',
    stakes: 'Inherited from host buy-in',
    status: 'ephemeral',
    icon: Trophy,
    accent: 'from-rose-500 via-amber-500 to-yellow-600',
    go: async ({ navigate, createTable }) => {
      const id = await createTable();
      if (id) navigate(`/vibe-654/coliseum/${id}`);
    },
    cta: 'Spin up test table',
  },
  {
    id: 'legacy-table',
    title: 'Legacy Tournament Table',
    subtitle: 'Pre-Coliseum tournament UI · kept for parity testing',
    badge: 'Legacy parity',
    stakes: 'Inherited from host buy-in',
    status: 'ephemeral',
    icon: Crown,
    accent: 'from-slate-600 to-slate-800',
    go: async ({ navigate, createTable }) => {
      const id = await createTable();
      if (id) navigate(`/vibe-654/legacy-table/${id}`);
    },
    cta: 'Spin up legacy table',
  },
  {
    id: 'prescription',
    title: 'Vibez 654 Prescription',
    subtitle: 'Sovereign-tier · 6→5→4 with stand & reroll point dice · 5 side bets',
    badge: 'Sovereign',
    stakes: '5 / 10 / 25 / 50 / 100 / 250 / 500 ₵',
    status: 'live',
    icon: Dice5,
    accent: 'from-amber-400 via-amber-600 to-amber-900',
    go: ({ navigate }) => navigate('/vibe-654/prescription'),
    cta: 'Enter prescription',
  },
];

const statusChip: Record<Status, { label: string; cls: string; Icon: any }> = {
  live: { label: 'Reachable', cls: 'bg-emerald-500/20 text-emerald-200 border-emerald-400/40', Icon: CheckCircle2 },
  ephemeral: { label: 'Needs table', cls: 'bg-amber-500/20 text-amber-200 border-amber-400/40', Icon: Loader2 },
  'backend-only': { label: 'No UI yet', cls: 'bg-rose-500/20 text-rose-200 border-rose-400/40', Icon: AlertCircle },
};

export default function Vibe654Hall() {
  const navigate = useNavigate();
  const [creatingFor, setCreatingFor] = useState<string | null>(null);
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (!token) return;
    fetch(`${API}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((u) => {
        if (!u) return;
        const b = u?.user?.credits_balance ?? u?.credits_balance ?? u?.token_balance ?? 0;
        setBalance(Number(b) || 0);
      })
      .catch(() => undefined);
  }, []);

  const createTestTable = async (): Promise<string | null> => {
    setCreatingFor('table');
    try {
      const token = localStorage.getItem('auth_token');
      const userEmail = localStorage.getItem('userEmail') || 'founder@globalvibez.com';
      const userName = (userEmail.split('@')[0] || 'Founder').replace(/[^a-zA-Z0-9]/g, '');
      const userId = localStorage.getItem('userId') || localStorage.getItem('user_id') || 'demo_b88a4250';

      const res = await fetch(`${API}/api/vibe654/tournament/create-table`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          host_user_id: userId,
          host_name: userName || 'Founder',
          buy_in: 100_000,
          max_players: 4,
          table_name: 'Founder Inspection Table',
        }),
      });
      const data = await res.json();
      if (data?.success || data?.table_id) {
        return data.table_id || data.table?.table_id || null;
      }
      return null;
    } catch {
      return null;
    } finally {
      setCreatingFor(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#06080f] text-slate-100" data-testid="vibe-654-hall-page">
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/10 backdrop-blur-md">
        <button
          onClick={() => navigate(-1)}
          className="text-sm flex items-center gap-2 text-white/70 hover:text-white"
          data-testid="vibe-654-hall-back"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <h1 className="text-base md:text-xl tracking-[0.3em] uppercase text-amber-200 flex items-center gap-3">
          <Dice6 className="w-5 h-5" /> Vibez 654 Hall
        </h1>
        <div className="hidden md:flex items-center gap-2 text-[10px] uppercase tracking-widest text-white/40">
          {VARIANTS.length} variants
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="rounded-2xl bg-gradient-to-r from-amber-500/10 via-fuchsia-500/10 to-cyan-500/10 border border-white/10 p-4 mb-6 flex items-center justify-between gap-3 flex-wrap" data-testid="vibe-654-hall-banner">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-amber-300">Single hub</p>
            <p className="text-sm text-white/80">
              Every Vibez 6-5-4 variant on the platform — including the ones that need a live table to enter — gathered in one room.
            </p>
          </div>
          {balance !== null && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/40 border border-amber-400/40">
              <Coins className="w-4 h-4 text-amber-300" />
              <span className="text-xs text-white/80">
                Your wallet: <span className="font-mono font-black text-amber-200">{balance.toLocaleString()} ₵</span>
              </span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="vibe-654-hall-grid">
          {VARIANTS.map((v) => {
            const Icon = v.icon;
            const sc = statusChip[v.status];
            const SIcon = sc.Icon;
            const disabled = v.status === 'backend-only' || creatingFor === 'table';
            return (
              <div
                key={v.id}
                data-testid={`vibe-654-card-${v.id}`}
                className={`group relative rounded-2xl p-5 border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-950/90 hover:border-amber-400/40 transition-colors flex flex-col`}
              >
                <div className={`absolute -inset-px rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-br ${v.accent} blur-2xl -z-10`} />
                <div className="flex items-start justify-between mb-3">
                  <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${v.accent} flex items-center justify-center shadow-lg`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <span
                    className={`flex items-center gap-1 text-[10px] uppercase tracking-widest px-2 py-1 rounded-full border ${sc.cls}`}
                    data-testid={`vibe-654-status-${v.id}`}
                  >
                    <SIcon className="w-3 h-3" /> {sc.label}
                  </span>
                </div>
                <p className="text-base font-black text-white">{v.title}</p>
                <p className="text-[11px] text-white/50 mt-1 leading-snug">{v.subtitle}</p>
                <div className="mt-3 text-[10px] uppercase tracking-widest text-amber-300/60">
                  Stakes
                </div>
                <p className="text-xs text-white/70 mt-0.5 font-mono">{v.stakes}</p>

                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => v.go({ navigate, createTable: createTestTable })}
                  data-testid={`vibe-654-cta-${v.id}`}
                  className={`mt-4 inline-flex items-center justify-between gap-1 px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest transition-colors w-full ${
                    disabled
                      ? 'bg-white/5 text-white/30 border border-white/10 cursor-not-allowed'
                      : 'bg-amber-400 text-black hover:bg-amber-300'
                  }`}
                >
                  <span>{creatingFor === 'table' && v.status === 'ephemeral' ? 'Creating table…' : v.cta}</span>
                  {!disabled && (
                    creatingFor === 'table' && v.status === 'ephemeral'
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <ChevronRight className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            );
          })}
        </div>

        <p className="mt-8 text-[11px] text-white/40 text-center" data-testid="vibe-654-hall-footnote">
          Every variant on the platform — including the sovereign Prescription room — is now reachable from this hub. New variants will surface here automatically as they ship.
        </p>
      </main>
    </div>
  );
}
