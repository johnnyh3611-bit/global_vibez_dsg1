/**
 * /chair-vault — Founder Chairs Parking Vault.
 *
 * Replacement landing for the loyalty buy-in system. Per user's Master
 * Deployment Plan:
 *   • Phase pricing (Genius $10 → Phase V $30)
 *   • Invite-only purchase
 *   • Premium gate to qualify for distributions
 *   • 3D rotating chair carousel for owned chairs
 *   • Quarterly distribution (auto via scheduler)
 *
 * LEGAL FRAMING (UI side): we never display chairs as having a "current
 * value" or "valuation". Instead we show "Lifetime contribution: $X" as
 * a historical record, and we always state distributions are
 * discretionary loyalty bonuses.
 */
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Sparkles,
  Lock,
  Crown,
  Diamond,
  Mail,
  Trophy,
  AlertTriangle,
  Share2,
} from "lucide-react";
import { authFetch, getUserId } from "@/utils/secureAuth";
import PowerHourBadge from "@/components/chairs/PowerHourBadge";
import { toast } from "sonner";
import ChairCarousel from "@/components/chairs/ChairCarousel";
import PhaseProgress from "@/components/chairs/PhaseProgress";
import GeniusQRKit from "@/components/chairs/GeniusQRKit";
import EvolutionCountdown from "@/components/landing/EvolutionCountdown";
import ApexRaceLeaderboard from "@/components/chairs/ApexRaceLeaderboard";
import WelcomeLetterModal from "@/components/chairs/WelcomeLetterModal";

const API = process.env.REACT_APP_BACKEND_URL;

type Phase = {
  phase: string;
  price_usd: number | null;
  in_phase_capacity?: number;
  in_phase_sold?: number;
  remaining_in_phase?: number;
  tagline?: string;
  total_sold?: number;
};

type Me = {
  locked_chairs: number;
  lifetime_chairs: number;
  weighted_chairs?: number;
  average_earn_multiplier?: number;
  phase_breakdown?: { phase: string; chairs: number; weight: number }[];
  lifetime_contribution_usd: number;
  is_premium: boolean;
  rewards_active: boolean;
  perks_paused_reason: string | null;
  current_phase: Phase;
  loyalty_stakes: number;
  lifetime_stakes: number;
  chair_ids?: number[];
};

type Leader = {
  anon_id: string;
  successful_invites: number;
  rank_title: string;
};

const fmtUsd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

