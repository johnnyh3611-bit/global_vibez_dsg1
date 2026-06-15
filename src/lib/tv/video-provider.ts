/**
 * Video synthesis providers.
 *
 * A {@link VideoProvider} takes a {@link VideoScript} and produces a
 * {@link VideoClip} (an async render job that eventually yields a playable
 * URL). The app talks only to this interface, so a real AI video service
 * (Luma Dream Machine, Runway, HeyGen, …) can be slotted in behind it without
 * touching the content engine or the broadcast feed.
 *
 * `getVideoProvider()` selects the implementation from the environment:
 *   TV_VIDEO_PROVIDER = "mock" (default) | "runway" | "luma" | "heygen"
 *   TV_VIDEO_API_KEY  = <key for the chosen real provider>
 *
 * Only the Mock provider is wired today; the real providers throw a clear
 * "pending integration" error until a provider is chosen and a key is supplied.
 */
import type { VideoScript } from "./content-engine";

export type ClipStatus = "pending" | "processing" | "ready" | "failed";

export interface VideoClip {
  jobId: string;
  scriptId: string;
  status: ClipStatus;
  /** Playable URL once `status === "ready"`; null while rendering. */
  url: string | null;
  provider: string;
  error?: string;
}

export interface VideoProvider {
  readonly name: string;
  /** Kick off (or synchronously complete) a render for a script. */
  generateClip(script: VideoScript): Promise<VideoClip>;
  /** Poll a previously started render. Returns null if the job is unknown. */
  getClip(jobId: string): Promise<VideoClip | null>;
}

/**
 * Mock provider — no external service. Marks clips "ready" immediately with no
 * URL, so the UI renders the generated script as a styled poster card. Lets the
 * whole pipeline (engine -> feed -> /tv) run end-to-end with zero credentials
 * and zero cost.
 */
export class MockVideoProvider implements VideoProvider {
  readonly name = "mock";
  private jobs = new Map<string, VideoClip>();

  async generateClip(script: VideoScript): Promise<VideoClip> {
    const clip: VideoClip = {
      jobId: `mock-${script.id}`,
      scriptId: script.id,
      status: "ready",
      url: null,
      provider: this.name,
    };
    this.jobs.set(clip.jobId, clip);
    return clip;
  }

  async getClip(jobId: string): Promise<VideoClip | null> {
    return this.jobs.get(jobId) ?? null;
  }
}

const REAL_PROVIDERS = ["runway", "luma", "heygen"] as const;
type RealProviderName = (typeof REAL_PROVIDERS)[number];

function isRealProvider(name: string): name is RealProviderName {
  return (REAL_PROVIDERS as readonly string[]).includes(name);
}

let cached: VideoProvider | null = null;

/** Resolve the configured video provider (memoised per runtime). */
export function getVideoProvider(): VideoProvider {
  if (cached) return cached;

  const selected = (process.env.TV_VIDEO_PROVIDER ?? "mock").toLowerCase();

  if (selected === "mock") {
    cached = new MockVideoProvider();
    return cached;
  }

  if (isRealProvider(selected)) {
    const apiKey = process.env.TV_VIDEO_API_KEY;
    if (!apiKey) {
      throw new Error(
        `TV_VIDEO_PROVIDER="${selected}" requires TV_VIDEO_API_KEY to be set.`
      );
    }
    // Real providers are async render APIs that must be wired and tested
    // against live credentials before shipping. Until then, fail loudly
    // rather than silently faking output.
    throw new Error(
      `Video provider "${selected}" is not wired yet. Pending integration ` +
        `against live credentials.`
    );
  }

  throw new Error(`Unknown TV_VIDEO_PROVIDER "${selected}".`);
}

/** Test seam: reset the memoised provider (used by tests / after env change). */
export function resetVideoProvider(): void {
  cached = null;
}
