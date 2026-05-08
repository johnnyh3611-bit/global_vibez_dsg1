/**
 * Bingo — DSG 30-Second Social variant
 * Wires to /api/games/bingo/* (constants, card/generate, draw, evaluate)
 */
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, RotateCcw, Sparkles, Trophy } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

interface BingoCardData { cells: number[][]; daubed: number[]; }
interface DrawResult { number: number; letter: string; called: string; }
interface EvalResult {
  has_win: boolean; patterns: string[];
  is_sovereign_square: boolean; final_multiplier: number;
  gross_payout: number; sovereign_tax: number; net_payout: number;
}

export default function Bingo() {
  const nav = useNavigate();
  const [card, setCard] = useState<BingoCardData | null>(null);
  const [stake, setStake] = useState(1.0);
  const [calledNumbers, setCalledNumbers] = useState<DrawResult[]>([]);
  const [evalResult, setEvalResult] = useState<EvalResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [autoDrawing, setAutoDrawing] = useState(false);

  useEffect(() => { newCard(); }, []);

  const newCard = useCallback(async () => {
    setEvalResult(null);
    setCalledNumbers([]);
    const res = await fetch(`${API}/api/games/bingo/card/generate`, { method: "POST" }).then(r => r.json());
    setCard({ cells: res.cells, daubed: res.daubed });
  }, []);

  const drawNumber = useCallback(async () => {
    if (!card || busy) return;
    setBusy(true);
    const alreadyCalled = calledNumbers.map(c => c.number);
    if (alreadyCalled.length >= 75) { setBusy(false); return; }
    const res: DrawResult = await fetch(`${API}/api/games/bingo/draw`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ already_called: alreadyCalled }),
    }).then(r => r.json());
    setCalledNumbers(prev => [...prev, res]);
    // Auto-daub if card has the number
    setCard(prev => {
      if (!prev) return prev;
      const newDaubed = [...prev.daubed];
      for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 5; c++) {
          if (prev.cells[r][c] === res.number) {
            const idx = r * 5 + c;
            if (!newDaubed.includes(idx)) newDaubed.push(idx);
          }
        }
      }
      return { ...prev, daubed: newDaubed };
    });
    setBusy(false);
  }, [card, busy, calledNumbers]);

  const evaluate = useCallback(async () => {
    if (!card) return;
    const res: EvalResult = await fetch(`${API}/api/games/bingo/evaluate`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cells: card.cells, daubed: card.daubed, stake }),
    }).then(r => r.json());
    setEvalResult(res);
  }, [card, stake]);

  const toggleAuto = () => setAutoDrawing(prev => !prev);

  useEffect(() => {
    if (!autoDrawing) return;
    const id = setInterval(() => {
      if (calledNumbers.length < 75) drawNumber();
      else setAutoDrawing(false);
    }, 1500);
    return () => clearInterval(id);
  }, [autoDrawing, drawNumber, calledNumbers.length]);

  const lastCalled = calledNumbers[calledNumbers.length - 1];
  const COLORS: Record<string, string> = { B: "from-cyan-500 to-blue-600", I: "from-fuchsia-500 to-pink-600", N: "from-purple-500 to-violet-600", G: "from-emerald-500 to-green-600", O: "from-orange-500 to-red-600" };

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-purple-950/15 to-black text-white" data-testid="bingo-page">
      <div className="sticky top-0 z-30 backdrop-blur-md bg-black/70 border-b border-white/10">
        <div className="max-w-5xl mx-auto px-5 py-3 flex items-center gap-4">
          <button onClick={() => nav(-1)} data-testid="bingo-back-btn" className="p-2 rounded-lg hover:bg-white/10"><ArrowLeft className="w-5 h-5" /></button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-fuchsia-400" />
              <h1 className="text-lg font-black tracking-wide">Bingo</h1>
              <span className="text-[10px] font-mono uppercase tracking-widest text-fuchsia-300 bg-fuchsia-500/10 border border-fuchsia-500/30 px-2 py-0.5 rounded">SOVEREIGN SQUARE 2×</span>
            </div>
            <p className="text-xs text-neutral-400 mt-0.5">75-ball · Auto-daub · 4 corners + center = 2× payout</p>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-5 py-6 grid lg:grid-cols-2 gap-5">
        {/* Card */}
        <div className="rounded-2xl border border-white/10 bg-black/40 p-5">
          <div className="grid grid-cols-5 gap-1 mb-3">
            {["B","I","N","G","O"].map(l => (
              <div key={l} className={`h-12 rounded-lg flex items-center justify-center font-black text-2xl bg-gradient-to-b ${COLORS[l]}`}>{l}</div>
            ))}
          </div>
          <div className="grid grid-cols-5 gap-1" data-testid="bingo-grid">
            {card?.cells.flatMap((row, r) => row.map((val, c) => {
              const idx = r * 5 + c;
              const daubed = card.daubed.includes(idx);
              const isFree = idx === 12;
              return (
                <motion.div
                  key={idx}
                  data-testid={`bingo-cell-${idx}`}
                  whileTap={{ scale: 0.95 }}
                  className={`aspect-square rounded-lg flex items-center justify-center font-bold text-lg transition-colors ${
                    isFree ? "bg-yellow-500 text-black" :
                    daubed ? "bg-emerald-500/80 text-black ring-2 ring-emerald-300" :
                    "bg-white/5 hover:bg-white/10 text-neutral-200"
                  }`}
                >
                  {isFree ? "★" : val}
                </motion.div>
              );
            }))}
          </div>
          <div className="mt-4 flex flex-wrap gap-3 justify-center">
            <button onClick={newCard} data-testid="bingo-new-card-btn" className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-sm flex items-center gap-1"><RotateCcw className="w-3 h-3" /> New Card</button>
            <button onClick={drawNumber} disabled={busy || calledNumbers.length >= 75} data-testid="bingo-draw-btn" className="px-4 py-2 rounded-full bg-fuchsia-500 hover:bg-fuchsia-400 text-black font-bold text-sm disabled:opacity-50">Draw Number</button>
            <button onClick={toggleAuto} data-testid="bingo-auto-btn" className={`px-4 py-2 rounded-full text-sm font-bold ${autoDrawing ? "bg-rose-500 text-white" : "bg-cyan-500 text-black hover:bg-cyan-400"}`}>{autoDrawing ? "STOP AUTO" : "AUTO DRAW"}</button>
            <button onClick={evaluate} data-testid="bingo-eval-btn" className="px-4 py-2 rounded-full bg-yellow-400 hover:bg-yellow-300 text-black font-bold text-sm">Check Bingo!</button>
          </div>
        </div>

        {/* Caller + status */}
        <div className="space-y-4">
          <div className="rounded-2xl border-2 border-yellow-400 bg-gradient-to-br from-yellow-900/20 via-black to-fuchsia-900/10 p-6 text-center">
            <p className="text-[10px] uppercase tracking-widest text-yellow-200 mb-2">LAST CALLED</p>
            <AnimatePresence mode="wait">
              {lastCalled ? (
                <motion.div key={lastCalled.number} initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }} className="text-7xl font-black text-yellow-300" data-testid="bingo-last-called">
                  {lastCalled.called}
                </motion.div>
              ) : (
                <div className="text-2xl text-neutral-600">Press DRAW</div>
              )}
            </AnimatePresence>
            <p className="mt-2 text-xs font-mono text-neutral-400">{calledNumbers.length} / 75 numbers called</p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
            <p className="text-[10px] uppercase tracking-widest text-neutral-400 mb-2">Called Numbers</p>
            <div className="flex flex-wrap gap-1 max-h-40 overflow-y-auto">
              {calledNumbers.map((c, i) => (
                <span key={i} className={`text-xs font-mono px-2 py-1 rounded bg-gradient-to-br ${COLORS[c.letter]}`}>{c.called}</span>
              ))}
              {calledNumbers.length === 0 && <span className="text-neutral-600 text-xs">none yet</span>}
            </div>
          </div>

          {evalResult && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} data-testid="bingo-eval-result" className={`rounded-2xl border-2 p-5 ${evalResult.has_win ? "border-emerald-400 bg-emerald-900/20" : "border-rose-500/40 bg-rose-950/10"}`}>
              <div className="flex items-center gap-2 mb-2">
                <Trophy className={`w-5 h-5 ${evalResult.has_win ? "text-emerald-300" : "text-rose-400"}`} />
                <h3 className="font-bold uppercase tracking-widest text-sm">{evalResult.has_win ? "BINGO!" : "No Win Yet"}</h3>
              </div>
              {evalResult.has_win && (
                <>
                  <p className="text-xs text-neutral-300 mb-2">Patterns: <span className="font-mono">{evalResult.patterns.join(", ")}</span></p>
                  {evalResult.is_sovereign_square && (
                    <p className="text-xs text-yellow-300 font-bold mb-2">★ SOVEREIGN SQUARE — 2× MULTIPLIER</p>
                  )}
                  <div className="grid grid-cols-3 gap-2 text-sm font-mono">
                    <div><div className="text-[10px] text-neutral-500">MULTIPLIER</div><b className="text-cyan-300">{evalResult.final_multiplier}×</b></div>
                    <div><div className="text-[10px] text-neutral-500">GROSS</div><b className="text-emerald-300">${evalResult.gross_payout.toFixed(2)}</b></div>
                    <div><div className="text-[10px] text-neutral-500">NET</div><b className="text-emerald-200">${evalResult.net_payout.toFixed(2)}</b></div>
                  </div>
                </>
              )}
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
