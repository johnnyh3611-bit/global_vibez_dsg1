/**
 * SocialAuthButtons — Google / Twitter / Facebook login CTAs on /login.
 *
 * Uses Privy headless OAuth (useLoginWithOAuth) when the Privy provider is
 * mounted, then exchanges the Privy access token for a platform session via
 * POST /api/auth/privy/session.
 *
 * Intentionally NOT named PrivyLoginButton — that component was retired
 * (regression_shield locks the file out) after a CSP modal regression.
 *
 * When Privy is missing/skipped (localhost without ?force_privy=1, or no
 * REACT_APP_PRIVY_APP_ID), buttons remain visible but mark as Coming Soon /
 * Not Configured so the login surface always shows social options.
 */
import React, { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAccessToken, useLoginWithOAuth, usePrivy } from "@privy-io/react-auth";
import { getBackendUrl } from "@/config/backendUrl";
import { setBearerToken } from "@/utils/secureAuth";
import { consumeReturnTo } from "@/hubs/hubRegistry";

const API = getBackendUrl();
const PRIVY_APP_ID = (process.env.REACT_APP_PRIVY_APP_ID || "").trim();

type SocialProvider = "google" | "twitter" | "facebook";

const PROVIDERS: Array<{
  id: SocialProvider;
  label: string;
  /** Privy OAuth provider id — facebook is not in Privy's ExternalOAuthProviderID */
  privyProvider: "google" | "twitter" | null;
  testId: string;
  className: string;
}> = [
  {
    id: "google",
    label: "Continue with Google",
    privyProvider: "google",
    testId: "social-login-google",
    className:
      "border-white/20 bg-white/95 text-slate-900 hover:bg-white hover:shadow-[0_0_20px_rgba(255,255,255,0.25)]",
  },
  {
    id: "twitter",
    label: "Continue with X / Twitter",
    privyProvider: "twitter",
    testId: "social-login-twitter",
    className:
      "border-sky-400/40 bg-sky-500/15 text-sky-100 hover:bg-sky-500/25 hover:shadow-[0_0_20px_rgba(56,189,248,0.35)]",
  },
  {
    id: "facebook",
    label: "Continue with Facebook",
    privyProvider: null,
    testId: "social-login-facebook",
    className:
      "border-blue-400/40 bg-blue-600/20 text-blue-100 hover:bg-blue-600/30 hover:shadow-[0_0_20px_rgba(59,130,246,0.35)]",
  },
];

function shouldSkipPrivyHost(): boolean {
  if (typeof window === "undefined") return true;
  const host = window.location.hostname || "";
  try {
    if (new URLSearchParams(window.location.search).get("force_privy") === "1") {
      return false;
    }
  } catch {
    /* ignore */
  }
  return (
    /\.preview\.emergentagent\.com$/i.test(host) ||
    /\.emergentagent\.com$/i.test(host) ||
    /^localhost$/i.test(host) ||
    /^127\.0\.0\.1$/i.test(host) ||
    /^0\.0\.0\.0$/i.test(host)
  );
}

type PrivyUserLite = {
  email?: { address?: string } | null;
  google?: { email?: string; name?: string } | null;
  twitter?: { username?: string; name?: string } | null;
};

async function exchangePrivySession(
  accessToken: string,
  user: PrivyUserLite | null | undefined,
): Promise<{ token: string; user_id: string; profile_completed?: boolean }> {
  const email = user?.email?.address || user?.google?.email || undefined;
  const displayName =
    user?.google?.name ||
    user?.twitter?.name ||
    user?.twitter?.username ||
    email ||
    "Social Player";

  const linked: Array<{ type: string; address: string }> = [];
  if (email) linked.push({ type: "email", address: email });
  if (user?.google?.email) linked.push({ type: "google", address: user.google.email });
  if (user?.twitter?.username) {
    linked.push({ type: "twitter", address: user.twitter.username });
  }

  const res = await fetch(`${API}/api/auth/privy/session`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      display_name: displayName,
      email: email || null,
      linked_accounts: linked,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.token) {
    throw new Error(
      typeof data.detail === "string" ? data.detail : "Social login session failed",
    );
  }
  return data;
}

function Divider() {
  return (
    <div className="relative my-2">
      <div className="absolute inset-0 flex items-center">
        <div className="w-full border-t border-white/10" />
      </div>
      <div className="relative flex justify-center text-xs uppercase tracking-wider">
        <span className="bg-transparent px-3 text-slate-400">or continue with</span>
      </div>
    </div>
  );
}

