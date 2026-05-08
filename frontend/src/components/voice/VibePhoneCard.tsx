/**
 * <VibePhoneCard /> — shows the authenticated user their masked Vibe number
 * + premium-tier unlock state for the Phase 2 PSTN proxy.
 *
 * Drop on the wallet, profile, or settings page.
 */
import { useEffect, useState } from "react";
import { Phone, Check, Copy, Sparkles, ShieldCheck } from "lucide-react";
import { authFetch } from "@/utils/secureAuth";

const API = process.env.REACT_APP_BACKEND_URL;

type Me = {
  user_id: string;
  vibe_number: string;
  blocked_user_ids: string[];
  tier: string;
  has_pstn: boolean;
  source: "premium_tier" | "standalone_subscription" | null;
};

type Eligibility = {
  has_pstn: boolean;
  tier: string;
  standalone_price_usd: number;
  twilio_configured: boolean;
  ready: boolean;
  phase_2_status: string;
};

export default function VibePhoneCard() {
  const [me, setMe] = useState<Me | null>(null);
  const [elig, setElig] = useState<Eligibility | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const a = await authFetch(`${API}/api/vibe-phone/provision`, {
          method: "POST",
        });
        if (!a.ok) return;
        const meData = await a.json();
        if (cancelled) return;
        setMe(meData);
        const b = await authFetch(`${API}/api/vibe-phone/pstn/eligibility`);
        if (b.ok) {
          const e = await b.json();
          if (!cancelled) setElig(e);
        }
      } catch {
        /* anon */
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!me) return null;

  const copyNumber = async () => {
    try {
      await navigator.clipboard.writeText(me.vibe_number);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked */
    }
  };

  return (
    <div
      className="max-w-md w-full bg-gradient-to-br from-cyan-900/30 to-purple-900/30 border border-cyan-400/40 rounded-3xl p-5 backdrop-blur-md shadow-[0_0_30px_rgba(34,211,238,0.18)] font-mono"
      data-testid="vibe-phone-card"
    >
      <div className="flex items-center gap-2">
        <div className="w-9 h-9 rounded-2xl bg-cyan-500/15 border border-cyan-400/40 flex items-center justify-center">
          <Phone className="w-5 h-5 text-cyan-300" />
        </div>
        <div>
          <h3 className="text-sm font-bold tracking-[0.3em] uppercase text-cyan-300">
            Your Vibe Number
          </h3>
          <p className="text-[10px] uppercase tracking-widest text-cyan-600">
            Privacy-masked caller ID
          </p>
        </div>
        {me.has_pstn ? (
          <span className="ml-auto text-[10px] uppercase tracking-widest text-amber-300 bg-amber-500/10 border border-amber-400/40 rounded-full px-2 py-0.5 flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            {me.source === "premium_tier" ? "Premium" : "PSTN"}
          </span>
        ) : null}
      </div>

      {/* Number row */}
      <div className="mt-4 flex items-center gap-2 bg-black/50 border border-cyan-500/30 rounded-lg px-3 py-3">
        <span
          className="flex-1 text-2xl font-black text-white tracking-wide"
          data-testid="vibe-phone-card-number"
        >
          {me.vibe_number}
        </span>
        <button
          onClick={copyNumber}
          className="text-cyan-300 hover:text-cyan-100"
          data-testid="vibe-phone-card-copy"
          aria-label="Copy number"
        >
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>

      <p className="mt-2 text-[10px] text-cyan-500/80 uppercase tracking-widest">
        Other Vibe users see this number when you call them — your real cell
        is never exposed.
      </p>

      {/* PSTN unlock */}
      <div className="mt-5 pt-4 border-t border-cyan-500/20">
        <div className="flex items-start gap-2">
          <ShieldCheck className="w-4 h-4 text-cyan-300 mt-0.5" />
          <div className="flex-1">
            <p className="text-xs font-bold text-cyan-200">
              Real-phone PSTN proxy
            </p>
            <p className="text-[10px] text-cyan-500/80 mt-1 leading-relaxed">
              {me.has_pstn ? (
                elig?.twilio_configured ? (
                  "You're eligible — your real-phone number will be activated automatically."
                ) : (
                  "You're eligible. PSTN proxy will activate the moment the platform finishes its carrier registration."
                )
              ) : (
                <>
                  Upgrade to Diamond / Gold tier — or add the
                  {" "}
                  <span className="text-amber-300">
                    ${elig?.standalone_price_usd?.toFixed(2) || "4.99"}/mo
                  </span>
                  {" "}
                  PSTN add-on — to receive a real, dialable phone number that
                  rings your cell while masking your real digits.
                </>
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
