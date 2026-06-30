import { NextRequest, NextResponse } from "next/server";

import { getSession } from "@/lib/auth";
import { getLogisticsEvents } from "@/lib/ops/logistics-audit";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const limitRaw = request.nextUrl.searchParams.get("limit");
  const limit = Number(limitRaw ?? "25");

  return NextResponse.json({
    events: getLogisticsEvents(limit),
  });
}
