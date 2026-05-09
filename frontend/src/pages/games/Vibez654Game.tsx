/**
 * /vibez-654 — Vibez 654 dice game (single-player vs AI · 5-dice classic).
 *
 * OFFICIAL RULES (matches /api/vibez-654/* backend):
 *   • Roll up to 5 dice, max 3 rolls.
 *   • Sequential qualifier: lock a 6, then a 5, then a 4 — in that order.
 *   • Once 6-5-4 all locked, the 2 leftover dice = your POINT.
 *   • Higher point pays bigger (2 → 1.5×, 5-7 → 2×, 8-10 → 3×, 11-12 → 5×).
 *   • Fail to qualify in 3 rolls → BUST, stake lost.
 *
 * Backend: /api/vibez-654/{start,roll,stand,state,leaderboard}
 *
 * Founder bug fix 2026-05-09 — the previous implementation was the OLD
 * "Florida Flow" 3-dice variant which spoke a different protocol than
 * the live backend. Page rendered empty dice arrays + every button
 * felt broken. This rewrite is fully wired to the canonical 5-dice
 * 6→5→4 rules and follows accessibility guidance — NO flashing /
 * strobing animations (founder directive: photosensitive-safe).
 */
import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Dice5, Dice6, Loader2, ArrowLeft, Crown, Trophy, Lock, CheckCircle2, XCircle } from "lucide-react";
import { authFetch } from "@/utils/secureAuth";
import { PremiumDice } from "@/components/games/vibedice654/PremiumDice";

const API = process.env.REACT_APP_BACKEND_URL;

type Game = {
  game_id: string;
  user_id: string;
  bet: number;
  has_6: boolean;
  has_5: boolean;
  has_4: boolean;
  qualified: boolean;
  point_dice: number[];
  residual_dice?: number[];
  last_roll_dice: number[];
  rolls: number;
  rolls_remaining: number;
  status: "active" | "ended";
  score: number;
  payout?: number;
};

const STAKES = [50, 250, 500, 1_000, 5_000];

