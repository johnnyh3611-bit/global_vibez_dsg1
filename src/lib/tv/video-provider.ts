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
 *   TV_VIDEO_PROVIDER = "mock" (default) | "luma" | "runway" | "heygen"
 *   TV_VIDEO_API_KEY  = <key for the chosen real provider>
 *
 * The Mock and Luma (Dream Machine) providers are wired; the remaining real
 * providers throw a clear "pending integration" error until wired.
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

/**
 * Luma Dream Machine provider — text-to-video synthesis.
 *
 * Render jobs are async: {@link generateClip} kicks off a generation and
 * returns immediately (status "pending"/"processing"); callers poll
 * {@link getClip} until it resolves to "ready" (with a playable `url`) or
 * "failed". The broadcast feed refresh loop drives that polling.
 *
 * API: https://api.lumalabs.ai/dream-machine/v1/generations
 */
interface LumaGeneration {
  id: string;
  state: "queued" | "dreaming" | "completed" | "failed";
  assets?: { video?: string | null } | null;
  failure_reason?: string | null;
}

const LUMA_BASE = "https://api.lumalabs.ai/dream-machine/v1";

function mapLumaState(state: LumaGeneration["state"]): ClipStatus {
  switch (state) {
    case "completed":
      return "ready";
    case "failed":
      return "failed";
    case "queued":
      return "pending";
    case "dreaming":
      return "processing";
  }
}

function buildLumaPrompt(script: VideoScript): string {
  const visuals = script.scenes.map((scene) => scene.visual).join("; ");
  return [
    `${script.title}.`,
    script.narration,
    visuals ? `Visual direction: ${visuals}.` : "",
    "Cinematic, high-fidelity, neon violet glassmorphism aesthetic.",
  ]
    .filter(Boolean)
    .join(" ");
}

async function readError(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 300);
  } catch {
    return res.statusText;
  }
}

export class LumaVideoProvider implements VideoProvider {
  readonly name = "luma";

  constructor(
    private readonly apiKey: string,
    private readonly model = "ray-2"
  ) {}

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
      accept: "application/json",
    };
  }

  private toClip(scriptId: string, gen: LumaGeneration): VideoClip {
    return {
      jobId: gen.id,
      scriptId,
      status: mapLumaState(gen.state),
      url: gen.assets?.video ?? null,
      provider: this.name,
      error:
        gen.state === "failed"
          ? gen.failure_reason ?? "Luma generation failed"
          : undefined,
    };
  }

  async generateClip(script: VideoScript): Promise<VideoClip> {
    const res = await fetch(`${LUMA_BASE}/generations`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        prompt: buildLumaPrompt(script),
        model: this.model,
        aspect_ratio: "16:9",
        loop: true,
      }),
    });
    if (!res.ok) {
      throw new Error(
        `Luma generation request failed (${res.status}): ${await readError(res)}`
      );
    }
    const gen = (await res.json()) as LumaGeneration;
    return this.toClip(script.id, gen);
  }

  async getClip(jobId: string): Promise<VideoClip | null> {
    const res = await fetch(`${LUMA_BASE}/generations/${jobId}`, {
      headers: this.headers(),
    });
    if (res.status === 404) return null;
    if (!res.ok) {
      throw new Error(
        `Luma poll failed (${res.status}): ${await readError(res)}`
      );
    }
    const gen = (await res.json()) as LumaGeneration;
    // Luma does not echo our script id; the feed refresh re-attaches it.
    return this.toClip("", gen);
  }
}

/**
 * Runway Gen-3 Alpha provider — text-to-video synthesis via the Runway ML API.
 *
 * Render jobs are async: {@link generateClip} kicks off a generation and
 * returns immediately (status "pending"); callers poll {@link getClip} until
 * the task resolves to "ready" (with a playable `url`) or "failed".
 *
 * API: https://api.runwayml.com/v1
 */
interface RunwayTask {
  id: string;
  status: "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELLED";
  output?: string[] | null;
  failure?: string | null;
  failureCode?: string | null;
}

const RUNWAY_BASE = "https://api.runwayml.com/v1";

function mapRunwayStatus(status: RunwayTask["status"]): ClipStatus {
  switch (status) {
    case "SUCCEEDED":
      return "ready";
    case "FAILED":
    case "CANCELLED":
      return "failed";
    case "PENDING":
      return "pending";
    case "RUNNING":
      return "processing";
  }
}

export class RunwayVideoProvider implements VideoProvider {
  readonly name = "runway";

