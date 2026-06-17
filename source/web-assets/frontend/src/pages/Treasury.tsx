import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, TrendingUp, Lock, Wallet, ArrowLeft, ExternalLink, Activity, AlertTriangle } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

type SplitPolicy = {
  team_pct: number;
  operations_pct: number;
  reserve_pct: number;
  founder_pct_of_gross: number;
  core_team_pct_of_gross: number;
  founder_cap: {
    auto_enabled: boolean;
    trigger_mrr_usd: number;
    monthly_amount_usd: number;
    overflow_destination: string;
  };
};

type Rolling30 = {
  gross_usd: number;
  team_usd: number;
  ops_usd: number;
  reserve_usd: number;
  founder_usd: number;
  core_team_usd: number;
  chair_pool_overflow_usd: number;
  tx_count: number;
};

type TransparencyData = {
  split_policy: SplitPolicy;
  rolling_30d: Rolling30;
  integrations: {
    squads_multisig_address: string | null;
    streamflow_payroll_active: boolean;
    usdc_auto_swap_active: boolean;
  };
  last_monthly_distribution: { period_label?: string; totals?: Record<string, number> } | null;
  promise: string;
};

const fmt = (n: number | undefined | null) =>
  (n ?? 0).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export default function Treasury() {
  const [data, setData] = useState<TransparencyData | null>(null);
  const [solvency, setSolvency] = useState<any>(null);
  const [prices, setPrices] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API}/api/treasury/transparency`)
      .then((r) => (r.ok ? r.json() : Promise.reject(`HTTP ${r.status}`)))
      .then(setData)
      .catch((e) => setErr(String(e)));
    fetch(`${API}/api/treasury/solvency`).then((r) => r.ok && r.json().then(setSolvency));
    fetch(`${API}/api/oracle/prices`).then((r) => r.ok && r.json().then(setPrices));

    // Live solvency push — backend broadcasts every 60s.
    let socket: any = null;
    (async () => {
      try {
        const { io } = await import("socket.io-client");
        socket = io(API, { transports: ["websocket", "polling"], path: "/socket.io" });
        socket.on("connect", () => socket.emit("join_treasury_room", {}));
        socket.on("solvency_update", (p: any) => setSolvency(p));
      } catch {
        /* socket.io optional — page still works on initial fetch */
      }
    })();
    return () => { if (socket) socket.disconnect(); };
  }, []);

  if (err) {
    return (
      <div className="min-h-screen bg-slate-950 text-white p-8">
        <p data-testid="treasury-error" className="text-red-400">Treasury panel unavailable: {err}</p>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="min-h-screen bg-slate-950 text-white p-8">
        <p data-testid="treasury-loading">Loading transparency report…</p>
      </div>
    );
  }

  const { split_policy: pol, rolling_30d: r30, integrations: ig } = data;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-emerald-950/40 to-slate-950 text-white">
      <div className="max-w-6xl mx-auto px-6 py-12 space-y-10" data-testid="treasury-page">
        {/* Header */}
        <div>
          <Link to="/" className="inline-flex items-center text-emerald-300/80 hover:text-emerald-300 text-sm mb-6">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back to Home
          </Link>
          <div className="flex items-center gap-3">
            <Shield className="w-9 h-9 text-emerald-400" />
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">Vibez Treasury</h1>
          </div>
          <p className="mt-3 text-lg text-emerald-100/70 max-w-3xl">{data.promise}</p>
          <Badge className="mt-4 bg-emerald-900/60 border border-emerald-500/40 text-emerald-200">
            Read-only · updated live · all amounts in USD
          </Badge>
        </div>

        {/* Split policy 40-30-30 */}
        <section data-testid="treasury-split-cards" className="grid md:grid-cols-3 gap-5">
          {[
            {
              label: "Team & Founders",
              pct: pol.team_pct,
              detail: `${pol.founder_pct_of_gross}% Founder · ${pol.core_team_pct_of_gross}% Core Team`,
              color: "from-emerald-600 to-teal-600",
            },
            {
              label: "Platform Operations",
              pct: pol.operations_pct,
              detail: "Servers · Marketing · RPC · Unreal assets",
              color: "from-cyan-600 to-blue-600",
            },
            {
              label: "Reserve & Rewards",
              pct: pol.reserve_pct,
              detail: "War chest · Chair-holder rewards pool",
              color: "from-fuchsia-600 to-purple-700",
            },
          ].map((c) => (
            <Card
              key={c.label}
              className="bg-slate-900/70 border-slate-800 p-6 backdrop-blur-md"
              data-testid={`bucket-${c.label.toLowerCase().replace(/[^a-z]/g, "-")}`}
            >
              <div className={`inline-block px-3 py-1 rounded-full text-xs font-semibold bg-gradient-to-r ${c.color}`}>
                {c.pct}%
              </div>
              <h3 className="text-2xl font-bold mt-3">{c.label}</h3>
              <p className="text-slate-400 text-sm mt-2">{c.detail}</p>
            </Card>
          ))}
        </section>

        {/* Rolling 30d totals */}
        <section data-testid="treasury-rolling30">
          <h2 className="text-2xl font-bold mb-5 flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-emerald-400" /> Rolling 30 Days
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Stat label="Gross Revenue" value={fmt(r30.gross_usd)} testid="stat-gross" />
            <Stat label="Team Bucket" value={fmt(r30.team_usd)} testid="stat-team" />
            <Stat label="Operations" value={fmt(r30.ops_usd)} testid="stat-ops" />
            <Stat label="Reserve" value={fmt(r30.reserve_usd)} testid="stat-reserve" />
            <Stat label="Founder Draw" value={fmt(r30.founder_usd)} testid="stat-founder" />
            <Stat label="Core Team" value={fmt(r30.core_team_usd)} testid="stat-core-team" />
            <Stat label="Chair-holder Overflow" value={fmt(r30.chair_pool_overflow_usd)} testid="stat-overflow" />
            <Stat label="Transactions" value={`${Math.round(r30.tx_count)}`} testid="stat-tx" />
          </div>
        </section>

        {/* Founder Cap card */}
        <section>
          <Card className="bg-slate-900/70 border border-amber-500/30 p-6" data-testid="founder-cap-card">
            <div className="flex items-center gap-3">
              <Lock className="w-6 h-6 text-amber-400" />
              <h2 className="text-xl font-bold">Founder Cap Rule</h2>
              {pol.founder_cap.auto_enabled ? (
                <Badge className="bg-amber-900/50 border-amber-500/40 text-amber-200">Active</Badge>
              ) : (
                <Badge className="bg-slate-800 border-slate-600 text-slate-400">Disabled</Badge>
              )}
            </div>
            <p className="text-slate-300 mt-3">
              Once monthly platform revenue exceeds{" "}
              <strong className="text-amber-300">{fmt(pol.founder_cap.trigger_mrr_usd)}</strong>, the Founder's Draw
              auto-caps at{" "}
              <strong className="text-amber-300">{fmt(pol.founder_cap.monthly_amount_usd)}</strong>/month. Any
              overflow flows to: <em className="text-emerald-300">{pol.founder_cap.overflow_destination}</em>.
            </p>
          </Card>
        </section>

        {/* Solvency Meter — manifesto §4 */}
        {solvency && (
          <section data-testid="solvency-meter">
            <Card className={`bg-slate-900/70 border p-6 ${solvency.insured ? "border-emerald-500/40" : "border-red-500/40"}`}>
              <div className="flex items-center gap-3 mb-3">
                <Activity className="w-6 h-6 text-cyan-400" />
                <h2 className="text-xl font-bold">Solvency Meter</h2>
                <Badge className={solvency.insured
                  ? "bg-emerald-900/60 border-emerald-500/40 text-emerald-200"
                  : "bg-red-900/60 border-red-500/40 text-red-200"}>
                  {solvency.insured ? "INSURED" : "UNDER-COLLATERALIZED"}
                </Badge>
              </div>
              <div className="grid md:grid-cols-3 gap-4 mb-4">
                <Stat label="Reserve Vault" value={fmt(solvency.vault_usd)} testid="solv-vault" />
                <Stat label="Total Refund Liability" value={fmt(solvency.liability_usd)} testid="solv-liability" />
                <Stat label="Coverage" value={`${solvency.coverage_pct}%`} testid="solv-coverage" />
              </div>
              <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-700 ${
                    solvency.coverage_pct >= 100 ? "bg-emerald-500" :
                    solvency.coverage_pct >= 50 ? "bg-amber-500" : "bg-red-500"}`}
                  style={{ width: `${Math.min(100, solvency.coverage_pct)}%` }}
                />
              </div>
              {solvency.circuit_breaker.engaged && (
                <div className="mt-4 flex items-center gap-2 text-amber-300 text-sm">
                  <AlertTriangle className="w-4 h-4" />
                  Circuit Breaker engaged — VIBEZ price (${solvency.circuit_breaker.current_vibez_usd}) below floor
                  (${solvency.circuit_breaker.floor_price_usd}).
                </div>
              )}
              <p className="text-xs text-slate-500 mt-3">
                {solvency.active_chairs} active chairs. Liability = sum of all chair purchase prices that haven't
                been burned. As long as Vault ≥ Liability, every chair holder is guaranteed a dollar-equivalent
                refund at the 60-day burn.
              </p>
            </Card>
          </section>
        )}

        {/* Live Pyth oracle prices */}
        {prices && (
          <section data-testid="oracle-prices">
            <Card className="bg-slate-900/70 border-slate-800 p-5">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-5 h-5 text-cyan-400" />
                <h3 className="text-sm uppercase tracking-wider text-slate-400">Live Prices · Pyth Network</h3>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <Stat label="SOL / USD" value={fmt(prices.sol_usd)} testid="px-sol" />
                <Stat label="USDC / USD" value={fmt(prices.usdc_usd)} testid="px-usdc" />
                <Stat label="$DSG / USD" value={`$${prices.vibez_usd?.toFixed(4)}`} testid="px-vibez" />
              </div>
              <p className="text-[10px] text-slate-500 mt-2">
                SOL/USDC sourced live from Pyth Hermes. $DSG uses internal fallback price until mainnet listing.
              </p>
            </Card>
          </section>
        )}

        {/* On-chain integrations */}
        <section>
          <Card className="bg-slate-900/70 border-slate-800 p-6" data-testid="integrations-card">
            <div className="flex items-center gap-3 mb-4">
              <Wallet className="w-6 h-6 text-cyan-400" />
              <h2 className="text-xl font-bold">On-Chain Integrations</h2>
            </div>
            <ul className="space-y-3 text-sm">
              <IntegrationRow
                label="Squads Multi-Sig Vault"
                ok={!!ig.squads_multisig_address}
                value={ig.squads_multisig_address ?? "Not yet configured — vault will be a Squads 2-of-2."}
                link={ig.squads_multisig_address ? `https://app.squads.so/squads/${ig.squads_multisig_address}` : null}
              />
              <IntegrationRow
                label="Streamflow Auto-Payroll"
                ok={ig.streamflow_payroll_active}
                value={ig.streamflow_payroll_active ? "Active — payroll streams running" : "Pending API key"}
              />
              <IntegrationRow
                label="USDC Auto-Swap (Stable Payroll Shield)"
                ok={ig.usdc_auto_swap_active}
                value={ig.usdc_auto_swap_active ? "Active — payroll auto-swaps to USDC" : "Pending swap routing"}
              />
            </ul>
          </Card>
        </section>

        {data.last_monthly_distribution && (
          <section data-testid="last-distribution">
            <h2 className="text-2xl font-bold mb-3">Last Monthly Snapshot</h2>
            <Card className="bg-slate-900/70 border-slate-800 p-6">
              <p className="text-slate-300">
                Period: <strong>{data.last_monthly_distribution.period_label}</strong>
              </p>
              <pre className="text-xs text-slate-400 mt-3 overflow-x-auto">
                {JSON.stringify(data.last_monthly_distribution.totals, null, 2)}
              </pre>
            </Card>
          </section>
        )}

        <p className="text-xs text-slate-500 pt-6 border-t border-slate-800">
          This page is read-only. Allocations are recorded immutably to{" "}
          <code className="text-emerald-300">treasury_ledger</code> on every successful payment. Once the Squads
          multi-sig and Streamflow keys are wired in, on-chain transfers will execute on the 1st of every month at
          00:05 UTC.
        </p>
      </div>
    </div>
  );
}

function Stat({ label, value, testid }: { label: string; value: string; testid: string }) {
  return (
    <Card className="bg-slate-900/70 border-slate-800 p-4" data-testid={testid}>
      <p className="text-xs uppercase tracking-wider text-slate-500">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </Card>
  );
}

function IntegrationRow({
  label,
  ok,
  value,
  link,
}: {
  label: string;
  ok: boolean;
  value: string;
  link?: string | null;
}) {
  return (
    <li className="flex items-start justify-between gap-4 border-b border-slate-800/60 pb-3 last:border-0">
      <div>
        <p className="font-medium text-slate-200">{label}</p>
        <p className="text-slate-400 text-xs mt-0.5 break-all">{value}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {link && (
          <a href={link} target="_blank" rel="noopener noreferrer" className="text-cyan-300 hover:text-cyan-200">
            <ExternalLink className="w-4 h-4" />
          </a>
        )}
        <Badge
          className={
            ok
              ? "bg-emerald-900/60 border-emerald-500/40 text-emerald-200"
              : "bg-slate-800 border-slate-700 text-slate-400"
          }
        >
          {ok ? "Configured" : "Pending"}
        </Badge>
      </div>
    </li>
  );
}
