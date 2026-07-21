/**
 * VibezTabChrome — titled header row for closable tabs / panels / drawers.
 *
 * Structure matches the standard tab chrome:
 *   [ tab title ................. ] [ Close ]
 *
 * Uses My Vibez glass styling (not gray Material). Close always stops
 * propagation so clicking it never flips the parent tab/trigger.
 */
import React from "react";
import { cn } from "@/lib/utils";
import { VibezCloseControl, type VibezCloseSize } from "@/components/ui/VibezCloseControl";

export type VibezTabChromeProps = {
  /** Visible tab / panel title. */
  title: React.ReactNode;
  /** Optional subtitle under the title. */
  subtitle?: React.ReactNode;
  /** Close handler — required for closable chrome. */
  onClose: () => void;
  /** Visible close label — defaults to "Close". */
  closeLabel?: string;
  closeSize?: VibezCloseSize;
  closeTestId?: string;
  /** Extra content between title and close (badges, actions). */
  trailing?: React.ReactNode;
  className?: string;
  titleClassName?: string;
  testId?: string;
};

export function VibezTabChrome({
  title,
  subtitle,
  onClose,
  closeLabel = "Close",
  closeSize = "sm",
  closeTestId,
  trailing,
  className,
  titleClassName,
  testId,
}: VibezTabChromeProps) {
  return (
    <div
      data-testid={testId}
      className={cn(
        "flex items-center justify-between gap-2 px-3 py-2",
        "border-b border-white/10 bg-white/5 rounded-t-2xl",
        className
      )}
    >
      <div className="min-w-0 flex-1">
        <div
          className={cn(
            "text-sm font-bold text-white truncate",
            titleClassName
          )}
        >
          {title}
        </div>
        {subtitle ? (
          <div className="text-[10px] uppercase tracking-widest text-white/50 truncate mt-0.5">
            {subtitle}
          </div>
        ) : null}
      </div>

      {trailing ? <div className="shrink-0 flex items-center gap-1.5">{trailing}</div> : null}

      <VibezCloseControl
        size={closeSize}
        label={closeLabel}
        testId={closeTestId}
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      />
    </div>
  );
}

export default VibezTabChrome;
