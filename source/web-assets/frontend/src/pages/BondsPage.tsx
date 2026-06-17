/**
 * BondsPage — Couple Bond + Teleport VFX dashboard
 *
 * Shows every bond the current user has (date partners), per-milestone
 * progress bars, unlocked shared cosmetics, and the user's teleport-VFX
 * catalog with an "Equip" action. Wires directly to:
 *   - GET  /api/bonds/list/{user_id}
 *   - GET  /api/bonds/unlock-rules
 *   - GET  /api/cosmetics/teleport/my-vfx/{user_id}
 *   - POST /api/cosmetics/teleport/equip
 */
import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Heart, Sparkles, Users, Trophy, Zap, Lock, Check } from 'lucide-react';
import { toast } from 'react-hot-toast';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

interface MilestoneProgress {
  current: number;
  next_threshold: number | null;
  next_cosmetic_id: string | null;
  percent: number;
}

interface Bond {
  bond_id: string;
  user_a: string;
  user_b: string;
  partner_id: string;
  shared_stats?: Record<string, number>;
  unlocked_shared_cosmetics?: string[];
  milestone_progress?: Record<string, MilestoneProgress>;
  current_vibe_level?: number;
}

interface VFX {
  user_id: string;
  active_effect: string;
  unlocked_effects: string[];
  stats: Record<string, number>;
}

const STAT_LABELS: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  date_count: { label: 'VR Dates Together', icon: <Heart className="w-4 h-4" />, color: 'text-pink-400' },
  games_played: { label: 'Games Played', icon: <Users className="w-4 h-4" />, color: 'text-cyan-400' },
  shared_jackpots: { label: 'Shared Jackpots', icon: <Trophy className="w-4 h-4" />, color: 'text-amber-400' },
  spades_win_streak: { label: 'Spades Streak', icon: <Zap className="w-4 h-4" />, color: 'text-violet-400' },
};

const prettyCosmeticId = (id: string): string =>
  id.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export default function BondsPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [bonds, setBonds] = useState<Bond[]>([]);
  const [vfx, setVfx] = useState<VFX | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeBondId, setActiveBondId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        // 1. Resolve current user from cookie session
        const meRes = await fetch(`${BACKEND_URL}/api/auth/me`, {});
        if (!meRes.ok) throw new Error('Not signed in');
        const me = await meRes.json();
        const uid: string | undefined = me?.id || me?.user_id;
        if (!uid) throw new Error('No user id');
        if (cancelled) return;
        setUserId(uid);

        // 2. Load bonds + vfx in parallel
        const [bondsRes, vfxRes] = await Promise.all([
          fetch(`${BACKEND_URL}/api/bonds/list/${uid}`, {}),
          fetch(`${BACKEND_URL}/api/cosmetics/teleport/my-vfx/${uid}`, {}),
        ]);
        const bondsData = await bondsRes.json();
        const vfxData = await vfxRes.json();
        if (!cancelled) {
          const list: Bond[] = bondsData?.bonds || [];
          setBonds(list);
          setActiveBondId((prev) => prev || list[0]?.bond_id || null);
          setVfx(vfxData);
        }
      } catch (err) {
        console.error('Failed to load bonds', err);
        if (!cancelled) toast.error('Could not load bonds');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const activeBond = useMemo(
    () => bonds.find((b) => b.bond_id === activeBondId) || bonds[0] || null,
    [bonds, activeBondId],
  );

  const equipEffect = async (effectId: string) => {
    if (!userId) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/cosmetics/teleport/equip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, effect_id: effectId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Equip failed');
      setVfx((prev) => (prev ? { ...prev, active_effect: effectId } : prev));
      toast.success(`Equipped ${prettyCosmeticId(effectId)}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Equip failed');
    }
  };

  if (!userId && !loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white" data-testid="bonds-signin-required">
        Sign in to view your bonds.
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-gradient-to-b from-slate-950 via-purple-950/40 to-slate-950 text-white"
      data-testid="bonds-page"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-10">
        <header className="mb-10">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight flex items-center gap-3">
            <Heart className="w-10 h-10 text-pink-400" />
            Couple Bonds
          </h1>
          <p className="text-base text-slate-400 mt-3 max-w-2xl">
            Every date, every win, every shared jackpot deepens your bond.
            Cross a threshold — unlock a shared cosmetic you both wear in VR,
            in the casino, and on the streets.
          </p>
        </header>

        {loading ? (
          <div className="py-20 text-center text-slate-400" data-testid="bonds-loading">
            Loading your bonds…
          </div>
        ) : bonds.length === 0 ? (
          <EmptyBonds />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-8">
            {/* Bond selector */}
            <aside className="space-y-2" data-testid="bonds-list">
              {bonds.map((b) => (
                <button
                  key={b.bond_id}
                  data-testid={`bond-select-${b.partner_id}`}
                  onClick={() => setActiveBondId(b.bond_id)}
                  className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
                    activeBond?.bond_id === b.bond_id
                      ? 'border-pink-400/70 bg-pink-500/10'
                      : 'border-white/10 hover:border-white/30 bg-white/5'
                  }`}
                >
                  <div className="text-sm text-slate-300">Partner</div>
                  <div className="font-bold truncate">{b.partner_id}</div>
                  <div className="text-xs text-slate-400 mt-1">
                    {(b.unlocked_shared_cosmetics || []).length} unlocked
                  </div>
                </button>
              ))}
            </aside>

            {/* Active bond detail */}
            {activeBond && <BondDetail bond={activeBond} />}
          </div>
        )}

        {/* Teleport VFX block */}
        <section className="mt-14">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-6 h-6 text-cyan-400" />
            <h2 className="text-lg md:text-lg font-bold">Teleport VFX</h2>
          </div>
          {vfx ? (
            <TeleportVFXPanel vfx={vfx} onEquip={equipEffect} />
          ) : (
            <div className="text-slate-400 text-sm">No VFX data yet.</div>
          )}
        </section>
      </div>
    </div>
  );
}

