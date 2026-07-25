/**
 * Stripe fiat checkout is retired — Helio (card) + Solana deposit only.
 * Use these helpers so 410 responses never redirect to a missing checkout_url.
 */

export const STRIPE_RETIRED_MESSAGE =
  "Stripe checkout is retired. Top up with Helio (card) or Solana from your wallet.";

export const WALLET_TOPUP_PATH = "/wallet";

export function extractApiDetail(data: unknown): unknown {
  if (data && typeof data === "object" && "detail" in data) {
    return (data as { detail: unknown }).detail;
  }
  return data;
}

export function isStripeRetiredResponse(
  status: number | undefined,
  data: unknown,
): boolean {
  if (status === 410) return true;
  const detail = extractApiDetail(data);
  if (detail && typeof detail === "object") {
    const err = (detail as { error?: string }).error;
    if (err === "stripe_retired") return true;
  }
  if (data && typeof data === "object") {
    const err = (data as { error?: string }).error;
    if (err === "stripe_retired") return true;
  }
  return false;
}

export function stripeRetiredMessage(data?: unknown): string {
  const detail = extractApiDetail(data);
  if (detail && typeof detail === "object") {
    const msg = (detail as { message?: string }).message;
    if (typeof msg === "string" && msg.trim()) return msg;
  }
  if (typeof detail === "string" && detail.trim()) return detail;
  return STRIPE_RETIRED_MESSAGE;
}

/** Alert + optional redirect to the Helio/Solana wallet top-up page. */
export function handleStripeRetired(
  data?: unknown,
  opts?: { redirectToWallet?: boolean },
): string {
  const msg = stripeRetiredMessage(data);
  if (typeof window !== "undefined") {
    window.alert(msg);
    if (opts?.redirectToWallet !== false) {
      window.location.href = WALLET_TOPUP_PATH;
    }
  }
  return msg;
}
