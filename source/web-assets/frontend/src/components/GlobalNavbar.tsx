/**
 * GlobalNavbar — INLINE primary IA strip (founder directive: never sticky).
 *
 * Mounted beside PageActionStrip inside ProtectedRoute so it scrolls with
 * the page. Uses My Vibez (VibezTabStyle) tray + fuchsia→pink active pills.
 * Earn keeps emerald accent per DESIGN_STRATEGY Phase 1.
 * Mobile uses MobileBottomNav instead (md:hidden here).
 */
import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Home,
  Gamepad2,
  Heart,
  Radio,
  DollarSign,
  Wallet,
} from "lucide-react";
import { triggerHaptic } from "@/hooks/useGestures";
import VibezTabStyle from "@/components/ui/VibezTabStyle";

const LINKS = [
  { key: "home", route: "/dashboard", label: "Home", Icon: Home },
  { key: "games", route: "/games", label: "Games", Icon: Gamepad2 },
  { key: "dating", route: "/dating/discover", label: "Dating", Icon: Heart },
  { key: "streams", route: "/streams", label: "Streams", Icon: Radio },
  {
    key: "earn",
    route: "/earn",
    label: "Earn",
    Icon: DollarSign,
    tone: "earn" as const,
  },
  { key: "wallet", route: "/wallet", label: "Wallet", Icon: Wallet },
];

export default function GlobalNavbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname;

  const activeKey = useMemo(() => {
    const hit = LINKS.find(({ route }) => {
      if (route === "/dashboard") return path === "/dashboard";
      return path === route || path.startsWith(`${route}/`);
    });
    return hit?.key ?? "";
  }, [path]);

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
          const link = LINKS.find((l) => l.key === key);
          if (!link) return;
          triggerHaptic(link.tone === "earn" ? "medium" : "light");
          navigate(link.route);
        }}
        options={LINKS.map(({ key, label, Icon, tone }) => ({
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
