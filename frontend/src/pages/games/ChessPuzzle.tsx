/**
 * /chess/puzzle — Daily Puzzle (founder ask 2026-05-10).
 *
 * Loads /api/chess/puzzles/daily, presents the position, validates each
 * move against /api/chess/puzzles/submit. On success → POST result.
 */
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import { ArrowLeft, Puzzle, Lightbulb, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { authFetch } from "@/utils/secureAuth";

const API = process.env.REACT_APP_BACKEND_URL;

type DailyPuzzle = {
  id: string;
  rating: number;
  theme: string;
  fen: string;
  hint: string;
};

export default function ChessPuzzle() {
  const navigate = useNavigate();
  const chessRef = useRef<Chess | null>(null);
  const [puzzle, setPuzzle] = useState<DailyPuzzle | null>(null);
  const [fen, setFen] = useState<string>("start");
  const [feedback, setFeedback] = useState<"idle" | "correct" | "wrong" | "solved">("idle");
  const [showHint, setShowHint] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const loadPuzzle = async () => {
    setLoading(true);
    setFeedback("idle");
    try {
      const r = await fetch(`${API}/api/chess/puzzles/daily`);
      const d = await r.json();
      const p: DailyPuzzle = d?.puzzle;
      setPuzzle(p);
      chessRef.current = new Chess(p.fen);
      setFen(p.fen);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadPuzzle(); }, []);

  const onDrop = async (from: string, to: string) => {
    if (!puzzle || !chessRef.current || feedback === "solved") return false;
    setSubmitting(true);
    try {
      const r = await authFetch(`${API}/api/chess/puzzles/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ puzzle_id: puzzle.id, move_uci: `${from}${to}` }),
      });
      const d = await r.json();
      if (d?.correct) {
        // Apply the move locally so the board updates.
        try {
          chessRef.current.move({ from, to, promotion: "q" });
          setFen(chessRef.current.fen());
        } catch { /* ignore */ }
        if (d?.solved) {
          setFeedback("solved");
          authFetch(`${API}/api/chess/results`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mode: "puzzle", outcome: "win" }),
          }).catch(() => undefined);
        } else {
          setFeedback("correct");
        }
      } else {
        setFeedback("wrong");
      }
      return d?.correct === true;
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0d18] text-slate-100">
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/10 backdrop-blur-md">
        <button onClick={() => navigate(-1)} className="text-sm flex items-center gap-2 text-white/70 hover:text-white" data-testid="chess-puzzle-back">
          <ArrowLeft className="w-4 h-4" /> Hall
        </button>
        <h1 className="text-base md:text-xl tracking-[0.3em] uppercase text-amber-200 flex items-center gap-2">
          <Puzzle className="w-5 h-5" /> Daily Puzzle
        </h1>
        <div className="text-[10px] uppercase tracking-widest text-white/40 hidden md:block">
          {puzzle ? `Rating · ${puzzle.rating}` : "—"}
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-6">
        {loading ? (
          <p className="text-white/40 text-xs flex items-center gap-2 justify-center mt-12" data-testid="chess-puzzle-loading">
            <Loader2 className="w-3 h-3 animate-spin" /> Loading today's puzzle…
          </p>
        ) : (
          <>
            <div className="rounded-xl px-4 py-3 mb-4 text-center bg-white/5 border border-white/10" data-testid="chess-puzzle-theme">
              <p className="text-[10px] uppercase tracking-widest text-amber-300/70">Theme</p>
              <p className="text-base font-black text-white">{puzzle?.theme.replace(/_/g, " ")}</p>
            </div>

            <div className="rounded-2xl overflow-hidden border border-white/10" data-testid="chess-puzzle-board">
              <Chessboard
                id="ChessPuzzle"
                position={fen}
                onPieceDrop={onDrop}
                arePiecesDraggable={feedback !== "solved" && !submitting}
                boardOrientation="white"
                customBoardStyle={{ borderRadius: 12 }}
              />
            </div>

            <div className="mt-4 flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={() => setShowHint((v) => !v)}
                data-testid="chess-puzzle-hint-toggle"
                className="text-xs text-amber-200 hover:text-amber-100 underline-offset-2 hover:underline flex items-center gap-1"
              >
                <Lightbulb className="w-3 h-3" /> {showHint ? "Hide hint" : "Show hint"}
              </button>
              {showHint && (
                <p className="text-xs text-white/70 text-center max-w-xs" data-testid="chess-puzzle-hint">
                  {puzzle?.hint}
                </p>
              )}
            </div>

            {feedback !== "idle" && (
              <div
                data-testid="chess-puzzle-feedback"
                className={`mt-4 rounded-2xl p-4 text-center border ${
                  feedback === "solved" ? "bg-emerald-500/15 border-emerald-400/30 text-emerald-100"
                  : feedback === "correct" ? "bg-sky-500/15 border-sky-400/30 text-sky-100"
                  : "bg-rose-500/15 border-rose-400/30 text-rose-100"
                }`}
              >
                {feedback === "solved" ? <CheckCircle2 className="w-8 h-8 mx-auto" /> : feedback === "correct" ? <CheckCircle2 className="w-8 h-8 mx-auto" /> : <XCircle className="w-8 h-8 mx-auto" />}
                <p className="text-sm font-black mt-2">
                  {feedback === "solved" ? "Solved!" : feedback === "correct" ? "Correct · keep going" : "Not quite — try another move"}
                </p>
                {feedback === "wrong" && (
                  <button
                    onClick={() => {
                      if (puzzle) {
                        chessRef.current = new Chess(puzzle.fen);
                        setFen(puzzle.fen);
                        setFeedback("idle");
                      }
                    }}
                    data-testid="chess-puzzle-retry"
                    className="mt-3 px-5 py-2 rounded-full bg-rose-400 hover:bg-rose-300 text-black text-xs font-black uppercase tracking-widest"
                  >
                    Reset position
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
