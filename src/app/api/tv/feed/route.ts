import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { broadcastFeed } from "@/lib/tv/broadcast-feed";
import {
  generateBroadcast,
  refreshBroadcast,
  hasPendingClips,
} from "@/lib/tv/broadcast";
import { getVideoProvider } from "@/lib/tv/video-provider";

/**
 * Live TV feed.
 *
 * GET  -> the current broadcast feed. If empty and the active provider is the
 *         zero-cost mock, lazily seed a cycle so /tv is never blank. Any clips
 *         still rendering (async providers like Luma) are polled and updated.
 * POST -> force a new broadcast cycle (session-gated, since real providers
 *         incur cost). Returns the freshly published items.
 */
export async function GET() {
  if (broadcastFeed.isEmpty() && getVideoProvider().name === "mock") {
    await generateBroadcast({ seedIfEmpty: true });
  } else if (hasPendingClips()) {
    await refreshBroadcast();
  }
  return NextResponse.json({ items: broadcastFeed.list() });
}

export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const published = await generateBroadcast({ seedIfEmpty: true });
    return NextResponse.json({ published, items: broadcastFeed.list() });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Broadcast failed",
      },
      { status: 502 }
    );
  }
}
