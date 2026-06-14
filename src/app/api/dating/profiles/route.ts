import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth/session";
import { SAMPLE_PROFILES } from "@/lib/dating/profiles";

export async function GET() {
  const user = await getSessionFromCookies();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ profiles: SAMPLE_PROFILES });
}
