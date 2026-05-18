/**
 * Vibes Darts — skill-based throw · click target.
 * Distance from center bullseye determines payout.
 */
import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Target, Trophy } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

interface ThrowResult {
  distance: number; tier: string; payout_ratio: number;
  gross: number; tax: number; net: number;
}

export default function VibesDarts() {
  const nav = useNavigate();
  const [stake, setStake] = useState(10);
  const [throwPos, setThrowPos] = useState<{ x: number; y: number } | null>(null);
  const [result, setResult] = useState<ThrowResult | null>(null);
  const [busy, setBusy] = useState(false);

  const throwDart = useCallback(async (e: React.MouseEvent<HTMLDivElement>) => {
    if (busy) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const dx = (x - cx) / cx;   // -1..1
    const dy = (y - cy) / cy;
    const dist = Math.min(1, Math.sqrt(dx * dx + dy * dy));
    setThrowPos({ x, y });
    setBusy(true);
    setResult(null);
    const res: ThrowResult = await fetch(`${API}/api/games/vibes-darts/throw`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ distance_from_bullseye: dist, stake }),
    }).then(r => r.json());
    setResult(res);
    setBusy(false);
  }, [stake, busy]);

  const reset = () => { setThrowPos(null); setResult(null); };

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-emerald-950/15 to-black text-white" data-testid="darts-page">
      <div className="sticky top-0 z-30 backdrop-blur-md bg-black/70 border-b border-white/10">
        <div className="max-w-3xl mx-auto px-5 py-3 flex items-center gap-4">
          <button onClick={() => nav(-1)} data-testid="darts-back-btn" className="p-2 rounded-lg hover:bg-white/10"><ArrowLeft className="w-5 h-5" /></button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5 text-emerald-400" />
              <h1 className="text-lg font-black tracking-wide">Vibes Darts</h1>
              <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded">BULLSEYE 50:1</span>
            </div>
            <p className="text-xs text-neutral-400 mt-0.5">Skill-based · click the board to throw your dart</p>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-5 py-6 space-y-5">
        <div className="rounded-2xl border border-white/10 bg-black/40 p-5 flex flex-col items-center">
          <div
            onClick={throwDart}
            data-testid="darts-target"
            className="relative w-72 h-72 rounded-full cursor-crosshair shadow-[0_0_50px_rgba(16,185,129,0.4)]"
            style={{
              background: "radial-gradient(circle, #facc15 0% 5%, #f59e0b 5% 15%, #ef4444 15% 40%, #1e293b 40% 100%)",
            }}
          >
            {throwPos && (
              <motion.div
                initial={{ scale: 4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="absolute -translate-x-1/2 -translate-y-1/2 text-3xl pointer-events-none"
                style={{ left: throwPos.x, top: throwPos.y }}
              >
                🎯
              </motion.div>
            )}
          </div>
          <div className="mt-4 flex flex-wrap items-end gap-3 w-full">
            <label className="flex flex-col text-xs">
              <span className="text-neutral-400 uppercase">Stake</span>
              <select value={stake} onChange={e => setStake(parseFloat(e.target.value))} disabled={busy} data-testid="darts-stake" className="mt-1 bg-black border border-white/20 rounded-lg px-3 py-2 font-mono">
                {[5, 10, 25, 50, 100].map(n => <option key={n} value={n}>₵{n}</option>)}
              </select>
            </label>
            <button onClick={reset} disabled={busy} data-testid="darts-reset-btn" className="ml-auto px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-xs font-bold uppercase tracking-widest">Reset</button>
          </div>
        </div>

        <AnimatePresence>
          {result && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              data-testid="darts-result"
              className={`rounded-2xl border-2 p-5 ${result.gross > 0 ? "border-emerald-400 bg-emerald-900/20" : "border-rose-500/40 bg-rose-950/10"}`}>
              <div className="flex items-center gap-2 mb-3">
                <Trophy className={`w-5 h-5 ${result.gross > 0 ? "text-emerald-300" : "text-rose-400"}`} />
                <h3 className="font-bold uppercase tracking-widest">{result.tier.replace(/_/g, " ")}</h3>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm font-mono">
                <div><div className="text-[10px] text-neutral-500">DIST</div><b className="text-cyan-300">{(result.distance * 100).toFixed(1)}%</b></div>
                <div><div className="text-[10px] text-neutral-500">GROSS</div><b className={result.gross >= 0 ? "text-emerald-300" : "text-rose-300"}>₵{result.gross.toFixed(2)}</b></div>
                <div><div className="text-[10px] text-neutral-500">TAX</div><b className="text-yellow-300">₵{result.tax.toFixed(2)}</b></div>
                <div><div className="text-[10px] text-neutral-500">NET</div><b className={result.net >= 0 ? "text-emerald-300" : "text-rose-300"}>₵{result.net.toFixed(2)}</b></div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
