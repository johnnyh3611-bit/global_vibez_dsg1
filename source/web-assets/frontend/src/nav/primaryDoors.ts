/**
 * Four-door front door — canonical primary IA for Global Vibez DSG.
 * Play · Date · Watch · Earn (+ Beta Hub for experimental surfaces).
 */
import {
  Home,
  Gamepad2,
  Heart,
  Radio,
  DollarSign,
  Rocket,
  type LucideIcon,
} from "lucide-react";

export type DoorTone = "earn" | undefined;

export type PrimaryDoor = {
  key: string;
  route: string;
  label: string;
  Icon: LucideIcon;
  tone?: DoorTone;
  blurb: string;
};

/** Exactly four primary action hubs. */
export const PRIMARY_DOORS: PrimaryDoor[] = [
  {
    key: "play",
    route: "/games",
    label: "Play",
    Icon: Gamepad2,
    blurb: "Games, tables, and practice",
  },
  {
    key: "date",
    route: "/dating/discover",
    label: "Date",
    Icon: Heart,
    blurb: "Discover matches and rooms",
  },
  {
    key: "watch",
    route: "/streams",
    label: "Watch",
    Icon: Radio,
    blurb: "Live streams and DSG TV",
  },
  {
    key: "earn",
    route: "/earn",
    label: "Earn",
    Icon: DollarSign,
    tone: "earn",
    blurb: "Chairs, rewards, and wallet",
  },
];

/** Collapsible overflow for lifestyle / experimental features. */
export const BETA_HUB_DOOR: PrimaryDoor = {
  key: "beta",
  route: "/beta-hub",
  label: "Beta",
  Icon: Rocket,
  blurb: "Experimental lifestyle & ops surfaces",
};

/** Desktop strip: four doors + Beta (Wallet lives under Earn). */
export const DESKTOP_NAV: PrimaryDoor[] = [...PRIMARY_DOORS, BETA_HUB_DOOR];

/** Mobile dock: Home + four doors. */
export const MOBILE_NAV: PrimaryDoor[] = [
  {
    key: "home",
    route: "/dashboard",
    label: "Home",
    Icon: Home,
    blurb: "Dashboard",
  },
  ...PRIMARY_DOORS,
];

export function matchDoorKey(
  pathname: string,
  doors: readonly PrimaryDoor[],
): string {
  const hit = doors.find(({ route, key }) => {
    if (key === "home" || route === "/dashboard") {
      return pathname === "/dashboard";
    }
    if (key === "play") {
      return (
        pathname === "/games" ||
        pathname.startsWith("/games/") ||
        pathname.startsWith("/vibe-654") ||
        pathname.startsWith("/spades") ||
        pathname.startsWith("/bid-whist")
      );
    }
    if (key === "date") {
      return pathname.startsWith("/dating") || pathname.startsWith("/speed-dating");
    }
    if (key === "watch") {
      return (
        pathname.startsWith("/streams") ||
        pathname.startsWith("/live") ||
        pathname.startsWith("/dsg-tv")
      );
    }
    if (key === "earn") {
      return (
        pathname.startsWith("/earn") ||
        pathname.startsWith("/wallet") ||
        pathname.startsWith("/chair")
      );
    }
    return pathname === route || pathname.startsWith(`${route}/`);
  });
  return hit?.key ?? "";
}
