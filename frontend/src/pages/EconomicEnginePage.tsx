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
import { ArrowLeft, Coins, Flame, Recycle, Target, ShieldCheck } from "lucide-react";
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
          project valuation and community wealth.{" "}
          <b className="text-emerald-200">In-app VIBEZ ₵</b> (3B fixed supply) recirculates
          40/30/30 across tournament pools, treasury, and a 72h vault — coins never burn,
          they cycle.{" "}
          <b className="text-fuchsia-200">DSG Token</b> (750M Solana SPL) keeps a separate
          burn schedule for long-term scarcity. Users transact in Credits — the Standard
          Utility Unit — so prices stay stable regardless of token volatility.
        </p>

        {/* Live state */}
        <EconomicEngineCard />

        {/* The 4 pillars */}
        <div className="grid md:grid-cols-2 gap-3 mt-8" data-testid="economic-engine-pillars">
          <Pillar
            icon={Coins}
            title="Dual-Asset Shield"
            body="VIBEZ ₵ (3B fixed, recirculates) drives day-to-day spending. DSG Token (750M Golden Asset, burns) accrues long-term value to chair-holders + stakers. Credits — the Standard Utility Unit — keep prices stable in every utility room."
          />
          <Pillar
            icon={Recycle}
            title="In-App Recirculation (₵)"
            body="Coins never burn. Every in-app transaction splits 40% to Tournament Pools, 30% to Platform Treasury, and 30% to a 72-hour vault that auto-releases back into circulation. Velocity drives value — your spend funds someone's next win."
          />
          <Pillar
            icon={Flame}
            title="DSG Token Burn Schedule"
            body="The Solana SPL token (750M total) burns 5% at the ceiling, declining linearly to 0% at the 350M floor. Formula: min(5%, (supply − 350M) / 50M × 1%). Gentle near the floor — pressure on supply without over-deflating long-term holders."
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
              Every in-app recirculation split writes to{" "}
              <code className="font-mono text-cyan-100">recirculation_ledger</code>;
              every DSG burn writes to{" "}
              <code className="font-mono text-cyan-100">dsg_economic_events</code>. Two
              ledgers, two economies, both immutable. Auditors can request either log.
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
