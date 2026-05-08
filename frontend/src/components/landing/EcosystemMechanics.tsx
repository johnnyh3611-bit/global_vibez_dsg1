/**
 * EcosystemMechanics — explainer block sourced verbatim from the
 * Founder's prose drop on Apr 30 2026:
 *
 *   01. Engagement Mining — your activity is your value
 *   02. The Loyalty Loop  — 72-hour Vibe Check + Express redeem
 *
 * Lives inside a `<LandingAccordion>` on the landing page so visitors
 * who are skimming see only the title; folks who are curious click
 * to read the mechanics. Keeps the landing scroll short.
 *
 * Pure presentational — no API calls, no state.
 */
import { motion } from "framer-motion";
import { Activity, Repeat, Coins } from "lucide-react";

const MECHANICS = [
  {
    id: "engagement-mining",
    num: "01",
    Icon: Activity,
    title: "Engagement Mining",
    body:
      'Your activity is your value. In Global Vibez, "Mining" isn\'t done by hardware; it\'s done by your interaction. Every hand of Spades, every 3D Glass Emoji sent, and every Bilingual chat generates Vibe Credits.',
    tone: "border-cyan-500/30 bg-cyan-950/15",
    accent: "text-cyan-300",
  },
  {
    id: "loyalty-loop",
    num: "02",
    Icon: Repeat,
    title: "The Loyalty Loop",
    body:
      'Credits are held in a 72-hour "Vibe Check" to ensure community safety. Once cleared, they can be redeemed as Loyalty Gifts. Express redemptions are available for Elite members with a 12% convenience fee.',
    tone: "border-fuchsia-500/30 bg-fuchsia-950/15",
    accent: "text-fuchsia-300",
  },
  {
    id: "currency-stack",
    num: "03",
    Icon: Coins,
    title: "The Currency Stack",
    body:
      "Three names, three distinct layers. ₵ Vibe Coins are the in-app credits you earn today (off-chain). $DSG is the public Solana SPL token — your ₵ balance converts 1:1 to $DSG at the Token Generation Event. Global Vibez DSG™ is the company and brand behind both. Earn ₵ now → hold $DSG on day 1.",
    tone: "border-emerald-500/30 bg-emerald-950/15",
    accent: "text-emerald-300",
  },
];

export default function EcosystemMechanics() {
  return (
    <div className="p-6 space-y-4" data-testid="ecosystem-mechanics-body">
      <p className="text-sm text-neutral-300 leading-relaxed">
        Three simple rules describe how the Vibez economy keeps moving.
        Activity earns. Time settles. Credits convert. No mining rigs, no hidden meters.
      </p>
      <div className="grid md:grid-cols-3 gap-4">
        {MECHANICS.map((m, i) => (
          <motion.div
            key={m.id}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.08 }}
            className={`rounded-2xl border p-5 ${m.tone}`}
            data-testid={`ecosystem-mechanic-${m.id}`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-mono opacity-60 text-white">
                {m.num}
              </span>
              <m.Icon className={`w-5 h-5 opacity-80 ${m.accent}`} />
            </div>
            <h3 className="text-lg font-black text-white mb-2">{m.title}</h3>
            <p className="text-sm text-neutral-300 leading-relaxed">
              {m.body}
            </p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
