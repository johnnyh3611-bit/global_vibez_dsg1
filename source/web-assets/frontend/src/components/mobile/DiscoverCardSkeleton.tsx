import { Skeleton } from "@/components/ui/skeleton";

/** Skeleton for dating discover while profiles load. */
export function DiscoverCardSkeleton() {
  return (
    <div
      className="w-full max-w-md animate-pulse"
      data-testid="discover-card-skeleton"
      aria-busy="true"
      aria-label="Loading profiles"
    >
      <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/5">
        <Skeleton className="h-96 w-full rounded-none bg-white/10" />
        <div className="space-y-3 p-6">
          <Skeleton className="h-8 w-2/3 bg-white/15" />
          <Skeleton className="h-4 w-1/3 bg-white/10" />
          <Skeleton className="h-16 w-full bg-white/10" />
          <div className="flex gap-2">
            <Skeleton className="h-7 w-16 rounded-full bg-white/10" />
            <Skeleton className="h-7 w-20 rounded-full bg-white/10" />
            <Skeleton className="h-7 w-14 rounded-full bg-white/10" />
          </div>
        </div>
      </div>
      <div className="mt-8 flex items-center justify-center gap-6">
        <Skeleton className="h-16 w-16 rounded-full bg-white/10" />
        <Skeleton className="h-20 w-20 rounded-full bg-white/15" />
        <Skeleton className="h-16 w-16 rounded-full bg-white/10" />
      </div>
    </div>
  );
}
