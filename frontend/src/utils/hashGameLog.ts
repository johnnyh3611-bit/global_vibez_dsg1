/**
 * hashGameLog — deterministic SHA-256 over the canonical event list,
 * mirror of the backend's `routes.match_consensus.hash_game_log(events)`.
 *
 * Both teams' clients run the SAME implementation over the SAME
 * canonical event list → identical hex digest. The backend's
 * `_hashes_consistent()` check then catches a cheater whose winner +
 * score claim matches the opponent but whose game state actually
 * diverged (different cards played, different hands, etc.).
 *
 * Algorithm (must stay byte-identical to backend):
 *   1. Stringify every event via `String(e)`
 *   2. Join with "|" — the canonical delimiter
 *   3. UTF-8 encode
 *   4. SHA-256 → lower-case hex
 *
 * Returns a Promise because Web Crypto's SHA-256 is async.
 */
export async function hashGameLog(events: unknown[]): Promise<string> {
  const canonical = events.map((e) => String(e)).join("|");
  const bytes = new TextEncoder().encode(canonical);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hex = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hex;
}
