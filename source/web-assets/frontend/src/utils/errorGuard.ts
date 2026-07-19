/**
 * Global error swallower for known-harmless third-party SDK errors.
 *
 * These third-party SDKs throw inside async event handlers that React
 * error-boundaries can't catch:
 *   - Privy analytics: "TypeError: e is not a function" inside la.initialize
 *   - Firebase Analytics: same pattern when sandboxed in iframes
 *   - WalletConnect: "indexedDB is not available"
 *   - XR emulator constructor mismatches (also stubbed via src/stubs/iwer-*)
 *
 * Without this guard, the throws bubble up to `window.onerror` and
 * (in some browsers) freeze the JS event loop just long enough that a
 * user click on the Demo Login button is registered but never executes.
 * In CRA they also paint a full-screen red overlay on every page load.
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
  /devUIConstructor is not a constructor/i,
  /installDevUI/i,
  /@iwer\/devui/i,
  /@pmndrs\/xr.*emulat/i,
];

function isHarmless(msg: string): boolean {
  return HARMLESS_PATTERNS.some((rx) => rx.test(msg));
}

function logSwallowed(kind: string, msg: string, stack?: string): void {
  // Opt-in only — keep production & default local consoles clean.
  if (process.env.REACT_APP_DEBUG_ERROR_GUARD !== "1") return;
  // eslint-disable-next-line no-console
  console.debug(`[errorGuard] swallowed ${kind}:`, msg.slice(0, 160));
  if (stack) {
    // eslint-disable-next-line no-console
    console.debug("[errorGuard] stack:", stack.slice(0, 600));
  }
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
        logSwallowed("SDK error", msg, event.error?.stack);
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
    const stack = typeof reason === "object" && reason?.stack ? String(reason.stack) : undefined;
    if (isHarmless(msg)) {
      event.preventDefault();
      logSwallowed("SDK rejection", msg, stack);
    }
  });
}
