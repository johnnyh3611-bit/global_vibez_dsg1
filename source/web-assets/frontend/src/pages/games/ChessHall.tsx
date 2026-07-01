/**
 * /chess-hall — Chess Hall lobby (founder ask 2026-05-10, option 4b+c).
 *
 * Lists every chess mode: Classic AI · Multiplayer · Blitz (5-min) ·
 * Daily Puzzle · Tournament queue. Shows the player's stats tally.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Crown, Swords, Zap, Puzzle, Users, ArrowLeft, Loader2, Trophy,
} from "lucide-react";
import { authFetch } from "@/utils/secureAuth";

const API = process.env.REACT_APP_BACKEND_URL;

type Tally = Record<string, { win: number; loss: number; draw: number }>;

const MODES = [
  { id: "classic", label: "Classic vs AI", path: "/practice/play/chess", icon: Crown, sub: "Casual · pick your opponent · no clock" },
  { id: "blitz", label: "5-min Blitz", path: "/chess/blitz", icon: Zap, sub: "5-minute clock · ranked" },
  { id: "puzzle", label: "Daily Puzzle", path: "/chess/puzzle", icon: Puzzle, sub: "One curated position · solve it" },
  { id: "tournament", label: "Tournament", path: "/chess/tournament", icon: Trophy, sub: "4-player bracket · winner takes pool" },
  { id: "multiplayer", label: "Multiplayer", path: "/chess/multiplayer", icon: Users, sub: "Head-to-head vs another player" },
];

export default function ChessHall() {
  const navigate = useNavigate();
  const [tally, setTally] = useState<Tally>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const r = await authFetch(`${API}/api/chess/stats?limit=10`);
        const d = await r.json();
        setTally(d?.tally_by_mode || {});
      } catch {
        // unauth or empty — show defaults
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0d18] text-slate-100">
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/10 backdrop-blur-md">
        <button onClick={() => navigate(-1)} className="text-sm flex items-center gap-2 text-white/70 hover:text-white" data-testid="chess-hall-back">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <h1 className="text-base md:text-xl tracking-[0.3em] uppercase text-amber-200 flex items-center gap-3">
          <Swords className="w-5 h-5" /> Chess Hall
        </h1>
        <div className="text-[10px] uppercase tracking-widest text-white/40 hidden md:block">5 modes</div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" data-testid="chess-hall-modes">
          {MODES.map((m) => {
            const Icon = m.icon;
            const t = tally[m.id] || { win: 0, loss: 0, draw: 0 };
            const total = t.win + t.loss + t.draw;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => navigate(m.path)}
                data-testid={`chess-hall-mode-${m.id}`}
                className="text-left rounded-2xl p-5 transition-transform hover:scale-[1.02] active:scale-95 bg-gradient-to-br from-slate-900/80 to-slate-950/90 border border-white/10 hover:border-amber-400/40 group"
              >
                <Icon className="w-6 h-6 mb-2 text-amber-300" />
                <p className="text-base font-black text-white">{m.label}</p>
                <p className="text-[11px] text-white/50 mt-0.5">{m.sub}</p>
                {total > 0 && (
                  <p className="text-[10px] uppercase tracking-widest mt-2 text-emerald-300/80 tabular-nums" data-testid={`chess-hall-tally-${m.id}`}>
                    {t.win}W · {t.loss}L · {t.draw}D
                  </p>
                )}
                <p className="text-[10px] uppercase tracking-widest mt-2 text-white/30 group-hover:text-amber-200 transition-colors">
                  Enter →
                </p>
              </button>
            );
          })}
        </div>

        {loading && (
          <p className="text-white/40 text-xs flex items-center gap-2 mt-4 justify-center">
            <Loader2 className="w-3 h-3 animate-spin" /> Loading stats…
          </p>
        )}
      </main>
    </div>
  );
}
