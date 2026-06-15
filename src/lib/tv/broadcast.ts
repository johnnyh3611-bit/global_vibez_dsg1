/**
 * Broadcast orchestrator — pulls the current game results + economic metrics
 * from the MainBrain, scripts them, synthesises clips through the configured
 * video provider, and publishes them to the live feed.
 */
import { mainBrain } from "@/lib/ai/main-brain";
import { runGameIntegrityHarness } from "@/lib/testing/game-harness";
import { generateBroadcastScripts } from "./content-engine";
import { getVideoProvider } from "./video-provider";
import { broadcastFeed, type BroadcastItem } from "./broadcast-feed";

/**
 * Generate one broadcast cycle and publish it to the feed.
 *
 * `seedIfEmpty`: when there are no game results yet, run the integrity harness
 * first so highlights have something real to report.
 */
export async function generateBroadcast(
  options: { seedIfEmpty?: boolean } = {}
): Promise<BroadcastItem[]> {
  if (options.seedIfEmpty && mainBrain.getHarnessReports().length === 0) {
    runGameIntegrityHarness();
  }

  const scripts = generateBroadcastScripts({
    context: mainBrain.getGlobalContext(),
    gameResults: mainBrain.getHarnessReports(),
  });

  const provider = getVideoProvider();
  const published: BroadcastItem[] = [];

  for (const script of scripts) {
    const clip = await provider.generateClip(script);
    published.push(broadcastFeed.publish(script, clip));
  }

  return published;
}

/**
 * Poll the active provider for any clips still rendering and update them in
 * place. Async providers (e.g. Luma) return "pending"/"processing" clips that
 * resolve to a playable URL over time; this is what makes the feed go live.
 * Per-item errors are swallowed so one bad poll never breaks the whole feed.
 */
export async function refreshBroadcast(): Promise<BroadcastItem[]> {
  const provider = getVideoProvider();

  for (const item of broadcastFeed.list()) {
    if (item.clip.status === "ready" || item.clip.status === "failed") continue;
    try {
      const updated = await provider.getClip(item.clip.jobId);
      if (updated) {
        broadcastFeed.update(item.script.id, {
          ...updated,
          scriptId: item.script.id,
        });
      }
    } catch {
      // Leave the item as-is; the next poll will retry.
    }
  }

  return broadcastFeed.list();
}

/** True if any feed item is still rendering. */
export function hasPendingClips(): boolean {
  return broadcastFeed
    .list()
    .some(
      (item) =>
        item.clip.status === "pending" || item.clip.status === "processing"
    );
}
