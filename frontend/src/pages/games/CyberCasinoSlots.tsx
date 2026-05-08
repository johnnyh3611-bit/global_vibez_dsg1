/**
 * Cyber Casino — Neon Slots
 *
 * Server-authoritative 3-reel slot machine. The client never rolls
 * randomness — it just animates the reels to the result the backend
 * returns. Every spin is committed-and-revealed (HMAC-SHA512), and
 * the player can copy the proof block to verify any past round.
 *
 * Currency: unified Vibez Coins (real backend balance via
 * /api/coins/balance). The existing CyberCasinoRoulette uses local
 * state; this room is the upgrade path for that.
 */
import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Coins,
  Zap,
  Eye,
  Skull,
  Diamond,
  Sparkles,
  Flame,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

const API = process.env.REACT_APP_BACKEND_URL;

const SYMBOL_META: Record<
  string,
  { Icon: React.ElementType; label: string; tint: string }
> = {
  bolt:    { Icon: Zap,       label: "Bolt",    tint: "text-amber-300" },
  eye:     { Icon: Eye,       label: "Eye",     tint: "text-cyan-300" },
  skull:   { Icon: Skull,     label: "Skull",   tint: "text-zinc-300" },
  diamond: { Icon: Diamond,   label: "Diamond", tint: "text-emerald-300" },
  neon:    { Icon: Sparkles,  label: "Neon",    tint: "text-fuchsia-300" },
  wild:    { Icon: Flame,     label: "WILD",    tint: "text-rose-400" },
};

const ALL_SYMBOLS = Object.keys(SYMBOL_META);

// Bet step options.
const CHIPS = [10, 25, 50, 100, 250, 500];

type SpinResponse = {
  reels: string[];
  bet: number;
  won: number;
  line: string;
  symbol: string | null;
  multiplier: number;
  balance: number;
  proof: {
    server_seed: string;
    client_seed: string;
    nonce: number;
    hmac_sha512: string;
  };
  next_server_seed_hash: string;
  next_nonce: number;
};

function authHeaders(): HeadersInit {
  const tok = typeof window !== "undefined" ? window.localStorage.getItem("auth_token") : null;
  return tok ? { Authorization: `Bearer ${tok}` } : {};
}

