import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { mainBrain } from "@/lib/ai/main-brain";
import { runGameIntegrityHarness } from "@/lib/testing/game-harness";

/**
 * Game-integrity dashboard.
 *
 * GET  -> read the latest aggregated harness report per room.
 * POST -> run the harness across every room (one-by-one) and aggregate the
 *         status reports into the MainBrain, then return the full run.
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ reports: mainBrain.getHarnessReports() });
}

export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const run = runGameIntegrityHarness();
  return NextResponse.json(run);
}
