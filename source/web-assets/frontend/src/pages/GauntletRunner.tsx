/**
 * Gauntlet Runner — routes the user through each round of the multi-game
 * tournament in order. Pulls the tournament definition from the backend,
 * finds the next incomplete round for this user, and navigates the user
 * into the appropriate card game with `?tournament_id=&round=` query params.
 *
 * When every round is complete, displays a "Run Complete" summary with the
 * current leaderboard rank.
 */
import React, { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Check, Trophy, Loader2 } from "lucide-react";
import TournamentChat from "@/components/tournament/TournamentChat";

const API = process.env.REACT_APP_BACKEND_URL;

interface RoundDef {
  round: number;
  game: string;
  scoring: string;
  time_limit_sec?: number;
}

interface TournamentInfo {
  tournament_id: string;
  name: string;
  format: string;
  status: string;
  rounds: RoundDef[];
  prize_pool_vibez: number;
  prize_pool_coins: number;
}

interface Entry {
  tournament_id: string;
  total_score: number;
  rounds_completed: number;
  rounds_total: number;
  status: string;
}

interface LeaderRow {
  rank: number;
  user_id: string;
  username: string;
  total_score: number;
  status: string;
}

const GAME_ROUTE: Record<string, string> = {
  spades: "/spades-practice",
  blackjack: "/blackjack-universal",
  poker: "/poker-practice",
  rummy: "/rummy-practice",
  bid_whist: "/bid-whist-aaa",
};

const GAME_LABEL: Record<string, string> = {
  spades: "Spades",
  blackjack: "Blackjack",
  poker: "Poker",
  rummy: "Gin Rummy",
  bid_whist: "Bid Whist Platinum",
};

const GAME_EMOJI: Record<string, string> = {
  spades: "♠",
  blackjack: "♥",
  poker: "♦",
  rummy: "♣",
  bid_whist: "♠",
};

