import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Trophy, DollarSign } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { authFetch } from '@/utils/secureAuth';
import { Button } from '@/components/ui/button';
import { useTournamentMode } from '@/hooks/useTournamentMode';
import TournamentBanner from '@/components/tournament/TournamentBanner';
import {
  BLACKJACK_DEALER_HITS_SOFT_17,
  BLACKJACK_DEALER_STAND_VALUE,
} from '@/lib/cardGameRules';

// Vibez Casino blackjack tables follow the **S17** ruleset: dealer
// stands on a soft-17. House edge ≈ 0.50% on standard 6-deck shoe.
// (See lib/cardGameRules.ts for the full rationale.)
const DEALER_HITS_SOFT_17 = BLACKJACK_DEALER_HITS_SOFT_17; // false
const DEALER_STANDS_AT = BLACKJACK_DEALER_STAND_VALUE;     // 17
void DEALER_HITS_SOFT_17; void DEALER_STANDS_AT;

const API = process.env.REACT_APP_BACKEND_URL;

const SUIT_SYMBOLS: Record<string, string> = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣', back: '?' };
const SUIT_COLORS: Record<string, string> = {
  spades: 'text-slate-900',
  clubs: 'text-slate-900',
  hearts: 'text-rose-600',
  diamonds: 'text-rose-600',
  back: 'text-white',
};

type Card = { suit: string; rank: string };
type Seat = {
  seat_id: string;
  player_type: 'user' | 'bot';
  name: string;
  hand: Card[];
  bet: number;
  value: number;
  status: string;
  result: string | null;
  payout: number;
};
type GameState = {
  game_id: string;
  phase: 'betting' | 'playing' | 'dealer' | 'settled' | string;
  active_seat: number;
  dealer: { hand: Card[]; value: number; is_blackjack: boolean };
  seats: Seat[];
  user_seat_id: string;
  shoe_remaining: number;
  message: string;
};

const CardView = ({ card, flip = false }: { card: Card; flip?: boolean }) => {
  if (card.suit === 'back' || flip) {
    return (
      <div className="w-14 h-20 rounded-lg bg-gradient-to-br from-indigo-700 via-purple-800 to-slate-900 border-2 border-indigo-400/40 shadow-lg flex items-center justify-center text-white text-2xl">
        ★
      </div>
    );
  }
  return (
    <motion.div
      initial={{ rotateY: 180 }}
      animate={{ rotateY: 0 }}
      className={`w-14 h-20 rounded-lg bg-white shadow-lg border-2 border-slate-300 flex flex-col items-center justify-center font-bold ${SUIT_COLORS[card.suit]}`}
    >
      <span className="leading-none">{card.rank}</span>
      <span className="text-xl leading-none">{SUIT_SYMBOLS[card.suit]}</span>
    </motion.div>
  );
};

const BET_CHIPS = [500, 1000, 5000, 10000, 50000];

