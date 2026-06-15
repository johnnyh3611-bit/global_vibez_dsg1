/**
 * Game-integrity harness.
 *
 * Runs a simulated end-to-end user journey for every game room
 * (Join Room -> Place Bet -> Play Hand -> Record Result) and verifies every
 * step against the MainBrain rule set through the MemoryShield. If a room's
 * state drifts from the canonical rules (e.g. a card/dice logic error or a
 * shield bypass), the step fails and a RegressionAlert is logged.
 *
 * Tests run against an *isolated* MainBrain instance so they never pollute the
 * production singleton's economic metrics. Each game culminates in a
 * `StatusReport` that is aggregated back into the production MainBrain so a
 * dashboard can read which rooms are OPERATIONAL vs BUG_DETECTED.
 */
import { createMainBrain, mainBrain, type MainBrain } from "@/lib/ai/main-brain";
import { guardAction } from "@/lib/ai/memory-shield";
import {
  DICE_COUNT,
  rollDice,
  evaluateSixFiveFour,
} from "@/lib/game/dice";

export type RoomStatus = "OPERATIONAL" | "BUG_DETECTED" | "NOT_IMPLEMENTED";

/** The per-game report shape requested by the spec. */
export interface StatusReport {
  gameId: string;
  roomStatus: RoomStatus;
  memorySync: boolean;
}

export interface HarnessStep {
  name: string;
  ok: boolean;
  detail: string;
}

export interface GameTestResult extends StatusReport {
  steps: HarnessStep[];
  regressionAlerts: string[];
  error?: string;
}

interface RunContext {
  steps: HarnessStep[];
  regressionAlerts: string[];
  brain: MainBrain;
}

class RegressionError extends Error {}

function step(ctx: RunContext, name: string, ok: boolean, detail: string): void {
  ctx.steps.push({ name, ok, detail });
}

/** Record a hard failure: log a RegressionAlert and abort the room's run. */
function regress(ctx: RunContext, name: string, detail: string): never {
  const alert = `RegressionAlert [${name}]: ${detail}`;
  ctx.regressionAlerts.push(alert);
  ctx.steps.push({ name, ok: false, detail });
  console.error(alert);
  throw new RegressionError(detail);
}

/**
 * Vibe 6-5-4 dice room — the one fully implemented game. Exercises the real
 * shared dice logic and the shield/brain economic loop.
 */
function runDiceRoom(ctx: RunContext): void {
  const { brain } = ctx;

  // 1. Join Room: sync against the brain.
  const joinCtx = brain.getGlobalContext();
  step(ctx, "join-room", true, `synced at brain version ${joinCtx.version}`);

  // 2. Place Bet: the shield must approve a bet at the canonical cost...
  const cost = joinCtx.rules.diceCost;
  const betDecision = guardAction({ type: "dice-roll", cost }, brain);
  if (!betDecision.ok) {
    regress(
      ctx,
      "place-bet",
      `shield rejected a canonical bet: ${betDecision.violations.join("; ")}`
    );
  }
  // ...and must reject a bet that drifts from the canonical cost.
  const driftDecision = guardAction({ type: "dice-roll", cost: cost + 1 }, brain);
  if (driftDecision.ok) {
    regress(
      ctx,
      "place-bet",
      `shield failed to block cost drift (${cost} -> ${cost + 1})`
    );
  }
  step(ctx, "place-bet", true, `bet ${cost} approved; drift blocked`);

  // 3. Play Hand: verify the dice logic against known fixtures (real
  //    regression check on game logic), then play a live hand.
  const fixtures: { dice: number[]; qualified: boolean; cargo: number }[] = [
    { dice: [6, 5, 4, 1, 2], qualified: true, cargo: 3 },
    { dice: [6, 5, 4, 6, 6], qualified: true, cargo: 12 },
    { dice: [1, 1, 1, 1, 1], qualified: false, cargo: 0 },
  ];
  for (const fx of fixtures) {
    const got = evaluateSixFiveFour(fx.dice);
    if (got.qualified !== fx.qualified || got.cargo !== fx.cargo) {
      regress(
        ctx,
        "play-hand",
        `dice logic drift on [${fx.dice}]: expected ${JSON.stringify({
          qualified: fx.qualified,
          cargo: fx.cargo,
        })}, got ${JSON.stringify(got)}`
      );
    }
  }
  const dice = rollDice(DICE_COUNT);
  if (dice.length !== DICE_COUNT || dice.some((d) => d < 1 || d > 6)) {
    regress(ctx, "play-hand", `invalid dice rolled: [${dice}]`);
  }
  const outcome = evaluateSixFiveFour(dice);
  step(
    ctx,
    "play-hand",
    true,
    `rolled [${dice}] -> ${outcome.qualified ? `qualified, cargo ${outcome.cargo}` : "no qualify"}`
  );

  // 4. Record Result: commit the roll and verify the brain state advanced
  //    exactly as expected (version +1, housePool += cost).
  const before = brain.getGlobalContext();
  const after = brain.commitRoll(cost);
  const versionOk = after.version === before.version + 1;
  const poolOk = after.metrics.housePool === before.metrics.housePool + cost;
  const rollsOk = after.metrics.totalRolls === before.metrics.totalRolls + 1;
  if (!versionOk || !poolOk || !rollsOk) {
    regress(
      ctx,
      "record-result",
      `brain state drift after commit: ${JSON.stringify(after.metrics)} (version ${after.version})`
    );
  }
  step(
    ctx,
    "record-result",
    true,
    `committed; housePool ${after.metrics.housePool}, version ${after.version}`
  );
}

