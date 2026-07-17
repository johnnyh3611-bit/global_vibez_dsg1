/**
 * Display labels for chair phases. Backend may still store "Apex"
 * (Escape Velocity unlock / final $250 tier); product no longer markets
 * that brand name publicly.
 */
export function chairPhaseLabel(phase?: string | null): string {
  if (!phase) return "";
  if (phase === "Apex") return "Final Phase";
  return phase;
}
