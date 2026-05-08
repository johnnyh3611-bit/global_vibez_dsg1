/**
 * Keno — DSG variant.
 * Pick 1-10. 10/10 catch pays 10,000:1. 0/10 catch = 1-coin rebate.
 * Wires to /api/games/keno/* (constants, play).
 */
import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Sparkles, Trophy, Eraser } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

interface PlayResult {
  picks: number[]; drawn: number[]; hits: number;
  stake: number; multiplier: number;
  gross: number; tax: number; net: number;
}

export default function Keno() {
  const nav = useNavigate();
  const [picks, setPicks] = useState<Set<number>>(new Set());
  const [stake, setStake] = useState(10);
  const [result, setResult] = useState<PlayResult | null>(null);
  const [busy, setBusy] = useState(false);

  const togglePick = (n: number) => {
    setResult(null);
    setPicks(prev => {
      const next = new Set(prev);
      if (next.has(n)) next.delete(n);
      else if (next.size < 10) next.add(n);
      return next;
    });
  };

  const clear = () => { setPicks(new Set()); setResult(null); };

  const play = useCallback(async () => {
    if (picks.size === 0) return;
    setBusy(true);
    const res: PlayResult = await fetch(`${API}/api/games/keno/play`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ picks: [...picks], stake }),
    }).then(r => r.json());
    setResult(res);
    setBusy(false);
  }, [picks, stake]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-amber-950/10 to-black text-white" data-testid="keno-page">
      <div className="sticky top-0 z-30 backdrop-blur-md bg-black/70 border-b border-white/10">
        <div className="max-w-5xl mx-auto px-5 py-3 flex items-center gap-4">
          <button onClick={() => nav(-1)} data-testid="keno-back-btn" className="p-2 rounded-lg hover:bg-white/10"><ArrowLeft className="w-5 h-5" /></button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-400" />
              <h1 className="text-lg font-black tracking-wide">Keno</h1>
              <span className="text-[10px] font-mono uppercase tracking-widest text-amber-300 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded">10/10 PAYS 10,000:1</span>
            </div>
            <p className="text-xs text-neutral-400 mt-0.5">Pick 1–10 · 20 numbers drawn from 80 · 0/10 = 1-coin rebate</p>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-5 py-6 space-y-5">
        {/* Number grid */}
        <div className="rounded-2xl border border-white/10 bg-black/40 p-5">
          <div className="grid grid-cols-10 gap-1.5" data-testid="keno-grid">
            {Array.from({ length: 80 }, (_, i) => i + 1).map(n => {
              const picked = picks.has(n);
              const drawn = result?.drawn.includes(n);
              const hit = picked && drawn;
              return (
                <motion.button
                  key={n}
                  whileTap={{ scale: 0.85 }}
                  onClick={() => togglePick(n)}
                  disabled={busy || !!result}
                  data-testid={`keno-cell-${n}`}
                  className={`aspect-square rounded text-xs font-bold transition-colors ${
                    hit ? "bg-yellow-400 text-black ring-2 ring-yellow-200" :
                    drawn ? "bg-fuchsia-500 text-white" :
                    picked ? "bg-emerald-500 text-black" :
                    "bg-white/5 hover:bg-white/15 text-neutral-300"
                  }`}
                >
                  {n}
                </motion.button>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/40 p-5 flex flex-wrap items-end gap-3">
          <div className="text-xs">
            <div className="text-neutral-400 uppercase">Picks</div>
            <div className="font-mono font-bold text-emerald-300 text-lg" data-testid="keno-pick-count">{picks.size} / 10</div>
          </div>
          <label className="flex flex-col text-xs">
            <span className="text-neutral-400 uppercase">Stake</span>
            <select value={stake} onChange={e => setStake(parseFloat(e.target.value))} disabled={busy} data-testid="keno-stake-select" className="mt-1 bg-black border border-white/20 rounded-lg px-3 py-2 font-mono">
              {[5, 10, 25, 50, 100].map(n => <option key={n} value={n}>${n}</option>)}
            </select>
          </label>
          <button onClick={clear} disabled={busy} data-testid="keno-clear-btn" className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-xs font-bold flex items-center gap-1"><Eraser className="w-3 h-3" /> CLEAR</button>
          <button onClick={play} disabled={busy || picks.size === 0} data-testid="keno-play-btn" className="ml-auto px-6 py-2.5 rounded-full bg-gradient-to-r from-amber-400 to-yellow-500 text-black font-black tracking-wide hover:brightness-110 disabled:opacity-50">{busy ? "DRAWING…" : "PLAY"}</button>
        </div>

        {result && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            data-testid="keno-result"
            className={`rounded-2xl border-2 p-5 ${result.gross > 0 ? "border-emerald-400 bg-emerald-900/20" : "border-rose-500/40 bg-rose-950/10"}`}>
            <div className="flex items-center gap-2 mb-3">
              <Trophy className={`w-5 h-5 ${result.gross > 0 ? "text-emerald-300" : "text-rose-400"}`} />
              <h3 className="font-bold uppercase tracking-widest">{result.hits === 10 && result.picks.length === 10 ? "★ PERFECT 10/10 ★" : `${result.hits} HIT${result.hits !== 1 ? "S" : ""}`}</h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm font-mono">
              <div><div className="text-[10px] text-neutral-500">PICKS</div><b className="text-cyan-300">{result.picks.length}</b></div>
              <div><div className="text-[10px] text-neutral-500">MULT</div><b className="text-cyan-300">{result.multiplier}×</b></div>
              <div><div className="text-[10px] text-neutral-500">GROSS</div><b className="text-emerald-300">${result.gross.toFixed(2)}</b></div>
              <div><div className="text-[10px] text-neutral-500">NET</div><b className="text-emerald-200">${result.net.toFixed(2)}</b></div>
            </div>
            <button onClick={() => { setResult(null); setPicks(new Set()); }} data-testid="keno-new-game-btn" className="mt-4 w-full py-2.5 rounded-full bg-white/10 hover:bg-white/20 font-bold">New Game</button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
