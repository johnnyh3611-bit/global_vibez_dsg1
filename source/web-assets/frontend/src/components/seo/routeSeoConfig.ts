export const SITE_ORIGIN = "https://www.globalvibezdsg.com";
export const DEFAULT_TITLE = "Global Vibez DSG | Gaming, Dating, Streaming & Earn";
export const DEFAULT_DESCRIPTION =
  "Global Vibez DSG blends social gaming, dating, streaming, and earnings into one platform with chairs, coin packs, and live community experiences.";

export type RouteSeoConfig = {
  canonicalPath: string;
  title: string;
  description: string;
  robots?: string;
};

const EXACT_ROUTES: Record<string, RouteSeoConfig> = {
  "/": {
    canonicalPath: "/",
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
  },
  "/vibe-stakes": {
    canonicalPath: "/vibe-stakes",
    title: "Vibe Stakes | Global Vibez DSG",
    description:
      "Learn how Vibe Stakes works inside Global Vibez DSG, including chairs, circulation, rewards, and the platform's earnings model.",
  },
  "/profit-share": {
    canonicalPath: "/vibe-stakes",
    title: "Vibe Stakes | Global Vibez DSG",
    description:
      "Learn how Vibe Stakes works inside Global Vibez DSG, including chairs, circulation, rewards, and the platform's earnings model.",
  },
  "/invest": {
    canonicalPath: "/vibe-stakes",
    title: "Vibe Stakes | Global Vibez DSG",
    description:
      "Learn how Vibe Stakes works inside Global Vibez DSG, including chairs, circulation, rewards, and the platform's earnings model.",
  },
  "/beta-tester": {
    canonicalPath: "/beta-tester",
    title: "Beta Tester Waitlist | Global Vibez DSG",
    description:
      "Join the Global Vibez DSG beta tester waitlist to preview new gaming, dating, streaming, and rewards experiences.",
  },
  "/beta": {
    canonicalPath: "/beta-tester",
    title: "Beta Tester Waitlist | Global Vibez DSG",
    description:
      "Join the Global Vibez DSG beta tester waitlist to preview new gaming, dating, streaming, and rewards experiences.",
  },
  "/yellow-pages": {
    canonicalPath: "/yellow-pages",
    title: "Vibe Yellow Pages | Global Vibez DSG",
    description:
      "Browse the Global Vibez DSG Yellow Pages directory for creators, businesses, venues, and community listings.",
  },
  "/yellow-pages/new": {
    canonicalPath: "/yellow-pages/new",
    title: "Create Yellow Pages Listing | Global Vibez DSG",
    description: "Create a Yellow Pages listing in Global Vibez DSG.",
    robots: "noindex,nofollow",
  },
  "/chair-vault": {
    canonicalPath: "/chair-vault",
    title: "Chair Vault | Global Vibez DSG",
    description:
      "Explore the Global Vibez DSG Chair Vault and learn how chair ownership connects to platform rewards and access.",
  },
  "/economic-engine": {
    canonicalPath: "/economic-engine",
    title: "Economic Engine | Global Vibez DSG",
    description:
      "Read the public Global Vibez DSG economic engine overview covering circulation, wallets, chairs, and ecosystem value flow.",
  },
  "/content-rights": {
    canonicalPath: "/content-rights",
    title: "Content Rights Policy | Global Vibez DSG",
    description:
      "Review the Global Vibez DSG content rights, IP protection, and anti-piracy policy.",
  },
  "/demo": {
    canonicalPath: "/demo",
    title: "Platform Demo | Global Vibez DSG",
    description:
      "Preview Global Vibez DSG product concepts and demo experiences across gaming, social, and entertainment features.",
  },
  "/treasury": {
    canonicalPath: "/treasury",
    title: "Treasury | Global Vibez DSG",
    description:
      "Explore the public Global Vibez DSG treasury view and platform economics surfaces.",
  },
  "/modern-games": {
    canonicalPath: "/modern-games",
    title: "Modern Games Showcase | Global Vibez DSG",
    description:
      "See the Global Vibez DSG modern games showcase featuring interactive table, card, and social gaming concepts.",
  },
  "/engagement-preview": {
    canonicalPath: "/engagement-preview",
    title: "Engagement Preview | Global Vibez DSG",
    description:
      "Preview the engagement and relationship-oriented experiences inside Global Vibez DSG.",
  },
  "/celebration-demo": {
    canonicalPath: "/celebration-demo",
    title: "Celebration Demo | Global Vibez DSG",
    description:
      "Watch the celebration demo for Global Vibez DSG social and interactive product moments.",
  },
  "/tournament-demo": {
    canonicalPath: "/tournament-demo",
    title: "Tournament Demo | Global Vibez DSG",
    description:
      "Preview the Global Vibez DSG tournament demo and competitive multiplayer presentation.",
  },
  "/metahuman-dealer": {
    canonicalPath: "/metahuman-dealer",
    title: "MetaHuman Dealer Demo | Global Vibez DSG",
    description:
      "Explore the Global Vibez DSG MetaHuman dealer demo for immersive live-table experiences.",
  },
  "/private-suites": {
    canonicalPath: "/private-suites",
    title: "Private Vibe Suites | Global Vibez DSG",
    description:
      "Discover private suite concepts for premium social, dating, and entertainment sessions in Global Vibez DSG.",
  },
  "/matchmaking": {
    canonicalPath: "/matchmaking",
    title: "Skill-Based Matchmaking | Global Vibez DSG",
    description:
      "Learn about skill-based matchmaking concepts for games and social experiences in Global Vibez DSG.",
  },
  "/privacy": {
    canonicalPath: "/privacy",
    title: "Privacy Policy | Global Vibez DSG",
    description:
      "Read the Global Vibez DSG privacy policy and how the platform handles user data and safety.",
  },
  "/privacy-policy": {
    canonicalPath: "/privacy",
    title: "Privacy Policy | Global Vibez DSG",
    description:
      "Read the Global Vibez DSG privacy policy and how the platform handles user data and safety.",
  },
  "/terms": {
    canonicalPath: "/terms",
    title: "Terms of Service | Global Vibez DSG",
    description:
      "Read the Global Vibez DSG terms of service for platform use, eligibility, and community expectations.",
  },
  "/terms-of-service": {
    canonicalPath: "/terms",
    title: "Terms of Service | Global Vibez DSG",
    description:
      "Read the Global Vibez DSG terms of service for platform use, eligibility, and community expectations.",
  },
  "/login": {
    canonicalPath: "/login",
    title: "Login | Global Vibez DSG",
    description: "Sign in to Global Vibez DSG.",
    robots: "noindex,nofollow",
  },
  "/signup": {
    canonicalPath: "/signup",
    title: "Sign Up | Global Vibez DSG",
    description: "Create your Global Vibez DSG account.",
    robots: "noindex,nofollow",
  },
  "/forgot-password": {
    canonicalPath: "/forgot-password",
    title: "Forgot Password | Global Vibez DSG",
    description: "Reset your Global Vibez DSG password.",
    robots: "noindex,nofollow",
  },
  "/reset-password": {
    canonicalPath: "/reset-password",
    title: "Reset Password | Global Vibez DSG",
    description: "Choose a new Global Vibez DSG password.",
    robots: "noindex,nofollow",
  },
  "/auth-callback": {
    canonicalPath: "/auth-callback",
    title: "Signing In | Global Vibez DSG",
    description: "Completing sign-in for Global Vibez DSG.",
    robots: "noindex,nofollow",
  },
};

const PREFIX_ROUTES: Array<[prefix: string, config: RouteSeoConfig]> = [
  [
    "/yellow-pages/",
    {
      canonicalPath: "/yellow-pages",
      title: "Yellow Pages Listing | Global Vibez DSG",
      description:
        "View a public Yellow Pages listing inside the Global Vibez DSG directory.",
    },
  ],
];

export function normalizeSeoPathname(pathname: string | null | undefined) {
  if (!pathname || pathname === "/") return "/";
  return pathname.replace(/\/+$/, "") || "/";
}

export function findSeoConfig(pathname: string): RouteSeoConfig | null {
  if (EXACT_ROUTES[pathname]) return EXACT_ROUTES[pathname];
  const matchedPrefix = PREFIX_ROUTES.find(([prefix]) => pathname.startsWith(prefix));
  return matchedPrefix?.[1] ?? null;
}
