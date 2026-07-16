/**
 * Phase 3 personalization — resolve a lightweight persona and reorder
 * Job Board / Earn hub categories without new backend roles.
 */

export type JobCategory = "gaming" | "dating" | "streaming" | "earning";

export type Persona =
  | "gamer"
  | "dater"
  | "streamer"
  | "earner"
  | "default";

export const DEFAULT_CATEGORY_ORDER: JobCategory[] = [
  "gaming",
  "dating",
  "streaming",
  "earning",
];

const PERSONA_ORDER: Record<Persona, JobCategory[]> = {
  gamer: ["gaming", "dating", "streaming", "earning"],
  dater: ["dating", "gaming", "streaming", "earning"],
  streamer: ["streaming", "earning", "gaming", "dating"],
  earner: ["earning", "gaming", "streaming", "dating"],
  default: DEFAULT_CATEGORY_ORDER,
};

export const PERSONA_LABEL: Record<Persona, string> = {
  gamer: "Gamer",
  dater: "Dater",
  streamer: "Streamer",
  earner: "Earner",
  default: "Explorer",
};

const DATING_INTERESTS = new Set([
  "dating",
  "relationships",
  "romance",
  "love",
  "social",
]);

const GAMING_INTERESTS = new Set([
  "gaming",
  "games",
  "esports",
  "cards",
  "casino",
]);

export function readActiveRole(): string {
  try {
    return localStorage.getItem("gv_active_role") || "";
  } catch {
    return "";
  }
}

export function resolvePersona(input?: {
  interestCategories?: string[];
  recentGameCount?: number;
  activeRole?: string;
}): Persona {
  const role = (input?.activeRole ?? readActiveRole()).toLowerCase();
  if (role === "streamer") return "streamer";
  if (role === "host" || role === "merchant" || role === "driver") {
    return "earner";
  }

  const interests = (input?.interestCategories || []).map((c) =>
    String(c).toLowerCase()
  );
  if (interests.some((c) => DATING_INTERESTS.has(c))) return "dater";
  if (
    interests.some((c) => GAMING_INTERESTS.has(c)) ||
    (input?.recentGameCount ?? 0) >= 2
  ) {
    return "gamer";
  }
  if (role === "rider") return "gamer";
  return "default";
}

export function categoryOrderForPersona(persona: Persona): JobCategory[] {
  return PERSONA_ORDER[persona] || DEFAULT_CATEGORY_ORDER;
}

/** Earn hub path ids ordered for persona. */
export function earnPathOrderForPersona(persona: Persona): string[] {
  switch (persona) {
    case "streamer":
      return ["stream", "chair", "games", "referral"];
    case "gamer":
      return ["games", "chair", "referral", "stream"];
    case "dater":
      return ["referral", "games", "chair", "stream"];
    case "earner":
      return ["chair", "referral", "games", "stream"];
    default:
      return ["chair", "referral", "games", "stream"];
  }
}
