/**
 * Vibez 654 Prescription Room (Sovereign Tier)
 * ─────────────────────────────────────────────
 * Founder-tier engine with the official 6→5→4 Prescription rules:
 *   • Roll 5 dice (you have 3 total rolls to qualify)
 *   • Once qualified — point = sum of the OTHER 2 dice
 *   • Decision: STAND (lock score) or REROLL POINT DICE (max 3 shakes)
 *   • Side bets: TRIPLE_6 · ONE_AND_DONE · STRAIGHT_1 · STRAIGHT_6 · LARGE_STRAIGHT · POINT_PREDICTION
 *   • Nova dealer voice-line on every action
 *
 * All amounts in coins (₵). USD never appears.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Dice5, Dice6, Crown, Sparkles, RotateCcw, Check, Loader2,
  TrendingUp, AlertCircle, Volume2, History,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

type DiceFace = 1 | 2 | 3 | 4 | 5 | 6;

type GameResult = {
  qualified: boolean;
  point_score: number;
  point_dice: number[];
  locked_numbers: number[];
  has_6: boolean;
  has_5: boolean;
  has_4: boolean;
  next_needed?: number | null;
};

type PlayResponse = {
  success: boolean;
  roll_id: string;
  dice_roll: number[];
  all_rolls: number[][];
  total_rolls: number;
  rolls_left: number;
  game_result: GameResult;
  side_bet_results: Array<{ bet_type: string; payout: number; win: boolean; description?: string }>;
  side_bet_payout: number;
  dealer_envy_total: number;
  pot_info: { total_pot: number; house_rake: number; winner_payout: number };
  nova_reaction: { message: string; mood: string };
};

type StandResponse = {
  success: boolean;
  final_score: number;
  payout: number;
  nova_reaction: { message: string; mood: string };
  message: string;
};

type RerollResponse = {
  success: boolean;
  old_score: number;
  new_point_dice: number[];
  new_point_score: number;
  rolls_left: number;
  nova_reaction: { message: string; mood: string };
};

const SIDE_BETS = [
  { key: 'TRIPLE_6', label: 'Triple 6', payout: '30:1', tooltip: 'Three 6s on first roll' },
  { key: 'ONE_AND_DONE', label: 'One & Done', payout: '15:1', tooltip: 'Qualify on the very first roll' },
  { key: 'STRAIGHT_1', label: 'Straight 1-5', payout: '20:1', tooltip: '1, 2, 3, 4, 5 — any order' },
  { key: 'STRAIGHT_6', label: 'Straight 2-6', payout: '20:1', tooltip: '2, 3, 4, 5, 6 — any order' },
  { key: 'LARGE_STRAIGHT', label: 'Large Straight', payout: '50:1', tooltip: 'Any 5-in-a-row straight' },
];

const STAKES = [5, 10, 25, 50, 100, 250, 500];

// Pretty dice icons (1-6)
const DieFace = ({ value, locked = false, isPoint = false }: { value: number; locked?: boolean; isPoint?: boolean }) => {
  const dots: Record<DiceFace, number[]> = {
    1: [4],
    2: [0, 8],
    3: [0, 4, 8],
    4: [0, 2, 6, 8],
    5: [0, 2, 4, 6, 8],
    6: [0, 2, 3, 5, 6, 8],
  };
  const arr = dots[(value as DiceFace) || 1];
  return (
    <div
      className={`relative w-16 h-16 rounded-2xl grid grid-cols-3 grid-rows-3 gap-0.5 p-2 transition-all duration-300 shadow-2xl ${
        locked
          ? 'bg-gradient-to-br from-emerald-400 to-emerald-600 ring-2 ring-emerald-300'
          : isPoint
          ? 'bg-gradient-to-br from-amber-400 to-amber-600 ring-2 ring-amber-200 animate-pulse'
          : 'bg-gradient-to-br from-white to-slate-200'
      }`}
      data-testid="prescription-die"
    >
      {Array.from({ length: 9 }).map((_, i) => (
        <span
          key={i}
          className={`rounded-full ${arr.includes(i) ? (locked || isPoint ? 'bg-white' : 'bg-slate-900') : ''}`}
        />
      ))}
    </div>
  );
};

export default function Vibe654Prescription() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string>('');
  const [balance, setBalance] = useState<number>(0);
  const [bet, setBet] = useState<number>(25);
  const [pickedSideBets, setPickedSideBets] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState<'play' | 'reroll' | 'stand' | null>(null);
  const [play, setPlay] = useState<PlayResponse | null>(null);
  const [finalScore, setFinalScore] = useState<number | null>(null);
  const [history, setHistory] = useState<any[]>([]);

  const refreshBalance = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const r = await fetch(`${API}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const u = await r.json();
      const uid = u?.user?.user_id || u?.user_id;
      const b =
        u?.user?.credits_balance ??
        u?.credits_balance ??
        u?.token_balance ??
        0;
      if (uid) setUserId(uid);
      setBalance(Number(b) || 0);
    } catch {
      /* ignore */
    }
  };

  const refreshHistory = async (uid: string) => {
    try {
      const r = await fetch(`${API}/api/games/vibe654/history/${uid}?limit=5`);
      const d = await r.json();
      setHistory(d?.history || []);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    refreshBalance();
  }, []);

  useEffect(() => {
    if (userId) refreshHistory(userId);
  }, [userId]);

  const totalCommitted = useMemo(
    () => bet + Object.values(pickedSideBets).reduce((s, v) => s + (v || 0), 0),
    [bet, pickedSideBets],
  );

  const handleRoll = async () => {
    if (!userId) {
      toast.error('Auth not loaded yet, try again in a moment.');
      return;
    }
    if (totalCommitted > balance) {
      toast.error(`Insufficient ₵: ${totalCommitted.toLocaleString()} required, ${balance.toLocaleString()} available.`);
      return;
    }
    setBusy('play');
    setFinalScore(null);
    setPlay(null);
    try {
      const body = {
        user_id: userId,
        table_id: 'prescription_table_1',
        main_bet: bet,
        side_bets: Object.entries(pickedSideBets)
          .filter(([, amt]) => amt > 0)
          .map(([type, amount]) => ({ type, amount, has_insurance: false })),
        dealer_personality: 'nova',
      };
      const r = await fetch(`${API}/api/games/vibe654/play`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data: PlayResponse = await r.json();
      if (!r.ok || !data?.success) {
        toast.error((data as any)?.detail || 'Roll failed.');
        return;
      }
      setPlay(data);
      if (data.game_result.qualified) {
        toast.success(`Qualified! Point: ${data.game_result.point_score}`);
      } else {
        toast.error('Bust — failed to qualify in 3 rolls.');
      }
      refreshBalance();
    } catch {
      toast.error('Network error.');
    } finally {
      setBusy(null);
    }
  };

  const handleReroll = async () => {
    if (!play || !userId) return;
    setBusy('reroll');
    try {
      const r = await fetch(
        `${API}/api/games/vibe654/reroll-point-dice?roll_id=${encodeURIComponent(play.roll_id)}&user_id=${encodeURIComponent(userId)}`,
        { method: 'POST' },
      );
      const data: RerollResponse = await r.json();
      if (!r.ok || !data?.success) {
        toast.error((data as any)?.detail || 'Reroll failed.');
        return;
      }
      // Merge new point dice into existing play state
      setPlay({
        ...play,
        game_result: {
          ...play.game_result,
          point_dice: data.new_point_dice,
          point_score: data.new_point_score,
        },
        rolls_left: data.rolls_left,
        nova_reaction: data.nova_reaction,
      });
      const delta = data.new_point_score - data.old_score;
      if (delta > 0) toast.success(`Better! +${delta} → ${data.new_point_score}`);
      else if (delta < 0) toast.warning(`Worse: ${delta} → ${data.new_point_score}`);
      else toast.info(`Same: ${data.new_point_score}`);
    } catch {
      toast.error('Network error.');
    } finally {
      setBusy(null);
    }
  };

  const handleStand = async () => {
    if (!play || !userId) return;
    setBusy('stand');
    try {
      const r = await fetch(
        `${API}/api/games/vibe654/stand?roll_id=${encodeURIComponent(play.roll_id)}&user_id=${encodeURIComponent(userId)}`,
        { method: 'POST' },
      );
      const data: StandResponse = await r.json();
      if (!r.ok || !data?.success) {
        toast.error((data as any)?.detail || 'Stand failed.');
        return;
      }
      setFinalScore(data.final_score);
      toast.success(`Stood on ${data.final_score} · +${Number(data.payout).toLocaleString()} ₵`);
      refreshBalance();
      if (userId) refreshHistory(userId);
    } catch {
      toast.error('Network error.');
    } finally {
      setBusy(null);
    }
  };

  const resetTable = () => {
    setPlay(null);
    setFinalScore(null);
    setPickedSideBets({});
  };

  const result = play?.game_result;
  const allDice = play?.dice_roll || [0, 0, 0, 0, 0];
  const locked = result?.locked_numbers || [];
  const pointDice = result?.point_dice || [];

  return (
    <div className="min-h-screen bg-[#0a0612] text-slate-100 selection:bg-amber-400 selection:text-black" data-testid="prescription-page">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-amber-400/20 backdrop-blur-md sticky top-0 z-20 bg-[#0a0612]/95">
        <button
          onClick={() => navigate('/vibe-654-hall')}
          className="text-sm flex items-center gap-2 text-white/70 hover:text-white"
          data-testid="prescription-back"
        >
          <ArrowLeft className="w-4 h-4" /> Hall
        </button>
        <h1 className="text-base md:text-xl tracking-[0.3em] uppercase text-amber-200 flex items-center gap-3">
          <Crown className="w-5 h-5" />
          Prescription Room
        </h1>
        <div className="flex items-center gap-2 text-xs">
          <Badge className="bg-amber-500/15 text-amber-200 border-amber-400/40 border">Sovereign Tier</Badge>
          <span className="hidden md:inline text-white/70 font-mono" data-testid="prescription-balance">
            {balance.toLocaleString()} ₵
          </span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-5">
        {/* Table layout */}
        <Card className="p-6 bg-gradient-to-br from-amber-900/20 via-fuchsia-900/10 to-purple-900/20 border border-amber-400/20">
          {/* Dice strip */}
          <div className="flex items-center justify-center gap-3 min-h-[88px]" data-testid="prescription-dice-strip">
            {(play ? allDice : [1, 2, 3, 4, 5]).map((face, i) => {
              const isLocked = locked.includes(face) && play !== null;
              const isPoint = result?.qualified && pointDice.includes(face) && !isLocked;
              return <DieFace key={i} value={face} locked={isLocked} isPoint={isPoint} />;
            })}
          </div>

          {/* Status row */}
          <div className="mt-5 flex items-center justify-between flex-wrap gap-3 text-sm" data-testid="prescription-status-row">
            {play ? (
              <>
                <div className="flex items-center gap-2">
                  <Sparkles className={`w-4 h-4 ${result?.has_6 ? 'text-emerald-400' : 'text-white/30'}`} />
                  <span className={result?.has_6 ? 'text-emerald-300' : 'text-white/40'}>6</span>
                  <Sparkles className={`w-4 h-4 ${result?.has_5 ? 'text-emerald-400' : 'text-white/30'}`} />
                  <span className={result?.has_5 ? 'text-emerald-300' : 'text-white/40'}>5</span>
                  <Sparkles className={`w-4 h-4 ${result?.has_4 ? 'text-emerald-400' : 'text-white/30'}`} />
                  <span className={result?.has_4 ? 'text-emerald-300' : 'text-white/40'}>4</span>
                </div>
                <div>
                  Rolls left: <span className="font-mono text-amber-200">{play.rolls_left}</span>
                </div>
                <div>
                  {result?.qualified ? (
                    <Badge className="bg-emerald-500/20 text-emerald-200 border border-emerald-400/40" data-testid="prescription-qualified-badge">
                      QUALIFIED · Point {result.point_score}
                    </Badge>
                  ) : (
                    <Badge className="bg-rose-500/20 text-rose-200 border border-rose-400/40" data-testid="prescription-bust-badge">
                      BUST
                    </Badge>
                  )}
                </div>
              </>
            ) : (
              <p className="text-white/50 text-center w-full text-xs italic">
                Set your bet · pick side bets · roll. Qualify with a 6, 5, AND 4 in three rolls or fewer.
              </p>
            )}
          </div>

          {/* Nova voice */}
          {play?.nova_reaction?.message && (
            <div
              className="mt-4 p-3 rounded-lg bg-black/40 border border-amber-400/20 flex items-start gap-2"
              data-testid="prescription-nova-voice"
            >
              <Volume2 className="w-4 h-4 text-amber-300 mt-0.5 flex-shrink-0" />
              <p className="text-sm italic text-amber-100/90">"{play.nova_reaction.message}"</p>
            </div>
          )}
        </Card>

        {/* Action buttons */}
        {!finalScore && (
          <div className="flex items-center justify-center gap-3 flex-wrap" data-testid="prescription-actions">
            {!play && (
              <Button
                onClick={handleRoll}
                disabled={busy !== null || totalCommitted <= 0}
                size="lg"
                data-testid="prescription-roll-btn"
                className="bg-gradient-to-r from-amber-400 to-amber-600 hover:from-amber-300 hover:to-amber-500 text-black font-black text-lg px-12 py-6 rounded-full"
              >
                {busy === 'play' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Dice6 className="w-5 h-5" />}
                <span className="ml-2">{busy === 'play' ? 'Rolling…' : `Roll · ${totalCommitted.toLocaleString()} ₵`}</span>
              </Button>
            )}

            {play && result?.qualified && play.rolls_left > 0 && (
              <Button
                onClick={handleReroll}
                disabled={busy !== null}
                data-testid="prescription-reroll-btn"
                variant="outline"
                className="border-amber-400/50 text-amber-200 hover:bg-amber-500/10"
              >
                {busy === 'reroll' ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RotateCcw className="w-4 h-4 mr-2" />}
                Reroll point dice ({play.rolls_left} left)
              </Button>
            )}

            {play && result?.qualified && (
              <Button
                onClick={handleStand}
                disabled={busy !== null}
                data-testid="prescription-stand-btn"
                className="bg-emerald-500 hover:bg-emerald-400 text-black font-black"
              >
                {busy === 'stand' ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
                Stand on {result.point_score}
              </Button>
            )}

            {play && (!result?.qualified || finalScore !== null) && (
              <Button onClick={resetTable} variant="outline" data-testid="prescription-reset-btn">
                New game
              </Button>
            )}
          </div>
        )}

        {finalScore !== null && (
          <Card className="p-6 bg-gradient-to-br from-emerald-700/20 to-emerald-900/30 border border-emerald-400/40 text-center" data-testid="prescription-final-card">
            <p className="text-xs uppercase tracking-widest text-emerald-300">Final score</p>
            <p className="text-5xl font-black text-emerald-200 mt-1">{finalScore}</p>
            <Button onClick={resetTable} className="mt-4 bg-amber-400 text-black hover:bg-amber-300" data-testid="prescription-new-game-btn">
              Play again
            </Button>
          </Card>
        )}

        {/* Bet builder */}
        {!play && (
          <Card className="p-5 bg-black/30 border border-white/10" data-testid="prescription-bet-builder">
            <div className="flex items-center gap-2 mb-3">
              <Dice5 className="w-4 h-4 text-amber-300" />
              <p className="text-sm font-bold uppercase tracking-widest text-amber-200">Main bet</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {STAKES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setBet(s)}
                  data-testid={`prescription-stake-${s}`}
                  className={`px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest border transition-colors ${
                    bet === s
                      ? 'bg-amber-400 text-black border-amber-400'
                      : 'bg-white/5 text-white/70 border-white/10 hover:bg-white/10'
                  }`}
                >
                  {s.toLocaleString()} ₵
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 mt-5 mb-3">
              <TrendingUp className="w-4 h-4 text-fuchsia-300" />
              <p className="text-sm font-bold uppercase tracking-widest text-fuchsia-200">Side bets</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {SIDE_BETS.map((sb) => {
                const isPicked = (pickedSideBets[sb.key] || 0) > 0;
                return (
                  <button
                    key={sb.key}
                    type="button"
                    onClick={() =>
                      setPickedSideBets((prev) => ({
                        ...prev,
                        [sb.key]: prev[sb.key] ? 0 : Math.min(100, Math.max(10, Math.round(bet / 5))),
                      }))
                    }
                    data-testid={`prescription-sidebet-${sb.key}`}
                    className={`text-left p-3 rounded-lg border text-xs transition-colors ${
                      isPicked
                        ? 'bg-fuchsia-500/15 border-fuchsia-400/50 text-fuchsia-100'
                        : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold">{sb.label}</span>
                      <span className="font-mono text-[10px] text-amber-300">{sb.payout}</span>
                    </div>
                    <p className="text-[10px] text-white/50 mt-1">{sb.tooltip}</p>
                    {isPicked && (
                      <p className="text-[10px] text-fuchsia-200 mt-1">+ {(pickedSideBets[sb.key] || 0).toLocaleString()} ₵</p>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 text-xs text-white/50 flex items-center gap-2">
              <AlertCircle className="w-3 h-3" />
              Total committed:{' '}
              <span className="font-mono text-amber-200 font-bold">{totalCommitted.toLocaleString()} ₵</span>
            </div>
          </Card>
        )}

        {/* Side-bet result strip */}
        {play && play.side_bet_results && play.side_bet_results.length > 0 && (
          <Card className="p-4 bg-black/30 border border-fuchsia-400/20" data-testid="prescription-side-bet-results">
            <p className="text-xs uppercase tracking-widest text-fuchsia-200 mb-2">Side bet results</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {play.side_bet_results.map((sb, i) => (
                <div
                  key={i}
                  className={`p-2 rounded-lg text-xs border ${
                    sb.win
                      ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-200'
                      : 'bg-rose-500/10 border-rose-400/30 text-rose-200/70'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold">{sb.bet_type}</span>
                    <span className="font-mono">
                      {sb.win ? `+${Number(sb.payout).toLocaleString()}` : '—'} ₵
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* History */}
        {history.length > 0 && (
          <Card className="p-4 bg-black/30 border border-white/10" data-testid="prescription-history">
            <div className="flex items-center gap-2 mb-3">
              <History className="w-4 h-4 text-white/60" />
              <p className="text-xs uppercase tracking-widest text-white/60">Recent rolls</p>
            </div>
            <div className="space-y-1.5">
              {history.slice(0, 5).map((h, i) => (
                <div key={i} className="flex items-center justify-between text-xs p-2 rounded bg-white/5 border border-white/5">
                  <span className="font-mono text-white/70">
                    {(h.dice_roll || []).join(' · ') || 'no dice'}
                  </span>
                  <span
                    className={`font-bold ${
                      h.qualified ? 'text-emerald-300' : 'text-rose-300'
                    }`}
                  >
                    {h.qualified ? `Point ${h.point_score || h.final_score || '?'}` : 'Bust'}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </main>
    </div>
  );
}
