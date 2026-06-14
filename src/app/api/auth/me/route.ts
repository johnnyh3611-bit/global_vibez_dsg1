import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth/session";

export async function GET() {
  const user = await getSessionFromCookies();

  if (!user) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  return NextResponse.json({
    authenticated: true,
    publicKey: user.publicKey,
    hasChair: user.hasChair,
  });
}
