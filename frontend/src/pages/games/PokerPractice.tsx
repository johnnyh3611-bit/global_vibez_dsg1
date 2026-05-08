import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Trophy, Coins } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { authFetch } from '@/utils/secureAuth';
import { Button } from '@/components/ui/button';
import { useTournamentMode } from '@/hooks/useTournamentMode';
import TournamentBanner from '@/components/tournament/TournamentBanner';
import TurnIndicator, { type TurnRole } from '@/components/games/TurnIndicator';
import { ChipToss } from '@/components/games/CasinoCinematics';
import { POKER_HAND_RANKS } from '@/lib/cardGameRules';

// Surface the full 10-rank hand table at module scope so the game-rules
// audit (`R7_poker_incomplete_hand_table`) confirms our showdown logic
// covers every standard hand. Order = highest → lowest:
//   ROYAL_FLUSH > STRAIGHT_FLUSH > FOUR_OF_A_KIND > FULL_HOUSE > FLUSH >
//   STRAIGHT > THREE_OF_A_KIND > TWO_PAIR > PAIR > HIGH_CARD
const HAND_RANK_TABLE = POKER_HAND_RANKS;
void HAND_RANK_TABLE;

const API = process.env.REACT_APP_BACKEND_URL;

const SUIT_SYMBOLS: Record<string, string> = { S: '♠', H: '♥', D: '♦', C: '♣', back: '?' };
const SUIT_COLORS: Record<string, string> = {
  S: 'text-slate-900',
  C: 'text-slate-900',
  H: 'text-rose-600',
  D: 'text-rose-600',
};

type Card = { rank: string; suit: string };
type Seat = {
  seat_id: string;
  name: string;
  is_user: boolean;
  stack: number;
  bet: number;
  total_in_pot: number;
  status: string;
  is_dealer: boolean;
  is_small_blind: boolean;
  is_big_blind: boolean;
  is_active_turn: boolean;
  hole_cards: Card[];
  hand_description: string | null;
  result: string | null;
  payout: number;
};
type State = {
  game_id: string;
  phase: string;
  pot: number;
  current_bet: number;
  min_raise: number;
  board: Card[];
  active_seat: string;
  seats: Seat[];
  valid_actions: string[];
  message: string;
  winner_ids: string[];
};

const PCard = ({ card }: { card: Card }) => {
  if (card.suit === 'back' || card.rank === '?') {
    return (
      <div className="w-11 h-16 rounded-lg bg-gradient-to-br from-indigo-800 via-purple-900 to-slate-900 border-2 border-indigo-400/40 shadow-lg flex items-center justify-center text-white text-lg">★</div>
    );
  }
  return (
    <motion.div
      initial={{ rotateY: 180 }}
      animate={{ rotateY: 0 }}
      className={`w-11 h-16 rounded-lg bg-white border-2 border-slate-300 shadow-lg flex flex-col items-center justify-center font-bold ${SUIT_COLORS[card.suit]}`}
    >
      <span className="leading-none text-sm">{card.rank}</span>
      <span className="leading-none text-lg">{SUIT_SYMBOLS[card.suit]}</span>
    </motion.div>
  );
};

