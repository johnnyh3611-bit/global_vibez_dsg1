/**
 * /dsg-tv — DSG TV Expansion hub (Prestige · Stools · Predict-to-Win)
 *
 * Single-page tab interface. Counter-proposal economics: in-app coins
 * never burn — only DSG SPL public token burns (handled by Solana
 * indexer worker on upgrade events). Predict-to-Win 1% goes to
 * Treasury, NOT burn.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Crown, Gem, Sparkles, Loader2, Tv, Trophy, Coins,
  CheckCircle2, AlertCircle, Diamond, Plus,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

type Tab = 'prestige' | 'stools' | 'predict';

const fmt = (n: number) => `${(n || 0).toLocaleString()} ₵`;

const TIER_META: Record<string, { Icon: any; tint: string; label: string }> = {
  standard: { Icon: Crown, tint: 'text-white/80', label: 'Standard' },
  neon_ruby: { Icon: Gem, tint: 'text-rose-300', label: 'Neon Ruby' },
  cyber_diamond: { Icon: Diamond, tint: 'text-cyan-300', label: 'Cyber Diamond' },
};

export default function DSGTVExpansion() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('prestige');
  const [busy, setBusy] = useState(false);

  // Prestige
  const [chair, setChair] = useState<any>(null);
  const [upgradeCosts, setUpgradeCosts] = useState<Record<string, number>>({});

  // Stools
  const [stoolBal, setStoolBal] = useState<{ balance: number; lifetime_earned: number } | null>(null);

  // Predict
  const [pools, setPools] = useState<any[]>([]);
  const [createPrompt, setCreatePrompt] = useState('');
  const [createOptions, setCreateOptions] = useState('Yes,No');

  const token = () => localStorage.getItem('auth_token');

  const fetchAll = async () => {
    const t = token();
    if (!t) {
      navigate('/auth');
      return;
    }
    const auth = { Authorization: `Bearer ${t}` };
    try {
      const [c, s, p] = await Promise.all([
        fetch(`${API}/api/dsg-tv/prestige/me`, { headers: auth }).then(r => r.json()),
        fetch(`${API}/api/dsg-tv/stools/me`, { headers: auth }).then(r => r.json()),
        fetch(`${API}/api/dsg-tv/predict/open`).then(r => r.json()),
      ]);
      setChair(c?.chair || null);
      setUpgradeCosts(c?.upgrade_costs_coins || {});
      setStoolBal(s?.stools || null);
      setPools(p?.rows || []);
    } catch {
      /* tolerate */
    }
  };

  useEffect(() => { fetchAll(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleUpgrade = async (target_tier: string) => {
    setBusy(true);
    try {
      const r = await fetch(`${API}/api/dsg-tv/prestige/upgrade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ target_tier }),
      });
      const d = await r.json();
      if (d?.ok) {
        toast.success(`Upgraded to ${TIER_META[target_tier]?.label || target_tier}`, {
          description: `${fmt(d.cost_coins)} spent · SPL burn queued`,
        });
        fetchAll();
      } else {
        toast.error(d?.reason || 'Upgrade failed');
      }
    } finally { setBusy(false); }
  };

  const handleRedeem = async () => {
    setBusy(true);
    try {
      const r = await fetch(`${API}/api/dsg-tv/stools/redeem`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}` },
      });
      const d = await r.json();
      if (d?.ok) {
        toast.success('Stool → Chair! You\'re now a Founder Chair holder.');
        fetchAll();
      } else {
        toast.error(d?.reason === 'insufficient_stools'
          ? `Need ${d.required} stools (have ${d.balance})`
          : (d?.reason || 'Redeem failed'));
      }
    } finally { setBusy(false); }
  };

  const handleCreatePool = async () => {
    const opts = createOptions.split(',').map(s => s.trim()).filter(Boolean);
    if (opts.length < 2) {
      toast.error('Add at least 2 options (comma-separated)');
      return;
    }
    setBusy(true);
    try {
      const r = await fetch(`${API}/api/dsg-tv/predict/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ prompt: createPrompt, options: opts }),
      });
      const d = await r.json();
      if (d?.ok) {
        toast.success('Prediction pool opened');
        setCreatePrompt(''); setCreateOptions('Yes,No');
        fetchAll();
      } else toast.error(d?.reason || 'Create failed');
    } finally { setBusy(false); }
  };

  const handleStake = async (pool_id: string, option: string, coins: number) => {
    setBusy(true);
    try {
      const r = await fetch(`${API}/api/dsg-tv/predict/stake`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ pool_id, option, coins }),
      });
      const d = await r.json();
      if (d?.ok) {
        toast.success(`Staked ${fmt(coins)} on "${option}"`);
        fetchAll();
      } else toast.error(d?.reason || 'Stake failed');
    } finally { setBusy(false); }
  };

  const tier = chair?.tier || null;
  const TierIcon = tier ? TIER_META[tier]?.Icon : Crown;
  const tierTint = tier ? TIER_META[tier]?.tint : 'text-white/30';

  return (
    <div className="min-h-screen bg-[#06080f] text-white" data-testid="dsg-tv-page">
      <header className="sticky top-0 z-20 px-5 py-4 border-b border-rose-400/20 backdrop-blur-md bg-[#06080f]/95">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <button
            onClick={() => navigate('/dashboard')}
            className="text-sm flex items-center gap-2 text-white/70 hover:text-white"
            data-testid="dsg-tv-back"
          >
            <ArrowLeft className="w-4 h-4" /> Dashboard
          </button>
          <h1 className="text-base md:text-xl tracking-[0.3em] uppercase text-rose-200 flex items-center gap-3">
            <Tv className="w-5 h-5" /> DSG TV
          </h1>
          <Badge className="bg-rose-500/15 text-rose-200 border-rose-400/40 border text-[10px]">
            0% in-app burn
          </Badge>
        </div>

        {/* Tab bar */}
        <div className="max-w-5xl mx-auto mt-3 flex gap-2 overflow-x-auto" data-testid="dsg-tv-tabs">
          {([
            ['prestige', Crown, 'Prestige'],
            ['stools', Trophy, 'Stools'],
            ['predict', Sparkles, 'Predict-to-Win'],
          ] as const).map(([k, Icon, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              data-testid={`dsg-tv-tab-${k}`}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] uppercase tracking-widest font-bold border transition-colors ${
                tab === k
                  ? 'bg-rose-500/30 border-rose-400/60 text-rose-100'
                  : 'bg-white/5 border-white/10 text-white/60'
              }`}
            >
              <Icon className="w-3 h-3" /> {label}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-5">
        {/* PRESTIGE */}
        {tab === 'prestige' && (
          <Card className="p-6 bg-gradient-to-br from-rose-500/10 to-cyan-500/10 border border-rose-400/30" data-testid="dsg-tv-prestige-card">
            <div className="text-center mb-5">
              <TierIcon className={`w-16 h-16 mx-auto ${tierTint}`} />
              <p className="text-xs uppercase tracking-widest text-rose-300 mt-2">Current chair</p>
              <p className="text-3xl font-black mt-1" data-testid="dsg-tv-current-tier">
                {tier ? TIER_META[tier]?.label : 'No chair yet'}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {(['standard', 'neon_ruby', 'cyber_diamond'] as const).map((t) => {
                const meta = TIER_META[t];
                const Icon = meta.Icon;
                const isCurrent = tier === t;
                const upgradeKey = tier ? `${tier}->${t}` : null;
                const cost = upgradeKey ? upgradeCosts[upgradeKey] : null;
                const canUpgrade = !isCurrent && cost && cost > 0;
                return (
                  <div
                    key={t}
                    className={`p-4 rounded-2xl border ${
                      isCurrent
                        ? 'bg-rose-500/20 border-rose-400/60'
                        : canUpgrade
                        ? 'bg-white/5 border-white/15 hover:bg-white/10'
                        : 'bg-white/5 border-white/10 opacity-60'
                    }`}
                    data-testid={`dsg-tv-tier-${t}`}
                  >
                    <Icon className={`w-8 h-8 ${meta.tint}`} />
                    <p className="text-base font-black mt-2">{meta.label}</p>
                    {isCurrent && <p className="text-[10px] text-rose-200 mt-1">Active</p>}
                    {!isCurrent && cost && (
                      <>
                        <p className="text-[10px] text-white/50 mt-2">Cost</p>
                        <p className="font-mono text-sm text-amber-200">{fmt(cost)}</p>
                        <Button
                          onClick={() => handleUpgrade(t)}
                          disabled={busy || !canUpgrade}
                          className="w-full mt-3 bg-rose-500 hover:bg-rose-400 text-black font-black"
                          data-testid={`dsg-tv-upgrade-${t}`}
                        >
                          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Upgrade'}
                        </Button>
                      </>
                    )}
                    {!isCurrent && !cost && (
                      <p className="text-[10px] text-white/30 mt-2">Not yet eligible</p>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="text-[10px] text-white/40 text-center mt-5">
              50% of upgrade cost burns as DSG SPL on-chain. 0% in-app burn.
            </p>
          </Card>
        )}

        {/* STOOLS */}
        {tab === 'stools' && (
          <Card className="p-6 bg-gradient-to-br from-amber-500/10 to-emerald-500/10 border border-amber-400/30" data-testid="dsg-tv-stools-card">
            <div className="text-center mb-5">
              <Trophy className="w-16 h-16 mx-auto text-amber-300" />
              <p className="text-xs uppercase tracking-widest text-amber-300 mt-2">Stool balance</p>
              <p className="text-5xl font-black text-amber-200 mt-1" data-testid="dsg-tv-stool-balance">
                {stoolBal?.balance ?? 0}
              </p>
              <p className="text-xs text-white/60 mt-2">
                Lifetime earned: {stoolBal?.lifetime_earned ?? 0} · 100 stools = 1 Founder Chair
              </p>
            </div>

            <div className="rounded-lg bg-black/40 border border-white/10 p-3 text-xs text-white/70 mb-4">
              <p className="flex items-start gap-2">
                <AlertCircle className="w-3.5 h-3.5 mt-0.5 text-amber-300 flex-shrink-0" />
                Earn Stools through broadcast consistency, weekly chart-points, and tournament finishes. Admins can grant them via the Stool Console.
              </p>
            </div>

            <Button
              onClick={handleRedeem}
              disabled={busy || (stoolBal?.balance ?? 0) < 100}
              className="w-full bg-amber-400 hover:bg-amber-300 text-black font-black"
              data-testid="dsg-tv-redeem-stools"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
              Redeem 100 stools → Founder Chair
            </Button>
          </Card>
        )}

        {/* PREDICT */}
        {tab === 'predict' && (
          <>
            <Card className="p-5 bg-gradient-to-br from-fuchsia-500/10 to-purple-700/10 border border-fuchsia-400/30" data-testid="dsg-tv-predict-create">
              <h3 className="font-black flex items-center gap-2">
                <Plus className="w-4 h-4 text-fuchsia-300" /> Open a prediction
              </h3>
              <p className="text-xs text-white/60 mt-1 mb-3">
                You're the broadcaster. 5% commission on the pot. 1% to Treasury. 94% to winners.
              </p>
              <Input
                value={createPrompt}
                onChange={(e) => setCreatePrompt(e.target.value)}
                placeholder="Will the next roll be a Large Straight?"
                className="bg-white/5 border-fuchsia-400/30 mb-2"
                data-testid="dsg-tv-predict-prompt"
              />
              <Input
                value={createOptions}
                onChange={(e) => setCreateOptions(e.target.value)}
                placeholder="Yes, No (comma-separated)"
                className="bg-white/5 border-fuchsia-400/30 mb-3 font-mono text-xs"
                data-testid="dsg-tv-predict-options"
              />
              <Button
                onClick={handleCreatePool}
                disabled={busy || createPrompt.length < 4}
                className="bg-fuchsia-500 hover:bg-fuchsia-400 text-black font-black"
                data-testid="dsg-tv-predict-create-btn"
              >
                Open pool
              </Button>
            </Card>

            <div className="space-y-3" data-testid="dsg-tv-predict-open-list">
              <p className="text-xs uppercase tracking-widest text-fuchsia-300">Open pools ({pools.length})</p>
              {pools.length === 0 ? (
                <Card className="p-6 text-center bg-black/30 border border-white/10 text-xs text-white/40">
                  No open pools. Be the first to open one above.
                </Card>
              ) : (
                pools.map((p) => (
                  <Card key={p.pool_id} className="p-4 bg-black/40 border border-white/10" data-testid={`dsg-tv-pool-${p.pool_id}`}>
                    <p className="font-bold">{p.prompt}</p>
                    <p className="text-[10px] text-white/40 font-mono mt-1">{p.pool_id}</p>
                    <p className="text-xs text-amber-200 mt-1">Pot: {fmt(p.total_pot)} · {p.stakes_count} stakes</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3">
                      {(p.options || []).map((opt: string) => (
                        <Button
                          key={opt}
                          onClick={() => handleStake(p.pool_id, opt, 1000)}
                          disabled={busy}
                          variant="outline"
                          className="border-fuchsia-400/40 text-fuchsia-200 hover:bg-fuchsia-500/10 text-xs"
                          data-testid={`dsg-tv-stake-${p.pool_id}-${opt}`}
                        >
                          <Coins className="w-3 h-3 mr-1" /> 1K on "{opt}"
                        </Button>
                      ))}
                    </div>
                  </Card>
                ))
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
