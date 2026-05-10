/**
 * /vibez-654 — Nova's Parlour · 5-dice 654 · Single-player vs AI.
 *
 * LAYOUT (founder directive 2026-05-09):
 *   ┌──────── Header (Back · Title · Wallet) ────────┐
 *   │                Stat bar  · Qualifier ladder     │
 *   │                ┌──── Dice arena ────┐           │
 *   │                │   centred, sized   │           │
 *   │                │   to never bleed   │           │
 *   │                └────────────────────┘           │
 *   │   [Side Bets ▾]   [Recent Rolls ▾]              │
 *   │   ┌──── Roll · Stand controls ────┐             │
 *   │                Outcome card                     │
 *   │   24h Leaderboard (collapsed if empty)          │
 *   └─────────────────────────────────────────────────┘
 *
 * SIDE BETS — collapsible drawer, locks at first roll. Backed by the new
 *   `/api/vibez-654/side-bet-types` catalog and evaluated server-side on roll #1.
 * RECENT ROLLS — collapsible drawer, GET `/api/vibez-654/history?limit=10`.
 *
 * Backend: /api/vibez-654/{start,roll,stand,state,leaderboard,history,side-bet-types}
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dice5, Dice6, Loader2, ArrowLeft, Crown, Trophy, Lock, CheckCircle2, XCircle,
  ChevronDown, History, Coins, Sparkles, Plus, Minus,
} from "lucide-react";
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
  side_bets?: SideBetPlaced[];
  side_bet_results?: SideBetResult[];
  side_bet_payout?: number;
};

type SideBetType = { type: string; multiplier: number; label: string };
type SideBetPlaced = { type: string; amount: number };
type SideBetResult = { type: string; amount: number; won: boolean; payout: number };
type HistoryRow = {
  game_id: string;
  bet?: number;
  score: number;
  qualified?: boolean;
  point_dice?: number[];
  rolls?: number;
  side_bets?: SideBetPlaced[];
  side_bet_results?: SideBetResult[];
  side_bet_payout?: number;
  payout?: number;
  net_payout?: number;
  ended_at?: string;
};

const STAKES = [50, 250, 500, 1_000, 5_000];
const SIDE_BET_AMOUNTS = [10, 25, 100, 500];

const QualifierBadge = ({ digit, locked }: { digit: number; locked: boolean }) => (
  <div
    data-testid={`v654-qualifier-${digit}-${locked ? "locked" : "open"}`}
    className={`w-12 h-12 rounded-full flex items-center justify-center font-black text-lg border-2 transition-colors ${
      locked
        ? "bg-amber-400 text-black border-amber-200"
        : "bg-black/40 text-white/40 border-white/15"
    }`}
  >
    {locked ? <Lock className="w-4 h-4" /> : digit}
  </div>
);

export default function Vibez654Game() {
  const navigate = useNavigate();
  const [game, setGame] = useState<Game | null>(null);
  const [bet, setBet] = useState<number>(50);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [leaderboard, setLeaderboard] = useState<{ user_id: string; score: number; game_id: string }[]>([]);

  // Side-bet catalog + working selection (key = type, value = amount).
  const [sideBetTypes, setSideBetTypes] = useState<SideBetType[]>([]);
  const [sideBets, setSideBets] = useState<Record<string, number>>({});
  const [sideBetsOpen, setSideBetsOpen] = useState(false);

  // Recent rolls drawer.
  const [recentOpen, setRecentOpen] = useState(false);
  const [recentLoading, setRecentLoading] = useState(false);
  const [recent, setRecent] = useState<HistoryRow[]>([]);

  // Catalog + leaderboard on mount.
  useEffect(() => {
    fetch(`${API}/api/vibez-654/leaderboard`)
      .then((r) => r.json())
      .then((d) => setLeaderboard((d?.rows as any[]) || []))
      .catch(() => undefined);
    fetch(`${API}/api/vibez-654/side-bet-types`)
      .then((r) => r.json())
      .then((d) => setSideBetTypes(d?.types || []))
      .catch(() => undefined);
  }, []);

  const sideBetsTotal = useMemo(
    () => Object.values(sideBets).reduce((a, b) => a + (b || 0), 0),
    [sideBets]
  );

  const sideBetsList: SideBetPlaced[] = useMemo(
    () => Object.entries(sideBets)
      .filter(([, amt]) => (amt || 0) > 0)
      .map(([type, amount]) => ({ type, amount })),
    [sideBets]
  );

  const adjustSideBet = (type: string, amount: number) => {
    setSideBets((prev) => {
      const next = { ...prev };
      if (amount <= 0) delete next[type];
      else next[type] = amount;
      return next;
    });
  };

  const fetchRecent = useCallback(async () => {
    setRecentLoading(true);
    try {
      const r = await authFetch(`${API}/api/vibez-654/history?limit=10`);
      const d = await r.json();
      setRecent((d?.rows as HistoryRow[]) || []);
    } catch {
      // ignore — drawer will show empty state
    } finally {
      setRecentLoading(false);
    }
  }, []);

  // Lazy-load recent rolls when the drawer opens.
  useEffect(() => { if (recentOpen) fetchRecent(); }, [recentOpen, fetchRecent]);

  const start = async () => {
    setError(null);
    setBusy(true);
    try {
      const r = await authFetch(`${API}/api/vibez-654/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bet, side_bets: sideBetsList }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.detail || "Couldn't start game");
      setGame(d);
      setSideBetsOpen(false); // collapse once locked in
    } catch (e: any) {
      setError(e?.message || "Network error");
    } finally {
      setBusy(false);
    }
  };

  const roll = async () => {
    if (!game) return;
    setError(null);
    setBusy(true);
    try {
      const r = await authFetch(`${API}/api/vibez-654/roll`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ game_id: game.game_id }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.detail || "Couldn't roll");
      setGame(d);
    } catch (e: any) {
      setError(e?.message || "Network error");
    } finally {
      setBusy(false);
    }
  };

  const stand = async () => {
    if (!game) return;
    setError(null);
    setBusy(true);
    try {
      const r = await authFetch(`${API}/api/vibez-654/stand`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ game_id: game.game_id }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.detail || "Couldn't stand");
      setGame(d);
      // Refresh recent rolls in case the drawer is open.
      if (recentOpen) fetchRecent();
    } catch (e: any) {
      setError(e?.message || "Network error");
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setGame(null);
    setError(null);
    setSideBets({});
    setSideBetsOpen(false);
  };

  const diceInPlay: number[] = game
    ? (game.qualified ? (game.point_dice || []) : (game.residual_dice ?? game.last_roll_dice ?? []))
    : [];
  const pointTotal = (game?.point_dice || []).reduce((a, b) => a + b, 0);
  const sideBetsLocked = !!game; // any active/ended game = locked

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

      <main className="relative z-10 max-w-3xl mx-auto px-4 py-6 md:py-8">
        <div className="rounded-2xl bg-black/60 border border-white/10 p-5 md:p-6 backdrop-blur-md">
          {!game && (
            <div className="text-center" data-testid="v654-start-screen">
              <Dice5 className="w-16 h-16 text-cyan-300 mx-auto" />
              <h2 className="text-2xl md:text-3xl font-black text-white mt-4">
                Roll · Qualify · Stand
              </h2>
              <p className="text-cyan-400/80 text-sm mt-3 max-w-md mx-auto leading-relaxed">
                Five dice. Lock a <strong className="text-amber-300">6</strong>, then{" "}
                <strong className="text-amber-300">5</strong>, then{" "}
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
                Ante In ₵{(bet + sideBetsTotal).toLocaleString()}
                {sideBetsTotal > 0 && (
                  <span className="text-[10px] font-bold opacity-70">
                    (₵{bet.toLocaleString()} + ₵{sideBetsTotal.toLocaleString()} side)
                  </span>
                )}
              </button>
            </div>
          )}

          {game && (
            <div data-testid="v654-game-active">
              {/* Stat row */}
              <div data-testid="v654-stat-bar" className="grid grid-cols-3 gap-3 mb-5">
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
                    "radial-gradient(circle at center, rgba(30,64,175,0.12) 0%, rgba(15,23,42,0.4) 40%, rgba(0,0,0,0.6) 100%)",
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
                <p className="text-rose-300 text-xs mb-4 text-center" data-testid="v654-error">
                  {error}
                </p>
              )}

              {/* Control deck */}
              {game.status === "active" && (
                <div data-testid="v654-control-deck" className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                  <p
                    data-testid="v654-payout"
                    className={`text-base font-black mt-1 tabular-nums ${
                      (game.payout || 0) > 0 ? "text-[#D4AF37]" : "text-rose-300/80"
                    }`}
                  >
                    {(game.payout || 0) > 0
                      ? `+₵${(game.payout as number).toLocaleString()} main payout`
                      : "Main stake lost"}
                  </p>
                  {(game.side_bet_payout || 0) > 0 && (
                    <p className="text-fuchsia-200 text-sm font-black mt-1 tabular-nums" data-testid="v654-side-payout">
                      +₵{(game.side_bet_payout || 0).toLocaleString()} side bet payout
                    </p>
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

        {/* SIDE BETS DRAWER */}
        <Drawer
          testId="v654-side-bets"
          icon={<Coins className="w-4 h-4" />}
          label={
            sideBetsLocked
              ? `Side bets ${sideBetsList.length ? `· ${sideBetsList.length} placed` : "· none"}`
              : `Side bets${sideBetsTotal ? ` · ₵${sideBetsTotal.toLocaleString()}` : ""}`
          }
          totalTestId="v654-side-bets-total"
          totalValue={sideBetsLocked ? null : sideBetsTotal}
          open={sideBetsOpen}
          setOpen={setSideBetsOpen}
        >
          {sideBetsLocked ? (
            <div className="space-y-2" data-testid="v654-side-bets-locked">
              {(game?.side_bet_results || game?.side_bets || []).length === 0 ? (
                <p className="text-cyan-300/60 text-xs">No side bets placed this round.</p>
              ) : (
                (game?.side_bet_results || game?.side_bets || []).map((row: any, i: number) => (
                  <div
                    key={`sb-${i}`}
                    data-testid={`v654-side-bet-row-${row.type}`}
                    className="flex items-center justify-between rounded-lg bg-black/40 border border-white/10 px-3 py-2"
                  >
                    <span className="text-xs font-bold text-white/80">
                      {row.type.replace(/_/g, " ")}
                    </span>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-amber-300">₵{row.amount.toLocaleString()}</span>
                      {"won" in row && (
                        <span className={row.won ? "text-emerald-300" : "text-rose-300"}>
                          {row.won ? `+₵${row.payout.toLocaleString()}` : "lost"}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="space-y-3" data-testid="v654-side-bets-picker">
              <p className="text-[10px] uppercase tracking-widest text-cyan-400/70">
                Place against the FIRST 5-dice roll · paid before main settlement
              </p>
              {sideBetTypes.map((sb) => {
                const cur = sideBets[sb.type] || 0;
                return (
                  <div
                    key={sb.type}
                    data-testid={`v654-side-bet-${sb.type}`}
                    className="rounded-lg bg-black/40 border border-white/10 px-3 py-2"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex flex-col">
                        <span className="text-xs font-black text-white">{sb.label}</span>
                        <span className="text-[10px] text-cyan-300/60 uppercase tracking-widest">
                          pays {sb.multiplier}×
                        </span>
                      </div>
                      <span
                        className={`text-xs font-black tabular-nums ${cur > 0 ? "text-amber-300" : "text-white/30"}`}
                        data-testid={`v654-side-bet-${sb.type}-amount`}
                      >
                        ₵{cur.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {SIDE_BET_AMOUNTS.map((amt) => (
                        <button
                          type="button"
                          key={`${sb.type}-${amt}`}
                          onClick={() => adjustSideBet(sb.type, amt)}
                          data-testid={`v654-side-bet-${sb.type}-pick-${amt}`}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition ${
                            cur === amt
                              ? "bg-amber-400 text-black"
                              : "bg-white/5 text-white/80 hover:bg-white/10 border border-white/10"
                          }`}
                        >
                          ₵{amt}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => adjustSideBet(sb.type, Math.max(0, cur - 10))}
                        disabled={cur <= 0}
                        aria-label={`Decrease ${sb.label}`}
                        data-testid={`v654-side-bet-${sb.type}-dec`}
                        className="ml-auto p-1 rounded-md bg-white/5 hover:bg-white/10 disabled:opacity-30"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => adjustSideBet(sb.type, cur + 10)}
                        aria-label={`Increase ${sb.label}`}
                        data-testid={`v654-side-bet-${sb.type}-inc`}
                        className="p-1 rounded-md bg-white/5 hover:bg-white/10"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
              {sideBetsTotal > 0 && (
                <button
                  type="button"
                  onClick={() => setSideBets({})}
                  data-testid="v654-side-bets-clear"
                  className="text-[11px] text-rose-300 hover:text-rose-200 underline underline-offset-2"
                >
                  Clear side bets
                </button>
              )}
            </div>
          )}
        </Drawer>

        {/* RECENT ROLLS DRAWER */}
        <Drawer
          testId="v654-recent-rolls"
          icon={<History className="w-4 h-4" />}
          label="Recent rolls"
          open={recentOpen}
          setOpen={setRecentOpen}
        >
          {recentLoading ? (
            <p className="text-cyan-300/60 text-xs flex items-center gap-2">
              <Loader2 className="w-3 h-3 animate-spin" /> Loading…
            </p>
          ) : recent.length === 0 ? (
            <p className="text-cyan-300/60 text-xs">No previous rolls yet — play your first session.</p>
          ) : (
            <ol className="space-y-1.5" data-testid="v654-recent-list">
              {recent.map((r) => (
                <li
                  key={r.game_id}
                  data-testid={`v654-recent-${r.game_id}`}
                  className="flex items-center justify-between rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-xs"
                >
                  <div className="flex items-center gap-3">
                    <span className={`w-2 h-2 rounded-full ${r.score > 0 ? "bg-emerald-300" : "bg-rose-400"}`} />
                    <span className="font-mono text-white/70">
                      {(r.point_dice || []).map((d) => d).join("·") || "bust"}
                    </span>
                    <span className="text-cyan-300/60">
                      {r.score > 0 ? `point ${r.score}` : "—"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 tabular-nums">
                    <span className="text-amber-300">₵{(r.bet ?? 0).toLocaleString()}</span>
                    <span className={r.score > 0 ? "text-emerald-300" : "text-rose-300"}>
                      {(r.payout ?? 0) + (r.side_bet_payout ?? 0) > 0
                        ? `+₵${((r.payout ?? 0) + (r.side_bet_payout ?? 0)).toLocaleString()}`
                        : "lost"}
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Drawer>

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

/**
 * Drawer — collapsible inline panel. Click header to expand/collapse.
 * Stays in the page flow (no fixed/floating overlap with anything).
 */
function Drawer({
  testId,
  icon,
  label,
  totalTestId,
  totalValue,
  open,
  setOpen,
  children,
}: {
  testId: string;
  icon: React.ReactNode;
  label: string;
  totalTestId?: string;
  totalValue?: number | null;
  open: boolean;
  setOpen: (v: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <div
      data-testid={`${testId}-drawer`}
      className="rounded-2xl bg-black/60 border border-white/10 mt-4 backdrop-blur-md overflow-hidden"
    >
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        data-testid={`${testId}-trigger`}
        className="w-full flex items-center justify-between px-4 py-3 text-left text-sm font-black uppercase tracking-widest text-cyan-200 hover:bg-white/5 transition-colors"
      >
        <span className="flex items-center gap-2">
          {icon}
          {label}
        </span>
        <span className="flex items-center gap-2">
          {totalTestId && totalValue !== null && totalValue !== undefined && (
            <span
              data-testid={totalTestId}
              className="text-amber-300 text-xs font-black tabular-nums"
            >
              ₵{totalValue.toLocaleString()}
            </span>
          )}
          <ChevronDown
            className={`w-4 h-4 text-cyan-300 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </span>
      </button>
      {open && (
        <div
          data-testid={`${testId}-content`}
          className="px-4 pb-4 pt-1 border-t border-white/5"
        >
          {children}
        </div>
      )}
    </div>
  );
}

// Reserved for a future "What pays" hint inside the picker (kept here so
// devs can see the full bet catalog without diving into the backend).
export const __dev_side_bet_examples: Record<string, string> = {
  TRIPLE_6: "Three or more 6s on the opening roll",
  ONE_AND_DONE: "Roll a 6, 5, AND 4 on the very first roll",
  ANY_STRAIGHT: "All 5 dice the same number",
  SMALL_STRAIGHT: "4 sequential dice (1-2-3-4 or 2-3-4-5 or 3-4-5-6)",
  LARGE_STRAIGHT: "All 5 sequential (1-2-3-4-5 or 2-3-4-5-6)",
};
// Suppress unused-import warning when Sparkles isn't rendered.
void Sparkles;
