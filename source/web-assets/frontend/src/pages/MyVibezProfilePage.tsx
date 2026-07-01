/**
 * MyVibez Profile — personal stats + earnings + game history + cosmetics.
 *
 * Aggregates data from: /api/auth/me, /api/mining/my-balance, /api/mining/my-history,
 * /api/rewards/my-redemptions, /api/cosmetics/teleport/my-vfx/:user_id.
 */
import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Coins, Trophy, Gift, Sparkles, Loader2, Gamepad2, Clock, Lock } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

type Balance = {
  pending_balance: number;
  balance: number;
  lifetime_mined: number;
  lifetime_redeemed: number;
  locked?: boolean;
  reason?: string;
};

type LedgerRow = {
  mined: number;
  event: string;
  game_type?: string | null;
  status?: string;
  created_at: string;
  hold_until?: string;
};

type GameStat = { game_type: string; wins: number; mined: number; events: number };

type Redemption = {
  gross_vibez: number;
  net_value: number;
  is_express: boolean;
  reward_status: string;
  redeemable_on: string;
  created_at: string;
};

type TeleportVfx = {
  active_effect: string | null;
  unlocked_effects: string[];
  stats: Record<string, number>;
};

const GAME_LABELS: Record<string, string> = {
  spades: "♠️ Spades",
  hearts: "♥️ Hearts",
  uno: "🌈 UNO",
  war: "⚔️ War",
  crazy_eights: "8️⃣ Crazy Eights",
  gin_rummy: "🃏 Gin Rummy",
  go_fish: "🐟 Go Fish",
  rummy: "🃏 Rummy",
  poker: "🎰 Poker",
  blackjack: "🂡 Blackjack",
  bid_whist: "👑 Bid Whist",
  chess: "♟️ Chess",
  trivia: "🧠 Trivia",
  other: "🎮 Other",
};

const EVENT_LABELS: Record<string, string> = {
  game_won: "Game Won",
  trick_won: "Trick Won",
  minute_at_table: "Time at Table",
  spades_hand_won: "Spades Hand Won",
  bid_whist_hand_won: "Bid Whist Hand Won",
  interaction_tick: "Interaction",
  vibe_drive: "Vibe Drive",
  roulette_spin_won: "Roulette Win",
  blackjack_round: "Blackjack Round",
};

