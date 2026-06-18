import { NextResponse } from "next/server";

import { createSession, sessionCookieOptions } from "@/lib/auth";

/**
 * Demo login endpoint — only active when DEMO_LOGIN_ENABLED=true.
 * Set this env var (and NEXT_PUBLIC_DEMO_LOGIN_ENABLED=true for the UI button)
 * in .env.local when you need to test protected routes without a real Solana wallet.
 * Never set DEMO_LOGIN_ENABLED in production.
 */
const DEMO_PUBLIC_KEY = "Demo11111111111111111111111111111111111111111";

export async function POST() {
  if (process.env.DEMO_LOGIN_ENABLED !== "true") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const token = await createSession({
    publicKey: DEMO_PUBLIC_KEY,
    hasChair: false,
  });

  const response = NextResponse.json({
    publicKey: DEMO_PUBLIC_KEY,
    demo: true,
  });
  response.cookies.set(sessionCookieOptions(token));
  return response;
}
