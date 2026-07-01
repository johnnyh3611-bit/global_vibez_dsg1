import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dices, Sparkles, Brain, CheckCircle2, XCircle } from 'lucide-react';

import Coliseum from '../../components/vibe654/Coliseum';
import type { ColiseumSeat } from '../../components/vibe654/SeatOrb';
import SideDockDecision from '../../components/vibe654/SideDockDecision';
import VibeWinnerExplosion from '../../components/vibe654/VibeWinnerExplosion';
import RoomMenuBar from '../../components/games/RoomMenuBar';
import VibeDJOverlay from '@/components/VibeDJOverlay';
import { apiPost, apiGet, getCurrentUser } from '../../components/vibe654/api';

// ----- Backend payload shape (5-dice sequential 6-5-4) -----------------------
interface SoloGameState {
  game_id: string;
  user_id: string;
  bet: number;
  has_6: boolean;
  has_5: boolean;
  has_4: boolean;
  qualified: boolean;
  point_dice: number[];
  residual_dice?: number[];   // dice still IN PLAY after the peel (qualified or not)
  last_roll_dice: number[];
  rolls: number;
  rolls_remaining: number;
  status: 'active' | 'ended';
  score: number;
  payout?: number;
  auto_stand?: boolean;
}

// ----- Dice visual ----------------------------------------------------------
type DieState = 'idle' | 'rolling' | 'settled' | 'locked';

const DiceFace: React.FC<{
  value: number;
  state: DieState;
}> = ({ value, state }) => {
  const dots: Record<number, [number, number][]> = {
    1: [[50, 50]],
    2: [[25, 25], [75, 75]],
    3: [[25, 25], [50, 50], [75, 75]],
    4: [[25, 25], [25, 75], [75, 25], [75, 75]],
    5: [[25, 25], [25, 75], [50, 50], [75, 25], [75, 75]],
    6: [[25, 25], [25, 50], [25, 75], [75, 25], [75, 50], [75, 75]],
  };
  return (
    <motion.div
      animate={
        state === 'rolling'
          ? { rotate: [0, 90, 180, 270, 360], scale: [1, 1.15, 0.95, 1.1, 1] }
          : state === 'settled'
          ? { scale: [1.2, 1] }
          : { scale: 1 }
      }
      transition={
        state === 'rolling'
          ? { duration: 0.55, repeat: Infinity, ease: 'linear', type: 'tween' }
          : { duration: 0.35, ease: 'easeOut', type: 'tween' }
      }
      className="relative w-14 h-14 md:w-16 md:h-16 rounded-xl border-2 bg-gradient-to-br from-slate-100 to-slate-300 border-white shadow-2xl"
    >
      {dots[value]?.map((pos, i) => (
        <span
          key={`dot-${value}-${i}`}
          className="absolute w-2 h-2 rounded-full bg-slate-900"
          style={{ left: `${pos[0]}%`, top: `${pos[1]}%`, transform: 'translate(-50%, -50%)' }}
        />
      ))}
    </motion.div>
  );
};

const QualifierChip: React.FC<{ digit: 6 | 5 | 4; locked: boolean }> = ({ digit, locked }) => (
  <motion.div
    animate={locked ? { scale: [1, 1.25, 1] } : { scale: 1 }}
    transition={{ duration: 0.45, ease: 'easeOut', type: 'tween' }}
    className={`flex items-center justify-center w-10 h-10 rounded-full border-2 text-base font-black transition-all ${
      locked
        ? 'bg-amber-400 text-amber-950 border-amber-200 shadow-[0_0_20px_rgba(251,191,36,0.7)]'
        : 'bg-black/50 text-white/40 border-white/10'
    }`}
    data-testid={`vibe654-qualifier-${digit}${locked ? '-locked' : ''}`}
  >
    {digit}
  </motion.div>
);

/**
 * The 1vAI "High Roller" Solo Vault — OFFICIAL 5-dice 6-5-4 rules.
 *
 * Start with 5 dice, up to 3 rolls. Sequential 6 → 5 → 4 qualification; the
 * leftover 2 dice after qualifying are the player's POINT score. Between
 * rolls the player chooses Roll Again or Stand on the center pop-down.
 */
