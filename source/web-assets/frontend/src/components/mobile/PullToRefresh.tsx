import { RefreshCw } from "lucide-react";
import { usePullToRefresh } from "@/hooks/useGestures";

type Props = {
  onRefresh: () => Promise<void> | void;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
};

/**
 * Pull-down-to-refresh shell for scrollable mobile feeds.
 */
export function PullToRefresh({
  onRefresh,
  children,
  className = "",
  disabled = false,
}: Props) {
  const { pullDistance, refreshing, ready, handlers } = usePullToRefresh({
    onRefresh,
    disabled,
  });

  const indicatorOffset = refreshing ? 48 : pullDistance;

  // Do not force overflow-y-auto / overscroll-contain here — that traps
  // document scroll when wrapped in RoomLayout (dashboard after Demo Login).
  // Pull gesture uses window.scrollY when this node is not a scrollport.
  return (
    <div
      className={`relative overflow-x-hidden ${className}`}
      data-testid="pull-to-refresh"
      {...handlers}
    >
      <div
        className="pointer-events-none sticky top-0 z-20 flex justify-center"
        style={{ height: 0 }}
        aria-hidden
      >
        <div
          className={`mt-2 flex items-center gap-2 rounded-full border border-white/15 bg-black/70 px-3 py-1.5 text-xs font-semibold text-white/80 backdrop-blur transition-opacity ${
            indicatorOffset > 8 || refreshing ? "opacity-100" : "opacity-0"
          }`}
          style={{ transform: `translateY(${Math.max(indicatorOffset - 8, 0)}px)` }}
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${refreshing || ready ? "animate-spin text-emerald-300" : ""}`}
          />
          {refreshing ? "Refreshing…" : ready ? "Release to refresh" : "Pull to refresh"}
        </div>
      </div>
      {children}
    </div>
  );
}
