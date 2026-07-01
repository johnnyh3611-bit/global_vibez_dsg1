/**
 * Global error swallower for known-harmless third-party SDK errors.
 *
 * These third-party SDKs throw inside async event handlers that React
 * error-boundaries can't catch:
 *   - Privy analytics: "TypeError: e is not a function" inside la.initialize
 *   - Firebase Analytics: same pattern when sandboxed in iframes
 *   - WalletConnect: "indexedDB is not available"
 *
 * Without this guard, the throws bubble up to `window.onerror` and
 * (in some browsers) freeze the JS event loop just long enough that a
 * user click on the Demo Login button is registered but never executes.
 *
 * We DON'T silence app code throws — only the specific SDK signatures.
 */
const HARMLESS_PATTERNS: RegExp[] = [
  /la\.initialize/,                              // Privy analytics
  /e is not a function.*at.*bundle\.js:/,        // minified SDK init
  /indexedDB is not (available|allowed)/,        // WalletConnect in incognito
  /firebase\/analytics/,                         // Firebase analytics SDK
  /Failed to fetch.*auth\.privy\.io/,            // Privy fetch in restricted env
  /privy.*analytics/i,                           // any privy analytics throw
];

function isHarmless(msg: string): boolean {
  return HARMLESS_PATTERNS.some((rx) => rx.test(msg));
}

export function installGlobalErrorGuard(): void {
  if (typeof window === "undefined") return;

  // Synchronous errors (script throws in event handlers, etc.)
  window.addEventListener(
    "error",
    (event: ErrorEvent) => {
      const msg = `${event.message || ""} ${event.error?.stack || ""}`;
      if (isHarmless(msg)) {
        event.preventDefault();
        event.stopPropagation();
        if (process.env.NODE_ENV !== "production") {
          // eslint-disable-next-line no-console
          console.debug("[errorGuard] swallowed harmless SDK error:", msg.slice(0, 120));
        }
      }
    },
    true,
  );

  // Unhandled promise rejections (Privy's internal fetches throw here)
  window.addEventListener("unhandledrejection", (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    const msg =
      typeof reason === "string"
        ? reason
        : `${reason?.message || ""} ${reason?.stack || ""}`;
    if (isHarmless(msg)) {
      event.preventDefault();
      if (process.env.NODE_ENV !== "production") {
        // eslint-disable-next-line no-console
        console.debug("[errorGuard] swallowed harmless SDK rejection:", msg.slice(0, 120));
      }
    }
  });
}
