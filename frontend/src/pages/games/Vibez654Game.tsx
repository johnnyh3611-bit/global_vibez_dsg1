/**
 * /games/vibez-654 — Florida-Flow Vibez 654 dice game.
 *
 * Rules: roll 3 dice; any 5 or 6 "calcifies" (locks) and drops out.
 * Player keeps rolling unlocked dice until they STAND on the remaining
 * values, OR until all 3 calcify (score=0).
 *
 * Backend: /api/vibez-654/{start,roll,stand,state,leaderboard}
 */
import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Dice5, Dice6, Loader2, ArrowLeft, Crown, Trophy, Lock } from "lucide-react";
import { authFetch } from "@/utils/secureAuth";
import { PremiumDice } from "@/components/games/vibedice654/PremiumDice";
import TurnIndicator from "@/components/games/TurnIndicator";

const API = process.env.REACT_APP_BACKEND_URL;

type Game = {
  game_id: string;
  bet: number;
  locked_dice: number[];
  unlocked_dice: number[];
  rolls: number;
  status: "active" | "ended";
  score: number;
  payout?: number;
  last_roll?: { roll_no: number; dice: number[]; locked_now: number[] } | null;
};

/**
 * Vibez 654 die — wraps the canonical crimson-pip <PremiumDice> with the
 * AAA calcified amber-lock state (LOCKED 2026-02-16 per design_guidelines.json).
 */
const Die = ({ value, locked }: { value: number; locked?: boolean }) => (
  <PremiumDice value={value} rolling={false} isCalcified={!!locked} />
);

