/**
 * DailySpinWheel — Random Tier Prize Engine (v1 Blueprint + v1.1 Patch, Feb 2026)
 *
 * One spin per 24h per user. Tier auto-resolved server-side:
 *   • Free  — passes Sybil gate, no chair, no recent ₵ spending
 *   • Mid   — ≥ 50,000 ₵ spent in last 30 days
 *   • Top   — active Founder Chair holder (hardware-locked)
 *
 * Every metric on screen is in COINS (₵). USD never appears.
 * The 0.5%-of-treasury circuit breaker is surfaced honestly when
 * tripped so users know utility-only rewards are still available.
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BackButton from '@/components/BackButton';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sparkles, Lock, Clock, Shield, Coins, Gift, AlertTriangle, Crown } from 'lucide-react';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

type Outcome = {
  kind: 'coins' | 'digital_asset' | 'merchant_perk';
  probability: number;
  label: string;
  is_jackpot: boolean;
};

type Status = {
  ok: boolean;
  tier?: 'free' | 'mid' | 'top';
  tier_label?: string;
  eligible?: boolean;
  sybil_passes?: boolean;
  sybil_blocked_reason?: string | null;
  cooldown_active?: boolean;
  next_spin_at?: string | null;
  breaker?: {
    tripped: boolean;
    rolling_minted_coins: number;
    ceiling_coins: number;
    next_reset_at: string;
  };
  outcomes?: Outcome[];
};

type SpinResult = {
  ok: boolean;
  spin_id?: string;
  tier_label?: string;
  outcome?: {
    kind: 'coins' | 'digital_asset' | 'merchant_perk';
    coin_amount: number;
    title: string;
    subtitle: string;
    is_jackpot: boolean;
  };
  balance_after_coins?: number | null;
  breaker_applied?: boolean;
  reason?: string;
  next_spin_at?: string;
};

const fmtCoins = (n: number) => `${n.toLocaleString()} ₵`;

const tierAccent: Record<string, string> = {
  free: 'from-slate-500 to-slate-700',
  mid: 'from-amber-500 to-orange-600',
  top: 'from-fuchsia-500 via-purple-600 to-indigo-700',
};

const sybilReasonCopy: Record<string, string> = {
  phone_not_verified: 'Verify your phone number to unlock daily spins.',
  profile_incomplete: 'Complete your dating profile (name, bio, 1 photo) to unlock daily spins.',
  no_game_hand_in_24h: 'Play at least one card or casino hand in the last 24 hours to qualify.',
  founder_chair_required: 'Top Tier spins require an active Founder Chair.',
};

export default function DailySpinWheel() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<SpinResult | null>(null);

  const fetchStatus = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API}/api/prize-wheel/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        navigate('/auth');
        return;
      }
      const data = await res.json();
      setStatus(data);
    } catch {
      // non-fatal
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSpin = async () => {
    if (!status?.eligible || spinning) return;
    setSpinning(true);
    setResult(null);
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API}/api/prize-wheel/spin`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data: SpinResult = await res.json();

      // Suspense delay so the wheel animation completes
      await new Promise((r) => setTimeout(r, 1800));
      setResult(data);

      if (data.ok && data.outcome) {
        if (data.outcome.kind === 'coins') {
          toast.success(
            data.outcome.is_jackpot
              ? `JACKPOT! ${fmtCoins(data.outcome.coin_amount)} added.`
              : `+${fmtCoins(data.outcome.coin_amount)} added to your wallet.`,
          );
        } else {
          toast.success(`${data.outcome.title} awarded — check your inventory.`);
        }
        // Refresh status (cooldown begins)
        fetchStatus();
      } else if (data.reason === 'cooldown_active') {
        toast.error('Daily spin already used. Come back in 24 hours.');
      } else if (data.reason?.startsWith('sybil:')) {
        const r = data.reason.replace('sybil:', '');
        toast.error(sybilReasonCopy[r] || 'Eligibility check failed.');
      } else if (data.reason === 'breaker_blocked') {
        toast.error('Treasury cooldown active. Try again at the next window.');
      } else {
        toast.error(`Spin failed: ${data.reason || 'unknown error'}`);
      }
    } catch {
      toast.error('Spin failed — network error.');
    } finally {
      setSpinning(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-black py-8 px-4">
        <BackButton to="/dashboard" label="Back" variant="default" />
        <div className="max-w-3xl mx-auto text-center text-white/60 mt-16">Loading wheel…</div>
      </div>
    );
  }

  const tier = (status?.tier || 'free') as 'free' | 'mid' | 'top';
  const tierGradient = tierAccent[tier];
  const breakerTripped = status?.breaker?.tripped;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-black py-8 px-4">
      <BackButton to="/dashboard" label="Back" variant="default" />

      <div className="max-w-3xl mx-auto space-y-6" data-testid="daily-spin-wheel-page">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black bg-gradient-to-r from-fuchsia-400 via-purple-400 to-indigo-400 bg-clip-text text-transparent">
            Daily Vibez Wheel
          </h1>
          <p className="text-base text-white/70 mt-2">
            One spin every 24 hours. Coins · boosts · merchant perks.
          </p>
        </div>

        {/* Tier card */}
        <Card className={`p-6 bg-gradient-to-br ${tierGradient} border-none text-white shadow-2xl`}>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <Crown className="w-7 h-7" />
              <div>
                <div className="text-xs uppercase tracking-widest opacity-80">Your tier</div>
                <div className="text-2xl font-black" data-testid="wheel-tier-label">
                  {status?.tier_label || 'Free Tier'}
                </div>
              </div>
            </div>
            {breakerTripped && (
              <Badge className="bg-amber-500 text-black flex items-center gap-1" data-testid="breaker-badge">
                <AlertTriangle className="w-3.5 h-3.5" /> Treasury cooldown
              </Badge>
            )}
          </div>
        </Card>

        {/* Spin button + result */}
        <Card className="p-8 bg-black/60 backdrop-blur-xl border border-white/10 text-white text-center">
          <div className="flex flex-col items-center gap-5">
            <div
              className={`w-48 h-48 rounded-full bg-gradient-to-br ${tierGradient} flex items-center justify-center shadow-2xl transition-transform ${
                spinning ? 'animate-spin' : ''
              }`}
              style={{ animationDuration: spinning ? '0.6s' : undefined }}
              data-testid="wheel-disc"
            >
              <Sparkles className="w-24 h-24 text-white drop-shadow-2xl" />
            </div>

            {!result && (
              <Button
                onClick={handleSpin}
                disabled={!status?.eligible || spinning}
                size="lg"
                className="bg-gradient-to-r from-fuchsia-500 to-purple-600 hover:from-fuchsia-600 hover:to-purple-700 text-white font-black text-lg px-12 py-6 rounded-full"
                data-testid="spin-button"
              >
                {spinning ? 'Spinning…' : status?.eligible ? 'SPIN THE WHEEL' : 'Spin unavailable'}
              </Button>
            )}

            {result?.ok && result.outcome && (
              <div className="space-y-2" data-testid="spin-result">
                {result.outcome.kind === 'coins' ? (
                  <>
                    <div className="text-sm uppercase tracking-widest text-emerald-300">
                      {result.outcome.is_jackpot ? '🎉 Jackpot!' : 'You won'}
                    </div>
                    <div className="text-5xl font-black text-emerald-400" data-testid="spin-result-coins">
                      +{fmtCoins(result.outcome.coin_amount)}
                    </div>
                    {result.balance_after_coins != null && (
                      <div className="text-sm text-white/70">
                        Wallet balance: {fmtCoins(result.balance_after_coins)}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="text-sm uppercase tracking-widest text-fuchsia-300">
                      Utility perk awarded
                    </div>
                    <div className="text-2xl font-black">{result.outcome.title}</div>
                    <div className="text-sm text-white/70">{result.outcome.subtitle}</div>
                  </>
                )}
              </div>
            )}

            {/* Ineligibility hint */}
            {!status?.eligible && !spinning && !result && (
              <div className="text-sm text-white/70 max-w-md" data-testid="ineligibility-hint">
                {status?.sybil_blocked_reason
                  ? sybilReasonCopy[status.sybil_blocked_reason] || 'Eligibility check failed.'
                  : status?.cooldown_active && status?.next_spin_at
                  ? `Next spin available ${new Date(status.next_spin_at).toLocaleString()}.`
                  : 'Spin unavailable right now.'}
              </div>
            )}
          </div>
        </Card>

        {/* Outcome matrix */}
        <Card className="p-6 bg-black/60 backdrop-blur-xl border border-white/10 text-white">
          <div className="flex items-center gap-2 mb-4">
            <Gift className="w-5 h-5 text-fuchsia-400" />
            <h2 className="text-lg font-black">Possible outcomes</h2>
          </div>
          <div className="space-y-2" data-testid="outcome-matrix">
            {(status?.outcomes || []).map((o, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10"
                data-testid={`outcome-row-${idx}`}
              >
                <div className="flex items-center gap-3">
                  {o.kind === 'coins' ? (
                    <Coins className={`w-5 h-5 ${o.is_jackpot ? 'text-amber-400' : 'text-emerald-400'}`} />
                  ) : o.kind === 'merchant_perk' ? (
                    <Shield className="w-5 h-5 text-cyan-400" />
                  ) : (
                    <Sparkles className="w-5 h-5 text-fuchsia-400" />
                  )}
                  <div>
                    <div className="font-bold text-sm">{o.label}</div>
                    {o.is_jackpot && (
                      <Badge className="bg-amber-500 text-black text-[10px] mt-1">JACKPOT</Badge>
                    )}
                  </div>
                </div>
                <div className="text-xs text-white/60 font-mono">
                  {(o.probability * 100).toFixed(0)}%
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Circuit-breaker readout (transparency) */}
        {status?.breaker && (
          <Card className="p-4 bg-black/40 backdrop-blur-xl border border-white/10 text-white/80 text-sm">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-4 h-4 text-amber-400" />
              <span className="font-bold">Treasury safety meter</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span>24h coin mint</span>
              <span className="font-mono">
                {fmtCoins(status.breaker.rolling_minted_coins)} / {fmtCoins(status.breaker.ceiling_coins)}
              </span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-2 mt-2 overflow-hidden">
              <div
                className={`h-2 rounded-full ${breakerTripped ? 'bg-amber-400' : 'bg-emerald-400'}`}
                style={{
                  width: `${Math.min(
                    100,
                    status.breaker.ceiling_coins
                      ? (status.breaker.rolling_minted_coins / status.breaker.ceiling_coins) * 100
                      : 0,
                  )}%`,
                }}
              />
            </div>
            <p className="text-[11px] text-white/50 mt-2 flex items-start gap-1">
              <Clock className="w-3 h-3 mt-0.5" />
              The wheel is hard-capped at 0.5% of the Treasury bucket per rolling 24 hours.
              When tripped, only utility perks are awarded — coins stay safe.
            </p>
          </Card>
        )}

        {/* Eligibility checklist */}
        <Card className="p-4 bg-black/40 backdrop-blur-xl border border-white/10 text-white/80 text-sm">
          <div className="flex items-center gap-2 mb-3">
            <Lock className="w-4 h-4 text-fuchsia-400" />
            <span className="font-bold">Eligibility</span>
          </div>
          <ul className="space-y-1 text-xs">
            <li>· SMS-verified phone number</li>
            <li>· Complete dating profile (name, bio, 1 photo)</li>
            <li>· Played at least one card or casino hand in the last 24 hours</li>
            <li>· Top Tier additionally requires an active Founder Chair</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
