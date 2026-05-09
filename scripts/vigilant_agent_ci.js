/**
 * Vigilant Agent — CI / Post-Deploy Wrapper
 * (extends `vigilant_agent.js` per founder request, 2026-02-09).
 *
 * What's different from the bare vigilant_agent.js
 * ────────────────────────────────────────────────
 * 1. Compares the current run against a stored baseline so deploys
 *    that REGRESS (more collisions, new duplicate testids, route
 *    nav errors) fail loudly instead of being one screenshot among
 *    many.
 * 2. Optional webhook poster — set SLACK_WEBHOOK_URL or
 *    DISCORD_WEBHOOK_URL env var and the report is auto-posted to
 *    your channel. Runs silently when the env vars are absent so
 *    you can use the script locally without configuring anything.
 * 3. Writes a markdown summary at
 *    /app/scripts/vigilant_agent_reports/SUMMARY.md
 *    that's easy to paste into a PR / Slack thread.
 * 4. Exit code: 0 on PASS, 1 on REGRESSION — so CI can gate.
 *
 * Usage
 * ─────
 *   # Set or refresh the baseline (after a known-good deploy):
 *   node /app/scripts/vigilant_agent_ci.js --baseline https://globalvibezdsg.com
 *
 *   # Compare a deploy against the baseline:
 *   node /app/scripts/vigilant_agent_ci.js --check https://globalvibezdsg.com
 *
 *   # Compare with auto-Slack post:
 *   SLACK_WEBHOOK_URL=https://hooks.slack.com/services/T.../B.../...
 *   node /app/scripts/vigilant_agent_ci.js --check https://globalvibezdsg.com
 *
 *   # Discord works the same way:
 *   DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/.../...
 *   node /app/scripts/vigilant_agent_ci.js --check https://globalvibezdsg.com
 */
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const https = require("https");

const OUT_DIR = "/app/scripts/vigilant_agent_reports";
const REPORT_FILE = path.join(OUT_DIR, "report.json");
const BASELINE_FILE = path.join(OUT_DIR, "baseline.json");
const SUMMARY_MD = path.join(OUT_DIR, "SUMMARY.md");

const args = process.argv.slice(2);
let mode = null;
let url = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--baseline") mode = "baseline";
  else if (args[i] === "--check") mode = "check";
  else if (!url && args[i].startsWith("http")) url = args[i];
}
if (!mode || !url) {
  console.error("Usage:");
  console.error("  node vigilant_agent_ci.js --baseline <url>   # save current run as baseline");
  console.error("  node vigilant_agent_ci.js --check    <url>   # compare to baseline");
  process.exit(2);
}

// ── 1. Run the bare scanner ─────────────────────────────────────
console.log(`▶ ${mode === "baseline" ? "BASELINE" : "CHECK"} run against ${url}`);
const run = spawnSync(
  "node",
  ["/app/scripts/vigilant_agent.js", url],
  { stdio: "inherit", cwd: "/app/frontend" },
);
if (run.status !== 0) {
  console.error("❌ vigilant_agent.js itself exited non-zero");
  process.exit(run.status || 1);
}

const report = JSON.parse(fs.readFileSync(REPORT_FILE, "utf8"));

// ── 2. Baseline mode: just save and exit ────────────────────────
if (mode === "baseline") {
  fs.writeFileSync(BASELINE_FILE, JSON.stringify(report, null, 2));
  const md = renderMarkdown(report, null, "baseline");
  fs.writeFileSync(SUMMARY_MD, md);
  console.log(`\n📌 Baseline saved → ${BASELINE_FILE}`);
  postWebhook(md, /* failed */ false).then(() => process.exit(0));
  return;
}

// ── 3. Check mode: diff against baseline ────────────────────────
if (!fs.existsSync(BASELINE_FILE)) {
  console.warn("⚠️  No baseline found — saving this run as the baseline.");
  fs.writeFileSync(BASELINE_FILE, JSON.stringify(report, null, 2));
  const md = renderMarkdown(report, null, "baseline");
  fs.writeFileSync(SUMMARY_MD, md);
  postWebhook(md, false).then(() => process.exit(0));
  return;
}

const baseline = JSON.parse(fs.readFileSync(BASELINE_FILE, "utf8"));
const diff = diffReports(baseline, report);
const md = renderMarkdown(report, diff, "check");
fs.writeFileSync(SUMMARY_MD, md);
console.log(md);

const failed = diff.regressed_devices.length > 0;
postWebhook(md, failed).then(() => process.exit(failed ? 1 : 0));

