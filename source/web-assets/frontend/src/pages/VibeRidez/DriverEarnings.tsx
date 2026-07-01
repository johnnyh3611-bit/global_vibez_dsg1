/**
 * Driver Earnings — per-ride fare-split receipt + lifetime/30d totals.
 *
 * Reads:
 *   GET /api/viberidez/driver/earnings-summary  (auth-gated)
 *   GET /api/viberidez/economics/split-policy   (public)
 *
 * Designed to make the math impossible to misread: every line shows
 * the gross fare and what every cent went to (driver/chair/platform/
 * insurance/referral). Builds trust with drivers AND with riders who
 * peek at the page.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Car, Coins, ShieldCheck, Users, Building2, ArrowLeft, RefreshCw } from "lucide-react";
import { authFetch } from "@/utils/secureAuth";

const API = process.env.REACT_APP_BACKEND_URL;

type Bucket = "driver" | "chair_pool" | "platform" | "insurance" | "referral";

type SplitPolicy = {
  escape_velocity_active: boolean;
  split_pct: Record<Bucket, number>;
  split_pct_pre_ev: Record<Bucket, number>;
  split_pct_post_ev: Record<Bucket, number>;
  marketing_line: string;
};

type RideRow = {
  ride_id: string;
  total_fare_usd: number;
  driver_usd: number;
  chair_usd: number;
  platform_usd: number;
  insurance_usd: number;
  referral_usd: number;
  driver_payout_status: string;
  driver_payout_token: string;
  driver_payout_tx_sig: string | null;
  escape_velocity_active: boolean;
  created_at: string;
};

type Summary = {
  driver_id: string;
  lifetime: { rides: number; fare_usd: number; driver_payout_usd: number };
  last_30_days: { rides: number; fare_usd: number; driver_payout_usd: number };
  recent_rides: RideRow[];
};

const fmt = (n: number) =>
  `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function DriverEarnings() {
  const [policy, setPolicy] = useState<SplitPolicy | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [pRes, sRes] = await Promise.all([
        fetch(`${API}/api/viberidez/economics/split-policy`),
        authFetch(`${API}/api/viberidez/driver/earnings-summary`),
      ]);
      if (!pRes.ok) throw new Error(`policy ${pRes.status}`);
      if (!sRes.ok) throw new Error(`summary ${sRes.status}`);
      setPolicy(await pRes.json());
      setSummary(await sRes.json());
    } catch (e: any) {
      setError(e?.message || "Failed to load earnings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div
      className="min-h-screen bg-[#020a1a] text-slate-100"
      data-testid="driver-earnings-page"
    >
      <div className="mx-auto max-w-5xl px-5 py-8">
        <div className="mb-6 flex items-center justify-between">
          <Link
            to="/vibe-ridez/driver-dashboard"
            className="inline-flex items-center gap-2 text-sm text-slate-300 hover:text-white"
            data-testid="back-to-dashboard-link"
          >
            <ArrowLeft className="h-4 w-4" /> Driver Dashboard
          </Link>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-full border border-cyan-500/40 px-3 py-1.5 text-xs text-cyan-200 hover:bg-cyan-500/10 disabled:opacity-50"
            data-testid="earnings-refresh-btn"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        <header className="mb-8">
          <h1 className="text-4xl font-bold tracking-tight">Earnings</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            Every ride flows through a transparent five-bucket split. You see
            exactly what you earned, what went to chair holders, and what the
            platform took — receipt-style, every time.
          </p>
        </header>

        {error && (
          <div
            className="mb-6 rounded-lg border border-rose-500/40 bg-rose-950/40 px-4 py-3 text-sm text-rose-200"
            data-testid="earnings-error"
          >
            {error}
          </div>
        )}

        {/* Totals */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <SummaryCard
            label="Last 30 days"
            primary={fmt(summary?.last_30_days.driver_payout_usd ?? 0)}
            secondary={`${summary?.last_30_days.rides ?? 0} rides · ${fmt(
              summary?.last_30_days.fare_usd ?? 0,
            )} gross`}
            testid="earnings-30d-card"
            tone="cyan"
          />
          <SummaryCard
            label="Lifetime"
            primary={fmt(summary?.lifetime.driver_payout_usd ?? 0)}
            secondary={`${summary?.lifetime.rides ?? 0} rides · ${fmt(
              summary?.lifetime.fare_usd ?? 0,
            )} gross`}
            testid="earnings-lifetime-card"
            tone="emerald"
          />
          <SummaryCard
            label={
              policy?.escape_velocity_active ? "Post-EV split" : "Pre-EV split"
            }
            primary={`${Math.round((policy?.split_pct.driver ?? 0.7) * 100)}% to driver`}
            secondary={`${Math.round((policy?.split_pct.chair_pool ?? 0.14) * 100)}% to chair pool`}
            testid="earnings-split-card"
            tone={policy?.escape_velocity_active ? "amber" : "indigo"}
          />
        </div>

        {/* Split policy — full breakdown */}
        {policy && (
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-8 rounded-2xl border border-white/10 bg-slate-950/50 p-5"
            data-testid="split-policy-card"
          >
            <h2 className="text-lg font-semibold tracking-tight">
              How every dollar splits
              {policy.escape_velocity_active && (
                <span className="ml-2 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] uppercase tracking-wider text-amber-300">
                  Escape Velocity active
                </span>
              )}
            </h2>
            <p className="mt-1 max-w-3xl text-xs text-slate-400">
              {policy.marketing_line}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
              <BucketCell
                icon={<Car className="h-4 w-4" />}
                name="Driver"
                pct={policy.split_pct.driver}
                tone="cyan"
                testid="bucket-driver"
              />
              <BucketCell
                icon={<Coins className="h-4 w-4" />}
                name="Chair pool"
                pct={policy.split_pct.chair_pool}
                tone="amber"
                testid="bucket-chair"
              />
              <BucketCell
                icon={<Building2 className="h-4 w-4" />}
                name="Platform"
                pct={policy.split_pct.platform}
                tone="slate"
                testid="bucket-platform"
              />
              <BucketCell
                icon={<ShieldCheck className="h-4 w-4" />}
                name="Insurance"
                pct={policy.split_pct.insurance}
                tone="emerald"
                testid="bucket-insurance"
              />
              <BucketCell
                icon={<Users className="h-4 w-4" />}
                name="Referrals"
                pct={policy.split_pct.referral}
                tone="indigo"
                testid="bucket-referral"
              />
            </div>
          </motion.section>
        )}

        {/* Recent rides */}
        <section className="mt-8" data-testid="recent-rides-section">
          <h2 className="text-lg font-semibold tracking-tight">Recent rides</h2>
          {loading && (
            <p className="mt-3 text-sm text-slate-400">Loading…</p>
          )}
          {!loading && summary && summary.recent_rides.length === 0 && (
            <p
              className="mt-3 rounded-lg border border-dashed border-white/10 bg-slate-950/40 p-6 text-center text-sm text-slate-400"
              data-testid="empty-rides-state"
            >
              No rides yet. Once you complete a ride with a fare, it'll show up
              here with a full split breakdown.
            </p>
          )}
          {!loading && summary && summary.recent_rides.length > 0 && (
            <div className="mt-3 overflow-x-auto rounded-2xl border border-white/10">
              <table className="w-full text-sm">
                <thead className="bg-slate-950/60 text-xs uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="px-4 py-3 text-left">When</th>
                    <th className="px-4 py-3 text-right">Gross</th>
                    <th className="px-4 py-3 text-right">You</th>
                    <th className="px-4 py-3 text-right">Chair</th>
                    <th className="px-4 py-3 text-right">Platform</th>
                    <th className="px-4 py-3 text-right">Ins.</th>
                    <th className="px-4 py-3 text-right">Ref.</th>
                    <th className="px-4 py-3 text-left">Payout</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.recent_rides.map((r) => (
                    <tr
                      key={r.ride_id}
                      className="border-t border-white/5 hover:bg-slate-950/40"
                      data-testid={`ride-row-${r.ride_id}`}
                    >
                      <td className="px-4 py-3 text-slate-400">
                        {new Date(r.created_at).toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        {fmt(r.total_fare_usd)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-cyan-300">
                        {fmt(r.driver_usd)}
                      </td>
                      <td className="px-4 py-3 text-right text-amber-300">
                        {fmt(r.chair_usd)}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-300">
                        {fmt(r.platform_usd)}
                      </td>
                      <td className="px-4 py-3 text-right text-emerald-300">
                        {fmt(r.insurance_usd)}
                      </td>
                      <td className="px-4 py-3 text-right text-indigo-300">
                        {fmt(r.referral_usd)}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <PayoutBadge status={r.driver_payout_status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  primary,
  secondary,
  testid,
  tone,
}: {
  label: string;
  primary: string;
  secondary: string;
  testid: string;
  tone: "cyan" | "emerald" | "amber" | "indigo";
}) {
  const tones: Record<string, string> = {
    cyan: "from-cyan-500/20 to-cyan-500/5 border-cyan-500/30",
    emerald: "from-emerald-500/20 to-emerald-500/5 border-emerald-500/30",
    amber: "from-amber-500/20 to-amber-500/5 border-amber-500/30",
    indigo: "from-indigo-500/20 to-indigo-500/5 border-indigo-500/30",
  };
  return (
    <div
      className={`rounded-2xl border bg-gradient-to-br ${tones[tone]} p-5`}
      data-testid={testid}
    >
      <div className="text-xs uppercase tracking-wider text-slate-400">
        {label}
      </div>
      <div className="mt-2 text-3xl font-bold tracking-tight">{primary}</div>
      <div className="mt-1 text-xs text-slate-400">{secondary}</div>
    </div>
  );
}

function BucketCell({
  icon,
  name,
  pct,
  tone,
  testid,
}: {
  icon: React.ReactNode;
  name: string;
  pct: number;
  tone: "cyan" | "amber" | "slate" | "emerald" | "indigo";
  testid: string;
}) {
  const tones: Record<string, string> = {
    cyan: "border-cyan-500/40 text-cyan-200 bg-cyan-500/10",
    amber: "border-amber-500/40 text-amber-200 bg-amber-500/10",
    slate: "border-slate-500/40 text-slate-200 bg-slate-500/10",
    emerald: "border-emerald-500/40 text-emerald-200 bg-emerald-500/10",
    indigo: "border-indigo-500/40 text-indigo-200 bg-indigo-500/10",
  };
  return (
    <div
      className={`rounded-xl border ${tones[tone]} p-3`}
      data-testid={testid}
    >
      <div className="flex items-center gap-2 text-xs">
        {icon}
        <span className="font-semibold">{name}</span>
      </div>
      <div className="mt-2 text-2xl font-bold">
        {(pct * 100).toFixed(Number.isInteger(pct * 100) ? 0 : 1)}%
      </div>
    </div>
  );
}

function PayoutBadge({ status }: { status: string }) {
  const m: Record<string, { label: string; cls: string }> = {
    pending: { label: "USDC pending", cls: "bg-amber-500/20 text-amber-200" },
    paid: { label: "USDC paid", cls: "bg-emerald-500/20 text-emerald-200" },
    skipped_no_driver: {
      label: "n/a",
      cls: "bg-slate-500/20 text-slate-300",
    },
  };
  const v = m[status] || { label: status, cls: "bg-slate-500/20 text-slate-300" };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] ${v.cls}`}>
      {v.label}
    </span>
  );
}
