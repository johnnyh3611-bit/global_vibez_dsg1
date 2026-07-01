/**
 * /sports-lounge — Vibe Sports Book (Sports Lounge Blueprint PDF, May 2026).
 *
 * The 360° immersive theatre isn't possible in 2D React without Three.js;
 * this is the FUNCTIONAL MVP: Jumbotron at top, betting pits (game cards)
 * in a 3-column grid below, real-time tickers along the top/bottom edges
 * showing $VIBEZ + recent settlements. Wagers flow through the existing
 * /api/sports/* Vibe Vault Escrow.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Trophy, Loader2, TrendingUp, Tv } from "lucide-react";
import { authFetch } from "@/utils/secureAuth";
import VibeCheckReport from "@/components/sports/VibeCheckReport";

const API = process.env.REACT_APP_BACKEND_URL;

type Team = { id: string; name: string; color: string };
type Game = {
  game_id: string; sport: string; league: string; kickoff_iso: string;
  home: Team; away: Team; odds: { home: number; away: number; draw: number | null };
  status: string;
};
type Bet = {
  bet_id: string; game_id: string; choice: string; amount: number;
  locked_odds: number; status: string; payout_vibe: number; sport?: string; league?: string;
};
type JumboRow = { game_id: string; choice: string; amount: number; status: string; payout_vibe: number; user_id: string };

const STAKE_PRESETS = [50, 250, 1000, 5000];

export default function SportsLounge() {
  const navigate = useNavigate();
  const [games, setGames] = useState<Game[]>([]);
  const [bets, setBets] = useState<Bet[]>([]);
  const [jumbo, setJumbo] = useState<JumboRow[]>([]);
  const [botd, setBotd] = useState<BetOfDay>(null);
  const [rapidConnected, setRapidConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stake, setStake] = useState<number>(50);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    const [g, b, j, botd] = await Promise.all([
      fetch(`${API}/api/sports/games`).then((r) => r.json()),
      authFetch(`${API}/api/sports/my-bets?limit=10`).then((r) => r.json()).catch(() => ({ rows: [] })),
      fetch(`${API}/api/sports/jumbotron`).then((r) => r.json()),
      fetch(`${API}/api/sports/bet-of-the-day`).then((r) => r.json()),
    ]);
    setGames(g?.games || []);
    setRapidConnected(!!g?.rapidapi_connected);
    setBets((b?.rows as Bet[]) || []);
    setJumbo((j?.rows as JumboRow[]) || []);
    setBotd((botd?.hit as BetOfDay) || null);
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      try { await refresh(); } finally { setLoading(false); }
    })();
    const id = setInterval(refresh, 30000); // 30s ticker refresh
    return () => clearInterval(id);
  }, []);

  const placeBet = async (game: Game, choice: string) => {
    setBusy(`${game.game_id}:${choice}`);
    setError(null);
    try {
      const r = await authFetch(`${API}/api/sports/place-bet`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ game_id: game.game_id, choice, amount: stake }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.detail || "Couldn't place bet");
      await refresh();
    } catch (e: any) {
      setError(e?.message || "Network error");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#040810] text-white">
      <header className="flex items-center justify-between px-6 py-4 border-b border-cyan-500/15 backdrop-blur-md">
        <button onClick={() => navigate(-1)} className="text-sm flex items-center gap-2 text-white/70 hover:text-white" data-testid="sports-lounge-back">
          <ArrowLeft className="w-4 h-4" /> Exit
        </button>
        <h1 className="text-base md:text-xl tracking-[0.3em] uppercase text-cyan-200 flex items-center gap-2">
          <Tv className="w-5 h-5" /> Vibe Sports Book
        </h1>
        <div className="text-[10px] uppercase tracking-widest text-white/40 hidden md:block">
          {rapidConnected ? "🟢 Live odds" : "🛡 Crowd-judged · Vibe Check oracle"}
        </div>
      </header>

      {/* Top ticker — Bet of the Day pin + last 8 settlements */}
      <div className="border-b border-white/5 bg-black/40 overflow-hidden" data-testid="sports-jumbotron-ticker">
        <div className="flex gap-6 px-6 py-2 text-[11px] font-mono whitespace-nowrap overflow-x-auto">
          {botd && (
            <span className="text-amber-300 font-black tabular-nums" data-testid="sports-bet-of-the-day">
              🔥 BET OF THE DAY · {botd.user_id} · {botd.choice.toUpperCase()} · ₵{botd.amount.toLocaleString()} @ {botd.locked_odds?.toFixed(2)}x
            </span>
          )}
          {jumbo.length === 0 && !botd ? (
            <span className="text-white/40">No settlements yet — be the first.</span>
          ) : (
            jumbo.map((j) => (
              <span key={j.game_id + j.user_id} className={`tabular-nums ${j.status === "won" ? "text-emerald-300" : "text-rose-300/70"}`}>
                {j.user_id} · {j.choice} · ₵{j.amount.toLocaleString()} → {j.status === "won" ? `+₵${j.payout_vibe.toLocaleString()}` : "—"}
              </span>
            ))
          )}
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* Stake selector */}
        <div className="mb-4 flex items-center gap-2 flex-wrap" data-testid="sports-stake-row">
          <p className="text-[10px] uppercase tracking-widest text-cyan-300/70 mr-2">Stake:</p>
          {STAKE_PRESETS.map((v) => (
            <button
              type="button"
              key={v}
              onClick={() => setStake(v)}
              data-testid={`sports-stake-${v}`}
              className={`px-3 py-1 rounded-full text-xs font-black transition ${
                stake === v ? "bg-amber-400 text-black" : "bg-white/5 text-white hover:bg-white/10 border border-white/10"
              }`}
            >
              ₵{v.toLocaleString()}
            </button>
          ))}
        </div>

        {error && <p className="text-rose-300 text-xs mb-3" data-testid="sports-error">{error}</p>}

        {loading ? (
          <p className="text-white/40 text-xs flex items-center gap-2 justify-center mt-12">
            <Loader2 className="w-3 h-3 animate-spin" /> Loading fixtures…
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="sports-games-grid">
            {games.map((g) => (
              <div key={g.game_id} className="rounded-2xl bg-black/60 border border-white/10 p-4" data-testid={`sports-game-${g.game_id}`}>
                <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-cyan-300/70">
                  <span>{g.sport}</span>
                  <span>{new Date(g.kickoff_iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
                <p className="text-[10px] text-white/40 mt-0.5">{g.league}</p>
                <div className="grid grid-cols-2 gap-2 mt-3">
                  <BetPit team={g.home} odds={g.odds.home} side="home" onPick={() => placeBet(g, g.home.id)} busy={busy === `${g.game_id}:${g.home.id}`} />
                  <BetPit team={g.away} odds={g.odds.away} side="away" onPick={() => placeBet(g, g.away.id)} busy={busy === `${g.game_id}:${g.away.id}`} />
                </div>
                {g.odds.draw !== null && g.odds.draw !== undefined && (
                  <button
                    type="button"
                    onClick={() => placeBet(g, "draw")}
                    data-testid={`sports-bet-${g.game_id}-draw`}
                    disabled={busy === `${g.game_id}:draw`}
                    className="mt-2 w-full rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-1.5 text-xs text-white/70 transition flex justify-between"
                  >
                    <span>Draw</span>
                    <span className="font-black tabular-nums">{g.odds.draw.toFixed(2)}x</span>
                  </button>
                )}
                <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-end">
                  <VibeCheckReport
                    gameId={g.game_id}
                    homeName={g.home.name}
                    awayName={g.away.name}
                    homeId={g.home.id}
                    awayId={g.away.id}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* My bets */}
        {bets.length > 0 && (
          <div className="rounded-2xl bg-black/60 border border-white/10 p-5 mt-6" data-testid="sports-my-bets">
            <h3 className="text-sm uppercase tracking-widest text-amber-300 flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4" /> My bets
            </h3>
            <ul className="space-y-1.5">
              {bets.map((b) => (
                <li key={b.bet_id} className="flex items-center justify-between text-xs rounded-md bg-black/40 border border-white/5 px-3 py-2" data-testid={`sports-bet-row-${b.bet_id}`}>
                  <span className="font-mono text-white/70">
                    {b.choice} · ₵{b.amount.toLocaleString()} @ {b.locked_odds?.toFixed(2)}x
                  </span>
                  <span className={`text-[10px] uppercase tracking-widest ${b.status === "won" ? "text-emerald-300" : b.status === "lost" ? "text-rose-300/70" : "text-amber-300"}`}>
                    {b.status}{b.payout_vibe ? ` · +₵${b.payout_vibe.toLocaleString()}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {games.length === 0 && !loading && (
          <div className="rounded-2xl bg-black/40 border border-white/10 p-5 mt-6 text-center text-white/50 text-xs uppercase tracking-widest" data-testid="sports-empty">
            <Trophy className="w-5 h-5 mx-auto mb-2 opacity-50" />
            No games on the board right now. Check back at kickoff.
          </div>
        )}
      </main>
    </div>
  );
}

function BetPit({ team, odds, side, onPick, busy }: { team: Team; odds: number; side: string; onPick: () => void; busy: boolean }) {
  return (
    <button
      type="button"
      onClick={onPick}
      disabled={busy}
      data-testid={`sports-bet-${side}-${team.id}`}
      className="rounded-lg p-3 text-left transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-50"
      style={{
        background: `linear-gradient(135deg, ${team.color}22 0%, rgba(0,0,0,0.4) 100%)`,
        border: `1px solid ${team.color}55`,
      }}
    >
      <p className="text-xs font-black text-white truncate">{team.name}</p>
      <p className="text-base font-black tabular-nums" style={{ color: team.color }}>
        {busy ? <Loader2 className="w-3 h-3 animate-spin inline" /> : `${odds.toFixed(2)}x`}
      </p>
    </button>
  );
}
