/**
 * GlobalNavbar — INLINE primary IA strip (founder directive: never sticky).
 *
 * Four doors: Play · Date · Watch · Earn (+ Beta Hub overflow).
 * Uses My Vibez (VibezTabStyle) tray; Earn keeps emerald accent.
 * Mobile uses MobileBottomNav instead (md:hidden here).
 */
import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { triggerHaptic } from "@/hooks/useGestures";
import VibezTabStyle from "@/components/ui/VibezTabStyle";
import { DESKTOP_NAV, matchDoorKey } from "@/nav/primaryDoors";

export default function GlobalNavbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname;

  const activeKey = useMemo(() => matchDoorKey(path, DESKTOP_NAV), [path]);

  return (
    <nav
      className="hidden w-full md:block"
      data-testid="global-navbar"
      aria-label="Primary jobs"
    >
      <VibezTabStyle
        ariaLabel="Primary jobs"
        variant="pills"
        testId="global-navbar-tabs"
        value={activeKey}
        onChange={(key) => {
          const link = DESKTOP_NAV.find((l) => l.key === key);
          if (!link) return;
          triggerHaptic(link.tone === "earn" ? "medium" : "light");
          navigate(link.route);
        }}
        options={DESKTOP_NAV.map(({ key, label, Icon, tone }) => ({
          value: key,
          label,
          icon: Icon,
          tone,
          testId: `global-nav-${key}`,
        }))}
      />
    </nav>
  );
}
