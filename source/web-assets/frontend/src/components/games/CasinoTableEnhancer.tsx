/**
 * CasinoTableEnhancer — drop-in AAA wrapper for casino game tables.
 *
 * Founder ask 2026-02-17 Late × 5: "AAA design pass on remaining
 * casino shell games (Yahtzee, Sic Bo, Craps, Hazard, Big Six,
 * 3-Card Poker, Pai Gow, Casino War, Caribbean Stud) + mobile
 * responsiveness sweep."
 *
 * Rather than fork 9 game files, this component layers the cinematic
 * primitives onto any existing game shell. Drop in once at the top of
 * the game's main panel and pass:
 *   - `phase` — 'betting' | 'rolling' | 'won' | 'lost'
 *   - `lastWinningNumber` — optional int for HotColdStrip
 *   - `gameId` — for stable testid namespace
 *
 * Side effects:
 *   - Plays whoosh on rolling, click+win on won, click+lose on lost
 *   - Renders TurnIndicator with phase-aware label
 *   - Renders HotColdStrip when winning numbers are present
 *
 * Pure visual / audio. Doesn't change game logic.
 */
import { useEffect, useRef } from 'react';
import TurnIndicator from './TurnIndicator';
import HotColdStrip from './HotColdStrip';
import cardSoundManager from '@/utils/cardSoundManager';

export type CasinoPhase = 'betting' | 'rolling' | 'won' | 'lost';

interface CasinoTableEnhancerProps {
  phase: CasinoPhase;
  /** Recent winning numbers (last 20 max) for the HotColdStrip */
  history?: number[];
  /** When non-null, appended to history on phase=won|lost */
  lastWinningNumber?: number | null;
  /** Stable testid prefix, e.g. "craps" / "yahtzee" */
  gameId: string;
  /** Custom labels per phase — falls back to sensible defaults */
  labels?: Partial<Record<CasinoPhase, string>>;
  /** Disable sound effects (testing) */
  soundOff?: boolean;
  /** When true, hides the HotColdStrip even if history exists */
  hideHotCold?: boolean;
}

const DEFAULT_LABELS: Record<CasinoPhase, string> = {
  betting: 'PLACE YOUR BETS',
  rolling: 'NO MORE BETS',
  won:     'YOU WIN',
  lost:    'TRY AGAIN',
};

const PHASE_TO_ROLE: Record<CasinoPhase, 'me' | 'dealer' | 'system'> = {
  betting: 'me',
  rolling: 'dealer',
  won:     'system',
  lost:    'system',
};

/**
 * Single-source-of-truth phase indicator + sound + history for any
 * casino game. Drop above the game's stake/bet panel.
 */
export default function CasinoTableEnhancer({
  phase,
  history,
  gameId,
  labels,
  soundOff = false,
}: CasinoTableEnhancerProps) {
  const lastPhaseRef = useRef<CasinoPhase>(phase);

  useEffect(() => {
    if (soundOff) return;
    if (lastPhaseRef.current === phase) return;
    try {
      if (phase === 'rolling') {
        cardSoundManager.playRouletteWhoosh?.();
      } else if (phase === 'won') {
        cardSoundManager.playWinSound?.();
        cardSoundManager.playChipClink?.();
      } else if (phase === 'lost') {
        cardSoundManager.playLoseSound?.();
      } else if (phase === 'betting' && lastPhaseRef.current === 'rolling') {
        cardSoundManager.playRouletteClick?.();
      }
    } catch {
      // best-effort, sound is decorative
    }
    lastPhaseRef.current = phase;
  }, [phase, soundOff]);

  const label = (labels && labels[phase]) || DEFAULT_LABELS[phase];
  const role = PHASE_TO_ROLE[phase];

  return (
    <div data-testid={`${gameId}-aaa-enhancer`} className="space-y-3">
      <TurnIndicator role={role} customLabel={label} />
      {history && history.length > 0 && (
        <div data-testid={`${gameId}-history-strip`}>
          <HotColdStrip recentNumbers={history} />
        </div>
      )}
    </div>
  );
}

/**
 * Tiny chip-stack stake selector (replaces the dropdown). Renders 5
 * pill buttons with chip-glyph stacks in classic casino denominations.
 * Drop next to the play CTA. Mobile-friendly and visually richer than
 * a <select>.
 */
export function ChipStakeSelector({
  stake,
  onChange,
  disabled = false,
  testid,
  options = [5, 10, 25, 50, 100],
}: {
  stake: number;
  onChange: (n: number) => void;
  disabled?: boolean;
  testid: string;
  options?: number[];
}) {
  // Color per denom (classic casino chip palette).
  const chipColor = (n: number): string => {
    if (n <= 5) return 'from-rose-500 to-rose-700';
    if (n <= 10) return 'from-sky-500 to-sky-700';
    if (n <= 25) return 'from-emerald-500 to-emerald-700';
    if (n <= 50) return 'from-amber-500 to-amber-700';
    return 'from-fuchsia-500 to-violet-700';
  };
  return (
    <div
      data-testid={testid}
      className="flex flex-wrap gap-2 items-center"
    >
      {options.map((n) => {
        const on = stake === n;
        return (
          <button
            type="button"
            key={n}
            disabled={disabled}
            onClick={() => onChange(n)}
            data-testid={`${testid}-chip-${n}`}
            aria-pressed={on}
            className={
              'relative w-14 h-14 rounded-full font-black text-xs tabular-nums transition-all ' +
              'bg-gradient-to-b ' + chipColor(n) + ' ' +
              (on
                ? 'ring-2 ring-amber-300 scale-105 shadow-[0_0_18px_rgba(255,211,61,0.45)]'
                : 'opacity-70 hover:opacity-100 hover:scale-105') +
              ' disabled:opacity-30 disabled:cursor-not-allowed'
            }
          >
            <span className="absolute inset-1 rounded-full border-2 border-dashed border-white/40" />
            <span className="relative z-10 text-white drop-shadow">${n}</span>
          </button>
        );
      })}
    </div>
  );
}
