/**
 * RewardsEscrowTab — Cyber-Industrial God-Mode panel for Unity / WebGL
 * game-result rewards. Lists rewards in the 72-hour escrow queue and
 * lets admins Release or Freeze.
 *
 * Endpoints:
 *   GET  /api/v1/admin/god-mode/pending
 *   POST /api/v1/admin/god-mode/release/{reward_id}
 *   POST /api/v1/admin/god-mode/freeze/{reward_id}
 *   GET  /api/v1/admin/god-mode/daily-report
 */
import { useState, useEffect, useCallback } from "react";
import {
  Shield,
  Activity,
  Coins,
  Users,
  Snowflake,
  Send,
  RefreshCw,
  Lock,
  AlertTriangle,
  Clock,
  Bolt,
} from "lucide-react";
import { authFetch } from "@/utils/secureAuth";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

type Reward = {
  reward_id: string;
  user_id: string;
  user_email?: string;
  user_wallet?: string;
  game_id: string;
  gross_amount?: number;
  fee_amount?: number;
  fee_rate?: number;
  reward_amount: number;
  speed?: "standard" | "instant";
  points: number;
  multiplier: number;
  status: "pending" | "released" | "flagged" | "completed";
  is_manually_frozen?: boolean;
  is_ready?: boolean;
  created_at: string;
  unlock_at: string;
};

const formatDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleString() : "—";

const StatCard = ({
  icon,
  title,
  value,
  accent,
  caption,
}: {
  icon: React.ReactNode;
  title: string;
  value: React.ReactNode;
  accent: "cyan" | "fuchsia" | "amber" | "emerald" | "red";
  caption?: string;
}) => {
  const accentMap: Record<string, string> = {
    cyan: "border-cyan-500",
    fuchsia: "border-fuchsia-500",
    amber: "border-amber-500",
    emerald: "border-emerald-500",
    red: "border-red-500",
  };
  return (
    <div
      className={`p-4 bg-black border-l-4 ${accentMap[accent]} rounded transition-transform hover:scale-[1.02]`}
    >
      <div className="flex items-center gap-2 text-cyan-700 mb-1">
        {icon}
        <span className="text-[10px] uppercase tracking-widest">{title}</span>
      </div>
      <div className="text-2xl font-bold text-white font-mono">{value}</div>
      {caption && (
        <div className="text-[10px] text-cyan-700 mt-0.5">{caption}</div>
      )}
    </div>
  );
};

