import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import CommHubButton from '@/components/common/CommHubButton';

export type RoomTheme =
  | 'spades'      // emerald + amber
  | 'hearts'      // crimson + rose
  | 'bidwhist'    // emerald + gold (kept distinct from spades by trim)
  | 'rummy'       // royal blue + cyan
  | 'ginrummy'    // teal + lime
  | 'pinochle'    // amber + brown
  | 'euchre'      // forest + ivory
  | 'crazyeights' // fuchsia + cyan
  | 'gofish'      // ocean blue + coral
  | 'war'         // crimson + steel
  | 'uno'         // red + yellow
  | 'dominoes'    // ivory + onyx
  | 'matrix'      // green-on-black hacker
  | 'baccarat'    // black tie + gold
  | 'blackjack'   // velvet + chrome
  | 'vibe654'     // obsidian violet
  | 'vibesolo'    // obsidian amber
  | 'colosseum'   // colosseum cyan-emerald
  | 'default';

interface RoomMenuBarProps {
  /** Theme applied to the menu bar background, accent, and label colors. */
  theme?: RoomTheme;
  /** Game title shown in the bar (e.g. "Spades · Premium"). */
  title: string;
  /** Optional one-line subtitle (room rules, mode, etc.). */
  subtitle?: string;
  /** Optional icon component (e.g. `Spade`, `Heart`, `Dices`). */
  icon?: React.ReactNode;
  /** Where the back button navigates (defaults to `/games`). */
  backTo?: string;
  /** Right-side action slot (e.g. wallet chip, settings cog). */
  rightSlot?: React.ReactNode;
  /** When true, renders a sticky bar at the very top with safe-area padding. */
  sticky?: boolean;
  /** data-testid suffix; final id is `room-menu-bar-{testIdSuffix}`. */
  testIdSuffix?: string;
}

const THEME_MAP: Record<
  RoomTheme,
  { bar: string; border: string; accent: string; label: string; titleGrad: string }
> = {
  spades: {
    bar: 'from-emerald-950/95 via-emerald-950/80 to-black/80',
    border: 'border-amber-500/40',
    accent: 'text-amber-300',
    label: 'SPADES',
    titleGrad: 'from-amber-200 via-yellow-300 to-emerald-200',
  },
  hearts: {
    bar: 'from-rose-950/95 via-rose-950/80 to-black/80',
    border: 'border-rose-400/40',
    accent: 'text-rose-200',
    label: 'HEARTS',
    titleGrad: 'from-rose-200 via-pink-200 to-red-300',
  },
  bidwhist: {
    bar: 'from-emerald-950/95 via-amber-950/80 to-black/80',
    border: 'border-amber-300/50',
    accent: 'text-amber-200',
    label: 'BID WHIST',
    titleGrad: 'from-amber-300 via-yellow-200 to-amber-100',
  },
  rummy: {
    bar: 'from-blue-950/95 via-indigo-950/80 to-black/80',
    border: 'border-cyan-400/40',
    accent: 'text-cyan-200',
    label: 'RUMMY',
    titleGrad: 'from-cyan-200 via-sky-200 to-blue-200',
  },
  ginrummy: {
    bar: 'from-teal-950/95 via-emerald-950/80 to-black/80',
    border: 'border-lime-300/40',
    accent: 'text-lime-200',
    label: 'GIN RUMMY',
    titleGrad: 'from-lime-200 via-teal-200 to-emerald-200',
  },
  pinochle: {
    bar: 'from-amber-950/95 via-yellow-950/80 to-black/80',
    border: 'border-amber-400/40',
    accent: 'text-amber-200',
    label: 'PINOCHLE',
    titleGrad: 'from-amber-200 via-orange-200 to-yellow-200',
  },
  euchre: {
    bar: 'from-emerald-950/95 via-stone-900/85 to-black/80',
    border: 'border-stone-200/30',
    accent: 'text-stone-100',
    label: 'EUCHRE',
    titleGrad: 'from-stone-100 via-emerald-200 to-stone-300',
  },
  crazyeights: {
    bar: 'from-fuchsia-950/95 via-purple-950/80 to-black/80',
    border: 'border-fuchsia-400/40',
    accent: 'text-fuchsia-200',
    label: 'CRAZY 8s',
    titleGrad: 'from-fuchsia-200 via-pink-200 to-cyan-200',
  },
  gofish: {
    bar: 'from-sky-950/95 via-blue-950/80 to-black/80',
    border: 'border-sky-300/40',
    accent: 'text-sky-200',
    label: 'GO FISH',
    titleGrad: 'from-sky-200 via-cyan-200 to-orange-200',
  },
  war: {
    bar: 'from-rose-950/95 via-stone-900/85 to-black/80',
    border: 'border-rose-300/40',
    accent: 'text-rose-200',
    label: 'WAR',
    titleGrad: 'from-rose-200 via-stone-200 to-rose-300',
  },
  uno: {
    bar: 'from-red-950/95 via-yellow-950/80 to-black/80',
    border: 'border-yellow-300/50',
    accent: 'text-yellow-200',
    label: 'UNO',
    titleGrad: 'from-yellow-200 via-red-300 to-yellow-300',
  },
  dominoes: {
    bar: 'from-stone-900/95 via-zinc-900/85 to-black/85',
    border: 'border-stone-300/30',
    accent: 'text-stone-200',
    label: 'DOMINOES',
    titleGrad: 'from-stone-100 via-zinc-200 to-stone-300',
  },
  matrix: {
    bar: 'from-emerald-950/95 via-black/95 to-black/95',
    border: 'border-emerald-400/40',
    accent: 'text-emerald-300',
    label: 'TIC-TAC-TOE',
    titleGrad: 'from-emerald-200 via-green-300 to-emerald-400',
  },
  baccarat: {
    bar: 'from-zinc-950/95 via-yellow-950/70 to-black/85',
    border: 'border-amber-400/40',
    accent: 'text-amber-200',
    label: 'BACCARAT',
    titleGrad: 'from-amber-200 via-yellow-300 to-amber-100',
  },
  blackjack: {
    bar: 'from-zinc-950/95 via-emerald-950/70 to-black/85',
    border: 'border-emerald-400/40',
    accent: 'text-emerald-200',
    label: 'BLACKJACK',
    titleGrad: 'from-emerald-200 via-green-300 to-emerald-100',
  },
  vibe654: {
    bar: 'from-violet-950/95 via-fuchsia-950/70 to-black/85',
    border: 'border-amber-400/40',
    accent: 'text-amber-200',
    label: 'VIBE 6-5-4',
    titleGrad: 'from-amber-300 via-fuchsia-300 to-cyan-300',
  },
  vibesolo: {
    bar: 'from-stone-950/95 via-amber-950/70 to-black/85',
    border: 'border-amber-300/50',
    accent: 'text-amber-200',
    label: 'SOLO VAULT',
    titleGrad: 'from-amber-200 via-yellow-300 to-orange-200',
  },
  colosseum: {
    bar: 'from-cyan-950/95 via-emerald-950/70 to-black/85',
    border: 'border-cyan-300/40',
    accent: 'text-cyan-200',
    label: 'COLISEUM',
    titleGrad: 'from-cyan-200 via-emerald-200 to-fuchsia-200',
  },
  default: {
    bar: 'from-zinc-950/95 via-zinc-900/80 to-black/85',
    border: 'border-zinc-400/30',
    accent: 'text-zinc-200',
    label: 'GAME ROOM',
    titleGrad: 'from-zinc-200 via-cyan-200 to-fuchsia-200',
  },
};

