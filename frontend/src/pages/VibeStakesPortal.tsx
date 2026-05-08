/**
 * /vibe-stakes — Profit-Sharing Program (member-facing).
 *
 * Members earn "Vibe Stakes" through Premium membership + platform
 * activity. Every quarter, the platform automatically distributes a
 * cut of revenue across stakeholders weighted by their stake count,
 * with a 1.5× boost for Premium members.
 *
 * NOT a security — no SEC, no exchange, no buy button. Just earn and
 * get auto-paid in ₵ Vibez Coins.
 */
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Coins,
  Sparkles,
  Trophy,
  Clock,
  TrendingUp,
  Zap,
  CheckCircle2,
  Flame,
  Vault,
  Crown,
  ArrowRight,
} from "lucide-react";
import { authFetch, getUserId } from "@/utils/secureAuth";
import { Link } from "react-router-dom";

const API = process.env.REACT_APP_BACKEND_URL;

type Pool = {
  total_stakes: number;
  stakeholders: number;
  quarterly_profit_usd: number;
  profit_share_ratio: number;
  pool_usd: number;
  pool_coins: number;
  quarter_key: string;
  next_quarter_start: string;
  premium_multiplier: number;
  currency: string;
  usd_to_coins_rate: number;
  surge?: { active: boolean; expires_at: string | null; multiplier: number };
};

type Me = {
  user_id: string;
  current_stakes: number;
  lifetime_stakes: number;
  is_premium: boolean;
  premium_multiplier: number;
  next_quarter_start: string;
  projected_share_pct: number;
  projected_payout_usd: number;
  projected_payout_coins: number;
};

type HistoryRow = {
  quarter_key: string;
  stakes_at_payout: number;
  payout_coins: number;
  payout_usd: number;
  premium_boost_applied: boolean;
  paid_at: string;
};

type Treasury = {
  current_quarter: { key: string; pool_coins: number; pool_usd: number; stakeholders: number; total_stakes: number };
  last_quarter: {
    key: string | null; stakeholders_paid: number; premium_count: number;
    actually_paid_coins: number; actually_paid_usd: number; ran_at: string | null;
  };
  stability_reserve_usd: number;
  leaderboard: { anon_id: string; current_stakes: number; lifetime_stakes: number }[];
  surge: { active: boolean; expires_at: string | null; multiplier: number };
};

const fmtCoins = (n: number) => `₵ ${n.toLocaleString()}`;
const fmtMoney = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

