/**
 * PhantomConnectProvider — wraps the app with Phantom's hosted Connect SDK
 * (`@phantom/react-sdk`). This is the *in-app wallet browser* path: users
 * sign in with Google / Apple / Phantom and get a non-custodial Solana
 * wallet without ever leaving the casino UI.
 *
 * Coexists with:
 *   • `<SolanaWalletProvider>` (browser-extension wallets via wallet-adapter)
 *   • `<LedgerSignerProvider>` (hardware wallets via WebHID)
 *
 * The user picks whichever path they prefer — these three providers do
 * NOT compete; each exposes its own React hook (`useConnect()` from
 * Phantom, `useWallet()` from wallet-adapter, `useLedger()` for Ledger).
 *
 * SECURITY: App ID + redirect URL come from `.env` only. If the App ID
 * is missing we render children without the provider so the rest of the
 * app keeps working — Phantom Connect just won't be available.
 */
import React from "react";
import { PhantomProvider } from "@phantom/react-sdk";
import { AddressType } from "@phantom/browser-sdk";

const PHANTOM_APP_ID = process.env.REACT_APP_PHANTOM_APP_ID;

/**
 * Build the OAuth redirect URL. The redirect MUST exactly match what's
 * configured in Phantom Portal → URL Config — we use the same origin as
 * the running frontend so it works in preview, staging, and prod without
 * code changes.
 */
function getRedirectUrl(): string {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/auth/phantom-callback`;
}

export default function PhantomConnectProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!PHANTOM_APP_ID) {
    if (typeof window !== "undefined") {
      // eslint-disable-next-line no-console
      console.warn(
        "[Phantom] REACT_APP_PHANTOM_APP_ID is not set — Phantom Connect SDK is disabled.",
      );
    }
    return <>{children}</>;
  }

  return (
    <PhantomProvider
      config={{
        providers: ["google", "apple", "phantom", "injected", "deeplink"],
        appId: PHANTOM_APP_ID,
        addressTypes: [AddressType.solana],
        // Network is set per-transaction via `NetworkId` at sign time —
        // there is no provider-level cluster config in @phantom/react-sdk v2.
        authOptions: {
          redirectUrl: getRedirectUrl(),
        },
      }}
    >
      {children}
    </PhantomProvider>
  );
}
