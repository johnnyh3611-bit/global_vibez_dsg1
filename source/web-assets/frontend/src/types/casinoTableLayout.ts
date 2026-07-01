/**
 * Shared prop types for casino-style full-table layout components.
 *
 * These layouts (MinimalistTable, VIPLuxuryTable, ClassicCasinoTable,
 * CyberpunkNeonTable, HybridGameLayout, CasinoTableLayout) are intentionally
 * "thin shells" that receive gameplay state from a parent game page and
 * render a specific aesthetic. Their prop surfaces overlap heavily — this
 * barrel consolidates them and defaults every field to optional so parents
 * can pass whichever subset their game needs.
 */
import type { ReactNode } from 'react';

export interface CasinoTableLayoutCommonProps {
  balance?: number;
  currentBet?: number;
  dealerCards?: unknown[];
  playerCards?: unknown[];
  dealerScore?: number;
  playerScore?: number;
  dealerPhrase?: string;
  dealerMood?: string;
  isDealing?: boolean;
  isShuffling?: boolean;
  isCelebrating?: boolean;
  onHit?: () => void;
  onStand?: () => void;
  onDouble?: () => void;
  onTipDealer?: () => void;
  soundEnabled?: boolean;
  onToggleSound?: () => void;
  cardStyle?: string;
  cardCount?: number;
  winStreak?: number;
  lossStreak?: number;
  gamePhase?: string;
  disabled?: boolean;
  children?: ReactNode;
  // Allow game-specific extensions without requiring a new interface per table
  [k: string]: any;
}
