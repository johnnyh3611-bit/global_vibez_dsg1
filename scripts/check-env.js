#!/usr/bin/env node
// Validates that required environment variables are set before deploy.
// Add variable names to REQUIRED to enforce them in CI / verify:full.

const REQUIRED = [
  'JWT_SECRET',
];

const OPTIONAL = [
  'NEXT_PUBLIC_SITE_URL',
  'CHAIR_HOLDER_WALLETS',
  'AI_PROVIDER',
  'OPENAI_API_KEY',
  'OPENAI_MODEL',
  'OLLAMA_BASE_URL',
  'OLLAMA_MODEL',
  'TV_VIDEO_PROVIDER',
  'TV_VIDEO_API_KEY',
  'LOGISTICS_SERVICE_ENDPOINT',
  'REDIS_URL',
  'DATABASE_URL',
];

let missing = [];
for (const key of REQUIRED) {
  if (!process.env[key]) missing.push(key);
}

if (missing.length > 0) {
  console.error('ERROR: Missing required environment variables:');
  for (const key of missing) console.error(`  - ${key}`);
  process.exit(1);
}

const unset = OPTIONAL.filter((k) => !process.env[k]);
if (unset.length > 0) {
  console.warn('WARN: Optional variables not set (features may be degraded):');
  for (const key of unset) console.warn(`  - ${key}`);
}

console.log('ENV CHECK PASSED');