const QualifierBadge = ({ digit, locked }: { digit: number; locked: boolean }) => (
  <div
    data-testid={`v654-qualifier-${digit}-${locked ? "locked" : "open"}`}
    className={`w-12 h-12 rounded-full flex items-center justify-center font-black text-lg border-2 transition-colors ${
      locked
        ? "bg-amber-500/20 border-amber-400 text-amber-200"
        : "bg-white/5 border-white/15 text-white/40"
    }`}
  >
    {locked ? <Lock className="w-4 h-4" /> : digit}
  </div>
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
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchLeaderboard(); }, [fetchLeaderboard]);

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

  const diceInPlay: number[] = game
    ? (game.qualified ? (game.point_dice || []) : (game.residual_dice ?? game.last_roll_dice ?? []))
    : [];
  const pointTotal = (game?.point_dice || []).reduce((a, b) => a + b, 0);

  return (
    <div className="min-h-screen bg-[#050507] text-cyan-100 relative overflow-hidden font-mono">
      {/* Static grid backdrop — NO animation (photosensitive-safe). */}
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
        <h1 className="text-base md:text-xl tracking-[0.3em] uppercase text-cyan-300 flex items-center gap-3">
          <Dice6 className="w-5 h-5 text-amber-400" />
          Vibez 654
        </h1>
        <div className="text-[10px] uppercase tracking-widest text-cyan-500 hidden sm:block">
          5 Dice · 6 → 5 → 4
        </div>
      </header>

      <main className="relative z-10 max-w-3xl mx-auto px-4 py-8">
        <div className="rounded-2xl bg-black/60 border border-white/10 p-5 md:p-6 backdrop-blur-md">
          {!game && (
            <div className="text-center" data-testid="v654-start-screen">
              <Dice5 className="w-16 h-16 text-cyan-300 mx-auto" />
              <h2 className="text-2xl md:text-3xl font-black text-white mt-4">
                Roll · Qualify · Stand
              </h2>
              <p className="text-cyan-400/80 text-sm mt-3 max-w-md mx-auto leading-relaxed">
                Five dice. Lock a <strong className="text-amber-300">6</strong>, then{' '}
                <strong className="text-amber-300">5</strong>, then{' '}
                <strong className="text-amber-300">4</strong> — in that order. The two leftover
                dice are your <strong className="text-cyan-300">POINT</strong>.
                Higher point pays bigger. 3 rolls max — fail to qualify and you bust.
              </p>

              <div className="mt-6">
                <p className="text-[10px] uppercase tracking-widest text-cyan-500 mb-2">
                  Pick your stake (₵)
                </p>
                <div className="flex flex-wrap gap-2 justify-center" data-testid="v654-stake-row">
                  {STAKES.map((v) => (
                    <button
                      type="button"
                      key={v}
                      onClick={() => setBet(v)}
                      data-testid={`v654-stake-${v}`}
                      className={`px-4 py-2 rounded-full text-sm font-black transition ${
                        bet === v
                          ? "bg-amber-400 text-black shadow"
                          : "bg-white/5 text-white hover:bg-white/10 border border-white/10"
                      }`}
                    >
                      ₵{v.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={start}
                disabled={busy}
                className="mt-6 px-8 py-3 rounded-full bg-gradient-to-r from-cyan-300 to-fuchsia-400 text-black font-black uppercase tracking-widest text-sm flex items-center gap-2 mx-auto disabled:opacity-50"
                data-testid="v654-start"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Dice5 className="w-4 h-4" />}
                Ante In ₵{bet.toLocaleString()}
              </button>
            </div>
          )}

          {game && (
            <div data-testid="v654-game-active">
              {/* Stat row */}
              <div
                data-testid="v654-stat-bar"
                className="grid grid-cols-3 gap-3 mb-6"
              >
                <div className="rounded-lg bg-cyan-500/10 border border-cyan-500/30 p-3 text-center">
                  <p className="text-[10px] uppercase tracking-widest text-cyan-300/70">Rolls</p>
                  <p className="text-2xl font-black text-white tabular-nums" data-testid="v654-rolls">
                    {game.rolls}/3
                  </p>
                </div>
                <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3 text-center">
                  <p className="text-[10px] uppercase tracking-widest text-amber-300/80">Bet</p>
                  <p className="text-2xl font-black text-amber-200 tabular-nums" data-testid="v654-bet">
                    ₵{game.bet.toLocaleString()}
                  </p>
                </div>
                <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-3 text-center">
                  <p className="text-[10px] uppercase tracking-widest text-emerald-300/80">
                    {game.qualified ? "Point" : "Status"}
                  </p>
                  <p className="text-2xl font-black text-emerald-200 tabular-nums" data-testid="v654-point">
                    {game.qualified ? pointTotal : (game.status === "ended" ? "0" : "—")}
                  </p>
                </div>
              </div>

              {/* Qualifier ladder — 6 / 5 / 4 */}
              <div className="flex items-center justify-center gap-4 mb-5" data-testid="v654-qualifier-ladder">
                <QualifierBadge digit={6} locked={game.has_6} />
                <span className="text-cyan-500/70 text-sm">→</span>
                <QualifierBadge digit={5} locked={game.has_5} />
                <span className="text-cyan-500/70 text-sm">→</span>
                <QualifierBadge digit={4} locked={game.has_4} />
              </div>

              {/* Dice arena — only the dice still in play (post-peel) */}
              <div
                data-testid="v654-dice-arena"
                className="rounded-2xl border border-emerald-700/30 p-5 mb-5 min-h-[140px] flex items-center justify-center"
                style={{
                  background:
                    'radial-gradient(circle at center, rgba(30,64,175,0.12) 0%, rgba(15,23,42,0.4) 40%, rgba(0,0,0,0.6) 100%)',
                }}
              >
                {diceInPlay.length > 0 ? (
                  <div className="flex gap-3 flex-wrap justify-center" data-testid="v654-dice-tray">
                    {diceInPlay.map((v, i) => (
                      <div key={`die-${i}`} data-testid={`v654-die-${i}`}>
                        <PremiumDice value={v} rolling={false} isCalcified={false} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-cyan-300/50 text-xs uppercase tracking-widest">
                    Tap Roll to throw 5 dice
                  </div>
                )}
              </div>

              {error && (
                <p className="text-rose-300 text-xs mb-4 text-center" data-testid="v654-error">{error}</p>
              )}

              {/* Control deck */}
              {game.status === "active" && (
                <div
                  data-testid="v654-control-deck"
                  className="grid grid-cols-1 sm:grid-cols-2 gap-3"
                >
                  <button
                    onClick={roll}
                    disabled={busy || game.rolls_remaining <= 0}
                    data-testid="v654-btn-roll"
                    className="px-5 py-4 rounded-xl bg-[#D4AF37] hover:bg-[#E5C04A] text-black font-black uppercase tracking-widest text-sm disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-[#D4AF37]/30 transition-transform hover:scale-[1.02] active:scale-95"
                  >
                    {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Dice6 className="w-5 h-5" />}
                    {game.rolls === 0 ? "First Roll" : `Roll Again (${game.rolls_remaining} left)`}
                  </button>
                  <button
                    onClick={stand}
                    disabled={busy || !game.qualified}
                    data-testid="v654-btn-stand"
                    className="px-5 py-4 rounded-xl bg-transparent border-2 border-[#00E5C7] text-[#00E5C7] hover:bg-[#00E5C7]/10 font-black uppercase tracking-widest text-sm disabled:opacity-30 disabled:border-white/10 disabled:text-white/30 transition-colors"
                  >
                    {game.qualified ? `Stand on ${pointTotal}` : "Qualify first"}
                  </button>
                </div>
              )}

              {game.status === "ended" && (
                <div
                  data-testid="v654-outcome"
                  className="mt-4 text-center bg-black/80 backdrop-blur-xl border border-[#D4AF37]/30 rounded-2xl p-6"
                >
                  {game.score > 0 ? (
                    <CheckCircle2 className="w-14 h-14 mx-auto text-emerald-300" />
                  ) : (
                    <XCircle className="w-14 h-14 mx-auto text-rose-400" />
                  )}
                  <p className="text-2xl font-black text-white mt-2">
                    {game.score > 0 ? `Stood on ${game.score}` : "Bust"}
                  </p>
                  {game.payout && game.payout > 0 ? (
                    <p className="text-[#D4AF37] text-base font-black mt-1 tabular-nums" data-testid="v654-payout">
                      +₵{game.payout.toLocaleString()} payout
                    </p>
                  ) : (
                    <p className="text-rose-300/80 text-sm mt-1">Stake lost</p>
                  )}
                  <button
                    onClick={reset}
                    data-testid="v654-btn-play-again"
                    className="mt-5 px-8 py-3 rounded-full bg-[#D4AF37] hover:bg-[#E5C04A] text-black text-xs font-black uppercase tracking-widest transition-colors"
                  >
                    Play again
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Leaderboard */}
        {leaderboard.length > 0 && (
          <div className="rounded-2xl bg-black/60 border border-white/10 p-5 mt-6 backdrop-blur-md" data-testid="v654-leaderboard">
            <h3 className="text-sm uppercase tracking-widest text-amber-300 flex items-center gap-2">
              <Crown className="w-4 h-4" /> 24h Leaderboard
            </h3>
            <ol className="mt-3 space-y-1.5">
              {leaderboard.map((row, i) => (
                <li key={row.game_id} className="flex items-center justify-between text-xs">
                  <span className="font-mono text-cyan-400/80">
                    #{i + 1} · {row.user_id.slice(0, 10)}
                  </span>
                  <span className="font-mono text-white font-bold">{row.score}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {leaderboard.length === 0 && !game && (
          <div className="rounded-2xl bg-black/40 border border-white/5 p-4 mt-6 text-center text-cyan-400/40 text-xs uppercase tracking-widest">
            <Trophy className="w-5 h-5 mx-auto mb-1 opacity-40" />
            Be the first on the 24h leaderboard.
          </div>
        )}
      </main>
    </div>
  );
}