const GauntletRunner: React.FC = () => {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  const navigate = useNavigate();
  const [tour, setTour] = useState<TournamentInfo | null>(null);
  const [entry, setEntry] = useState<Entry | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    if (!tournamentId) return;
    try {
      const [d, me] = await Promise.all([
        fetch(`${API}/api/card-royale/details/${tournamentId}`, {}).then((r) => r.json()),
        fetch(`${API}/api/card-royale/my-entry/${tournamentId}`, {})
          .then((r) => (r.ok ? r.json() : { entry: null }))
          .catch(() => ({ entry: null })),
      ]);
      if (d.tournament) {
        setTour(d.tournament);
        setLeaderboard(d.leaderboard || []);
      } else {
        setError("Tournament not found");
      }
      setEntry(me.entry);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [tournamentId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-white">
        <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
      </div>
    );
  }

  if (error || !tour) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white gap-4">
        <p className="text-red-400" data-testid="gauntlet-runner-error">{error || "Not found"}</p>
        <button
          onClick={() => navigate("/card-royale")}
          className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500"
          data-testid="gauntlet-runner-back-btn"
        >
          Back to Lobby
        </button>
      </div>
    );
  }

  const completedCount = entry?.rounds_completed ?? 0;
  const totalRounds = tour.rounds.length;
  const nextRound = tour.rounds[completedCount];
  const isDone = completedCount >= totalRounds;
  const myRank = leaderboard.find((r) => r.total_score === entry?.total_score)?.rank;

  const handleStartRound = () => {
    if (!nextRound) return;
    const route = GAME_ROUTE[nextRound.game];
    if (!route) {
      alert(`No playable page for ${nextRound.game}`);
      return;
    }
    const params = new URLSearchParams({
      tournament_id: tour.tournament_id,
      round: String(nextRound.round),
      scoring: nextRound.scoring,
    });
    navigate(`${route}?${params.toString()}`);
  };

  return (
    <div className="min-h-screen bg-black text-white" data-testid="gauntlet-runner">
      <div className="max-w-7xl mx-auto px-6 py-12 grid lg:grid-cols-[1fr_360px] gap-8">
        <div className="min-w-0">
        <button
          onClick={() => navigate("/card-royale")}
          className="text-sm text-neutral-400 hover:text-white mb-6"
          data-testid="gauntlet-back-btn"
        >
          ← Back to Lobby
        </button>

        <h1 className="text-4xl md:text-5xl font-black italic uppercase tracking-tighter">
          {tour.name}
        </h1>
        <p className="text-neutral-400 mt-2">
          Pot: <span className="text-fuchsia-400">{tour.prize_pool_vibez.toFixed(2)} $DSG</span> +{" "}
          <span className="text-amber-400">₵{tour.prize_pool_coins.toLocaleString()}</span>
        </p>

        {/* Progress bar */}
        <div className="mt-8 mb-10">
          <div className="flex items-center justify-between text-xs font-mono uppercase tracking-widest text-neutral-500 mb-2">
            <span>Progress</span>
            <span data-testid="gauntlet-progress-label">{completedCount}/{totalRounds} rounds</span>
          </div>
          <div className="h-2 bg-neutral-900 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-fuchsia-500 to-purple-500"
              initial={{ width: 0 }}
              animate={{ width: `${(completedCount / Math.max(1, totalRounds)) * 100}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </div>

        {/* Round list */}
        <div className="space-y-3" data-testid="round-list">
          {tour.rounds.map((r, i) => {
            const done = i < completedCount;
            const current = i === completedCount && !isDone;
            return (
              <div
                key={`${r.round}_${r.game}`}
                className={`flex items-center gap-4 p-4 rounded-xl border transition-colors ${
                  done
                    ? "bg-emerald-500/5 border-emerald-500/30"
                    : current
                    ? "bg-purple-500/10 border-purple-500/40"
                    : "bg-neutral-900/40 border-neutral-800"
                }`}
                data-testid={`round-row-${r.round}`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-2xl font-bold ${
                  done ? "bg-emerald-500/20 text-emerald-400" : current ? "bg-purple-500/20 text-purple-300" : "bg-neutral-800 text-neutral-500"
                }`}>
                  {done ? <Check className="w-5 h-5" /> : GAME_EMOJI[r.game] || r.round}
                </div>
                <div className="flex-1">
                  <div className="font-bold">Round {r.round} · {GAME_LABEL[r.game] || r.game}</div>
                  <div className="text-xs text-neutral-500 mt-0.5">
                    Scoring: <code>{r.scoring}</code>
                    {r.time_limit_sec && <> · Time limit {r.time_limit_sec}s</>}
                  </div>
                </div>
                {current && (
                  <button
                    onClick={handleStartRound}
                    className="px-4 py-2 rounded-lg bg-gradient-to-r from-fuchsia-500 to-purple-500 font-bold text-sm uppercase tracking-wide flex items-center gap-2 hover:scale-105 transition-transform"
                    data-testid={`start-round-${r.round}-btn`}
                  >
                    Start <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Completed summary */}
        {isDone && (
          <div className="mt-8 p-6 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-purple-500/10 border border-emerald-500/30" data-testid="gauntlet-done-panel">
            <div className="flex items-center gap-3 text-emerald-400 font-bold uppercase tracking-widest text-sm">
              <Trophy className="w-5 h-5" /> Run Complete
            </div>
            <p className="mt-2 text-neutral-300">
              Total score: <strong className="text-white text-xl">{entry?.total_score.toFixed(2)}</strong>
              {myRank && <> · Current rank <strong className="text-fuchsia-400">#{myRank}</strong></>}
            </p>
            <p className="text-sm text-neutral-500 mt-2">
              Prizes will be distributed when the tournament window closes.
            </p>
          </div>
        )}

        {/* Live leaderboard */}
        <div className="mt-12">
          <h2 className="text-lg font-black italic uppercase tracking-tighter mb-4">Live Leaderboard</h2>
          <div className="space-y-1" data-testid="gauntlet-leaderboard">
            {leaderboard.length === 0 ? (
              <p className="text-neutral-500 text-sm">No scores yet — be first on the board.</p>
            ) : (
              leaderboard.slice(0, 10).map((row) => (
                <div
                  key={row.user_id}
                  className="flex items-center justify-between px-4 py-2 rounded-lg bg-neutral-900/40 border border-white/5 text-sm"
                  data-testid={`leader-row-${row.rank}`}
                >
                  <span className="font-mono text-neutral-500 w-8">#{row.rank}</span>
                  <span className="flex-1 truncate">{row.username}</span>
                  <span className="font-bold tabular-nums">{row.total_score.toFixed(1)}</span>
                </div>
              ))
            )}
          </div>
        </div>
        </div>

        {/* Right rail: Heckle Lane */}
        <aside className="hidden lg:block lg:sticky lg:top-8 h-[calc(100vh-4rem)]" data-testid="gauntlet-chat-rail">
          {tournamentId && <TournamentChat tournamentId={tournamentId} />}
        </aside>
      </div>
    </div>
  );
};

export default GauntletRunner;
