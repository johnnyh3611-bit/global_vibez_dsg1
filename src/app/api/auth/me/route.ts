import { NextResponse } from "next/server";

import { createSession, getSession, sessionCookieOptions } from "@/lib/auth";
import { walletHasChair } from "@/lib/dealer/chairs";

export async function GET() {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const hasChair = walletHasChair(session.publicKey);

  const response = NextResponse.json({
    authenticated: true,
    publicKey: session.publicKey,
    hasChair,
  });

  if (session.hasChair !== hasChair) {
    const refreshedToken = await createSession({
      publicKey: session.publicKey,
      hasChair,
    });
    response.cookies.set(sessionCookieOptions(refreshedToken));
  }

  return response;
}
