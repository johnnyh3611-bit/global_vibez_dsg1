/**
 * BigRoadRoadmap — Baccarat win-streak chart (LOCKED 2026-02-16
 * per design_guidelines.json — Phase 3 blueprint).
 *
 * Standard 6-row × 24-col grid. Players use this to spot dragons
 * (long banker streaks) and ponds (alternating chops). Dots are
 * red for Banker, blue for Player, green slash for Tie.
 */
import { motion } from 'framer-motion';

export type BaccaratOutcome = 'banker' | 'player' | 'tie';

interface BigRoadRoadmapProps {
  /** Outcomes in chronological order. Ties annotate the most recent dot. */
  outcomes: BaccaratOutcome[];
  /** Number of rows (default 6, the casino standard). */
  rows?: number;
  /** Number of columns (default 24). */
  cols?: number;
  /** Optional override label. */
  title?: string;
}

interface Cell {
  outcome: BaccaratOutcome | null;
  ties: number;
}

function buildGrid(outcomes: BaccaratOutcome[], rows: number, cols: number): Cell[][] {
  const grid: Cell[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({ outcome: null as BaccaratOutcome | null, ties: 0 })),
  );
  let r = 0, c = 0, prev: BaccaratOutcome | null = null;

  for (const o of outcomes) {
    if (o === 'tie') {
      // Apply tie annotation to the last placed cell.
      const lr = prev === null ? 0 : (r === 0 || (r > 0 && grid[r - 1][c].outcome === prev) ? r - 1 : r);
      const lc = c;
      if (lr >= 0 && grid[lr][lc].outcome) grid[lr][lc].ties += 1;
      continue;
    }
    if (prev === null) {
      grid[0][0] = { outcome: o, ties: 0 };
      r = 0; c = 0;
    } else if (o === prev) {
      // Same outcome — drop down or shift right when blocked.
      if (r + 1 < rows && grid[r + 1][c].outcome === null) {
        r += 1;
      } else if (c + 1 < cols) {
        c += 1;
      }
      grid[r][c] = { outcome: o, ties: 0 };
    } else {
      // Different outcome — start a new column at row 0.
      c = c + 1;
      r = 0;
      if (c < cols) grid[r][c] = { outcome: o, ties: 0 };
    }
    prev = o;
  }
  return grid;
}

const COLOR: Record<BaccaratOutcome, string> = {
  banker: '#dc143c',
  player: '#1E40AF',
  tie:    '#10b981',
};

export function BigRoadRoadmap({
  outcomes, rows = 6, cols = 24, title = 'Big Road',
}: BigRoadRoadmapProps) {
  const grid = buildGrid(outcomes, rows, cols);

  return (
    <div data-testid="big-road-roadmap" className="rounded-xl border border-white/10 bg-black/40 p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] uppercase tracking-widest text-white/60 font-bold">{title}</span>
        <span className="text-[10px] text-white/40 tabular-nums">
          {outcomes.length} hands
        </span>
      </div>
      <div
        className="grid gap-px bg-white/5 p-1 rounded"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(10px, 1fr))` }}
      >
        {Array.from({ length: rows }).map((_, ri) => (
          Array.from({ length: cols }).map((_, ci) => {
            const cell = grid[ri][ci];
            return (
              <div
                key={`bigroad-${ri}-${ci}`}
                data-testid={`big-road-cell-${ri}-${ci}`}
                className="aspect-square bg-black/40 flex items-center justify-center relative"
              >
                {cell.outcome && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="rounded-full"
                    style={{
                      width: '70%', height: '70%',
                      background: COLOR[cell.outcome],
                      boxShadow: `0 0 6px ${COLOR[cell.outcome]}80`,
                    }}
                  />
                )}
                {cell.ties > 0 && (
                  <span className="absolute inset-0 flex items-center justify-center text-[8px] font-black text-emerald-400 pointer-events-none">
                    {cell.ties}
                  </span>
                )}
              </div>
            );
          })
        ))}
      </div>
      <div className="mt-2 flex items-center gap-3 text-[10px] text-white/50">
        <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: COLOR.banker }} /> Banker</span>
        <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: COLOR.player }} /> Player</span>
        <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: COLOR.tie }} /> Tie</span>
      </div>
    </div>
  );
}

export default BigRoadRoadmap;
