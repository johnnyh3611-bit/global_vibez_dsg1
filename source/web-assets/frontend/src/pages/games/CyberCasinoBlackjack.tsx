/**
 * Cyber Casino — Neon Blackjack
 *
 * Server-authoritative Blackjack. The shoe lives on the backend; the
 * client only ever sees what's been dealt face-up. Dealer plays S17,
 * blackjack pays 3:2, double allowed on the first 2 cards only,
 * insurance offered when dealer shows an Ace.
 *
 * Currency: real Vibez Coins balance via /api/coins/balance.
 */
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Coins, Spade, Heart, Diamond, Club, Trophy } from "lucide-react";
import { toast } from "sonner";

const API = process.env.REACT_APP_BACKEND_URL;

const CHIPS = [25, 50, 100, 250, 500, 1000];

type Settlement = {
  net: number;
  outcome: string;
  insurance_payout: number;
  player_total: number;
  dealer_total: number;
};

type Session = {
  session_id: string;
  bet: number;
  player: string[];
  dealer: string[];
  state: "in_progress" | "complete";
  player_total: number;
  dealer_total: number;
  insurance_bet: number;
  doubled: boolean;
  settlement?: Settlement;
};

type DealResponse = {
  session: Session;
  balance: number;
  can_double: boolean;
  can_insurance: boolean;
};

function authHeaders(): HeadersInit {
  const tok = typeof window !== "undefined" ? window.localStorage.getItem("auth_token") : null;
  return tok ? { Authorization: `Bearer ${tok}` } : {};
}

const SUIT_META: Record<string, { Icon: React.ElementType; color: string }> = {
  S: { Icon: Spade,   color: "text-zinc-100" },
  C: { Icon: Club,    color: "text-zinc-100" },
  H: { Icon: Heart,   color: "text-rose-400" },
  D: { Icon: Diamond, color: "text-rose-400" },
};

