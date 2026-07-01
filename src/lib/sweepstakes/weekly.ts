interface WeekEntryMap {
  [weekKey: string]: Set<string>;
}

const weeklyEntries: WeekEntryMap = {};

function startOfUtcWeek(date: Date): Date {
  const day = date.getUTCDay();
  const diff = (day + 6) % 7;
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  start.setUTCDate(start.getUTCDate() - diff);
  start.setUTCHours(0, 0, 0, 0);
  return start;
}

export function getSweepstakesWeekKey(now = new Date()): string {
  return startOfUtcWeek(now).toISOString().slice(0, 10);
}

export function getNextDrawIso(now = new Date()): string {
  const start = startOfUtcWeek(now);
  const draw = new Date(start);
  draw.setUTCDate(draw.getUTCDate() + 7);
  draw.setUTCHours(0, 0, 0, 0);
  return draw.toISOString();
}

export function enterCurrentWeek(wallet: string): { weekKey: string; alreadyEntered: boolean; totalEntries: number } {
  const weekKey = getSweepstakesWeekKey();
  if (!weeklyEntries[weekKey]) {
    weeklyEntries[weekKey] = new Set<string>();
  }

  const bucket = weeklyEntries[weekKey];
  const alreadyEntered = bucket.has(wallet);
  bucket.add(wallet);

  return {
    weekKey,
    alreadyEntered,
    totalEntries: bucket.size,
  };
}

export function getCurrentWeekStatus(wallet: string): {
  weekKey: string;
  entered: boolean;
  totalEntries: number;
  nextDrawAt: string;
} {
  const weekKey = getSweepstakesWeekKey();
  const bucket = weeklyEntries[weekKey] ?? new Set<string>();

  return {
    weekKey,
    entered: bucket.has(wallet),
    totalEntries: bucket.size,
    nextDrawAt: getNextDrawIso(),
  };
}
