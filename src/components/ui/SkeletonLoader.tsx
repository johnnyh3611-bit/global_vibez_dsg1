"use client";

/**
 * Skeleton Loaders for better perceived performance
 * Show while images/data load (animated gray boxes)
 */

export function SkeletonCard({ count = 1 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="animate-pulse rounded-glass border border-surface-glass-border bg-surface-glass p-6"
        >
          {/* Title skeleton */}
          <div className="mb-4 h-6 w-32 rounded-glass bg-surface-glass-strong" />

          {/* Content skeleton */}
          <div className="space-y-3">
            <div className="h-4 w-full rounded-glass bg-surface-glass-strong" />
            <div className="h-4 w-5/6 rounded-glass bg-surface-glass-strong" />
            <div className="h-4 w-4/5 rounded-glass bg-surface-glass-strong" />
          </div>

          {/* Footer skeleton */}
          <div className="mt-4 h-10 w-24 rounded-full bg-surface-glass-strong" />
        </div>
      ))}
    </>
  );
}

export function SkeletonText({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, idx) => (
        <div
          key={idx}
          className={`animate-pulse rounded-glass bg-surface-glass-strong ${
            idx === lines - 1 ? "h-4 w-4/5" : "h-4 w-full"
          }`}
        />
      ))}
    </div>
  );
}

export function SkeletonImage({
  width = 300,
  height = 200,
}: {
  width?: number;
  height?: number;
}) {
  return (
    <div
      className="animate-pulse rounded-glass bg-surface-glass-strong"
      style={{ width: `${width}px`, height: `${height}px` }}
    />
  );
}

export function SkeletonGrid({ columns = 3, count = 6 }: { columns?: number; count?: number }) {
  return (
    <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-${columns}`}>
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="animate-pulse space-y-3 rounded-glass border border-surface-glass-border p-4"
        >
          <div className="h-32 w-full rounded-glass bg-surface-glass-strong" />
          <div className="space-y-2">
            <div className="h-4 w-3/4 rounded-glass bg-surface-glass-strong" />
            <div className="h-3 w-1/2 rounded-glass bg-surface-glass-strong" />
          </div>
        </div>
      ))}
    </div>
  );
}
