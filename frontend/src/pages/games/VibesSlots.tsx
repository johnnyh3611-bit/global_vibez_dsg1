/**
 * Vibes Slots — 5-reel progressive slot with live jackpot.
 * ──────────────────────────────────────────────────────────
 * Wires to /api/games/vibes-slots/* (constants, spin, jackpot/current).
 * Live jackpot ticker counts up in real time as players feed it.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Coins, Sparkles, Zap, RotateCcw, TrendingUp } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

type SymbolKey = "cherry" | "bell" | "diamond" | "seven" | "wild" | "joker";

interface Constants {
  name: string;
  tagline: string;
  reel_count: number;
  rtp_target: number;
  symbols: Record<SymbolKey, { emoji: string; pay_3: number; pay_4: number; pay_5: number; is_jackpot: boolean; is_wild: boolean; }>;
}

interface SpinResult {
  reels: SymbolKey[];
  stake: number;
  matches: number;
  anchor_symbol: SymbolKey;
  payout_multiplier: number;
  gross_payout: number;
  jackpot_feed: number;
  jackpot_paid: number;
  is_jackpot_hit: boolean;
  sovereign_rain: any | null;
  current_jackpot: number;
}

function ReelSlot({ symbol, emoji, rolling, win }: { symbol: SymbolKey; emoji: string; rolling: boolean; win: boolean; }) {
  return (
    <motion.div
      animate={rolling ? { y: [0, -10, 0], rotateX: [0, 360] } : win ? { scale: [1, 1.2, 1] } : {}}
      transition={{ duration: rolling ? 0.6 : 0.4 }}
      data-testid={`vibes-slots-reel-${symbol}`}
      className={`w-20 h-20 sm:w-24 sm:h-24 rounded-xl flex items-center justify-center text-5xl sm:text-6xl select-none border-2 transition-colors
        ${win
          ? "bg-gradient-to-br from-yellow-300 to-amber-500 border-yellow-200 shadow-2xl shadow-yellow-500/50"
          : "bg-gradient-to-br from-neutral-800 to-black border-white/20"
        }`}
    >
      {emoji}
    </motion.div>
  );
}

export default function VibesSlots() {
  const nav = useNavigate();
  const [constants, setConstants] = useState<Constants | null>(null);
  const [jackpot, setJackpot] = useState<number>(0);
  const [stake, setStake] = useState<number>(1.0);
  const [reels, setReels] = useState<SymbolKey[]>(["cherry", "bell", "diamond", "seven", "wild"]);
  const [rolling, setRolling] = useState(false);
  const [lastResult, setLastResult] = useState<SpinResult | null>(null);
  const [showRain, setShowRain] = useState(false);
  const [busy, setBusy] = useState(false);
  const tickerRef = useRef<number>(0);

  // Initial load + jackpot poll
  useEffect(() => {
    fetch(`${API}/api/games/vibes-slots/constants`).then(r => r.json()).then(setConstants);
    const fetchJackpot = () => {
      fetch(`${API}/api/games/vibes-slots/jackpot/current`)
        .then(r => r.json())
        .then(d => setJackpot(d.current_amount));
    };
    fetchJackpot();
    const id = setInterval(fetchJackpot, 5000); // poll every 5s
    return () => clearInterval(id);
  }, []);

  // Animate the jackpot ticker between polls
  useEffect(() => {
    tickerRef.current = jackpot;
  }, [jackpot]);

  const spin = useCallback(async () => {
    if (busy || !constants) return;
    setBusy(true);
    setRolling(true);
    setLastResult(null);

    // Visual roll for 600ms before the API responds (snappier feel)
    const rollInterval = setInterval(() => {
      const keys = Object.keys(constants.symbols) as SymbolKey[];
      setReels(Array.from({ length: constants.reel_count }, () => keys[Math.floor(Math.random() * keys.length)]));
    }, 80);

    try {
      const res: SpinResult = await fetch(`${API}/api/games/vibes-slots/spin`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stake, active_user_count: 100 }),
      }).then(r => r.json());

      // Wait for the visual roll to feel "fair"
      await new Promise(r => setTimeout(r, 700));
      clearInterval(rollInterval);

      setReels(res.reels);
      setLastResult(res);
      setJackpot(res.current_jackpot);

      if (res.is_jackpot_hit) {
        setShowRain(true);
        setTimeout(() => setShowRain(false), 4000);
      }
    } catch (e) {
      clearInterval(rollInterval);
    }
    setRolling(false);
    setBusy(false);
  }, [busy, constants, stake]);

  const winningReelIndices = (() => {
    if (!lastResult || lastResult.matches < 3) return new Set<number>();
    const s = new Set<number>();
    for (let i = 0; i < lastResult.matches; i++) s.add(i);
    return s;
  })();

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-amber-950/15 to-black text-white" data-testid="vibes-slots-page">
      {/* Header */}
      <div className="sticky top-0 z-30 backdrop-blur-md bg-black/70 border-b border-white/10">
        <div className="max-w-5xl mx-auto px-5 py-3 flex items-center gap-4">
          <button onClick={() => nav(-1)} data-testid="vibes-slots-back-btn" className="p-2 rounded-lg hover:bg-white/10">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Coins className="w-5 h-5 text-yellow-400" />
              <h1 className="text-lg font-black tracking-wide">Vibes Slots</h1>
              <span className="text-[10px] font-mono uppercase tracking-widest text-yellow-300 bg-yellow-500/10 border border-yellow-500/30 px-2 py-0.5 rounded">
                {constants ? `RTP ${(constants.rtp_target * 100).toFixed(0)}%` : "..."}
              </span>
            </div>
            <p className="text-xs text-neutral-400 mt-0.5">
              {constants?.tagline || "5 Reels · 1 Payline · Hit 5 Jokers for SOVEREIGN RAIN"}
            </p>
          </div>
        </div>
        {/* LIVE JACKPOT TICKER */}
        <div className="bg-gradient-to-r from-yellow-500/20 via-amber-500/20 to-yellow-500/20 border-y border-yellow-500/30">
          <div className="max-w-5xl mx-auto px-5 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-yellow-300">
              <TrendingUp className="w-3.5 h-3.5 animate-pulse" /> Live Sovereign Jackpot
            </div>
            <motion.div
              key={jackpot}
              initial={{ scale: 1.05, color: "#fbbf24" }}
              animate={{ scale: 1, color: "#fde68a" }}
              data-testid="vibes-slots-jackpot-ticker"
              className="text-2xl sm:text-3xl font-black font-mono"
            >
              ${jackpot.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </motion.div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-5 py-8 space-y-8">
        {/* Slot machine frame */}
        <div className="rounded-3xl border-4 border-yellow-500/40 bg-gradient-to-br from-purple-950/30 via-black to-amber-950/30 p-6 shadow-2xl shadow-yellow-500/10" data-testid="vibes-slots-machine">
          <div className="flex justify-center gap-2 sm:gap-3 mb-6">
            {reels.map((sym, i) => (
              <ReelSlot
                key={i}
                symbol={sym}
                emoji={constants?.symbols[sym]?.emoji || "?"}
                rolling={rolling}
                win={winningReelIndices.has(i)}
              />
            ))}
          </div>

          {/* Stake selector + spin button */}
          <div className="flex flex-wrap justify-center items-center gap-4 pt-4 border-t border-white/10">
            <label className="flex items-center gap-2 text-xs">
              <span className="text-neutral-400 uppercase tracking-widest">Stake</span>
              <select
                value={stake}
                onChange={e => setStake(parseFloat(e.target.value))}
                disabled={busy}
                data-testid="vibes-slots-stake-select"
                className="bg-black border border-white/20 rounded-lg px-3 py-2 text-white font-mono"
              >
                {[0.5, 1, 2, 5, 10, 25].map(n => <option key={n} value={n}>₵{n.toFixed(2)}</option>)}
              </select>
            </label>
            <button
              onClick={spin}
              disabled={busy}
              data-testid="vibes-slots-spin-btn"
              className="px-10 py-3 rounded-full bg-gradient-to-r from-yellow-400 to-amber-500 text-black font-black tracking-widest text-lg hover:brightness-110 disabled:opacity-50 transition-all flex items-center gap-2"
            >
              <RotateCcw className={`w-5 h-5 ${rolling ? "animate-spin" : ""}`} /> {rolling ? "SPINNING..." : "SPIN"}
            </button>
          </div>
        </div>

        {/* Last result card */}
        {lastResult && (
          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            data-testid="vibes-slots-last-result"
            className={`rounded-2xl border p-5 ${
              lastResult.is_jackpot_hit
                ? "border-yellow-300 bg-gradient-to-br from-yellow-900/40 via-black to-amber-900/30"
                : lastResult.gross_payout > 0
                ? "border-emerald-500/40 bg-emerald-950/20"
                : "border-white/10 bg-black/40"
            }`}
          >
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div><div className="text-[10px] text-neutral-500 uppercase">Matches</div><div className="font-mono font-bold">{lastResult.matches}</div></div>
              <div><div className="text-[10px] text-neutral-500 uppercase">Anchor</div><div className="font-mono font-bold">{constants?.symbols[lastResult.anchor_symbol]?.emoji} {lastResult.anchor_symbol}</div></div>
              <div><div className="text-[10px] text-neutral-500 uppercase">Multiplier</div><div className="font-mono font-bold text-cyan-300">{lastResult.payout_multiplier}×</div></div>
              <div><div className="text-[10px] text-neutral-500 uppercase">Payout</div><div className={`font-mono font-bold ${lastResult.gross_payout > 0 ? "text-emerald-300" : "text-neutral-500"}`}>₵{lastResult.gross_payout.toFixed(2)}</div></div>
            </div>
            {lastResult.is_jackpot_hit && (
              <div className="mt-3 pt-3 border-t border-yellow-500/30 flex items-center gap-2 text-yellow-200">
                <Sparkles className="w-4 h-4" /> <b>JACKPOT</b> · ${lastResult.jackpot_paid.toLocaleString()} paid + Sovereign Rain triggered
              </div>
            )}
          </motion.div>
        )}

        {/* Paytable */}
        {constants && (
          <div className="rounded-2xl border border-white/10 bg-black/30 p-5" data-testid="vibes-slots-paytable">
            <h2 className="text-xs font-mono uppercase tracking-widest text-neutral-400 mb-3">Paytable (multiplier × stake)</h2>
            <div className="space-y-2">
              {(Object.keys(constants.symbols) as SymbolKey[]).map(key => {
                const s = constants.symbols[key];
                return (
                  <div key={key} className="flex items-center justify-between text-sm font-mono">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{s.emoji}</span>
                      <span className={`uppercase ${s.is_jackpot ? "text-yellow-300" : s.is_wild ? "text-fuchsia-300" : "text-neutral-300"}`}>
                        {key} {s.is_jackpot && "· JACKPOT"} {s.is_wild && "· WILD"}
                      </span>
                    </div>
                    <div className="flex gap-4 text-right">
                      <span><span className="text-neutral-500">3×</span> <b>{s.pay_3}</b></span>
                      <span><span className="text-neutral-500">4×</span> <b>{s.pay_4}</b></span>
                      <span><span className="text-neutral-500">5×</span> <b className={s.is_jackpot ? "text-yellow-300" : ""}>{s.pay_5}</b></span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Sovereign Rain overlay */}
      <AnimatePresence>
        {showRain && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            data-testid="vibes-slots-sovereign-rain"
            className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center bg-black/50 backdrop-blur-sm"
          >
            <motion.div
              animate={{ scale: [0.5, 1.2, 1], rotate: [-5, 5, 0] }}
              transition={{ duration: 1 }}
              className="text-center"
            >
              <div className="text-6xl sm:text-8xl font-black bg-clip-text text-transparent bg-gradient-to-br from-yellow-300 via-amber-400 to-yellow-500">
                🌧️ SOVEREIGN RAIN! 🌧️
              </div>
              <div className="mt-3 text-lg text-yellow-200 font-mono tracking-widest">
                JACKPOT HIT · 1 COIN GIFTED TO ALL ACTIVE USERS
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
