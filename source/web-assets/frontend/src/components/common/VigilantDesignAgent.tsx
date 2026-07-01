/**
 * VigilantDesignAgent — Cyber-Casino UI Audit (Ultimate Blueprint v3 §1).
 *
 *   "Logic to detect if the 'Emergent' logo overlaps main action
 *    buttons. If conflict is detected, the logo is automatically
 *    repositioned to the top-right corner with 50% opacity."
 *
 * Now also performs a CONTINUOUS click-blocker audit (May 2026 §1
 * extension): walks every interactive control on the page and tests
 * whether ELEMENT FROM POINT at the control's center is the control
 * itself. If a fixed overlay is occluding it, the agent logs a
 * structured warning to console + sets `data-vigilant-blocked="true"`
 * on the offender so QA tooling and the Sentry-style monitor can pick
 * it up immediately. This is exactly what was missing when the
 * `.player-hand` global class accidentally pinned a full-width
 * overlay over Vibe Dice 654's bet picker.
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

/**
 * Selectors the click-blocker audit considers "must be reachable".
 * Anything matching this list whose center-pixel resolves to a
 * different element than itself is logged as blocked.
 */
const INTERACTIVE_SELECTORS = [
  'button:not([disabled])',
  'a[href]',
  '[role="button"]:not([aria-disabled="true"])',
  '[data-testid^="game-card-"]',
  '[data-testid^="utility-room-"]',
  '[data-testid^="callout-"]',
  '[data-testid^="vibe654-"]',
  '[data-testid^="dice-bet-"]',
  '[data-testid^="point-"]',
];

/**
 * Trick-pile / center-pile selectors. Founder mandate (May 2026):
 *   "Cards must land in the middle of the table where the logo is at,
 *    not closer to my side."
 *
 * Whenever any of these elements is on screen, the agent verifies
 * their bounding-box centroid is within 8% of their parent table's
 * centroid. If a card pile drifts toward the player's hand area
 * (which intrudes when the phone is rotated to landscape), the agent
 * tags the pile with `data-vigilant-off-center="true"` + console
 * warning so the regression is caught immediately.
 */
const PILE_SELECTORS = [
  '[data-testid="spades-trick-pile"]',
  '[data-testid="crazy-eights-center-pile"]',
  '[data-testid$="-trick-pile"]',
  '[data-testid$="-center-pile"]',
];

