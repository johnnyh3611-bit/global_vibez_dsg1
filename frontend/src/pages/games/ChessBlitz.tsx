/**
 * /chess/blitz — 5-minute ranked Blitz vs random AI move generator.
 *
 * The AI is intentionally simple (random legal move with a slight bias
 * toward captures) so the timer is the real opponent. On clock-out the
 * other side wins. Result is POSTed to /api/chess/results so it lands
 * in the Chess Hall stats card.
 */
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import { ArrowLeft, Zap, Loader2 } from "lucide-react";
import { authFetch } from "@/utils/secureAuth";

const API = process.env.REACT_APP_BACKEND_URL;
const CLOCK_MS = 5 * 60 * 1000;

function pickAiMove(chess: Chess): string | null {
  const moves = chess.moves({ verbose: true });
  if (!moves.length) return null;
  // Prefer captures, otherwise random.
  const captures = moves.filter((m: any) => m.captured);
  const pool = captures.length ? captures : moves;
  const pick = pool[Math.floor(Math.random() * pool.length)] as any;
  return pick.from + pick.to + (pick.promotion ?? "");
}

export default function ChessBlitz() {
  const navigate = useNavigate();
  const chessRef = useRef<Chess>(new Chess());
  const [fen, setFen] = useState<string>(chessRef.current.fen());
  const [whiteMs, setWhiteMs] = useState(CLOCK_MS);
  const [blackMs, setBlackMs] = useState(CLOCK_MS);
  const [turn, setTurn] = useState<"w" | "b">("w");
  const [status, setStatus] = useState<"playing" | "won" | "lost" | "draw">("playing");
  const [busy, setBusy] = useState(false);

  // Run the 100ms clock tick.
  useEffect(() => {
    if (status !== "playing") return;
    const id = setInterval(() => {
      if (turn === "w") {
        setWhiteMs((ms) => {
          const next = ms - 100;
          if (next <= 0) {
            setStatus("lost");
            return 0;
          }
          return next;
        });
      } else {
        setBlackMs((ms) => {
          const next = ms - 100;
          if (next <= 0) {
            setStatus("won");
            return 0;
          }
          return next;
        });
      }
    }, 100);
    return () => clearInterval(id);
  }, [turn, status]);

  // AI moves whenever it's black's turn.
  useEffect(() => {
    if (status !== "playing" || turn !== "b") return;
    const timeout = setTimeout(() => {
      const uci = pickAiMove(chessRef.current);
      if (!uci) return;
      const m = chessRef.current.move({
        from: uci.slice(0, 2),
        to: uci.slice(2, 4),
        promotion: uci.slice(4) || "q",
      });
      if (m) {
        setFen(chessRef.current.fen());
        setTurn("w");
        evaluateEndgame();
      }
    }, 500 + Math.random() * 700);
    return () => clearTimeout(timeout);
  }, [turn, status]);

  // Persist on terminal state.
  useEffect(() => {
    if (status === "playing" || busy) return;
    setBusy(true);
    const outcome = status === "won" ? "win" : status === "lost" ? "loss" : "draw";
    const duration_s = Math.round((CLOCK_MS - whiteMs) / 1000);
    authFetch(`${API}/api/chess/results`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "blitz", outcome, duration_s }),
    }).catch(() => undefined).finally(() => setBusy(false));
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  const evaluateEndgame = () => {
    const c = chessRef.current;
    if (c.isCheckmate()) {
      setStatus(c.turn() === "w" ? "lost" : "won");
    } else if (c.isDraw() || c.isStalemate() || c.isThreefoldRepetition()) {
      setStatus("draw");
    }
  };

  const onDrop = (from: string, to: string) => {
    if (status !== "playing" || turn !== "w") return false;
    try {
      const move = chessRef.current.move({ from, to, promotion: "q" });
      if (!move) return false;
      setFen(chessRef.current.fen());
      setTurn("b");
      evaluateEndgame();
      return true;
    } catch {
      return false;
    }
  };

  const restart = () => {
    chessRef.current = new Chess();
    setFen(chessRef.current.fen());
    setWhiteMs(CLOCK_MS);
    setBlackMs(CLOCK_MS);
    setTurn("w");
    setStatus("playing");
  };

  const fmt = (ms: number) => {
    const total = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  return (
    <div className="min-h-screen bg-[#0a0d18] text-slate-100">
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/10 backdrop-blur-md">
        <button onClick={() => navigate(-1)} className="text-sm flex items-center gap-2 text-white/70 hover:text-white" data-testid="chess-blitz-back">
          <ArrowLeft className="w-4 h-4" /> Hall
        </button>
        <h1 className="text-base md:text-xl tracking-[0.3em] uppercase text-amber-200 flex items-center gap-2">
          <Zap className="w-5 h-5" /> 5-min Blitz
        </h1>
        <div className="text-[10px] uppercase tracking-widest text-white/40 hidden md:block">vs AI</div>
      </header>

      <main className="max-w-md mx-auto px-4 py-6">
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className={`rounded-xl px-4 py-3 text-center border ${turn === "b" ? "bg-rose-500/15 border-rose-400/40 text-rose-200" : "bg-white/5 border-white/10 text-white/60"}`} data-testid="chess-blitz-black-clock">
            <p className="text-[10px] uppercase tracking-widest">AI</p>
            <p className="text-2xl font-black tabular-nums">{fmt(blackMs)}</p>
          </div>
          <div className={`rounded-xl px-4 py-3 text-center border ${turn === "w" ? "bg-emerald-500/15 border-emerald-400/40 text-emerald-200" : "bg-white/5 border-white/10 text-white/60"}`} data-testid="chess-blitz-white-clock">
            <p className="text-[10px] uppercase tracking-widest">You</p>
            <p className="text-2xl font-black tabular-nums">{fmt(whiteMs)}</p>
          </div>
        </div>

        <div className="rounded-2xl overflow-hidden border border-white/10" data-testid="chess-blitz-board">
          <Chessboard
            id="ChessBlitz"
            position={fen}
            onPieceDrop={onDrop}
            arePiecesDraggable={status === "playing" && turn === "w"}
            boardOrientation="white"
            customBoardStyle={{ borderRadius: 12 }}
          />
        </div>

        {status !== "playing" && (
          <div className="mt-5 text-center rounded-2xl bg-black/60 border border-amber-400/30 p-5" data-testid="chess-blitz-result">
            <p className="text-2xl font-black text-white">
              {status === "won" ? "Checkmate · You win" : status === "lost" ? "Time / Checkmate · You lose" : "Draw"}
            </p>
            <button
              onClick={restart}
              data-testid="chess-blitz-restart"
              className="mt-4 px-6 py-2 rounded-full bg-amber-400 hover:bg-amber-300 text-black text-xs font-black uppercase tracking-widest transition-colors"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Rematch"}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
