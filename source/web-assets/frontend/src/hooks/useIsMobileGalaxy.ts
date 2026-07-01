/**
 * useIsMobileGalaxy — Planet-Shift "lean profile" gate (2026-05-17).
 *
 * Returns `true` when the Volumetric Galaxy / Planet-Shift surfaces
 * should use the lean Three.js profile (fewer stars, capped DPR, no
 * autorotate, wider FOV, low-power GL hint). Two independent triggers:
 *
 *   1. Viewport width ≤ 767px (Tailwind `md` breakpoint, matchMedia).
 *      Re-evaluates on orientation flip (portrait ↔ landscape on tablets).
 *
 *   2. **Low-end device** (2026-05-17 enhancement) —
 *      `navigator.hardwareConcurrency < 4` OR `navigator.deviceMemory < 4`.
 *      Catches crusty Chromebooks, budget Android tablets, and entry-tier
 *      Surface devices that aren't strictly mobile-width but still chug
 *      on the 4000-star Stars field. Sampled once at mount (hardware
 *      doesn't change mid-session).
 *
 * Why a hook (not a util constant): React Three Fiber re-uses the
 * Canvas across renders, but a one-shot window.innerWidth check would
 * miss orientation changes. A hook subscribes to matchMedia and
 * re-renders the consumer cleanly.
 */
import { useEffect, useState } from "react";

const MOBILE_QUERY = "(max-width: 767px)";
const LOW_CPU_THRESHOLD = 4;     // <4 logical cores → lean
const LOW_MEMORY_THRESHOLD = 4;  // <4 GB RAM → lean

function detectLowEndDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  // hardwareConcurrency is widely supported. deviceMemory is Chrome /
  // Edge / Opera only — treat undefined as "unknown, don't penalize."
  const cores = (navigator as Navigator).hardwareConcurrency;
  // deviceMemory is exposed on Navigator in Chromium; not standardized.
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  if (typeof cores === "number" && cores > 0 && cores < LOW_CPU_THRESHOLD) {
    return true;
  }
  if (typeof mem === "number" && mem > 0 && mem < LOW_MEMORY_THRESHOLD) {
    return true;
  }
  return false;
}

export function useIsMobileGalaxy(): boolean {
  // Default to `false` on SSR so the desktop config doesn't flash on
  // hydration; the first useEffect tick corrects it.
  const [isLean, setIsLean] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia(MOBILE_QUERY);
    const lowEnd = detectLowEndDevice();
    const apply = () => setIsLean(mql.matches || lowEnd);
    apply();
    // Safari < 14 only supports addListener / removeListener.
    if (mql.addEventListener) {
      mql.addEventListener("change", apply);
      return () => mql.removeEventListener("change", apply);
    } else {
      mql.addListener(apply);
      return () => mql.removeListener(apply);
    }
  }, []);

  return isLean;
}