const PARENT_TABLE_SELECTORS = [
  '[data-testid$="-table"]',
  '[data-testid="spades-table"]',
  '[class*="spades-table"]',
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

function logBlocker(target: HTMLElement, blocker: Element | null): void {
  // Don't spam — only log each unique pair once per audit cycle.
  const key = `${target.dataset.testid || target.tagName}::${
    blocker instanceof HTMLElement
      ? blocker.dataset.testid || blocker.tagName + "." + (blocker.className || "").toString().slice(0, 40)
      : "unknown"
  }`;
  if (target.getAttribute("data-vigilant-blocker") === key) return;
  target.setAttribute("data-vigilant-blocked", "true");
  target.setAttribute("data-vigilant-blocker", key);
  // eslint-disable-next-line no-console
  console.warn(
    `[VigilantAgent] Click-blocker detected: ${target.tagName}` +
      `${target.dataset.testid ? `[${target.dataset.testid}]` : ""} ` +
      `is occluded by ${
        blocker instanceof HTMLElement
          ? blocker.tagName +
            (blocker.dataset.testid ? `[${blocker.dataset.testid}]` : "") +
            (blocker.className ? `.${String(blocker.className).slice(0, 60)}` : "")
          : "unknown overlay"
      }`,
  );
}

function clearBlocker(target: HTMLElement): void {
  if (target.hasAttribute("data-vigilant-blocked")) {
    target.removeAttribute("data-vigilant-blocked");
    target.removeAttribute("data-vigilant-blocker");
  }
}

function auditClickBlockers(): void {
  const seen = new WeakSet<HTMLElement>();
  for (const sel of INTERACTIVE_SELECTORS) {
    const els = document.querySelectorAll<HTMLElement>(sel);
    for (const el of Array.from(els)) {
      if (seen.has(el)) continue;
      seen.add(el);
      const r = el.getBoundingClientRect();
      // Skip if off-screen, inside a closed dropdown, or zero-area.
      if (!r.width || !r.height) continue;
      if (r.top > window.innerHeight || r.bottom < 0) continue;
      if (r.left > window.innerWidth || r.right < 0) continue;
      // Skip purely decorative inline elements with pointer-events:none.
      const cs = getComputedStyle(el);
      if (cs.pointerEvents === "none") continue;
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const top = document.elementFromPoint(cx, cy);
      if (!top) continue;
      if (top === el || el.contains(top) || top.contains(el)) {
        clearBlocker(el);
        continue;
      }
      // Check if `top` is inside a *pointer-events: none* layer — that
      // would mean the click would still pass through to `el`.
      let cursor: Element | null = top;
      let blocked = true;
      while (cursor) {
        const cs2 = getComputedStyle(cursor);
        if (cs2.pointerEvents === "none") {
          blocked = false;
          break;
        }
        cursor = cursor.parentElement;
      }
      if (blocked) logBlocker(el, top);
      else clearBlocker(el);
    }
  }
}

/**
 * Trick-pile centering audit (May 2026 founder mandate).
 *
 * For every center-pile element on the page, find the closest table
 * ancestor (a SpadesTable / generic *-table data-testid) and compute
 * the centroid offset between the pile and the table. If the offset
 * exceeds 8% of the table's smaller dimension on EITHER axis, tag the
 * pile with `data-vigilant-off-center="true"` and console-warn so the
 * regression surfaces in DevTools immediately.
 */
function auditTrickPileCentering(): void {
  // Find each pile.
  const piles: HTMLElement[] = [];
  for (const sel of PILE_SELECTORS) {
    document.querySelectorAll<HTMLElement>(sel).forEach((el) => piles.push(el));
  }
  if (!piles.length) return;

  for (const pile of piles) {
    // Skip off-screen.
    const pr = pile.getBoundingClientRect();
    if (!pr.width || !pr.height) continue;
    if (pr.top > window.innerHeight || pr.bottom < 0) continue;

    // Find nearest table ancestor.
    let table: HTMLElement | null = null;
    for (const sel of PARENT_TABLE_SELECTORS) {
      const found = pile.closest(sel);
      if (found instanceof HTMLElement) {
        table = found;
        break;
      }
    }
    if (!table) {
      // No explicit table wrapper — fall back to the pile's first
      // positioned ancestor that's at least 200px wide (heuristic).
      let cursor: HTMLElement | null = pile.parentElement;
      while (cursor) {
        const cr = cursor.getBoundingClientRect();
        if (cr.width >= 200 && cr.height >= 200) {
          table = cursor;
          break;
        }
        cursor = cursor.parentElement;
      }
    }
    if (!table) continue;

    const tr = table.getBoundingClientRect();
    if (!tr.width || !tr.height) continue;

    const tableCx = tr.left + tr.width / 2;
    const tableCy = tr.top + tr.height / 2;
    const pileCx = pr.left + pr.width / 2;
    const pileCy = pr.top + pr.height / 2;

    const tol = Math.min(tr.width, tr.height) * 0.08; // 8% of smaller dim
    const dx = Math.abs(pileCx - tableCx);
    const dy = Math.abs(pileCy - tableCy);

    if (dx > tol || dy > tol) {
      if (pile.getAttribute("data-vigilant-off-center") !== "true") {
        pile.setAttribute("data-vigilant-off-center", "true");
        // eslint-disable-next-line no-console
        console.warn(
          `[VigilantAgent] Trick pile drift: ${
            pile.dataset.testid || pile.tagName
          } centroid is ${dx.toFixed(0)}px,${dy.toFixed(0)}px off table center ` +
            `(tolerance ${tol.toFixed(0)}px). Cards may intrude on the player's hand.`,
        );
      }
    } else if (pile.hasAttribute("data-vigilant-off-center")) {
      pile.removeAttribute("data-vigilant-off-center");
    }
  }
}

function audit(): void {
  // 1. Emergent-badge overlap check (original v3 §1 mandate).
  const badge = findBadge();
  if (badge) {
    const badgeRect = badge.getBoundingClientRect();
    if (badgeRect.width && badgeRect.height) {
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
          badge.style.setProperty(k.replace(/[A-Z]/g, "-$&").toLowerCase(), v, "important");
        });
        badge.setAttribute("data-vigilant-repositioned", "true");
      }
    }
  }

  // 2. Continuous click-blocker audit across every room (May 2026
  //    extension — directly catches the .player-hand class regression).
  auditClickBlockers();

  // 3. Trick-pile centering audit — verifies card piles land at the
  //    middle of the table where the logo lives, not closer to the
  //    user's side (May 2026 founder mandate).
  auditTrickPileCentering();
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
