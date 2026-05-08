/**
 * Marathon Leaderboards — dedicated page for the XL variants of TTT + C4.
 *
 * Two games × two metrics → 4 tabs total:
 *   Tic-Tac-Toe XL · Endurance (longest round)
 *   Tic-Tac-Toe XL · Fastest Win
 *   Connect 4 XL · Endurance
 *   Connect 4 XL · Fastest Win
 */
import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Trophy, Clock, Flame, ArrowLeft, Loader2, Gamepad2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const API = process.env.REACT_APP_BACKEND_URL;

type Metric = "longest" | "fastest_win";
type GameType = "tictactoe_xl" | "connect4_xl";

interface Row {
  user_id: string | null;
  display_name: string;
  best_moves: number;
  rounds: number;
  last_played?: string;
}

const GAME_META: Record<GameType, { label: string; emoji: string; accent: string; route: string }> = {
  tictactoe_xl: { label: "Tic-Tac-Toe XL", emoji: "❌", accent: "from-cyan-400 to-fuchsia-400", route: "/practice/play/tictactoe" },
  connect4_xl: { label: "Connect 4 XL", emoji: "🔴", accent: "from-rose-400 to-amber-300", route: "/practice/play/connect4" },
};

const METRIC_META: Record<Metric, { label: string; sub: string; icon: React.ReactNode }> = {
  longest: {
    label: "Endurance",
    sub: "Most moves survived before someone won",
    icon: <Flame className="w-4 h-4 text-amber-300" />,
  },
  fastest_win: {
    label: "Fastest Win",
    sub: "Fewest moves to force a victory",
    icon: <Clock className="w-4 h-4 text-cyan-300" />,
  },
};

