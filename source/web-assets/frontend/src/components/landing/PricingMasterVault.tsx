/**
 * PricingMasterVault — landing-page presentation of the founder-locked
 * 6-pack pricing tier from the Pricing Master Vault v1.0 spec.
 *
 *   $1 USD  = 2,500 ₵   ·   4:1 DSG bridge   ·   13.5% Sovereign Tax
 *
 * Pure presentational. Data mirrors backend/services/pricing_master_vault.py
 * — keep the two in sync.
 *
 * Lives inside the landing page's accordion stack so the scroll stays short
 * for skimmers, but anyone serious about $DSG purchases can drill in.
 */
import { motion } from "framer-motion";
import { Coins, Sparkles, Zap, Crown, Lock, Shield } from "lucide-react";

interface PackRow {
  id: string;
  price: string;
  name: string;
  credits: string;
  dsg: string;
  perk: string;
  tier: "Explorer" | "Ambassador" | "Chair Holder";
  highlight?: boolean;
  Icon: React.ComponentType<{ className?: string }>;
}

const PACKS: PackRow[] = [
  { id: "ignition",     price: "$1",   name: "The Ignition",      credits: "2,500",   dsg: "625",     perk: "Entry Access",                                  tier: "Explorer",     Icon: Zap },
  { id: "frequency",    price: "$5",   name: "The Frequency",     credits: "12,500",  dsg: "3,125",   perk: "+1 Profile Boost",                              tier: "Explorer",     Icon: Sparkles },
  { id: "momentum",     price: "$10",  name: "The Momentum",      credits: "25,000",  dsg: "6,250",   perk: "24hr Mining Pulse",                             tier: "Ambassador",   Icon: Coins },
  { id: "architect",    price: "$20",  name: "The Architect",     credits: "50,000",  dsg: "12,500",  perk: "Referral Node Open · 5% Network Mining Override", tier: "Ambassador", highlight: true, Icon: Shield },
  { id: "dynasty",      price: "$50",  name: "The Dynasty",       credits: "125,000", dsg: "31,250",  perk: "Elite Room Access",                             tier: "Ambassador",   Icon: Crown },
  { id: "legacy_vault", price: "$100", name: "The Legacy Vault",  credits: "300,000*", dsg: "75,000", perk: "Permanent Elite Status (250k base + 50k bonus)", tier: "Chair Holder", highlight: true, Icon: Lock },
];

const TIER_BADGE: Record<PackRow["tier"], string> = {
  Explorer:      "bg-cyan-500/10 text-cyan-300 border-cyan-500/40",
  Ambassador:    "bg-fuchsia-500/10 text-fuchsia-300 border-fuchsia-500/40",
  "Chair Holder":"bg-emerald-500/10 text-emerald-300 border-emerald-500/40",
};

export default function PricingMasterVault() {
  return (
    <div className="p-6 space-y-6" data-testid="pricing-master-vault-body">
      {/* Header math line */}
      <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-purple-950/20 via-black to-cyan-950/10 p-5">
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-mono">
          <span className="text-neutral-400">
            <span className="text-white font-bold">$1 USD</span> = <span className="text-cyan-300 font-bold">2,500 ₵</span>
          </span>
          <span className="text-neutral-600">·</span>
          <span className="text-neutral-400">
            <span className="text-emerald-300 font-bold">4:1</span> DSG bridge
          </span>
          <span className="text-neutral-600">·</span>
          <span className="text-neutral-400">
            <span className="text-rose-300 font-bold">13.5%</span> Sovereign Tax
          </span>
          <span className="text-neutral-600">·</span>
          <span className="text-neutral-400">
            Supply: <span className="text-fuchsia-300 font-bold">3B $DSG</span>
          </span>
        </div>
      </div>

      {/* Pack grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="pricing-master-vault-grid">
        {PACKS.map((p, i) => (
          <motion.div
            key={p.id}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.06 }}
            data-testid={`pricing-pack-${p.id}`}
            className={
              "relative rounded-2xl border p-5 backdrop-blur-sm transition-colors " +
              (p.highlight
                ? "border-fuchsia-500/50 bg-gradient-to-br from-fuchsia-950/30 via-black to-purple-950/20 hover:border-fuchsia-400/70"
                : "border-white/10 bg-black/40 hover:border-white/30")
            }
          >
            {p.highlight && (
              <span className="absolute -top-2 right-4 text-[10px] font-mono uppercase tracking-widest bg-fuchsia-500 text-black px-2 py-0.5 rounded">
                Hot
              </span>
            )}
            <div className="flex items-center justify-between mb-3">
              <p.Icon className="w-5 h-5 text-white/70" />
              <span className={`text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded border ${TIER_BADGE[p.tier]}`}>
                {p.tier}
              </span>
            </div>
            <div className="flex items-baseline gap-1 mb-1">
              <span className="text-3xl font-black text-white">{p.price}</span>
              <span className="text-[10px] uppercase tracking-widest text-neutral-500">USD</span>
            </div>
            <h3 className="text-sm font-bold text-white/90 mb-3">{p.name}</h3>
            <div className="space-y-1 text-sm border-t border-white/5 pt-3">
              <div className="flex justify-between">
                <span className="text-neutral-500">Credits</span>
                <span className="text-cyan-300 font-mono font-bold">₵ {p.credits}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">DSG Bridge</span>
                <span className="text-emerald-300 font-mono font-bold">{p.dsg} $DSG</span>
              </div>
            </div>
            <p className="mt-3 text-xs text-neutral-400 italic leading-relaxed">{p.perk}</p>
          </motion.div>
        ))}
      </div>

      {/* Tier rules footer */}
      <div className="rounded-2xl border border-white/10 bg-black/40 p-5 space-y-3 text-xs text-neutral-400 leading-relaxed">
        <p className="text-white font-bold uppercase tracking-widest text-[10px] mb-2">Tier Distribution &amp; Regulation</p>
        <p>
          <span className="text-cyan-300 font-bold">Explorers</span> — restricted to Ignition &amp; Frequency packs. Hard cap of <span className="text-white font-mono">100,000 $DSG</span> lifetime.
        </p>
        <p>
          <span className="text-fuchsia-300 font-bold">Ambassadors</span> — purchasing The Architect activates the <span className="text-white">5% network mining override</span>.
        </p>
        <p>
          <span className="text-emerald-300 font-bold">Chair Holders</span> — only tier permitted to repeat-purchase The Legacy Vault, up to a <span className="text-white font-mono">5,000,000 $DSG</span> lifetime ceiling.
        </p>
        <p className="text-[10px] text-neutral-600 pt-2 border-t border-white/5 mt-3">
          *The Legacy Vault includes 50,000 bonus credits on top of the 250,000 base for high-volume investment.
          Every transaction and game-bet within the app is subject to the 13.5% Sovereign Tax, fueling the Treasury and Ambassador Dividends.
        </p>
      </div>
    </div>
  );
}
