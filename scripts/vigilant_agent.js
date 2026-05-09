/**
 * Vigilant Agent — Multi-Device UI Integrity Scanner
 * (per Multi_Device_Vigilant_Agent.pdf + Vigilant_Agent_Code_Report.pdf, May 2026).
 *
 * What it does
 * ────────────
 * 1. Boots Chromium with three device profiles:
 *    • Desktop 4K (3840 × 2160)
 *    • iPhone 15 Pro
 *    • iPad Pro 11
 * 2. Navigates to the target URL on each profile.
 * 3. Performs a square-by-square DOM collision scan to surface
 *    "intertwined" elements — overlapping bounding boxes that aren't
 *    parent/child. These are the layout regressions that cause
 *    clipped tooltips, double step-boards, or unreadable voice
 *    controls reported in the PDF.
 * 4. Captures a full-page screenshot per device:
 *    /app/scripts/vigilant_agent_reports/scan_<DeviceName>.png
 * 5. Writes a single JSON report:
 *    /app/scripts/vigilant_agent_reports/report.json
 *
 * Usage
 * ─────
 *   cd /app/frontend
 *   node /app/scripts/vigilant_agent.js                     # scans the preview URL
 *   node /app/scripts/vigilant_agent.js https://my-app.com  # scans a custom URL
 *
 * Designed to be run pre-deploy. Exit code 0 always — the report is
 * advisory; deploy gating is left to the regression shield.
 */
const fs = require("fs");
const path = require("path");
const { chromium, devices } = require("playwright");

// Default to the preview URL from /app/frontend/.env so a no-arg run
// scans whatever the current dev environment is pointing at.
function defaultUrl() {
  try {
    const env = fs.readFileSync("/app/frontend/.env", "utf8");
    const m = env.match(/REACT_APP_BACKEND_URL\s*=\s*(\S+)/);
    return m ? m[1] : "http://localhost:3000";
  } catch {
    return "http://localhost:3000";
  }
}

const TARGET = process.argv[2] || defaultUrl();
const OUT_DIR = "/app/scripts/vigilant_agent_reports";
fs.mkdirSync(OUT_DIR, { recursive: true });

const VIEWPORTS = [
  { name: "Desktop_4K",    viewport: { width: 3840, height: 2160 }, deviceScaleFactor: 1 },
  { name: "iPhone_Mobile", ...devices["iPhone 15 Pro"] },
  { name: "iPad_Tablet",   ...devices["iPad Pro 11"] },
];

const COLLISION_SCRIPT = () => {
  // Walk every visible element. For each, compare bounding boxes
  // against every later sibling in the DOM and report overlaps that
  // aren't parent/child. Cap the report at 25 to keep output sane.
  const all = Array.from(document.querySelectorAll("*"));
  const rects = all.map((el) => el.getBoundingClientRect());
  const visible = (r) =>
    r.width > 0 && r.height > 0 && r.right > 0 && r.bottom > 0;
  const collisions = [];
  for (let i = 0; i < all.length; i++) {
    if (!visible(rects[i])) continue;
    for (let j = i + 1; j < all.length; j++) {
      if (!visible(rects[j])) continue;
      const a = rects[i], b = rects[j];
      const intertwined = !(
        a.right < b.left ||
        a.left > b.right ||
        a.bottom < b.top ||
        a.top > b.bottom
      );
      if (!intertwined) continue;
      if (all[i].contains(all[j]) || all[j].contains(all[i])) continue;

      // Filter false positives — siblings that simply share the same
      // row deliberately overlap by a few pixels in flex layouts.
      const overlapW = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const overlapH = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      const overlapArea = overlapW * overlapH;
      const minArea = Math.min(a.width * a.height, b.width * b.height);
      if (minArea === 0) continue;
      const overlapRatio = overlapArea / minArea;
      // Only report SIGNIFICANT overlaps (>20% of the smaller element).
      if (overlapRatio < 0.2) continue;

      const tagA = all[i].tagName + (all[i].id ? `#${all[i].id}` : "");
      const tagB = all[j].tagName + (all[j].id ? `#${all[j].id}` : "");
      collisions.push({
        a: tagA,
        b: tagB,
        overlap_pct: Math.round(overlapRatio * 100),
        a_testid: all[i].getAttribute("data-testid") || null,
        b_testid: all[j].getAttribute("data-testid") || null,
      });
      if (collisions.length >= 25) return collisions;
    }
  }
  return collisions;
};

// Detect duplicate "step boards" — multiple elements with the same
// data-testid that the PDF specifically warns about.
const DUPLICATE_TESTID_SCRIPT = () => {
  const seen = {};
  document.querySelectorAll("[data-testid]").forEach((el) => {
    const tid = el.getAttribute("data-testid");
    seen[tid] = (seen[tid] || 0) + 1;
  });
  return Object.entries(seen)
    .filter(([, n]) => n > 1)
    .map(([tid, n]) => ({ testid: tid, count: n }));
};

(async () => {
  console.log(`🔍 Vigilant Agent scanning ${TARGET}`);
  const browser = await chromium.launch();
  const report = { url: TARGET, started_at: new Date().toISOString(), devices: [] };

  for (const dev of VIEWPORTS) {
    console.log(`\n  ▶ Profile: ${dev.name}`);
    const context = await browser.newContext({
      viewport: dev.viewport,
      userAgent: dev.userAgent,
      deviceScaleFactor: dev.deviceScaleFactor || 1,
      isMobile: dev.isMobile || false,
      hasTouch: dev.hasTouch || false,
    });
    const page = await context.newPage();
    let collisions = [];
    let dupes = [];
    let nav_error = null;
    try {
      await page.goto(TARGET, { waitUntil: "domcontentloaded", timeout: 30000 });
      // Let lazy-loaded images / framer-motion settle before scanning.
      await page.waitForTimeout(2500);

      collisions = await page.evaluate(COLLISION_SCRIPT);
      dupes = await page.evaluate(DUPLICATE_TESTID_SCRIPT);

      const shotPath = path.join(OUT_DIR, `scan_${dev.name}.png`);
      await page.screenshot({ path: shotPath, fullPage: true });
      console.log(`    ✓ screenshot → ${shotPath}`);
      console.log(`    ✓ collisions: ${collisions.length} (significant >20% overlap)`);
      console.log(`    ✓ duplicate testids: ${dupes.length}`);
    } catch (e) {
      nav_error = String(e);
      console.log(`    ✗ nav error: ${nav_error}`);
    }
    report.devices.push({
      name: dev.name,
      viewport: dev.viewport,
      collisions,
      duplicate_testids: dupes,
      nav_error,
    });
    await context.close();
  }

  await browser.close();
  report.finished_at = new Date().toISOString();
  fs.writeFileSync(path.join(OUT_DIR, "report.json"), JSON.stringify(report, null, 2));
  console.log(`\n📄 Report written → ${path.join(OUT_DIR, "report.json")}`);

  // Stdout summary table.
  console.log("\n══════ VIGILANT AGENT SUMMARY ══════");
  for (const d of report.devices) {
    if (d.nav_error) {
      console.log(`  ${d.name.padEnd(16)}  NAV ERROR (${d.nav_error.slice(0, 80)})`);
      continue;
    }
    console.log(
      `  ${d.name.padEnd(16)}  ${String(d.collisions.length).padStart(3)} collisions   ${String(d.duplicate_testids.length).padStart(2)} dupe testids`,
    );
  }
  console.log("════════════════════════════════════\n");
})();
