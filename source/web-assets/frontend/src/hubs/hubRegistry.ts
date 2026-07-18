/**
 * Work / lifestyle hubs — each has a home dashboard people can open
 * from the landing globe or the in-app Hub Switcher.
 *
 * Prefer linking to real existing dashboards when they exist; brand
 * shells (VibeRise, VibeVineyards) use /hub/:id until deeper pages land.
 */
export type HubId =
  | "vibe"
  | "viberise"
  | "vineyards"
  | "ridez"
  | "cdl"
  | "hungry"
  | "merchant"
  | "venues"
  | "dating"
  | "media";

export type HubDef = {
  id: HubId;
  label: string;
  short: string;
  blurb: string;
  /** Primary dashboard URL after login */
  dashboardPath: string;
  /** Accent class for chips */
  accent: string;
  /** Shown on landing globe */
  onGlobe?: boolean;
  globeLeft?: string;
  globeTop?: string;
  testid: string;
  /** Quick links inside the hub shell */
  links: { label: string; to: string }[];
};

export const HUBS: HubDef[] = [
  {
    id: "vibe",
    label: "Vibe Home",
    short: "Home",
    blurb: "Games, dates, cinema, wallet — everyday Vibez.",
    dashboardPath: "/dashboard",
    accent: "text-cyan-200 border-cyan-400/40",
    onGlobe: true,
    globeLeft: "50%",
    globeTop: "18%",
    testid: "hub-vibe",
    links: [
      { label: "Dashboard", to: "/dashboard" },
      { label: "Games", to: "/games" },
      { label: "Cinema Room", to: "/cinema-room" },
      { label: "Wallet", to: "/wallet" },
    ],
  },
  {
    id: "viberise",
    label: "VibeRise",
    short: "Rise",
    blurb: "Creators & streamers — studio, tips, Broadcast Director.",
    dashboardPath: "/hub/viberise",
    accent: "text-violet-200 border-violet-400/40",
    onGlobe: true,
    globeLeft: "74%",
    globeTop: "32%",
    testid: "hub-viberise",
    links: [
      { label: "Streamer Studio", to: "/streamer/studio" },
      { label: "Broadcast Director", to: "/dashboard/streamer/broadcast-director" },
      { label: "My Streams", to: "/my-streams" },
      { label: "Setup Guide", to: "/streamer/setup-guide" },
      { label: "Artist Studio", to: "/artist/dashboard" },
    ],
  },
  {
    id: "vineyards",
    label: "Vibe Vineyards",
    short: "Vineyards",
    blurb: "Lifestyle, venues, hosts — local nights & tables.",
    dashboardPath: "/hub/vineyards",
    accent: "text-rose-200 border-rose-400/40",
    onGlobe: true,
    globeLeft: "26%",
    globeTop: "34%",
    testid: "hub-vineyards",
    links: [
      { label: "Vibe Venues", to: "/vibe-venues" },
      { label: "Host Dashboard", to: "/vibe-venues/host-dashboard" },
      { label: "Yellow Pages", to: "/yellow-pages" },
      { label: "Dating", to: "/dating" },
    ],
  },
  {
    id: "ridez",
    label: "Vibe Ridez",
    short: "Ridez",
    blurb: "Drivers & riders — dispatch, tips, SmartStack.",
    dashboardPath: "/vibe-ridez/driver-dashboard",
    accent: "text-emerald-200 border-emerald-400/40",
    onGlobe: true,
    globeLeft: "22%",
    globeTop: "55%",
    testid: "hub-ridez",
    links: [
      { label: "Driver Dashboard", to: "/vibe-ridez/driver-dashboard" },
      { label: "Dispatch", to: "/vibe-ridez/dispatch" },
      { label: "Find a Ride", to: "/vibe-ridez/search" },
      { label: "SmartStack", to: "/smartstack" },
      { label: "Ridez Home", to: "/vibe-ridez" },
    ],
  },
  {
    id: "cdl",
    label: "CDL / ELD",
    short: "CDL",
    blurb: "Commercial drivers — ELD hours, trip track.",
    dashboardPath: "/vibe-ridez/eld",
    accent: "text-amber-200 border-amber-400/40",
    onGlobe: true,
    globeLeft: "38%",
    globeTop: "72%",
    testid: "hub-cdl",
    links: [
      { label: "ELD Dashboard", to: "/vibe-ridez/eld" },
      { label: "Driver Dashboard", to: "/vibe-ridez/driver-dashboard" },
      { label: "Become a Driver", to: "/vibe-ridez/become-a-driver" },
    ],
  },
  {
    id: "hungry",
    label: "Hungry Vibez",
    short: "Hungry",
    blurb: "Food fleet + merchant kitchen tools.",
    dashboardPath: "/hub/hungry",
    accent: "text-orange-200 border-orange-400/40",
    onGlobe: true,
    globeLeft: "62%",
    globeTop: "70%",
    testid: "hub-hungry",
    links: [
      { label: "Hungry Vibez", to: "/hungryvibes" },
      { label: "Merchant Kitchen", to: "/hungryvibes/merchant" },
    ],
  },
  {
    id: "merchant",
    label: "Merchant",
    short: "Merchant",
    blurb: "Local businesses — chairs, DSG TV flights, blasts.",
    dashboardPath: "/merchant/dashboard",
    accent: "text-fuchsia-200 border-fuchsia-400/40",
    onGlobe: false,
    testid: "hub-merchant",
    links: [
      { label: "Merchant Dashboard", to: "/merchant/dashboard" },
      { label: "Join Genius Phase", to: "/merchant/join" },
      { label: "Leaderboard", to: "/merchant/leaderboard" },
    ],
  },
  {
    id: "venues",
    label: "Venues",
    short: "Venues",
    blurb: "Book spaces · host tools.",
    dashboardPath: "/vibe-venues/host-dashboard",
    accent: "text-pink-200 border-pink-400/40",
    onGlobe: false,
    testid: "hub-venues",
    links: [
      { label: "Venues", to: "/vibe-venues" },
      { label: "Host Dashboard", to: "/vibe-venues/host-dashboard" },
    ],
  },
  {
    id: "dating",
    label: "Dating",
    short: "Dating",
    blurb: "Discover, match, co-watch, Vibe Phone.",
    dashboardPath: "/dating",
    accent: "text-rose-200 border-rose-400/40",
    onGlobe: true,
    globeLeft: "78%",
    globeTop: "52%",
    testid: "hub-dating",
    links: [
      { label: "Discover", to: "/dating/discover" },
      { label: "Matches", to: "/dating/matches" },
      { label: "Cinema Date", to: "/cinema-room" },
      { label: "Vibe Phone", to: "/vibe-phone" },
    ],
  },
  {
    id: "media",
    label: "Media Master",
    short: "Media",
    blurb: "DSG TV, radio, music group.",
    dashboardPath: "/media-master",
    accent: "text-sky-200 border-sky-400/40",
    onGlobe: false,
    testid: "hub-media",
    links: [
      { label: "Media Master", to: "/media-master" },
      { label: "Broadcast Director", to: "/dashboard/streamer/broadcast-director" },
      { label: "Music Group", to: "/music-group" },
    ],
  },
];

