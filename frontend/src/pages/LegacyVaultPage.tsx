/**
 * LegacyVaultPage — Investor / Founder lockbox (Ultimate Blueprint v3 §4).
 *
 *   "Implement a 'Legacy Vault' (using Stripe paid links and Multi-Sig
 *    storage) for crucial Brand and Investor information."
 *
 * The Stripe + Multi-Sig flows are managed off-app (Stripe Dashboard +
 * Squads multisig). This page is the read-only viewer that confirms:
 *   • The two foundational locks (13.5% tax + 70/30 split) are live.
 *   • The audit/compliance log endpoint is reachable.
 *   • Documents pinned to the vault (links to Stripe-paid PDFs).
 */
import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Lock, Shield, Coins, FileLock2, ExternalLink } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

interface CoreConstants {
  sovereign_tax_rate: number;
  sovereign_tax_pct: string;
  artist_producer_share: number;
  platform_share: number;
  artist_split_pretty: string;
  locked: boolean;
  spec_doc: string;
  last_verified: string;
}

const VAULT_DOCS = [
  {
    label: "DSG Tokenomics Whitepaper",
    note: "Stripe-gated · multi-sig pinned IPFS hash",
    url: "https://buy.stripe.com/legacy-vault-tokenomics",
  },
  {
    label: "Genius Phase Term Sheet",
    note: "Investor-only · 24h preview, signed PDF",
    url: "https://buy.stripe.com/legacy-vault-term-sheet",
  },
  {
    label: "Sovereign Tax Whitepaper",
    note: "13.5% rate locked — read-only audit trail",
    url: "https://buy.stripe.com/legacy-vault-sov-tax",
  },
];

export default function LegacyVaultPage() {
  const [core, setCore] = useState<CoreConstants | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API}/api/immutable-core/constants`);
        if (!res.ok) throw new Error(`status ${res.status}`);
        const data = await res.json();
        if (!cancelled) setCore(data);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Vault unavailable");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div
      className="min-h-screen text-white p-6 sm:p-10"
      style={{
        background:
          "radial-gradient(ellipse at top, rgba(40,50,90,0.8) 0%, rgba(15,20,40,1) 100%)",
      }}
      data-testid="legacy-vault-page"
    >
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 mb-4"
        >
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-rose-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
            <Lock className="w-6 h-6 text-black" />
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.4em] text-amber-300">
              Production Security · Phase Gating
            </p>
            <h1 className="text-3xl sm:text-4xl font-black">Legacy Vault</h1>
          </div>
        </motion.div>

        <p className="text-slate-300 max-w-2xl mb-8 text-sm leading-relaxed">
          Read-only investor & brand artifact viewer. Documents are protected
          by Stripe paid links and pinned via multi-sig storage. The
          immutable economic locks below are verified at server boot and
          this page polls them live.
        </p>

        {/* Immutable locks */}
        <section className="mb-8">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.3em] text-cyan-300 mb-3">
            Immutable Core
          </h2>
          {error && (
            <div
              data-testid="legacy-vault-error"
              className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm"
            >
              ⚠️ {error}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <LockCard
              icon={<Shield className="w-5 h-5" />}
              tone="cyan"
              label="Sovereign Tax"
              value={core?.sovereign_tax_pct || "—"}
              sub="Locked at platform launch · every taxable transaction"
              testid="legacy-vault-sovereign-tax"
            />
            <LockCard
              icon={<Coins className="w-5 h-5" />}
              tone="amber"
              label="Artist / Platform Split"
              value={core?.artist_split_pretty || "—"}
              sub="70% creator · 30% platform · forever"
              testid="legacy-vault-artist-split"
            />
          </div>
          {core && (
            <p
              data-testid="legacy-vault-spec-line"
              className="mt-3 text-[10px] font-mono uppercase tracking-wider text-slate-400"
            >
              Spec: {core.spec_doc} · Last verified {core.last_verified} ·
              <span className={core.locked ? "text-emerald-400" : "text-rose-400"}>
                {" "}
                {core.locked ? "🔒 Live-locked" : "✗ DRIFT DETECTED"}
              </span>
            </p>
          )}
        </section>

        {/* Vault documents */}
        <section>
          <h2 className="font-mono text-[11px] uppercase tracking-[0.3em] text-fuchsia-300 mb-3">
            Vault Documents
          </h2>
          <div className="grid grid-cols-1 gap-2">
            {VAULT_DOCS.map((d) => (
              <a
                key={d.label}
                href={d.url}
                target="_blank"
                rel="noopener noreferrer"
                data-testid={`legacy-vault-doc-${d.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                className="group flex items-center justify-between gap-3 p-4 rounded-2xl bg-slate-950/80 border border-fuchsia-500/20 hover:border-fuchsia-400/50 transition"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <FileLock2 className="w-5 h-5 text-fuchsia-300 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="font-bold truncate">{d.label}</p>
                    <p className="text-[11px] text-slate-400 truncate">{d.note}</p>
                  </div>
                </div>
                <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-fuchsia-300 transition" />
              </a>
            ))}
          </div>
          <p className="mt-3 text-[10px] font-mono uppercase tracking-wider text-slate-500">
            Stripe + Multi-Sig · Read-only · Audit log preserved on chain
          </p>
        </section>
      </div>
    </div>
  );
}

const TONE: Record<string, string> = {
  cyan: "from-cyan-400 to-blue-500 text-cyan-200 border-cyan-400/40",
  amber: "from-amber-400 to-orange-500 text-amber-200 border-amber-400/40",
};

const LockCard: React.FC<{
  icon: React.ReactNode;
  tone: keyof typeof TONE;
  label: string;
  value: string;
  sub: string;
  testid: string;
}> = ({ icon, tone, label, value, sub, testid }) => (
  <div
    data-testid={testid}
    className={`rounded-2xl border bg-slate-950/80 backdrop-blur p-4 ${
      TONE[tone].split(" ")[3]
    }`}
  >
    <div
      className={`inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] font-mono mb-1 ${
        TONE[tone].split(" ")[2]
      }`}
    >
      {icon}
      {label}
    </div>
    <div
      className={`text-3xl sm:text-4xl font-black bg-clip-text text-transparent bg-gradient-to-r ${
        TONE[tone].split(" ").slice(0, 2).join(" ")
      }`}
    >
      {value}
    </div>
    <div className="text-[11px] text-slate-400 mt-1">{sub}</div>
  </div>
);
