/**
 * Broadcast feed — the live channel of generated content served at /tv.
 *
 * Holds the most recent script+clip pairs in-process (a durable store would
 * back this for production, same caveat as MainBrain). Newest item first.
 */
import type { VideoScript } from "./content-engine";
import type { VideoClip } from "./video-provider";

export interface BroadcastItem {
  script: VideoScript;
  clip: VideoClip;
  publishedAt: string;
}

const MAX_ITEMS = 50;

class BroadcastFeed {
  private items: BroadcastItem[] = [];

  /** Publish (or replace, by script id) an item at the top of the feed. */
  publish(script: VideoScript, clip: VideoClip): BroadcastItem {
    const item: BroadcastItem = {
      script,
      clip,
      publishedAt: new Date().toISOString(),
    };
    this.items = [
      item,
      ...this.items.filter((existing) => existing.script.id !== script.id),
    ].slice(0, MAX_ITEMS);
    return item;
  }

  /** Update an existing item's clip in place (keeps feed position). */
  update(scriptId: string, clip: VideoClip): BroadcastItem | null {
    const index = this.items.findIndex((item) => item.script.id === scriptId);
    if (index === -1) return null;
    const updated: BroadcastItem = { ...this.items[index], clip };
    this.items[index] = updated;
    return updated;
  }

  list(): BroadcastItem[] {
    return [...this.items];
  }

  isEmpty(): boolean {
    return this.items.length === 0;
  }

  clear(): void {
    this.items = [];
  }
}

const globalForFeed = globalThis as unknown as { __broadcastFeed?: BroadcastFeed };
export const broadcastFeed = globalForFeed.__broadcastFeed ?? new BroadcastFeed();
if (!globalForFeed.__broadcastFeed) {
  globalForFeed.__broadcastFeed = broadcastFeed;
}
