/**
 * Card Royale lobby — Active + Upcoming + My Entries for multi-game tournaments.
 * Uses the /api/card-royale/* backend (utils/tournament_engine.py).
 */
import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Trophy, Clock, Users, Coins, Zap, Flame } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

interface Tournament {
  tournament_id: string;
  template_id: string;
  name: string;
  format: string;
  status: string;
  starts_at: string;
  ends_at: string;
  rounds: Array<{ round: number; game: string; scoring: string }>;
  prize_pool_vibez: number;
  prize_pool_coins: number;
  retry_buy_in_coins: number;
  free_daily_entry: boolean;
  participant_count: number;
  max_participants: number;
  description?: string;
}

interface MyEntry {
  tournament_id: string;
  tournament_name: string;
  tournament_status: string;
  tournament_format: string;
  total_score: number;
  rounds_completed: number;
  rounds_total: number;
  status: string;
  buy_in_paid: number;
  joined_at: string;
}

const fmtCoins = (n: number): string => n.toLocaleString();
const fmtVibez = (n: number): string => `${n.toFixed(2)}`;
const fmtRelTime = (iso: string): string => {
  const diffMs = new Date(iso).getTime() - Date.now();
  const abs = Math.abs(diffMs);
  const mins = Math.floor(abs / 60000);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  const prefix = diffMs < 0 ? "Started " : "In ";
  const suffix = diffMs < 0 ? " ago" : "";
  if (days > 0) return `${prefix}${days}d${suffix}`;
  if (hrs > 0) return `${prefix}${hrs}h ${mins % 60}m${suffix}`;
  return `${prefix}${mins}m${suffix}`;
};

const GAME_EMOJI: Record<string, string> = {
  spades: "♠",
  blackjack: "♥",
  poker: "♦",
  rummy: "♣",
  bid_whist: "♠",
};

const FORMAT_LABEL: Record<string, string> = {
  solo_gauntlet: "Solo Gauntlet · 5 rounds",
  solo_sprint: "Solo Sprint · 1 round",
  bracket_16: "16-Player Bracket",
  mini_tour: "Mini Tour · 3 rounds",
};

