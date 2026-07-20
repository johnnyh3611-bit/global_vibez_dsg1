/**
 * Vibez subject catalog — planet-aware nav + filter subjects for VibezSidebar.
 * My Vibez design standard: vertical subjects replace horizontal top tabs.
 */
import type { LucideIcon } from "lucide-react";
import {
  Sparkles,
  Users,
  Gamepad2,
  Heart,
  Radio,
  Scale,
  Spade,
  Layers,
  Trophy,
  Zap,
  Star,
  Tv,
  Music,
  Utensils,
  MessageCircle,
  Gem,
  LayoutDashboard,
  Video,
  MapPin,
  Wallet,
  Flame,
  TrendingUp,
} from "lucide-react";

export type VibezPlanet =
  | "home"
  | "games"
  | "dating"
  | "streams"
  | "network"
  | "vibez"
  | "lifestyle"
  | "settings"
  | "generic";

export type VibezSubjectKind = "nav" | "filter";

export interface VibezSubject {
  id: string;
  label: string;
  icon?: LucideIcon;
  /** Navigate here when selected (nav subjects). */
  href?: string;
  kind: VibezSubjectKind;
  testId?: string;
}

export interface VibezActivityItem {
  id: string;
  title: string;
  meta: string;
  href?: string;
  accent?: string;
}

export function detectPlanet(pathname: string): VibezPlanet {
  if (
    pathname.startsWith("/games") ||
    pathname.startsWith("/spades") ||
    pathname.startsWith("/blackjack") ||
    pathname.startsWith("/poker") ||
    pathname.startsWith("/practice") ||
    pathname.startsWith("/bid-whist") ||
    pathname.startsWith("/vibe-654") ||
    pathname.startsWith("/vibez-654") ||
    pathname.startsWith("/dice") ||
    pathname.startsWith("/tournaments") ||
    pathname.startsWith("/multiplayer")
  ) {
    return "games";
  }
  if (pathname.startsWith("/dating") || pathname.startsWith("/speed-dating")) {
    return "dating";
  }
  if (
    pathname.startsWith("/streams") ||
    pathname.startsWith("/live") ||
    pathname.startsWith("/watch") ||
    pathname.startsWith("/cinema")
  ) {
    return "streams";
  }
  if (pathname.startsWith("/network") || pathname.startsWith("/ai-judge")) {
    return "network";
  }
  if (
    pathname.startsWith("/vibez") ||
    pathname.startsWith("/my-vibez") ||
    pathname === "/me"
  ) {
    return "vibez";
  }
  if (
    pathname.startsWith("/hungry") ||
    pathname.startsWith("/rides") ||
    pathname.startsWith("/vibe-spots") ||
    pathname.startsWith("/datespot")
  ) {
    return "lifestyle";
  }
  if (pathname.startsWith("/settings")) return "settings";
  if (
    pathname === "/dashboard" ||
    pathname === "/" ||
    pathname.startsWith("/hub/")
  ) {
    return "home";
  }
  return "generic";
}

/** Primary planet jump links — always shown at top of sidebar. */
export const PLANET_LINKS: VibezSubject[] = [
  {
    id: "planet-home",
    label: "Home",
    icon: LayoutDashboard,
    href: "/dashboard",
    kind: "nav",
    testId: "vibez-nav-home",
  },
  {
    id: "planet-games",
    label: "Games",
    icon: Gamepad2,
    href: "/games",
    kind: "nav",
    testId: "vibez-nav-games",
  },
  {
    id: "planet-dating",
    label: "Dating",
    icon: Heart,
    href: "/dating",
    kind: "nav",
    testId: "vibez-nav-dating",
  },
  {
    id: "planet-streams",
    label: "Streams",
    icon: Radio,
    href: "/streams",
    kind: "nav",
    testId: "vibez-nav-streams",
  },
  {
    id: "planet-judge",
    label: "AI Judge",
    icon: Scale,
    href: "/network/judge",
    kind: "nav",
    testId: "vibez-nav-judge",
  },
  {
    id: "planet-vibez",
    label: "My Vibez",
    icon: Sparkles,
    href: "/my-vibez",
    kind: "nav",
    testId: "vibez-nav-my-vibez",
  },
  {
    id: "planet-venues",
    label: "Venues",
    icon: MapPin,
    href: "/vibe-spots",
    kind: "nav",
    testId: "vibez-nav-venues",
  },
  {
    id: "planet-wallet",
    label: "Wallet",
    icon: Wallet,
    href: "/wallet",
    kind: "nav",
    testId: "vibez-nav-wallet",
  },
];