export default function CyberCasinoBlackjack() {
  const navigate = useNavigate();
  const [balance, setBalance] = useState<number | null>(null);
  const [bet, setBet] = useState(100);
  const [session, setSession] = useState<Session | null>(null);
  const [canDouble, setCanDouble] = useState(false);
  const [canInsurance, setCanInsurance] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`${API}/api/coins/balance`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((d) => setBalance(d.coins ?? 0))
      .catch(() => setBalance(0));
  }, []);

  const inProgress = session?.state === "in_progress";
  const settlement = session?.settlement;

  const deal = async () => {
    if (busy) return;
    if (balance === null || bet > balance) {
      toast.error("Not enough Vibez Coins");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`${API}/api/cyber-casino/blackjack/deal`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ bet }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.detail || "Deal failed");
        setBusy(false);
        return;
      }
      const data: DealResponse = await res.json();
      setSession(data.session);
      setBalance(data.balance);
      setCanDouble(data.can_double);
      setCanInsurance(data.can_insurance);
      if (data.session.state === "complete" && data.session.settlement) {
        announceOutcome(data.session.settlement);
      }
    } catch (e) {
      console.error(e);
      toast.error("Network error");
    } finally {
      setBusy(false);
    }
  };

  const action = async (act: "hit" | "stand" | "double" | "insurance" | "decline-insurance") => {
    if (!session || busy) return;
    setBusy(true);
    try {
      const res = await fetch(`${API}/api/cyber-casino/blackjack/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ session_id: session.session_id, action: act }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.detail || "Action failed");
        setBusy(false);
        return;
      }
      const data = await res.json();
      setSession(data.session);
      setBalance(data.balance);
      setCanDouble(data.can_double);
      setCanInsurance(data.can_insurance);
      if (data.settlement) {
        announceOutcome(data.settlement);
      }
    } catch (e) {
      console.error(e);
      toast.error("Network error");
    } finally {
      setBusy(false);
    }
  };

  const announceOutcome = (s: Settlement) => {
    const labelMap: Record<string, string> = {
      blackjack: "BLACKJACK · 3:2",
      win: "You win",
      lose: "Dealer wins",
      bust: "Bust · Dealer wins",
      push: "Push",
      "push-blackjack": "Push · both blackjack",
    };
    const label = labelMap[s.outcome] ?? s.outcome;
    if (s.net > 0) {
      toast.success(`${label} → +${s.net.toLocaleString()} Vibez`, { duration: 3500 });
    } else {
      toast(label);
    }
  };

  const reset = () => setSession(null);

  return (
    <div
      className="min-h-screen bg-[#07030F] text-white pb-12"
      data-testid="cyber-casino-blackjack"
    >
      <div className="max-w-5xl mx-auto px-4 py-6">
        <button
          onClick={() => navigate("/games/cyber-casino")}
          className="flex items-center gap-2 text-purple-300/70 hover:text-white mb-4"
          data-testid="bj-back-btn"
        >
          <ArrowLeft className="w-4 h-4" /> Cyber Casino
        </button>

        <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-fuchsia-700 shadow-[0_0_22px_rgba(34,211,238,0.45)]">
              <Spade className="w-7 h-7 text-white" />
            </div>
            <div>
              <p className="text-xs font-mono uppercase tracking-[0.3em] text-cyan-400/80">
                Cyber Casino · Server-Authoritative
              </p>
              <h1 className="text-3xl md:text-4xl font-black">Neon Blackjack</h1>
            </div>
          </div>
          <div
            className="px-4 py-2 rounded-xl bg-[#0F0720] border border-fuchsia-500/30 flex items-center gap-2"
            data-testid="bj-balance-card"
          >
            <Coins className="w-4 h-4 text-fuchsia-300" />
            <span className="text-xs uppercase tracking-widest text-purple-300/70">
              Balance
            </span>
            <span
              className="text-xl font-black text-white"
              data-testid="bj-balance"
            >
              {balance === null ? "—" : balance.toLocaleString()}
            </span>
            <span className="text-xs text-fuchsia-300">Vibez</span>
          </div>
        </div>

        {/* Table */}
        <Card className="p-6 md:p-10 bg-gradient-to-br from-emerald-950/80 via-[#0F0720] to-[#0a0413] border border-cyan-500/30 rounded-3xl mb-6 shadow-[0_0_50px_rgba(34,211,238,0.18)]">
          {/* Dealer */}
          <div className="mb-8">
            <p className="text-xs uppercase tracking-[0.3em] text-cyan-400/80 mb-2">
              Dealer · {session?.dealer_total ?? "—"}
            </p>
            <div className="flex gap-2 min-h-[140px] flex-wrap" data-testid="bj-dealer-cards">
              <AnimatePresence>
                {(session?.dealer ?? []).map((c, i) => (
                  <CardFace key={`d-${i}-${c}`} card={c} />
                ))}
              </AnimatePresence>
            </div>
          </div>

          {/* Player */}
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-fuchsia-400/80 mb-2">
              You · {session?.player_total ?? "—"}
              {session && session.bet !== bet && (
                <span className="ml-2 text-amber-300">(bet {session.bet})</span>
              )}
            </p>
            <div className="flex gap-2 min-h-[140px] flex-wrap" data-testid="bj-player-cards">
              <AnimatePresence>
                {(session?.player ?? []).map((c, i) => (
                  <CardFace key={`p-${i}-${c}`} card={c} />
                ))}
              </AnimatePresence>
            </div>
          </div>
        </Card>

        {/* Outcome */}
        {settlement && (
          <Card
            className={`p-4 mb-6 rounded-2xl border ${
              settlement.net > 0
                ? "bg-emerald-500/10 border-emerald-400/40"
                : settlement.outcome.startsWith("push")
                  ? "bg-amber-500/10 border-amber-400/40"
                  : "bg-rose-500/10 border-rose-400/40"
            }`}
            data-testid="bj-outcome"
          >
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-300" />
                <p className="text-lg font-black uppercase tracking-wider">
                  {outcomeLabel(settlement.outcome)}
                </p>
              </div>
              <p className="text-xl font-black">
                {settlement.net > 0 ? "+" : ""}
                {(settlement.net - session!.bet).toLocaleString()} Vibez
              </p>
            </div>
          </Card>
        )}

        {/* Controls */}
        {!session || session.state === "complete" ? (
          <Card className="p-5 rounded-2xl bg-[#0F0720] border border-fuchsia-500/20">
            <p className="text-xs uppercase tracking-[0.3em] text-fuchsia-400/80 mb-3">
              Place your bet
            </p>
            <div className="flex flex-wrap gap-2 mb-4" data-testid="bj-chip-row">
              {CHIPS.map((c) => (
                <button
                  key={c}
                  onClick={() => setBet(c)}
                  className={`px-3 py-1.5 rounded-full text-xs font-black tracking-wider transition-all ${
                    bet === c
                      ? "bg-cyan-500 text-white shadow-[0_0_18px_rgba(34,211,238,0.6)]"
                      : "bg-white/5 text-purple-200 hover:bg-cyan-500/20"
                  }`}
                  data-testid={`bj-chip-${c}`}
                >
                  {c.toLocaleString()}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  reset();
                  deal();
                }}
                disabled={busy || balance === null || bet > (balance ?? 0)}
                className="flex-1 py-5 text-base font-black uppercase tracking-widest bg-gradient-to-r from-cyan-500 to-fuchsia-600 hover:from-cyan-400 hover:to-fuchsia-500 text-white"
                data-testid="bj-deal-btn"
              >
                {settlement ? "Deal Again" : `Deal · ${bet.toLocaleString()} Vibez`}
              </Button>
            </div>
          </Card>
        ) : (
          <Card className="p-5 rounded-2xl bg-[#0F0720] border border-cyan-500/20">
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => action("hit")}
                disabled={busy}
                className="flex-1 min-w-[120px] py-5 font-black uppercase tracking-widest bg-emerald-500 hover:bg-emerald-400"
                data-testid="bj-hit-btn"
              >
                Hit
              </Button>
              <Button
                onClick={() => action("stand")}
                disabled={busy}
                className="flex-1 min-w-[120px] py-5 font-black uppercase tracking-widest bg-rose-500 hover:bg-rose-400"
                data-testid="bj-stand-btn"
              >
                Stand
              </Button>
              <Button
                onClick={() => action("double")}
                disabled={busy || !canDouble || (balance ?? 0) < session.bet}
                className="flex-1 min-w-[120px] py-5 font-black uppercase tracking-widest bg-amber-500 hover:bg-amber-400 disabled:opacity-40"
                data-testid="bj-double-btn"
              >
                Double
              </Button>
              {canInsurance && (
                <Button
                  onClick={() => action("insurance")}
                  disabled={busy || (balance ?? 0) < Math.floor(session.bet / 2)}
                  className="flex-1 min-w-[120px] py-5 font-black uppercase tracking-widest bg-cyan-500 hover:bg-cyan-400"
                  data-testid="bj-insurance-btn"
                >
                  Insurance
                </Button>
              )}
            </div>
          </Card>
        )}

        {/* House rules */}
        <Card className="mt-4 p-4 rounded-2xl bg-[#0F0720] border border-white/5 text-xs text-purple-200/70 leading-relaxed">
          <span className="text-cyan-300 font-bold uppercase tracking-widest text-[10px] block mb-1">
            House Rules
          </span>
          6-deck shoe · Dealer stands soft 17 · Blackjack pays 3:2 · Double on
          any 2 cards · Insurance pays 2:1 · Single hand per round (no split).
        </Card>
      </div>
    </div>
  );
}

function outcomeLabel(o: string): string {
  return (
    {
      blackjack: "Blackjack 3:2",
      win: "You win",
      lose: "Dealer wins",
      bust: "Bust",
      push: "Push",
      "push-blackjack": "Push · both BJ",
    }[o] ?? o
  );
}

const CardFace: React.FC<{ card: string }> = ({ card }) => {
  if (card === "hidden") {
    return (
      <motion.div
        initial={{ rotateY: 90, opacity: 0 }}
        animate={{ rotateY: 0, opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.35 }}
        className="w-20 h-32 md:w-24 md:h-36 rounded-xl bg-gradient-to-br from-purple-700 via-fuchsia-800 to-purple-950 border border-fuchsia-400/40 shadow-[0_0_20px_rgba(217,70,239,0.4)] flex items-center justify-center"
        data-testid="bj-card-hidden"
      >
        <div className="w-12 h-20 md:w-14 md:h-24 rounded-md border-2 border-fuchsia-300/30" />
      </motion.div>
    );
  }
  const rank = card.slice(0, -1);
  const suit = card.slice(-1);
  const meta = SUIT_META[suit] ?? SUIT_META.S;
  const Icon = meta.Icon;
  return (
    <motion.div
      initial={{ rotateY: 90, opacity: 0 }}
      animate={{ rotateY: 0, opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
      className="w-20 h-32 md:w-24 md:h-36 rounded-xl bg-white border border-zinc-300 shadow-lg flex flex-col p-2 justify-between"
      data-testid={`bj-card-${card}`}
    >
      <div className={`flex flex-col items-start ${meta.color}`}>
        <span className="text-lg md:text-xl font-black text-zinc-900">
          {rank}
        </span>
        <Icon className="w-4 h-4" />
      </div>
      <Icon className={`w-8 h-8 md:w-10 md:h-10 self-center ${meta.color}`} />
      <div className={`flex flex-col items-end rotate-180 ${meta.color}`}>
        <span className="text-lg md:text-xl font-black text-zinc-900">
          {rank}
        </span>
        <Icon className="w-4 h-4" />
      </div>
    </motion.div>
  );
};
