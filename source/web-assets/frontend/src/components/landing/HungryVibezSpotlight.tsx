/**
 * HungryVibezSpotlight — landing page surface for the Hungry Vibez
 * utility room. Sits next to the VibeRidez spotlight so visitors see
 * both earning paths at once (rides AND deliveries on the same fleet).
 *
 * Drives home the v3 mission letter point: "Interlocks with VibeRidez"
 * — same driver network, two task types, one $DSG payout rail.
 */
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  UtensilsCrossed,
  Bike,
  Store,
  Coins,
  ArrowRight,
  Crown,
} from "lucide-react";

const API_EXAMPLE = {
  order_id: "HV-1024",
  task_type: "DELIVERY", // or "RIDE"
  origin: "Mom & Pop's Cafe",
  destination: "User Address",
  payout_token: "VIBEZ",
  status: "pending",
};

export default function HungryVibezSpotlight() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6" data-testid="hungry-vibez-spotlight">
      {/* Pitch strip */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="flex flex-col lg:flex-row gap-6 items-stretch"
      >
        <div className="flex-1 p-6 rounded-2xl bg-gradient-to-br from-orange-950/60 via-fuchsia-950/50 to-[#0F0720] border border-orange-400/30">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-xl bg-orange-500/15 border border-orange-400/40 flex items-center justify-center">
              <UtensilsCrossed className="w-6 h-6 text-orange-300" />
            </div>
            <div>
              <p className="text-xs font-mono uppercase tracking-[0.3em] text-orange-300/90">
                Utility Room · v3 Mission
              </p>
              <h3 className="text-2xl font-black text-white">Hungry Vibez</h3>
            </div>
          </div>
          <p className="text-sm text-orange-100/85 leading-relaxed">
            Mom &amp; Pop kitchens, delivered by your neighbors.{" "}
            <span className="text-white font-semibold">
              Same fleet as VibeRidez
            </span>{" "}
            — drivers just see a second task type pop up in their queue.
            Restaurants pay a flat <span className="text-orange-300">$30/month</span>{" "}
            partnership (no per-order predator fees), drivers keep{" "}
            <span className="text-orange-300">70%</span> of the delivery fee via
            the same on-chain Solana split, and the whole thing settles in{" "}
            <span className="text-fuchsia-300 font-semibold">$DSG</span>.
          </p>
        </div>
      </motion.div>

      {/* Three-pillar story: Customer · Driver · Restaurant */}
      <div className="grid md:grid-cols-3 gap-4">
        <PillarCard
          icon={UtensilsCrossed}
          tone="fuchsia"
          title="Customers"
          body="Order from the Date Spot Finder, track delivery with live POV, pay with $DSG or card."
          testid="hv-pillar-customer"
        />
        <PillarCard
          icon={Bike}
          tone="orange"
          title="Drivers"
          body="Accept RIDE + DELIVERY tasks on the same shift. 70% fare split, VibeXP per drop, livestream tips."
          testid="hv-pillar-driver"
        />
        <PillarCard
          icon={Store}
          tone="purple"
          title="Restaurants"
          body="Flat $30/mo. Keep 100% of menu price. Neon Purple Vibe-Ring + in-app commercials."
          testid="hv-pillar-restaurant"
        />
      </div>

      {/* Unified dispatch task model */}
      <div className="p-5 rounded-2xl bg-[#0B0618] border border-fuchsia-500/25">
        <div className="flex items-center gap-2 mb-3">
          <Coins className="w-4 h-4 text-fuchsia-300" />
          <p className="text-xs font-mono uppercase tracking-[0.3em] text-fuchsia-300/80">
            Unified Dispatch Schema
          </p>
        </div>
        <p className="text-xs text-purple-300/70 mb-3 leading-relaxed">
          Every job on the fleet — whether it's a VibeRidez rider pickup or a
          Hungry Vibez kitchen delivery — flows through the same driver
          dispatch payload. One app, one payout rail, one XP ledger.
        </p>
        <pre
          className="text-[11px] leading-5 p-4 rounded-lg bg-black/60 border border-fuchsia-500/15 text-fuchsia-200 font-mono overflow-x-auto"
          data-testid="hv-dispatch-schema"
        >
{JSON.stringify(API_EXAMPLE, null, 2)}
        </pre>
      </div>

      {/* CTA row */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => navigate("/hungry-vibez")}
          className="px-5 py-3 rounded-xl bg-orange-500 hover:bg-orange-400 text-white font-bold shadow-[0_0_22px_rgba(249,115,22,0.45)] transition-all flex items-center gap-2"
          data-testid="hv-spotlight-explore-btn"
        >
          <UtensilsCrossed className="w-4 h-4" /> Explore Hungry Vibez
        </button>
        <button
          onClick={() => navigate("/vibe-ridez")}
          className="px-5 py-3 rounded-xl border border-fuchsia-400/40 text-fuchsia-200 hover:bg-fuchsia-500/10 hover:text-white font-bold transition-all flex items-center gap-2"
          data-testid="hv-spotlight-drive-btn"
        >
          <Bike className="w-4 h-4" /> Drive the Fleet
        </button>
        <button
          onClick={() => navigate("/date-spot-finder")}
          className="px-5 py-3 rounded-xl border border-fuchsia-400/40 text-fuchsia-200 hover:bg-fuchsia-500/10 hover:text-white font-bold transition-all flex items-center gap-2"
          data-testid="hv-spotlight-browse-btn"
        >
          Browse Venues <ArrowRight className="w-4 h-4" />
        </button>
        <button
          onClick={() => navigate("/restaurants/submit?partner=1&tab=hungry")}
          className="px-5 py-3 rounded-xl border border-orange-400/40 text-orange-200 hover:bg-orange-500/10 hover:text-white font-bold transition-all flex items-center gap-2"
          data-testid="hv-spotlight-partner-btn"
        >
          <Crown className="w-4 h-4" /> Partner a Kitchen · $30/mo
        </button>
      </div>
    </div>
  );
}

const PillarCard: React.FC<{
  icon: React.ElementType;
  tone: "fuchsia" | "orange" | "purple";
  title: string;
  body: string;
  testid?: string;
}> = ({ icon: Icon, tone, title, body, testid }) => {
  const tones = {
    fuchsia: "border-fuchsia-500/30 bg-fuchsia-500/5 text-fuchsia-300",
    orange: "border-orange-500/30 bg-orange-500/5 text-orange-300",
    purple: "border-purple-500/30 bg-purple-500/5 text-purple-300",
  }[tone];
  return (
    <div
      className={`p-5 rounded-2xl border ${tones} bg-[#0B0618]`}
      data-testid={testid}
    >
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-5 h-5" />
        <p className="text-sm font-black uppercase tracking-wider text-white">
          {title}
        </p>
      </div>
      <p className="text-xs leading-relaxed text-purple-200/80">{body}</p>
    </div>
  );
};
