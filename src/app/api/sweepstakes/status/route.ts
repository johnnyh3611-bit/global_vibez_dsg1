import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth";
import { walletHasChair } from "@/lib/dealer/chairs";
import { getCurrentWeekStatus } from "@/lib/sweepstakes/weekly";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!walletHasChair(session.publicKey)) {
    return NextResponse.json({ error: "Chair holder access required" }, { status: 403 });
  }

  return NextResponse.json(getCurrentWeekStatus(session.publicKey));
}
