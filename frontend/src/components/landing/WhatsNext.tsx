/**
 * WhatsNext — compact "what's coming" 3-stage timeline that pairs
 * with the EcosystemMechanics accordion. Sourced verbatim from the
 * Founder's prose drop on Apr 30 2026:
 *
 *   • Live Now       → Squads Multi-Sig Treasury (mainnet, 2-of-2)
 *   • Coming Soon    → $DSG Token Generation Event (1:1 ₵→$DSG)
 *   • Post-Milestone → Escape Velocity (reserve vault unlocks, +1× for everyone)
 *
 * Lives inside a `<LandingAccordion>` so the landing-page scroll
 * stays short — interested visitors click to read.
 */
import { motion } from "framer-motion";
import { CheckCircle2, Clock, Lock } from "lucide-react";

const STAGES = [
  {
    id: "live-now",
    badge: "Live Now",
    Icon: CheckCircle2,
    title: "Squads Multi-Sig Treasury",
    body:
      "Founder treasury secured by an on-chain 2-of-2 multisig on Solana mainnet. Every founder draw + payroll batch requires both cosigners.",
    tone: "border-emerald-500/40 bg-emerald-950/20",
    accent: "text-emerald-300",
  },
  {
    id: "coming-soon",
    badge: "Coming Soon",
    Icon: Clock,
    title: "$DSG Token Generation Event",
    body:
      "Mint of the public $DSG SPL token. Vibez Coins (₵) earned today convert 1:1 to $DSG for verified accounts at TGE.",
    tone: "border-cyan-500/40 bg-cyan-950/20",
    accent: "text-cyan-300",
  },
  {
    id: "post-milestone",
    badge: "Post-Milestone",
    Icon: Lock,
    title: "Escape Velocity",
    body:
      "When the platform hits its user milestone the Founder pulls the switch: every existing chair gets +1× on its earn-rate multiplier, the chair-holder profit share auto-bumps from 14% to 30%, AND 500,000 reserve-vault chairs unlock. Genius 3× → 4×, Genesis 2× → 3×. Distributed via community-voted events, never bulk-sold.",
    tone: "border-amber-500/40 bg-amber-950/20",
    accent: "text-amber-300",
  },
];

export default function WhatsNext() {
  return (
    <div className="p-6" data-testid="whats-next-body">
      <p className="text-sm text-neutral-300 leading-relaxed mb-5">
        Where the platform is, where it's going, and what unlocks when.
      </p>
      <div className="grid md:grid-cols-3 gap-4">
        {STAGES.map((s, i) => (
          <motion.div
            key={s.id}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.08 }}
            className={`rounded-2xl border p-5 ${s.tone}`}
            data-testid={`whats-next-${s.id}`}
          >
            <div className="flex items-center justify-between mb-3">
              <span
                className={`text-[10px] font-mono uppercase tracking-widest ${s.accent}`}
              >
                {s.badge}
              </span>
              <s.Icon className={`w-5 h-5 ${s.accent}`} />
            </div>
            <h3 className="text-base font-black text-white mb-2 leading-tight">
              {s.title}
            </h3>
            <p className="text-xs text-neutral-300 leading-relaxed">{s.body}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