export default function Vibez654Game() {
  const navigate = useNavigate();
  const [game, setGame] = useState<Game | null>(null);
  const [bet, setBet] = useState(50);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [leaderboard, setLeaderboard] = useState<Array<{ user_id: string; score: number; game_id: string }>>([]);

  const fetchLeaderboard = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/vibez-654/leaderboard`);
      if (r.ok) {
        const d = await r.json();
        setLeaderboard(d.rows || []);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  const start = async () => {
    setBusy(true); setError(null);
    try {
      const r = await authFetch(`${API}/api/vibez-654/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bet }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.detail || `HTTP ${r.status}`);
      }
      setGame(await r.json());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Couldn't start");
    } finally { setBusy(false); }
  };

  const roll = async () => {
    if (!game) return;
    setBusy(true); setError(null);
    try {
      const r = await authFetch(`${API}/api/vibez-654/roll`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ game_id: game.game_id }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.detail || `HTTP ${r.status}`);
      }
      const next = await r.json();
      setGame(next);
      if (next.status === "ended") fetchLeaderboard();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Roll failed");
    } finally { setBusy(false); }
  };

  const stand = async () => {
    if (!game) return;
    setBusy(true); setError(null);
    try {
      const r = await authFetch(`${API}/api/vibez-654/stand`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ game_id: game.game_id }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.detail || `HTTP ${r.status}`);
      }
      setGame(await r.json());
      fetchLeaderboard();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Stand failed");
    } finally { setBusy(false); }
  };

  const reset = () => { setGame(null); setError(null); };

  return (
    <div className="min-h-screen bg-[#050507] text-cyan-100 relative overflow-hidden font-mono">
      <div
        className="absolute inset-0 opacity-25 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(34,211,238,0.18) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.18) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(34,211,238,0.10),transparent_55%)] pointer-events-none" />

      <header className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-cyan-500/15 backdrop-blur-md">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-cyan-300 hover:text-cyan-100 text-sm"
          data-testid="v654-back"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <h1 className="text-xl tracking-[0.3em] uppercase text-cyan-300 flex items-center gap-3">
          <Dice6 className="w-5 h-5 text-amber-400" />
          Vibez 654 · Florida Flow
        </h1>
        <div className="text-[10px] uppercase tracking-widest text-cyan-500">
          Calcify on 5 or 6
        </div>
      </header>

      <main className="relative z-10 max-w-3xl mx-auto px-4 py-10">
        <div className="glass-panel p-6">
          {!game && (
            <div className="text-center" data-testid="v654-start-screen">
              <Dice5 className="w-16 h-16 text-cyan-300 mx-auto" />
              <h2 className="text-3xl font-black text-white mt-4">
                Roll · Calcify · Stand
              </h2>
              <p className="text-cyan-400/80 text-sm mt-3 max-w-md mx-auto leading-relaxed">
                Three dice. Any <strong className="neon-text">5</strong> or
                {" "}<strong className="neon-text">6</strong> locks forever.
                Stand on what's left. Highest non-zero score wins.
              </p>

              <div className="mt-6 flex items-center justify-center gap-2">
                <label className="text-[10px] uppercase tracking-widest text-cyan-500">
                  Bet (₵)
                </label>
                <input
                  type="number"
                  min={0}
                  max={5000}
                  value={bet}
                  onChange={(e) => setBet(parseInt(e.target.value || "0", 10))}
                  className="w-24 px-3 py-1 bg-black/60 border border-cyan-500/40 rounded-full text-cyan-200 text-center"
                  data-testid="v654-bet-input"
                />
              </div>

              <button
                onClick={start}
                disabled={busy}
                className="mt-6 px-8 py-3 rounded-full bg-gradient-to-r from-cyan-300 to-fuchsia-400 text-black font-black uppercase tracking-widest text-sm flex items-center gap-2 mx-auto disabled:opacity-50"
                data-testid="v654-start"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Dice5 className="w-4 h-4" />}
                Start Round
              </button>
            </div>
          )}

          {game && (
            <div data-testid="v654-game-active">
              {/* Universal turn indicator (LOCKED 2026-02-16 — every multiplayer room) */}
              {game.status === "active" && (
                <TurnIndicator role="me" customLabel="YOUR ROLL" />
              )}

              {/* Sticky Stat Bar (15vh zone — design_guidelines.json) */}
              <div
                data-testid="v654-stat-bar"
                className="grid grid-cols-3 gap-3 mb-6 sticky top-0 bg-black/60 backdrop-blur-md py-3 -mx-6 px-6 border-b border-white/10 z-20"
              >
                <div className="rounded-lg bg-cyan-500/10 border border-cyan-500/30 p-3 text-center" data-testid="v654-stat-round">
                  <p className="text-[10px] uppercase tracking-widest text-cyan-300/70">Round</p>
                  <p className="text-2xl font-black text-white tabular-nums" data-testid="v654-round">#{game.rolls + 1}</p>
                </div>
                <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3 text-center" data-testid="v654-stat-bet">
                  <p className="text-[10px] uppercase tracking-widest text-amber-300/80">Bet</p>
                  <p className="text-2xl font-black text-amber-200 tabular-nums" data-testid="v654-bet">₵{game.bet}</p>
                </div>
                <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-3 text-center" data-testid="v654-stat-score">
                  <p className="text-[10px] uppercase tracking-widest text-emerald-300/80">
                    {game.status === "ended" ? "Final" : "Live Score"}
                  </p>
                  <p className="text-2xl font-black text-emerald-200 tabular-nums" data-testid="v654-current-score">
                    {game.unlocked_dice.reduce((a, b) => a + b, 0)}
                  </p>
                </div>
              </div>

              {/* Dice Arena (55vh zone — radial #1E40AF glow over #0A0A0F) */}
              <div
                data-testid="v654-dice-arena"
                className="relative rounded-2xl border border-emerald-700/30 p-6 mb-6 min-h-[300px] overflow-hidden"
                style={{
                  background:
                    'radial-gradient(circle at center, rgba(30,64,175,0.12) 0%, rgba(15,23,42,0.4) 40%, rgba(0,0,0,0.6) 100%)',
                }}
              >
                {/* Calcified tray — top */}
                <div className="mb-5 min-h-[88px]">
                  <p className="text-[10px] uppercase tracking-widest text-amber-400 mb-3 flex items-center gap-2">
                    <Lock className="w-3 h-3" /> Calcified ·{' '}
                    <span data-testid="v654-calcified-count">{game.locked_dice.length}</span>
                  </p>
                  {game.locked_dice.length > 0 ? (
                    <div className="flex gap-3 flex-wrap" data-testid="v654-locked">
                      {game.locked_dice.map((v, i) => (
                        <div key={`l${i}`} data-testid={`v654-dice-${i}-calcified`}>
                          <Die value={v} locked />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-amber-400/40 text-xs italic">No 5s or 6s yet</p>
                  )}
                </div>

                {/* Live dice — bottom */}
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-cyan-400 mb-3">
                    Live dice ·{' '}
                    <span data-testid="v654-live-count">{game.unlocked_dice.length}</span>
                  </p>
                  {game.unlocked_dice.length > 0 ? (
                    <div className="flex gap-3 flex-wrap" data-testid="v654-live">
                      <AnimatePresence mode="popLayout">
                        {game.unlocked_dice.map((v, i) => (
                          <motion.div
                            key={`u${i}-${v}-${game.rolls}`}
                            data-testid={`v654-dice-${i}-live`}
                            initial={{ rotate: -180, scale: 0.4, opacity: 0, y: -40 }}
                            animate={{ rotate: 0, scale: 1, opacity: 1, y: 0 }}
                            transition={{ type: "spring", stiffness: 220, damping: 16, delay: i * 0.06 }}
                          >
                            <Die value={v} />
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  ) : (
                    <div className="text-center py-6 text-cyan-300/50 text-xs uppercase tracking-widest">
                      {game.status === "ended" ? "All calcified — round over" : "Tap Roll to throw"}
                    </div>
                  )}
                </div>
              </div>

              {error && (
                <p className="text-[#FF8A1F] text-xs mb-4" data-testid="v654-error">{error}</p>
              )}

              {/* Control Deck (30vh zone — main = gold Roll, secondary = teal Stand) */}
              {game.status === "active" && (
                <div
                  data-testid="v654-control-deck"
                  className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 pb-safe"
                >
                  <button
                    onClick={roll}
                    disabled={busy}
                    data-testid="v654-btn-roll"
                    className="sm:col-span-2 px-5 py-5 rounded-xl bg-[#D4AF37] hover:bg-[#E5C04A] text-black font-black uppercase tracking-widest text-sm disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-[#D4AF37]/30 transition-transform hover:scale-[1.02] active:scale-95"
                  >
                    {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Dice6 className="w-5 h-5" />}
                    Roll {game.locked_dice.length === 0 ? 3 : 3 - game.locked_dice.length} dice
                  </button>
                  <button
                    onClick={stand}
                    disabled={busy || game.unlocked_dice.length === 0}
                    data-testid="v654-btn-stand"
                    className="px-5 py-5 rounded-xl bg-transparent border-2 border-[#00E5C7] text-[#00E5C7] hover:bg-[#00E5C7]/10 font-black uppercase tracking-widest text-sm disabled:opacity-30 disabled:border-white/10 disabled:text-white/30 transition-colors"
                  >
                    Stand on {game.unlocked_dice.reduce((a, b) => a + b, 0)}
                  </button>
                </div>
              )}

              {game.status === "ended" && (
                <motion.div
                  initial={{ y: 50, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 180, damping: 18 }}
                  data-testid="v654-outcome-modal"
                  className="mt-4 text-center bg-black/80 backdrop-blur-xl border border-[#D4AF37]/30 rounded-2xl p-6"
                >
                  <Trophy className={`w-16 h-16 mx-auto ${game.score > 0 ? "text-[#D4AF37]" : "text-rose-400"}`} />
                  <p className="text-2xl font-black text-white mt-2" data-testid="v654-outcome">
                    {game.score > 0 ? `Stood on ${game.score}` : "All calcified"}
                  </p>
                  {game.payout && game.payout > 0 && (
                    <p className="text-[#D4AF37] text-base font-black mt-1 tabular-nums">
                      +₵{game.payout} payout
                    </p>
                  )}
                  <button
                    onClick={reset}
                    data-testid="v654-btn-play-again"
                    className="mt-5 px-8 py-3 rounded-full bg-[#D4AF37] hover:bg-[#E5C04A] text-black text-xs font-black uppercase tracking-widest transition-colors"
                  >
                    Roll again
                  </button>
                </motion.div>
              )}
            </div>
          )}
        </div>

        {/* Leaderboard */}
        {leaderboard.length > 0 && (
          <div className="glass-panel p-5 mt-6" data-testid="v654-leaderboard">
            <h3 className="text-sm uppercase tracking-widest text-amber-300 flex items-center gap-2">
              <Crown className="w-4 h-4" /> 24h Leaderboard
            </h3>
            <ol className="mt-3 space-y-1.5">
              {leaderboard.map((row, i) => (
                <li
                  key={row.game_id}
                  className="flex items-center justify-between text-xs"
                >
                  <span className="font-mono text-cyan-400/80">
                    #{i + 1} · {row.user_id.slice(0, 10)}
                  </span>
                  <span className="font-mono text-white font-bold">
                    {row.score}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </main>
    </div>
  );
}
