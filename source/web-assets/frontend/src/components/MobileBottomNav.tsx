/**
 * MobileBottomNav — Sticky bottom-tab navigator for phone-class viewports.
 * Four doors: Home · Play · Date · Watch · Earn.
 * Beta Hub is reached from the dashboard collapsible / desktop Beta tab.
 */
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import useIsFullscreenGameRoute from "@/hooks/useIsFullscreenGameRoute";
import VibezTabStyle from "@/components/ui/VibezTabStyle";
import { MOBILE_NAV, matchDoorKey } from "@/nav/primaryDoors";

function useIsMobile(): boolean {
  const [is, setIs] = useState<boolean>(
    typeof window !== "undefined" ? window.innerWidth < 768 : false,
  );
  useEffect(() => {
    const onResize = () => setIs(window.innerWidth < 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return is;
}

const HIDDEN_ROUTES = ["/", "/auth", "/login", "/signup"];

export default function MobileBottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const isFullscreenGame = useIsFullscreenGameRoute();

  const shouldShow =
    isMobile &&
    !HIDDEN_ROUTES.includes(location.pathname) &&
    !isFullscreenGame;

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.getElementById("root");
    if (!root) return;
    if (shouldShow) {
      root.classList.add("gv-bottom-nav-visible");
    } else {
      root.classList.remove("gv-bottom-nav-visible");
    }
    return () => root.classList.remove("gv-bottom-nav-visible");
  }, [shouldShow]);

  const activeKey = useMemo(
    () => matchDoorKey(location.pathname, MOBILE_NAV) || "home",
    [location.pathname],
  );

  if (!shouldShow) return null;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-black/85 backdrop-blur-xl md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      data-testid="mobile-bottom-nav"
    >
      <div className="px-2 pt-1.5 pb-1">
        <VibezTabStyle
          ariaLabel="Primary mobile navigation"
          variant="dock"
          testId="mobile-bottom-nav-tabs"
          value={activeKey}
          onChange={(key) => {
            const tab = MOBILE_NAV.find((t) => t.key === key);
            if (tab) navigate(tab.route);
          }}
          options={MOBILE_NAV.map(({ key, label, Icon, tone }) => ({
            value: key,
            label,
            icon: Icon,
            tone,
            testId: `mobile-nav-${key}`,
          }))}
        />
      </div>
    </nav>
  );
}
