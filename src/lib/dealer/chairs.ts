import fs from "fs";
import { fileURLToPath } from "url";

const DEFAULT_HOLDERS_FILE = fileURLToPath(
  new URL("../../../data/chair-holders.txt", import.meta.url)
);

let cachedHolders: Set<string> | null = null;
let cachedMtime: number | null = null;

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
  if (!fs.existsSync(DEFAULT_HOLDERS_FILE)) return [];
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