/**
 * Themable per-room top bar.
 *
 * Every game room (Spades, Hearts, Vibe 6-5-4, etc.) gets a visually
 * distinct menu bar via the `theme` prop while still sharing layout +
 * a11y guarantees:
 *  - Always carries a Back button mapped to the route in `backTo`
 *  - Always exposes a stable `data-testid="room-menu-bar"` plus a
 *    `data-room-theme` attribute for testing
 *  - On mobile the title row truncates so it never pushes the back
 *    button off-screen.
 */
export const RoomMenuBar: React.FC<RoomMenuBarProps> = ({
  theme = 'default',
  title,
  subtitle,
  icon,
  backTo = '/games',
  rightSlot,
  sticky = false,
  testIdSuffix,
}) => {
  const navigate = useNavigate();
  const t = THEME_MAP[theme];

  return (
    <div
      data-testid="room-menu-bar"
      data-room-theme={theme}
      data-room-suffix={testIdSuffix || ''}
      className={`${
        sticky
          ? 'sticky top-0 pt-[max(env(safe-area-inset-top),0px)]'
          : ''
      } z-30 w-full`}
    >
      <div
        className={`bg-gradient-to-r ${t.bar} border-b ${t.border} backdrop-blur-md`}
      >
        <div className="max-w-7xl mx-auto flex items-center gap-2 px-3 sm:px-5 py-2.5 sm:py-3">
          <button
            type="button"
            onClick={() => navigate(backTo)}
            data-testid="room-menu-bar-back"
            aria-label="Back"
            className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-black/50 hover:bg-black/70 border border-white/10 hover:border-white/30 transition text-xs sm:text-sm font-bold ${t.accent}`}
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Back</span>
          </button>

          <div className="flex-1 min-w-0 flex items-center gap-2">
            {icon && (
              <div className={`shrink-0 ${t.accent} hidden sm:block`}>{icon}</div>
            )}
            <div className="min-w-0">
              <div
                className={`text-sm sm:text-lg lg:text-xl font-black tracking-wider truncate bg-gradient-to-r ${t.titleGrad} bg-clip-text text-transparent`}
              >
                {title}
              </div>
              {subtitle && (
                <div
                  className={`hidden sm:block text-[10px] uppercase tracking-[0.3em] ${t.accent} opacity-80 truncate`}
                >
                  {subtitle}
                </div>
              )}
            </div>
            <div
              className={`hidden md:inline-flex ml-3 shrink-0 px-2 py-0.5 rounded-full text-[10px] font-black tracking-[0.4em] border ${t.border} ${t.accent} bg-black/40`}
            >
              {t.label}
            </div>
          </div>

          {/* Per founder directive (May 2026): the Comms Hub belongs
              inside the in-game menu bar, not floating top-right. The
              CommHubButton is auto-injected here so every game room
              picks it up without per-game wiring. The floating
              CommHubDropdown auto-hides on routes where this bar is
              mounted. */}
          <div className="shrink-0 flex items-center gap-2">
            <CommHubButton compact />
            {rightSlot}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RoomMenuBar;
