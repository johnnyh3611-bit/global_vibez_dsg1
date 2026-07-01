/**
 * Global Vibez Design Sweep — permanent, rerunnable audit.
 *
 * Runs across representative routes (auth, main hubs, 4 games spanning
 * Card/Board/Arcade/Party, JFTN, chat, MyVibez) and reports:
 *   1. Interactive elements missing an accessible name (aria-label,
 *      innerText, or title)
 *   2. Elements that overlap intrusively with sibling interactive
 *      elements (ignoring legitimate parent/child + positioned overlay
 *      patterns like modals & the Emergent preview badge)
 *   3. Focus-ring regressions — buttons with `outline: none` and no
 *      :focus-visible ring
 *   4. Page-level runtime / console errors while the page loads
 *
 * Output: console table + JSON report at
 *   /app/test_reports/design_sweep.json
 *
 * Run: `cd /app/frontend && yarn e2e --grep "Design Sweep"`
 */
import { test, expect, Page } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { demoLogin } from './_helpers/auth';

type RouteResult = {
  route: string;
  load_ok: boolean;
  console_errors: string[];
  unlabeled_buttons: Array<{ tag: string; outer: string; rect: { x: number; y: number; w: number; h: number } }>;
  overlaps: Array<{ a: string; b: string; area: number }>;
  focus_ring_issues: Array<{ outer: string }>;
};

const ROUTES = [
  '/',
  '/dashboard',
  '/games',
  '/tournaments',
  '/just-for-the-night',
  '/chat',
  '/my-vibez',
  '/practice/play/blackjack-aaa', // Card
  '/practice/play/chess',          // Board
  '/practice/play/slots',          // Arcade
  '/practice/play/trivia_rush',    // Party
];

const REPORT_PATH = '/app/test_reports/design_sweep.json';

// Build-time noise we don't care about.
const NOISE_PATTERNS = [
  /emergent-main/,
  /emergent-badge/,
  /DataCloneError/,
  /Version check/,
  /Failed to load resource.*401/,
  /Failed to load resource.*404/,
  /Failed to load resource.*challenge-platform/,
  /WebGL/i,
  /OpenGL/i,
  /Notifications Blocked/,
  /iwer\//,
];

// Elements we KNOW are positioned overlays (modals, toasts, dock pills,
// preview badges, notification banners) — their overlap with siblings is
// expected and shouldn't count as an "intrusion."
const OVERLAY_SELECTORS = [
  '[role="dialog"]',
  '[data-sonner-toaster]',
  '[data-testid="voice-mirror-dock"]',
  '[data-testid="fresh-drops-modal"]',
  '#emergent-badge',
  '.notification-banner',
];

