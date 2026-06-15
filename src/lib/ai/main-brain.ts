/**
 * MainBrain — the authoritative source of truth for game rules and economic
 * metrics. Every "sub-brain" (a per-room worker / game route) must sync against
 * this before completing an action, so behavior can never drift from the
 * canonical rule set.
 *
 * NOTE: state is held in-process. On serverless (Vercel) the `metrics` reset on
 * a cold start; a durable store (Postgres / KV) should back them for
 * production. `rules` are canonical constants and are immutable at runtime.
 */

export interface GameRules {
  /** Cost (in credits) to roll the Vibe 6-5-4 dice once. */
  diceCost: number;
}

export interface EconomicMetrics {
  totalRolls: number;
  creditsWagered: number;
  housePool: number;
}

/** "High Flow" design constraints surfaced to every sub-brain on sync. */
export interface HighFlowConstraints {
  /** Max actions a single sub-brain may process before re-syncing. */
  maxActionsPerSync: number;
  /** Whether sub-brains may mutate rules (always false — MainBrain owns rules). */
  allowRuleMutation: boolean;
}

export interface GlobalContext {
  rules: GameRules;
  metrics: EconomicMetrics;
  highFlow: HighFlowConstraints;
  /** Monotonic version; bumps whenever metrics change. */
  version: number;
  syncedAt: string;
}

/** A status report aggregated from the game-integrity harness. */
export interface HarnessReport {
  gameId: string;
  roomStatus: "OPERATIONAL" | "BUG_DETECTED" | "NOT_IMPLEMENTED";
  memorySync: boolean;
  reportedAt: string;
}

const CANONICAL_RULES: GameRules = Object.freeze({ diceCost: 10 });

const HIGH_FLOW: HighFlowConstraints = Object.freeze({
  maxActionsPerSync: 1,
  allowRuleMutation: false,
});

export class MainBrain {
  private metrics: EconomicMetrics = {
    totalRolls: 0,
    creditsWagered: 0,
    housePool: 0,
  };
  private version = 1;
  private harnessReports: HarnessReport[] = [];

  /** The canonical rule set (defensive copy). */
  get rules(): GameRules {
    return { ...CANONICAL_RULES };
  }

  /** The sync call every sub-brain makes before acting. */
  getGlobalContext(): GlobalContext {
    return {
      rules: { ...CANONICAL_RULES },
      metrics: { ...this.metrics },
      highFlow: { ...HIGH_FLOW },
      version: this.version,
      syncedAt: new Date().toISOString(),
    };
  }

  /** Apply a shield-approved roll to the economic metrics. */
  commitRoll(cost: number): GlobalContext {
    this.metrics = {
      totalRolls: this.metrics.totalRolls + 1,
      creditsWagered: this.metrics.creditsWagered + cost,
      housePool: this.metrics.housePool + cost,
    };
    this.version += 1;
    return this.getGlobalContext();
  }

  /** Record a harness status report for dashboard aggregation. */
  recordHarnessReport(report: Omit<HarnessReport, "reportedAt">): HarnessReport {
    const stored: HarnessReport = {
      ...report,
      reportedAt: new Date().toISOString(),
    };
    this.harnessReports.push(stored);
    return stored;
  }

  /** Latest harness report per game (most recent wins). */
  getHarnessReports(): HarnessReport[] {
    const latest = new Map<string, HarnessReport>();
    for (const report of this.harnessReports) {
      latest.set(report.gameId, report);
    }
    return [...latest.values()];
  }
}

/** Create an isolated MainBrain instance (used by the test harness so it does
 *  not pollute the production singleton's economic metrics). */
export function createMainBrain(): MainBrain {
  return new MainBrain();
}

/** Process-wide singleton (reused across warm invocations of the runtime). */
const globalForBrain = globalThis as unknown as { __mainBrain?: MainBrain };
export const mainBrain = globalForBrain.__mainBrain ?? new MainBrain();
if (!globalForBrain.__mainBrain) {
  globalForBrain.__mainBrain = mainBrain;
}
