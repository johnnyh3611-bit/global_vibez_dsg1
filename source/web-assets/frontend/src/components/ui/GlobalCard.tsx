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
        "rounded-glass border border-surface-glass-border bg-surface-glass/40 p-6 backdrop-blur",
        interactive && "cursor-pointer transition-all hover:border-brand-accent/50",
        className
      )}
      {...props}
    />
  )
);
GlobalCard.displayName = "GlobalCard";

export default GlobalCard;
