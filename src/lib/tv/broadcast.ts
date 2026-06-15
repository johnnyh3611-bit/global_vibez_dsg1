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