function EmptyBonds() {
  return (
    <div
      className="py-20 text-center border border-dashed border-white/15 rounded-2xl bg-white/5"
      data-testid="bonds-empty"
    >
      <Heart className="w-12 h-12 text-pink-400/60 mx-auto mb-4" />
      <h3 className="text-xl font-bold mb-1">No bonds yet</h3>
      <p className="text-slate-400 max-w-md mx-auto text-sm">
        Start a VR date or pair up at a casino table. Your first shared milestone
        fires a 3-date "Twin Flame" VFX you'll both wear.
      </p>
    </div>
  );
}

function BondDetail({ bond }: { bond: Bond }) {
  const progress = bond.milestone_progress || {};
  const unlocked = bond.unlocked_shared_cosmetics || [];

  return (
    <motion.div
      key={bond.bond_id}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
      data-testid="bond-detail"
    >
      <Card className="bg-white/5 border-white/10">
        <CardHeader>
          <CardTitle className="text-2xl flex items-center gap-2">
            <span className="text-pink-400">❤</span>
            Your Bond with {bond.partner_id}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {Object.entries(STAT_LABELS).map(([stat, meta]) => {
            const p = progress[stat];
            if (!p) return null;
            const pct = Math.min(100, Math.max(0, p.percent ?? 0));
            return (
              <div key={stat} data-testid={`bond-progress-${stat}`}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className={`flex items-center gap-2 font-semibold ${meta.color}`}>
                    {meta.icon}
                    {meta.label}
                  </div>
                  <div className="text-xs text-slate-400">
                    {p.next_threshold == null
                      ? `${p.current} (MAX)`
                      : `${p.current} / ${p.next_threshold}`}
                  </div>
                </div>
                <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-pink-500 via-fuchsia-400 to-cyan-400 transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                {p.next_cosmetic_id && (
                  <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                    <Lock className="w-3 h-3" />
                    Next unlock: {prettyCosmeticId(p.next_cosmetic_id)}
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card className="bg-white/5 border-white/10">
        <CardHeader>
          <CardTitle className="text-lg md:text-lg">Shared Cosmetics Unlocked</CardTitle>
        </CardHeader>
        <CardContent>
          {unlocked.length === 0 ? (
            <div className="text-sm text-slate-400">
              None yet — complete a milestone above to earn your first shared skin.
            </div>
          ) : (
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3" data-testid="bond-unlocked-list">
              {unlocked.map((id) => (
                <li
                  key={id}
                  className="flex items-center gap-3 px-4 py-3 rounded-lg bg-gradient-to-r from-pink-500/10 to-cyan-500/10 border border-pink-400/20"
                >
                  <Check className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                  <span className="font-semibold">{prettyCosmeticId(id)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

function TeleportVFXPanel({
  vfx,
  onEquip,
}: {
  vfx: VFX;
  onEquip: (id: string) => void | Promise<void>;
}) {
  const unlocked = vfx.unlocked_effects.length > 0 ? vfx.unlocked_effects : ['default'];

  return (
    <Card className="bg-white/5 border-white/10">
      <CardContent className="pt-6">
        <div className="flex flex-wrap items-center gap-2 mb-4 text-sm text-slate-400">
          <span>VR Dates Completed:</span>
          <span className="text-white font-bold" data-testid="vfx-stat-dates">
            {vfx.stats?.vr_dates_completed ?? 0}
          </span>
          <span className="mx-2">•</span>
          <span>Rides Completed:</span>
          <span className="text-white font-bold" data-testid="vfx-stat-rides">
            {vfx.stats?.rides_completed ?? 0}
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {unlocked.map((id) => {
            const equipped = vfx.active_effect === id;
            return (
              <button
                key={id}
                onClick={() => !equipped && onEquip(id)}
                data-testid={`vfx-equip-${id}`}
                className={`relative rounded-xl border p-4 text-left transition-all ${
                  equipped
                    ? 'border-cyan-400 bg-cyan-400/10 ring-1 ring-cyan-400'
                    : 'border-white/10 hover:border-white/30 bg-white/5'
                }`}
              >
                <Sparkles className={`w-6 h-6 mb-2 ${equipped ? 'text-cyan-300' : 'text-slate-400'}`} />
                <div className="font-bold text-sm">{prettyCosmeticId(id)}</div>
                <div className="text-xs mt-1 text-slate-400">
                  {equipped ? 'Equipped' : 'Tap to equip'}
                </div>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
