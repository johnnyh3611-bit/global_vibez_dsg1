import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, RotateCcw, HelpCircle, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface GameStat {
  label: string;
  value: React.ReactNode;
  color?: 'cyan' | 'purple' | 'green' | 'yellow' | 'red' | 'pink' | 'blue';
}

export interface GameShellProps {
  /** Display title */
  title: string;
  /** Optional emoji or icon shown next to the title */
  emoji?: React.ReactNode;
  /** Short subtitle shown under the title */
  subtitle?: string;
  /** Background gradient tailwind classes */
  bgGradient?: string;
  /** Optional back handler. If omitted the back button is hidden. */
  onBack?: () => void;
  /** Optional restart/new-game handler. If omitted the restart button is hidden. */
  onRestart?: () => void;
  /** Optional how-to-play handler. If omitted the help button is hidden. */
  onHelp?: () => void;
  /** Compact stats badges shown under the header */
  stats?: GameStat[];
  /** Fixed bottom control bar content (buttons, actions, etc.) */
  controls?: React.ReactNode;
  /** Optional status message shown between title and content */
  status?: string;
  /** Whether the AI/status spinner should show */
  aiThinking?: boolean;
  /** Main game board/content */
  children?: React.ReactNode;
  /** Optional modal/overlay rendered on top (win screens, etc.) */
  modal?: React.ReactNode;
  /** Extra CSS classes for the main content area */
  className?: string;
}

const colorMap: Record<string, string> = {
  cyan: 'from-cyan-600 to-blue-600 border-cyan-400',
  purple: 'from-purple-600 to-fuchsia-600 border-purple-400',
  green: 'from-green-600 to-emerald-600 border-green-400',
  yellow: 'from-yellow-600 to-amber-600 border-yellow-400',
  red: 'from-red-600 to-rose-600 border-red-400',
  pink: 'from-pink-600 to-rose-600 border-pink-400',
  blue: 'from-blue-600 to-indigo-600 border-blue-400',
};

export const GameShell: React.FC<GameShellProps> = ({
  title,
  emoji,
  subtitle,
  bgGradient = 'from-slate-950 via-indigo-950 to-purple-950',
  onBack,
  onRestart,
  onHelp,
  stats,
  controls,
  status,
  aiThinking = false,
  children,
  modal,
  className = '',
}) => {
  return (
    <div
      className={`min-h-screen w-full relative overflow-hidden bg-gradient-to-br ${bgGradient} text-white`}
      style={{ WebkitFontSmoothing: 'antialiased' }}
      data-testid="game-shell"
    >
      {/* Ambient lighting — Vibez cyan / indigo neon (matches landing) */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-64 h-64 sm:w-96 sm:h-96 bg-cyan-500/15 rounded-full blur-[80px] sm:blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-64 h-64 sm:w-96 sm:h-96 bg-indigo-600/18 rounded-full blur-[80px] sm:blur-[120px]" />
      </div>

      {/* Top bar */}
      <div className="sticky top-0 z-50 w-full bg-black/40 backdrop-blur-xl border-b border-cyan-400/20">
        <div className="max-w-7xl mx-auto px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {onBack && (
                <Button
                  onClick={onBack}
                  variant="ghost"
                  size="sm"
                  className="text-white hover:bg-white/10 -ml-2 shrink-0"
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              )}
              {emoji && (
                <span className="text-2xl sm:text-3xl shrink-0" aria-hidden="true">
                  {emoji}
                </span>
              )}
              <div className="min-w-0">
                <h1 className="text-lg sm:text-2xl font-black truncate bg-clip-text text-transparent bg-gradient-to-r from-cyan-300 via-purple-300 to-pink-300">
                  {title}
                </h1>
                {subtitle && (
                  <p className="text-white/60 text-xs sm:text-sm truncate hidden sm:block">
                    {subtitle}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1 sm:gap-2 shrink-0">
              {onHelp && (
                <Button
                  onClick={onHelp}
                  variant="ghost"
                  size="sm"
                  className="text-white hover:bg-white/10"
                  title="How to play"
                >
                  <HelpCircle className="h-5 w-5" />
                </Button>
              )}
              {onRestart && (
                <Button
                  onClick={onRestart}
                  variant="ghost"
                  size="sm"
                  className="text-white hover:bg-white/10 hidden sm:flex"
                >
                  <RotateCcw className="h-4 w-4 mr-1" />
                  New Game
                </Button>
              )}
              {onRestart && (
                <Button
                  onClick={onRestart}
                  variant="ghost"
                  size="sm"
                  className="text-white hover:bg-white/10 sm:hidden"
                  title="New game"
                >
                  <RotateCcw className="h-5 w-5" />
                </Button>
              )}
            </div>
          </div>

          {/* Stats row */}
          {stats && stats.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2 sm:gap-3">
              {stats.map((stat, i) => {
                const colorClass = colorMap[stat.color ?? 'cyan'] || colorMap.cyan;
                return (
                  <motion.div
                    key={`${stat.label}-${i}`}
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: i * 0.05 }}
                    className={`px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl border bg-gradient-to-br ${colorClass} bg-opacity-20`}
                    style={{ background: 'rgba(255,255,255,0.08)' }}
                  >
                    <p className="text-white/70 text-[10px] sm:text-xs font-bold leading-tight uppercase tracking-wider">
                      {stat.label}
                    </p>
                    <div className="text-white text-sm sm:text-lg font-black leading-tight">
                      {stat.value}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* Status bar */}
          {status && (
            <div className="mt-3 flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
              {aiThinking && (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full"
                />
              )}
              <p className="text-white/80 text-xs sm:text-sm font-medium">{status}</p>
            </div>
          )}
        </div>
      </div>

      {/* Main content */}
      <main
        className={`relative z-10 max-w-7xl mx-auto px-4 pt-4 pb-32 sm:px-6 sm:pt-6 sm:pb-40 flex flex-col ${className}`}
      >
        {children}
      </main>

      {/* Bottom control bar */}
      {controls && (
        <div className="fixed bottom-[72px] left-0 right-0 z-40 px-4 py-3 sm:bottom-0 sm:px-6 sm:py-4 pointer-events-none">
          <div className="max-w-3xl mx-auto pointer-events-auto">
            <div className="bg-black/60 backdrop-blur-xl border border-cyan-400/20 rounded-2xl p-3 sm:p-4 shadow-2xl">
              {controls}
            </div>
          </div>
        </div>
      )}

      {/* Bottom gradient fade so controls don't feel abrupt on mobile */}
      <div className="fixed bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none z-30" />

      {/* Modal overlay */}
      {modal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          {modal}
        </div>
      )}

      {/* Trophy watermark */}
      <div className="absolute bottom-4 right-4 opacity-5 pointer-events-none hidden sm:block">
        <Trophy className="w-24 h-24" />
      </div>
    </div>
  );
};

export default GameShell;