export default function VibeSoloHighRoller() {
  const { userId, userName } = getCurrentUser();

  const [game, setGame] = useState<SoloGameState | null>(null);
  const [bet, setBet] = useState<number>(1_000);
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [rolling, setRolling] = useState<boolean>(false);
  const [rollingDice, setRollingDice] = useState<number[]>([]);
  const [celebrated, setCelebrated] = useState<boolean>(false);
  const [wallet, setWallet] = useState<number | null>(null);
  const [rulesOpen, setRulesOpen] = useState<boolean>(false);
  const celebrationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rollTickerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Preload wallet balance.
  useEffect(() => {
    apiGet<{ user?: { credits_balance?: number; token_balance?: number } }>(`/api/auth/me`)
      .then((r) => {
        const u = r?.user ?? (r as unknown as { credits_balance?: number; token_balance?: number });
        const bal = (u?.token_balance ?? u?.credits_balance ?? null) as number | null;
        setWallet(bal);
      })
      .catch(() => {});
  }, []);

  // Auto-dismiss celebration after 4s.
  useEffect(() => {
    if (!celebrated) return;
    if (celebrationTimer.current) clearTimeout(celebrationTimer.current);
    celebrationTimer.current = setTimeout(() => setCelebrated(false), 4000);
    return () => {
      if (celebrationTimer.current) clearTimeout(celebrationTimer.current);
    };
  }, [celebrated]);

  // Cleanup rolling ticker on unmount.
  useEffect(() => {
    return () => {
      if (rollTickerRef.current) clearInterval(rollTickerRef.current);
    };
  }, []);

  // ----- Actions -----------------------------------------------------------
  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await apiPost<SoloGameState>('/api/vibez-654/start', { bet });
      setGame(res);
      setCelebrated(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unable to start game');
    } finally {
      setBusy(false);
    }
  };

  const playRollAnimation = (durationMs: number) => {
    setRolling(true);
    // Ticker: update rolling-dice random values every 90ms so the dice look
    // like they're physically cycling through faces.
    const numToShow = game?.qualified ? (game.point_dice?.length || 2) : 5 - [game?.has_6, game?.has_5, game?.has_4].filter(Boolean).length;
    setRollingDice(Array.from({ length: Math.max(numToShow, 2) }, () => Math.ceil(Math.random() * 6)));
    if (rollTickerRef.current) clearInterval(rollTickerRef.current);
    rollTickerRef.current = setInterval(() => {
      setRollingDice((prev) => prev.map(() => Math.ceil(Math.random() * 6)));
    }, 90);
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        if (rollTickerRef.current) {
          clearInterval(rollTickerRef.current);
          rollTickerRef.current = null;
        }
        setRolling(false);
        resolve();
      }, durationMs);
    });
  };

  const roll = async () => {
    if (!game) return;
    setBusy(true);
    setError(null);
    try {
      // Start the visible rolling animation FIRST.
      const animPromise = playRollAnimation(950);
      const res = await apiPost<SoloGameState>('/api/vibez-654/roll', { game_id: game.game_id });
      await animPromise;
      setGame(res);
      if (res.status === 'ended') {
        // Qualifying win celebration
        if (res.qualified && res.score > 0) setCelebrated(true);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Roll failed');
      setRolling(false);
    } finally {
      setBusy(false);
    }
  };

  const stand = async () => {
    if (!game) return;
    setBusy(true);
    setError(null);
    try {
      const res = await apiPost<SoloGameState>('/api/vibez-654/stand', { game_id: game.game_id });
      setGame(res);
      if (res.status === 'ended' && res.qualified && res.score > 0) {
        setCelebrated(true);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Stand failed');
    } finally {
      setBusy(false);
    }
  };

  // ----- Seats -------------------------------------------------------------
  const seats: ColiseumSeat[] = useMemo(
    () => [
      {
        user_id: userId,
        player_name: userName,
        status: 'active',
        score: game?.score ?? 0,
      },
      {
        user_id: 'ai_dealer_solo',
        player_name: 'Nova · AI Dealer',
        status: 'active',
        isAI: true,
      },
    ],
    [userId, userName, game?.score],
  );

  const activeSeatId = game?.status === 'active' ? userId : null;
  const canStand = !!game && game.status === 'active' && game.rolls > 0; // must roll at least once
  const decisionOpen = !!game && game.status === 'active' && !rolling;

  // Build the dice array to render.
  // Per official 6-5-4 rules, when a die rolls a 6/5/4 (in order) it is
  // REMOVED from the physical dice set. So the tray only ever shows the
  // dice the player is currently rolling — never the locked qualifiers.
  // Qualifier progress lives in the 3 chips above (6, 5, 4).
  type RenderDie = { value: number; state: DieState };
  const diceToRender: RenderDie[] = useMemo(() => {
    if (!game) return [];
    if (rolling) {
      // During the animation, show the jittering placeholder dice — count
      // matches the number of dice still in the physical set.
      return rollingDice.map((v) => ({ value: v, state: 'rolling' as DieState }));
    }
    // Post-roll static display — only the dice STILL IN PLAY.
    // Per official rules each qualifier is REMOVED from the physical
    // dice set once locked; the qualifier chips above are the source of
    // truth for which 6/5/4 the player has banked. Backend now exposes
    // `residual_dice` (post-peel) so the tray drops the just-locked die.
    const leftovers = game.qualified
      ? (game.point_dice || [])
      : (game.residual_dice ?? game.last_roll_dice ?? []);
    return leftovers.map((v) => ({ value: v, state: 'settled' as DieState }));
  }, [game, rolling, rollingDice]);

  // "Current roll" displayed on the pop-down = current point value if
  // qualified, else # qualifiers locked so far (0-3).
  const currentScore = game
    ? game.qualified
      ? (game.point_dice || []).reduce((a, b) => a + b, 0)
      : [game.has_6, game.has_5, game.has_4].filter(Boolean).length
    : 0;

  return (
    <div className="h-[100dvh] flex flex-col overflow-hidden bg-[radial-gradient(ellipse_at_top,_#2a1848_0%,_#0a0014_60%,_#000_100%)] text-white">
      <VibeDJOverlay roomId="vibe-solo-highroller" />
      {/* marble floor texture */}
      <div
        className="fixed inset-0 opacity-30 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(115deg, rgba(255,255,255,0.04) 0%, transparent 40%), radial-gradient(circle at 30% 60%, rgba(251,191,36,0.08), transparent 50%)',
        }}
        aria-hidden
      />

      <RoomMenuBar
        theme="vibesolo"
        title="High Roller · Solo Vault"
        subtitle="1vAI · 5 dice · 6 → 5 → 4 · Max 3 rolls"
        icon={<Brain className="w-4 h-4" />}
        backTo="/games"
        testIdSuffix="vibesolo"
        rightSlot={
          wallet !== null ? (
            <div className="flex flex-col items-end leading-tight">
              <span className="text-[9px] uppercase tracking-[0.3em] text-amber-300/80">
                Wallet
              </span>
              <span className="text-sm font-black text-amber-200">
                ₵{wallet.toLocaleString()}
              </span>
            </div>
          ) : null
        }
      />

      {/* MAIN — single-viewport play area. */}
      <main
        className="flex-1 min-h-0 relative flex flex-col items-center justify-center px-3 sm:px-4 py-2"
        data-testid="vibe654-solo-main"
      >
        <div className="w-full max-w-[440px] sm:max-w-[520px] mx-auto" style={{ maxHeight: 'calc(100vh - 220px)' }}>
          <Coliseum
            variant="solo"
            seats={seats}
            activeSeatId={activeSeatId}
            currentUserId={userId}
            centerContent={
              <div className="flex flex-col items-center gap-2">
                {game ? (
                  <>
                    <div className="flex gap-2 mb-1" data-testid="vibe654-qualifier-row">
                      <QualifierChip digit={6} locked={!!game.has_6} />
                      <QualifierChip digit={5} locked={!!game.has_5} />
                      <QualifierChip digit={4} locked={!!game.has_4} />
                    </div>
                    <div
                      className="flex gap-1.5 flex-wrap justify-center max-w-[220px]"
                      data-testid="vibe654-dice-tray"
                    >
                      {diceToRender.map((d, i) => (
                        <DiceFace key={`die-${i}`} value={d.value} state={d.state} />
                      ))}
                    </div>
                    <div className="text-[10px] uppercase tracking-[0.4em] text-amber-300/80 mt-1">
                      Rolls: {game.rolls}/3 · Remaining {game.rolls_remaining}
                    </div>
                    <div
                      className="text-xl md:text-2xl font-black text-white drop-shadow"
                      data-testid="vibe654-solo-score"
                    >
                      {game.qualified ? (
                        <>
                          POINT:{' '}
                          <span className="text-amber-300">
                            {(game.point_dice || []).reduce((a, b) => a + b, 0)}
                          </span>
                        </>
                      ) : (
                        <span className="text-white/80">Qualifying…</span>
                      )}
                    </div>
                    {game.status === 'ended' && (
                      <div
                        className={`text-sm font-bold flex items-center gap-1 ${
                          game.score > 0 ? 'text-emerald-300' : 'text-rose-300'
                        }`}
                        data-testid="vibe654-solo-result"
                      >
                        {game.score > 0 ? (
                          <CheckCircle2 className="w-4 h-4" />
                        ) : (
                          <XCircle className="w-4 h-4" />
                        )}
                        {game.score > 0
                          ? `Qualified ${game.score} · Payout ₵${(game.payout ?? 0).toLocaleString()}`
                          : game.qualified
                          ? 'Stood — point locked.'
                          : 'BUST — stake lost.'}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <Dices className="w-12 h-12 text-amber-300/80 mx-auto" />
                    <div className="text-[10px] uppercase tracking-[0.4em] text-white/60">
                      Ante in · Nova is ready
                    </div>
                    <div className="text-3xl font-black text-amber-200">
                      ₵{bet.toLocaleString()}
                    </div>
                  </>
                )}
              </div>
            }
          />
        </div>

        {/* compact rules pill — opens drawer on tap */}
        <button
          type="button"
          onClick={() => setRulesOpen((v) => !v)}
          className="mt-2 px-3 py-1 rounded-full text-[10px] uppercase tracking-[0.3em] text-fuchsia-200/80 border border-fuchsia-400/30 bg-black/40 hover:bg-fuchsia-500/15 backdrop-blur"
          data-testid="vibe654-solo-rules-toggle"
        >
          <Sparkles className="inline w-3 h-3 mr-1" /> {rulesOpen ? 'Hide rules' : 'How it works'}
        </button>

        <AnimatePresence>
          {rulesOpen && (
            <motion.div
              key="rules-drawer"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="mt-2 max-w-md w-full rounded-2xl bg-black/70 border border-white/10 p-3 text-xs text-white/75 leading-relaxed backdrop-blur-md"
              data-testid="vibe654-solo-rules-drawer"
            >
              Roll <span className="text-amber-300 font-bold">5 dice</span>, up to{' '}
              <span className="text-amber-300 font-bold">3 rolls</span>. Lock a{' '}
              <span className="text-amber-300 font-bold">6</span>, then{' '}
              <span className="text-amber-300 font-bold">5</span>, then{' '}
              <span className="text-amber-300 font-bold">4</span> — in order. Two leftover dice =
              your POINT. Higher point pays more (2 = 1.5×, 5-7 = 2×, 8-10 = 3×, 11-12 = 5×).
              Fail in 3 rolls → <span className="text-rose-300 font-bold">BUST</span>.
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* BOTTOM — compact stake bar (only when no game). SideDockDecision
          takes over once a game is active. */}
      {!game || game.status !== 'active' ? (
        <div
          className="shrink-0 px-3 sm:px-4 pb-[max(env(safe-area-inset-bottom),12px)] pt-2 bg-gradient-to-t from-black via-black/95 to-black/60 backdrop-blur border-t border-amber-400/20"
          data-testid="vibe654-solo-stake-bar"
        >
          <div className="max-w-2xl mx-auto flex items-center gap-2 sm:gap-3">
            <div className="flex-1 flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
              {[500, 1_000, 5_000, 25_000, 100_000, 500_000].map((v) => (
                <button
                  type="button"
                  key={`stake-${v}`}
                  onClick={() => setBet(v)}
                  data-testid={`vibe654-solo-stake-${v}`}
                  className={`shrink-0 px-2.5 py-1.5 rounded-lg text-xs font-bold transition ${
                    bet === v
                      ? 'bg-amber-400 text-black shadow'
                      : 'bg-white/5 text-white hover:bg-white/10 border border-white/10'
                  }`}
                >
                  ₵{v >= 1000 ? `${v / 1000}k` : v}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={start}
              disabled={busy}
              data-testid="vibe654-solo-start"
              className="shrink-0 px-4 sm:px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-fuchsia-500 hover:from-amber-300 hover:to-fuchsia-400 font-black text-black text-sm sm:text-base shadow-[0_0_24px_-6px_rgba(251,191,36,0.6)] transition disabled:opacity-50"
            >
              {busy ? 'Starting…' : `Ante In ₵${bet >= 1000 ? `${bet / 1000}k` : bet}`}
            </button>
          </div>
          {error && (
            <p
              className="mt-1.5 text-center text-xs text-rose-300"
              data-testid="vibe654-solo-error"
            >
              {error}
            </p>
          )}
        </div>
      ) : null}

      {/* decision side-dock — auto-hides when not the player's turn */}
      <SideDockDecision
        open={decisionOpen}
        currentScore={currentScore}
        qualified={!!game?.qualified}
        rollsRemaining={game?.rolls_remaining}
        canStand={canStand}
        rollLabel={game && game.rolls === 0 ? 'First Roll' : 'Roll Again'}
        onRoll={roll}
        onStand={stand}
        busy={busy}
        helperText={
          game?.qualified
            ? 'Stand to lock the point. Roll to gamble for higher.'
            : 'Roll to qualify · 6 → 5 → 4'
        }
      />

      {/* win celebration */}
      <VibeWinnerExplosion
        show={celebrated}
        winnerName={userName}
        payout={game?.payout ?? undefined}
      />
    </div>
  );
}
