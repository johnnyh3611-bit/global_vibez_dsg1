/**
 * /chess/tournament — 4-player bracket queue (founder ask 2026-05-10).
 *
 * Single-button "Join queue" → polls /api/chess/tournament/status every
 * 3 seconds until a bracket is created. Shows the live bracket once
 * playing. First-round / final match links into Multiplayer Chess for
 * the actual play.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Trophy, Loader2, Users } from "lucide-react";
import { authFetch } from "@/utils/secureAuth";

const API = process.env.REACT_APP_BACKEND_URL;

type Match = { player_a: string; player_b: string; winner: string | null };
type Bracket = { bracket_id: string; players: string[]; round_1: Match[]; final: Match | null; champion: string | null; status: string };
type Status =
  | { status: "idle" }
  | { status: "waiting"; in_queue: number; needed: number }
  | { status: "playing"; bracket: Bracket };

export default function ChessTournament() {
  const navigate = useNavigate();
  const [data, setData] = useState<Status>({ status: "idle" });
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    try {
      const r = await authFetch(`${API}/api/chess/tournament/status`);
      const d = await r.json();
      setData(d);
    } catch {
      // ignore
    }
  };

  useEffect(() => { refresh(); }, []);

  // Poll every 3s while waiting.
  useEffect(() => {
    if (data.status !== "waiting") return;
    const id = setInterval(refresh, 3000);
    return () => clearInterval(id);
  }, [data.status]);

  const join = async () => {
    setBusy(true);
    try {
      const r = await authFetch(`${API}/api/chess/tournament/join`, { method: "POST" });
      const d = await r.json();
      if (d?.status === "bracket_created") {
        setData({ status: "playing", bracket: d.bracket });
      } else {
        refresh();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0d18] text-slate-100">
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/10 backdrop-blur-md">
        <button onClick={() => navigate(-1)} className="text-sm flex items-center gap-2 text-white/70 hover:text-white" data-testid="chess-tournament-back">
          <ArrowLeft className="w-4 h-4" /> Hall
        </button>
        <h1 className="text-base md:text-xl tracking-[0.3em] uppercase text-amber-200 flex items-center gap-2">
          <Trophy className="w-5 h-5" /> Tournament
        </h1>
        <div className="text-[10px] uppercase tracking-widest text-white/40 hidden md:block">4-player bracket</div>
      </header>

      <main className="max-w-md mx-auto px-4 py-8">
        {data.status === "idle" && (
          <div className="rounded-2xl bg-black/60 border border-amber-400/30 p-6 text-center" data-testid="chess-tournament-idle">
            <Trophy className="w-12 h-12 text-amber-300 mx-auto" />
            <h2 className="text-2xl font-black text-white mt-3">Join the bracket</h2>
            <p className="text-white/60 text-sm mt-2">
              When 4 players queue up, a single-elimination bracket fires. Winners advance to the final. Whole thing takes about 15 minutes.
            </p>
            <button
              onClick={join}
              disabled={busy}
              data-testid="chess-tournament-join"
              className="mt-5 px-8 py-3 rounded-full bg-amber-400 hover:bg-amber-300 text-black text-xs font-black uppercase tracking-widest disabled:opacity-40 inline-flex items-center gap-2"
            >
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}
              Join queue
            </button>
          </div>
        )}

        {data.status === "waiting" && (
          <div className="rounded-2xl bg-black/60 border border-amber-400/30 p-6 text-center" data-testid="chess-tournament-waiting">
            <Users className="w-12 h-12 text-amber-300 mx-auto animate-pulse" />
            <h2 className="text-2xl font-black text-white mt-3">Waiting for players</h2>
            <p className="text-white/60 text-sm mt-2">
              {data.in_queue} in queue · {data.needed} more needed to start the bracket.
            </p>
            <p className="text-[10px] uppercase tracking-widest text-amber-300/70 mt-4">Polling every 3s</p>
          </div>
        )}

        {data.status === "playing" && (
          <div className="rounded-2xl bg-black/60 border border-amber-400/30 p-6" data-testid="chess-tournament-bracket">
            <h2 className="text-2xl font-black text-white text-center">Bracket live</h2>
            <p className="text-[10px] uppercase tracking-widest text-amber-300/70 text-center mt-1">
              ID · {data.bracket.bracket_id}
            </p>

            <div className="mt-5 space-y-3">
              <p className="text-[10px] uppercase tracking-widest text-white/50">Round 1</p>
              {data.bracket.round_1.map((m, i) => (
                <div key={`r1-${i}`} className="rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-xs">
                  <span className="font-mono">{m.player_a.slice(0, 10)}</span>
                  <span className="text-white/40 mx-2">vs</span>
                  <span className="font-mono">{m.player_b.slice(0, 10)}</span>
                  {m.winner && (
                    <span className="ml-2 text-emerald-300 font-black">→ {m.winner.slice(0, 10)}</span>
                  )}
                </div>
              ))}
              {data.bracket.final && (
                <>
                  <p className="text-[10px] uppercase tracking-widest text-amber-300/80 mt-4">Final</p>
                  <div className="rounded-lg bg-amber-500/10 border border-amber-400/30 px-3 py-2 text-xs">
                    <span className="font-mono">{data.bracket.final.player_a.slice(0, 10)}</span>
                    <span className="text-white/40 mx-2">vs</span>
                    <span className="font-mono">{data.bracket.final.player_b.slice(0, 10)}</span>
                  </div>
                </>
              )}
              {data.bracket.champion && (
                <p className="mt-4 text-center text-2xl font-black text-amber-300" data-testid="chess-tournament-champion">
                  🏆 {data.bracket.champion.slice(0, 10)}
                </p>
              )}
            </div>

            <button
              onClick={() => navigate("/chess/multiplayer")}
              data-testid="chess-tournament-enter-match"
              className="mt-6 w-full px-5 py-3 rounded-full bg-amber-400 hover:bg-amber-300 text-black text-xs font-black uppercase tracking-widest"
            >
              Enter my match
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
