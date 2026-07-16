/**
 * Client-side "next game" recommendations from local play history
 * plus optional mining / practice aggregates.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { authFetch } from "@/utils/secureAuth";

const API = process.env.REACT_APP_BACKEND_URL;
const LS_KEY = "gv_recent_games";
const MAX_RECENT = 12;

export type RecentGame = {
  id: string;
  name: string;
  at: number;
};

export type RecommendedGame = {
  id: string;
  name: string;
  href: string;
  reason: string;
  score: number;
};

const SPECIAL_ROUTES: Record<string, string> = {
  spades: "/spades",
  spades_universal: "/spades",
  bid_whist: "/bid-whist",
  bid_whist_premium: "/bid-whist",
  bid_whist_platinum: "/bid-whist",
  vibe_654_dice: "/vibe-654-hall",
  vibez_654: "/vibe-654-hall",
  vibe_654: "/vibe-654-hall",
  poker: "/multiplayer",
  blackjack: "/practice/play/blackjack",
};

function prettyName(id: string, fallback?: string) {
  if (fallback) return fallback;
  return id.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function hrefForGame(id: string): string {
  return SPECIAL_ROUTES[id] || `/practice/play/${id}`;
}

export function readRecentGames(): RecentGame[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function recordRecentGame(game: { id: string; name?: string }) {
  if (!game?.id) return;
  try {
    const prev = readRecentGames().filter((g) => g.id !== game.id);
    const next: RecentGame[] = [
      { id: game.id, name: prettyName(game.id, game.name), at: Date.now() },
      ...prev,
    ].slice(0, MAX_RECENT);
    localStorage.setItem(LS_KEY, JSON.stringify(next));
  } catch {
    // ignore quota / private mode
  }
}

function scoreFromRecent(recent: RecentGame[]): Map<string, number> {
  const scores = new Map<string, number>();
  recent.forEach((g, idx) => {
    const recency = Math.max(1, MAX_RECENT - idx);
    scores.set(g.id, (scores.get(g.id) || 0) + recency * 3);
  });
  return scores;
}

export function useRecommendedGames(limit = 3) {
  const [recent, setRecent] = useState<RecentGame[]>(() => readRecentGames());
  const [remoteScores, setRemoteScores] = useState<
    Record<string, { score: number; name?: string }>
  >({});

  const refreshRecent = useCallback(() => {
    setRecent(readRecentGames());
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const scores: Record<string, { score: number; name?: string }> = {};
      try {
        const mining = await authFetch(
          `${API}/api/mining/my-history?limit=40`,
          {}
        );
        if (mining.ok) {
          const data = await mining.json();
          (data.by_game || []).forEach(
            (row: { game_type: string; wins?: number; mined?: number }, i: number) => {
              const id = row.game_type;
              if (!id) return;
              const boost = (row.wins || 0) * 4 + (row.mined || 0) + (8 - i);
              scores[id] = {
                score: (scores[id]?.score || 0) + boost,
                name: prettyName(id),
              };
            }
          );
        }
      } catch {
        /* optional */
      }

      try {
        const practice = await fetch(`${API}/api/practice/stats`);
        if (practice.ok) {
          const data = await practice.json();
          const byType = data.games_by_type || data.by_game || {};
          Object.entries(byType).forEach(([id, count]) => {
            const n = Number(count) || 0;
            if (!id || n <= 0) return;
            scores[id] = {
              score: (scores[id]?.score || 0) + n * 2,
              name: prettyName(id),
            };
          });
        }
      } catch {
        /* optional */
      }

      if (!cancelled) setRemoteScores(scores);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const recommendations = useMemo(() => {
    const scores = scoreFromRecent(recent);
    Object.entries(remoteScores).forEach(([id, meta]) => {
      scores.set(id, (scores.get(id) || 0) + meta.score);
    });

    const nameFor = (id: string) =>
      recent.find((g) => g.id === id)?.name ||
      remoteScores[id]?.name ||
      prettyName(id);

    const reasonFor = (id: string, score: number) => {
      if (recent.some((g) => g.id === id)) return "Play again";
      if (remoteScores[id]?.score) return "Based on your wins";
      return score > 0 ? "Suggested for you" : "Popular pick";
    };

    // Seed defaults when history is empty so the strip isn't blank.
    const seeds = ["spades", "bid_whist", "vibe_654_dice"];
    seeds.forEach((id, i) => {
      if (!scores.has(id)) scores.set(id, 1 - i * 0.1);
    });

    return Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([id, score]) => ({
        id,
        name: nameFor(id),
        href: hrefForGame(id),
        reason: reasonFor(id, score),
        score,
      })) as RecommendedGame[];
  }, [limit, recent, remoteScores]);

  return { recommendations, recent, refreshRecent, recordRecentGame };
}
