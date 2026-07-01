/**
 * DashboardSpinBadge — Header pill that surfaces the daily prize wheel.
 *
 * Polls /api/prize-wheel/status quietly on mount and shows one of:
 *   • "Spin ready" pill (eligible) → /daily-spin
 *   • "Eligibility blocked" muted pill with reason tooltip
 *   • Hidden completely (cooldown active so we don't nag)
 *
 * Plus: when the logged-in user is an admin, surface a tiny
 * "Founder Preview ▾" menu that lets them mint test credits to
 * walk into any premium/underground room without grinding ₵.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Coins, AlertCircle, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

type WheelStatus = {
  ok?: boolean;
  eligible?: boolean;
  cooldown_active?: boolean;
  sybil_blocked_reason?: string | null;
};

const sybilCopy: Record<string, string> = {
  phone_not_verified: 'Verify your phone to unlock spins',
  profile_incomplete: 'Complete your profile to unlock spins',
  no_game_hand_in_24h: 'Play a hand (24h) to unlock spins',
  founder_chair_required: 'Top Tier requires a Founder Chair',
};

export default function DashboardSpinBadge({ isAdmin = false }: { isAdmin?: boolean }) {
  const navigate = useNavigate();
  const [status, setStatus] = useState<WheelStatus | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewBusy, setPreviewBusy] = useState(false);
  // Auto-detect admin via probe call so we don't depend on /auth/me
  // returning is_admin (it doesn't, by design — frontend never needs
  // the flag for any other surface).
  const [probedAdmin, setProbedAdmin] = useState<boolean>(isAdmin);

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (!token) return;
    fetch(`${API}/api/prize-wheel/status`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setStatus(d))
      .catch(() => undefined);

    // Probe founder-preview balance endpoint — 200 = admin, 403 = not.
    if (!isAdmin) {
      fetch(`${API}/api/admin/founder-preview/balance`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => setProbedAdmin(r.ok))
        .catch(() => undefined);
    }
  }, [isAdmin]);

  const handleFounderTopUp = async (amount: number, label: string) => {
    setPreviewBusy(true);
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API}/api/admin/founder-preview/top-up`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount_coins: amount,
          note: `Founder preview · ${label}`,
        }),
      });
      const data = await res.json();
      if (res.ok && data?.ok) {
        toast.success(`+${amount.toLocaleString()} ₵ credited`, {
          description: `Balance: ${(data.balance_after ?? 0).toLocaleString()} ₵`,
        });
        setPreviewOpen(false);
        // Soft refresh so the CreditBalance pill updates without route change.
        window.dispatchEvent(new Event('credits-changed'));
      } else if (res.status === 403) {
        toast.error('Founder-only — your account is not flagged as admin.');
      } else {
        toast.error(data?.detail || 'Top-up failed.');
      }
    } catch {
      toast.error('Top-up failed — network error.');
    } finally {
      setPreviewBusy(false);
    }
  };

  // Spin Ready / Blocked / Hidden state machine
  let spinChip: React.ReactNode = null;
  if (status?.eligible) {
    spinChip = (
      <button
        type="button"
        onClick={() => navigate('/daily-spin')}
        data-testid="dashboard-spin-ready-badge"
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-fuchsia-500 to-purple-600 text-white text-[10px] md:text-xs font-black uppercase tracking-widest shadow-lg hover:scale-105 transition-transform animate-pulse"
      >
        <Sparkles className="w-3.5 h-3.5" />
        Spin ready
      </button>
    );
  } else if (status && !status.cooldown_active && status.sybil_blocked_reason) {
    spinChip = (
      <button
        type="button"
        onClick={() => navigate('/daily-spin')}
        data-testid="dashboard-spin-blocked-badge"
        title={sybilCopy[status.sybil_blocked_reason || ''] || 'Spin locked'}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/15 text-white/60 text-[10px] md:text-xs font-bold uppercase tracking-widest hover:bg-white/10"
      >
        <AlertCircle className="w-3.5 h-3.5" />
        Spin locked
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2" data-testid="dashboard-spin-badge-root">
      {spinChip}

      {isAdmin || probedAdmin ? (
        <div className="relative">
          <button
            type="button"
            onClick={() => setPreviewOpen((v) => !v)}
            data-testid="dashboard-founder-preview-trigger"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-400/10 border border-amber-400/40 text-amber-200 text-[10px] md:text-xs font-bold uppercase tracking-widest hover:bg-amber-400/20"
            title="Founder-only: credit your wallet so you can walk into any premium/underground room"
          >
            <Coins className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Founder Preview</span>
            <span className="md:hidden">Preview</span>
            <ChevronDown className={`w-3 h-3 transition-transform ${previewOpen ? 'rotate-180' : ''}`} />
          </button>

          {previewOpen && (
            <div
              className="absolute right-0 mt-2 w-64 rounded-2xl bg-black/95 border border-amber-400/40 shadow-2xl backdrop-blur-xl p-3 z-[100] text-white"
              data-testid="dashboard-founder-preview-menu"
            >
              <p className="text-[10px] uppercase tracking-widest text-amber-300 mb-2 flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                Founder preview top-up
              </p>
              <p className="text-[11px] text-white/60 leading-snug mb-3">
                Mint test credits to inspect any room. Logged with{' '}
                <span className="text-amber-300 font-mono">founder_preview</span> in the ledger so
                real-player ₵ stay untouched.
              </p>
              <div className="space-y-1.5">
                {[
                  { amount: 100_000, label: '100K ₵ — VIP Blackjack walk-in' },
                  { amount: 1_000_000, label: '1M ₵ — Vibe 654 Tournament buy-in' },
                  { amount: 10_000_000, label: '10M ₵ — High Roller VIP & every room' },
                ].map(({ amount, label }) => (
                  <button
                    key={amount}
                    type="button"
                    onClick={() => handleFounderTopUp(amount, label)}
                    disabled={previewBusy}
                    data-testid={`founder-preview-topup-${amount}`}
                    className="w-full text-left flex items-center justify-between px-3 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-amber-400/10 hover:border-amber-400/40 transition-colors text-[11px] font-medium disabled:opacity-50"
                  >
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
