import { glassStyle } from "@/styles/design-tokens";

interface GlobalCardProps {
  children: React.ReactNode;
  className?: string;
  /** Adds the 2026 hover-scale interaction. */
  interactive?: boolean;
}

/**
 * Standard glass surface card. Pulls the blur/border/shadow/radius recipe from
 * the design tokens so every card matches the "Deep Violet & Glass" aesthetic.
 */
export function GlobalCard({ children, className = "", interactive = false }: GlobalCardProps) {
  return (
    <div
      className={`${glassStyle} ${
        interactive
          ? "transition-transform duration-300 hover:scale-105 hover:bg-surface-glass-strong"
          : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}
