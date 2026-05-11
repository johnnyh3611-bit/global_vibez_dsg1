/**
 * EconomicEnginePage — public spec + live-state surface for the
 * DSG Dual-Asset Shield (Global_Vibez_DSG_Economic_Engine.pdf).
 *
 * Route: /economic-engine
 *
 * Investor & user transparency play: the formula, the constants, and
 * the live state are all here. No login required. Stays in sync with
 * the backend via /api/economic-engine/snapshot.
 */
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Coins, Flame, Droplets, Target, ShieldCheck } from "lucide-react";
import EconomicEngineCard from "@/components/economic_engine/EconomicEngineCard";

export default function EconomicEnginePage() {
  const navigate = useNavigate();

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-[#07030F] via-[#0a0b18] to-[#150629] text-white px-4 py-8"
      data-testid="economic-engine-page"
    >
      <div className="max-w-4xl mx-auto">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-purple-300/70 hover:text-white text-sm mb-4"
          data-testid="economic-engine-back"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-fuchsia-600 to-purple-700 shadow-[0_0_20px_rgba(217,70,239,0.45)] flex items-center justify-center">
            <Coins className="w-7 h-7 text-white" />
          </div>
          <div>
            <p className="text-xs font-mono uppercase tracking-[0.3em] text-fuchsia-400/80">
              Vibez Coin · Tokenomics
            </p>
            <h1 className="text-3xl md:text-4xl font-black">DSG Economic Engine</h1>
          </div>
        </div>
        <p className="text-sm text-purple-200/80 mb-8 max-w-2xl">
          A self-regulating dual-asset economy calibrated to a{" "}
          <b className="text-fuchsia-200">premium standard</b> — engineered to accelerate
          project valuation and community wealth. Every fee dollar from Rides, Restaurants
          &amp; Gaming splits 50/50 between Buyback &amp; Burn and Liquidity Injection,
          producing a <b className="text-fuchsia-200">rising price floor and constant scarcity</b>.
          Users transact in Credits — the Standard Utility Unit — so prices stay stable
          regardless of token volatility.
        </p>

        {/* Live state */}
        <EconomicEngineCard />

        {/* The 4 pillars */}
        <div className="grid md:grid-cols-2 gap-3 mt-8" data-testid="economic-engine-pillars">
          <Pillar
            icon={Coins}
            title="Dual-Asset Shield"
            body="Vibez Coin (3 B initial, $0.10 floor parity) drives day-to-day spending. DSG Token (750 M Golden Asset) accrues long-term value to chair-holders + stakers. Credits — the Standard Utility Unit — keep prices stable in every utility room."
          />
          <Pillar
            icon={Flame}
            title="Dynamic Burn"
            body="At 3 B supply we burn 5%. As supply approaches the 1.5 B stabilization floor, burn drops linearly to 0.5%. The closer we get to parity, the gentler the burn — preventing over-deflation while keeping pressure on supply."
          />
          <Pillar
            icon={Droplets}
            title="50 / 50 Revenue Split"
            body="Global revenue from Rides · Restaurants · Gaming splits cleanly: 50% Buyback & Burn — active market purchases that remove supply and drive price. 50% Liquidity Injection — strengthens the pool and protects against volatility."
          />
          <Pillar
            icon={Target}
            title="Dynamic Utility Pricing"
            body="A $10 ride is always a $10 ride. Coins required are computed live so users see stable dollar costs regardless of token volatility. 1 Coin = 10 Credits. $1 USD = 100 Credits."
          />
        </div>

        {/* Trust strip */}
        <div
          className="mt-8 p-4 rounded-xl border border-cyan-400/25 bg-cyan-500/5 flex items-start gap-3"
          data-testid="economic-engine-trust-strip"
        >
          <ShieldCheck className="w-5 h-5 text-cyan-300 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-bold text-cyan-200">Every state change is on-record.</p>
            <p className="text-xs text-cyan-100/80 mt-0.5">
              Each fee ingestion, burn, and liquidity deposit appends an immutable row to{" "}
              <code className="font-mono text-cyan-100">dsg_economic_events</code>. Auditors can
              request the full log; investors can verify the engine has done exactly what the
              spec says it has done.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Pillar({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof Coins;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-xl border border-fuchsia-500/15 bg-[#0F0720] p-4">
      <Icon className="w-5 h-5 text-fuchsia-300 mb-2" />
      <p className="font-bold text-purple-100 text-sm">{title}</p>
      <p className="text-xs text-purple-300/75 mt-1 leading-relaxed">{body}</p>
    </div>
  );
}
