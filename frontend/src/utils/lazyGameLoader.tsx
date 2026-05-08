// Refactor: fully typed lazyGameLoader (removed @ts-nocheck)

import React, { lazy, Suspense } from 'react';
import { LoadingSpinner } from '@/components/UIComponents';

// Lazy load all game components for better performance
const PracticePoker = lazy(() => import('@/components/practice_games/PracticePoker').then((m) => ({ default: m.PracticePoker })));
const PracticeBlackjack = lazy(() => import('@/components/practice_games/PracticeBlackjack').then((m) => ({ default: m.PracticeBlackjack })));
const PracticeRoulette = lazy(() => import('@/components/practice_games/PracticeRoulette'));
const PracticeVibesSlots = lazy(() => import('@/components/practice_games/PracticeVibesSlots'));
const PracticeVibesWheel = lazy(() => import('@/components/practice_games/PracticeVibesWheel'));
const PracticeVibesDarts = lazy(() => import('@/components/practice_games/PracticeVibesDarts'));
const PracticeGoFish = lazy(() => import('@/components/practice_games/PracticeGoFish').then((m) => ({ default: m.PracticeGoFish })));
const PracticeCrazyEights = lazy(() => import('@/components/practice_games/PracticeCrazyEights').then((m) => ({ default: m.PracticeCrazyEights })));
const PracticeHearts = lazy(() => import('@/components/practice_games/PracticeHearts').then((m) => ({ default: m.PracticeHearts })));
const PracticeSpades = lazy(() => import('@/components/practice_games/PracticeSpades').then((m) => ({ default: m.PracticeSpades })));
const PracticeRummy = lazy(() => import('@/components/practice_games/PracticeRummy').then((m) => ({ default: m.PracticeRummy })));
const PracticeGinRummy = lazy(() => import('@/components/practice_games/PracticeGinRummy'));
const PracticeWar = lazy(() => import('@/components/practice_games/PracticeWar'));
const PracticeSolitaire = lazy(() => import('@/components/practice_games/PracticeSolitaire'));

// Map game IDs to lazy-loaded components
export const LAZY_GAME_COMPONENTS: Record<string, React.LazyExoticComponent<React.ComponentType<any>>> = {
  poker: PracticePoker,
  blackjack: PracticeBlackjack,
  roulette: PracticeRoulette,
  vibes_slots: PracticeVibesSlots,
  vibes_wheel: PracticeVibesWheel,
  vibes_darts: PracticeVibesDarts,
  go_fish: PracticeGoFish,
  crazy_eights: PracticeCrazyEights,
  hearts: PracticeHearts,
  spades: PracticeSpades,
  rummy: PracticeRummy,
  gin_rummy: PracticeGinRummy,
  war: PracticeWar,
  solitaire: PracticeSolitaire,
};

export interface LazyGameComponentProps {
  gameType: string;
  [key: string]: any;
}

// Wrapper component with loading fallback
export function LazyGameComponent({ gameType, ...props }: LazyGameComponentProps) {
  const GameComponent = LAZY_GAME_COMPONENTS[gameType];

  if (!GameComponent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="text-white text-xl">Game not found: {gameType}</div>
      </div>
    );
  }

  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
          <LoadingSpinner size="xl" className="mb-4" />
          <p className="text-white text-xl">Loading {gameType.replace(/_/g, ' ')}...</p>
          <p className="text-slate-400 text-sm mt-2">Please wait</p>
        </div>
      }
    >
      <GameComponent {...props} />
    </Suspense>
  );
}
