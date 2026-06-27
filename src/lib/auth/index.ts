import { SignJWT, jwtVerify } from "jose";

export const AUTH_COOKIE_NAME = "dating-auth-token";
export const AUTH_MESSAGE_PREFIX = "Sign in to SolDate";
export const NONCE_TTL_MS = 5 * 60 * 1000;
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

export interface SessionPayload {
  publicKey: string;
  hasChair: boolean;
}

export class JwtConfigurationError extends Error {
  constructor() {
    super("JWT_SECRET is not configured");
    this.name = "JwtConfigurationError";
  }
}

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new JwtConfigurationError();
  }
  return new TextEncoder().encode(secret);
}

export async function createSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({
    publicKey: payload.publicKey,
    hasChair: payload.hasChair,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getJwtSecret());
}

export async function verifySession(
  token: string
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    if (typeof payload.publicKey !== "string") {
      return null;
    }
    return {
      publicKey: payload.publicKey,
      hasChair: payload.hasChair === true,
    };
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionPayload | null> {
  // Imported dynamically so this module stays usable from the Edge proxy,
  // which cannot statically import `next/headers`.
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    return null;
  }
  return verifySession(token);
}

export interface SessionCookie {
  name: string;
  value: string;
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax";
  path: string;
  maxAge: number;
}

export function sessionCookieOptions(token: string): SessionCookie {
  return {
    name: AUTH_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  };
}

export function clearSessionCookieOptions(): SessionCookie {
  return {
    name: AUTH_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  };
}

const nonceStore = new Map<string, { nonce: string; expiresAt: number }>();

export function createNonce(publicKey: string): string {
  const nonce = crypto.randomUUID();
  nonceStore.set(publicKey, { nonce, expiresAt: Date.now() + NONCE_TTL_MS });
  return nonce;
}

export function consumeNonce(publicKey: string, nonce: string): boolean {
  const entry = nonceStore.get(publicKey);
  if (!entry) {
    return false;
  }
  nonceStore.delete(publicKey);
  return entry.nonce === nonce && Date.now() <= entry.expiresAt;
}
