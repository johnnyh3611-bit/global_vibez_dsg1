import { NextRequest, NextResponse } from "next/server";
import { randomInt } from "crypto";
import { getSession } from "@/lib/auth";
import { mainBrain } from "@/lib/ai/main-brain";
import { guardAction } from "@/lib/ai/memory-shield";

const DICE_COUNT = 5;

function rollDice(count: number): number[] {
  return Array.from({ length: count }, () => randomInt(1, 7));
}

/**
 * Vibe 6-5-4 (Ship, Captain, Crew): a player must roll a 6, then a 5, then a 4
 * to qualify. The two remaining dice are the "cargo" score.
 */
function evaluateSixFiveFour(dice: number[]): {
  qualified: boolean;
  cargo: number;
} {
  const remaining = [...dice];
  for (const face of [6, 5, 4]) {
    const idx = remaining.indexOf(face);
    if (idx === -1) {
      return { qualified: false, cargo: 0 };
    }
    remaining.splice(idx, 1);
  }
  return { qualified: true, cargo: remaining.reduce((a, b) => a + b, 0) };
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // The sub-brain (this room worker) proposes its action. A client may try to
  // assert a different cost/rules — the shield is what stops the drift.
  const body = await request.json().catch(() => ({}));
  const proposedCost =
    typeof body?.cost === "number" ? body.cost : mainBrain.rules.diceCost;

  const decision = guardAction({
    type: "dice-roll",
    cost: proposedCost,
    assertedRules: body?.rules,
  });

  if (!decision.ok) {
    return NextResponse.json(
      {
        error: "Action rejected by MemoryShield",
        violations: decision.violations,
        reverted: decision.reverted,
        context: decision.context,
      },
      { status: 409 }
    );
  }

  const cost = decision.context.rules.diceCost;
  const dice = rollDice(DICE_COUNT);
  const { qualified, cargo } = evaluateSixFiveFour(dice);
  const context = mainBrain.commitRoll(cost);

  return NextResponse.json({
    ok: true,
    dice,
    qualified,
    cargo,
    cost,
    player: session.publicKey,
    brainSync: { version: context.version, syncedAt: context.syncedAt },
  });
}
