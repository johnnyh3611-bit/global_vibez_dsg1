import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { useRecommendedGames } from "@/hooks/useRecommendedGames";
import { triggerHaptic } from "@/hooks/useGestures";

/** "Next game" strip for the Games hub. */
export function RecommendedGames({ limit = 3 }: { limit?: number }) {
  const { recommendations } = useRecommendedGames(limit);

  if (!recommendations.length) return null;

  return (
    <section
      className="mb-6 rounded-2xl border border-fuchsia-400/25 bg-fuchsia-500/10 p-4"
      data-testid="recommended-games"
      aria-label="Recommended games"
    >
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-fuchsia-300" />
        <h2 className="text-sm font-bold text-white">Recommended for you</h2>
      </div>
      <div className="flex flex-wrap gap-2">
        {recommendations.map((game) => (
          <Link
            key={game.id}
            to={game.href}
            onClick={() => triggerHaptic("medium")}
            data-testid={`recommended-game-${game.id}`}
            className="group rounded-xl border border-white/15 bg-black/30 px-3 py-2 transition hover:border-fuchsia-400/50 hover:bg-white/5"
          >
            <p className="text-sm font-semibold text-white">{game.name}</p>
            <p className="text-[11px] text-white/45">{game.reason} →</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