const HOME_SUBJECTS: VibezSubject[] = [
  { id: "watch", label: "Watch", icon: Tv, kind: "filter", testId: "vibez-subject-watch" },
  { id: "dating", label: "Dating", icon: Heart, kind: "filter", testId: "vibez-subject-dating" },
  { id: "games", label: "Games", icon: Gamepad2, kind: "filter", testId: "vibez-subject-games" },
  { id: "music", label: "Music", icon: Music, kind: "filter", testId: "vibez-subject-music" },
  { id: "lifestyle", label: "Lifestyle", icon: Utensils, kind: "filter", testId: "vibez-subject-lifestyle" },
  { id: "social", label: "Social", icon: MessageCircle, kind: "filter", testId: "vibez-subject-social" },
  { id: "earnings", label: "Earnings", icon: Gem, kind: "filter", testId: "vibez-subject-earnings" },
  { id: "all", label: "All", icon: Sparkles, kind: "filter", testId: "vibez-subject-all" },
];

const GAMES_SUBJECTS: VibezSubject[] = [
  { id: "featured", label: "Featured", icon: Sparkles, kind: "filter", testId: "games-category-tab-featured" },
  { id: "card", label: "Card Games", icon: Gamepad2, kind: "filter", testId: "games-category-tab-card" },
  { id: "casino", label: "Casino", icon: Star, kind: "filter", testId: "games-category-tab-casino" },
  { id: "board", label: "Board Games", icon: Trophy, kind: "filter", testId: "games-category-tab-board" },
  { id: "arcade", label: "Arcade", icon: Zap, kind: "filter", testId: "games-category-tab-arcade" },
  { id: "party", label: "Party", icon: Users, kind: "filter", testId: "games-category-tab-party" },
  { id: "room-spades", label: "Spades", icon: Spade, href: "/spades", kind: "nav", testId: "vibez-room-spades" },
  { id: "room-bj", label: "Blackjack", icon: Layers, href: "/blackjack-universal", kind: "nav", testId: "vibez-room-bj" },
  { id: "room-judge", label: "AI Judge", icon: Scale, href: "/network/judge", kind: "nav", testId: "vibez-room-judge" },
];

const DATING_SUBJECTS: VibezSubject[] = [
  { id: "discover", label: "Discover", icon: Heart, href: "/dating/discover", kind: "nav", testId: "vibez-dating-discover" },
  { id: "matches", label: "Matches", icon: Flame, href: "/dating/matches", kind: "nav", testId: "vibez-dating-matches" },
  { id: "vibe-check", label: "Vibe Check", icon: Sparkles, href: "/dating/vibe-check", kind: "nav", testId: "vibez-dating-vibe-check" },
];

const STREAMS_SUBJECTS: VibezSubject[] = [
  { id: "all", label: "All", icon: Radio, kind: "filter", testId: "vibez-streams-all" },
  { id: "gaming", label: "Gaming", icon: Gamepad2, kind: "filter", testId: "vibez-streams-gaming" },
  { id: "dating", label: "Dating", icon: Heart, kind: "filter", testId: "vibez-streams-dating" },
  { id: "casual", label: "Casual", icon: MessageCircle, kind: "filter", testId: "vibez-streams-casual" },
  { id: "music", label: "Music", icon: Music, kind: "filter", testId: "vibez-streams-music" },
  { id: "art", label: "Art", icon: Sparkles, kind: "filter", testId: "vibez-streams-art" },
  { id: "live-now", label: "Live Wall", icon: Video, href: "/streams/live", kind: "nav", testId: "vibez-streams-live" },
];

const NETWORK_SUBJECTS: VibezSubject[] = [
  { id: "judge", label: "AI Judge", icon: Scale, href: "/network/judge", kind: "nav", testId: "vibez-network-judge" },
  { id: "feed", label: "Activity", icon: TrendingUp, kind: "filter", testId: "vibez-network-feed" },
];

const VIBEZ_SUBJECTS: VibezSubject[] = [
  { id: "for_you", label: "For You", icon: Sparkles, kind: "filter", testId: "myvibez-page-tab-for-you" },
  { id: "following", label: "Following", icon: Users, kind: "filter", testId: "myvibez-page-tab-following" },
  { id: "gaming", label: "Gaming", icon: Gamepad2, kind: "filter", testId: "myvibez-page-tab-gaming" },
  { id: "dating", label: "Dating", icon: Heart, kind: "filter", testId: "myvibez-page-tab-dating" },
  { id: "trending", label: "Trending", icon: TrendingUp, kind: "filter", testId: "vibez-feed-tab-trending" },
  { id: "upload", label: "Upload", icon: Video, href: "/vibez/upload", kind: "nav", testId: "vibez-upload" },
  { id: "profile", label: "Profile", icon: Star, href: "/me", kind: "nav", testId: "vibez-profile" },
];

