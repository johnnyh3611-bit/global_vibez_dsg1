/**
 * Type shim for the `practice_games` barrel.
 *
 * The `src/components/practice_games/` folder is a mixed collection of 77
 * game modules that each accept a slightly different prop shape
 * (`game` vs `gameState`, `onMove` vs `onAction`, etc.). Typing every
 * single export precisely would require 77 per-component interfaces and
 * would block the orchestrator in `PracticeGamePlay.tsx` from compiling.
 *
 * Since the actual prop-shape is validated at runtime by each game's
 * reducer, we declare every export as a permissive `React.FC<any>` here
 * so the orchestrator TSX can stay fully-typed at its own call sites
 * while remaining flexible about what it hands down.
 */
declare module '@/components/practice_games' {
  const _unused: never;
  export const PracticeTicTacToe: React.FC<any>;
  export const PracticeConnect4: React.FC<any>;
  export const PracticeBlackjack: React.FC<any>;
  export const PracticeChess: React.FC<any>;
  export const PracticeCheckers: React.FC<any>;
  export const PracticeReversi: React.FC<any>;
  export const PracticeGoFish: React.FC<any>;
  export const PracticeCrazyEights: React.FC<any>;
  export const PracticeHearts: React.FC<any>;
  export const PracticePoker: React.FC<any>;
  export const PracticeSpades: React.FC<any>;
  export const PracticeTrivia: React.FC<any>;
  export const PracticeTruthOrDare: React.FC<any>;
  export const PracticeRummy: React.FC<any>;
  export const PracticeSnake: React.FC<any>;
  export const PracticeMemoryMatch: React.FC<any>;
  export const PracticePool8Ball: React.FC<any>;
  export const PracticePingPong: React.FC<any>;
  export const PracticeWar: React.FC<any>;
  export const PracticeSolitaire: React.FC<any>;
  export const PracticeGinRummy: React.FC<any>;
  export const PracticeRoulette: React.FC<any>;
  export const PracticeBaccarat: React.FC<any>;
  export const PracticeCaribbeanStud: React.FC<any>;
  export const PracticeThreeCardPoker: React.FC<any>;
  export const PracticePaiGow: React.FC<any>;
  export const PracticeCheminDeFer: React.FC<any>;
  export const PracticeCasinoWar: React.FC<any>;
  export const PracticeEuropeanRoulette: React.FC<any>;
  export const PracticeCraps: React.FC<any>;
  export const PracticeSicBo: React.FC<any>;
  export const PracticeHazard: React.FC<any>;
  export const PracticeChuckALuck: React.FC<any>;
  export const PracticeBigSixWheel: React.FC<any>;
  export const PracticeVibesWheel: React.FC<any>;
  export const PracticeRouletteClassic: React.FC<any>;
  export const PracticeKeno: React.FC<any>;
  export const PracticeBingo: React.FC<any>;
  export const PracticeFanTan: React.FC<any>;
  export const PracticeFaro: React.FC<any>;
  export const PracticeJacksOrBetter: React.FC<any>;
  export const PracticeVibesSlots: React.FC<any>;
  export const PracticeVibesDarts: React.FC<any>;
  export const PracticeVibesCornhole: React.FC<any>;
  export const PracticeVibesBasketball: React.FC<any>;
  export const PracticeVibesBillards: React.FC<any>;
  export const PracticeVibesCheesi: React.FC<any>;
  export const PracticeMahjong: React.FC<any>;
  export const PracticeDominoes: React.FC<any>;
  export const PracticeBackgammon: React.FC<any>;
  export const PracticeBlackjackNew: React.FC<any>;
  export const PracticeMouseHunt: React.FC<any>;
  export const PracticeSaveDaBaby: React.FC<any>;
  export const BlackjackGameSimple: React.FC<any>;
  export const BlackjackGameAAA: React.FC<any>;
  export const PracticeBattleship: React.FC<any>;
  export const PracticeYahtzee: React.FC<any>;
  export const PracticeMancala: React.FC<any>;
  export const PracticeKlondike: React.FC<any>;
  export const PracticeTwoTruthsLie: React.FC<any>;
  // Permissive fallback for any other future export
  const _fallback: { [k: string]: React.FC<any> };
}
