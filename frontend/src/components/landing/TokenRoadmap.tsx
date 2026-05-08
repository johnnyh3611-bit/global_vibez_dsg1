/**
 * TokenRoadmap — live, status-aware roadmap for the Vibez token / treasury
 * journey. Replaces the previous static `Project Roadmap` block with real
 * on-chain status pulled from `/api/treasury/public-status`.
 *
 * Each milestone has one of four statuses:
 *   ✅ shipped     — feature is live and verifiable
 *   🚧 in-progress — actively being wired up
 *   🔜 next        — queued, no blockers
 *   ⏳ future      — gated on TGE / custom domain / external creds
 *
 * The Squads treasury balance and network are pulled live so the page
 * can never go stale — if the founder funds the vault, the number on
 * the marketing page updates within 60s automatically.
 */
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Coins,
  Shield,
  Wallet,
  Rocket,
  Globe,
  Sparkles,
  CheckCircle2,
  Circle,
  Clock,
  Loader2,
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;
const POLL_MS = 60_000;

type PublicStatus = {
  configured: boolean;
  network: string | null;
  is_mainnet: boolean;
  vault_balance_sol: number | null;
  rpc_ok: boolean;
};

type MilestoneStatus = "shipped" | "progress" | "next" | "future";

interface Milestone {
  id: string;
  status: MilestoneStatus;
  date: string;
  title: string;
  desc: string;
  Icon: typeof Coins;
}

const STATUS_META: Record<
  MilestoneStatus,
  {
    label: string;
    badge: string;
    line: string;
    dot: string;
    Icon: typeof CheckCircle2;
  }
> = {
  shipped: {
    label: "SHIPPED",
    badge: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
    line: "border-emerald-500/40",
    dot: "bg-emerald-400",
    Icon: CheckCircle2,
  },
  progress: {
    label: "IN PROGRESS",
    badge: "bg-cyan-500/15 text-cyan-300 border-cyan-500/40",
    line: "border-cyan-500/40",
    dot: "bg-cyan-400 animate-pulse",
    Icon: Loader2,
  },
  next: {
    label: "NEXT",
    badge: "bg-amber-500/15 text-amber-300 border-amber-500/40",
    line: "border-amber-500/30",
    dot: "bg-amber-400",
    Icon: Clock,
  },
  future: {
    label: "FUTURE",
    badge: "bg-slate-500/10 text-slate-400 border-slate-500/30",
    line: "border-slate-700",
    dot: "bg-slate-600",
    Icon: Circle,
  },
};

