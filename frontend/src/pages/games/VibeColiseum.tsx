import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Eye, Users, Zap } from 'lucide-react';

import Coliseum from '../../components/vibe654/Coliseum';
import VibeRoomVoice from '../../components/games/VibeRoomVoice';
import type { ColiseumSeat } from '../../components/vibe654/SeatOrb';
import TipExplosion, { TipExplosionEvent } from '../../components/vibe654/TipExplosion';
import HypeBar, { HypeType } from '../../components/vibe654/HypeBar';
import HypeEmojiOverlay, { HypeOverlayEvent } from '../../components/vibe654/HypeEmojiOverlay';
import DecisionPopDown from '../../components/vibe654/DecisionPopDown';
import VibeWinnerExplosion from '../../components/vibe654/VibeWinnerExplosion';
import TipPlayerModal from '../../components/vibe654/TipPlayerModal';
import BleacherSideBetPanel, { PlayerOddRow } from '../../components/vibe654/BleacherSideBetPanel';
import { apiGet, apiPost, getCurrentUser, pickNewEvents } from '../../components/vibe654/api';

// ----- Backend payload shape -------------------------------------------------
interface TablePayload {
  success: boolean;
  table: {
    table_id: string;
    table_name: string;
    buy_in: number;
    total_pot: number;
    status: 'WAITING' | 'IN_PROGRESS' | 'COMPLETED';
    round_number: number;
    players: Array<{ user_id: string; player_name: string; status?: string }>;
    active_players: number;
    host: string;
    host_user_id?: string;
    winner?: { user_id: string; player_name: string } | null;
    payout_info?: { winner_payout?: number; total_pot?: number; house_rake?: number };
    round_history?: Array<{ round_number: number; outcome: string; high_score: number }>;
    tip_events?: Array<TipExplosionEvent & { ts: string }>;
    hype_events?: Array<HypeOverlayEvent & { ts: string; fee?: number }>;
    sidebet_events?: Array<{ event_id: string; ts: string; target_user_id?: string }>;
  };
}

interface OddsPayload {
  success: boolean;
  players: PlayerOddRow[];
  outcome_odds: { roll_six_five_four: number };
}

interface RoundResultPayload {
  success: boolean;
  outcome: 'WINNER' | 'TIE' | 'NO_QUALIFIERS';
  winner?: { user_id: string; player_name: string };
  final_score?: number;
  hit_654?: boolean;
  payout?: { winner_payout: number; total_pot: number; house_rake: number };
  sidebets?: {
    payouts: Array<{
      bet_id: string;
      spectator_name: string;
      payout: number;
      amount: number;
      locked_odds: number;
      outcome: string;
    }>;
    losses: Array<{ bet_id: string; amount: number }>;
    settled_count: number;
  };
  message?: string;
}

/**
 * The 20-player "Breadwinner" Coliseum.
 *
 * Circular glass table with every seat placed around the rim. Active seat
 * ignites neon-cyan. Bleacher spectators can tip players, place side-bets,
 * and trigger hype emojis — all animated in-room.
 */