const LIFESTYLE_SUBJECTS: VibezSubject[] = [
  { id: "venues", label: "Venues", icon: MapPin, href: "/vibe-spots", kind: "nav" },
  { id: "hungry", label: "Hungry Vibez", icon: Utensils, href: "/hungry-vibez", kind: "nav" },
  { id: "rides", label: "Rides", icon: Zap, href: "/rides", kind: "nav" },
];

const SETTINGS_SUBJECTS: VibezSubject[] = [
  { id: "sound", label: "Sound", kind: "filter", testId: "settings-tab-nav-sound" },
  { id: "ai-dealer", label: "AI Dealer", kind: "filter", testId: "settings-ai-dealer-tab" },
  { id: "language", label: "Language", kind: "filter", testId: "settings-language-tab" },
  { id: "game", label: "Game", kind: "filter", testId: "settings-tab-nav-game" },
  { id: "display", label: "Display", kind: "filter", testId: "settings-tab-nav-display" },
  { id: "notifications", label: "Alerts", kind: "filter", testId: "settings-tab-nav-notifications" },
  { id: "privacy", label: "Privacy", kind: "filter", testId: "settings-tab-nav-privacy" },
];

const GENERIC_SUBJECTS: VibezSubject[] = [
  { id: "explore", label: "Explore", icon: Sparkles, href: "/explore", kind: "nav" },
  { id: "earn", label: "Earn", icon: Gem, href: "/earn", kind: "nav" },
];

export function subjectsForPlanet(planet: VibezPlanet): VibezSubject[] {
  switch (planet) {
    case "home":
      return HOME_SUBJECTS;
    case "games":
      return GAMES_SUBJECTS;
    case "dating":
      return DATING_SUBJECTS;
    case "streams":
      return STREAMS_SUBJECTS;
    case "network":
      return NETWORK_SUBJECTS;
    case "vibez":
      return VIBEZ_SUBJECTS;
    case "lifestyle":
      return LIFESTYLE_SUBJECTS;
    case "settings":
      return SETTINGS_SUBJECTS;
    default:
      return GENERIC_SUBJECTS;
  }
}

export function defaultSubjectId(planet: VibezPlanet, pathname: string): string {
  const subjects = subjectsForPlanet(planet);
  if (pathname.includes("/network/judge")) return "judge";
  if (pathname.startsWith("/dating/matches")) return "matches";
  if (pathname.startsWith("/dating")) return "discover";
  if (pathname.startsWith("/streams")) return "all";
  if (planet === "games") return "featured";
  if (planet === "home") return "watch";
  if (planet === "vibez") {
    if (pathname.startsWith("/vibez")) return "trending";
    return "for_you";
  }
  return subjects[0]?.id ?? "all";
}

export function planetLabel(planet: VibezPlanet): string {
  const labels: Record<VibezPlanet, string> = {
    home: "Home",
    games: "Games Suite",
    dating: "Dating",
    streams: "Streams",
    network: "Network",
    vibez: "My Vibez",
    lifestyle: "Lifestyle",
    settings: "Settings",
    generic: "Explore",
  };
  return labels[planet];
}

/** Seed activity feed — TikTok-style vertical engagement strip. */
export function activityFeedForPlanet(planet: VibezPlanet): VibezActivityItem[] {
  const base: VibezActivityItem[] = [
    {
      id: "a1",
      title: "Live table heat rising",
      meta: "Spades · 12 watching",
      href: "/spades",
      accent: "from-fuchsia-500 to-pink-500",
    },
    {
      id: "a2",
      title: "AI Judge open session",
      meta: "Cast your vote",
      href: "/network/judge",
      accent: "from-violet-500 to-fuchsia-500",
    },
    {
      id: "a3",
      title: "Venue spotlight drop",
      meta: "Partner chairs live",
      href: "/vibe-spots",
      accent: "from-amber-500 to-pink-500",
    },
    {
      id: "a4",
      title: "My Vibez trending",
      meta: "For You refresh",
      href: "/my-vibez",
      accent: "from-pink-500 to-rose-500",
    },
  ];
  if (planet === "dating") {
    return [
      { id: "d1", title: "New vibe matches", meta: "3 nearby", href: "/dating/matches", accent: "from-rose-500 to-pink-500" },
      ...base.slice(0, 2),
    ];
  }
  if (planet === "streams") {
    return [
      { id: "s1", title: "Going live now", meta: "Gaming rooms", href: "/streams/live", accent: "from-red-500 to-pink-500" },
      ...base.slice(1, 3),
    ];
  }
  return base;
}
