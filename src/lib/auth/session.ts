import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { walletHasChair } from "@/lib/dealer/chairs";
import { AUTH_COOKIE_NAME, SESSION_TTL } from "./constants";

export interface SessionUser {
  publicKey: string;
  hasChair: boolean;
}

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET environment variable is not set");
  }
  return new TextEncoder().encode(secret);
}

export async function createSession(publicKey: string): Promise<string> {
  return new SignJWT({ publicKey })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(SESSION_TTL)
    .sign(getSecret());
}

export async function verifySession(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    const publicKey = payload.publicKey;
    if (typeof publicKey !== "string") return null;
    return { publicKey, hasChair: walletHasChair(publicKey) };
  } catch {
    return null;
  }
}

export async function getSessionFromCookies(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySession(token);
}

export function sessionCookieOptions(token: string) {
  return {
    name: AUTH_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  };
}
