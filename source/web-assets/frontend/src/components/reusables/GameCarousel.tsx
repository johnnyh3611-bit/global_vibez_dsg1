/**
 * Reusable carousel catalogue + re-export of the universal GameCarousel.
 *
 * Featured table items (including AI Judge) live here so hubs can share
 * the same snap-to-center inventory.
 */
export {
  GameCarousel,
  type GameCarouselItem,
  type GameCarouselProps,
} from "@/components/games/GameCarousel";
export { default } from "@/components/games/GameCarousel";

/** Canonical featured carousel items — same inertia/snap as Spades & Blackjack hubs. */
export const carouselItems = [
  {
    id: "spades_universal",
    name: "Spades AAA",
    description: "Classic Spades with dealing animation and hand fan.",
    image: "/spades-card.png",
    emoji: "♠️",
    badge: "✨ NEW AAA ROOM",
    path: "/spades",
  },
  {
    id: "blackjack_universal",
    name: "Blackjack Universal",
    description: "Hit, stand, and double — universal engine blackjack.",
    image: "/blackjack-card.png",
    emoji: "⚡",
    badge: "🚀 ENGINE",
    path: "/blackjack-universal",
  },
  {
    id: "ai_judge",
    name: "AI JUDGE",
    description: "Render the Verdict. Earn VibeCredits.",
    image: "/assets/icons/gavel_neon.png",
    emoji: "⚖️",
    badge: "⚖️ COURT",
    path: "/network/judge",
  },
] as const;
