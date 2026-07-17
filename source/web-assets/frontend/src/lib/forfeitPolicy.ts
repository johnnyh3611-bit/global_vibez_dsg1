/**
 * Mid-game quitter penalty — keep in sync with backend
 * `utils/game_forfeit.py` (HOUSE_PENALTY_PCT / partner split).
 */
export const FORFEIT_POLICY = {
  housePenaltyPct: 0.15,
  partnerSharePct: 0.5,
  opponentSharePct: 0.5,
} as const;

export function housePenaltyAmount(entryFee: number): number {
  const entry = Math.max(0, Number(entryFee) || 0);
  return Math.round(entry * FORFEIT_POLICY.housePenaltyPct);
}

export function formatForfeitWarning(entryFee: number): {
  entry: number;
  penalty: number;
  total: number;
  partnerShare: number;
  opponentPool: number;
  summary: string;
} {
  const entry = Math.max(0, Math.floor(Number(entryFee) || 0));
  const penalty = housePenaltyAmount(entry);
  const partnerShare = Math.floor(entry * FORFEIT_POLICY.partnerSharePct);
  const opponentPool = entry - partnerShare;
  return {
    entry,
    penalty,
    total: entry + penalty,
    partnerShare,
    opponentPool,
    summary:
      entry > 0
        ? `Quit now and you forfeit your ${entry} entry plus a ${penalty} house penalty (15%). Half of your entry (${partnerShare}) goes to your partner; the rest (${opponentPool}) is split among remaining opponents.`
        : "Leave this free game? No entry fee or penalty applies.",
  };
}
