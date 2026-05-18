/**
 * Jacks or Better — 5-card draw video poker.
 * Wires to /api/games/jacks-or-better/* (deal, draw).
 */
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Trophy, RotateCcw } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;
const SUIT: Record<string, string> = { S: "♠", H: "♥", D: "♦", C: "♣" };
const SUIT_C: Record<string, string> = { S: "text-neutral-100", H: "text-rose-400", D: "text-rose-400", C: "text-neutral-100" };

interface CardT { rank: string; suit: string; }
interface DrawResult {
  final_hand: CardT[]; category: string;
  multiplier: number; gross: number; tax: number; net: number;
}

export default function JacksOrBetter() {
  const nav = useNavigate();
  const [paytable, setPaytable] = useState<Record<string, number>>({});
  const [hand, setHand] = useState<CardT[] | null>(null);
  const [holds, setHolds] = useState<Set<number>>(new Set());
  const [stake, setStake] = useState(5);
  const [phase, setPhase] = useState<"idle" | "drawing" | "resolved">("idle");
  const [result, setResult] = useState<DrawResult | null>(null);

  useEffect(() => {
    fetch(`${API}/api/games/jacks-or-better/constants`).then(r => r.json()).then(d => setPaytable(d.paytable));
  }, []);

  const deal = useCallback(async () => {
    const res = await fetch(`${API}/api/games/jacks-or-better/deal`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
    }).then(r => r.json());
    setHand(res.hand);
    setHolds(new Set());
    setResult(null);
    setPhase("drawing");
  }, []);

  const toggleHold = (i: number) => {
    if (phase !== "drawing") return;
    setHolds(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  };

  const draw = useCallback(async () => {
    if (!hand) return;
    const res: DrawResult = await fetch(`${API}/api/games/jacks-or-better/draw`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initial: hand, hold_indices: [...holds], stake }),
    }).then(r => r.json());
    setResult(res);
    setHand(res.final_hand);
    setPhase("resolved");
  }, [hand, holds, stake]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-violet-950/20 to-black text-white" data-testid="jacks-page">
      <div className="sticky top-0 z-30 backdrop-blur-md bg-black/70 border-b border-white/10">
        <div className="max-w-5xl mx-auto px-5 py-3 flex items-center gap-4">
          <button onClick={() => nav(-1)} data-testid="jacks-back-btn" className="p-2 rounded-lg hover:bg-white/10"><ArrowLeft className="w-5 h-5" /></button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🎰</span>
              <h1 className="text-lg font-black tracking-wide">Jacks or Better</h1>
              <span className="text-[10px] font-mono uppercase tracking-widest text-violet-300 bg-violet-500/10 border border-violet-500/30 px-2 py-0.5 rounded">VIDEO POKER · ROYAL 800:1</span>
            </div>
            <p className="text-xs text-neutral-400 mt-0.5">Deal → tap cards to HOLD → draw → win on pair of Jacks or better</p>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-5 py-6 space-y-5">
        <div className="rounded-2xl border border-white/10 bg-black/40 p-5">
          <div className="flex justify-center gap-2 mb-4">
            {(hand ?? Array(5).fill(null)).map((c, i) => (
              <div key={i} className="flex flex-col items-center gap-1">
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => toggleHold(i)}
                  data-testid={`jacks-card-${i}`}
                  className={`w-20 h-28 rounded-xl border-2 flex flex-col items-center justify-center font-bold text-3xl transition ${
                    !c ? "border-white/10 bg-black/30" :
                    holds.has(i) ? "border-yellow-300 ring-4 ring-yellow-300/50 bg-gradient-to-br from-white to-neutral-200 " + (SUIT_C[c.suit] || "") :
                    "border-white bg-gradient-to-br from-white to-neutral-200 " + (SUIT_C[c.suit] || "")
                  }`}
                  disabled={!c || phase !== "drawing"}
                >
                  {c && <><span>{c.rank}</span><span className="text-4xl">{SUIT[c.suit]}</span></>}
                </motion.button>
                <span className={`text-[10px] uppercase tracking-widest font-bold ${holds.has(i) ? "text-yellow-300" : "text-neutral-600"}`}>{holds.has(i) ? "HELD" : ""}</span>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col text-xs">
              <span className="text-neutral-400 uppercase">Stake</span>
              <select value={stake} onChange={e => setStake(parseFloat(e.target.value))} disabled={phase !== "idle" && phase !== "resolved"} data-testid="jacks-stake" className="mt-1 bg-black border border-white/20 rounded-lg px-3 py-2 font-mono">
                {[1, 5, 10, 25, 50].map(n => <option key={n} value={n}>₵{n}</option>)}
              </select>
            </label>
            {phase !== "drawing" && (
              <button onClick={deal} data-testid="jacks-deal-btn" className="ml-auto px-5 py-2.5 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-black tracking-wide hover:brightness-110">DEAL</button>
            )}
            {phase === "drawing" && (
              <button onClick={draw} data-testid="jacks-draw-btn" className="ml-auto px-5 py-2.5 rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 text-black font-black tracking-wide hover:brightness-110">DRAW ({holds.size} held)</button>
            )}
          </div>
        </div>

        {result && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            data-testid="jacks-result"
            className={`rounded-2xl border-2 p-5 ${result.gross > 0 ? "border-emerald-400 bg-emerald-900/20" : "border-rose-500/40 bg-rose-950/10"}`}>
            <div className="flex items-center gap-2 mb-3">
              <Trophy className={`w-5 h-5 ${result.gross > 0 ? "text-emerald-300" : "text-rose-400"}`} />
              <h3 className="font-bold uppercase tracking-widest">{result.category.replace(/_/g, " ").toUpperCase()}</h3>
              {result.multiplier > 0 && <span className="text-yellow-300 font-mono">× {result.multiplier}</span>}
            </div>
            <div className="grid grid-cols-3 gap-2 text-sm font-mono">
              <div><div className="text-[10px] text-neutral-500">GROSS</div><b className={result.gross >= 0 ? "text-emerald-300" : "text-rose-300"}>₵{result.gross.toFixed(2)}</b></div>
              <div><div className="text-[10px] text-neutral-500">TAX</div><b className="text-yellow-300">₵{result.tax.toFixed(2)}</b></div>
              <div><div className="text-[10px] text-neutral-500">NET</div><b className={result.net >= 0 ? "text-emerald-300" : "text-rose-300"}>₵{result.net.toFixed(2)}</b></div>
            </div>
            <button onClick={() => { setHand(null); setHolds(new Set()); setResult(null); setPhase("idle"); }} data-testid="jacks-new-btn" className="mt-3 w-full py-2 rounded-full bg-white/10 hover:bg-white/20 font-bold flex items-center justify-center gap-2"><RotateCcw className="w-3 h-3" /> New Hand</button>
          </motion.div>
        )}

        <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
          <h2 className="text-xs uppercase tracking-widest text-neutral-400 mb-3">Paytable</h2>
          <div className="grid grid-cols-2 gap-2 text-sm font-mono">
            {Object.entries(paytable).reverse().map(([cat, mult]) => (
              <div key={cat} className="flex justify-between bg-white/5 rounded-lg px-3 py-2">
                <span className="capitalize">{cat.replace(/_/g, " ")}</span>
                <b className="text-yellow-300">{mult}:1</b>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