export default function CyberCasinoSlots() {
  const navigate = useNavigate();
  const [balance, setBalance] = useState<number | null>(null);
  const [bet, setBet] = useState<number>(50);
  const [spinning, setSpinning] = useState(false);
  const [reels, setReels] = useState<string[]>(["bolt", "eye", "skull"]);
  const [animatedReels, setAnimatedReels] = useState<string[]>([
    "bolt",
    "eye",
    "skull",
  ]);
  const [lastResult, setLastResult] = useState<SpinResponse | null>(null);
  const [commitHash, setCommitHash] = useState<string>("");
  const [showProof, setShowProof] = useState(false);
  const animTimers = useRef<Array<ReturnType<typeof setInterval>>>([]);

  // Fetch balance + initial commit on mount.
  useEffect(() => {
    fetch(`${API}/api/coins/balance`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((d) => setBalance(d.coins ?? 0))
      .catch(() => setBalance(0));
    fetch(`${API}/api/cyber-casino/slots/commit`)
      .then((r) => r.json())
      .then((d) => setCommitHash(d.server_seed_hash))
      .catch(() => undefined);
    return () => {
      animTimers.current.forEach((t) => clearInterval(t));
    };
  }, []);

  const startReelAnimation = (final: string[]) => {
    // Stop any in-flight reel animation.
    animTimers.current.forEach((t) => clearInterval(t));
    animTimers.current = [];

    // Each reel cycles through random symbols every 60ms, then locks
    // onto the final symbol after a staggered delay (450ms / 750ms /
    // 1100ms) — gives a satisfying "thunk-thunk-thunk" reveal.
    const delays = [450, 750, 1100];
    delays.forEach((delay, i) => {
      const t = setInterval(() => {
        setAnimatedReels((cur) => {
          const next = [...cur];
          next[i] = ALL_SYMBOLS[Math.floor(Math.random() * ALL_SYMBOLS.length)];
          return next;
        });
      }, 60);
      animTimers.current.push(t);
      setTimeout(() => {
        clearInterval(t);
        setAnimatedReels((cur) => {
          const next = [...cur];
          next[i] = final[i];
          return next;
        });
      }, delay);
    });
  };

  const handleSpin = async () => {
    if (spinning) return;
    if (balance === null || bet > balance) {
      toast.error("Not enough Vibez Coins");
      return;
    }

    setSpinning(true);
    setLastResult(null);

    // Optimistically deduct so the UI feels instant. Real balance comes
    // back from the server response and is the source of truth.
    setBalance((b) => (b ?? 0) - bet);

    try {
      const res = await fetch(`${API}/api/cyber-casino/slots/spin`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ bet, client_seed: cryptoSeed() }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.detail || "Spin failed");
        // Revert optimistic deduction.
        setBalance((b) => (b ?? 0) + bet);
        setSpinning(false);
        return;
      }
      const data: SpinResponse = await res.json();
      startReelAnimation(data.reels);

      // Wait for animation to finish before settling the UI.
      setTimeout(() => {
        setReels(data.reels);
        setBalance(data.balance);
        setLastResult(data);
        setCommitHash(data.next_server_seed_hash);
        setShowProof(true); // auto-reveal so users see the HMAC commitment
        setSpinning(false);
        if (data.won > 0) {
          toast.success(
            `${data.line === "two-wilds" ? "WILD ×2" : `3× ${data.symbol?.toUpperCase()}`} → +${data.won} Vibez`,
            { duration: 3500 },
          );
        }
      }, 1250);
    } catch (e) {
      console.error(e);
      toast.error("Network error during spin");
      setBalance((b) => (b ?? 0) + bet);
      setSpinning(false);
    }
  };

  return (
    <div
      className="min-h-screen bg-[#07030F] text-white pb-12"
      data-testid="cyber-casino-slots"
    >
      <div className="max-w-5xl mx-auto px-4 py-6">
        <button
          onClick={() => navigate("/games/cyber-casino")}
          className="flex items-center gap-2 text-purple-300/70 hover:text-white mb-4"
          data-testid="slots-back-btn"
        >
          <ArrowLeft className="w-4 h-4" /> Cyber Casino
        </button>

        <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-fuchsia-700 shadow-[0_0_22px_rgba(217,70,239,0.55)]">
              <Sparkles className="w-7 h-7 text-white" />
            </div>
            <div>
              <p className="text-xs font-mono uppercase tracking-[0.3em] text-amber-400/80">
                Cyber Casino · Server-Authoritative
              </p>
              <h1 className="text-3xl md:text-4xl font-black">Neon Slots</h1>
            </div>
          </div>
          <div
            className="px-4 py-2 rounded-xl bg-[#0F0720] border border-fuchsia-500/30 flex items-center gap-2"
            data-testid="slots-balance-card"
          >
            <Coins className="w-4 h-4 text-fuchsia-300" />
            <span className="text-xs uppercase tracking-widest text-purple-300/70">
              Balance
            </span>
            <span
              className="text-xl font-black text-white"
              data-testid="slots-balance"
            >
              {balance === null ? "—" : balance.toLocaleString()}
            </span>
            <span className="text-xs text-fuchsia-300">Vibez</span>
          </div>
        </div>

        {/* Reel cabinet */}
        <Card className="p-6 md:p-10 bg-gradient-to-br from-[#150929] via-[#0F0720] to-[#0a0413] border border-fuchsia-500/30 rounded-3xl mb-6 shadow-[0_0_60px_rgba(217,70,239,0.2)]">
          <div className="grid grid-cols-3 gap-3 md:gap-5 mb-6" data-testid="slots-reels">
            {animatedReels.map((sym, i) => {
              const meta = SYMBOL_META[sym] ?? SYMBOL_META.bolt;
              const Icon = meta.Icon;
              return (
                <motion.div
                  key={i}
                  animate={{ scale: spinning ? [0.96, 1.04, 0.96] : 1 }}
                  transition={{
                    duration: 0.18,
                    repeat: spinning ? Infinity : 0,
                  }}
                  className="aspect-square rounded-2xl bg-black/70 border-2 border-fuchsia-500/40 flex flex-col items-center justify-center shadow-inner"
                  data-testid={`slots-reel-${i}`}
                >
                  <Icon className={`w-16 h-16 md:w-24 md:h-24 ${meta.tint}`} />
                  <span className="mt-2 text-[10px] md:text-xs uppercase tracking-[0.3em] text-purple-300/70">
                    {meta.label}
                  </span>
                </motion.div>
              );
            })}
          </div>

          {/* Bet controls */}
          <div className="flex flex-wrap items-center justify-center gap-2 mb-5">
            {CHIPS.map((c) => (
              <button
                key={c}
                onClick={() => setBet(c)}
                disabled={spinning}
                className={`px-3 py-1.5 rounded-full text-xs font-black tracking-wider transition-all ${
                  bet === c
                    ? "bg-fuchsia-500 text-white shadow-[0_0_18px_rgba(217,70,239,0.6)]"
                    : "bg-white/5 text-purple-200 hover:bg-fuchsia-500/20"
                }`}
                data-testid={`slots-chip-${c}`}
              >
                {c.toLocaleString()}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button
              onClick={handleSpin}
              disabled={spinning || balance === null || bet > (balance ?? 0)}
              className="px-10 py-6 text-lg font-black uppercase tracking-widest bg-gradient-to-r from-fuchsia-500 to-amber-500 hover:from-fuchsia-400 hover:to-amber-400 text-white shadow-[0_0_30px_rgba(217,70,239,0.55)] disabled:opacity-50"
              data-testid="slots-spin-btn"
            >
              {spinning ? "Spinning…" : `Spin · ${bet.toLocaleString()} Vibez`}
            </Button>
          </div>
        </Card>

        {/* Result banner */}
        {lastResult && (
          <Card
            className={`p-4 mb-6 rounded-2xl border ${
              lastResult.won > 0
                ? "bg-emerald-500/10 border-emerald-400/40"
                : "bg-white/[0.02] border-white/10"
            }`}
            data-testid="slots-last-result"
          >
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <p className="text-xs uppercase tracking-widest text-purple-300/60">
                  Last spin
                </p>
                <p className="text-xl font-black">
                  {lastResult.reels.map((r) => SYMBOL_META[r]?.label ?? r).join(" · ")}
                </p>
              </div>
              <div className="text-right">
                {lastResult.won > 0 ? (
                  <p className="text-2xl font-black text-emerald-300">
                    +{lastResult.won.toLocaleString()} Vibez
                  </p>
                ) : (
                  <p className="text-sm text-purple-200/70">No win</p>
                )}
                <p className="text-[10px] uppercase tracking-widest text-purple-300/50">
                  {lastResult.line}
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Paytable + Provably-Fair */}
        <div className="grid md:grid-cols-2 gap-4">
          <Card
            className="p-5 rounded-2xl bg-[#0F0720] border border-fuchsia-500/20"
            data-testid="slots-paytable"
          >
            <p className="text-xs uppercase tracking-[0.3em] text-fuchsia-400/80 mb-3">
              Paytable · 3-of-a-kind
            </p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {[
                ["wild", 50],
                ["neon", 25],
                ["diamond", 12],
                ["skull", 8],
                ["eye", 5],
                ["bolt", 3],
              ].map(([sym, mult]) => {
                const meta = SYMBOL_META[sym as string];
                const Icon = meta.Icon;
                return (
                  <div
                    key={sym as string}
                    className="flex items-center gap-2 py-1.5"
                  >
                    <Icon className={`w-5 h-5 ${meta.tint}`} />
                    <span className="text-xs uppercase tracking-wider text-purple-200/80 flex-1">
                      {meta.label}
                    </span>
                    <span className="text-base font-black text-white">
                      {mult}×
                    </span>
                  </div>
                );
              })}
              <div className="col-span-2 mt-2 pt-2 border-t border-white/5 text-[11px] text-purple-300/60 leading-relaxed">
                2× WILD anywhere also pays 2×. Wilds substitute for any
                symbol when forming a 3-of-a-kind.
              </div>
            </div>
          </Card>

          <Card
            className="p-5 rounded-2xl bg-[#0F0720] border border-emerald-500/20"
            data-testid="slots-provably-fair"
          >
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck className="w-4 h-4 text-emerald-300" />
              <p className="text-xs uppercase tracking-[0.3em] text-emerald-400/80">
                Provably Fair
              </p>
            </div>
            <p className="text-xs text-purple-200/70 leading-relaxed mb-3">
              The server commits to a hashed seed before every spin. After
              the spin, the original seed is revealed so you can replay
              the math (HMAC-SHA512 of <code className="bg-black/40 px-1 rounded">client_seed:nonce</code>) and prove
              the outcome wasn't faked.
            </p>
            <div className="text-[10px] font-mono break-all bg-black/40 rounded-lg p-2 border border-emerald-500/10 mb-2">
              <span className="text-emerald-300">next_hash · </span>
              {commitHash || "loading…"}
            </div>
            {lastResult && (
              <button
                onClick={() => setShowProof((s) => !s)}
                className="text-xs text-emerald-300 hover:text-emerald-200 underline"
                data-testid="slots-toggle-proof"
              >
                {showProof ? "Hide" : "Show"} last-spin proof
              </button>
            )}
            {showProof && lastResult && (
              <pre
                className="mt-2 text-[10px] font-mono text-purple-200/70 bg-black/40 p-2 rounded-lg border border-white/5 overflow-x-auto whitespace-pre-wrap break-all"
                data-testid="slots-proof-block"
              >
                {JSON.stringify(lastResult.proof, null, 2)}
              </pre>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function cryptoSeed(): string {
  if (typeof window !== "undefined" && window.crypto?.getRandomValues) {
    const bytes = new Uint8Array(8);
    window.crypto.getRandomValues(bytes);
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  return Math.random().toString(36).slice(2, 18);
}
