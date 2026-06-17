#!/usr/bin/env node
/**
 * ts-debt — ranks the TypeScript migration backlog.
 *
 * Lists all files carrying `// @ts-nocheck`, temporarily strips the pragma,
 * runs `tsc --noEmit` to count real errors per file, then restores the pragma.
 * Highest-impact files (most hidden errors) appear at the top of the report.
 *
 * Usage:  yarn ts-debt           (prints top 30 to stdout)
 *         yarn ts-debt --all     (prints every file)
 *         yarn ts-debt --json    (machine-readable output)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', 'src');
const NOCHECK = '// @ts-nocheck';

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

function hasNoCheck(file) {
  const first = fs.readFileSync(file, 'utf8').split('\n', 1)[0];
  return first.trim() === NOCHECK;
}

function countErrors(tscOutput, file) {
  const rel = path.relative(path.resolve(__dirname, '..'), file);
  return tscOutput.split('\n').filter((l) => l.startsWith(rel + '(')).length;
}

function main() {
  const args = process.argv.slice(2);
  const showAll = args.includes('--all');
  const asJson = args.includes('--json');

  console.error('Scanning TSX/TS files for // @ts-nocheck …');
  const staged = walk(ROOT).filter(hasNoCheck);
  console.error(`Found ${staged.length} staged files.`);

  // Strip nocheck pragmas
  const originals = new Map();
  for (const f of staged) {
    const content = fs.readFileSync(f, 'utf8');
    originals.set(f, content);
    const stripped = content
      .replace(new RegExp(`^${NOCHECK}\\s*\\n?\\n?`, 'm'), '')
      .replace(/^\n/, '');
    fs.writeFileSync(f, stripped);
  }

  let tscOut = '';
  try {
    execSync('npx tsc --noEmit', {
      cwd: path.resolve(__dirname, '..'),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (err) {
    tscOut = (err.stdout || Buffer.alloc(0)).toString();
  }

  // Restore originals
  for (const [f, content] of originals) fs.writeFileSync(f, content);

  const counts = staged
    .map((f) => ({ file: path.relative(path.resolve(__dirname, '..'), f), errors: countErrors(tscOut, f) }))
    .filter((x) => x.errors > 0)
    .sort((a, b) => b.errors - a.errors);

  const total = counts.reduce((s, x) => s + x.errors, 0);

  if (asJson) {
    process.stdout.write(JSON.stringify({ total_staged: staged.length, total_hidden_errors: total, files: counts }, null, 2));
    return;
  }

  const top = showAll ? counts : counts.slice(0, 30);
  console.log('\n=== TS-DEBT REPORT ===');
  console.log(`Staged (@ts-nocheck) files : ${staged.length}`);
  console.log(`Hidden TS errors            : ${total}`);
  console.log(`Files with errors           : ${counts.length}`);
  console.log(`Showing                     : top ${top.length}${showAll ? ' (all)' : ''}`);
  console.log('');
  console.log('Rank | Errors | File');
  console.log('-----|--------|---------------------------------------------');
  top.forEach((x, i) => {
    console.log(`${String(i + 1).padStart(4)} | ${String(x.errors).padStart(6)} | ${x.file}`);
  });
  console.log('');
  console.log('Tip: attack the top file first. Remove its `// @ts-nocheck`, fix the errors, rerun this script.');
}

main();