/** Games the harness knows how to drive. */
type GameRunner = (ctx: RunContext) => void;

const IMPLEMENTED_GAMES: Record<string, GameRunner> = {
  "vibe-654-dice": runDiceRoom,
};

/** Lobby games that are advertised but not yet implemented. */
const PLACEHOLDER_GAMES = ["spade-plus", "bid-whist"];

/**
 * Test a single game room end-to-end. Returns a {@link GameTestResult} and
 * never throws — a failed room yields `roomStatus: "BUG_DETECTED"`.
 */
export function testGameRoom(gameId: string): GameTestResult {
  if (PLACEHOLDER_GAMES.includes(gameId)) {
    return {
      gameId,
      roomStatus: "NOT_IMPLEMENTED",
      memorySync: false,
      steps: [],
      regressionAlerts: [],
    };
  }

  const runner = IMPLEMENTED_GAMES[gameId];
  if (!runner) {
    return {
      gameId,
      roomStatus: "NOT_IMPLEMENTED",
      memorySync: false,
      steps: [],
      regressionAlerts: [],
      error: `Unknown game room "${gameId}"`,
    };
  }

  const ctx: RunContext = {
    steps: [],
    regressionAlerts: [],
    brain: createMainBrain(),
  };

  try {
    runner(ctx);
    return {
      gameId,
      roomStatus: "OPERATIONAL",
      memorySync: true,
      steps: ctx.steps,
      regressionAlerts: ctx.regressionAlerts,
    };
  } catch (error) {
    return {
      gameId,
      roomStatus: "BUG_DETECTED",
      memorySync: false,
      steps: ctx.steps,
      regressionAlerts: ctx.regressionAlerts,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export interface HarnessRun {
  startedAt: string;
  finishedAt: string;
  operational: number;
  bugDetected: number;
  notImplemented: number;
  results: GameTestResult[];
}

/** Every room the harness covers, in execution order. */
export const ALL_GAME_IDS: string[] = [
  ...Object.keys(IMPLEMENTED_GAMES),
  ...PLACEHOLDER_GAMES,
];

/**
 * Run the integrity harness one-by-one across every room, logging each result
 * and aggregating the status reports into the production MainBrain for the
 * dashboard.
 */
export function runGameIntegrityHarness(
  gameIds: string[] = ALL_GAME_IDS
): HarnessRun {
  const startedAt = new Date().toISOString();
  const results: GameTestResult[] = [];

  for (const gameId of gameIds) {
    const result = testGameRoom(gameId);
    results.push(result);

    // Aggregate the status report back to the Main Brain for the dashboard.
    mainBrain.recordHarnessReport({
      gameId: result.gameId,
      roomStatus: result.roomStatus,
      memorySync: result.memorySync,
    });

    console.log(
      `[game-harness] ${result.gameId}: ${result.roomStatus} (memorySync=${result.memorySync})`
    );
  }

  return {
    startedAt,
    finishedAt: new Date().toISOString(),
    operational: results.filter((r) => r.roomStatus === "OPERATIONAL").length,
    bugDetected: results.filter((r) => r.roomStatus === "BUG_DETECTED").length,
    notImplemented: results.filter((r) => r.roomStatus === "NOT_IMPLEMENTED")
      .length,
    results,
  };
}