async function analyzeRoute(page: Page, route: string): Promise<RouteResult> {
  const consoleErrors: string[] = [];
  const onErr = (err: Error) => consoleErrors.push(`PAGEERROR: ${err.message.slice(0, 200)}`);
  const onConsole = (msg: import('@playwright/test').ConsoleMessage) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 200));
  };
  page.on('pageerror', onErr);
  page.on('console', onConsole);

  let loadOk = false;
  try {
    await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.waitForTimeout(2500);
    loadOk = true;
  } catch {
    loadOk = false;
  }

  // ---------- 1. Unlabeled buttons ----------
  const unlabeled = await page.evaluate((OVERLAY_SELECTORS) => {
    const hasOverlayAncestor = (el: Element) =>
      OVERLAY_SELECTORS.some((sel) => el.closest(sel as string));
    const nodes = Array.from(
      document.querySelectorAll<HTMLElement>(
        'button, [role="button"], a[href], input:not([type="hidden"]), select, textarea'
      )
    );
    const out: any[] = [];
    for (const el of nodes) {
      if (hasOverlayAncestor(el)) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) continue; // invisible
      const label =
        el.getAttribute('aria-label')?.trim() ||
        el.getAttribute('aria-labelledby')?.trim() ||
        el.getAttribute('title')?.trim() ||
        el.getAttribute('alt')?.trim() ||
        (el.getAttribute('data-testid') ? '' : '') || // testid alone isn't accessible
        el.textContent?.trim() ||
        (el instanceof HTMLInputElement
          ? el.placeholder || el.value || ''
          : '');
      if (!label) {
        out.push({
          tag: el.tagName.toLowerCase(),
          outer: el.outerHTML.slice(0, 160).replace(/\s+/g, ' '),
          rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) },
        });
      }
    }
    return out.slice(0, 25); // top 25 per page
  }, OVERLAY_SELECTORS);

  // ---------- 2. Intrusive overlaps ----------
  const overlaps = await page.evaluate((OVERLAY_SELECTORS) => {
    const hasOverlayAncestor = (el: Element) =>
      OVERLAY_SELECTORS.some((sel) => el.closest(sel as string));
    const isAncestor = (maybeAncestor: Element, el: Element) =>
      maybeAncestor.contains(el) || el.contains(maybeAncestor);
    const interactive = Array.from(
      document.querySelectorAll<HTMLElement>('button, [role="button"], a[href]')
    ).filter((el) => {
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) return false;
      if (hasOverlayAncestor(el)) return false;
      return true;
    });

    const out: any[] = [];
    for (let i = 0; i < interactive.length; i++) {
      for (let j = i + 1; j < interactive.length; j++) {
        const a = interactive[i];
        const b = interactive[j];
        if (isAncestor(a, b)) continue;
        const ra = a.getBoundingClientRect();
        const rb = b.getBoundingClientRect();
        const x1 = Math.max(ra.left, rb.left);
        const y1 = Math.max(ra.top, rb.top);
        const x2 = Math.min(ra.right, rb.right);
        const y2 = Math.min(ra.bottom, rb.bottom);
        const ow = x2 - x1;
        const oh = y2 - y1;
        if (ow > 4 && oh > 4) {
          out.push({
            a: a.outerHTML.slice(0, 110).replace(/\s+/g, ' '),
            b: b.outerHTML.slice(0, 110).replace(/\s+/g, ' '),
            area: Math.round(ow * oh),
          });
          if (out.length >= 20) return out;
        }
      }
    }
    return out;
  }, OVERLAY_SELECTORS);

  // ---------- 3. Focus ring regressions ----------
  // The app now defines a :where(button, [role=button], a[href]):focus-visible
  // outline fallback in index.css. We verify the rule is actually applied by
  // temporarily adding a .__sweep-focus-probe class to each element that
  // forces-focus via JS, reading its outlineStyle on :focus, then cleaning up.
  const focusRingIssues = await page.evaluate(() => {
    const btns = Array.from(
      document.querySelectorAll<HTMLElement>('button, [role="button"], a[href]')
    );
    const out: any[] = [];
    for (const el of btns) {
      const cls = (el.className || '').toString();
      // Fast path: explicit focus utility classes → trust them.
      if (
        typeof cls === 'string' &&
        (/\bfocus(-visible)?:/.test(cls) ||
          /\bring-/.test(cls) ||
          /\boutline-(?!none\b)/.test(cls))
      ) {
        continue;
      }
      // Probe the keyboard-focus style by dispatching a focus event that
      // matches :focus-visible heuristics (many browsers apply
      // :focus-visible on programmatic focus via keyboard events too).
      try {
        el.focus({ preventScroll: true });
        const focused = window.getComputedStyle(el);
        const hasRing =
          focused.outlineStyle !== 'none' ||
          focused.boxShadow !== 'none' ||
          parseFloat(focused.outlineWidth) > 0;
        el.blur();
        if (!hasRing) {
          out.push({ outer: el.outerHTML.slice(0, 140).replace(/\s+/g, ' ') });
        }
      } catch { /* ignore */ }
    }
    return out.slice(0, 10);
  });

  page.off('pageerror', onErr);
  page.off('console', onConsole);

  const filteredErrors = consoleErrors.filter(
    (msg) => !NOISE_PATTERNS.some((re) => re.test(msg))
  );

  return {
    route,
    load_ok: loadOk,
    console_errors: filteredErrors.slice(0, 10),
    unlabeled_buttons: unlabeled,
    overlaps,
    focus_ring_issues: focusRingIssues,
  };
}

test.describe('Global Vibez Design Sweep', () => {
  test('sweeps representative routes', async ({ page }) => {
    test.setTimeout(420_000); // 7 minutes for full sweep
    await demoLogin(page);

    const report: {
      ran_at: string;
      base_url: string;
      routes: RouteResult[];
      totals: {
        unlabeled_buttons: number;
        overlaps: number;
        focus_ring_issues: number;
        pages_with_console_errors: number;
      };
    } = {
      ran_at: new Date().toISOString(),
      base_url: (test.info().project.use.baseURL as string) || 'unknown',
      routes: [],
      totals: {
        unlabeled_buttons: 0,
        overlaps: 0,
        focus_ring_issues: 0,
        pages_with_console_errors: 0,
      },
    };

    for (const route of ROUTES) {
      // eslint-disable-next-line no-console
      console.log(`[design-sweep] auditing ${route}`);
      const r = await analyzeRoute(page, route);
      report.routes.push(r);
      report.totals.unlabeled_buttons += r.unlabeled_buttons.length;
      report.totals.overlaps += r.overlaps.length;
      report.totals.focus_ring_issues += r.focus_ring_issues.length;
      if (r.console_errors.length > 0) report.totals.pages_with_console_errors += 1;
    }

    const dir = path.dirname(REPORT_PATH);
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch { /* ignore */ }
    fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));

    // eslint-disable-next-line no-console
    console.log('\n========= DESIGN SWEEP =========');
    // eslint-disable-next-line no-console
    console.log(`Routes: ${report.routes.length}`);
    // eslint-disable-next-line no-console
    console.log(`Unlabeled interactive elements: ${report.totals.unlabeled_buttons}`);
    // eslint-disable-next-line no-console
    console.log(`Intrusive overlaps: ${report.totals.overlaps}`);
    // eslint-disable-next-line no-console
    console.log(`Focus-ring gaps: ${report.totals.focus_ring_issues}`);
    // eslint-disable-next-line no-console
    console.log(`Routes with console errors: ${report.totals.pages_with_console_errors}`);
    // eslint-disable-next-line no-console
    console.log(`Report: ${REPORT_PATH}`);
    // eslint-disable-next-line no-console
    console.log('=================================\n');

    // Expect all routes to at least LOAD. We don't assert zero findings
    // because the sweep is intended to surface work, not to break CI on
    // regressions. Enforce zero unlabeled after fixes land.
    expect(report.routes.every((r) => r.load_ok)).toBe(true);
  });
});
