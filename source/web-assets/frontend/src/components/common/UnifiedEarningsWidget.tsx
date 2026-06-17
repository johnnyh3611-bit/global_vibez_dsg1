/**
 * UnifiedEarningsWidget — single rollup of every role's income.
 *
 * 2026-05-12 founder ask: "would you like a 'unified earnings widget' on
 * the main dashboard that rolls up income across every role you wear?"
 *
 * Sits on both Classic + Volumetric dashboards. Polls
 * /api/me/unified-earnings every 30s. Shows:
 *   • Big total USD (this-week toggle / lifetime)
 *   • 4 inline role chips (Driver · Host · Merchant · Streamer)
 *   • Streamer earns in ₵ coins not USD — surfaced separately so we
 *     don't conflate real-money flows with in-app credit.
 *
 * Auto-hides for anonymous / guest users (401 from API → render null).
 * Auto-hides if user has zero earnings across every role AND zero venues
 * AND zero streams (a brand-new account doesn't need the noise).
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { TrendingUp, Car, Home, Pizza, Tv } from "lucide-react";
import { authFetch } from "@/utils/secureAuth";

const API = process.env.REACT_APP_BACKEND_URL;

interface ByRoleDriver { lifetime_usd: number; last_7d_usd: number; }
interface ByRoleHost { lifetime_usd: number; last_7d_usd: number; venue_count: number; }
interface ByRoleMerchant { lifetime_usd: number; last_7d_usd: number; }
interface ByRoleStreamer { lifetime_coins: number; last_7d_coins: number; stream_count: number; }

interface UnifiedEarnings {
  total_usd_lifetime: number;
  total_usd_7d: number;
  by_role: {
    driver: ByRoleDriver;
    host: ByRoleHost;
    merchant: ByRoleMerchant;
    streamer: ByRoleStreamer;
  };
}

type Window = "7d" | "lifetime";

const fmt = (n: number): string =>
  n >= 1000
    ? `$${(n / 1000).toFixed(1)}k`
    : `$${n.toFixed(n < 100 ? 2 : 0)}`;

const fmtCoins = (n: number): string =>
  n >= 1000 ? `₵${(n / 1000).toFixed(1)}k` : `₵${n}`;

export default function UnifiedEarningsWidget({
  compact = false,
}: { compact?: boolean }) {
  const navigate = useNavigate();
  const [data, setData] = useState<UnifiedEarnings | null>(null);
  const [window, setWindow] = useState<Window>("7d");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await authFetch(`${API}/api/me/unified-earnings`);
        if (!res.ok) {
          if (!cancelled) setData(null);
          return;
        }
        const d = await res.json();
        if (!cancelled) setData(d);
      } catch {
        /* silent — widget self-hides on error */
      }
    };
    load();
    const id = setInterval(load, 30000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (!data) return null;
  const { by_role } = data;
  const allZero =
    data.total_usd_lifetime === 0 &&
    by_role.streamer.lifetime_coins === 0 &&
    by_role.host.venue_count === 0 &&
    by_role.streamer.stream_count === 0;
  if (allZero) return null;

  const isWeek = window === "7d";
  const total = isWeek ? data.total_usd_7d : data.total_usd_lifetime;
  const driverVal = isWeek ? by_role.driver.last_7d_usd : by_role.driver.lifetime_usd;
  const hostVal = isWeek ? by_role.host.last_7d_usd : by_role.host.lifetime_usd;
  const merchantVal = isWeek ? by_role.merchant.last_7d_usd : by_role.merchant.lifetime_usd;
  const streamerCoins = isWeek ? by_role.streamer.last_7d_coins : by_role.streamer.lifetime_coins;

  return (
    <div
      className={`rounded-2xl border border-emerald-400/30 bg-gradient-to-br from-emerald-900/40 via-black/60 to-emerald-950/60 backdrop-blur-md ${compact ? "p-3" : "p-4"} relative overflow-hidden`}
      data-testid="unified-earnings-widget"
    >
      <div
        className="absolute inset-0 opacity-10 pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(circle at 90% 10%, rgba(52,211,153,.4), transparent 50%)",
        }}
      />
      <div className="flex items-center justify-between mb-2 relative">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-emerald-300" />
          <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-emerald-200/80">
            Unified Earnings
          </span>
        </div>
        <div className="flex gap-1 text-[9px] uppercase tracking-widest" data-testid="unified-earnings-toggle">
          <button
            type="button"
            onClick={() => setWindow("7d")}
            data-testid="unified-earnings-window-7d"
            className={`px-2 py-0.5 rounded-full font-bold transition-colors ${
              isWeek
                ? "bg-emerald-400 text-emerald-950"
                : "bg-white/5 text-emerald-200/60 hover:text-white"
            }`}
          >
            7d
          </button>
          <button
            type="button"
            onClick={() => setWindow("lifetime")}
            data-testid="unified-earnings-window-lifetime"
            className={`px-2 py-0.5 rounded-full font-bold transition-colors ${
              !isWeek
                ? "bg-emerald-400 text-emerald-950"
                : "bg-white/5 text-emerald-200/60 hover:text-white"
            }`}
          >
            All
          </button>
        </div>
      </div>

      <p
        className="text-3xl md:text-4xl font-black text-white relative leading-none"
        data-testid="unified-earnings-total"
      >
        {fmt(total)}
        {streamerCoins > 0 && (
          <span className="text-base text-cyan-300 ml-2 font-bold">
            · {fmtCoins(streamerCoins)}
          </span>
        )}
      </p>

      <div className="flex flex-wrap gap-1.5 mt-3 relative" data-testid="unified-earnings-roles">
        {driverVal > 0 && (
          <RoleChip
            icon={<Car className="w-3 h-3" />}
            label="Driver"
            value={fmt(driverVal)}
            onClick={() => navigate("/vibe-ridez/driver-dashboard")}
            testId="unified-earnings-chip-driver"
            tint="border-cyan-400/40 text-cyan-200"
          />
        )}
        {hostVal > 0 && (
          <RoleChip
            icon={<Home className="w-3 h-3" />}
            label="Host"
            value={fmt(hostVal)}
            onClick={() => navigate("/vibe-venues/host-dashboard")}
            testId="unified-earnings-chip-host"
            tint="border-violet-400/40 text-violet-200"
          />
        )}
        {merchantVal > 0 && (
          <RoleChip
            icon={<Pizza className="w-3 h-3" />}
            label="Merchant"
            value={fmt(merchantVal)}
            onClick={() => navigate("/hungryvibes/merchant")}
            testId="unified-earnings-chip-merchant"
            tint="border-amber-400/40 text-amber-200"
          />
        )}
        {streamerCoins > 0 && (
          <RoleChip
            icon={<Tv className="w-3 h-3" />}
            label="Streamer"
            value={fmtCoins(streamerCoins)}
            onClick={() => navigate("/my-streams")}
            testId="unified-earnings-chip-streamer"
            tint="border-pink-400/40 text-pink-200"
          />
        )}
      </div>
    </div>
  );
}

function RoleChip({
  icon,
  label,
  value,
  onClick,
  testId,
  tint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onClick: () => void;
  testId: string;
  tint: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${tint} bg-black/30 hover:bg-black/50 transition-colors text-[10px] font-bold`}
    >
      {icon}
      <span className="uppercase tracking-wider">{label}</span>
      <span className="text-white">{value}</span>
    </button>
  );
}
