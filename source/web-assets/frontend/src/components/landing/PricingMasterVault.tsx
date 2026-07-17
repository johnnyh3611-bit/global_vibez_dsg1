/**
 * PricingMasterVault — live Vibez Coin top-up packs.
 *
 * Source of truth: backend/routes/coin_topup.py (COIN_PACKS) +
 * app_config.COINS_PER_USD = 1,000.
 *
 * Soft-launch: show what users can actually buy via Stripe top-up,
 * not the retired Pricing Master Vault v1.0 ($1 = 2,500 ₵ / six packs).
 */
import { motion } from "framer-motion";
import { Coins, Sparkles, Zap, Crown } from "lucide-react";

interface PackRow {
  id: string;
  price: string;
  name: string;
  credits: string;
  perk: string;
  highlight?: boolean;
  Icon: React.ComponentType<{ className?: string }>;
}

/** Mirrors COIN_PACKS in coin_topup.py */
const PACKS: PackRow[] = [
  { id: "starter", price: "$5",  name: "Starter", credits: "5,000",  perk: "Exact rate · 1,000 ₵ / $1", Icon: Zap },
  { id: "popular", price: "$9",  name: "Popular", credits: "10,000", perk: "~11% bonus coins", highlight: true, Icon: Sparkles },
  { id: "pro",     price: "$20", name: "Pro",     credits: "25,000", perk: "25% bonus coins", Icon: Coins },
  { id: "vip",     price: "$35", name: "VIP",     credits: "50,000", perk: "~43% bonus coins", Icon: Crown },
];

export default function PricingMasterVault() {
  return (
    <div className="p-6 space-y-6" data-testid="pricing-master-vault-body">
      <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-purple-950/20 via-black to-cyan-950/10 p-5">
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-mono">
          <span className="text-neutral-400">
            <span className="text-white font-bold">$1 USD</span> ={" "}
            <span className="text-cyan-300 font-bold">1,000 ₵</span>
          </span>
          <span className="text-neutral-600">·</span>
          <span className="text-neutral-400">
            Currency: <span className="text-fuchsia-300 font-bold">Vibez Coins (₵)</span>
          </span>
          <span className="text-neutral-600">·</span>
          <span className="text-neutral-400">
            TGE: <span className="text-emerald-300 font-bold">1:1</span> ₵→$DSG planned
          </span>
        </div>
        <p className="text-neutral-500 text-xs mt-3">
          Buy in Wallet → Buy Coins. Card checkout requires Stripe to be configured.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4" data-testid="pricing-master-vault-grid">
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
                : "border-white/10 bg-black/40 hover:border-white/25")
            }
          >
            {p.highlight && (
              <span className="absolute -top-2 right-3 text-[10px] uppercase tracking-widest bg-fuchsia-500 text-white px-2 py-0.5 rounded-full font-bold">
                Most popular
              </span>
            )}
            <p.Icon className="w-6 h-6 text-cyan-300 mb-3" />
            <p className="text-white font-bold text-lg">{p.name}</p>
            <p className="text-2xl font-black text-cyan-300 mt-1">{p.price}</p>
            <p className="text-cyan-100/80 font-mono text-sm mt-2">₵ {p.credits}</p>
            <p className="text-neutral-400 text-xs mt-3">{p.perk}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