export default function VibeColiseum() {
  const navigate = useNavigate();
  const { tableId } = useParams<{ tableId: string }>();
  const { userId, userName } = getCurrentUser();

  const [table, setTable] = useState<TablePayload['table'] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [playingRound, setPlayingRound] = useState<boolean>(false);
  const [roundResult, setRoundResult] = useState<RoundResultPayload | null>(null);
  const [showWinner, setShowWinner] = useState<boolean>(false);

  // Social overlays
  const [tipBursts, setTipBursts] = useState<Record<string, TipExplosionEvent[]>>({});
  const [hypeOverlay, setHypeOverlay] = useState<HypeOverlayEvent[]>([]);
  const seenTipIds = useRef<Set<string>>(new Set());
  const seenHypeIds = useRef<Set<string>>(new Set());
  const firstPollRef = useRef<boolean>(true);

  // Spectator toggles
  const [spectatorMode, setSpectatorMode] = useState<boolean>(false);
  const [tipTarget, setTipTarget] = useState<ColiseumSeat | null>(null);
  const [betTarget, setBetTarget] = useState<PlayerOddRow | null>(null);
  const [betOpen, setBetOpen] = useState<boolean>(false);
  const [odds, setOdds] = useState<PlayerOddRow[]>([]);
  const [outcomeOdds, setOutcomeOdds] = useState<number>(3.5);
  const [hypeBusy, setHypeBusy] = useState<boolean>(false);
  const [tipBusy, setTipBusy] = useState<boolean>(false);
  const [betBusy, setBetBusy] = useState<boolean>(false);

  // Winner overlay auto-advance
  const winnerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ----- Polling -------------------------------------------------------------
  const fetchTable = useCallback(async () => {
    try {
      const data = await apiGet<TablePayload>(`/api/vibe654/tournament/table/${tableId}`);
      if (!data.success) return;
      const t = data.table;
      setTable(t);

      // Fresh tip events → scope them to each recipient seat so the particle
      // swarm fires from that seat's avatar.
      const newTips = pickNewEvents(t.tip_events, seenTipIds.current);
      if (!firstPollRef.current && newTips.length > 0) {
        setTipBursts((prev) => {
          const next = { ...prev };
          for (const tip of newTips) {
            next[tip.to_user_id] = [...(next[tip.to_user_id] || []), tip];
          }
          return next;
        });
        // Auto-expire each burst 1.8s later
        setTimeout(() => {
          setTipBursts((prev) => {
            const pruned: Record<string, TipExplosionEvent[]> = {};
            for (const [seat, arr] of Object.entries(prev)) {
              pruned[seat] = arr.filter(
                (t2) => !newTips.some((nt) => nt.event_id === t2.event_id),
              );
            }
            return pruned;
          });
        }, 1800);
      }

      // Fresh hype events → play one overlay apiece.
      const newHypes = pickNewEvents(t.hype_events, seenHypeIds.current);
      if (!firstPollRef.current && newHypes.length > 0) {
        setHypeOverlay((prev) => [...prev, ...newHypes]);
        setTimeout(() => {
          setHypeOverlay((prev) =>
            prev.filter((h) => !newHypes.some((nh) => nh.event_id === h.event_id)),
          );
        }, 2600);
      }

      // Tournament auto-winner modal
      if (t.status === 'COMPLETED' && !showWinner) {
        setShowWinner(true);
        if (winnerTimer.current) clearTimeout(winnerTimer.current);
        winnerTimer.current = setTimeout(() => setShowWinner(false), 6000);
      }

      firstPollRef.current = false;
    } catch (e) {
      // ignore transient poll errors
    } finally {
      setLoading(false);
    }
  }, [tableId, showWinner]);

  const fetchOdds = useCallback(async () => {
    if (!tableId) return;
    try {
      const data = await apiGet<OddsPayload>(`/api/vibe654/tournament/${tableId}/odds`);
      if (!data.success) return;
      setOdds(data.players);
      setOutcomeOdds(data.outcome_odds?.roll_six_five_four ?? 3.5);
    } catch {
      /* optional */
    }
  }, [tableId]);

  useEffect(() => {
    fetchTable();
    fetchOdds();
    const interval = setInterval(() => {
      fetchTable();
      fetchOdds();
    }, 3000);
    return () => clearInterval(interval);
  }, [fetchTable, fetchOdds]);

  // ----- Actions -------------------------------------------------------------
  const handleStart = async () => {
    try {
      await apiPost(
        `/api/vibe654/tournament/start-tournament/${tableId}?host_user_id=${encodeURIComponent(userId)}`,
        {},
      );
      await fetchTable();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Failed to start tournament');
    }
  };

  const handlePlayRound = async () => {
    if (!tableId) return;
    setPlayingRound(true);
    setRoundResult(null);
    try {
      const data = await apiPost<RoundResultPayload>(
        `/api/vibe654/tournament/play-round/${tableId}`,
        {},
      );
      setRoundResult(data);
      await fetchTable();
      await fetchOdds();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Round failed');
    } finally {
      setPlayingRound(false);
    }
  };

  const sendTip = async (amount: number) => {
    if (!tipTarget) return;
    setTipBusy(true);
    try {
      await apiPost(`/api/vibe654/tournament/${tableId}/tip`, {
        spectator_user_id: userId,
        spectator_name: userName,
        recipient_user_id: tipTarget.user_id,
        amount,
      });
      setTipTarget(null);
      await fetchTable();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Tip failed');
    } finally {
      setTipBusy(false);
    }
  };

  const triggerHype = async (hype_type: HypeType) => {
    setHypeBusy(true);
    try {
      await apiPost(`/api/vibe654/tournament/${tableId}/hype`, {
        spectator_user_id: userId,
        spectator_name: userName,
        hype_type,
      });
      await fetchTable();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Hype failed');
    } finally {
      setHypeBusy(false);
    }
  };

  const placeSideBet = async (payload: {
    amount: number;
    outcome: 'player_wins' | 'roll_six_five_four';
    target_user_id: string | null;
  }) => {
    setBetBusy(true);
    try {
      await apiPost(`/api/vibe654/tournament/${tableId}/sidebet`, {
        spectator_user_id: userId,
        spectator_name: userName,
        amount: payload.amount,
        outcome: payload.outcome,
        target_user_id: payload.target_user_id,
      });
      setBetOpen(false);
      setBetTarget(null);
      await fetchOdds();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Side bet failed');
    } finally {
      setBetBusy(false);
    }
  };

  // ----- Derived --------------------------------------------------------------
  const isHost = !!table && (table.host === userName || table.host_user_id === userId);
  const isPlayer = !!table && (table.players || []).some((p) => p.user_id === userId);

  const seats: ColiseumSeat[] = useMemo(() => {
    if (!table) return [];
    // Use the last round's per-player score when available to show streak on seat.
    const lastRound = (table.round_history || [])[table.round_history?.length ? table.round_history.length - 1 : -1];
    const lastResults = (lastRound as { results?: Record<string, { score?: number }> } | undefined)?.results || {};
    return (table.players || []).map((p) => ({
      user_id: p.user_id,
      player_name: p.player_name,
      status: (p.status as 'active' | 'eliminated') || 'active',
      isHost: p.user_id === table.host_user_id,
      score: lastResults[p.user_id]?.score,
    }));
  }, [table]);

  const leaderboard = useMemo(() => {
    if (!table) return [];
    return seats
      .filter((s) => s.status === 'active' && (s.score ?? 0) > 0)
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, 3)
      .map((s) => ({ name: s.player_name, score: s.score ?? 0 }));
  }, [seats, table]);

  // ----- Render --------------------------------------------------------------
  if (loading || !table) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="inline-block animate-spin rounded-full h-20 w-20 border-t-4 border-b-4 border-cyan-500" />
          <p className="mt-4">Loading table…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] flex flex-col overflow-hidden bg-[radial-gradient(ellipse_at_top,_#0a2e35_0%,_#020308_60%,_#000_100%)] text-white">
      {/* stadium perimeter lighting sweep */}
      <motion.div
        className="fixed inset-0 pointer-events-none opacity-40"
        animate={{ rotate: [0, 360] }}
        transition={{ duration: 60, repeat: Infinity, ease: 'linear' }}
        style={{
          background:
            'conic-gradient(from 0deg, rgba(34,211,238,0.12), transparent 25%, rgba(217,70,239,0.12) 50%, transparent 75%, rgba(34,211,238,0.12))',
        }}
        aria-hidden
      />

      <div className="relative shrink-0 max-w-7xl w-full mx-auto px-3 sm:px-4 pt-3 sm:pt-4 pb-2">
        {/* Header — compact */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl md:text-2xl font-black truncate bg-gradient-to-r from-cyan-300 via-emerald-300 to-fuchsia-300 bg-clip-text text-transparent">
              {table.table_name}
            </h1>
            <p className="text-[10px] sm:text-xs text-cyan-200/80 truncate">
              Breadwinner · Host {table.host} · Buy-in ₵{Number(table.buy_in || 0).toLocaleString()}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {!isPlayer && (
              <button
                type="button"
                onClick={() => setSpectatorMode((m) => !m)}
                data-testid="vibe654-coliseum-spectator-toggle"
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition ${
                  spectatorMode ? 'bg-fuchsia-500' : 'bg-white/10 hover:bg-white/20'
                }`}
              >
                <Eye className="w-3.5 h-3.5" /> {spectatorMode ? 'Bleachers ON' : 'Bleachers'}
              </button>
            )}
            <button
              type="button"
              onClick={() => navigate('/games/vibe654/tournament')}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs"
              data-testid="vibe654-coliseum-back"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Lobby
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-3 sm:px-4 pb-[max(env(safe-area-inset-bottom),12px)]">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4 items-start">
          {/* LEFT: Pot + Controls */}
          <div className="space-y-4">
            <motion.div
              animate={{ scale: [1, 1.02, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="rounded-2xl bg-gradient-to-br from-amber-500 to-orange-700 border-4 border-yellow-300/70 p-5 shadow-[0_0_60px_-12px_rgba(251,191,36,0.6)]"
            >
              <p className="text-xs uppercase tracking-widest text-amber-100 mb-1">Total Pot</p>
              <p className="text-4xl font-black" data-testid="vibe654-total-pot">
                ₵{Number(table.total_pot || 0).toLocaleString()}
              </p>
              <p className="text-xs text-amber-100/90 mt-1">
                Rake 12.5% · ₵{Math.round((table.total_pot || 0) * 0.125).toLocaleString()}
              </p>
            </motion.div>

            <div className="rounded-2xl bg-black/60 border border-cyan-400/20 p-4 backdrop-blur-md space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-white/60">Status</span>
                <span className="font-bold">{table.status}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/60">Round</span>
                <span className="font-bold">{table.round_number ?? 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/60">Seats</span>
                <span className="font-bold">
                  {(table.players || []).length} / 20
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/60 flex items-center gap-1">
                  <Users className="w-3 h-3" /> Active
                </span>
                <span className="font-bold text-cyan-300">{table.active_players}</span>
              </div>
            </div>

            {table.status === 'WAITING' && isHost && (
              <button
                type="button"
                onClick={handleStart}
                disabled={(table.players || []).length < 2}
                data-testid="vibe654-coliseum-start"
                className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 font-black text-black disabled:opacity-40 shadow-lg"
              >
                {(table.players || []).length < 2 ? 'Need 2+ Players' : 'Start Tournament'}
              </button>
            )}

            {table.status === 'WAITING' && !isHost && (
              <div className="rounded-xl bg-blue-500/20 border border-blue-400/30 px-4 py-3 text-center text-blue-200 text-sm">
                Waiting for host to start…
              </div>
            )}

            {spectatorMode && (
              <button
                type="button"
                onClick={() => {
                  setBetTarget(null);
                  setBetOpen(true);
                }}
                data-testid="vibe654-coliseum-open-sidebet"
                className="w-full py-3 rounded-xl bg-gradient-to-r from-fuchsia-600 to-purple-700 hover:from-fuchsia-500 hover:to-purple-600 font-black text-white shadow-lg flex items-center justify-center gap-2"
              >
                <Zap className="w-4 h-4" /> Place Side Bet
              </button>
            )}

            {/* Last round result ribbon */}
            <AnimatePresence>
              {roundResult && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className={`rounded-xl px-4 py-3 text-sm border ${
                    roundResult.outcome === 'WINNER'
                      ? 'bg-emerald-900/40 border-emerald-400/40 text-emerald-100'
                      : roundResult.outcome === 'TIE'
                      ? 'bg-yellow-900/40 border-yellow-400/40 text-yellow-100'
                      : 'bg-rose-900/40 border-rose-400/40 text-rose-100'
                  }`}
                  data-testid="vibe654-coliseum-round-result"
                >
                  <p className="font-black">{roundResult.outcome.replace('_', ' ')}</p>
                  <p className="text-xs opacity-90 mt-1">{roundResult.message}</p>
                  {roundResult.hit_654 && (
                    <p className="text-xs mt-1 text-yellow-200 font-bold">🎯 6-5-4 HIT this round!</p>
                  )}
                  {roundResult.sidebets && roundResult.sidebets.settled_count > 0 && (
                    <div className="mt-2 pt-2 border-t border-white/10 text-xs">
                      <div className="font-bold mb-1">Side-Bets Settled: {roundResult.sidebets.settled_count}</div>
                      {roundResult.sidebets.payouts.slice(0, 4).map((p) => (
                        <div key={p.bet_id} className="opacity-90">
                          ₵{p.payout.toLocaleString()} → {p.spectator_name} ({p.locked_odds.toFixed(2)}x)
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* CENTER: Coliseum arena */}
          <div className="lg:col-span-2 relative space-y-3">
            {/* Universal 2-20 player voice/video bar — Focus System */}
            <VibeRoomVoice
              roomId={`coliseum:${tableId}`}
              userId={userId}
              userName={userName}
            />
            <div className="relative" data-testid="vibe654-coliseum-arena">
              <Coliseum
                variant="coliseum"
                seats={seats}
                activeSeatId={null}
                currentUserId={userId}
                spectatorMode={spectatorMode}
                leaderboard={leaderboard}
                onTipClick={(s) => setTipTarget(s)}
                onBetClick={(s) => {
                  setBetTarget({
                    user_id: s.user_id,
                    player_name: s.player_name,
                    odds: odds.find((o) => o.user_id === s.user_id)?.odds ?? 3.0,
                  });
                  setBetOpen(true);
                }}
                centerContent={
                  <div className="flex flex-col items-center gap-1.5">
                    {/* Live qualifier chips — 6 → 5 → 4 (cyan-emerald to
                        keep the Coliseum visually distinct from the
                        amber-fuchsia Solo Vault). */}
                    <div
                      className="flex gap-1.5"
                      data-testid="vibe654-coliseum-qualifier-row"
                    >
                      {[6, 5, 4].map((d) => {
                        const lit =
                          roundResult?.outcome === 'WINNER' ||
                          (roundResult?.hit_654 ?? false);
                        return (
                          <div
                            key={`q-${d}`}
                            className={`flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full border-2 text-sm font-black transition-all ${
                              lit
                                ? 'bg-cyan-400 text-slate-900 border-cyan-200 shadow-[0_0_18px_rgba(34,211,238,0.7)]'
                                : 'bg-black/50 text-white/40 border-white/10'
                            }`}
                            data-testid={`vibe654-coliseum-qualifier-${d}${lit ? '-locked' : ''}`}
                          >
                            {d}
                          </div>
                        );
                      })}
                    </div>
                    {/* Tiny dice — last winning final score visualised as
                        spots inside small circles. Falls back to dim
                        placeholders before the first round is played. */}
                    <div className="flex gap-1" data-testid="vibe654-coliseum-tiny-dice">
                      {Array.from({ length: 5 }).map((_, i) => {
                        const fs = roundResult?.final_score ?? 0;
                        // Spread the score across 5 dice positions for
                        // visual rhythm; clamp 1-6 per die.
                        const v = fs > 0 ? Math.min(6, Math.max(1, ((i + (fs % 5)) % 6) + 1)) : 0;
                        return (
                          <div
                            key={`td-${i}`}
                            className={`w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-sm border ${
                              v
                                ? 'bg-emerald-300 border-emerald-100 shadow-[0_0_6px_rgba(110,231,183,0.6)]'
                                : 'bg-black/40 border-white/10'
                            }`}
                            aria-label={v ? `die ${v}` : 'die idle'}
                          />
                        );
                      })}
                    </div>
                    <div className="text-[9px] uppercase tracking-[0.4em] text-cyan-200/80 mt-1">
                      Round {table.round_number ?? 0} · Pot
                    </div>
                    <div
                      className="text-2xl md:text-3xl font-black text-amber-200 leading-none"
                      data-testid="vibe654-center-pot"
                    >
                      ₵{Number(table.total_pot || 0).toLocaleString()}
                    </div>
                    {table.status === 'IN_PROGRESS' && isHost && (
                      <button
                        type="button"
                        onClick={handlePlayRound}
                        disabled={playingRound}
                        data-testid="vibe654-coliseum-play-round"
                        className="mt-1 px-4 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-600 hover:from-cyan-400 hover:to-emerald-500 font-black text-white text-xs uppercase tracking-widest shadow-lg disabled:opacity-50"
                      >
                        {playingRound ? 'Rolling…' : 'Play Next Orbit'}
                      </button>
                    )}
                  </div>
                }
              />
              {/* tip explosion overlays per seat */}
              {Object.entries(tipBursts).map(([seatId, events]) => {
                if (events.length === 0) return null;
                // Locate the seat DOM element by its testid.
                return (
                  <SeatTipBurst key={`tb-${seatId}`} seatId={seatId} events={events} />
                );
              })}
              {/* hype emoji overlay */}
              <HypeEmojiOverlay events={hypeOverlay} />
            </div>
          </div>
        </div>
      </div>

      {/* Floating hype bar for spectators + players */}
      <HypeBar onHype={triggerHype} fee={1} busy={hypeBusy} />

      {/* Host-only decision pop-down for "Play Next Orbit" */}
      <DecisionPopDown
        open={false}
        currentScore={0}
        canStand={false}
        onRoll={handlePlayRound}
        onStand={() => {
          /* noop in coliseum */
        }}
        busy={playingRound}
      />

      {/* Tip modal */}
      <TipPlayerModal
        open={!!tipTarget}
        recipientName={tipTarget?.player_name ?? ''}
        onCancel={() => setTipTarget(null)}
        onSubmit={sendTip}
        busy={tipBusy}
      />

      {/* Side-bet panel */}
      <BleacherSideBetPanel
        open={betOpen}
        defaultTarget={betTarget}
        players={odds.filter((o) => o.user_id !== userId)}
        outcomeOdds={outcomeOdds}
        busy={betBusy}
        onCancel={() => {
          setBetOpen(false);
          setBetTarget(null);
        }}
        onSubmit={placeSideBet}
      />

      {/* Winner full-screen */}
      <VibeWinnerExplosion
        show={showWinner && !!table.winner}
        winnerName={table.winner?.player_name}
        payout={table.payout_info?.winner_payout}
      />
    </div>
  );
}

// ----- Small helper — position tip burst overlay on top of a seat by testid --
const SeatTipBurst: React.FC<{ seatId: string; events: TipExplosionEvent[] }> = ({ seatId, events }) => {
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  useEffect(() => {
    const el = document.querySelector(`[data-testid="vibe654-seat-${seatId}"]`) as HTMLElement | null;
    const arenaEl = document.querySelector('[data-testid="vibe654-coliseum-arena"]') as HTMLElement | null;
    if (!el || !arenaEl) return;
    const rect = el.getBoundingClientRect();
    const arena = arenaEl.getBoundingClientRect();
    setPos({
      left: rect.left - arena.left + rect.width / 2,
      top: rect.top - arena.top + rect.height / 2,
    });
  }, [seatId, events.length]);
  if (!pos) return null;
  return (
    <div
      className="absolute w-0 h-0 pointer-events-none"
      style={{ left: pos.left, top: pos.top }}
    >
      <TipExplosion events={events} />
    </div>
  );
};
