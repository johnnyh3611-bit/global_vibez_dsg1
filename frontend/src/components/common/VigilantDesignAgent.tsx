/**
 * VigilantDesignAgent — Cyber-Casino UI Audit (Ultimate Blueprint v3 §1).
 *
 *   "Logic to detect if the 'Emergent' logo overlaps main action
 *    buttons. If conflict is detected, the logo is automatically
 *    repositioned to the top-right corner with 50% opacity."
 *
 * The "Made with Emergent" badge is injected by the platform as a
 * fixed footer/sidebar element. On small screens (and certain game
 * pages) it overlaps Hit/Stand, Bid, Submit, etc. — this agent watches
 * the DOM, tests for AABB intersection between the badge and any
 * `[data-action="primary"]` button, and tucks the badge to the
 * top-right at 50% opacity if it collides.
 *
 * Lightweight: one MutationObserver + a debounced rAF check on resize
 * / scroll. No external deps. Renders nothing.
 */
import { useEffect } from "react";

const BADGE_SELECTORS = [
  '[data-emergent-badge="true"]',
  'a[href*="emergent.com"]',
  '[class*="made-with-emergent"]',
  '[id*="emergent"]',
];

const ACTION_SELECTORS = [
  '[data-action="primary"]',
  'button[data-testid$="-confirm-btn"]',
  'button[data-testid$="-submit-btn"]',
  'button[data-testid$="-bid-btn"]',
  'button[data-testid="cta-start-playing"]',
  'button[data-testid="header-join-btn"]',
];

const REPOSITIONED_STYLE = {
  position: "fixed",
  top: "10px",
  right: "10px",
  bottom: "auto",
  left: "auto",
  opacity: "0.5",
  zIndex: "60",
} as Record<string, string>;

function findBadge(): HTMLElement | null {
  for (const sel of BADGE_SELECTORS) {
    const el = document.querySelector<HTMLElement>(sel);
    if (el) return el;
  }
  // Last-resort: scan for elements whose text contains "Made with Emergent"
  const candidates = Array.from(document.querySelectorAll<HTMLElement>("a, div"));
  return (
    candidates.find((c) => /Made with Emergent/i.test(c.textContent || "")) ||
    null
  );
}

function aabbOverlap(a: DOMRect, b: DOMRect): boolean {
  return !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
}

function audit(): void {
  const badge = findBadge();
  if (!badge) return;
  const badgeRect = badge.getBoundingClientRect();
  if (!badgeRect.width || !badgeRect.height) return;

  let collision = false;
  for (const sel of ACTION_SELECTORS) {
    const els = document.querySelectorAll<HTMLElement>(sel);
    for (const el of Array.from(els)) {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      if (r.top > window.innerHeight || r.bottom < 0) continue;
      if (aabbOverlap(badgeRect, r)) {
        collision = true;
        break;
      }
    }
    if (collision) break;
  }

  if (collision) {
    Object.entries(REPOSITIONED_STYLE).forEach(([k, v]) => {
      // setProperty so it survives later CSS changes.
      badge.style.setProperty(k.replace(/[A-Z]/g, "-$&").toLowerCase(), v, "important");
    });
    badge.setAttribute("data-vigilant-repositioned", "true");
  }
}

export function VigilantDesignAgent(): null {
  useEffect(() => {
    let raf = 0;
    const debounced = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(audit);
    };
    debounced();

    const obs = new MutationObserver(debounced);
    obs.observe(document.body, { childList: true, subtree: true, attributes: true });
    window.addEventListener("resize", debounced, { passive: true });
    window.addEventListener("scroll", debounced, { passive: true });

    // Re-audit periodically — the Emergent badge is sometimes injected
    // late by the platform's <script>.
    const i = window.setInterval(debounced, 4000);

    return () => {
      cancelAnimationFrame(raf);
      obs.disconnect();
      window.removeEventListener("resize", debounced);
      window.removeEventListener("scroll", debounced);
      clearInterval(i);
    };
  }, []);
  return null;
}

export default VigilantDesignAgent;
