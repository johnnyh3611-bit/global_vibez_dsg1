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
  'relative flex items-center justify-center gap-2 whitespace-nowrap font-black uppercase tracking-wider transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:pointer-events-none disabled:opacity-50';

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
      'p-1 rounded-2xl bg-slate-950/60 border border-white/10 backdrop-blur-md shadow-inner shadow-black/30',
    variant === 'pills' && 'flex-wrap gap-2',
    variant === 'sidebar' && 'gap-2',
    className
  );

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={listClasses}
      data-orientation={orientation}
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
                'flex-1 px-3 py-2 rounded-xl',
                active
                  ? 'text-cyan-950 bg-gradient-to-r from-cyan-300 to-blue-400 shadow-[0_0_20px_rgba(34,211,238,0.35)]'
                  : 'text-white/60 hover:text-white hover:bg-white/5',
              ],
              variant === 'pills' && [
                'px-4 py-2 rounded-full border',
                active
                  ? 'border-cyan-400/60 text-cyan-200 bg-cyan-500/15 shadow-[0_0_16px_rgba(34,211,238,0.25)]'
                  : 'border-white/10 text-white/60 hover:border-white/25 hover:text-white hover:bg-white/5',
              ],
              variant === 'sidebar' && [
                'w-full justify-start px-4 py-3 rounded-xl border-l-2',
                active
                  ? 'border-l-cyan-400 text-cyan-100 bg-gradient-to-r from-cyan-500/20 to-transparent shadow-[inset_0_0_20px_rgba(34,211,238,0.12)]'
                  : 'border-l-transparent text-white/50 hover:text-white hover:bg-white/5',
              ]
            )}
          >
            {Icon && <Icon className={cn('w-4 h-4', active && 'text-cyan-300')} />}
            <span className="truncate">{opt.label}</span>
            {opt.badge !== undefined && (
              <span
                className={cn(
                  'ml-auto text-[10px] min-w-[1.25rem] px-1.5 py-0.5 rounded-full text-center',
                  active
                    ? 'bg-cyan-950/50 text-cyan-100'
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