export default function MarathonLeaderboardPage() {
  const navigate = useNavigate();
  const [game, setGame] = useState<GameType>("tictactoe_xl");
  const [metric, setMetric] = useState<Metric>("longest");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [windowDays, setWindowDays] = useState<number>(30);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(
      `${API}/api/marathon/leaderboard?game_type=${game}&metric=${metric}&window_days=${windowDays}&limit=25`,
      {}
    )
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setRows((data.rows || []) as Row[]);
      })
      .catch(() => {/* silent */})
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [game, metric, windowDays]);

  const gm = GAME_META[game];
  const mm = METRIC_META[metric];
  const sortedRows = useMemo(() => rows, [rows]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-fuchsia-950 to-cyan-950 text-white p-4 md:p-8" data-testid="marathon-leaderboard-page">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} data-testid="marathon-back-btn">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          <div className="ml-auto text-[10px] font-mono uppercase tracking-[0.3em] text-fuchsia-300">Marathon</div>
        </div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <h1 className="text-5xl md:text-6xl font-black italic tracking-tighter bg-gradient-to-r from-cyan-400 via-fuchsia-400 to-amber-300 bg-clip-text text-transparent">
            Marathon Mode
          </h1>
          <p className="text-white/60 mt-2 max-w-xl">
            The XL boards reward grinders and sharpshooters alike. Play longer, win faster, flex both.
          </p>
        </motion.div>

        {/* Game + Metric pickers */}
        <div className="flex flex-wrap gap-3 mb-6">
          <div className="flex gap-1 p-1 rounded-full bg-black/60 border border-white/10" data-testid="marathon-game-picker">
            {(Object.keys(GAME_META) as GameType[]).map((g) => (
              <button
                key={g}
                onClick={() => setGame(g)}
                data-testid={`marathon-game-${g}`}
                className={`px-4 py-1.5 rounded-full text-xs font-black italic uppercase tracking-widest transition ${
                  game === g ? `bg-gradient-to-r ${GAME_META[g].accent} text-black` : "text-white/60 hover:text-white"
                }`}
              >
                {GAME_META[g].emoji} {GAME_META[g].label}
              </button>
            ))}
          </div>

          <div className="flex gap-1 p-1 rounded-full bg-black/60 border border-white/10" data-testid="marathon-metric-picker">
            {(Object.keys(METRIC_META) as Metric[]).map((m) => (
              <button
                key={m}
                onClick={() => setMetric(m)}
                data-testid={`marathon-metric-${m}`}
                className={`px-4 py-1.5 rounded-full text-xs font-black italic uppercase tracking-widest transition ${
                  metric === m ? "bg-white/20 text-white" : "text-white/60 hover:text-white"
                }`}
              >
                {METRIC_META[m].label}
              </button>
            ))}
          </div>

          <div className="ml-auto flex gap-1 p-1 rounded-full bg-black/60 border border-white/10">
            {[7, 30, 365].map((d) => (
              <button
                key={d}
                onClick={() => setWindowDays(d)}
                data-testid={`marathon-window-${d}`}
                className={`px-3 py-1.5 rounded-full text-[10px] font-bold transition ${
                  windowDays === d ? "bg-white/15 text-white" : "text-white/50 hover:text-white"
                }`}
              >
                {d === 7 ? "7d" : d === 30 ? "30d" : "All-time"}
              </button>
            ))}
          </div>
        </div>

        <Card className="bg-white/5 border border-white/10 overflow-hidden">
          <div className="p-5 border-b border-white/10 flex items-center gap-3">
            {mm.icon}
            <div>
              <div className="text-xs font-mono uppercase tracking-[0.3em] text-white/70">
                {gm.label} · {mm.label}
              </div>
              <div className="text-[11px] text-white/50 mt-0.5">{mm.sub}</div>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="ml-auto text-white/70 hover:text-white"
              onClick={() => navigate(gm.route)}
              data-testid="marathon-play-btn"
            >
              <Gamepad2 className="w-4 h-4 mr-1" /> Play now
            </Button>
          </div>

          <div className="divide-y divide-white/5">
            {loading ? (
              <div className="p-12 text-center text-white/40" data-testid="marathon-loading">
                <Loader2 className="w-6 h-6 animate-spin mx-auto" />
              </div>
            ) : sortedRows.length === 0 ? (
              <div className="p-12 text-center text-white/50" data-testid="marathon-empty">
                No rounds logged in this window. Be the first — play a round to land on the board.
              </div>
            ) : (
              sortedRows.map((r, i) => (
                <motion.div
                  key={`${r.user_id || r.display_name}-${i}`}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(i * 0.03, 0.3) }}
                  className="flex items-center gap-4 p-4 hover:bg-white/[0.03]"
                  data-testid={`marathon-row-${i + 1}`}
                >
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 font-black italic text-sm ${
                      i === 0
                        ? "bg-gradient-to-br from-amber-300 to-yellow-500 text-black"
                        : i === 1
                        ? "bg-gradient-to-br from-slate-300 to-slate-400 text-black"
                        : i === 2
                        ? "bg-gradient-to-br from-orange-300 to-orange-500 text-black"
                        : "bg-white/5 text-white/60"
                    }`}
                  >
                    {i < 3 ? (i === 0 ? <Trophy className="w-4 h-4" /> : `#${i + 1}`) : `#${i + 1}`}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold truncate">{r.display_name}</div>
                    <div className="text-[11px] text-white/40">
                      {r.rounds} {r.rounds === 1 ? "round" : "rounds"}
                      {r.last_played && <> · last {new Date(r.last_played).toLocaleDateString()}</>}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className={`text-xl font-black italic tabular-nums bg-gradient-to-r ${gm.accent} bg-clip-text text-transparent`}>
                      {r.best_moves}
                    </div>
                    <div className="text-[10px] uppercase tracking-widest text-white/40">moves</div>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </Card>

        <div className="mt-6 flex items-center gap-3 p-4 rounded-xl border border-white/10 bg-white/5 text-sm text-white/60">
          <Flame className="w-5 h-5 text-amber-300 flex-shrink-0" />
          <div>
            <span className="text-white/80 font-bold">How it works:</span> finish an XL round and your move count is
            auto-recorded. Endurance rewards longer games; Fastest Win rewards crisp decisive play.
          </div>
        </div>
      </div>
    </div>
  );
}
