import { NONCE_TTL_MS } from "./constants";

interface NonceEntry {
  nonce: string;
  expiresAt: number;
}

const store = new Map<string, NonceEntry>();

export function createNonce(publicKey: string): string {
  const nonce = crypto.randomUUID();
  store.set(publicKey, {
    nonce,
    expiresAt: Date.now() + NONCE_TTL_MS,
  });
  return nonce;
}

export function consumeNonce(publicKey: string, nonce: string): boolean {
  const entry = store.get(publicKey);
  if (!entry) return false;
  store.delete(publicKey);

  if (Date.now() > entry.expiresAt) return false;
  return entry.nonce === nonce;
}
