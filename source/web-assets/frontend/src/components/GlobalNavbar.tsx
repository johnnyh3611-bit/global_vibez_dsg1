/**
 * GlobalNavbar — INLINE primary IA strip (founder directive: never sticky).
 *
 * Mounted beside PageActionStrip inside ProtectedRoute so it scrolls with
 * the page. Highlights Earn (emerald) per DESIGN_STRATEGY Phase 1.
 * Mobile uses MobileBottomNav instead (md:hidden here).
 */
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
    highlight: true as const,
  },
  { key: "wallet", route: "/wallet", label: "Wallet", Icon: Wallet },
];

export default function GlobalNavbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname;

  const isActive = (route: string) => {
    if (route === "/dashboard") return path === "/dashboard";
    return path === route || path.startsWith(`${route}/`);
  };

  return (
    <nav
      className="hidden w-full items-center gap-1 overflow-x-auto pb-0.5 md:flex"
      data-testid="global-navbar"
      aria-label="Primary jobs"
    >
      {LINKS.map(({ key, route, label, Icon, highlight }) => {
        const active = isActive(route);
        if (highlight) {
          return (
            <button
              key={key}
              type="button"
              onClick={() => {
                triggerHaptic("medium");
                navigate(route);
              }}
              data-testid={`global-nav-${key}`}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition ${
                active
                  ? "bg-gradient-to-r from-emerald-500 to-green-500 text-black shadow-[0_0_16px_rgba(16,185,129,0.45)]"
                  : "border border-emerald-400/50 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          );
        }
        return (
          <button
            key={key}
            type="button"
            onClick={() => {
              triggerHaptic("light");
              navigate(route);
            }}
            data-testid={`global-nav-${key}`}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              active
                ? "bg-white/15 text-white"
                : "text-white/55 hover:bg-white/5 hover:text-white"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        );
      })}
    </nav>
  );
}
