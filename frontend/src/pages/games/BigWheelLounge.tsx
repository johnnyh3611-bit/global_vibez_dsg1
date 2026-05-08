/**
 * BigWheelLounge — curated `/spades/big-wheel` page that ONLY surfaces
 * Big Wheel tables. Amber-themed lobby + weekly leaderboard. Drops
 * Genius founders who picked Big Wheel as their default straight here.
 */
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Crown,
  Spade,
  Diamond,
  Trophy,
  Flame,
  ArrowLeft,
  Eye,
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

type Lobby = {
  game_id: string;
  wager: number;
  pot: number;
  phase: string;
  seat_count: number;
  team1_points: number;
  team2_points: number;
  spectate_url: string;
};

type Leader = {
  rank: number;
  user_id: string;
  display_name: string;
  earnings: number;
  games_played: number;
};

export default function BigWheelLounge() {
  const navigate = useNavigate();
  const [lobbies, setLobbies] = useState<Lobby[] | null>(null);
  const [leaders, setLeaders] = useState<Leader[] | null>(null);
  const [stats, setStats] = useState<{ tables_active: number; total_pot: number } | null>(null);
  const [period, setPeriod] = useState<7 | 30>(7);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const [l, s] = await Promise.all([
          fetch(`${API}/api/spades/big-wheel/lobbies?limit=12`).then((r) => r.json()),
          fetch(`${API}/api/spades/big-wheel/stats`).then((r) => r.json()),
        ]);
        if (!alive) return;
        setLobbies(l.lobbies || []);
        setStats(s);
      } catch {
        /* silent */
      }
    };
    load();
    const t = setInterval(load, 20_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  useEffect(() => {
    let alive = true;
    fetch(`${API}/api/spades/big-wheel/leaderboard?period_days=${period}&limit=15`)
      .then((r) => r.json())
      .then((d) => {
        if (alive) setLeaders(d.leaders || []);
      })
      .catch(() => {
        /* silent */
      });
    return () => {
      alive = false;
    };
  }, [period]);

  return (
    <div
      className="min-h-screen bg-[#0a0712] text-amber-50 relative overflow-hidden"
      data-testid="big-wheel-lounge"
    >
      {/* Amber + rose ambient layers */}
      <div className="absolute inset-0 pointer-events-none [background:radial-gradient(circle_at_20%_10%,rgba(252,211,77,0.18),transparent_55%),radial-gradient(circle_at_80%_80%,rgba(244,63,94,0.18),transparent_55%)]" />
      <div className="absolute inset-0 pointer-events-none opacity-[0.04] [background-image:repeating-linear-gradient(45deg,#fff_0_2px,transparent_2px_22px)]" />

      <header className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-8 pb-6">
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-amber-200/70 hover:text-amber-100 text-[11px] uppercase tracking-widest"
        >
          <ArrowLeft className="w-3 h-3" /> Back to Hub
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mt-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.4em] text-amber-300/70 flex items-center gap-2">
              <Sparkles className="w-3 h-3" />
              Higher variance · 7% rake
            </p>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black italic tracking-tight mt-2 bg-gradient-to-r from-amber-200 via-yellow-300 to-rose-300 bg-clip-text text-transparent drop-shadow-[0_0_24px_rgba(252,211,77,0.35)]">
              BIG WHEEL LOUNGE
            </h1>
            <p className="text-amber-100/70 mt-2 max-w-xl text-sm leading-relaxed">
              The Joker-Joker-Deuce-Ace ruleset. Bigger top trumps, bigger
              swings, bigger wins. Pick your seat.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Stat
              label="Active tables"
              value={stats ? String(stats.tables_active) : "—"}
              icon={<Flame className="w-3.5 h-3.5 text-rose-300" />}
            />
            <Stat
              label="Pot in air"
              value={stats ? `${stats.total_pot} ₵` : "—"}
              icon={<Spade className="w-3.5 h-3.5 text-amber-300" />}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-6">
          {[
            { icon: <Crown className="w-3 h-3" />, label: "Big Joker · 100" },
            { icon: <Crown className="w-3 h-3 opacity-70" />, label: "Little Joker · 99" },
            { icon: <Spade className="w-3 h-3" />, label: "2♠ · 98" },
            { icon: <Diamond className="w-3 h-3" />, label: "2♦ · 97" },
          ].map((t) => (
            <span
              key={t.label}
              className="inline-flex items-center gap-1 text-[10px] text-amber-100 bg-amber-500/10 border border-amber-300/30 rounded-md px-2 py-1"
            >
              {t.icon}
              {t.label}
            </span>
          ))}
        </div>
      </header>

      <main className="relative max-w-6xl mx-auto px-4 sm:px-6 pb-20 grid lg:grid-cols-3 gap-6">
        {/* Active lobbies */}
        <section
          className="lg:col-span-2 rounded-2xl border border-amber-300/20 bg-black/40 backdrop-blur-md p-5"
          data-testid="bwl-lobbies"
        >
          <h2 className="text-amber-200 font-black uppercase tracking-widest text-sm flex items-center gap-2">
            <Spade className="w-4 h-4" /> Live Big Wheel Tables
          </h2>

          {lobbies === null ? (
            <p className="text-amber-200/60 text-sm mt-4">Loading…</p>
          ) : lobbies.length === 0 ? (
            <div className="mt-4 rounded-xl border border-amber-300/20 bg-amber-500/[0.03] p-6 text-center">
              <p className="text-amber-100/80">No live Big Wheel tables right now.</p>
              <p className="text-amber-100/50 text-[11px] mt-1">
                Set Big Wheel as your default in /cosmetics-shop, then create
                one — yours will be the first.
              </p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3 mt-4">
              <AnimatePresence>
                {lobbies.map((lo) => (
                  <motion.div
                    key={lo.game_id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="rounded-xl border border-amber-300/30 bg-amber-500/[0.05] p-4"
                    data-testid={`bwl-lobby-${lo.game_id}`}
                  >
                    <p className="text-[10px] uppercase tracking-widest text-amber-300/70 mb-1">
                      Table · {lo.seat_count}/4 seats · {lo.phase}
                    </p>
                    <p className="font-black text-amber-100 text-sm break-all">
                      {lo.game_id}
                    </p>
                    <div className="grid grid-cols-2 gap-2 mt-2 text-[11px]">
                      <div>
                        <p className="text-amber-200/60 uppercase tracking-widest text-[9px]">Wager</p>
                        <p className="font-black text-amber-100">{lo.wager} ₵</p>
                      </div>
                      <div>
                        <p className="text-amber-200/60 uppercase tracking-widest text-[9px]">Pot</p>
                        <p className="font-black text-amber-200">{lo.pot} ₵</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate(lo.spectate_url)}
                      data-testid={`bwl-lobby-spectate-${lo.game_id}`}
                      className="w-full mt-3 py-1.5 rounded text-[10px] font-black uppercase tracking-widest bg-amber-300 text-black hover:bg-amber-200 flex items-center justify-center gap-1.5"
                    >
                      <Eye className="w-3 h-3" /> Spectate
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </section>

        {/* Leaderboard */}
        <aside
          className="rounded-2xl border border-amber-300/20 bg-black/40 backdrop-blur-md p-5"
          data-testid="bwl-leaderboard"
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-amber-200 font-black uppercase tracking-widest text-sm flex items-center gap-2">
              <Trophy className="w-4 h-4" /> Top Earners
            </h2>
            <div className="flex gap-1">
              {[7, 30].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPeriod(p as 7 | 30)}
                  data-testid={`bwl-period-${p}`}
                  className={`text-[10px] uppercase tracking-widest px-2 py-1 rounded ${
                    period === p
                      ? "bg-amber-300 text-black"
                      : "bg-amber-500/15 text-amber-200 hover:bg-amber-500/25"
                  }`}
                >
                  {p}d
                </button>
              ))}
            </div>
          </div>

          {leaders === null ? (
            <p className="text-amber-200/60 text-sm">Loading…</p>
          ) : leaders.length === 0 ? (
            <p className="text-amber-200/60 text-[11px] leading-snug">
              No Big Wheel finishers in the last {period} day{period > 1 ? "s" : ""}.
              Be the first.
            </p>
          ) : (
            <div className="space-y-1.5">
              {leaders.map((l) => (
                <div
                  key={`${l.rank}-${l.user_id}`}
                  data-testid={`bwl-leader-row-${l.rank}`}
                  className={`flex items-center justify-between rounded-md px-2.5 py-1.5 text-[12px] ${
                    l.rank === 1
                      ? "bg-amber-300/15 border border-amber-300/40"
                      : "bg-amber-500/[0.04] border border-amber-300/15"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black ${
                        l.rank === 1
                          ? "bg-amber-300 text-black"
                          : l.rank <= 3
                          ? "bg-amber-500/30 text-amber-200"
                          : "bg-slate-700 text-slate-300"
                      }`}
                    >
                      {l.rank === 1 ? <Crown className="w-3 h-3" /> : l.rank}
                    </span>
                    <span className="font-black text-amber-100 truncate">
                      {l.display_name}
                    </span>
                  </div>
                  <span className="font-black text-amber-200 text-[11px]">
                    {l.earnings} ₵
                    <span className="text-[9px] text-amber-200/50 ml-1">
                      ·{l.games_played}g
                    </span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </aside>
      </main>
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-amber-300/30 bg-amber-500/[0.04] backdrop-blur-md px-4 py-2">
      <p className="text-[9px] uppercase tracking-widest text-amber-300/70 flex items-center gap-1">
        {icon}
        {label}
      </p>
      <p className="text-amber-100 font-black text-lg leading-tight">{value}</p>
    </div>
  );
}
