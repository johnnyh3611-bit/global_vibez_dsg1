/**
 * FuturisticTabs — shared in-app tab control.
 *
 * Visual source of truth: My Vibez feed tabs
 * (`backdrop-blur` tray + fuchsia→pink active pill).
 * Use this everywhere instead of one-off cyan/rainbow tab bars.
 */
import React from 'react';
import { cn } from '@/lib/utils';

export interface FuturisticTabOption {
  value: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  badge?: number | string;
  testId?: string;
}

interface FuturisticTabsProps {
  value: string;
  options: FuturisticTabOption[];
  onChange: (value: string) => void;
  orientation?: 'horizontal' | 'vertical';
  variant?: 'segmented' | 'pills' | 'sidebar';
  className?: string;
  ariaLabel?: string;
}

const baseTrigger =
  'relative flex items-center justify-center gap-2 whitespace-nowrap font-bold transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:pointer-events-none disabled:opacity-50';

export function FuturisticTabs({
  value,
  options,
  onChange,
  orientation = 'horizontal',
  variant = 'segmented',
  className,
  ariaLabel,
}: FuturisticTabsProps) {
  const isHorizontal = orientation === 'horizontal';

  const listClasses = cn(
    'flex',
    isHorizontal ? 'flex-row' : 'flex-col',
    variant === 'segmented' &&
      'gap-1 p-1 rounded-2xl backdrop-blur-xl bg-white/5 border border-white/10',
    variant === 'pills' &&
      'flex-nowrap overflow-x-auto gap-1 p-1 rounded-2xl backdrop-blur-xl bg-white/5 border border-white/10 scrollbar-hide',
    variant === 'sidebar' &&
      'gap-1 p-1 rounded-2xl backdrop-blur-xl bg-white/5 border border-white/10',
    className
  );

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={listClasses}
      data-orientation={orientation}
      data-testid="futuristic-tabs"
    >
      {options.map((opt) => {
        const active = value === opt.value;
        const Icon = opt.icon;

        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            data-testid={opt.testId}
            onClick={() => onChange(opt.value)}
            className={cn(
              baseTrigger,
              'text-xs sm:text-sm',
              variant === 'segmented' && [
                'flex-1 px-4 py-2.5 sm:px-6 sm:py-3 rounded-xl',
                active
                  ? 'bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white shadow-[0_0_20px_rgba(232,121,249,0.6)]'
                  : 'text-white/60 hover:text-white hover:bg-white/5',
              ],
              variant === 'pills' && [
                'shrink-0 px-4 py-2 rounded-xl',
                active
                  ? 'bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white shadow-[0_0_20px_rgba(232,121,249,0.6)]'
                  : 'text-white/60 hover:text-white hover:bg-white/5',
              ],
              variant === 'sidebar' && [
                'w-full justify-start px-4 py-3 rounded-xl',
                active
                  ? 'bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white shadow-[0_0_20px_rgba(232,121,249,0.45)]'
                  : 'text-white/60 hover:text-white hover:bg-white/5',
              ]
            )}
          >
            {Icon && (
              <Icon
                className={cn(
                  'w-4 h-4 shrink-0',
                  active ? 'text-white' : 'text-white/50'
                )}
              />
            )}
            <span className="truncate">{opt.label}</span>
            {opt.badge !== undefined && (
              <span
                className={cn(
                  'ml-auto text-[10px] min-w-[1.25rem] px-1.5 py-0.5 rounded-full text-center',
                  active
                    ? 'bg-white/20 text-white'
                    : 'bg-white/10 text-white/60'
                )}
              >
                {opt.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default FuturisticTabs;
