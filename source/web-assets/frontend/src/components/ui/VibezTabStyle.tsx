/**
 * VibezTabStyle — My Vibez tab design system.
 *
 * Isolates the CSS/Tailwind tray, fuchsia→pink active pill, font weight,
 * and hover/focus logic used by My Vibez. Use this for every in-room and
 * suite tab bar so labels/nav logic stay room-specific while visuals match.
 */
import React from "react";
import { cn } from "@/lib/utils";

export type VibezTabVariant = "segmented" | "pills" | "sidebar";
export type VibezTabOrientation = "horizontal" | "vertical";

/** Shared design tokens (class fragments). */
export const VIBEZ_TAB = {
  tray:
    "gap-1 p-1 rounded-2xl backdrop-blur-xl bg-white/5 border border-white/10",
  triggerBase:
    "relative flex items-center justify-center gap-2 whitespace-nowrap font-bold transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:pointer-events-none disabled:opacity-50 text-xs sm:text-sm",
  triggerActive:
    "bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white shadow-[0_0_20px_rgba(232,121,249,0.6)]",
  triggerActiveSoft:
    "bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white shadow-[0_0_20px_rgba(232,121,249,0.45)]",
  triggerIdle: "text-white/60 hover:text-white hover:bg-white/5",
  iconActive: "text-white",
  iconIdle: "text-white/50",
  badgeActive: "bg-white/20 text-white",
  badgeIdle: "bg-white/10 text-white/60",
  badgeBase:
    "ml-auto text-[10px] min-w-[1.25rem] px-1.5 py-0.5 rounded-full text-center",
} as const;

export function vibezTabListClass(opts?: {
  orientation?: VibezTabOrientation;
  variant?: VibezTabVariant;
  className?: string;
}): string {
  const orientation = opts?.orientation ?? "horizontal";
  const variant = opts?.variant ?? "segmented";
  const isHorizontal = orientation === "horizontal";
  return cn(
    "flex",
    isHorizontal ? "flex-row" : "flex-col",
    VIBEZ_TAB.tray,
    variant === "pills" && "flex-nowrap overflow-x-auto scrollbar-hide",
    opts?.className
  );
}

export function vibezTabTriggerClass(opts: {
  active: boolean;
  variant?: VibezTabVariant;
  className?: string;
}): string {
  const variant = opts.variant ?? "segmented";
  return cn(
    VIBEZ_TAB.triggerBase,
    variant === "segmented" && "flex-1 px-4 py-2.5 sm:px-6 sm:py-3 rounded-xl",
    variant === "pills" && "shrink-0 px-4 py-2 rounded-xl",
    variant === "sidebar" && "w-full justify-start px-4 py-3 rounded-xl",
    opts.active
      ? variant === "sidebar"
        ? VIBEZ_TAB.triggerActiveSoft
        : VIBEZ_TAB.triggerActive
      : VIBEZ_TAB.triggerIdle,
    opts.className
  );
}

export function vibezTabIconClass(active: boolean, className?: string): string {
  return cn(
    "w-4 h-4 shrink-0",
    active ? VIBEZ_TAB.iconActive : VIBEZ_TAB.iconIdle,
    className
  );
}

export function vibezTabBadgeClass(active: boolean, className?: string): string {
  return cn(
    VIBEZ_TAB.badgeBase,
    active ? VIBEZ_TAB.badgeActive : VIBEZ_TAB.badgeIdle,
    className
  );
}

export interface VibezTabOption {
  value: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  badge?: number | string;
  testId?: string;
  disabled?: boolean;
}

export interface VibezTabStyleProps {
  value: string;
  options: VibezTabOption[];
  onChange: (value: string) => void;
  orientation?: VibezTabOrientation;
  variant?: VibezTabVariant;
  className?: string;
  ariaLabel?: string;
  /** Stable test id — defaults to vibez-tab-style */
  testId?: string;
}

/**
 * Reusable My Vibez tab bar. Room callers pass their own labels/values;
 * this component only owns the visual language.
 */
export function VibezTabStyle({
  value,
  options,
  onChange,
  orientation = "horizontal",
  variant = "segmented",
  className,
  ariaLabel,
  testId = "vibez-tab-style",
}: VibezTabStyleProps) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={vibezTabListClass({ orientation, variant, className })}
      data-orientation={orientation}
      data-variant={variant}
      data-testid={testId}
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
            disabled={opt.disabled}
            data-testid={opt.testId}
            onClick={() => onChange(opt.value)}
            className={vibezTabTriggerClass({ active, variant })}
          >
            {Icon ? <Icon className={vibezTabIconClass(active)} /> : null}
            <span className="truncate">{opt.label}</span>
            {opt.badge !== undefined ? (
              <span className={vibezTabBadgeClass(active)}>{opt.badge}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export default VibezTabStyle;
