/**
 * Safe backend URL helpers for CRA.
 *
 * Production blank-screen root cause (2026-07): Vercel builds without
 * REACT_APP_BACKEND_URL bake `undefined` into the bundle. Any module-level
 * `process.env.REACT_APP_BACKEND_URL.replace(...)` then throws
 * `Cannot read properties of undefined (reading 'replace')` during the
 * eager route import graph and leaves #root empty.
 *
 * Prefer REACT_APP_BACKEND_URL. REACT_APP_API_URL is accepted as an alias
 * for Railway dashboard naming. Both are bake-time CRA vars — set them on
 * the frontend service build, and use the backend's *public* HTTPS URL
 * (browsers cannot reach *.railway.internal).
 */
export function getBackendUrl(): string {
  const raw =
    process.env.REACT_APP_BACKEND_URL || process.env.REACT_APP_API_URL;
  if (typeof raw !== "string" || !raw) return "";
  return raw.replace(/\/$/, "");
}

/** http(s) → ws(s) for Socket.IO / raw WS endpoints. */
export function getBackendWsUrl(): string {
  const base = getBackendUrl();
  if (!base) return "";
  return base.replace(/^http/, "ws");
}

export default getBackendUrl;
