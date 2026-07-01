import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dices, X, Zap } from 'lucide-react';

export interface PlayerOddRow {
  user_id: string;
  player_name: string;
  odds: number;
}

interface BleacherSideBetPanelProps {
  open: boolean;
  defaultTarget?: PlayerOddRow | null;
  players: PlayerOddRow[];
  outcomeOdds: number;
  busy?: boolean;
  onCancel: () => void;
  onSubmit: (payload: {
    amount: number;
    outcome: 'player_wins' | 'roll_six_five_four';
    target_user_id: string | null;
  }) => Promise<void> | void;
}

const PRESETS = [500, 2_500, 10_000, 50_000];

/**
 * Floating panel where bleacher spectators place side bets. Two outcomes:
 *   1. Specific player wins the tournament    (dynamic odds)
 *   2. Next round contains an immediate 6-5-4 (fixed outcome odds)
 */
export const BleacherSideBetPanel: React.FC<BleacherSideBetPanelProps> = ({
  open,
  defaultTarget = null,
  players,
  outcomeOdds,
  busy,
  onCancel,
  onSubmit,
}) => {
  const [tab, setTab] = useState<'player_wins' | 'roll_six_five_four'>(
    defaultTarget ? 'player_wins' : 'player_wins',
  );
  const [target, setTarget] = useState<PlayerOddRow | null>(defaultTarget ?? players[0] ?? null);
  const [amount, setAmount] = useState<number>(500);

  React.useEffect(() => {
    if (defaultTarget) setTarget(defaultTarget);
  }, [defaultTarget]);

  const displayOdds = tab === 'player_wins' ? (target?.odds ?? 0) : outcomeOdds;
  const potential = useMemo(() => Math.max(0, Math.round(amount * displayOdds)), [amount, displayOdds]);

  const submit = async () => {
    if (amount <= 0) return;
    await onSubmit({
      amount,
      outcome: tab,
      target_user_id: tab === 'player_wins' ? target?.user_id ?? null : null,
    });
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-4"
          onClick={onCancel}
          data-testid="vibe654-sidebet-panel"
        >
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl bg-gradient-to-br from-fuchsia-800 via-indigo-900 to-slate-900 rounded-2xl p-6 text-white shadow-2xl border border-fuchsia-400/30"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Zap className="w-6 h-6 text-fuchsia-300" />
                <h3 className="text-xl font-black tracking-wide">Bleacher Side Bet</h3>
              </div>
              <button
                type="button"
                onClick={onCancel}
                className="opacity-70 hover:opacity-100"
                data-testid="vibe654-sidebet-cancel"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* tabs */}
            <div className="flex gap-2 mb-4">
              <button
                type="button"
                onClick={() => setTab('player_wins')}
                data-testid="vibe654-sidebet-tab-player"
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-bold transition ${
                  tab === 'player_wins'
                    ? 'bg-fuchsia-500 text-white shadow'
                    : 'bg-black/40 hover:bg-black/60'
                }`}
              >
                Player Wins
              </button>
              <button
                type="button"
                onClick={() => setTab('roll_six_five_four')}
                data-testid="vibe654-sidebet-tab-roll"
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-bold transition flex items-center justify-center gap-1 ${
                  tab === 'roll_six_five_four'
                    ? 'bg-fuchsia-500 text-white shadow'
                    : 'bg-black/40 hover:bg-black/60'
                }`}
              >
                <Dices className="w-4 h-4" /> Next Roll 6-5-4
              </button>
            </div>

            {tab === 'player_wins' && (
              <div className="mb-4 max-h-56 overflow-y-auto rounded-lg border border-white/10 divide-y divide-white/5">
                {players.length === 0 && (
                  <div className="p-4 text-center text-white/60 text-sm">No active players to bet on.</div>
                )}
                {players.map((p) => (
                  <button
                    type="button"
                    key={`sbrow-${p.user_id}`}
                    onClick={() => setTarget(p)}
                    data-testid={`vibe654-sidebet-player-${p.user_id}`}
                    className={`w-full flex items-center justify-between px-3 py-2 transition ${
                      target?.user_id === p.user_id
                        ? 'bg-fuchsia-500/30'
                        : 'hover:bg-white/5'
                    }`}
                  >
                    <span className="font-bold">{p.player_name}</span>
                    <span className="text-fuchsia-300 font-mono">{p.odds.toFixed(2)}x</span>
                  </button>
                ))}
              </div>
            )}

            {tab === 'roll_six_five_four' && (
              <div className="mb-4 p-4 rounded-lg border border-fuchsia-400/30 bg-black/40 text-sm">
                Pays <span className="font-black text-fuchsia-300">{outcomeOdds.toFixed(2)}x</span> if
                any player's first roll this round contains a 6, 5, AND 4 simultaneously (One &amp; Done hit).
              </div>
            )}

            <div className="grid grid-cols-4 gap-2 mb-3">
              {PRESETS.map((v) => (
                <button
                  type="button"
                  key={`sbp-${v}`}
                  onClick={() => setAmount(v)}
                  data-testid={`vibe654-sidebet-preset-${v}`}
                  className={`px-2 py-2 rounded-lg text-sm font-bold transition ${
                    amount === v ? 'bg-white text-black shadow' : 'bg-black/40 hover:bg-black/60'
                  }`}
                >
                  ₵{v >= 1000 ? `${v / 1000}k` : v}
                </button>
              ))}
            </div>

            <input
              type="number"
              min={1}
              max={500_000}
              step={1}
              value={amount}
              onChange={(e) => setAmount(Math.max(1, parseInt(e.target.value || '0', 10) || 0))}
              data-testid="vibe654-sidebet-amount-input"
              className="w-full bg-black/50 border border-fuchsia-300/30 rounded-lg px-3 py-2 text-lg font-bold text-white focus:outline-none focus:border-fuchsia-200 mb-4"
            />

            <div className="flex items-center justify-between mb-4 text-sm">
              <div>
                Locked odds: <span className="font-mono text-fuchsia-300">{displayOdds.toFixed(2)}x</span>
              </div>
              <div>
                Potential: <span className="font-black text-emerald-300">₵{potential.toLocaleString()}</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onCancel}
                className="flex-1 px-4 py-3 rounded-lg bg-black/40 hover:bg-black/60 font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={busy || amount <= 0 || (tab === 'player_wins' && !target)}
                data-testid="vibe654-sidebet-place"
                className="flex-1 px-4 py-3 rounded-lg bg-fuchsia-500 hover:bg-fuchsia-400 font-black text-white disabled:opacity-50"
              >
                {busy ? 'Placing…' : `Place ₵${amount.toLocaleString()}`}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default BleacherSideBetPanel;
