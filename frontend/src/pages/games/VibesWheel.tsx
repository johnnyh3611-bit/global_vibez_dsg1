/**
 * Vibes Wheel — DSG founder spec.
 * 54 slots · 2 Sovereign Jokers (slots 0, 27) pay 40:1 + 10% burn event.
 * Wires to /api/games/vibes-wheel/* (constants, spin).
 */
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, RotateCcw, Trophy, Flame } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

interface SpinResult {
  slot_index: number;
  is_sovereign_joker: boolean;
  gross: number; tax: number; burn: number; net: number;
}

export default function VibesWheel() {
  const nav = useNavigate();
  const [stake, setStake] = useState(10);
  const [spinning, setSpinning] = useState(false);
  const [angle, setAngle] = useState(0);
  const [result, setResult] = useState<SpinResult | null>(null);

  const spin = useCallback(async () => {
    setSpinning(true); setResult(null);
    const res: SpinResult = await fetch(`${API}/api/games/vibes-wheel/spin`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stake }),
    }).then(r => r.json());
    // 54 slots → each slot is 360/54 ≈ 6.667°. We spin 5 full rotations + final.
    const final = -res.slot_index * (360 / 54) - 5 * 360;
    setAngle(final);
    setTimeout(() => {
      setResult(res);
      setSpinning(false);
    }, 4500);
  }, [stake]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-purple-950/15 to-black text-white" data-testid="vibes-wheel-page">
      <div className="sticky top-0 z-30 backdrop-blur-md bg-black/70 border-b border-white/10">
        <div className="max-w-5xl mx-auto px-5 py-3 flex items-center gap-4">
          <button onClick={() => nav(-1)} data-testid="vw-back-btn" className="p-2 rounded-lg hover:bg-white/10"><ArrowLeft className="w-5 h-5" /></button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-fuchsia-400" />
              <h1 className="text-lg font-black tracking-wide">Vibes Wheel</h1>
              <span className="text-[10px] font-mono uppercase tracking-widest text-yellow-300 bg-yellow-500/10 border border-yellow-500/30 px-2 py-0.5 rounded">SOVEREIGN JOKER 40:1</span>
            </div>
            <p className="text-xs text-neutral-400 mt-0.5">54 slots · 2 Sovereign Jokers · 10% burn on jackpot</p>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-5 py-6 grid lg:grid-cols-2 gap-5 items-start">
        {/* Wheel */}
        <div className="rounded-3xl border-2 border-fuchsia-500/30 bg-black/60 p-6 flex flex-col items-center">
          <div className="relative w-72 h-72">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10 w-0 h-0 border-l-[12px] border-l-transparent border-r-[12px] border-r-transparent border-t-[20px] border-t-yellow-400 drop-shadow" />
            <motion.div
              animate={{ rotate: angle }}
              transition={{ duration: 4.4, ease: [0.2, 0.8, 0.3, 1] }}
              className="w-full h-full rounded-full border-4 border-fuchsia-400/60 shadow-[0_0_60px_rgba(232,121,249,0.4)]"
              style={{
                background: `conic-gradient(${Array.from({ length: 54 }).map((_, i) => {
                  const isJoker = i === 0 || i === 27;
                  const c = isJoker ? "#facc15" : (i % 2 ? "#a21caf" : "#0f172a");
                  return `${c} ${(i * 360 / 54).toFixed(2)}deg ${((i + 1) * 360 / 54).toFixed(2)}deg`;
                }).join(", ")})`,
              }}
              data-testid="vw-wheel"
            >
              <div className="absolute inset-1/3 rounded-full bg-black border-2 border-fuchsia-400 flex flex-col items-center justify-center">
                <span className="text-2xl font-black">DSG</span>
                <span className="text-[10px] uppercase tracking-widest text-fuchsia-300">Vibes Wheel</span>
              </div>
            </motion.div>
          </div>

          <div className="mt-5 flex flex-wrap items-end gap-3 w-full">
            <label className="flex flex-col text-xs">
              <span className="text-neutral-400 uppercase">Stake</span>
              <select value={stake} onChange={e => setStake(parseFloat(e.target.value))} disabled={spinning} data-testid="vw-stake-select" className="mt-1 bg-black border border-white/20 rounded-lg px-3 py-2 font-mono">
                {[5, 10, 25, 50, 100].map(n => <option key={n} value={n}>${n}</option>)}
              </select>
            </label>
            <button onClick={spin} disabled={spinning} data-testid="vw-spin-btn" className="ml-auto px-6 py-2.5 rounded-full bg-gradient-to-r from-fuchsia-500 to-purple-500 text-white font-black tracking-wide hover:brightness-110 disabled:opacity-50">{spinning ? "SPINNING…" : "SPIN"}</button>
          </div>
        </div>

        {/* Sidebar / Result */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-yellow-500/30 bg-yellow-950/10 p-4">
            <h2 className="text-xs uppercase tracking-widest text-yellow-200 mb-2 flex items-center gap-1"><Flame className="w-3 h-3" /> Sovereign Joker</h2>
            <p className="text-xs text-neutral-300">Hitting slot 0 or slot 27 (the two opposite Sovereign Jokers) pays <b className="text-yellow-300">40:1</b> and triggers a 10% burn event into the DSG treasury.</p>
          </div>
          <AnimatePresence>
            {result && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                data-testid="vw-result"
                className={`rounded-2xl border-2 p-5 ${result.is_sovereign_joker ? "border-yellow-400 bg-yellow-900/20" : (result.gross > 0 ? "border-emerald-400 bg-emerald-900/20" : "border-rose-500/40 bg-rose-950/10")}`}>
                <div className="flex items-center gap-2 mb-3">
                  <Trophy className={`w-5 h-5 ${result.is_sovereign_joker ? "text-yellow-300" : (result.gross > 0 ? "text-emerald-300" : "text-rose-400")}`} />
                  <h3 className="font-bold uppercase tracking-widest">{result.is_sovereign_joker ? "★ SOVEREIGN JOKER ★" : (result.gross > 0 ? "Winner!" : "No Win")}</h3>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm font-mono">
                  <div><div className="text-[10px] text-neutral-500">SLOT</div><b className="text-cyan-300">#{result.slot_index}</b></div>
                  <div><div className="text-[10px] text-neutral-500">GROSS</div><b className="text-emerald-300">${result.gross.toFixed(2)}</b></div>
                  <div><div className="text-[10px] text-neutral-500">BURN</div><b className="text-orange-300">${result.burn.toFixed(2)}</b></div>
                  <div><div className="text-[10px] text-neutral-500">NET</div><b className="text-emerald-200">${result.net.toFixed(2)}</b></div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
