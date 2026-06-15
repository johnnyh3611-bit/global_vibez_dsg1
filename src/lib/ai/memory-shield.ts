/**
 * MemoryShield — sits between sub-brain (game route) logic and the user. It
 * cross-references a proposed action against MainBrain. If a sub-brain tries to
 * break a rule (e.g. change the dice cost), the action is rejected and the
 * caller is handed the canonical MainBrain context to hard-revert to.
 */
import {
  mainBrain,
  type GameRules,
  type GlobalContext,
  type MainBrain,
} from "./main-brain";

export type GameActionType = "dice-roll";

export interface ProposedAction {
  type: GameActionType;
  /** Cost the sub-brain believes applies — must match MainBrain's rule. */
  cost: number;
  /** Any rule values the sub-brain attempts to assert/override. */
  assertedRules?: Partial<GameRules>;
}

export interface ShieldDecision {
  ok: boolean;
  /** Always the authoritative MainBrain context (the hard-revert target). */
  context: GlobalContext;
  violations: string[];
  reverted: boolean;
}

export function guardAction(
  action: ProposedAction,
  brain: MainBrain = mainBrain
): ShieldDecision {
  const context = brain.getGlobalContext();
  const violations: string[] = [];

  if (action.type === "dice-roll" && action.cost !== context.rules.diceCost) {
    violations.push(
      `diceCost drift: sub-brain proposed ${action.cost}, MainBrain requires ${context.rules.diceCost}`
    );
  }

  if (action.assertedRules && !context.highFlow.allowRuleMutation) {
    for (const [key, value] of Object.entries(action.assertedRules)) {
      const canonical = context.rules[key as keyof GameRules];
      if (canonical !== value) {
        violations.push(
          `rule mutation blocked: "${key}" ${canonical} -> ${value}`
        );
      }
    }
  }

  const ok = violations.length === 0;
  return { ok, context, violations, reverted: !ok };
}
