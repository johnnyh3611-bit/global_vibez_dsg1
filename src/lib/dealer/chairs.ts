import fs from "fs";
import path from "node:path";

// Keep this runtime-resolved. The over-tracing is managed 
// via outputFileTracing* in next.config.ts.
const DEFAULT_HOLDERS_FILE = path.join(process.cwd(), "data", "chair-holders.txt");

function getHoldersFilePath(): string {
  return process.env.CHAIR_HOLDERS_FILE?.trim() || DEFAULT_HOLDERS_FILE;
}

let cachedHolders: Set<string> | null = null;
let cachedMtime: number | null = null;
let warnedMissingHoldersFile = false;

function parseWalletLines(content: string): string[] {
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
}

function loadEnvWallets(): string[] {
  return (process.env.CHAIR_HOLDER_WALLETS ?? "")
    .split(",")
    .map((wallet) => wallet.trim())
    .filter(Boolean);
}

function loadFileWallets(): string[] {
  const filePath = getHoldersFilePath();
  if (!fs.existsSync(filePath)) {
    if (!warnedMissingHoldersFile) {
      console.warn(`Chair holders file not found at ${filePath}; continuing with environment-configured holders only.`);
      warnedMissingHoldersFile = true;
    }
    return [];
  }
  return parseWalletLines(fs.readFileSync(filePath, "utf-8"));
}

function buildChairHolderSet(): Set<string> {
  const holders = new Set<string>();
  for (const wallet of loadEnvWallets()) { holders.add(wallet); }
  for (const wallet of loadFileWallets()) { holders.add(wallet); }
  return holders;
}

export function getChairHolders(): Set<string> {
  const filePath = getHoldersFilePath();
  const mtime = fs.existsSync(filePath) ? fs.statSync(filePath).mtimeMs : null;
  if (cachedHolders && cachedMtime === mtime) return cachedHolders;
  cachedHolders = buildChairHolderSet();
  cachedMtime = mtime;
  return cachedHolders;
}

export function getChairHolderCount(): number { return getChairHolders().size; }
export function walletHasChair(publicKey: string): boolean { return getChairHolders().has(publicKey); }
export function reloadChairHolders(): void { cachedHolders = null; cachedMtime = null; }