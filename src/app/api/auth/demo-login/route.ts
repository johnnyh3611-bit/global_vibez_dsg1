import { NextResponse } from "next/server";
import { createSession, sessionCookieOptions } from "@/lib/auth/session";

export async function POST() {
  const demoPublicKey = "DemoUser123456789012345678901234567890";

  try {
    const token = await createSession(demoPublicKey);
    const response = NextResponse.json({ publicKey: demoPublicKey });
    response.cookies.set(sessionCookieOptions.name, typeof token === 'string' ? token : JSON.stringify(token), { maxAge: sessionCookieOptions.maxAge });

    return response;
  } catch (error) {
    return NextResponse.json(
      { error: "Demo login failed" },
      { status: 500 }
    );
  }
}
