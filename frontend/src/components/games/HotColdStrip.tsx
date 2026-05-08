/**
 * HotColdStrip — Roulette / Wheel hot/cold last-N history strip.
 *
 * Founder ask (Phase 3): "Roulette: hot/cold numbers strip + last-10 history."
 *
 * Renders the most-recent N numbers with red/black/green coloring and a
 * mini frequency badge highlighting the 3 hottest + 3 coldest numbers in
 * the visible window.
 */
const RED_NUMBERS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);

const colorFor = (n: number): string => {
  if (n === 0) return '#10b981';   // green
  return RED_NUMBERS.has(n) ? '#dc143c' : '#1f2937';
};

interface HotColdStripProps {
  /** Recent spin numbers in chronological order (oldest first). */
  history: number[];
  /** How many recent spins to show (default 10). */
  showCount?: number;
}

export function HotColdStrip({ history, showCount = 10 }: HotColdStripProps) {
  const recent = history.slice(-showCount);
  // Frequency in the visible window
  const counts: Record<number, number> = {};
  for (const n of recent) counts[n] = (counts[n] || 0) + 1;
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const hot = new Set(sorted.slice(0, 3).map(([n]) => Number(n)));
  const cold = new Set(sorted.slice(-3).map(([n]) => Number(n)));

  return (
    <div
      data-testid="hot-cold-strip"
      className="rounded-xl border border-white/10 bg-black/40 p-3"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] uppercase tracking-widest text-white/60 font-bold">
          Last {showCount}
        </span>
        <div className="flex items-center gap-3 text-[10px] text-white/40">
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-rose-400" /> Hot
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-cyan-400" /> Cold
          </span>
        </div>
      </div>
      <div className="flex gap-1 overflow-x-auto pb-1">
        {recent.length === 0 ? (
          <span className="text-white/30 text-xs italic">No spins yet</span>
        ) : recent.map((n, i) => {
          const isHot = hot.has(n);
          const isCold = cold.has(n);
          return (
            <div
              key={`hcstrip-${i}`}
              data-testid={`hot-cold-${i}`}
              className="relative flex-shrink-0 w-7 h-9 rounded flex items-center justify-center text-[11px] font-black text-white"
              style={{
                background: colorFor(n),
                outline: isHot ? '2px solid #fb7185' : isCold ? '2px solid #22d3ee' : 'none',
              }}
            >
              {n}
              {isHot && <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-rose-400" />}
              {isCold && <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-cyan-400" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default HotColdStrip;
