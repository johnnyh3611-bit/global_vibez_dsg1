/**
 * Safe backend URL helpers for CRA.
 *
 * Production blank-screen root cause (2026-07): Vercel builds without
 * REACT_APP_BACKEND_URL bake `undefined` into the bundle. Any module-level
 * `process.env.REACT_APP_BACKEND_URL.replace(...)` then throws
 * `Cannot read properties of undefined (reading 'replace')` during the
 * eager route import graph and leaves #root empty.
 */
export function getBackendUrl(): string {
  const raw = process.env.REACT_APP_BACKEND_URL;
  if (typeof raw !== "string") return "";
  return raw.replace(/\/$/, "");
}

/** http(s) → ws(s) for Socket.IO / raw WS endpoints. */
export function getBackendWsUrl(): string {
  const base = getBackendUrl();
  if (!base) return "";
  return base.replace(/^http/, "ws");
}

export default getBackendUrl;
