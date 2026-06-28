import fs from "fs";
import path from "path";

const DEFAULT_HOLDERS_FILE = path.join(process.cwd(), "data", "chair-holders.txt");

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
  if (!fs.existsSync(DEFAULT_HOLDERS_FILE)) {
    if (!warnedMissingHoldersFile) {
      console.warn(
        `Chair holders file not found at ${DEFAULT_HOLDERS_FILE}; continuing with environment-configured holders only.`
      );
      warnedMissingHoldersFile = true;
    }
    return [];
  }

  return parseWalletLines(fs.readFileSync(DEFAULT_HOLDERS_FILE, "utf-8"));
}

function buildChairHolderSet(): Set<string> {
  const holders = new Set<string>();

  for (const wallet of loadEnvWallets()) {
    holders.add(wallet);
  }

  for (const wallet of loadFileWallets()) {
    holders.add(wallet);
  }

  return holders;
}

export function getChairHolders(): Set<string> {
  const mtime = fs.existsSync(DEFAULT_HOLDERS_FILE)
    ? fs.statSync(DEFAULT_HOLDERS_FILE).mtimeMs
    : null;

  if (cachedHolders && cachedMtime === mtime) {
    return cachedHolders;
  }

  cachedHolders = buildChairHolderSet();
  cachedMtime = mtime;
  return cachedHolders;
}

export function getChairHolderCount(): number {
  return getChairHolders().size;
}

export function walletHasChair(publicKey: string): boolean {
  return getChairHolders().has(publicKey);
}

/** Call after updating data/chair-holders.txt to pick up changes immediately. */
export function reloadChairHolders(): void {
  cachedHolders = null;
  cachedMtime = null;
}
