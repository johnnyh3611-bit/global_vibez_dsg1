/**
 * Thirty-One (Game #31 - Scarcity Rules)
 * ────────────────────────────────────────
 * Suit-locked scoring. Ace=11, Face=10. Hit 31 for BLITZ instant win.
 * Ties at low score trigger the Sovereign War-of-Attrition protocol.
 *
 * Wires directly to:
 *   GET  /api/games/thirty-one/constants
 *   POST /api/games/thirty-one/deal
 *   POST /api/games/thirty-one/score
 *   POST /api/games/thirty-one/resolve-round
 *   POST /api/games/thirty-one/tie-shootout
 *
 * Design: neon fuchsia/cyan on onyx (matches Pricing Master Vault aesthetic).
 * Zero external state. Pure client-side game loop; backend handles scoring math.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Coins, Crown, Flame, RotateCcw, Swords, Zap } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

type Suit = "S" | "H" | "D" | "C";
interface CardT { rank: string; suit: Suit; }
interface ScoredPlayer {
  player_id: string;
  status: "BLITZ" | "LIVE";
  score: number;
  suits: Record<Suit, number>;
  payout: boolean;
}
interface RoundOutcome {
  scored: ScoredPlayer[];
  blitzes: string[];
  low_score: number;
  low_score_players: string[];
  high_score: number;
  high_score_players: string[];
  tie_at_low: boolean;
  tongue_events: any[];
}
interface ShootoutOutcome {
  status: "winner" | "bankruptcy" | "all_bankrupt";
  winner: string | null;
  loser: string | null;
  final_pot: number;
  rounds_played: number;
  total_tax: number;
  tax_breakdown: number[];
  pot_history: number[];
  events: any[];
  burn_event: { label: string; burned_this_hand: number };
}

const SUIT_SYMBOL: Record<Suit, string> = { S: "♠", H: "♥", D: "♦", C: "♣" };
const SUIT_COLOR: Record<Suit, string> = {
  S: "text-neutral-100",
  H: "text-rose-400",
  D: "text-rose-400",
  C: "text-neutral-100",
};

function CardFace({ card, size = "lg" }: { card: CardT; size?: "sm" | "lg" }) {
  const dims = size === "lg" ? "w-16 h-24 text-2xl" : "w-12 h-16 text-base";
  return (
    <motion.div
      initial={{ opacity: 0, y: 14, rotateY: -30 }}
      animate={{ opacity: 1, y: 0, rotateY: 0 }}
      transition={{ duration: 0.35 }}
      data-testid={`thirty-one-card-${card.rank}-${card.suit}`}
      className={`${dims} rounded-xl bg-gradient-to-br from-white via-neutral-50 to-neutral-200 border-2 border-white/80 shadow-lg shadow-black/40 flex flex-col items-center justify-center font-bold ${SUIT_COLOR[card.suit]}`}
    >
      <span>{card.rank}</span>
      <span className="text-3xl leading-none">{SUIT_SYMBOL[card.suit]}</span>
    </motion.div>
  );
}

function BlitzFanfare({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2600);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: 1, scale: [0.5, 1.25, 1] }}
      exit={{ opacity: 0, scale: 1.2 }}
      transition={{ duration: 0.6 }}
      data-testid="thirty-one-blitz-fanfare"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md pointer-events-none"
    >
      <div className="text-center">
        <motion.div
          animate={{ rotate: [-2, 2, -2] }}
          transition={{ repeat: Infinity, duration: 0.4 }}
          className="text-8xl sm:text-9xl font-black bg-clip-text text-transparent bg-gradient-to-br from-yellow-300 via-fuchsia-400 to-cyan-400 drop-shadow-[0_0_30px_rgba(236,72,153,0.7)]"
        >
          BLITZ!
        </motion.div>
        <div className="mt-3 text-xl text-white font-mono tracking-widest">SCORE 31 · INSTANT WIN</div>
      </div>
    </motion.div>
  );
}

export default function ThirtyOne() {
  const nav = useNavigate();
  const [constants, setConstants] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [hands, setHands] = useState<CardT[][]>([]);
  const [outcome, setOutcome] = useState<RoundOutcome | null>(null);
  const [showBlitz, setShowBlitz] = useState(false);
  const [shootout, setShootout] = useState<ShootoutOutcome | null>(null);
  const [numPlayers, setNumPlayers] = useState(3);
  const [bounty, setBounty] = useState(2.0);

  useEffect(() => {
    fetch(`${API}/api/games/thirty-one/constants`)
      .then(r => r.json()).then(setConstants).catch(() => {});
  }, []);

  const dealRound = useCallback(async () => {
    setLoading(true);
    setOutcome(null);
    setShootout(null);
    try {
      const dealRes = await fetch(`${API}/api/games/thirty-one/deal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ num_players: numPlayers, cards_per_hand: 3 }),
      }).then(r => r.json());

      const dealt: CardT[][] = dealRes.hands.map((h: any) => h.hand);
      setHands(dealt);

      const resolveRes: RoundOutcome = await fetch(`${API}/api/games/thirty-one/resolve-round`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          players: dealt.map((h, i) => ({ player_id: `player_${i + 1}`, hand: h })),
        }),
      }).then(r => r.json());

      setOutcome(resolveRes);
      if (resolveRes.blitzes.length > 0) setShowBlitz(true);
    } finally {
      setLoading(false);
    }
  }, [numPlayers]);

  const runShootout = useCallback(async () => {
    if (!outcome || outcome.low_score_players.length < 2) return;
    setLoading(true);
    try {
      const [aId, bId] = outcome.low_score_players.slice(0, 2);
      const res: ShootoutOutcome = await fetch(`${API}/api/games/thirty-one/tie-shootout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          player_a: { player_id: aId, balance: 100 },
          player_b: { player_id: bId, balance: 100 },
          current_pot: 10,
          bounty,
        }),
      }).then(r => r.json());
      setShootout(res);
    } finally {
      setLoading(false);
    }
  }, [outcome, bounty]);

  const winnerId = useMemo(() => {
    if (!outcome) return null;
    if (outcome.blitzes.length > 0) return outcome.blitzes[0];
    if (outcome.high_score_players.length === 1) return outcome.high_score_players[0];
    return null;
  }, [outcome]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-purple-950/20 to-black text-white" data-testid="thirty-one-page">
      {/* Header */}
      <div className="sticky top-0 z-30 backdrop-blur-md bg-black/60 border-b border-white/10">
        <div className="max-w-6xl mx-auto px-5 py-3 flex items-center gap-4">
          <button
            onClick={() => nav(-1)}
            data-testid="thirty-one-back-btn"
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Crown className="w-5 h-5 text-yellow-400" />
              <h1 className="text-lg font-black tracking-wide">Thirty-One</h1>
              <span className="text-[10px] font-mono uppercase tracking-widest text-cyan-300 bg-cyan-500/10 border border-cyan-500/30 px-2 py-0.5 rounded">#31 Scarcity Rules</span>
            </div>
            <p className="text-xs text-neutral-400 mt-0.5">Suit-locked scoring · Hit 31 for BLITZ · Ties trigger Bounty War</p>
          </div>
        </div>
      </div>

      {/* Setup strip */}
      <div className="max-w-6xl mx-auto px-5 py-5 space-y-5">
        <div className="rounded-2xl border border-white/10 bg-black/40 p-5 flex flex-wrap items-end gap-5" data-testid="thirty-one-setup">
          <label className="flex flex-col text-xs text-neutral-400">
            Players
            <select
              value={numPlayers}
              onChange={e => setNumPlayers(parseInt(e.target.value))}
              disabled={loading}
              data-testid="thirty-one-players-select"
              className="mt-1 bg-black border border-white/20 rounded-lg px-3 py-2 text-white font-mono"
            >
              {[2, 3, 4, 5, 6, 7].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <label className="flex flex-col text-xs text-neutral-400">
            Bounty (tie re-ante)
            <select
              value={bounty}
              onChange={e => setBounty(parseFloat(e.target.value))}
              disabled={loading}
              data-testid="thirty-one-bounty-select"
              className="mt-1 bg-black border border-white/20 rounded-lg px-3 py-2 text-white font-mono"
            >
              {[1, 2, 5, 10, 25].map(n => <option key={n} value={n}>${n.toFixed(2)}</option>)}
            </select>
          </label>
          <button
            onClick={dealRound}
            disabled={loading}
            data-testid="thirty-one-deal-btn"
            className="ml-auto px-6 py-2.5 rounded-full bg-gradient-to-r from-fuchsia-500 to-cyan-500 text-black font-bold tracking-wide hover:brightness-110 disabled:opacity-50 transition-all flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" /> {hands.length ? "Deal New Round" : "Deal Round"}
          </button>
        </div>

        {/* Rule strip */}
        {constants && (
          <div className="rounded-xl border border-white/10 bg-black/30 p-3 text-xs font-mono flex flex-wrap gap-x-6 gap-y-1" data-testid="thirty-one-constants-strip">
            <span>Ace = <b className="text-cyan-300">{constants.ace_value}</b></span>
            <span>Face = <b className="text-cyan-300">{constants.face_value}</b></span>
            <span>BLITZ = <b className="text-yellow-300">{constants.blitz_score}</b></span>
            <span>Sovereign Tax = <b className="text-rose-300">{(constants.sovereign_tax_rate * 100).toFixed(1)}%</b></span>
          </div>
        )}

        {/* Hands */}
        {hands.length > 0 && (
          <div className="grid gap-5" data-testid="thirty-one-hands-grid">
            {hands.map((h, i) => {
              const pid = `player_${i + 1}`;
              const sp = outcome?.scored.find(s => s.player_id === pid);
              const isBlitz = sp?.status === "BLITZ";
              const isWinner = winnerId === pid;
              const isTiedLow = outcome?.low_score_players.includes(pid);
              return (
                <div
                  key={pid}
                  data-testid={`thirty-one-player-${pid}`}
                  className={`rounded-2xl border p-5 transition-colors ${
                    isBlitz ? "border-yellow-400 bg-gradient-to-br from-yellow-900/20 via-black to-fuchsia-900/10"
                    : isWinner ? "border-emerald-500/60 bg-emerald-950/10"
                    : isTiedLow ? "border-rose-500/60 bg-rose-950/10 animate-pulse"
                    : "border-white/10 bg-black/40"
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold uppercase tracking-widest">{pid.replace("_", " ")}</span>
                      {isBlitz && <span className="text-[10px] px-2 py-0.5 rounded bg-yellow-400 text-black font-black">BLITZ</span>}
                      {isWinner && !isBlitz && <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500 text-black font-black">WINNER</span>}
                      {isTiedLow && !isBlitz && <span className="text-[10px] px-2 py-0.5 rounded bg-rose-500 text-white font-black animate-pulse">MATCH OR BANKRUPT</span>}
                    </div>
                    {sp && <div className="text-3xl font-black font-mono">{sp.score}</div>}
                  </div>
                  <div className="flex gap-2">
                    {h.map((c, idx) => <CardFace key={`${pid}-${idx}`} card={c} />)}
                  </div>
                  {sp && (
                    <div className="mt-3 flex gap-3 text-xs font-mono text-neutral-400">
                      {(Object.keys(sp.suits) as Suit[]).map(s => (
                        <span key={s} className={sp.suits[s] === sp.score ? "text-cyan-300 font-bold" : ""}>
                          {SUIT_SYMBOL[s]} {sp.suits[s]}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Tie Shootout CTA */}
        {outcome?.tie_at_low && !shootout && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            data-testid="thirty-one-tie-cta"
            className="rounded-2xl border border-rose-500/60 bg-gradient-to-br from-rose-950/40 via-black to-fuchsia-950/30 p-5"
          >
            <div className="flex items-center gap-3 mb-2">
              <Swords className="w-6 h-6 text-rose-300" />
              <h3 className="text-lg font-black uppercase tracking-widest text-rose-300">Sovereign Tie-Breaker</h3>
            </div>
            <p className="text-sm text-neutral-300 mb-4">
              <b className="text-rose-200">{outcome.low_score_players.join(" and ")}</b> tied at low score <b className="text-white">{outcome.low_score}</b>.
              Both must re-ante <b className="text-yellow-300">${bounty.toFixed(2)}</b> or go bankrupt. 13.5% Sovereign Tax applies to every round.
            </p>
            <button
              onClick={runShootout}
              disabled={loading}
              data-testid="thirty-one-run-shootout-btn"
              className="px-6 py-2.5 rounded-full bg-rose-500 text-black font-bold hover:bg-rose-400 disabled:opacity-50 transition-all flex items-center gap-2"
            >
              <Swords className="w-4 h-4" /> Run War of Attrition
            </button>
          </motion.div>
        )}

        {/* Shootout Outcome */}
        {shootout && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            data-testid="thirty-one-shootout-outcome"
            className="rounded-2xl border border-emerald-500/60 bg-gradient-to-br from-emerald-950/30 via-black to-cyan-950/20 p-5 space-y-4"
          >
            <div className="flex items-center gap-3">
              <Flame className="w-6 h-6 text-orange-400" />
              <h3 className="text-lg font-black uppercase tracking-widest text-emerald-300">Attrition Resolved</h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div className="rounded-lg border border-white/10 bg-black/40 p-3">
                <div className="text-[10px] text-neutral-500 uppercase mb-1">Winner</div>
                <div className="font-bold text-emerald-300" data-testid="thirty-one-shootout-winner">{shootout.winner || "—"}</div>
              </div>
              <div className="rounded-lg border border-white/10 bg-black/40 p-3">
                <div className="text-[10px] text-neutral-500 uppercase mb-1">Rounds</div>
                <div className="font-mono font-bold">{shootout.rounds_played}</div>
              </div>
              <div className="rounded-lg border border-white/10 bg-black/40 p-3">
                <div className="text-[10px] text-neutral-500 uppercase mb-1">Final Pot</div>
                <div className="font-mono font-bold text-cyan-300">${shootout.final_pot.toFixed(2)}</div>
              </div>
              <div className="rounded-lg border border-white/10 bg-black/40 p-3">
                <div className="text-[10px] text-neutral-500 uppercase mb-1">Sovereign Tax</div>
                <div className="font-mono font-bold text-rose-300">${shootout.total_tax.toFixed(2)}</div>
              </div>
            </div>
            {/* Pot history bar */}
            <div>
              <div className="text-[10px] text-neutral-500 uppercase mb-2 flex items-center gap-1">
                <Coins className="w-3 h-3" /> Pot Growth by Round
              </div>
              <div className="flex items-end gap-1 h-20">
                {shootout.pot_history.map((p, i) => {
                  const max = Math.max(...shootout.pot_history);
                  const pct = (p / max) * 100;
                  return (
                    <div key={i} className="flex-1 flex flex-col justify-end">
                      <div
                        style={{ height: `${pct}%` }}
                        className="bg-gradient-to-t from-fuchsia-500 to-cyan-400 rounded-t transition-all"
                        title={`Round ${i}: $${p.toFixed(2)}`}
                      />
                      <div className="text-[9px] text-center text-neutral-500 mt-0.5">${p.toFixed(0)}</div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="text-xs font-mono text-neutral-400 italic">
              {shootout.burn_event.label}
            </div>
          </motion.div>
        )}

        {/* Empty state */}
        {hands.length === 0 && (
          <div className="rounded-2xl border border-white/10 bg-black/20 p-10 text-center" data-testid="thirty-one-empty-state">
            <Zap className="w-12 h-12 mx-auto text-fuchsia-400 mb-3" />
            <p className="text-neutral-300">Click <b>Deal Round</b> to start. Hit <b className="text-yellow-300">31</b> on any single suit for an instant BLITZ.</p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showBlitz && <BlitzFanfare onDone={() => setShowBlitz(false)} />}
      </AnimatePresence>
    </div>
  );
}