// ── helpers ──────────────────────────────────────────────────────

function diffReports(base, curr) {
  const out = { regressed_devices: [], improved_devices: [], unchanged_devices: [] };
  for (const c of curr.devices) {
    const b = base.devices.find((d) => d.name === c.name);
    if (!b) {
      out.regressed_devices.push({ name: c.name, reason: "NEW DEVICE — no baseline" });
      continue;
    }
    if (c.nav_error && !b.nav_error) {
      out.regressed_devices.push({ name: c.name, reason: `NAV ERROR appeared: ${c.nav_error}` });
      continue;
    }
    const bColl = b.collisions.length;
    const cColl = c.collisions.length;
    const bDupe = b.duplicate_testids.length;
    const cDupe = c.duplicate_testids.length;
    if (cDupe > bDupe) {
      out.regressed_devices.push({ name: c.name, reason: `Duplicate testids ${bDupe} → ${cDupe}` });
    } else if (cColl > bColl + 5) {
      // 5-collision tolerance band — animations, glow blobs etc. drift.
      out.regressed_devices.push({
        name: c.name,
        reason: `Collisions ${bColl} → ${cColl} (>+5 tolerance)`,
      });
    } else if (cColl < bColl) {
      out.improved_devices.push({ name: c.name, reason: `Collisions ${bColl} → ${cColl}` });
    } else {
      out.unchanged_devices.push({ name: c.name });
    }
  }
  return out;
}

function renderMarkdown(report, diff, runMode) {
  const verdict = diff
    ? diff.regressed_devices.length === 0
      ? "✅ PASS"
      : "❌ REGRESSED"
    : "📌 BASELINE SET";
  const lines = [
    `# Vigilant Agent — ${verdict}`,
    "",
    `- **URL:** ${report.url}`,
    `- **Mode:** ${runMode}`,
    `- **Started:** ${report.started_at}`,
    `- **Finished:** ${report.finished_at}`,
    "",
    "| Device | Collisions | Duplicate testids | Nav |",
    "| --- | --- | --- | --- |",
  ];
  for (const d of report.devices) {
    lines.push(
      `| ${d.name} | ${d.collisions.length} | ${d.duplicate_testids.length} | ${d.nav_error ? "❌ " + d.nav_error.slice(0, 40) : "✅"} |`,
    );
  }
  if (diff) {
    lines.push("", "## Diff vs baseline");
    if (diff.regressed_devices.length) {
      lines.push("### ❌ Regressions");
      for (const r of diff.regressed_devices) lines.push(`- ${r.name}: ${r.reason}`);
    }
    if (diff.improved_devices.length) {
      lines.push("### ✅ Improvements");
      for (const r of diff.improved_devices) lines.push(`- ${r.name}: ${r.reason}`);
    }
    if (diff.unchanged_devices.length) {
      lines.push(`### ➖ Unchanged: ${diff.unchanged_devices.map((d) => d.name).join(", ")}`);
    }
  }
  if (report.devices.some((d) => d.duplicate_testids.length > 0)) {
    lines.push("", "## Duplicate testids");
    for (const d of report.devices) {
      for (const dup of d.duplicate_testids) {
        lines.push(`- [${d.name}] \`${dup.testid}\` × ${dup.count}`);
      }
    }
  }
  return lines.join("\n");
}

async function postWebhook(md, failed) {
  const slack = process.env.SLACK_WEBHOOK_URL;
  const discord = process.env.DISCORD_WEBHOOK_URL;
  if (!slack && !discord) return;

  const title = failed ? "❌ Vigilant Agent: REGRESSION DETECTED" : "✅ Vigilant Agent: PASS";
  const text = `*${title}*\n\n\`\`\`\n${md.slice(0, 3500)}\n\`\`\``;

  const tasks = [];
  if (slack) tasks.push(post(slack, JSON.stringify({ text })));
  if (discord)
    tasks.push(
      post(discord, JSON.stringify({ content: text.replace(/```/g, "```").slice(0, 1990) })),
    );
  await Promise.all(tasks);
}

function post(urlStr, body) {
  return new Promise((resolve) => {
    try {
      const u = new URL(urlStr);
      const req = https.request(
        {
          method: "POST",
          hostname: u.hostname,
          path: u.pathname + u.search,
          port: u.port || 443,
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(body),
          },
        },
        (res) => {
          res.on("data", () => {});
          res.on("end", resolve);
        },
      );
      req.on("error", () => resolve());
      req.write(body);
      req.end();
    } catch {
      resolve();
    }
  });
}
