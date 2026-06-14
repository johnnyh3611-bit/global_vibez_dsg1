import { verifySignature } from '@/lib/solana/verifySignature';

export const verifySession = async (message: string, signature: string, publicKey: string) => {
  const isValid = await verifySignature(message, signature, publicKey);
  return { valid: isValid };
};

// Return a string token to satisfy the cookie requirements
export const createSession = async (data: any): Promise<string> => {
  return "session-token-placeholder";
};

export const getSessionFromCookies = async () => ({ user: { id: 'verified-wallet' } });
export const sessionCookieOptions = { name: 'session', maxAge: 3600 };
