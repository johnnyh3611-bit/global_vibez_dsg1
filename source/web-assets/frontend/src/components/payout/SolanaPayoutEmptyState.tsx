/**
 * SolanaPayoutEmptyState — placeholder while Stripe Connect is retired
 * and Solana/USDC payouts roll out.
 */
import { Wallet } from "lucide-react";

type Props = {
  role?: string;
  variant?: "primary" | "compact";
};

export default function SolanaPayoutEmptyState({ role, variant = "primary" }: Props) {
  const compact = variant === "compact";

  return (
    <div
      data-testid="solana-payout-empty-state"
      data-role={role}
      className={
        compact
          ? "inline-flex items-start gap-2 rounded-lg border border-slate-600/50 bg-slate-800/60 px-3 py-2 text-left"
          : "rounded-xl border border-slate-600/50 bg-slate-800/60 px-4 py-3 text-left"
      }
    >
      <Wallet
        className={compact ? "mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-400" : "mt-0.5 h-4 w-4 shrink-0 text-cyan-400"}
        aria-hidden
      />
      <div>
        <p
          className={
            compact
              ? "text-[11px] font-semibold text-slate-100"
              : "text-sm font-semibold text-slate-100"
          }
        >
          Payouts via Solana / USDC
        </p>
        <p
          className={
            compact
              ? "mt-0.5 text-[10px] leading-snug text-slate-400"
              : "mt-1 text-xs leading-relaxed text-slate-400"
          }
        >
          Coming online — Stripe Connect has been retired. Link a Solana wallet when payouts unlock.
        </p>
      </div>
    </div>
  );
}