const fmt = (n: number) => (Math.round(n * 100) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function MyVibezProfilePage() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string>("");
  const [userName, setUserName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [balance, setBalance] = useState<Balance | null>(null);
  const [history, setHistory] = useState<LedgerRow[]>([]);
  const [byGame, setByGame] = useState<GameStat[]>([]);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [vfx, setVfx] = useState<TeleportVfx | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      try {
        // 1. Me
        const meR = await fetch(`${API}/api/auth/me`, {});
        if (!meR.ok) {
          // Not logged in — send to login
          navigate("/login?next=/me");
          return;
        }
        const me = await meR.json();
        const uid = me.user_id || me.id;
        setUserId(uid);
        setUserName(me.username || me.name || (me.email?.split("@")[0] || "Player"));
        setEmail(me.email || "");

        // 2. Fan out the other calls
        const [balR, histR, redeemR, vfxR] = await Promise.all([
          fetch(`${API}/api/mining/my-balance`, {}),
          fetch(`${API}/api/mining/my-history?limit=40`, {}),
          fetch(`${API}/api/rewards/my-redemptions?limit=20`, {}),
          fetch(`${API}/api/cosmetics/teleport/my-vfx/${encodeURIComponent(uid)}`, {}),
        ]);

        if (balR.ok) setBalance(await balR.json());
        if (histR.ok) {
          const h = await histR.json();
          setHistory((h.rows || []) as LedgerRow[]);
          setByGame((h.by_game || []) as GameStat[]);
        }
        if (redeemR.ok) {
          const r = await redeemR.json();
          setRedemptions((r.redemptions || []) as Redemption[]);
        }
        if (vfxR.ok) {
          const v = await vfxR.json();
          setVfx(v as TeleportVfx);
        }
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [navigate]);

  const totalWins = useMemo(() => (byGame || []).reduce((s, g) => s + (g.wins || 0), 0), [byGame]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-fuchsia-950 to-cyan-950 flex items-center justify-center text-white">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-fuchsia-950 to-cyan-950 text-white p-4 md:p-8" data-testid="my-vibez-profile-page">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} data-testid="myvibez-back-btn">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          <div className="ml-auto text-[10px] font-mono uppercase tracking-[0.3em] text-fuchsia-300">My Vibez</div>
        </div>

        {/* Hero */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mb-10 flex items-center gap-5 flex-wrap">
          <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-gradient-to-br from-fuchsia-500 via-pink-500 to-cyan-400 flex items-center justify-center text-4xl font-black italic text-black">
            {(userName || "?").slice(0, 1).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-mono uppercase tracking-[0.3em] text-fuchsia-300 mb-1">Welcome back</div>
            <h1 className="text-4xl md:text-6xl font-black italic tracking-tighter bg-gradient-to-r from-fuchsia-400 via-pink-400 to-cyan-300 bg-clip-text text-transparent" data-testid="myvibez-username">
              {userName}
            </h1>
            {email && <div className="text-white/40 text-sm mt-1">{email}</div>}
          </div>
          <Button
            onClick={() => navigate("/find-player-2")}
            className="bg-gradient-to-r from-fuchsia-500 to-cyan-400 text-black font-black italic uppercase tracking-widest"
            data-testid="myvibez-find-p2-btn"
          >
            <Sparkles className="w-4 h-4 mr-1" /> Find Your Player 2
          </Button>
        </motion.div>

        {/* Balance KPIs */}
        <div className="grid gap-4 md:grid-cols-4 mb-10">
          <KpiCard label="Available $DSG" value={fmt(balance?.balance || 0)} accent="from-emerald-400 to-cyan-300" icon={<Coins className="w-4 h-4" />} testId="myvibez-kpi-available" />
          <KpiCard label="Pending (72h Hold)" value={fmt(balance?.pending_balance || 0)} accent="from-amber-300 to-orange-400" icon={<Clock className="w-4 h-4" />} testId="myvibez-kpi-pending" />
          <KpiCard label="Lifetime Mined" value={fmt(balance?.lifetime_mined || 0)} accent="from-fuchsia-400 to-pink-400" icon={<Sparkles className="w-4 h-4" />} testId="myvibez-kpi-lifetime" />
          <KpiCard label="Total Wins" value={String(totalWins)} accent="from-yellow-300 to-amber-400" icon={<Trophy className="w-4 h-4" />} testId="myvibez-kpi-wins" />
        </div>

        {balance?.locked && (
          <Card className="mb-8 p-4 bg-amber-500/10 border border-amber-400/30 text-amber-200 flex items-center gap-3" data-testid="myvibez-locked-notice">
            <Lock className="w-4 h-4" />
            <div className="text-sm">
              Mining is currently paused: <span className="font-semibold">{balance.reason || "upgrade required"}</span>.
              <Button variant="ghost" className="text-amber-200 underline ml-2" onClick={() => navigate("/pricing")}>Upgrade</Button>
            </div>
          </Card>
        )}

        {/* Game Breakdown */}
        <Card className="p-5 bg-white/5 border border-white/10 text-white mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Gamepad2 className="w-4 h-4 text-cyan-300" />
            <div className="text-xs font-mono uppercase tracking-[0.3em] text-cyan-300">Games You've Played</div>
            <div className="ml-auto text-xs text-white/40">From your mining activity</div>
          </div>
          {byGame.length === 0 ? (
            <div className="text-sm text-white/50 py-6 text-center" data-testid="myvibez-no-games">
              No games tracked yet. <Button variant="ghost" className="text-fuchsia-300 underline" onClick={() => navigate("/games-menu")}>Play a round</Button> to start building your history.
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {byGame.map((g) => (
                <div key={g.game_type} className="flex items-center gap-3 p-3 rounded-lg border border-white/5 bg-black/30" data-testid={`myvibez-game-${g.game_type}`}>
                  <div className="text-2xl">{(GAME_LABELS[g.game_type] || g.game_type).split(" ")[0]}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold capitalize">{(GAME_LABELS[g.game_type] || g.game_type).split(" ").slice(1).join(" ") || g.game_type.replace("_", " ")}</div>
                    <div className="text-xs text-white/50">{g.wins} {g.wins === 1 ? "win" : "wins"} · {g.events} events</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-white/40 uppercase tracking-widest">mined</div>
                    <div className="text-sm font-bold tabular-nums text-fuchsia-300">+{fmt(g.mined)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Teleport / Cosmetics */}
        {vfx && (
          <Card className="p-5 bg-white/5 border border-white/10 text-white mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-4 h-4 text-fuchsia-300" />
              <div className="text-xs font-mono uppercase tracking-[0.3em] text-fuchsia-300">Teleport VFX Unlocked</div>
              <div className="ml-auto text-xs text-white/40">{(vfx.unlocked_effects || []).length} total</div>
            </div>
            {(vfx.unlocked_effects || []).length === 0 ? (
              <div className="text-sm text-white/50 py-3 text-center">Play VR dates and win streaks to unlock cosmic-grade teleport effects.</div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {(vfx.unlocked_effects || []).map((c) => (
                  <span key={c} className={`px-3 py-1.5 rounded-full text-xs font-bold ${vfx.active_effect === c ? "bg-gradient-to-r from-fuchsia-500 to-cyan-400 text-black" : "bg-white/5 text-white/70 border border-white/10"}`} data-testid={`myvibez-vfx-${c}`}>
                    {vfx.active_effect === c && "● "}{c.replace(/_/g, " ")}
                  </span>
                ))}
              </div>
            )}
          </Card>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          {/* Recent Activity */}
          <Card className="p-5 bg-white/5 border border-white/10 text-white">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-4 h-4 text-amber-300" />
              <div className="text-xs font-mono uppercase tracking-[0.3em] text-amber-300">Recent Activity</div>
            </div>
            {history.length === 0 ? (
              <div className="text-sm text-white/50 py-4 text-center">No activity yet.</div>
            ) : (
              <div className="space-y-1 max-h-96 overflow-y-auto">
                {history.slice(0, 40).map((h, i) => (
                  <div key={i} className="flex items-center gap-3 py-1.5 text-sm border-b border-white/5">
                    <div className="flex-1 min-w-0 truncate">
                      <span className="text-white/80">{EVENT_LABELS[h.event] || h.event}</span>
                      {h.game_type && <span className="text-white/40"> · {h.game_type}</span>}
                    </div>
                    <div className={`font-bold tabular-nums flex-shrink-0 ${h.status === "SHADOW" ? "text-white/30" : "text-fuchsia-300"}`}>
                      +{fmt(h.mined || 0)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Redemptions */}
          <Card className="p-5 bg-white/5 border border-white/10 text-white">
            <div className="flex items-center gap-2 mb-4">
              <Gift className="w-4 h-4 text-emerald-300" />
              <div className="text-xs font-mono uppercase tracking-[0.3em] text-emerald-300">Appreciation Gifts</div>
              <Button variant="ghost" size="sm" className="ml-auto text-white/60" onClick={() => navigate("/wallet")} data-testid="myvibez-wallet-link">
                Wallet
              </Button>
            </div>
            {redemptions.length === 0 ? (
              <div className="text-sm text-white/50 py-4 text-center" data-testid="myvibez-no-redemptions">No gifts redeemed yet.</div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {redemptions.map((r, i) => (
                  <div key={i} className="p-3 rounded-lg border border-white/5 bg-black/30" data-testid={`myvibez-redemption-${i}`}>
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-bold">{fmt(r.gross_vibez)} $DSG → ₵{fmt(r.net_value)}</div>
                      <span className={`ml-auto text-[10px] px-2 py-0.5 rounded-full ${r.is_express ? "bg-fuchsia-500/15 border border-fuchsia-400/30 text-fuchsia-200" : "bg-white/5 border border-white/10 text-white/60"}`}>
                        {r.is_express ? "EXPRESS" : "STANDARD"}
                      </span>
                    </div>
                    <div className="text-xs text-white/40 mt-1">
                      {r.reward_status} · ready {new Date(r.redeemable_on).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

// -- little KPI component (local; not worth a separate file) --
const KpiCard: React.FC<{ label: string; value: string; accent: string; icon: React.ReactNode; testId?: string }> = ({ label, value, accent, icon, testId }) => (
  <div className="relative rounded-xl border border-white/10 bg-gradient-to-br from-white/5 to-white/0 p-4 overflow-hidden" data-testid={testId}>
    <div className={`absolute -top-8 -right-8 w-28 h-28 rounded-full blur-3xl opacity-25 bg-gradient-to-br ${accent}`} aria-hidden />
    <div className="relative z-10 flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.3em] text-white/50 mb-1">
      {icon}{label}
    </div>
    <div className="relative z-10 text-3xl md:text-4xl font-black italic tabular-nums">{value}</div>
  </div>
);
