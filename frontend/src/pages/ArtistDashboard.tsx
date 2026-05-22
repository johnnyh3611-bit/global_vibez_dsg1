/**
 * /artist/dashboard — Creator Dashboard for Master Media Engine.
 *
 * Surfaces the artist's accrued balance, recent fan-tip ledger,
 * their own track catalog, and a Gas-Out Accelerator button to
 * trigger the instant DSG SPL payout (90 % to wallet · 10 % SPL
 * burn — the only burn surface on the platform).
 *
 * All metrics in coins (₵). USD never appears.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Coins, Heart, Music2, TrendingUp, Zap, Loader2, ArrowLeft,
  Sparkles, Disc3, Crown, AlertCircle, CheckCircle2,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { LicenseInboxCard } from '@/components/LicenseInboxCard';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

type Balance = {
  artist_id: string;
  balance_coins: number;
  lifetime_earned_coins: number;
  txn_count: number;
  gas_out_count?: number;
};

type Txn = {
  txn_id: string;
  user_id: string;
  track_id: string;
  track_title: string;
  transaction_type: string;
  coin_amount_spent: number;
  artist_payout: number;
  at: string;
};

type Track = {
  track_id: string;
  track_title: string;
  weekly_chart_points: number;
  lifetime_chart_points: number;
  momentum_score: number;
  cover_art_url?: string;
};

const fmt = (n: number) => `${(n || 0).toLocaleString()} ₵`;

const kindLabel: Record<string, string> = {
  ROOM_TIP: 'Tip',
  QUEUE_BOOST: 'Vote Boost',
  STREAM_UNLOCK: 'Stream Unlock',
  VISUAL_GIFT: 'Visual Gift',
};

export default function ArtistDashboard() {
  const navigate = useNavigate();
  const [balance, setBalance] = useState<Balance | null>(null);
  const [txns, setTxns] = useState<Txn[]>([]);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);

  // Gas-Out modal state
  const [gasOpen, setGasOpen] = useState(false);
  const [gasAmount, setGasAmount] = useState<number>(0);
  const [gasWallet, setGasWallet] = useState<string>('');
  const [gasBusy, setGasBusy] = useState(false);
  const [lastGasOut, setLastGasOut] = useState<{
    gross: number; fee: number; net: number; gas_id: string;
  } | null>(null);

  const token = () => localStorage.getItem('auth_token');

  const fetchAll = async () => {
    const t = token();
    if (!t) {
      navigate('/auth');
      return;
    }
    const auth = { Authorization: `Bearer ${t}` };
    try {
      const [bRes, tRes, kRes] = await Promise.all([
        fetch(`${API}/api/media/artist/me/balance`, { headers: auth }),
        fetch(`${API}/api/media/artist/me/transactions?limit=25`, { headers: auth }),
        fetch(`${API}/api/media/artist/me/tracks`, { headers: auth }),
      ]);
      if (bRes.status === 401) {
        navigate('/auth');
        return;
      }
      const [b, t2, k] = await Promise.all([
        bRes.json(), tRes.json(), kRes.json(),
      ]);
      setBalance(b);
      setTxns(t2?.rows || []);
      setTracks(k?.rows || []);
    } catch {
      toast.error('Could not load creator dashboard.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleGasOut = async () => {
    if (gasAmount <= 0) {
      toast.error('Enter an amount > 0.');
      return;
    }
    if (!gasWallet || gasWallet.length < 32) {
      toast.error('Enter a valid Solana wallet address (≥ 32 chars).');
      return;
    }
    if (balance && gasAmount > balance.balance_coins) {
      toast.error('Amount exceeds your accrued balance.');
      return;
    }
    setGasBusy(true);
    try {
      const t = token();
      const res = await fetch(`${API}/api/media/artist/me/gas-out`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${t}`,
        },
        body: JSON.stringify({ coins: gasAmount, solana_wallet: gasWallet }),
      });
      const data = await res.json();
      if (res.ok && data?.ok) {
        toast.success(`Gas-Out queued · ${fmt(data.net_coins)} → wallet`, {
          description: `${fmt(data.fee_coins)} burned as DSG SPL`,
        });
        setLastGasOut({
          gross: data.gross_coins, fee: data.fee_coins,
          net: data.net_coins, gas_id: data.gas_id,
        });
        setGasOpen(false);
        setGasAmount(0);
        // Refresh
        fetchAll();
      } else {
        toast.error(data?.reason || data?.detail || 'Gas-Out failed.');
      }
    } catch {
      toast.error('Network error.');
    } finally {
      setGasBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#06080f] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
      </div>
    );
  }

  const bal = balance?.balance_coins ?? 0;
  const lifetime = balance?.lifetime_earned_coins ?? 0;

  return (
    <div className="min-h-screen bg-[#06080f] text-slate-100" data-testid="artist-dashboard-page">
      <header className="sticky top-0 z-20 flex items-center justify-between px-6 py-4 border-b border-amber-400/20 backdrop-blur-md bg-[#06080f]/95">
        <button
          onClick={() => navigate(-1)}
          className="text-sm flex items-center gap-2 text-white/70 hover:text-white"
          data-testid="artist-dashboard-back"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <h1 className="text-base md:text-xl tracking-[0.3em] uppercase text-amber-200 flex items-center gap-3">
          <Crown className="w-5 h-5" /> Creator Studio
        </h1>
        <Badge className="bg-amber-500/15 text-amber-200 border-amber-400/40 border">
          80% take · 0% burn
        </Badge>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-5">
        <LicenseInboxCard />
        {/* Headline balance card */}
        <Card className="p-6 bg-gradient-to-br from-amber-500/15 via-fuchsia-500/10 to-purple-700/15 border border-amber-400/30">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-widest text-amber-300">Accrued balance</p>
              <p
                className="text-5xl font-black bg-gradient-to-r from-amber-200 to-fuchsia-200 bg-clip-text text-transparent"
                data-testid="artist-balance-headline"
              >
                {fmt(bal)}
              </p>
              <p className="text-xs text-white/60 mt-2">
                Lifetime earned: <span className="text-white font-mono">{fmt(lifetime)}</span>{' '}
                · From {balance?.txn_count?.toLocaleString() ?? 0} fan transactions
              </p>
            </div>
            <Button
              onClick={() => setGasOpen(true)}
              data-testid="artist-gas-out-trigger"
              className="bg-gradient-to-r from-amber-400 to-fuchsia-500 hover:from-amber-300 hover:to-fuchsia-400 text-black font-black"
              disabled={bal <= 0}
            >
              <Zap className="w-4 h-4 mr-2" /> Gas-Out
            </Button>
          </div>
          {lastGasOut && (
            <div
              className="mt-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-400/40 text-xs"
              data-testid="artist-last-gas-out"
            >
              <p className="font-bold text-emerald-200 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Gas-Out queued ·{' '}
                <span className="font-mono">{lastGasOut.gas_id}</span>
              </p>
              <p className="text-emerald-100/80 mt-1">
                {fmt(lastGasOut.gross)} gross → {fmt(lastGasOut.net)} to wallet · {fmt(lastGasOut.fee)} DSG SPL burned
              </p>
            </div>
          )}
        </Card>

        {/* Gas-Out modal */}
        {gasOpen && (
          <Card
            className="p-5 bg-black/80 border border-amber-400/40"
            data-testid="artist-gas-out-modal"
          >
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-5 h-5 text-amber-300" />
              <h2 className="text-lg font-black">Gas-Out Accelerator</h2>
            </div>
            <p className="text-xs text-white/60 mb-4 leading-snug">
              Convert your accrued ₵ to DSG SPL on Solana. 90% lands in your wallet, 10% burns
              as DSG SPL — the only burn surface on the platform. In-app coins never burn.
            </p>
            <label className="text-[10px] uppercase tracking-widest text-amber-300">Amount (₵)</label>
            <Input
              type="number"
              value={gasAmount || ''}
              onChange={(e) => setGasAmount(Math.max(0, Number(e.target.value) || 0))}
              placeholder="e.g. 50000"
              className="bg-white/5 border-amber-400/30 text-white mt-1 mb-3"
              data-testid="artist-gas-out-amount"
            />
            <label className="text-[10px] uppercase tracking-widest text-amber-300">
              Solana wallet
            </label>
            <Input
              value={gasWallet}
              onChange={(e) => setGasWallet(e.target.value.trim())}
              placeholder="Your Solana address"
              className="bg-white/5 border-amber-400/30 text-white font-mono text-xs mt-1 mb-4"
              data-testid="artist-gas-out-wallet"
            />
            {gasAmount > 0 && (
              <div className="mb-4 text-xs text-white/70 space-y-1 p-3 rounded-lg bg-amber-500/5 border border-amber-400/20">
                <div className="flex justify-between">
                  <span>Gross</span>
                  <span className="font-mono">{fmt(gasAmount)}</span>
                </div>
                <div className="flex justify-between text-rose-300">
                  <span>Burn fee (10% DSG SPL)</span>
                  <span className="font-mono">-{fmt(Math.floor(gasAmount * 0.1))}</span>
                </div>
                <div className="flex justify-between text-emerald-300 font-bold pt-1 border-t border-white/10">
                  <span>To your wallet</span>
                  <span className="font-mono">
                    {fmt(gasAmount - Math.floor(gasAmount * 0.1))}
                  </span>
                </div>
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <Button
                variant="ghost"
                onClick={() => setGasOpen(false)}
                disabled={gasBusy}
                data-testid="artist-gas-out-cancel"
              >
                Cancel
              </Button>
              <Button
                onClick={handleGasOut}
                disabled={gasBusy || gasAmount <= 0 || !gasWallet}
                className="bg-amber-400 text-black hover:bg-amber-300 font-black"
                data-testid="artist-gas-out-confirm"
              >
                {gasBusy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Zap className="w-4 h-4 mr-2" />}
                Confirm Gas-Out
              </Button>
            </div>
          </Card>
        )}

        {/* My tracks */}
        <Card className="p-5 bg-black/30 border border-white/10" data-testid="artist-tracks-card">
          <div className="flex items-center gap-2 mb-3">
            <Disc3 className="w-4 h-4 text-fuchsia-300" />
            <h2 className="text-sm font-bold uppercase tracking-widest text-fuchsia-200">
              My tracks ({tracks.length})
            </h2>
          </div>
          {tracks.length === 0 ? (
            <div className="text-center py-6 text-xs text-white/40 flex flex-col items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              No tracks yet. Ask an admin to add your tracks via the Media Engine, or wait for
              the artist-onboarding flow (queued).
            </div>
          ) : (
            <div className="space-y-2">
              {tracks.map((t) => (
                <div
                  key={t.track_id}
                  className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10"
                  data-testid={`artist-track-row-${t.track_id}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-fuchsia-500 to-purple-700 flex items-center justify-center flex-shrink-0">
                      <Music2 className="w-5 h-5 text-white" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-sm truncate">{t.track_title}</p>
                      <p className="text-[10px] text-white/40 font-mono">{t.track_id}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs flex-shrink-0">
                    <div className="text-center">
                      <p className="text-[9px] uppercase tracking-widest text-amber-300/80">Week</p>
                      <p className="font-mono text-amber-200 font-bold">
                        {t.weekly_chart_points?.toLocaleString() ?? 0}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-[9px] uppercase tracking-widest text-fuchsia-300/80">All-time</p>
                      <p className="font-mono text-fuchsia-200 font-bold">
                        {t.lifetime_chart_points?.toLocaleString() ?? 0}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Recent transactions */}
        <Card className="p-5 bg-black/30 border border-white/10" data-testid="artist-txns-card">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-emerald-300" />
            <h2 className="text-sm font-bold uppercase tracking-widest text-emerald-200">
              Recent ledger ({txns.length})
            </h2>
          </div>
          {txns.length === 0 ? (
            <div className="text-center py-6 text-xs text-white/40 flex flex-col items-center gap-2">
              <Sparkles className="w-5 h-5" />
              No transactions yet. Drop a track and rock the room — your tips show up here in real time.
            </div>
          ) : (
            <div className="space-y-1.5 max-h-[420px] overflow-y-auto">
              {txns.map((t) => (
                <div
                  key={t.txn_id}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-white/5 border border-white/10 text-xs"
                  data-testid={`artist-txn-${t.txn_id}`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Heart className="w-3.5 h-3.5 text-pink-300 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="font-bold text-white/90">
                        {kindLabel[t.transaction_type] || t.transaction_type}
                      </p>
                      <p className="text-[10px] text-white/40 truncate">
                        {t.track_title} · {new Date(t.at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <Coins className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="font-mono font-bold text-emerald-300">
                      +{(t.artist_payout || 0).toLocaleString()} ₵
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Economics transparency footer */}
        <p className="text-[10px] text-white/40 text-center py-2" data-testid="artist-dashboard-footer">
          Every fan transaction: 80% → your balance · 15% → Treasury · 5% → Tournament Pool · 0% burn.
          Burn only happens at Gas-Out (10% DSG SPL).
        </p>
      </main>
    </div>
  );
}
