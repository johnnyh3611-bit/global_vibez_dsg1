/**
 * MobileBottomNav — Sticky bottom-tab navigator for phone-class
 * viewports. Only renders when window width < 768px (Tailwind md
 * breakpoint). Lives at the App shell layer so every protected
 * route gets it for free.
 *
 * Uses My Vibez dock tray (fuchsia→pink active). Earn stays emerald.
 * Hides on fullscreen game routes so the bottom nav never covers
 * in-game CTAs like Ante In / Roll / Bid Now.
 */
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Home,
  Dice6,
  Sparkles,
  DollarSign,
  Compass,
  User,
} from "lucide-react";
import useIsFullscreenGameRoute from "@/hooks/useIsFullscreenGameRoute";
import VibezTabStyle from "@/components/ui/VibezTabStyle";

const TABS = [
  { key: "home", route: "/dashboard", label: "Home", Icon: Home },
  { key: "dice", route: "/vibe-654-hall", label: "Dice", Icon: Dice6 },
  { key: "music", route: "/plex", label: "Music", Icon: Sparkles },
  {
    key: "earn",
    route: "/earn",
    label: "Earn",
    Icon: DollarSign,
    tone: "earn" as const,
  },
  { key: "explore", route: "/explore", label: "Explore", Icon: Compass },
  { key: "profile", route: "/profile/edit", label: "Me", Icon: User },
];

function useIsMobile(): boolean {
  const [is, setIs] = useState<boolean>(
    typeof window !== "undefined" ? window.innerWidth < 768 : false
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

  const activeKey = useMemo(() => {
    const hit = TABS.find(({ route }) => {
      if (route === "/dashboard") return location.pathname === "/dashboard";
      return (
        location.pathname === route ||
        location.pathname.startsWith(`${route}/`)
      );
    });
    return hit?.key ?? "home";
  }, [location.pathname]);

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
            const tab = TABS.find((t) => t.key === key);
            if (tab) navigate(tab.route);
          }}
          options={TABS.map(({ key, label, Icon, tone }) => ({
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
