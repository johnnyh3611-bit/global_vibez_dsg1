/**
 * TV content engine.
 *
 * Turns the live state of the MainBrain (economic metrics) and the latest
 * game-integrity results into typed video scripts. The scripts are the input
 * to a {@link VideoProvider}, which synthesises the actual clips. This module
 * is pure/deterministic so it can be unit-tested without any external service.
 */
import type { GlobalContext, HarnessReport } from "@/lib/ai/main-brain";
import { tokens } from "@/styles/design-tokens";

export type VideoScriptKind =
  | "game-highlight"
  | "winner-announcement"
  | "economic-recap";

export interface VideoScene {
  /** On-screen caption / lower-third text. */
  caption: string;
  /** Direction for the visual the synth model should render. */
  visual: string;
  durationMs: number;
}

/** Overlay/graphics styling, pulled from the design tokens. */
export interface OverlayStyle {
  accent: string;
  background: string;
  glow: string;
}

export interface VideoScript {
  id: string;
  kind: VideoScriptKind;
  title: string;
  /** Voiceover / narration text. */
  narration: string;
  scenes: VideoScene[];
  overlay: OverlayStyle;
  /** MainBrain version this script was generated from. */
  sourceVersion: number;
}

export interface ContentEngineInput {
  context: GlobalContext;
  gameResults: HarnessReport[];
}

const OVERLAY: OverlayStyle = {
  accent: tokens.color.brandAccent,
  background: tokens.color.backgroundDeep,
  glow: tokens.color.brandGlow,
};

function gameTitle(gameId: string): string {
  return gameId
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/** Build a deterministic set of broadcast scripts from the current brain state. */
export function generateBroadcastScripts(
  input: ContentEngineInput
): VideoScript[] {
  const { context, gameResults } = input;
  const { metrics, rules, version } = context;
  const scripts: VideoScript[] = [];

  // 1. Economic recap — always produced from the canonical metrics.
  scripts.push({
    id: `economic-recap-${version}`,
    kind: "economic-recap",
    title: "Global Vibez DSG — House Report",
    narration:
      `Across the floor tonight: ${metrics.totalRolls} rolls placed, ` +
      `${metrics.creditsWagered} credits wagered, and a house pool of ` +
      `${metrics.housePool} credits. The vibes are high.`,
    scenes: [
      {
        caption: `${metrics.totalRolls} TOTAL ROLLS`,
        visual: "Neon ticker sweeping across a violet glass skyline",
        durationMs: 2500,
      },
      {
        caption: `${metrics.housePool} CREDIT HOUSE POOL`,
        visual: "Coins cascading into a glowing glass vault",
        durationMs: 2500,
      },
    ],
    overlay: OVERLAY,
    sourceVersion: version,
  });

  // 2. Per-game highlights — one clip per OPERATIONAL room.
  for (const result of gameResults) {
    if (result.roomStatus !== "OPERATIONAL") continue;
    const title = gameTitle(result.gameId);
    scripts.push({
      id: `game-highlight-${result.gameId}-${version}`,
      kind: "game-highlight",
      title: `${title} — Table Highlights`,
      narration:
        `${title} is live and fully synced with the Main Brain. ` +
        `Every hand is shield-verified at ${rules.diceCost} credits a roll.`,
      scenes: [
        {
          caption: `${title.toUpperCase()} IS LIVE`,
          visual: "Slow dolly across a packed high-fidelity card table",
          durationMs: 3000,
        },
        {
          caption: "MEMORY SHIELD: SYNCED",
          visual: "Pulse of brand-violet energy rippling over the felt",
          durationMs: 2000,
        },
      ],
      overlay: OVERLAY,
      sourceVersion: version,
    });
  }

  // 3. Winner announcement — only meaningful once there is real wager volume.
  if (metrics.totalRolls > 0) {
    scripts.push({
      id: `winner-announcement-${version}`,
      kind: "winner-announcement",
      title: "Winner's Circle",
      narration:
        `The pot is hot — ${metrics.housePool} credits on the line. ` +
        `Step up to the table and claim the Winner's Circle.`,
      scenes: [
        {
          caption: "WINNER'S CIRCLE",
          visual: "Spotlight sweeping a glass podium, confetti of violet light",
          durationMs: 3000,
        },
      ],
      overlay: OVERLAY,
      sourceVersion: version,
    });
  }

  return scripts;
}
