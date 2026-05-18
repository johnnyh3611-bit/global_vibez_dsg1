/**
 * Currency helpers — Vibez Coins (₵) is the single in-app currency.
 *
 * Per product directive: NO dollar amounts displayed anywhere in the app.
 * Everything renders as ₵ (Vibez Coins). Conversion to SOL/USD is an
 * exchange action surfaced in dedicated screens, never inline UI labels.
 */

export const CURRENCY_SYMBOL = "₵";
export const CURRENCY_NAME = "Vibez Coins";
export const CURRENCY_SHORT = "VBZ";

/**
 * Format a Vibez Coin amount for display.
 *   formatCoins(1234)       → "₵1,234"
 *   formatCoins(0.5)        → "₵0.5"
 *   formatCoins(2_500_000)  → "₵2.5M"
 */
export const formatCoins = (amount: number, opts?: { compact?: boolean }): string => {
  const n = Number.isFinite(amount) ? amount : 0;
  const compact = !!opts?.compact;
  if (compact && Math.abs(n) >= 1_000_000) return `${CURRENCY_SYMBOL}${(n / 1_000_000).toFixed(1)}M`;
  if (compact && Math.abs(n) >= 1_000) return `${CURRENCY_SYMBOL}${(n / 1_000).toFixed(1)}K`;
  return `${CURRENCY_SYMBOL}${n.toLocaleString(undefined, {
    maximumFractionDigits: Number.isInteger(n) ? 0 : 2,
  })}`;
};

/**
 * Backwards-compat shim. Existing callsites used `formatCurrency()` to print
 * dollar-formatted strings — all rerouted through here so we can never
 * accidentally render a dollar sign again.
 */
export const formatCurrency = (amount: number): string => formatCoins(amount);

/**
 * Conversion is a separate, explicit action. Defaults below match the legacy
 * payout schedule (1,000 ₵ ≈ 1 USD ≈ ~0.005 SOL on Devnet @ ~$200/SOL · rate
 * updated 2026-05-18 from 2,000 → 1,000 ₵/$). The real rates come from the
 * backend — these are display-only fallbacks.
 */
export const COINS_PER_SOL_DEFAULT = 100_000;   // 1 SOL ≈ ₵100,000
export const COINS_PER_USD_DEFAULT = 1_000;     // 1 USD ≈ ₵1,000

export const coinsToSol = (coins: number, rate = COINS_PER_SOL_DEFAULT): number =>
  rate > 0 ? coins / rate : 0;

export const solToCoins = (sol: number, rate = COINS_PER_SOL_DEFAULT): number =>
  Math.round(sol * rate);