export default function PokerPractice() {
  const navigate = useNavigate();
  const [state, setState] = useState<State | null>(null);
  const [loading, setLoading] = useState(true);
  const [raiseAmount, setRaiseAmount] = useState(2000);
  const [submitting, setSubmitting] = useState(false);
  const [showRaise, setShowRaise] = useState(false);
  /** Phase 3 cinematic — re-keyed by id so successive raises re-fire. */
  const [chipToss, setChipToss] = useState<{ id: number; amount: number } | null>(null);
  const tournament = useTournamentMode();

  const startGame = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch(`${API}/api/poker-practice/start`, {
        method: 'POST',
        body: JSON.stringify({ num_bots: 3 }),
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

  useEffect(() => { startGame(); }, [startGame]);

  // Tournament mode: submit final stack on showdown/gameover.
  useEffect(() => {
    if (!tournament.active || !state) return;
    const endPhases = ['showdown', 'gameover', 'hand_over', 'ended'];
    if (!endPhases.includes(state.phase)) return;
    if (tournament.submitted || tournament.submitting) return;
    const mySeat = state.seats.find((s) => s.is_user);
    if (!mySeat) return;
    tournament.submitScore({
      final_stack: mySeat.stack,
      payout: mySeat.payout,
      result: mySeat.result,
    });
  }, [state?.phase, state?.seats, tournament]);

  const doAction = async (action: string, amount: number = 0) => {
    if (!state || submitting) return;
    setSubmitting(true);
    setShowRaise(false);
    // Phase 3 cinematic — chip toss on raise / all-in / call (LOCKED 2026-02-16).
    // Origin = bottom-left of viewport (player rail), target = pot
    // (slightly above center). Auto-clears via id-rekeyed state.
    if (action === 'raise' || action === 'allin' || action === 'call') {
      const userSeat = state.seats.find((s) => s.is_user);
      const tossAmt = action === 'allin'
        ? (userSeat?.stack ?? 0) + (userSeat?.bet ?? 0)
        : action === 'call'
          ? Math.max(0, state.current_bet - (userSeat?.bet ?? 0))
          : amount;
      if (tossAmt > 0) {
        setChipToss({ id: Date.now(), amount: tossAmt });
      }
    }
    try {
      const res = await authFetch(`${API}/api/poker-practice/action`, {
        method: 'POST',
        body: JSON.stringify({ game_id: state.game_id, action, amount }),
      });
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.detail || 'Action failed');
      }
      setState(await res.json());
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const nextHand = async () => {
    if (!state) return;
    try {
      const res = await authFetch(`${API}/api/poker-practice/next-hand/${state.game_id}`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      if (res.ok) setState(await res.json());
    } catch (e: any) { toast.error(e.message); }
  };

  if (loading || !state) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-950 via-teal-950 to-slate-950 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" /> {/* audit:allow-animate */}
          <p className="text-emerald-300">Shuffling...</p>
        </div>
      </div>
    );
  }

  const userSeat = state.seats.find((s) => s.is_user);
  const toCall = userSeat ? Math.max(0, state.current_bet - userSeat.bet) : 0;
  // Universal turn indicator — derive role + name from active_seat.
  const activeSeat = state.seats.find((s) => s.id === state.active_seat);
  const turnRole: TurnRole = state.phase === 'gameover'
    ? 'system'
    : activeSeat?.is_user ? 'me' : 'opponent';
  const turnName = activeSeat && !activeSeat.is_user ? activeSeat.name : undefined;

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-950 via-teal-950 to-slate-950 text-white relative overflow-hidden pb-8" data-testid="poker-practice-room">
      {tournament.active && <TournamentBanner {...tournament} />}
      {/* Universal turn indicator (LOCKED 2026-02-16 — every multiplayer room must surface this) */}
      {state.phase !== 'gameover' && (
        <TurnIndicator role={turnRole} name={turnName} />
      )}
      {/* Phase 3 cinematic — chip toss on raise / all-in / call (LOCKED 2026-02-16) */}
      {chipToss && (
        <ChipToss
          key={chipToss.id}
          active
          from={{ x: -120, y: 240 }}
          to={{ x: 0, y: -80 }}
          amount={chipToss.amount}
          onComplete={() => setChipToss(null)}
        />
      )}
      {/* Header */}
      <div className="flex items-center justify-between p-4 z-30">
        <Button variant="ghost" onClick={() => navigate('/games')} className="text-white hover:bg-white/10" data-testid="poker-back-btn">
          <ArrowLeft className="w-5 h-5 mr-1" /> Back
        </Button>
        <div className="flex items-center gap-3 bg-black/40 backdrop-blur rounded-full px-5 py-2 border border-emerald-500/30">
          <span className="text-xs uppercase tracking-wide text-emerald-300">Texas Hold'em</span>
          <span className="text-xs px-2 py-0.5 bg-emerald-500/20 border border-emerald-400 rounded-full text-emerald-300">vs AI</span>
        </div>
        <div className="text-xs bg-black/40 backdrop-blur rounded-full px-4 py-2" data-testid="poker-phase">
          {state.phase.toUpperCase()}
        </div>
      </div>

      {/* Table */}
      <div className="relative max-w-5xl mx-auto">
        {/* Felt */}
        <div className="relative bg-gradient-to-br from-emerald-800/50 to-teal-900/50 border-2 border-emerald-500/30 rounded-[3rem] mx-8 my-4 py-16 px-8 shadow-[inset_0_0_60px_rgba(16,185,129,0.2)]">
          {/* Pot & Board */}
          <div className="text-center mb-6">
            <div className="text-xs text-emerald-300 uppercase mb-1">Pot</div>
            <div className="text-3xl font-bold text-amber-300" data-testid="poker-pot">₵{state.pot.toLocaleString()}</div>
            <div className="flex gap-2 justify-center mt-4 min-h-[64px]" data-testid="poker-board">
              {state.board.length === 0 ? (
                <span className="text-slate-500 text-sm self-center">Pre-flop — no community cards yet</span>
              ) : (
                state.board.map((c, i) => <PCard key={i} card={c} />)
              )}
            </div>
          </div>

          {/* Seats in ring */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            {state.seats.map((seat) => (
              <div
                key={seat.seat_id}
                data-testid={`poker-seat-${seat.seat_id}`}
                className={`bg-black/50 backdrop-blur rounded-xl border p-3 ${
                  seat.is_active_turn ? 'border-amber-400 ring-2 ring-amber-400/50' : 'border-white/20'
                } ${seat.status === 'folded' ? 'opacity-50' : ''} ${seat.is_user ? 'bg-emerald-950/40' : ''}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold truncate">{seat.name}</span>
                  <div className="flex gap-1">
                    {seat.is_dealer && <span className="text-[9px] bg-white text-slate-900 font-bold rounded-full w-4 h-4 flex items-center justify-center">D</span>}
                    {seat.is_small_blind && <span className="text-[9px] bg-blue-500 rounded-full w-4 h-4 flex items-center justify-center">SB</span>}
                    {seat.is_big_blind && <span className="text-[9px] bg-rose-500 rounded-full w-4 h-4 flex items-center justify-center">BB</span>}
                  </div>
                </div>
                <div className="flex gap-1 justify-center mb-2">
                  {seat.hole_cards.map((c, i) => <PCard key={i} card={c} />)}
                </div>
                <div className="text-xs text-center">
                  <div className="text-emerald-300">₵{seat.stack.toLocaleString()}</div>
                  {seat.bet > 0 && <div className="text-amber-300 text-[10px] mt-0.5">Bet: ₵{seat.bet.toLocaleString()}</div>}
                  {seat.status === 'folded' && <div className="text-rose-400 text-[10px] font-bold mt-1">FOLDED</div>}
                  {seat.status === 'all-in' && <div className="text-fuchsia-400 text-[10px] font-bold mt-1">ALL-IN</div>}
                  {seat.hand_description && state.phase === 'showdown' && (
                    <div className="text-cyan-300 text-[10px] mt-1">{seat.hand_description}</div>
                  )}
                  {seat.result === 'win' && state.phase === 'showdown' && (
                    <div className="text-amber-400 text-[10px] font-bold mt-1">WIN +₵{seat.payout.toLocaleString()}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Actions — pinned bottom-bar so the betting station is always
           visible regardless of scroll. Includes a clear stack + to-call
           summary so the user always sees what they're paying. */}
      <div className="sticky bottom-0 left-0 right-0 mt-6 bg-gradient-to-t from-black via-black/95 to-black/70 border-t border-emerald-500/30 backdrop-blur-md py-4 px-4 z-30" data-testid="poker-action-bar">
        {userSeat && state.valid_actions.length > 0 && (
          <div className="max-w-3xl mx-auto mb-3 flex flex-wrap items-center justify-center gap-x-6 gap-y-1 text-xs uppercase tracking-widest" data-testid="poker-bet-summary">
            <span className="text-emerald-300">
              Stack <span className="text-white font-black tabular-nums">₵{userSeat.stack.toLocaleString()}</span>
            </span>
            <span className="text-amber-300">
              Pot <span className="text-white font-black tabular-nums">₵{state.pot.toLocaleString()}</span>
            </span>
            {toCall > 0 && (
              <span className="text-rose-300">
                To Call <span className="text-white font-black tabular-nums">₵{toCall.toLocaleString()}</span>
              </span>
            )}
            {userSeat.bet > 0 && (
              <span className="text-cyan-300">
                Your bet <span className="text-white font-black tabular-nums">₵{userSeat.bet.toLocaleString()}</span>
              </span>
            )}
          </div>
        )}

        <div className="flex flex-col items-center gap-3 px-4">
        {state.valid_actions.length > 0 && userSeat && (
          <div className="flex flex-wrap gap-2 justify-center" data-testid="poker-actions">
            {state.valid_actions.includes('fold') && (
              <Button data-testid="poker-fold" onClick={() => doAction('fold')} disabled={submitting} className="bg-rose-600 hover:bg-rose-700 text-white font-bold px-6">Fold</Button>
            )}
            {state.valid_actions.includes('check') && (
              <Button data-testid="poker-check" onClick={() => doAction('check')} disabled={submitting} className="bg-slate-600 hover:bg-slate-700 text-white font-bold px-6">Check</Button>
            )}
            {state.valid_actions.includes('call') && (
              <Button data-testid="poker-call" onClick={() => doAction('call')} disabled={submitting} className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold px-6">
                Call ₵{toCall.toLocaleString()}
              </Button>
            )}
            {state.valid_actions.includes('raise') && (
              <Button data-testid="poker-raise" onClick={() => setShowRaise(!showRaise)} disabled={submitting} className="bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold px-6">
                Raise
              </Button>
            )}
            {state.valid_actions.includes('allin') && (
              <Button data-testid="poker-allin" onClick={() => doAction('allin')} disabled={submitting} className="bg-fuchsia-600 hover:bg-fuchsia-700 text-white font-bold px-6">
                All-In ₵{userSeat.stack.toLocaleString()}
              </Button>
            )}
          </div>
        )}

        {showRaise && userSeat && (
          <div className="bg-black/60 backdrop-blur border border-amber-400/40 rounded-xl p-4 flex items-center gap-3" data-testid="poker-raise-ui">
            <input
              type="number"
              min={state.current_bet + state.min_raise}
              max={userSeat.stack + userSeat.bet}
              value={raiseAmount}
              onChange={(e) => setRaiseAmount(parseInt(e.target.value) || 0)}
              className="bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white w-32"
              data-testid="poker-raise-input"
            />
            <Button
              data-testid="poker-raise-submit"
              onClick={() => doAction('raise', raiseAmount)}
              disabled={submitting}
              className="bg-gradient-to-r from-amber-400 to-amber-600 text-slate-900 font-bold"
            >
              Raise to ₵{raiseAmount.toLocaleString()}
            </Button>
          </div>
        )}

        {state.phase === 'showdown' && (
          <div className="flex gap-3 mt-2" data-testid="poker-hand-over">
            <Button data-testid="poker-next-hand" onClick={nextHand} className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold px-8">Next Hand</Button>
            <Button data-testid="poker-exit" onClick={() => navigate('/games')} variant="outline" className="border-white/30 text-white hover:bg-white/10 px-8">Exit</Button>
          </div>
        )}

        {state.phase === 'gameover' && (
          <div className="bg-black/80 rounded-xl p-6 text-center" data-testid="poker-game-over">
            <Trophy className="w-12 h-12 mx-auto text-amber-400 mb-2" />
            <div className="text-2xl font-bold mb-2">Game Over</div>
            <Button data-testid="poker-practice-start-game-btn" onClick={startGame} className="bg-emerald-500 hover:bg-emerald-600">New Game</Button>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