const CardRoyaleLobby: React.FC = () => {
  const navigate = useNavigate();
  const [active, setActive] = useState<Tournament[]>([]);
  const [upcoming, setUpcoming] = useState<Tournament[]>([]);
  const [myEntries, setMyEntries] = useState<MyEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [entering, setEntering] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      const [a, u, m] = await Promise.all([
        fetch(`${API}/api/card-royale/active`, {}).then((r) => r.json()),
        fetch(`${API}/api/card-royale/upcoming`, {}).then((r) => r.json()),
        fetch(`${API}/api/card-royale/my-entries`, {})
          .then((r) => (r.ok ? r.json() : { entries: [] }))
          .catch(() => ({ entries: [] })),
      ]);
      setActive(a.tournaments || []);
      setUpcoming(u.tournaments || []);
      setMyEntries(m.entries || []);
    } catch (e) {
      console.error("[card-royale] load failed", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const iv = setInterval(fetchAll, 30000);
    return () => clearInterval(iv);
  }, [fetchAll]);

  const handleEnter = async (t: Tournament, useFree: boolean): Promise<void> => {
    setEntering(t.tournament_id);
    try {
      const res = await fetch(`${API}/api/card-royale/enter`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tournament_id: t.tournament_id, use_free_entry: useFree }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.detail || "Entry failed");
        return;
      }
      navigate(`/card-royale/${t.tournament_id}/run`);
    } catch (e) {
      alert(`Failed to enter: ${(e as Error).message}`);
    } finally {
      setEntering(null);
    }
  };

  const dailyRoyale = active.find((t) => t.template_id === "daily_royale");

  return (
    <div className="min-h-screen bg-black text-white" data-testid="card-royale-lobby">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-purple-900/50">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/30 via-black to-fuchsia-900/20 pointer-events-none" />
        <div className="absolute inset-0 opacity-10"
             style={{
               backgroundImage: "repeating-linear-gradient(45deg, rgba(168,85,247,0.1) 0 2px, transparent 2px 40px)"
             }}
        />
        <div className="relative max-w-7xl mx-auto px-6 py-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="flex items-center gap-3 text-purple-400 font-mono text-xs uppercase tracking-widest mb-4">
              <Trophy className="w-4 h-4" /> Daily Card Royale
            </div>
            <h1 className="text-5xl md:text-7xl font-black italic tracking-tighter uppercase leading-none">
              Five games.
              <br />
              <span className="text-transparent bg-gradient-to-r from-fuchsia-500 to-purple-500 bg-clip-text">
                One throne.
              </span>
            </h1>
            <p className="text-neutral-400 mt-6 max-w-xl text-lg">
              Spades · Blackjack · Poker · Gin Rummy · Bid Whist Platinum.
              One free entry daily. Rewards split 50/50 in $DSG and ₵ Vibez Coins.
            </p>
            {dailyRoyale && (
              <div className="mt-8 inline-flex flex-wrap items-center gap-6 px-6 py-4 rounded-2xl bg-purple-950/40 backdrop-blur-sm border border-purple-500/30">
                <div>
                  <div className="text-xs text-purple-300 uppercase tracking-widest">Prize Pool</div>
                  <div className="text-2xl font-bold mt-1">
                    <span className="text-fuchsia-400">{fmtVibez(dailyRoyale.prize_pool_vibez)} $DSG</span>
                    <span className="text-neutral-500 mx-2">+</span>
                    <span className="text-amber-400">₵{fmtCoins(dailyRoyale.prize_pool_coins)}</span>
                  </div>
                </div>
                <div className="h-10 w-px bg-purple-500/30 hidden sm:block" />
                <div>
                  <div className="text-xs text-purple-300 uppercase tracking-widest">Ends</div>
                  <div className="text-lg font-semibold mt-1 flex items-center gap-2">
                    <Clock className="w-4 h-4" /> {fmtRelTime(dailyRoyale.ends_at)}
                  </div>
                </div>
                <button
                  data-testid="hero-daily-royale-enter-btn"
                  onClick={() => handleEnter(dailyRoyale, true)}
                  disabled={entering === dailyRoyale.tournament_id}
                  className="ml-auto px-8 py-3 rounded-xl bg-gradient-to-r from-fuchsia-500 to-purple-500 font-bold uppercase tracking-wide text-sm hover:scale-105 transition-transform disabled:opacity-50"
                >
                  {entering === dailyRoyale.tournament_id ? "Entering..." : "Enter Free"}
                </button>
              </div>
            )}
          </motion.div>
        </div>
      </section>

      {/* My Entries */}
      {myEntries.length > 0 && (
        <section className="max-w-7xl mx-auto px-6 py-12">
          <h2 className="text-2xl font-black italic uppercase tracking-tighter mb-6 flex items-center gap-3">
            <Flame className="w-6 h-6 text-fuchsia-500" />
            My Entries
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="my-entries-grid">
            {myEntries.slice(0, 6).map((e) => (
              <div
                key={`${e.tournament_id}_${e.joined_at}`}
                className="p-5 rounded-2xl bg-neutral-900/60 border border-white/5 backdrop-blur-sm hover:border-purple-500/40 transition-colors cursor-pointer"
                data-testid={`my-entry-${e.tournament_id}`}
                onClick={() => navigate(`/card-royale/${e.tournament_id}/run`)}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-mono text-purple-400 uppercase tracking-widest">
                    {FORMAT_LABEL[e.tournament_format] || e.tournament_format}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                    e.status === "COMPLETED" ? "bg-emerald-500/20 text-emerald-400" :
                    e.tournament_status === "RUNNING" ? "bg-amber-500/20 text-amber-400" :
                    "bg-purple-500/20 text-purple-400"
                  }`}>
                    {e.status}
                  </span>
                </div>
                <h3 className="text-lg font-bold">{e.tournament_name}</h3>
                <div className="mt-3 flex items-center gap-4 text-sm text-neutral-400">
                  <span>Score: <strong className="text-white">{e.total_score.toFixed(1)}</strong></span>
                  <span>Rounds: <strong className="text-white">{e.rounds_completed}/{e.rounds_total}</strong></span>
                </div>
                <div className="mt-3 h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-fuchsia-500 to-purple-500"
                    style={{ width: `${(e.rounds_completed / Math.max(1, e.rounds_total)) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Active Tournaments */}
      <section className="max-w-7xl mx-auto px-6 py-12">
        <h2 className="text-2xl font-black italic uppercase tracking-tighter mb-6 flex items-center gap-3">
          <Zap className="w-6 h-6 text-fuchsia-500" />
          Active Now
        </h2>
        {loading ? (
          <div className="text-neutral-500" data-testid="card-royale-loading">Loading tournaments...</div>
        ) : active.length === 0 ? (
          <div className="text-neutral-500" data-testid="card-royale-empty-active">
            No tournaments active right now. The scheduler will spin up the next round soon.
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="active-grid">
            {active.map((t) => (
              <TournamentCard
                key={t.tournament_id}
                t={t}
                entering={entering === t.tournament_id}
                onEnter={(useFree) => handleEnter(t, useFree)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Upcoming */}
      <section className="max-w-7xl mx-auto px-6 py-12 border-t border-neutral-900">
        <h2 className="text-2xl font-black italic uppercase tracking-tighter mb-6 flex items-center gap-3">
          <Clock className="w-6 h-6 text-purple-500" />
          Upcoming
        </h2>
        {upcoming.length === 0 ? (
          <div className="text-neutral-500" data-testid="card-royale-empty-upcoming">
            No upcoming tournaments scheduled yet — check back soon.
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="upcoming-grid">
            {upcoming.map((t) => (
              <TournamentCard
                key={t.tournament_id}
                t={t}
                entering={entering === t.tournament_id}
                onEnter={(useFree) => handleEnter(t, useFree)}
                upcoming
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

interface TournamentCardProps {
  t: Tournament;
  entering: boolean;
  onEnter: (useFree: boolean) => void;
  upcoming?: boolean;
}

const TournamentCard: React.FC<TournamentCardProps> = ({ t, entering, onEnter, upcoming }) => {
  return (
    <div
      className="p-6 rounded-2xl bg-gradient-to-br from-neutral-900 to-black border border-white/5 hover:border-purple-500/40 transition-all"
      data-testid={`tournament-card-${t.tournament_id}`}
    >
      <div className="flex items-start justify-between mb-3">
        <span className="text-xs font-mono text-purple-400 uppercase tracking-widest">
          {FORMAT_LABEL[t.format] || t.format}
        </span>
        <span className="text-xs text-neutral-500">
          {upcoming ? fmtRelTime(t.starts_at) : `Ends ${fmtRelTime(t.ends_at)}`}
        </span>
      </div>

      <h3 className="text-xl font-black italic mb-1">{t.name}</h3>
      <p className="text-sm text-neutral-400 mb-4 line-clamp-2">{t.description}</p>

      {/* Round chips */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {t.rounds.map((r) => (
          <span
            key={`${r.round}_${r.game}`}
            className="text-xs px-2 py-1 rounded-md bg-purple-900/40 border border-purple-500/20 font-mono"
            title={`Round ${r.round}: ${r.game}`}
          >
            {GAME_EMOJI[r.game] || "?"} {r.game}
          </span>
        ))}
      </div>

      {/* Pot */}
      <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
        <div className="p-2 rounded-lg bg-fuchsia-950/30">
          <div className="text-[10px] text-fuchsia-400 uppercase tracking-widest">$DSG pool</div>
          <div className="font-bold text-fuchsia-300">{fmtVibez(t.prize_pool_vibez)}</div>
        </div>
        <div className="p-2 rounded-lg bg-amber-950/30">
          <div className="text-[10px] text-amber-400 uppercase tracking-widest">₵ pool</div>
          <div className="font-bold text-amber-300">₵{fmtCoins(t.prize_pool_coins)}</div>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-neutral-500 mb-4">
        <span className="flex items-center gap-1">
          <Users className="w-3 h-3" /> {t.participant_count}/{t.max_participants}
        </span>
        {t.retry_buy_in_coins > 0 && (
          <span className="flex items-center gap-1">
            <Coins className="w-3 h-3" /> Retry ₵{fmtCoins(t.retry_buy_in_coins)}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {t.free_daily_entry && (
          <button
            data-testid={`enter-free-${t.tournament_id}`}
            onClick={() => onEnter(true)}
            disabled={entering || upcoming}
            className="px-3 py-2 rounded-lg bg-gradient-to-r from-fuchsia-500 to-purple-500 text-sm font-bold uppercase tracking-wide hover:scale-105 transition-transform disabled:opacity-40"
          >
            {upcoming ? "Not Open" : entering ? "..." : "Enter Free"}
          </button>
        )}
        {t.retry_buy_in_coins > 0 && !upcoming && (
          <button
            data-testid={`enter-paid-${t.tournament_id}`}
            onClick={() => onEnter(false)}
            disabled={entering}
            className="px-3 py-2 rounded-lg bg-neutral-800 border border-neutral-700 text-sm font-semibold hover:bg-neutral-700 disabled:opacity-40"
          >
            Retry ₵{fmtCoins(t.retry_buy_in_coins)}
          </button>
        )}
      </div>
    </div>
  );
};

export default CardRoyaleLobby;
