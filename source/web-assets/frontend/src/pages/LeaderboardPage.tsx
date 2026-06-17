/**
 * Public $DSG Top 100 Leaderboard.
 * Pure pull on /api/leaderboard/vibez-top100 (60s cache on server).
 */
import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Trophy, Flame, Sparkles, ArrowLeft, Crown } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

interface LeaderRow {
  rank: number;
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  total_vibez: number;
  pending_vibez: number;
  available_vibez: number;
  is_elite: boolean;
}

const RANK_ACCENTS = [
  "from-amber-400 to-yellow-600", // #1
  "from-neutral-300 to-neutral-500", // #2
  "from-orange-500 to-amber-800", // #3
];

const LeaderboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [rows, setRows] = useState<LeaderRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/leaderboard/vibez-top100?limit=100`);
      const data = await res.json();
      setRows(data.top || []);
    } catch (e) {
      console.error("[leaderboard] load failed", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const iv = setInterval(load, 60000);
    return () => clearInterval(iv);
  }, [load]);

  const podium = rows.slice(0, 3);
  const rest = rows.slice(3);

  return (
    <div className="min-h-screen bg-black text-white" data-testid="leaderboard-page">
      {/* Hero */}
      <section className="relative border-b border-neutral-900 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-900/20 via-black to-fuchsia-900/20 pointer-events-none" />
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              "radial-gradient(circle at 30% 50%, rgba(251,191,36,0.15) 0%, transparent 60%)",
          }}
        />
        <div className="relative max-w-5xl mx-auto px-6 py-16">
          <button
            onClick={() => navigate(-1)}
            className="text-sm text-neutral-400 hover:text-white mb-6 flex items-center gap-1"
            data-testid="leaderboard-back-btn"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <div className="flex items-center gap-2 text-amber-400 font-mono text-xs uppercase tracking-widest mb-4">
            <Trophy className="w-4 h-4" /> $DSG Top 100
          </div>
          <h1 className="text-5xl md:text-6xl font-black italic uppercase tracking-tighter leading-none">
            Mined the most.
            <br />
            <span className="text-transparent bg-gradient-to-r from-amber-400 to-fuchsia-500 bg-clip-text">
              Ranked first.
            </span>
          </h1>
          <p className="text-neutral-400 mt-4 max-w-xl">
            The top players by lifetime $DSG mined — including pending 72h Vibe-Check holds.
            Updated every minute. Join them by playing Card Royale, streaming, or chatting in the Underground Club.
          </p>
        </div>
      </section>

      {loading && (
        <div className="max-w-5xl mx-auto px-6 py-12 text-center text-neutral-500" data-testid="leaderboard-loading">
          Loading the board...
        </div>
      )}

      {/* Podium */}
      {!loading && podium.length > 0 && (
        <section className="max-w-5xl mx-auto px-6 py-10 grid sm:grid-cols-3 gap-4" data-testid="leaderboard-podium">
          {podium.map((row, i) => (
            <div
              key={row.user_id}
              className={`relative p-6 rounded-3xl bg-gradient-to-br ${RANK_ACCENTS[i]} ${
                i === 0 ? "sm:scale-105 sm:-translate-y-2" : ""
              } overflow-hidden`}
              data-testid={`podium-${row.rank}`}
            >
              <div className="absolute inset-0 bg-black/40" />
              <div className="relative">
                <div className="flex items-center gap-2">
                  {i === 0 && <Crown className="w-6 h-6 text-amber-200" />}
                  <span className="text-5xl font-black italic">#{row.rank}</span>
                </div>
                <h3 className="mt-3 text-2xl font-bold truncate">{row.display_name}</h3>
                <p className="mt-1 text-xs uppercase tracking-widest opacity-80">
                  {row.is_elite ? "Elite Member" : "Miner"}
                </p>
                <div className="mt-4 text-3xl font-black tabular-nums">
                  {row.total_vibez.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </div>
                <div className="text-xs uppercase tracking-widest opacity-70">$DSG</div>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Rest of the board */}
      {!loading && (
        <section className="max-w-5xl mx-auto px-6 pb-24">
          <div className="p-5 rounded-2xl bg-neutral-900/60 border border-white/5">
            <div className="grid grid-cols-[48px_1fr_auto_auto] gap-4 text-xs font-mono uppercase tracking-widest text-neutral-500 mb-2 px-2">
              <span>#</span>
              <span>Player</span>
              <span className="text-right">Pending</span>
              <span className="text-right">Total $DSG</span>
            </div>
            {rest.length === 0 ? (
              <div className="text-neutral-500 text-sm text-center py-8" data-testid="leaderboard-empty">
                Be the 4th miner to make the board.
              </div>
            ) : (
              <div className="divide-y divide-neutral-800" data-testid="leaderboard-rows">
                {rest.map((row) => (
                  <div
                    key={row.user_id}
                    className="grid grid-cols-[48px_1fr_auto_auto] gap-4 items-center py-3 px-2 hover:bg-white/5 rounded-lg transition-colors"
                    data-testid={`leaderboard-row-${row.rank}`}
                  >
                    <span className="text-neutral-500 font-mono">#{row.rank}</span>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="truncate">{row.display_name}</span>
                      {row.is_elite && (
                        <span className="px-1.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-400/40 text-[10px] uppercase tracking-widest text-amber-300 flex items-center gap-1 shrink-0">
                          <Sparkles className="w-2.5 h-2.5" /> Elite
                        </span>
                      )}
                    </div>
                    <span className="text-amber-300 tabular-nums text-sm">
                      {row.pending_vibez > 0 ? row.pending_vibez.toFixed(2) : "—"}
                    </span>
                    <span className="text-fuchsia-300 font-bold tabular-nums">
                      {row.total_vibez.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <p className="text-xs text-neutral-600 text-center mt-6">
            <Flame className="inline w-3 h-3 mr-1" />
            Pending balances clear after a 72-hour Vibe Check. Cached for 60 seconds.
          </p>
        </section>
      )}
    </div>
  );
};

export default LeaderboardPage;
