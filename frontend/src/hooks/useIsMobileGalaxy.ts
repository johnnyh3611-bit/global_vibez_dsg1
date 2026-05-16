/**
 * useIsMobileGalaxy — Planet-Shift mobile UX groundwork (2026-05-17).
 *
 * Volumetric Galaxy / Planet shift on mobile needs to:
 *   - drop Three.js star count + DPR (saves ~30-40% GPU time on phones)
 *   - kill autorotate (drains battery + fights touch drag)
 *   - widen the camera lens so 6 planets don't crowd a 360px viewport
 *   - lean on the carousel arrows instead of free-spin drag
 *
 * This is a tiny matchMedia-backed hook (NOT a heavy resize observer) so
 * mounting on a desktop ssr/csr boundary is safe. The breakpoint matches
 * Tailwind's `md` (768px) so the rest of the UI shares the same
 * mobile/desktop split.
 *
 * Why a hook (not a util constant): React Three Fiber re-uses the
 * Canvas across renders, but a one-shot window.innerWidth check would
 * miss orientation changes (portrait ↔ landscape on tablets). A hook
 * subscribes to matchMedia and re-renders the consumer cleanly.
 */
import { useEffect, useState } from "react";

const MOBILE_QUERY = "(max-width: 767px)";

export function useIsMobileGalaxy(): boolean {
  // Default to `false` on SSR so the desktop config doesn't flash on
  // hydration; the first useEffect tick corrects it.
  const [isMobile, setIsMobile] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia(MOBILE_QUERY);
    const apply = () => setIsMobile(mql.matches);
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

  return isMobile;
}