  constructor(
    private readonly apiKey: string,
    private readonly model = "gen3a_turbo"
  ) {}

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
      "X-Runway-Version": "2024-11-06",
    };
  }

  private toClip(scriptId: string, task: RunwayTask): VideoClip {
    return {
      jobId: task.id,
      scriptId,
      status: mapRunwayStatus(task.status),
      url: task.output?.[0] ?? null,
      provider: this.name,
      error:
        task.status === "FAILED" || task.status === "CANCELLED"
          ? task.failure ?? task.failureCode ?? "Runway generation failed"
          : undefined,
    };
  }

  async generateClip(script: VideoScript): Promise<VideoClip> {
    const prompt = [
      script.title,
      script.narration,
      script.scenes.map((s) => s.visual).join("; "),
      "Cinematic, neon violet glassmorphism aesthetic.",
    ]
      .filter(Boolean)
      .join(" ");

    const res = await fetch(`${RUNWAY_BASE}/text_to_video`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        model: this.model,
        promptText: prompt,
        ratio: "1280:720",
        duration: 5,
      }),
    });
    if (!res.ok) {
      const body = await readError(res);
      throw new Error(`Runway generation request failed (${res.status}): ${body}`);
    }
    const task = (await res.json()) as RunwayTask;
    return this.toClip(script.id, task);
  }

  async getClip(jobId: string): Promise<VideoClip | null> {
    const res = await fetch(`${RUNWAY_BASE}/tasks/${jobId}`, {
      headers: this.headers(),
    });
    if (res.status === 404) return null;
    if (!res.ok) {
      throw new Error(`Runway poll failed (${res.status}): ${await readError(res)}`);
    }
    const task = (await res.json()) as RunwayTask;
    // Runway does not echo our script id; the feed refresh re-attaches it.
    return this.toClip("", task);
  }
}

/**
 * HeyGen provider — AI avatar video synthesis.
 *
 * Render jobs are async: {@link generateClip} submits a video generation
 * request and returns immediately; callers poll {@link getClip} until status
 * resolves to "ready" or "failed".
 *
 * API: https://api.heygen.com
 */
interface HeyGenVideoResponse {
  data?: { video_id?: string } | null;
  error?: string | null;
}

interface HeyGenStatusResponse {
  data?: {
    video_id?: string;
    status?: "pending" | "processing" | "waiting" | "failed" | "completed";
    video_url?: string | null;
    error?: string | null;
  } | null;
}

const HEYGEN_BASE = "https://api.heygen.com";

function mapHeyGenStatus(
  status: NonNullable<HeyGenStatusResponse["data"]>["status"]
): ClipStatus {
  switch (status) {
    case "completed":
      return "ready";
    case "failed":
      return "failed";
    case "pending":
    case "waiting":
      return "pending";
    case "processing":
      return "processing";
    default:
      return "pending";
  }
}

export class HeyGenVideoProvider implements VideoProvider {
  readonly name = "heygen";

  constructor(private readonly apiKey: string) {}

  private headers(): Record<string, string> {
    return {
      "x-api-key": this.apiKey,
      "Content-Type": "application/json",
    };
  }

  async generateClip(script: VideoScript): Promise<VideoClip> {
    const narration = [script.title, script.narration]
      .filter(Boolean)
      .join(". ");

    const res = await fetch(`${HEYGEN_BASE}/v2/video/generate`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        video_inputs: [
          {
            character: {
              type: "avatar",
              avatar_id: "Daisy-inskirt-20220818",
              avatar_style: "normal",
            },
            voice: {
              type: "text",
              // HeyGen's text-to-speech limit is 1 500 characters per input_text.
              input_text: narration.slice(0, 1500),
              voice_id: "2d5b0e6cf36f460aa7fc47e3eee4ba54",
            },
          },
        ],
        dimension: { width: 1280, height: 720 },
        aspect_ratio: "16:9",
      }),
    });
    if (!res.ok) {
      const body = await readError(res);
      throw new Error(`HeyGen generation request failed (${res.status}): ${body}`);
    }
    const data = (await res.json()) as HeyGenVideoResponse;
    const videoId = data.data?.video_id;
    if (!videoId) {
      throw new Error(
        `HeyGen returned no video_id: ${data.error ?? "unknown error"}`
      );
    }
    return {
      jobId: videoId,
      scriptId: script.id,
      status: "pending",
      url: null,
      provider: this.name,
    };
  }

  async getClip(jobId: string): Promise<VideoClip | null> {
    const res = await fetch(
      `${HEYGEN_BASE}/v1/video_status.get?video_id=${jobId}`,
      { headers: this.headers() }
    );
    if (res.status === 404) return null;
    if (!res.ok) {
      throw new Error(`HeyGen poll failed (${res.status}): ${await readError(res)}`);
    }
    const body = (await res.json()) as HeyGenStatusResponse;
    const d = body.data;
    if (!d) return null;
    // HeyGen does not echo our script id; the feed refresh re-attaches it.
    return {
      jobId,
      scriptId: "",
      status: mapHeyGenStatus(d.status),
      url: d.video_url ?? null,
      provider: this.name,
      error:
        d.status === "failed"
          ? d.error ?? "HeyGen generation failed"
          : undefined,
    };
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
    if (selected === "luma") {
      cached = new LumaVideoProvider(apiKey);
      return cached;
    }
    if (selected === "runway") {
      cached = new RunwayVideoProvider(apiKey);
      return cached;
    }
    if (selected === "heygen") {
      cached = new HeyGenVideoProvider(apiKey);
      return cached;
    }
  }

  throw new Error(`Unknown TV_VIDEO_PROVIDER "${selected}".`);
}

/** Test seam: reset the memoised provider (used by tests / after env change). */
export function resetVideoProvider(): void {
  cached = null;
}
