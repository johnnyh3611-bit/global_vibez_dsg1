#!/usr/bin/env node
// Validates environment before deploy / local open.
// Prefer web-assets vars; legacy Next.js names are optional warnings only.

const REQUIRED_BACKEND = ["JWT_SECRET", "MONGO_URL", "DB_NAME"];
const REQUIRED_FRONTEND_BUILD = ["REACT_APP_BACKEND_URL"];

const mode = process.argv[2] || "all";

let missing = [];
const check = (keys) => {
  for (const key of keys) {
    if (process.env[key] === undefined) missing.push(key);
  }
};

if (mode === "backend" || mode === "all") check(REQUIRED_BACKEND);
if (mode === "frontend" || mode === "all") check(REQUIRED_FRONTEND_BUILD);

if (missing.length > 0) {
  console.error("ERROR: Missing required environment variables:");
  for (const key of missing) console.error(`  - ${key}`);
  console.error(
    "Note: REACT_APP_BACKEND_URL may be an empty string, but the key must exist at CRA build time.",
  );
  process.exit(1);
}

console.log("ENV CHECK PASSED");
