/**
 * PrivyAuthProvider — real Privy hybrid auth wrapper.
 *
 * Activates when REACT_APP_PRIVY_APP_ID is set. Provides social logins
 * (Google / Twitter / Apple / Email).
 *
 * Defensive for production: wraps `<PrivyProvider>` in an error boundary
 * so a Privy SDK crash (e.g. domain not whitelisted in the Privy
 * dashboard, embedded-wallet init failure, etc.) CANNOT take down
 * the rest of the auth subsystem. Demo / email / Google OAuth routes
 * MUST keep working even when Privy is broken.
 *
 * **Critical fix (Apr 30 2026):** the previous implementation re-rendered
 * `<PrivyProvider>` in BOTH error and non-error branches, so a Privy
 * mount crash on an unwhitelisted prod domain (`globalvibezdsg.com`)
 * blanked the entire login screen — including demo login. Now the
 * fallback renders the app tree DIRECTLY, bypassing Privy entirely.
 *
 * Also: embedded-wallet creation is intentionally disabled here. We
 * already have `<PhantomConnectProvider>` as the dedicated in-app
 * wallet path — two competing embedded-wallet SDKs caused a
 * `TypeError: t is not a function at ro.initialize` on mount for
 * domains not in Privy's allowed list.
 */
import React from "react";
import { PrivyProvider } from "@privy-io/react-auth";

const APP_ID = (process.env.REACT_APP_PRIVY_APP_ID || "").trim();

/**
 * Domains where Privy must be skipped entirely.
 *
 * Privy's SDK fires a CSP frame-ancestors 403 + a `TypeError: e is not
 * a function` every page load on any host that's not in the Privy
 * Dashboard's allow-list. Emergent preview URLs are dynamic per-job and
 * cannot be added to that list, so we hard-skip them at the SDK boundary
 * to keep the dev console clean. Production (`globalvibezdsg.com` + any
 * apex/www variant the Founder later whitelists) still mounts Privy
 * normally.
 */
const PRIVY_SKIP_PATTERNS: Array<RegExp> = [
  /\.preview\.emergentagent\.com$/i,
  /\.emergentagent\.com$/i,
  /^localhost$/i,
  /^127\.0\.0\.1$/i,
  /^0\.0\.0\.0$/i,
];

const shouldSkipPrivy = (): boolean => {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname || "";
  // Allow an explicit override flag in case QA needs to test Privy on a
  // preview URL (`?force_privy=1`).
  try {
    if (new URLSearchParams(window.location.search).get("force_privy") === "1") {
      return false;
    }
  } catch {
    // ignore
  }
  return PRIVY_SKIP_PATTERNS.some((re) => re.test(host));
};

class PrivyErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode; fallback: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err: Error) {
    // eslint-disable-next-line no-console
    console.warn(
      "[PrivyAuthProvider] Privy crashed on mount — falling back to " +
        "pass-through so demo + Google login still work. Error:",
      err?.message || err,
    );
  }
  render() {
    // When Privy crashes, render the app tree WITHOUT Privy. Re-rendering
    // <PrivyProvider> here would just re-trigger the same mount crash.
    if (this.state.hasError) return <>{this.props.fallback}</>;
    return <>{this.props.children}</>;
  }
}

export default function PrivyAuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!APP_ID) return <>{children}</>;
  // Preview / localhost: skip the SDK so it never triggers CSP +
  // `TypeError: e is not a function` console spam. Production domains
  // continue to mount Privy normally.
  if (shouldSkipPrivy()) return <>{children}</>;

  return (
    <PrivyErrorBoundary fallback={children}>
      <PrivyProvider
        appId={APP_ID}
        config={{
          loginMethods: ["wallet", "email", "google", "twitter", "apple"],
          appearance: {
            theme: "dark",
            accentColor: "#22d3ee",
            showWalletLoginFirst: false,
            walletChainType: "solana-only",
            logo: "/global-vibez-logo.png?v=6",
          },
          // Embedded wallets intentionally OFF — PhantomConnectProvider
          // already owns that surface and Privy's embedded-wallet init
          // crashed when the domain wasn't in Privy's dashboard allow-list.
          embeddedWallets: {
            solana: { createOnLogin: "off" },
          },
        }}
      >
        {children}
      </PrivyProvider>
    </PrivyErrorBoundary>
  );
}