export const HUB_BY_ID: Record<string, HubDef> = Object.fromEntries(
  HUBS.map((h) => [h.id, h]),
);

export const GLOBE_HUBS = HUBS.filter((h) => h.onGlobe);

export const PREFERRED_HUB_KEY = "gv_preferred_hub";
export const RETURN_TO_KEY = "gv_return_to";

export function getHub(id: string | null | undefined): HubDef {
  if (id && HUB_BY_ID[id]) return HUB_BY_ID[id];
  return HUB_BY_ID.vibe;
}

export function setPreferredHub(id: HubId) {
  try {
    localStorage.setItem(PREFERRED_HUB_KEY, id);
  } catch {
    /* ignore */
  }
}

export function getPreferredHubId(): HubId {
  try {
    const v = localStorage.getItem(PREFERRED_HUB_KEY) as HubId | null;
    if (v && HUB_BY_ID[v]) return v;
  } catch {
    /* ignore */
  }
  return "vibe";
}

/** Remember where an unauthenticated user wanted to go (globe / deep link). */
export function stashReturnTo(path: string) {
  try {
    if (path && path.startsWith("/") && !path.startsWith("//")) {
      localStorage.setItem(RETURN_TO_KEY, path);
    }
  } catch {
    /* ignore */
  }
}

export function consumeReturnTo(fallback = "/dashboard"): string {
  try {
    const v = localStorage.getItem(RETURN_TO_KEY);
    localStorage.removeItem(RETURN_TO_KEY);
    if (v && v.startsWith("/") && !v.startsWith("//")) return v;
  } catch {
    /* ignore */
  }
  return fallback;
}

/** Navigate to a hub: remember preference + stash path for login bounce. */
export function openHubPath(hub: HubDef): string {
  setPreferredHub(hub.id);
  stashReturnTo(hub.dashboardPath);
  return hub.dashboardPath;
}
