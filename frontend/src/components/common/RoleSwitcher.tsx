/**
 * RoleSwitcher — one-tap jump between every role a user can wear.
 *
 * 2026-05-12 founder ask: "now that the rider/driver/merchant dashboards
 * all work, give me a 'Switch Role' pill in the global header. One tap to
 * jump between Rider view, Driver view, Merchant view, Streamer view —
 * dead simple for users who wear multiple hats."
 *
 * Behavior:
 *   • Floats at top-right (just under the QUICK ACCESS pill).
 *   • Closed: shows the current role label + a chevron.
 *   • Open: drops down with 5 role options. Each option:
 *       - Persists the choice in localStorage (`gv_active_role`).
 *       - Navigates to that role's home route.
 *       - Closes the dropdown.
 *   • Active role is highlighted with a fuchsia ring.
 *   • Auto-detects current role from the URL on mount so the label is
 *     always in sync with what the user is actually looking at.
 *   • Auto-hides on:
 *       - the public landing page (`/`)
 *       - auth screens (`/login`, `/signup`, `/auth/*`, `/profile/setup`)
 *       - fullscreen game routes (via body[data-chromebar-active])
 *
 * Mount: globally in App.js so every protected page surfaces it without
 * per-page wiring.
 */
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ChevronDown,
  User,
  Car,
  Pizza,
  Tv,
  Cog,
  Home,
} from "lucide-react";

type RoleKey = "rider" | "driver" | "merchant" | "host" | "streamer" | "smartstack";

type Role = {
  key: RoleKey;
  label: string;
  short: string;
  href: string;
  // Routes that should highlight this role as "active" when current path
  // starts with any of them.
  matches: string[];
  icon: React.ComponentType<{ className?: string }>;
  tint: string; // tailwind text-color for icon
};

const ROLES: Role[] = [
  {
    key: "rider",
    label: "Rider · Player",
    short: "Rider",
    href: "/dashboard",
    matches: ["/dashboard"],
    icon: User,
    tint: "text-fuchsia-300",
  },
  {
    key: "driver",
    label: "Driver",
    short: "Driver",
    href: "/vibe-ridez/driver-dashboard",
    matches: [
      "/vibe-ridez/driver",
      "/driver/dashboard",
      "/driver/earnings",
      "/driver/wallet",
      "/driver-",
    ],
    icon: Car,
    tint: "text-cyan-300",
  },
  {
    key: "merchant",
    label: "Merchant · Restaurant",
    short: "Merchant",
    href: "/hungryvibes/merchant",
    matches: ["/hungryvibes/merchant"],
    icon: Pizza,
    tint: "text-amber-300",
  },
  {
    key: "host",
    label: "Host · Vibe Venues",
    short: "Host",
    href: "/vibe-venues/host-dashboard",
    matches: ["/vibe-venues/host", "/vibe-venues/host-dashboard"],
    icon: Home,
    tint: "text-violet-300",
  },
  {
    key: "streamer",
    label: "Streamer · Creator",
    short: "Streamer",
    href: "/my-streams",
    matches: ["/my-streams", "/streamer"],
    icon: Tv,
    tint: "text-pink-300",
  },
  {
    key: "smartstack",
    label: "SmartStack Ops",
    short: "SmartStack",
    href: "/smartstack",
    matches: ["/smartstack"],
    icon: Cog,
    tint: "text-emerald-300",
  },
];

const HIDE_PREFIXES = ["/login", "/signup", "/auth", "/profile/setup", "/beta-tester"];

function activeRoleFromPath(pathname: string): RoleKey {
  for (const r of ROLES) {
    if (r.matches.some((m) => pathname.startsWith(m))) return r.key;
  }
  return "rider";
}

export default function RoleSwitcher() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<RoleKey>(() => {
    if (typeof window === "undefined") return "rider";
    const saved = (localStorage.getItem("gv_active_role") || "") as RoleKey;
    return ROLES.find((r) => r.key === saved)?.key || activeRoleFromPath(pathname);
  });
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // Keep the active label in sync with the URL.
  useEffect(() => {
    const detected = activeRoleFromPath(pathname);
    setActive(detected);
    try {
      localStorage.setItem("gv_active_role", detected);
    } catch {
      /* private mode — silent */
    }
  }, [pathname]);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Hide on auth/onboarding pages, public landing, and fullscreen game rooms.
  const onLanding = pathname === "/";
  const onHidePrefix = HIDE_PREFIXES.some((p) => pathname.startsWith(p));
  const [chromebarActive, setChromebarActive] = useState(false);
  useEffect(() => {
    const sync = () => {
      setChromebarActive(
        typeof document !== "undefined" &&
          document.body.dataset.chromebarActive === "1",
      );
    };
    sync();
    const handler = () => sync();
    window.addEventListener("chromebar:active", handler);
    window.addEventListener("chromebar:inactive", handler);
    return () => {
      window.removeEventListener("chromebar:active", handler);
      window.removeEventListener("chromebar:inactive", handler);
    };
  }, [pathname]);

  if (onLanding || onHidePrefix || chromebarActive) return null;

  const current = ROLES.find((r) => r.key === active) || ROLES[0];
  const CurrentIcon = current.icon;

  return (
    <div
      ref={wrapRef}
      className="fixed top-3 right-36 z-[60]"
      data-testid="role-switcher"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        data-testid="role-switcher-trigger"
        className="flex items-center gap-2 rounded-full bg-black/70 border border-white/15 backdrop-blur-md px-3 py-1.5 text-[11px] uppercase tracking-widest text-white hover:bg-black/90 hover:border-fuchsia-400/50 transition-colors shadow-lg shadow-black/40"
      >
        <CurrentIcon className={`w-3.5 h-3.5 ${current.tint}`} />
        <span className="hidden sm:inline font-bold">{current.short}</span>
        <span className="sm:hidden font-bold">{current.short.slice(0, 4)}</span>
        <ChevronDown
          className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Switch role"
          data-testid="role-switcher-menu"
          className="absolute right-0 mt-2 w-60 rounded-2xl border border-white/10 bg-[#0a0815]/95 backdrop-blur-xl shadow-2xl shadow-fuchsia-900/30 p-2"
        >
          <div className="text-[9px] uppercase tracking-[0.3em] text-fuchsia-300/70 px-2 py-1.5">
            Switch role
          </div>
          {ROLES.map((r) => {
            const Icon = r.icon;
            const isActive = r.key === active;
            return (
              <button
                key={r.key}
                type="button"
                role="option"
                aria-selected={isActive}
                data-testid={`role-switcher-option-${r.key}`}
                onClick={() => {
                  try {
                    localStorage.setItem("gv_active_role", r.key);
                  } catch {
                    /* private mode — silent */
                  }
                  setActive(r.key);
                  setOpen(false);
                  navigate(r.href);
                }}
                className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-left text-sm transition-colors ${
                  isActive
                    ? "bg-fuchsia-500/15 border border-fuchsia-400/40 text-white"
                    : "border border-transparent text-slate-200 hover:bg-white/5"
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${r.tint}`} />
                <span className="flex-1 font-semibold">{r.label}</span>
                {isActive && (
                  <span className="text-[9px] uppercase tracking-widest text-fuchsia-300">
                    Active
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