export default function BlackjackUniversal() {
  const navigate = useNavigate();
  const [state, setState] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(true);
  const [betAmount, setBetAmount] = useState(1000);
  const [submitting, setSubmitting] = useState(false);
  const tournament = useTournamentMode();

  const startGame = useCallback(async (numBots: number = 2) => {
    setLoading(true);
    try {
      const res = await authFetch(`${API}/api/blackjack-universal/start`, {
        method: 'POST',
        body: JSON.stringify({ num_bots: numBots }),
      });
      if (!res.ok) throw new Error('Failed to start');
      const data = await res.json();
      setState(data);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { startGame(2); }, [startGame]);

  // Tournament mode: submit net P&L (payout - bet) on first settle.
  useEffect(() => {
    if (!tournament.active || !state) return;
    if (state.phase !== 'settled' || tournament.submitted || tournament.submitting) return;
    const mySeat = state.seats.find((s) => s.seat_id === state.user_seat_id);
    if (!mySeat) return;
    tournament.submitScore({
      net_coins: (mySeat.payout || 0) - (mySeat.bet || 0),
      result: mySeat.result,
      final_value: mySeat.value,
    });
  }, [state?.phase, state?.seats, state?.user_seat_id, tournament]);

  const placeBet = async () => {
    if (!state) return;
    setSubmitting(true);
    try {
      const res = await authFetch(`${API}/api/blackjack-universal/bet`, {
        method: 'POST',
        body: JSON.stringify({ game_id: state.game_id, bet: betAmount }),
      });
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.detail || 'Bet failed');
      }
      const data = await res.json();
      setState(data);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const doAction = async (act: 'hit' | 'stand' | 'double') => {
    if (!state || submitting) return;
    setSubmitting(true);
    try {
      const res = await authFetch(`${API}/api/blackjack-universal/action`, {
        method: 'POST',
        body: JSON.stringify({ game_id: state.game_id, action: act }),
      });
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.detail || 'Action failed');
      }
      const data = await res.json();
      setState(data);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const nextRound = async () => {
    if (!state) return;
    try {
      const res = await authFetch(`${API}/api/blackjack-universal/next-round/${state.game_id}`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      if (res.ok) setState(await res.json());
    } catch (e: any) { toast.error(e.message); }
  };

  if (loading || !state) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-purple-950 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" /> {/* audit:allow-animate */}
          <p className="text-cyan-300">Shuffling shoe...</p>
        </div>
      </div>
    );
  }

  const userSeat = state.seats.find((s) => s.seat_id === state.user_seat_id);
  const isUserTurn = state.phase === 'playing' && state.seats[state.active_seat]?.seat_id === state.user_seat_id;
  const canDouble = isUserTurn && userSeat && userSeat.hand.length === 2;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-purple-950 text-white relative overflow-hidden pb-8" data-testid="bj-universal-room">
      {tournament.active && <TournamentBanner {...tournament} />}
      {/* Header */}
      <div className="flex items-center justify-between p-4 z-30">
        <Button
          data-testid="bj-back-btn"
          variant="ghost"
          onClick={() => navigate('/games')}
          className="text-white hover:bg-white/10"
        >
          <ArrowLeft className="w-5 h-5 mr-1" /> Back
        </Button>
        <div className="flex items-center gap-3 bg-black/40 backdrop-blur rounded-full px-5 py-2 border border-cyan-500/30">
          <span className="text-xs uppercase tracking-wide text-cyan-300">Blackjack Universal</span>
          <span className="text-xs px-2 py-0.5 bg-cyan-500/20 border border-cyan-400 rounded-full text-cyan-300">Multi-Seat</span>
        </div>
        <div className="text-xs bg-black/40 backdrop-blur rounded-full px-4 py-2" data-testid="bj-shoe-count">
          Shoe: {state.shoe_remaining}
        </div>
      </div>

      {/* Dealer */}
      <div className="text-center mb-6" data-testid="bj-dealer-area">
        <div className="inline-block bg-black/60 backdrop-blur border border-amber-400/40 rounded-xl px-6 py-3">
          <div className="text-xs uppercase text-amber-300 mb-2">Dealer NOVA {state.phase !== 'betting' && `• ${state.dealer.value}`}</div>
          <div className="flex gap-2 justify-center min-h-[80px]">
            {state.dealer.hand.length === 0 ? (
              <div className="text-slate-500 text-sm">waiting for bets...</div>
            ) : (
              state.dealer.hand.map((c, i) => <CardView key={i} card={c} />)
            )}
          </div>
          {state.dealer.is_blackjack && <div className="text-rose-400 font-bold mt-2">BLACKJACK!</div>}
        </div>
      </div>

      {/* Seats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 px-4 max-w-5xl mx-auto">
        {state.seats.map((seat, idx) => {
          const isActive = state.active_seat === idx && state.phase === 'playing';
          const isUser = seat.seat_id === state.user_seat_id;
          return (
            <div
              key={seat.seat_id}
              data-testid={`bj-seat-${idx}`}
              className={`bg-black/40 backdrop-blur border rounded-xl p-4 text-center ${
                isActive ? 'border-amber-400 ring-2 ring-amber-400/50 shadow-[0_0_20px_rgba(251,191,36,0.3)]' : 'border-white/20'
              } ${isUser ? 'bg-cyan-950/30' : ''}`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold">{seat.name}</span>
                <div className="flex items-center gap-1 text-xs">
                  {seat.bet > 0 && (
                    <span className="bg-amber-500/20 border border-amber-400 rounded-full px-2 py-0.5 text-amber-300">
                      ₵{seat.bet.toLocaleString()}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex gap-1 justify-center min-h-[80px]">
                {seat.hand.length === 0 ? (
                  <div className="text-slate-600 text-sm">—</div>
                ) : (
                  seat.hand.map((c, i) => <CardView key={i} card={c} />)
                )}
              </div>
              {seat.hand.length > 0 && (
                <div className="mt-2">
                  <div className={`text-lg font-bold ${seat.value > 21 ? 'text-rose-400' : 'text-cyan-300'}`}>
                    {seat.value}{seat.value > 21 ? ' BUST' : ''}
                  </div>
                  {seat.result && (
                    <div
                      className={`text-xs mt-1 font-bold ${
                        seat.result === 'win' || seat.result === 'blackjack'
                          ? 'text-emerald-400'
                          : seat.result === 'push'
                          ? 'text-amber-400'
                          : 'text-rose-400'
                      }`}
                    >
                      {seat.result.toUpperCase()} • +₵{seat.payout.toLocaleString()}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Actions */}
      <div className="mt-8 flex flex-col items-center gap-4">
        {state.phase === 'betting' && (
          <div className="bg-black/60 backdrop-blur border border-cyan-400/40 rounded-2xl p-6 max-w-md w-full mx-4" data-testid="bj-betting-ui">
            <h3 className="text-center text-lg font-bold mb-4">Select Bet (all seats match)</h3>
            <div className="grid grid-cols-5 gap-2 mb-4">
              {BET_CHIPS.map((chip) => (
                <button
                  key={chip}
                  data-testid={`bj-chip-${chip}`}
                  onClick={() => setBetAmount(chip)}
                  className={`aspect-square rounded-full font-bold text-xs transition ${
                    betAmount === chip
                      ? 'bg-gradient-to-br from-amber-400 to-amber-600 text-slate-900 scale-110 shadow-xl'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  ₵{chip >= 1000 ? `${chip / 1000}K` : chip}
                </button>
              ))}
            </div>
            <Button
              data-testid="bj-place-bet"
              onClick={placeBet}
              disabled={submitting}
              className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-bold"
            >
              {submitting ? 'Dealing...' : `Deal with ₵${betAmount.toLocaleString()} bet`}
            </Button>
          </div>
        )}

        {isUserTurn && (
          <div className="flex gap-3" data-testid="bj-actions">
            <Button
              data-testid="bj-hit-btn"
              onClick={() => doAction('hit')}
              disabled={submitting}
              className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold px-8"
            >
              Hit
            </Button>
            <Button
              data-testid="bj-stand-btn"
              onClick={() => doAction('stand')}
              disabled={submitting}
              className="bg-rose-500 hover:bg-rose-600 text-white font-bold px-8"
            >
              Stand
            </Button>
            {canDouble && (
              <Button
                data-testid="bj-double-btn"
                onClick={() => doAction('double')}
                disabled={submitting}
                className="bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold px-8"
              >
                Double
              </Button>
            )}
          </div>
        )}

        {state.phase === 'settled' && (
          <div className="flex gap-3" data-testid="bj-round-over">
            <Button
              data-testid="bj-next-round"
              onClick={nextRound}
              className="bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold px-8"
            >
              Next Round
            </Button>
            <Button
              data-testid="bj-exit-btn"
              onClick={() => navigate('/games')}
              variant="outline"
              className="border-white/30 text-white hover:bg-white/10 px-8"
            >
              Exit
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
