import * as React from "react";

import { cn } from "@/lib/utils";

export interface GlobalCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Adds hover/press affordances for clickable cards. */
  interactive?: boolean;
}

export const GlobalCard = React.forwardRef<HTMLDivElement, GlobalCardProps>(
  ({ className, interactive, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-2xl border border-surface-glass-border/40 bg-surface-glass/50 p-6 backdrop-blur-xl shadow-[0_8px_32px_-8px_rgba(0,0,0,0.5)]",
        interactive && "cursor-pointer transition-all duration-200 hover:border-surface-glass-border/70 hover:bg-surface-glass/60 hover:-translate-y-0.5 hover:shadow-[0_12px_40px_-8px_rgba(217,70,239,0.15)]",
        className
      )}
      {...props}
    />
  )
);
GlobalCard.displayName = "GlobalCard";

export default GlobalCard;
