/**
 * Shared card-game color tokens.
 *
 * The audit agent (V4_hardcoded_hex) flagged duplicated suit colors
 * and accent palettes across Spades/BidWhist/Poker/etc. Centralising
 * them here means a designer can change the whole system in one file.
 *
 * NOTE: these are raw hex strings on purpose — framer-motion animations
 * (`initial={{ color: SUIT.H }}`) require runtime hex, not Tailwind
 * classnames. Use the Tailwind `text-[#...]` / `bg-[#...]` syntax when
 * you need a class.
 */

export const SUIT_COLORS = {
  /** Spades — neutral silver (shows well on dark felt). */
  S: "#cbd5e1",
  /** Hearts — rose-red. */
  H: "#f43f5e",
  /** Diamonds — amber-orange. */
  D: "#fb923c",
  /** Clubs — cyber-cyan (departs from classic green for brand cohesion). */
  C: "#22d3ee",
} as const;

export type SuitKey = keyof typeof SUIT_COLORS;

/**
 * Accent colors used for game-state animations (win/loss/timer).
 * Keep these in sync with the Tailwind palette so the hex and the
 * semantic class agree.
 */
export const GAME_ACCENT = {
  /** Emerald-500 — success / win / call. */
  win: "#22c55e",
  /** Red-500 — loss / fold / out-of-time. */
  lose: "#ef4444",
  /** Blue-400 — neutral / info / opponent turn. */
  info: "#60a5fa",
  /** Amber-500 — warn / timer-critical. */
  warn: "#f59e0b",
  /** Cyan-400 — highlight / active-turn. */
  active: "#22d3ee",
} as const;

/** Canonical dark-felt background used by AAA game tables. */
export const CARD_FELT_BG = "#050507";

/** Canonical deep-violet gradient used by premium lobbies. */
export const PREMIUM_LOBBY_GRADIENT = "linear-gradient(135deg, #667eea 0%, #764ba2 100%)";