export default function RewardsEscrowTab() {
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const refresh = useCallback(async () => {
    setErrorMessage("");
    try {
      const res = await authFetch(`${API}/v1/admin/god-mode/pending`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErrorMessage(
          res.status === 403
            ? "Admin access required."
            : data.detail || `Request failed (${res.status})`,
        );
        return;
      }
      const data = await res.json();
      setRewards(data.rewards || []);
    } catch {
      setErrorMessage("Network error — could not reach the rewards API.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
  }, [refresh]);

  const handleRelease = async (r: Reward) => {
    if (
      !window.confirm(
        `Release ₵${r.reward_amount.toLocaleString()} VIBEZ to ${r.user_id}?`,
      )
    )
      return;
    setActing(r.reward_id);
    try {
      const res = await authFetch(
        `${API}/v1/admin/god-mode/release/${r.reward_id}`,
        { method: "POST" },
      );
      if (res.ok) refresh();
      else {
        const data = await res.json().catch(() => ({}));
        alert(data.detail || "Release failed");
      }
    } finally {
      setActing(null);
    }
  };

  const handleFreeze = async (r: Reward) => {
    if (!window.confirm(`Freeze reward ${r.reward_id}?`)) return;
    setActing(r.reward_id);
    try {
      const res = await authFetch(
        `${API}/v1/admin/god-mode/freeze/${r.reward_id}`,
        { method: "POST" },
      );
      if (res.ok) refresh();
      else {
        const data = await res.json().catch(() => ({}));
        alert(data.detail || "Freeze failed");
      }
    } finally {
      setActing(null);
    }
  };

  const triggerDailyReport = async () => {
    try {
      const res = await authFetch(`${API}/v1/admin/god-mode/daily-report`);
      if (res.ok) {
        const data = await res.json();
        alert(
          `Recon report posted.\nTotal rewards: ${data.total_rewards}\n₵ Volume: ${data.total_vibez}\nFlags: ${data.frozen_count}`,
        );
      } else {
        alert("Daily report failed.");
      }
    } catch {
      alert("Daily report network error.");
    }
  };

  const totalCoins = rewards.reduce((s, r) => s + (r.reward_amount || 0), 0);
  const readyCount = rewards.filter((r) => r.is_ready).length;
  const instantCount = rewards.filter((r) => r.speed === "instant").length;

  // Hours-remaining countdown helper
  const hoursLeft = (iso?: string) => {
    if (!iso) return "—";
    const ms = new Date(iso).getTime() - Date.now();
    if (ms <= 0) return "READY";
    const h = Math.floor(ms / 3_600_000);
    const m = Math.floor((ms % 3_600_000) / 60_000);
    return `${h}h ${m}m`;
  };

  return (
    <div
      className="bg-black text-cyan-400 p-6 font-mono rounded-lg border border-cyan-900/40"
      data-testid="rewards-escrow-tab"
    >
      {/* Header */}
      <header className="border-b border-cyan-900 pb-4 mb-6 flex justify-between items-center flex-wrap gap-3">
        <h1 className="text-2xl font-bold tracking-tighter flex items-center gap-2">
          <Shield className="text-red-500" /> GOD-MODE COMMAND CENTER
        </h1>
        <div className="flex items-center gap-3">
          <div className="text-right text-[10px] text-cyan-700 uppercase tracking-widest">
            System Status:{" "}
            <span className="text-green-500 underline">Optimized</span>
          </div>
          <button
            onClick={triggerDailyReport}
            className="flex items-center gap-1 text-[11px] text-amber-300 hover:text-amber-200 px-3 py-1.5 rounded border border-amber-500/30 uppercase tracking-wider"
            data-testid="rewards-escrow-daily-report"
          >
            <AlertTriangle className="w-3 h-3" /> Recon
          </button>
          <button
            onClick={refresh}
            className="flex items-center gap-1 text-[11px] text-cyan-300 hover:text-cyan-200 px-3 py-1.5 rounded border border-cyan-500/30 uppercase tracking-wider"
            data-testid="rewards-escrow-refresh"
          >
            <RefreshCw className="w-3 h-3" /> Refresh
          </button>
        </div>
      </header>

      {errorMessage && (
        <div className="mb-4 px-4 py-3 rounded border border-red-500/40 bg-red-900/20 text-red-200 text-xs">
          {errorMessage}
        </div>
      )}

      {/* Metrics grid */}
      <div
        className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6"
        data-testid="rewards-escrow-summary"
      >
        <StatCard
          icon={<Activity className="w-4 h-4" />}
          title="Token Velocity"
          value={`₵${totalCoins.toLocaleString()}`}
          accent="cyan"
          caption="In escrow now"
        />
        <StatCard
          icon={<Users className="w-4 h-4" />}
          title="Pending Rewards"
          value={rewards.length}
          accent="fuchsia"
        />
        <StatCard
          icon={<Coins className="w-4 h-4" />}
          title="Ready ≥72h"
          value={readyCount}
          accent="amber"
        />
        <StatCard
          icon={<Bolt className="w-4 h-4" />}
          title="Instant (12% fee)"
          value={instantCount}
          accent="emerald"
        />
      </div>

      {/* Reward queue table */}
      <div className="bg-gray-950 border border-cyan-900 rounded-lg overflow-hidden">
        <div className="bg-cyan-900/20 p-3 border-b border-cyan-900 font-bold uppercase tracking-widest text-xs flex items-center gap-2">
          <Lock className="w-3 h-3" /> 72-Hour Reward Approval Queue
          <span className="ml-auto text-[10px] text-cyan-700">
            Auto-refresh · 30s
          </span>
        </div>
        {loading ? (
          <div className="p-6 text-cyan-700 text-sm">Loading…</div>
        ) : rewards.length === 0 ? (
          <div className="flex flex-col items-center text-cyan-800 py-10 px-6">
            <Lock className="w-10 h-10 mb-2 text-cyan-900" />
            <span className="text-xs uppercase tracking-widest">
              No Unity rewards pending review.
            </span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-cyan-700 border-b border-cyan-900/50 uppercase tracking-widest">
                  <th className="p-3">User</th>
                  <th className="p-3">Game</th>
                  <th className="p-3">Net ₵</th>
                  <th className="p-3">Speed</th>
                  <th className="p-3">Wallet</th>
                  <th className="p-3">Time Left</th>
                  <th className="p-3">Action</th>
                </tr>
              </thead>
              <tbody data-testid="rewards-escrow-rows">
                {rewards.map((r) => {
                  const busy = acting === r.reward_id;
                  const speed = r.speed || "standard";
                  const wallet = r.user_wallet
                    ? `${r.user_wallet.slice(0, 4)}…${r.user_wallet.slice(-4)}`
                    : "—";
                  return (
                    <tr
                      key={r.reward_id}
                      className="border-b border-cyan-900/30 hover:bg-cyan-900/10"
                      data-testid={`rewards-escrow-row-${r.reward_id}`}
                    >
                      <td className="p-3 text-white text-[11px]">
                        {r.user_email || r.user_id}
                      </td>
                      <td className="p-3 capitalize text-cyan-300">
                        {r.game_id.replace(/_/g, " ")}
                      </td>
                      <td className="p-3 font-bold text-white">
                        ₵{r.reward_amount.toLocaleString()}
                        {r.fee_amount ? (
                          <div className="text-[9px] text-cyan-700">
                            fee ₵{r.fee_amount.toLocaleString()}
                          </div>
                        ) : null}
                      </td>
                      <td className="p-3">
                        {speed === "instant" ? (
                          <span className="px-2 py-0.5 border border-fuchsia-500/40 text-fuchsia-300 rounded text-[10px] uppercase tracking-widest">
                            <Bolt className="w-2.5 h-2.5 inline mr-1" />Instant
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 border border-cyan-500/40 text-cyan-300 rounded text-[10px] uppercase tracking-widest">
                            <Clock className="w-2.5 h-2.5 inline mr-1" />Standard
                          </span>
                        )}
                      </td>
                      <td className="p-3 font-mono text-emerald-400 text-[11px]">
                        {wallet}
                      </td>
                      <td
                        className={`p-3 font-mono text-[11px] ${
                          r.is_ready ? "text-emerald-400" : "text-yellow-500"
                        }`}
                      >
                        {hoursLeft(r.unlock_at)}
                        <div className="text-[9px] text-cyan-700">
                          {formatDate(r.unlock_at)}
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex gap-1.5">
                          <button
                            disabled={busy || !r.is_ready}
                            onClick={() => handleRelease(r)}
                            className="bg-emerald-900/20 border border-emerald-500 text-emerald-400 px-2.5 py-1 hover:bg-emerald-500 hover:text-black transition-all text-[10px] uppercase tracking-widest disabled:opacity-40 disabled:hover:bg-emerald-900/20 disabled:hover:text-emerald-400"
                            data-testid={`rewards-escrow-release-${r.reward_id}`}
                          >
                            <Send className="w-2.5 h-2.5 inline mr-1" />
                            Release
                          </button>
                          <button
                            disabled={busy}
                            onClick={() => handleFreeze(r)}
                            className="bg-red-900/20 border border-red-500 text-red-500 px-2.5 py-1 hover:bg-red-500 hover:text-white transition-all text-[10px] uppercase tracking-widest disabled:opacity-50"
                            data-testid={`rewards-escrow-freeze-${r.reward_id}`}
                          >
                            <Snowflake className="w-2.5 h-2.5 inline mr-1" />
                            Flag
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
