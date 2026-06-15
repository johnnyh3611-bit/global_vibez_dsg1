"use client";

/**
 * Brain Sync — a soft pulse showing the room's sub-brain is aligned with the
 * MainBrain state. Visual only; the authoritative sync happens server-side via
 * the MemoryShield on each game action.
 */
export function BrainSyncIndicator() {
  return (
    <span
      className="inline-flex min-h-11 items-center gap-2 rounded-full border border-surface-glass-border bg-surface-glass px-4 text-xs font-semibold uppercase tracking-[0.18em] text-white/70 backdrop-blur-md"
      title="Sub-brain aligned with MainBrain"
    >
      <span className="relative flex h-2.5 w-2.5" aria-hidden>
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-glow opacity-75" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-brand-accent" />
      </span>
      Brain Sync
    </span>
  );
}
