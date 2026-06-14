import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth/session";

export async function POST(request: NextRequest) {
  const user = await getSessionFromCookies();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const profileId = body?.profileId;

  if (!profileId || typeof profileId !== "string") {
    return NextResponse.json({ error: "profileId is required" }, { status: 400 });
  }

  const isMatch = Math.random() > 0.7;

  return NextResponse.json({
    liked: true,
    profileId,
    match: isMatch,
    message: isMatch ? "It's a match!" : "Like sent",
  });
}
