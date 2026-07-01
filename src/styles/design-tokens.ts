/**
 * Global Vibez DSG design tokens — TS mirror of the canonical `@theme` block in
 * `src/app/globals.css`. The CSS is the source of truth; this file exposes the
 * same concepts as ready-to-use Tailwind class strings for `.tsx` components.
 *
 * Usage:
 *   import { glassStyle, brand } from "@/styles/design-tokens";
 *   <div className={glassStyle}>...</div>
 *   <button className={brand.button}>...</button>
 */

/** Standard glass surface: blur + translucent fill + hairline border + depth. */
export const glassStyle =
  "backdrop-blur-md bg-surface-glass border border-surface-glass-border shadow-glass rounded-glass";

/** Stronger glass for elevated/active surfaces. */
export const glassStyleStrong =
  "backdrop-blur-md bg-surface-glass-strong border border-surface-glass-border shadow-glass-lg rounded-glass";

/** Minimum touch target (Mobile-First mandate: >= 44px). */
export const touchTarget = "min-h-11 min-w-11";

export const brand = {
  /** Primary CTA button — brand violet, glow, 44px tap height. */
  button:
    "inline-flex items-center justify-center min-h-11 rounded-full bg-brand-primary px-6 text-sm font-semibold text-white shadow-brand-glow transition-colors hover:bg-brand-primary-hover disabled:opacity-50",
  /** Secondary/ghost glass button. */
  buttonGhost:
    "inline-flex items-center justify-center min-h-11 rounded-full border border-surface-glass-border bg-surface-glass px-6 text-sm font-semibold text-white backdrop-blur-md transition-colors hover:bg-surface-glass-strong",
} as const;

/** Raw token values (for canvases/inline styles where classes don't apply). */
export const tokens = {
  color: {
    brandPrimary: "#7c3aed",
    brandPrimaryHover: "#6d28d9",
    brandAccent: "#a78bfa",
    brandGlow: "#c4b5fd",
    backgroundDeep: "#0f172a",
    backgroundAbyss: "#050508",
    surfaceGlass: "rgba(255, 255, 255, 0.1)",
  },
  radius: { glass: "16px" },
} as const;