/** Visible placeholders when Privy SDK is not mounted. */
function SocialAuthButtonsPlaceholder({
  reason,
}: {
  reason: "missing_app_id" | "host_skipped";
}) {
  const hint =
    reason === "missing_app_id"
      ? "Social login not configured — set REACT_APP_PRIVY_APP_ID"
      : "Social login available on production domains (or ?force_privy=1)";

  return (
    <div className="space-y-3" data-testid="social-auth-buttons">
      <Divider />
      {PROVIDERS.map((p) => (
        <button
          key={p.id}
          type="button"
          disabled
          data-testid={p.testId}
          className={`w-full cursor-not-allowed rounded-xl border px-4 py-2.5 text-sm font-semibold opacity-70 ${p.className}`}
          title={hint}
        >
          {p.label}
          <span className="ml-2 text-[11px] font-medium opacity-80">
            {p.id === "facebook" ? "· Coming Soon" : "· Not Configured"}
          </span>
        </button>
      ))}
      <p className="text-center text-[11px] text-slate-500" data-testid="social-auth-hint">
        {hint}
      </p>
    </div>
  );
}

function SocialAuthButtonsLive({
  postLoginPath,
  onError,
}: {
  postLoginPath: (fallback?: string) => string;
  onError: (msg: string) => void;
}) {
  const navigate = useNavigate();
  const { ready, authenticated, user } = usePrivy();
  const { initOAuth, loading } = useLoginWithOAuth({
    onComplete: async () => {
      try {
        localStorage.setItem("auth_in_progress", "1");
        const accessToken = await getAccessToken();
        if (!accessToken) throw new Error("Missing Privy access token");
        const session = await exchangePrivySession(accessToken, user as PrivyUserLite);
        setBearerToken(session.token);
        localStorage.setItem("user_id", session.user_id);
        if (session.profile_completed) {
          window.location.href = postLoginPath("/dashboard");
        } else {
          navigate("/profile/setup");
        }
      } catch (err) {
        onError(err instanceof Error ? err.message : "Social login failed");
      } finally {
        localStorage.removeItem("auth_in_progress");
      }
    },
    onError: (err) => {
      const msg =
        typeof err === "string"
          ? err
          : (err as { message?: string })?.message || String(err || "Social login failed");
      onError(msg);
    },
  });
  const [busy, setBusy] = useState<SocialProvider | null>(null);

  const start = useCallback(
    async (provider: SocialProvider, privyProvider: "google" | "twitter" | null) => {
      if (!privyProvider) {
        onError("Facebook login is coming soon — use Google or X / Twitter.");
        return;
      }
      if (!ready) {
        onError("Social login is still loading — try again in a moment.");
        return;
      }
      if (authenticated) {
        try {
          setBusy(provider);
          localStorage.setItem("auth_in_progress", "1");
          const accessToken = await getAccessToken();
          if (!accessToken) throw new Error("Missing Privy access token");
          const session = await exchangePrivySession(accessToken, user as PrivyUserLite);
          setBearerToken(session.token);
          localStorage.setItem("user_id", session.user_id);
          window.location.href = session.profile_completed
            ? postLoginPath("/dashboard")
            : "/profile/setup";
        } catch (err) {
          onError(err instanceof Error ? err.message : "Social login failed");
        } finally {
          localStorage.removeItem("auth_in_progress");
          setBusy(null);
        }
        return;
      }
      try {
        setBusy(provider);
        await initOAuth({ provider: privyProvider });
      } catch (err) {
        onError(err instanceof Error ? err.message : "Could not start social login");
        setBusy(null);
      }
    },
    [authenticated, initOAuth, onError, postLoginPath, ready, user],
  );

  return (
    <div className="space-y-3" data-testid="social-auth-buttons">
      <Divider />
      {PROVIDERS.map((p) => {
        const isFacebook = p.privyProvider === null;
        const disabled = isFacebook || loading || busy !== null;
        return (
          <button
            key={p.id}
            type="button"
            data-testid={p.testId}
            disabled={disabled}
            onClick={() => void start(p.id, p.privyProvider)}
            className={`w-full rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all duration-200 disabled:opacity-60 ${p.className}`}
          >
            {busy === p.id ? "Connecting…" : p.label}
            {isFacebook && (
              <span className="ml-2 text-[11px] font-medium opacity-80">· Coming Soon</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

class SocialAuthErrorBoundary extends React.Component<
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
    console.warn("[SocialAuthButtons] falling back — Privy hooks unavailable:", err?.message);
  }
  render() {
    if (this.state.hasError) return <>{this.props.fallback}</>;
    return <>{this.props.children}</>;
  }
}

export default function SocialAuthButtons({
  postLoginPath = (fallback = "/dashboard") => consumeReturnTo(fallback),
  onError,
}: {
  postLoginPath?: (fallback?: string) => string;
  onError?: (msg: string) => void;
}) {
  const handleError = onError || (() => undefined);

  if (!PRIVY_APP_ID) {
    return <SocialAuthButtonsPlaceholder reason="missing_app_id" />;
  }
  if (shouldSkipPrivyHost()) {
    return <SocialAuthButtonsPlaceholder reason="host_skipped" />;
  }

  return (
    <SocialAuthErrorBoundary fallback={<SocialAuthButtonsPlaceholder reason="host_skipped" />}>
      <SocialAuthButtonsLive postLoginPath={postLoginPath} onError={handleError} />
    </SocialAuthErrorBoundary>
  );
}
