/**
 * PrivyLoginButton — drop-in social/wallet login pill.
 *
 * Fires Privy's hosted modal on click. Once authenticated, it
 * automatically posts the access token + linked accounts to our backend
 * via /api/auth/privy/sync so we have a hybrid user_identities row.
 *
 * **Self-hiding guard (Feb 2026):** On production domains that are NOT
 * in Privy's dashboard allow-list (e.g. `social-connect-953.emergent.host`),
 * Privy's `auth.privy.io` iframe returns `frame-ancestors` CSP that
 * blocks framing. The SDK then crashes with `TypeError: t is not a
 * function at uo.initialize` and the popup fallback renders at full
 * viewport ("really big, outrageous modal"). To avoid surfacing a
 * broken button to users on those domains:
 *
 *   1. We wrap `usePrivy()` in an ErrorBoundary so a thrown mount
 *      error never takes down the LoginPage (Google/Demo still work).
 *   2. If `ready` stays false for > 4s we treat Privy as unavailable
 *      and render nothing — the Google + Demo buttons are still there.
 *
 * Usage:
 *   <PrivyLoginButton />                       — full button
 *   <PrivyLoginButton variant="compact" />     — header-pill version
 */
import { useEffect, useRef, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { LogIn, LogOut, User } from "lucide-react";

const BACKEND = process.env.REACT_APP_BACKEND_URL;

function PrivyButtonInner({
  variant,
}: {
  variant: "default" | "compact";
}) {
  const { ready, authenticated, login, logout, user, getAccessToken } = usePrivy();
  const syncedRef = useRef(false);
  const [giveUp, setGiveUp] = useState(false);

  // After login, push the user up to our backend hybrid identity.
  useEffect(() => {
    if (!ready || !authenticated || syncedRef.current) return;
    syncedRef.current = true;
    type LinkedAccount = { type: string; address?: string; email?: string };
    (async () => {
      try {
        const token = await getAccessToken();
        if (!token) return;
        const linked = (user?.linkedAccounts || []).map((a: LinkedAccount) => ({
          type: a.type,
          address: a.address || a.email || "",
        }));
        await fetch(`${BACKEND}/api/auth/privy/sync`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            display_name:
              (user as unknown as { google?: { name?: string } })?.google?.name ||
              user?.email?.address ||
              "Privy Player",
            email: user?.email?.address,
            linked_accounts: linked,
          }),
        });
      } catch {
        /* non-fatal */
      }
    })();
  }, [ready, authenticated, user, getAccessToken]);

  // Reset sync flag on logout so the next login re-syncs.
  useEffect(() => {
    if (!authenticated) syncedRef.current = false;
  }, [authenticated]);

  // Hide the button if Privy hasn't finished initialising within 4s —
  // almost always means the hosting domain isn't in Privy's allow-list
  // and the SDK is silently crashing. Better to hide than to expose a
  // broken modal. Two independent triggers:
  //   1. `ready` stays false for 4s → Privy provider never initialized
  //   2. A `securitypolicyviolation` fires with a Privy-related URI →
  //      Privy's iframe was CSP-blocked and the SDK will never init,
  //      even if `ready` flips true later.
  useEffect(() => {
    if (ready) return;
    const t = window.setTimeout(() => setGiveUp(true), 4000);
    return () => window.clearTimeout(t);
  }, [ready]);

  useEffect(() => {
    const onViolation = (e: SecurityPolicyViolationEvent) => {
      const uri = e.blockedURI || "";
      if (uri.includes("privy.io") || uri.includes("auth.privy")) {
        setGiveUp(true);
      }
    };
    window.addEventListener("securitypolicyviolation", onViolation);
    return () => window.removeEventListener("securitypolicyviolation", onViolation);
  }, []);

  if (giveUp) return null;

  if (!ready) {
    return (
      <span className="text-xs text-cyan-700 animate-pulse">
        Privy loading…
      </span>
    );
  }

  const compact = variant === "compact";
  const baseClass = compact
    ? "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border transition-all"
    : "flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold uppercase tracking-wider border transition-all";

  if (authenticated) {
    return (
      <button
        onClick={() => logout()}
        className={`${baseClass} border-emerald-500/50 text-emerald-300 hover:bg-emerald-500/10`}
        data-testid="privy-logout-button"
      >
        <LogOut className={compact ? "w-3 h-3" : "w-4 h-4"} />
        {compact ? "Logged in" : `Logged in · ${user?.email?.address?.split("@")[0] || "wallet"}`}
      </button>
    );
  }

  return (
    <button
      onClick={() => login()}
      className={`${baseClass} border-cyan-400 text-cyan-200 hover:bg-cyan-400 hover:text-black bg-gradient-to-r from-cyan-500/10 to-fuchsia-500/10`}
      data-testid="privy-login-button"
    >
      {compact ? <User className="w-3 h-3" /> : <LogIn className="w-4 h-4" />}
      Sign in with Privy
    </button>
  );
}

/**
 * Error boundary around <PrivyButtonInner>. When `usePrivy()` is called
 * outside a `<PrivyProvider>` (because the provider crashed and its own
 * error boundary rendered the fallback tree), the hook throws. Catch
 * here and render nothing — Demo + Google login remain intact.
 */
import React from "react";

class InnerBoundary extends React.Component<
  { children: React.ReactNode },
  { dead: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { dead: false };
  }
  static getDerivedStateFromError() {
    return { dead: true };
  }
  componentDidCatch(err: Error) {
    // eslint-disable-next-line no-console
    console.warn("[PrivyLoginButton] usePrivy crashed — hiding button:", err?.message || err);
  }
  render() {
    if (this.state.dead) return null;
    return <>{this.props.children}</>;
  }
}

export default function PrivyLoginButton({
  variant = "default",
}: {
  variant?: "default" | "compact";
}) {
  return (
    <InnerBoundary>
      <PrivyButtonInner variant={variant} />
    </InnerBoundary>
  );
}
