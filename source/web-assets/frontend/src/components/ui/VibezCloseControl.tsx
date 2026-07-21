/**
 * VibezCloseControl — labeled close control for docks, menus, and panels.
 *
 * Matches the My Vibez / VibezTabStyle glass language. Always shows a visible
 * "Close" (or contextual) label so users are never hunting a blank X target.
 */
import React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export type VibezCloseSize = "sm" | "md";

export const vibezCloseControlClass = (opts?: {
  size?: VibezCloseSize;
  className?: string;
}): string => {
  const size = opts?.size ?? "sm";
  return cn(
    "inline-flex items-center justify-center gap-1.5 shrink-0 font-bold transition-all duration-200",
    "rounded-xl border border-white/15 bg-white/5 text-white/80",
    "hover:bg-white/10 hover:text-white hover:border-white/25",
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950",
    size === "sm" && "min-h-8 px-2.5 py-1 text-[11px] tracking-wide",
    size === "md" && "min-h-9 px-3 py-1.5 text-xs tracking-wide",
    opts?.className
  );
};

export type VibezCloseControlProps = {
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  /** Visible label — defaults to "Close". */
  label?: string;
  /** Accessible name — defaults to `label`. */
  "aria-label"?: string;
  size?: VibezCloseSize;
  className?: string;
  testId?: string;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
};

export const VibezCloseControl = React.forwardRef<
  HTMLButtonElement,
  VibezCloseControlProps
>(function VibezCloseControl(
  {
    onClick,
    label = "Close",
    "aria-label": ariaLabel,
    size = "sm",
    className,
    testId,
    type = "button",
    disabled,
  },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel || label}
      data-testid={testId}
      className={vibezCloseControlClass({ size, className })}
    >
      <X className={size === "md" ? "w-4 h-4" : "w-3.5 h-3.5"} aria-hidden />
      <span>{label}</span>
    </button>
  );
});

export default VibezCloseControl;