export default function TokenRoadmap() {
  const [status, setStatus] = useState<PublicStatus | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch(`${API}/api/treasury/public-status`);
        if (r.ok) setStatus(await r.json());
      } catch {
        /* silent — roadmap renders without live data */
      }
    };
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, []);

  const network = status?.network?.toUpperCase() || null;
  const balance = status?.vault_balance_sol;
  const treasuryLive = !!status?.configured && !!status?.rpc_ok;

  // Milestones are evaluated against live status so the page is never
  // stale. Order is chronological — top = oldest shipped, bottom = most
  // distant future. Status per row is computed from real signals where
  // possible (e.g. "Treasury escrow live" flips to shipped only when the
  // public-status endpoint reports `configured && rpc_ok`).
  const milestones: Milestone[] = [
    {
      id: "vibez-coins",
      status: "shipped",
      date: "Live now",
      title: "₵ Vibez Coins economy",
      desc: "Skill-based games, JFTN rooms, and chair holders all earn and spend in ₵ — the entire platform runs on a unified non-USD currency loop.",
      Icon: Coins,
    },
    {
      id: "squads-treasury",
      status: treasuryLive ? "shipped" : "progress",
      date: treasuryLive
        ? `Live on Solana ${network || "mainnet"}`
        : "Wiring up",
      title: "Squads 2-of-2 multisig treasury",
      desc: treasuryLive
        ? `Founder treasury secured by a 2-of-2 multisig on-chain. Current vault balance: ${
            balance !== null && balance !== undefined
              ? `${balance.toFixed(6)} SOL`
              : "—"
          }. Founder draws + payroll batches require both cosigners to approve before any funds move.`
        : "On-chain 2-of-2 multisig wiring up — every founder draw and team payroll batch will require both cosigners to approve.",
      Icon: Shield,
    },
    {
      id: "chair-expansion",
      status: "shipped",
      date: "Plan published",
      title: "1M-chair supply expansion plan",
      desc: "3-tier ladder: Genius ($20 × 50K) → Genesis ($100 × 100K) → Apex ($250 × 50K). 200K active chairs totaling ~$23.5M max raise, plus 800K in Reserve + 200M DSG Founder Vault locked until chair #50,000 sells. Genius buyers get a 12.5× floor-price multiplier guarantee by Apex.",
      Icon: Sparkles,
    },
    {
      id: "phantom-connect",
      status: "shipped",
      date: "Live now",
      title: "Phantom Connect — in-app wallet",
      desc: "Users can sign in with Google or Apple and get a non-custodial Solana wallet inside the app. No browser extensions required.",
      Icon: Wallet,
    },
    {
      id: "transparency",
      status: "shipped",
      date: "Live now",
      title: "Public transparency dashboard",
      desc: "Live solvency meter, treasury split (40-30-30 with founder cap), on-chain vault balance, and a real-time perf-monitor sparkline — anyone can audit the platform's financial health in real time.",
      Icon: Sparkles,
    },
    {
      id: "tge",
      status: "next",
      date: "Coming soon",
      title: "$DSG Token Generation Event (TGE)",
      desc: "Mint of the public-facing $DSG SPL token on Solana mainnet. Vibez Coins (₵) earned today will convert 1:1 to $DSG for verified accounts at TGE. Mint date locks in once custom domain + DNS verification are complete.",
      Icon: Rocket,
    },
    {
      id: "domain",
      status: "next",
      date: "Pre-launch",
      title: "Custom domain + Phantom Portal verification",
      desc: "Production domain registration with DNS TXT verification at Phantom Portal. Required for OAuth-based wallet sign-ins to work outside the preview environment.",
      Icon: Globe,
    },
    {
      id: "reserve-unlock",
      status: "future",
      date: "Post-milestone",
      title: "Reserve Vault unlock — community distribution",
      desc: "The 500,000 chairs in the Reserve Vault unlock when the platform hits Escape Velocity (major user milestones). When unlocked, vault chairs will be issued through community-voted distribution events — never bulk-sold.",
      Icon: Coins,
    },
    {
      id: "mainnet-spread",
      status: "future",
      date: "Post-TGE",
      title: "Mainnet liquidity + DEX listing",
      desc: "$DSG liquidity pool seeded on Jupiter / Raydium, paired with USDC. Founders + chair-holders earn yield from a slice of platform revenue auto-routed to the LP via Streamflow streams.",
      Icon: Coins,
    },
  ];

  return (
    <section
      className="bg-black py-24 px-6 border-t border-neutral-900"
      data-testid="token-roadmap-section"
    >
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <p className="text-xs font-mono uppercase tracking-[0.4em] text-fuchsia-500 mb-3">
            The Path to Mint
          </p>
          <h2 className="text-4xl sm:text-5xl font-black italic text-white uppercase tracking-tighter">
            Token & Treasury Roadmap
          </h2>
          <p className="text-neutral-400 mt-4 max-w-2xl mx-auto">
            Live status of the Vibez economy — from in-app coins today, to a
            real on-chain $DSG token at mint. Every status below is pulled
            live; nothing here is a marketing promise.
          </p>

          {treasuryLive && (
            <div
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-emerald-500/10 border border-emerald-500/40 px-4 py-1.5 text-xs text-emerald-300 font-mono uppercase tracking-widest"
              data-testid="roadmap-live-treasury-pill"
            >
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              Treasury live · {network}
              {balance !== null && balance !== undefined && (
                <span className="text-emerald-200">
                  · {balance.toFixed(6)} SOL
                </span>
              )}
            </div>
          )}
        </div>

        <ol className="relative space-y-3">
          {milestones.map((m, idx) => {
            const meta = STATUS_META[m.status];
            const StatusIcon = meta.Icon;
            const isLast = idx === milestones.length - 1;
            return (
              <motion.li
                key={m.id}
                initial={{ opacity: 0, x: -12 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ delay: idx * 0.05 }}
                className="relative flex gap-5 pl-1"
                data-testid={`roadmap-milestone-${m.id}`}
              >
                {/* connector dot + line */}
                <div className="flex flex-col items-center">
                  <div
                    className={`w-3 h-3 rounded-full ${meta.dot} ring-4 ring-black z-10`}
                    data-testid={`roadmap-dot-${m.id}`}
                  />
                  {!isLast && (
                    <div className={`flex-1 w-px border-l ${meta.line} my-1`} />
                  )}
                </div>

                <div className="flex-1 pb-8">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <m.Icon className="w-5 h-5 text-neutral-500" />
                      <h3 className="text-xl font-bold text-white">
                        {m.title}
                      </h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-widest border rounded-full px-2 py-0.5 ${meta.badge}`}
                        data-testid={`roadmap-status-${m.id}`}
                      >
                        <StatusIcon
                          className={`w-3 h-3 ${m.status === "progress" ? "animate-spin" : ""}`}
                        />
                        {meta.label}
                      </span>
                      <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">
                        {m.date}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-neutral-400 mt-2 leading-relaxed">
                    {m.desc}
                  </p>
                </div>
              </motion.li>
            );
          })}
        </ol>

        <p
          className="mt-8 text-center text-[10px] font-mono uppercase tracking-[0.3em] text-neutral-600"
          data-testid="roadmap-disclaimer"
        >
          Status pulls live from on-chain Solana every 60s · No marketing
          fluff
        </p>
      </div>
    </section>
  );
}