function daysUntil(iso: string): number {
  const ms = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

export default function VibeStakesPortal() {
  const [pool, setPool] = useState<Pool | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [treasury, setTreasury] = useState<Treasury | null>(null);

  useEffect(() => {
    fetch(`${API}/api/profit-share/pool`).then(r => r.ok && r.json()).then(setPool);
    fetch(`${API}/api/profit-share/treasury`).then(r => r.ok && r.json()).then(setTreasury);
    if (getUserId()) {
      authFetch(`${API}/api/profit-share/me`).then(r => r.ok && r.json()).then(setMe);
      authFetch(`${API}/api/profit-share/history?limit=12`).then(r => r.ok && r.json()).then(d => setHistory(d.rows || []));
    }
  }, []);

  const surge = treasury?.surge ?? pool?.surge ?? null;

  return (
    <div className="min-h-screen bg-[#050507] text-cyan-100 relative overflow-hidden font-sans">
      <div
        className="absolute inset-0 opacity-25 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(34,211,238,0.18) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.18) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,170,0,0.08),transparent_60%)] pointer-events-none" />

      <main className="relative z-10 max-w-5xl mx-auto px-6 py-12">
        {/* Hero */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-400/30 rounded-full px-3 py-1 text-[10px] uppercase tracking-widest text-amber-300">
            <Sparkles className="w-3 h-3" /> Vibe Stakes · Profit Share
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black mt-4 leading-tight">
            Play the platform.{" "}
            <span className="bg-gradient-to-r from-cyan-300 via-amber-300 to-fuchsia-400 bg-clip-text text-transparent">
              Get paid quarterly.
            </span>
          </h1>
          <p className="text-base sm:text-lg text-cyan-300/80 mt-4 max-w-2xl mx-auto">
            Members earn Vibe Stakes for every game, ride, deposit, and
            month of Premium. Every quarter we automatically pay out
            a slice of platform revenue — weighted by your stakes, with
            a <strong className="text-fuchsia-300">1.5× boost</strong> for
            Premium members. No buying, no waiting, no paperwork.
          </p>
        </motion.section>

        {/* Vibe Peak surge banner */}
        {surge?.active && (
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            data-testid="vibe-stakes-surge-banner"
            className="mt-6 rounded-2xl border border-amber-400/40 bg-gradient-to-r from-amber-500/15 via-rose-500/10 to-fuchsia-500/15 backdrop-blur-xl p-4 flex items-center gap-3"
          >
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-rose-500 flex items-center justify-center shrink-0 animate-pulse">
              <Flame className="w-6 h-6 text-black" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase tracking-widest text-amber-300 font-bold">Vibe Peak Active</p>
              <p className="text-base sm:text-lg font-black text-white">
                {surge.multiplier}× stakes on every action
              </p>
              {surge.expires_at && (
                <p className="text-[11px] text-amber-200/70 mt-0.5">
                  Surge ends {new Date(surge.expires_at).toLocaleString()}
                </p>
              )}
            </div>
          </motion.section>
        )}

        {/* Pool snapshot */}
        {pool && (
          <section className="mt-10 grid sm:grid-cols-4 gap-3" data-testid="vibe-stakes-pool">
            {[
              { label: "This quarter", value: pool.quarter_key, color: "text-cyan-200" },
              { label: "Pool size", value: fmtCoins(pool.pool_coins), color: "text-amber-300" },
              { label: "Stakeholders", value: pool.stakeholders.toLocaleString(), color: "text-white" },
              { label: "Total stakes", value: pool.total_stakes.toLocaleString(), color: "text-fuchsia-300" },
            ].map((s) => (
              <div key={s.label} className="glass-panel p-4 text-center">
                <p className={`text-xl sm:text-2xl font-black ${s.color}`}>{s.value}</p>
                <p className="text-[10px] uppercase tracking-widest text-cyan-500 mt-1">{s.label}</p>
              </div>
            ))}
          </section>
        )}

        {/* My stakes card */}
        {me && (
          <section className="mt-8" data-testid="vibe-stakes-me">
            <div className="glass-panel p-6">
              <div className="flex items-start justify-between flex-wrap gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-cyan-500">
                    Your stakes this quarter
                  </p>
                  <p className="text-5xl font-black text-white mt-1" data-testid="vibe-stakes-current">
                    {me.current_stakes.toLocaleString()}
                  </p>
                  <p className="text-xs text-cyan-400/70 mt-1">
                    Lifetime: {me.lifetime_stakes.toLocaleString()}
                  </p>
                </div>
                {me.is_premium && (
                  <div className="bg-gradient-to-br from-fuchsia-500 to-amber-500 text-black rounded-2xl px-3 py-2 text-center">
                    <p className="text-[9px] uppercase tracking-widest">Premium</p>
                    <p className="text-lg font-black">1.5× Boost</p>
                  </div>
                )}
              </div>

              <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-cyan-500">Your share</p>
                  <p className="text-2xl font-black text-cyan-200" data-testid="vibe-stakes-share">
                    {me.projected_share_pct}%
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-cyan-500">Projected USD</p>
                  <p className="text-2xl font-black text-amber-300">
                    {fmtMoney(me.projected_payout_usd)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-cyan-500">In ₵ Vibez</p>
                  <p className="text-2xl font-black text-fuchsia-300" data-testid="vibe-stakes-projected">
                    {fmtCoins(me.projected_payout_coins)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-cyan-500">Pays in</p>
                  <p className="text-2xl font-black text-white">
                    {daysUntil(me.next_quarter_start)}<span className="text-sm">d</span>
                  </p>
                </div>
              </div>

              <p className="mt-4 text-[11px] text-cyan-500/80 flex items-center gap-2">
                <Clock className="w-3 h-3" />
                Auto-paid into your wallet on{" "}
                {new Date(me.next_quarter_start).toLocaleDateString()}.
                Your stakes reset to zero so the next quarter starts fresh.
              </p>
            </div>
          </section>
        )}

        {/* How to earn */}
        <section className="mt-10">
          <h2 className="text-2xl font-black text-white flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-cyan-300" /> How to stack stakes
          </h2>
          <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              { icon: Zap, label: "Renew Premium", value: "+200 / month", color: "from-fuchsia-500 to-pink-500" },
              { icon: Crown, label: "Creator revenue", value: "+30 / $1 earned", color: "from-amber-400 to-rose-500" },
              { icon: Coins, label: "Deposit ₵ via Solana", value: "+10 / $1", color: "from-emerald-400 to-cyan-500" },
              { icon: Trophy, label: "Finish a card hand", value: "+3", color: "from-amber-400 to-orange-500" },
              { icon: Sparkles, label: "Complete a VibeRidez", value: "+2", color: "from-cyan-400 to-blue-500" },
              { icon: Sparkles, label: "Play Vibez 654", value: "+1", color: "from-amber-300 to-yellow-500" },
              { icon: Sparkles, label: "Vibe Call minute", value: "+1", color: "from-violet-400 to-fuchsia-500" },
            ].map((p) => {
              const Icon = p.icon;
              return (
                <div
                  key={p.label}
                  className="glass-panel p-4 flex items-center gap-3"
                  data-testid={`vibe-stakes-howto-${p.label}`}
                >
                  <div className={`w-10 h-10 rounded-2xl bg-gradient-to-br ${p.color} flex items-center justify-center flex-shrink-0`}>
                    <Icon className="w-5 h-5 text-black" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">{p.label}</p>
                    <p className="text-xs text-cyan-400">{p.value} stakes</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* House Tier upsell */}
        <section className="mt-10" data-testid="vibe-stakes-house-tier-upsell">
          <Link
            to="/chair-vault"
            className="block group rounded-2xl border border-amber-400/30 bg-gradient-to-r from-amber-500/15 via-rose-500/10 to-fuchsia-500/15 backdrop-blur-xl p-6 hover:border-amber-300 transition-all"
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 via-rose-500 to-fuchsia-500 flex items-center justify-center text-3xl shrink-0 shadow-lg">
                ♠️
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] uppercase tracking-widest text-amber-300 font-bold">
                  Want a permanent seat at the table?
                </p>
                <p className="text-xl sm:text-2xl font-black text-white mt-1">
                  Park a Founder Chair · Genius $10 → Phase V $30 phase pricing
                </p>
                <p className="text-[12px] text-cyan-300/80 mt-1">
                  Invite-only. 60,000 chairs, 70% of the quarterly pool goes to active chair holders.
                </p>
              </div>
              <ArrowRight className="w-6 h-6 text-amber-300 group-hover:translate-x-1 transition-transform shrink-0" />
            </div>
          </Link>
        </section>

        {/* History */}
        {history.length > 0 && (
          <section className="mt-10" data-testid="vibe-stakes-history">
            <h2 className="text-2xl font-black text-white flex items-center gap-2">
              <CheckCircle2 className="w-6 h-6 text-emerald-300" /> Past payouts
            </h2>
            <div className="mt-3 glass-panel p-4">
              <table className="w-full text-xs">
                <thead className="text-cyan-500 uppercase tracking-widest text-[10px]">
                  <tr>
                    <th className="text-left py-2">Quarter</th>
                    <th className="text-right">Stakes</th>
                    <th className="text-right">Payout</th>
                    <th className="text-right">Boost</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((row) => (
                    <tr key={row.quarter_key} className="border-t border-cyan-500/10">
                      <td className="py-2 text-cyan-200 font-mono">{row.quarter_key}</td>
                      <td className="py-2 text-right text-cyan-100">
                        {row.stakes_at_payout.toLocaleString()}
                      </td>
                      <td className="py-2 text-right text-amber-300 font-bold">
                        {fmtCoins(row.payout_coins)}
                      </td>
                      <td className="py-2 text-right">
                        {row.premium_boost_applied ? (
                          <span className="text-fuchsia-300">1.5×</span>
                        ) : (
                          <span className="text-cyan-600">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Treasury / Reserve dashboard */}
        {treasury && (
          <section className="mt-10" data-testid="vibe-stakes-treasury">
            <h2 className="text-2xl font-black text-white flex items-center gap-2">
              <Vault className="w-6 h-6 text-amber-300" /> Treasury report
            </h2>
            <p className="text-xs text-cyan-500/80 mt-1">
              Public, read-only. Anonymized leaderboard so members can see who's stacking without doxxing anyone.
            </p>
            <div className="mt-3 grid sm:grid-cols-3 gap-3">
              <div className="glass-panel p-4">
                <p className="text-[10px] uppercase tracking-widest text-cyan-500">Stability reserve</p>
                <p className="text-2xl font-black text-amber-300 mt-1" data-testid="vibe-stakes-reserve">
                  {fmtMoney(treasury.stability_reserve_usd)}
                </p>
                <p className="text-[11px] text-cyan-500/70 mt-1">
                  30% of every Premium subscription, rainy-day fund.
                </p>
              </div>
              <div className="glass-panel p-4">
                <p className="text-[10px] uppercase tracking-widest text-cyan-500">Last quarter paid</p>
                <p className="text-2xl font-black text-fuchsia-300 mt-1">
                  {treasury.last_quarter.actually_paid_coins
                    ? fmtCoins(treasury.last_quarter.actually_paid_coins)
                    : "—"}
                </p>
                <p className="text-[11px] text-cyan-500/70 mt-1">
                  {treasury.last_quarter.stakeholders_paid
                    ? `${treasury.last_quarter.stakeholders_paid} members · ${treasury.last_quarter.premium_count} premium`
                    : "First quarter pending."}
                </p>
              </div>
              <div className="glass-panel p-4">
                <p className="text-[10px] uppercase tracking-widest text-cyan-500">Next quarter pool</p>
                <p className="text-2xl font-black text-cyan-200 mt-1">
                  {fmtCoins(treasury.current_quarter.pool_coins)}
                </p>
                <p className="text-[11px] text-cyan-500/70 mt-1">
                  {treasury.current_quarter.stakeholders.toLocaleString()} stakeholders ·{" "}
                  {treasury.current_quarter.total_stakes.toLocaleString()} stakes total
                </p>
              </div>
            </div>

            {treasury.leaderboard.length > 0 && (
              <div className="mt-3 glass-panel p-4">
                <p className="text-[10px] uppercase tracking-widest text-cyan-500 mb-2">
                  Top stakeholders this quarter (anonymized)
                </p>
                <table className="w-full text-xs">
                  <thead className="text-cyan-500 uppercase tracking-widest text-[10px]">
                    <tr>
                      <th className="text-left py-2 w-10">#</th>
                      <th className="text-left">Anon ID</th>
                      <th className="text-right">This quarter</th>
                      <th className="text-right">Lifetime</th>
                    </tr>
                  </thead>
                  <tbody data-testid="vibe-stakes-leaderboard">
                    {treasury.leaderboard.map((row, i) => (
                      <tr key={`${row.anon_id}-${i}`} className="border-t border-cyan-500/10">
                        <td className="py-2 text-amber-300 font-mono">{i + 1}</td>
                        <td className="py-2 text-cyan-200 font-mono">{row.anon_id}</td>
                        <td className="py-2 text-right text-cyan-100 font-bold">
                          {row.current_stakes.toLocaleString()}
                        </td>
                        <td className="py-2 text-right text-cyan-500/80">
                          {row.lifetime_stakes.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* Legal note */}
        <p className="mt-12 text-center text-[10px] text-cyan-500/60 uppercase tracking-widest leading-relaxed max-w-3xl mx-auto">
          Vibe Stakes is a loyalty / profit-share program. Stakes are not
          shares, are not transferable, and have no monetary value
          independent of platform payouts. Quarterly distributions are
          discretionary and may be adjusted with notice.
        </p>
      </main>
    </div>
  );
}
