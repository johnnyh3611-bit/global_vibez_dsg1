"use client";

import { ReactNode } from "react";
import { triggerHaptic } from "@/lib/mobile/gestures";

interface HapticButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  haptic?: "light" | "medium" | "heavy" | "success" | "error" | "warning";
  variant?: "primary" | "secondary" | "tertiary" | "destructive";
}

/**
 * Button with haptic feedback on click
 * Feels more native on mobile
 */
export function HapticButton({
  children,
  haptic = "medium",
  variant = "primary",
  onClick,
  className = "",
  ...props
}: HapticButtonProps) {
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    triggerHaptic(haptic);
    onClick?.(e);
  };

  const baseClasses =
    "inline-flex min-h-11 items-center justify-center rounded-full font-semibold transition-all active:scale-95";

  const variantClasses: Record<string, string> = {
    primary:
      "bg-brand-primary px-6 text-white shadow-brand-glow hover:scale-105 hover:bg-brand-primary-hover",
    secondary:
      "border border-surface-glass-border bg-surface-glass px-6 text-white hover:bg-surface-glass/80",
    tertiary: "px-4 text-sm text-white/70 hover:text-white",
    destructive:
      "bg-red-500 px-6 text-white shadow-lg shadow-red-500/50 hover:bg-red-600",
  };

  return (
    <button
      onClick={handleClick}
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

/**
 * Icon button with haptic feedback
 * Compact version for quick actions
 */
export function HapticIconButton({
  children,
  haptic = "light",
  onClick,
  className = "",
  ...props
}: Omit<HapticButtonProps, "variant"> & { children: ReactNode }) {
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    triggerHaptic(haptic);
    onClick?.(e);
  };

  return (
    <button
      onClick={handleClick}
      className={`flex h-11 w-11 items-center justify-center rounded-full text-white/80 transition-all hover:bg-surface-glass hover:text-white active:scale-90 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