export default function ChairVault() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [qty, setQty] = useState(1);
  const [inviteCode, setInviteCode] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`${API}/api/chairs/phase`).then(r => r.ok && r.json()).then(setPhase);
    fetch(`${API}/api/chairs/leaders`)
      .then(r => r.ok && r.json())
      .then(d => setLeaders(d?.leaders || []));
    if (getUserId()) {
      authFetch(`${API}/api/chairs/me`).then(r => r.ok && r.json()).then(setMe);
    }
  }, []);

  // Pre-fill invite code from URL hash if user landed via /join/CODE → /chair-vault
  useEffect(() => {
    const stored = sessionStorage.getItem("pending_invite_code");
    if (stored) setInviteCode(stored);
  }, []);

  const refreshMe = async () => {
    if (!getUserId()) return;
    const r = await authFetch(`${API}/api/chairs/me`);
    if (r.ok) setMe(await r.json());
  };

  const handleBuy = async () => {
    if (!getUserId()) {
      toast.error("Sign in first to park a chair.");
      navigate("/login");
      return;
    }
    if (!phase || phase.price_usd === null) return;
    setBusy(true);
    try {
      const body: any = { quantity: qty };
      if (inviteCode.trim()) body.invite_code = inviteCode.trim().toUpperCase();
      const r = await authFetch(`${API}/api/chairs/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (r.ok) {
        const d = await r.json();
        if (d.checkout_url) {
          window.location.href = d.checkout_url;
          return;
        }
      }
      const err = await r.json().catch(() => ({}));
      // Fallback: preview env without Stripe → test-buy
      if (r.status === 503 && err.detail?.includes?.("Stripe not configured")) {
        const ok = window.confirm(
          `Stripe isn't wired up in this preview. Park ${qty} chair${qty > 1 ? "s" : ""} in TEST MODE for ${fmtUsd((phase.price_usd ?? 0) * qty)}? (No real charge)`
        );
        if (!ok) return;
        const ref = `preview_chair_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const tr = await authFetch(`${API}/api/chairs/test-buy`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            quantity: qty,
            invite_code: inviteCode.trim().toUpperCase() || undefined,
            payment_ref: ref,
          }),
        });
        if (!tr.ok) {
          const e = await tr.json().catch(() => ({}));
          toast.error(e.detail || "Could not park chairs.");
          return;
        }
        toast.success(`${qty} chair${qty > 1 ? "s" : ""} parked. Reward eligibility live.`);
        sessionStorage.removeItem("pending_invite_code");
        await refreshMe();
        const fresh = await fetch(`${API}/api/chairs/phase`);
        if (fresh.ok) setPhase(await fresh.json());
        return;
      }
      toast.error(err.detail || "Purchase failed.");
    } catch (e: any) {
      toast.error(e?.message || "Purchase failed.");
    } finally {
      setBusy(false);
    }
  };

  const handleGenerateInvite = async () => {
    const r = await authFetch(`${API}/api/invites/generate`, { method: "POST" });
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      toast.error(e.detail || "Could not generate invite.");
      return;
    }
    const d = await r.json();
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/join/${d.code}`);
      toast.success(`Invite ${d.code} copied to clipboard.`);
    } catch {
      toast.success(`Invite generated: ${d.code}`);
    }
  };

  const handleShareChair = async () => {
    const r = await authFetch(`${API}/api/chairs/share/payload`, { method: "POST" });
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      toast.error(e.detail || "Could not build share card.");
      return;
    }
    const payload = await r.json();
    // Try the native Web Share API first (mobile); fall back to clipboard.
    if (navigator.share) {
      try {
        await navigator.share({
          title: "My Global Vibez Founder Chair",
          text: payload.share_text_short,
          url: payload.join_url,
        });
        toast.success("Share sheet opened.");
        return;
      } catch {
        /* user dismissed share sheet — fall through to clipboard */
      }
    }
    try {
      await navigator.clipboard.writeText(payload.share_text_long);
      toast.success(`Share text + invite ${payload.invite_code} copied.`);
    } catch {
      toast.success(`Invite ${payload.invite_code} ready — see browser console.`);
      // eslint-disable-next-line no-console
      console.log("[share-my-chair]", payload);
    }
  };

  if (!phase) {
    return (
      <div className="min-h-screen bg-[#050507] flex items-center justify-center text-cyan-300">
        Loading the vault…
      </div>
    );
  }

  const lineTotal = (phase.price_usd ?? 0) * qty;
  const canBuy = phase.price_usd !== null && phase.remaining_in_phase! > 0;

  return (
    <div className="min-h-screen bg-[#050507] text-cyan-100 relative overflow-hidden font-sans">
      <WelcomeLetterModal hasChairs={(me?.locked_chairs ?? 0) > 0} />
      <EvolutionCountdown />
      <div
        className="absolute inset-0 opacity-25 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(34,211,238,0.14) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.14) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
        }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-10%,rgba(244,63,94,0.10),transparent_60%)] pointer-events-none" />

      <main className="relative z-10 max-w-6xl mx-auto px-6 py-12">
        {/* Hero */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
          data-testid="chair-vault-hero"
        >
          <div className="inline-flex items-center gap-2 bg-cyan-500/10 border border-cyan-400/30 rounded-full px-3 py-1 text-[10px] uppercase tracking-widest text-cyan-300">
            <Crown className="w-3 h-3" /> Founder Chairs · Invite-only
          </div>
          <div className="mt-3 flex justify-center">
            <PowerHourBadge />
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black mt-4 leading-tight">
            Park a chair.{" "}
            <span className="bg-gradient-to-r from-amber-300 via-rose-400 to-fuchsia-400 bg-clip-text text-transparent">
              Show up at the table.
            </span>
          </h1>
          <p className="text-base sm:text-lg text-cyan-300/80 mt-4 max-w-3xl mx-auto">
            Buy in once. Park your loyalty seat. Stay Premium and active —
            we automatically pay out every quarter from the platform's
            community reward pool, weighted by chairs parked.
          </p>
        </motion.section>

        {/* My vault — only renders for chair holders */}
        {me && me.locked_chairs > 0 && (
          <section className="mt-10" data-testid="chair-vault-mine">
            <div className="rounded-2xl border border-cyan-400/30 bg-white/[0.03] backdrop-blur-3xl p-6 grid lg:grid-cols-2 gap-6">
              <ChairCarousel
                chairCount={me.locked_chairs}
                phaseLabel={me.current_phase.phase}
                chairIds={me.chair_ids || []}
              />
              <div>
                <p className="text-[10px] uppercase tracking-widest text-cyan-500">
                  Your parking suite
                </p>
                <p
                  className="text-5xl font-black text-white mt-1"
                  data-testid="chair-vault-count"
                >
                  {me.locked_chairs.toLocaleString()}
                  <span className="text-base font-normal text-cyan-400 ml-2">
                    chairs parked
                  </span>
                </p>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-cyan-500">
                      Lifetime contribution
                    </p>
                    <p className="text-2xl font-black text-amber-300">
                      {fmtUsd(me.lifetime_contribution_usd)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-cyan-500">
                      Loyalty stakes
                    </p>
                    <p className="text-2xl font-black text-fuchsia-300">
                      {me.loyalty_stakes.toLocaleString()}
                    </p>
                  </div>
                </div>

                {!me.is_premium ? (
                  <div
                    data-testid="chair-vault-paused"
                    className="mt-5 rounded-xl border border-rose-400/40 bg-rose-500/10 p-3 flex items-start gap-2"
                  >
                    <AlertTriangle className="w-4 h-4 text-rose-300 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-rose-300 font-bold">
                        Perks paused
                      </p>
                      <p className="text-[12px] text-rose-100/80 mt-0.5">
                        Activate Premium to qualify for the next quarterly
                        community reward. Your chairs stay parked safely either way.
                      </p>
                      <button
                        onClick={() => navigate("/subscriptions")}
                        className="mt-2 rounded-lg bg-rose-400 text-black px-3 py-1.5 text-[11px] font-black uppercase tracking-widest"
                      >
                        Activate Premium
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-5 rounded-xl border border-emerald-400/40 bg-emerald-500/10 p-3 flex items-center gap-2">
                    <Diamond className="w-4 h-4 text-emerald-300 shrink-0" />
                    <p className="text-[12px] text-emerald-200">
                      Rewards active · next quarterly auto-payout includes you.
                    </p>
                  </div>
                )}

                <button
                  onClick={handleGenerateInvite}
                  data-testid="chair-vault-generate-invite"
                  className="mt-4 w-full rounded-xl border border-amber-400/40 bg-amber-500/10 px-4 py-2 text-sm font-black uppercase tracking-widest text-amber-200 hover:bg-amber-500/20 transition flex items-center justify-center gap-2"
                >
                  <Mail className="w-4 h-4" /> Generate invite link
                </button>

                <button
                  onClick={handleShareChair}
                  data-testid="chair-vault-share-chair"
                  className="mt-2 w-full rounded-xl bg-gradient-to-r from-fuchsia-500 to-rose-500 px-4 py-2 text-sm font-black uppercase tracking-widest text-black hover:brightness-110 transition flex items-center justify-center gap-2"
                >
                  <Share2 className="w-4 h-4" /> Share my chair
                </button>
              </div>
            </div>

            {/* Genius QR kit unlocks once chairs are parked */}
            <div className="mt-6">
              <GeniusQRKit />
            </div>
          </section>
        )}

        {/* Phase + buy panel */}
        <section className="mt-10">
          <PhaseProgress phase={phase} />

          {/* Apex Race — only shows if /api/apex/race endpoint returns data */}
          <div className="mt-5">
            <ApexRaceLeaderboard limit={25} />
          </div>

          <div
            className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-3xl p-6"
            data-testid="chair-vault-buy-panel"
          >
            <p className="text-[10px] uppercase tracking-widest text-amber-300 font-bold">
              Park your chair
            </p>
            <div className="mt-3 grid sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] uppercase tracking-widest text-cyan-500">
                  Quantity
                </label>
                <input
                  type="number"
                  min={1}
                  max={Math.min(100, phase.remaining_in_phase ?? 1)}
                  value={qty}
                  onChange={e =>
                    setQty(Math.max(1, Math.min(100, parseInt(e.target.value || "1", 10))))
                  }
                  data-testid="chair-vault-qty"
                  className="mt-1 w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-base font-bold text-white"
                />
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-widest text-cyan-500">
                  Invite code {me?.locked_chairs ? "(optional)" : "(required)"}
                </label>
                <input
                  type="text"
                  value={inviteCode}
                  onChange={e => setInviteCode(e.target.value.toUpperCase())}
                  placeholder="VIBE-XXXXXX"
                  data-testid="chair-vault-invite"
                  className="mt-1 w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-base font-mono text-white tracking-widest"
                />
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-widest text-cyan-500">
                  Total
                </label>
                <p
                  className="mt-1 text-2xl font-black text-amber-300"
                  data-testid="chair-vault-total"
                >
                  {fmtUsd(lineTotal)}
                </p>
                <p className="text-[10px] text-cyan-500/70">
                  {qty} × ${phase.price_usd?.toFixed(2)} ({phase.phase})
                </p>
              </div>
            </div>

            <button
              onClick={handleBuy}
              disabled={!canBuy || busy}
              data-testid="chair-vault-buy"
              className="mt-5 w-full rounded-xl bg-gradient-to-r from-amber-400 via-rose-500 to-fuchsia-500 text-black px-4 py-3 text-sm font-black uppercase tracking-widest hover:brightness-110 active:scale-[0.99] transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {busy
                ? "Loading…"
                : !canBuy
                ? "Sold out"
                : `Park ${qty} chair${qty > 1 ? "s" : ""} · ${fmtUsd(lineTotal)}`}
            </button>

            <p className="mt-3 text-[11px] text-cyan-500/70 leading-relaxed">
              One-time payment, non-refundable, non-transferable. Quarterly
              distributions are <strong>discretionary loyalty bonuses</strong>{" "}
              — they require an active Premium subscription and may be paused
              or adjusted with notice. Founder Chairs are not securities,
              shares, or investment instruments. They are loyalty seats with
              utility perks (early-access, multipliers, gated chat).
            </p>
          </div>
        </section>

        {/* How it works */}
        <section className="mt-12">
          <h2 className="text-2xl font-black text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-300" /> How the parking works
          </h2>
          <div className="mt-4 grid sm:grid-cols-3 gap-3">
            {[
              {
                title: "Step 1 — Park your chair",
                body:
                  "Pay once at the current phase price. Genius ($10) → Genesis ($15) → Phase III ($20) → Phase IV ($25) → Phase V ($30). Locked in your Vault.",
                icon: Crown,
              },
              {
                title: "Step 2 — Stay Premium + active",
                body:
                  "Premium subscription is the activation switch. Without it, chairs hold but rewards pause until you re-activate.",
                icon: Lock,
              },
              {
                title: "Step 3 — Auto-paid quarterly",
                body:
                  "Jan / Apr / Jul / Oct — 70% of the platform community pool is split across active chair holders. Direct to ₵ wallet.",
                icon: Diamond,
              },
            ].map(s => {
              const Icon = s.icon;
              return (
                <div
                  key={s.title}
                  className="rounded-2xl bg-white/[0.03] border border-white/10 p-5 backdrop-blur-3xl"
                >
                  <Icon className="w-5 h-5 text-amber-300" />
                  <p className="mt-2 text-sm font-black text-white">{s.title}</p>
                  <p className="mt-1 text-[12px] text-cyan-300/80 leading-relaxed">
                    {s.body}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Community Leaders */}
        {leaders.length > 0 && (
          <section className="mt-12" data-testid="chair-vault-leaders">
            <h2 className="text-2xl font-black text-white flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-300" /> Community recruiters
            </h2>
            <p className="text-xs text-cyan-500/70 mt-1">
              Anonymized — top members who've brought new players to the table.
            </p>
            <div className="mt-4 rounded-2xl bg-white/[0.03] border border-white/10 p-4 backdrop-blur-3xl">
              <table className="w-full text-xs">
                <thead className="text-cyan-500 uppercase tracking-widest text-[10px]">
                  <tr>
                    <th className="text-left py-2 w-10">#</th>
                    <th className="text-left">Anon ID</th>
                    <th className="text-left">Rank</th>
                    <th className="text-right">Successful invites</th>
                  </tr>
                </thead>
                <tbody>
                  {leaders.map((l, i) => (
                    <tr key={l.anon_id} className="border-t border-cyan-500/10">
                      <td className="py-2 text-amber-300 font-mono">{i + 1}</td>
                      <td className="py-2 text-cyan-200 font-mono">{l.anon_id}</td>
                      <td className="py-2 text-fuchsia-300">{l.rank_title}</td>
                      <td className="py-2 text-right text-cyan-100 font-bold">
                        {l.successful_invites}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
