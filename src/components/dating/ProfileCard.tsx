"use client";

import { useState } from "react";
import { DatingProfile } from "@/lib/dating/profiles";

interface ProfileCardProps {
  profile: DatingProfile;
  onLike: () => void;
  onPass: () => void;
  loading?: boolean;
}

export function ProfileCard({ profile, onLike, onPass, loading }: ProfileCardProps) {
  const [icebreakers, setIcebreakers] = useState<string[]>([]);
  const [icebreakerLoading, setIcebreakerLoading] = useState(false);
  const [icebreakerError, setIcebreakerError] = useState<string | null>(null);

  async function handleIcebreaker() {
    setIcebreakerLoading(true);
    setIcebreakerError(null);
    setIcebreakers([]);

    try {
      const response = await fetch("/api/dating/icebreaker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileData: { bio: profile.bio } }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to generate icebreakers");
      }

      setIcebreakers(data.icebreakers);
    } catch (error) {
      setIcebreakerError(
        error instanceof Error ? error.message : "Failed to generate icebreakers"
      );
    } finally {
      setIcebreakerLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-950">
      <div className="bg-gradient-to-br from-violet-500 to-fuchsia-500 px-6 py-16 text-center">
        <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-white/20 text-4xl font-bold text-white backdrop-blur">
          {profile.name[0]}
        </div>
      </div>

      <div className="space-y-4 p-6">
        <div>
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            {profile.name}, {profile.age}
          </h2>
          <p className="text-sm text-zinc-500">{profile.location}</p>
        </div>

        <p className="text-zinc-600 dark:text-zinc-400">{profile.bio}</p>

        <div className="flex flex-wrap gap-2">
          {profile.interests.map((interest) => (
            <span
              key={interest}
              className="rounded-full bg-violet-100 px-3 py-1 text-xs font-medium text-violet-700 dark:bg-violet-900/40 dark:text-violet-300"
            >
              {interest}
            </span>
          ))}
        </div>

        <div className="space-y-3 rounded-xl border border-violet-200 bg-violet-50/60 p-4 dark:border-violet-900/50 dark:bg-violet-950/30">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-violet-900 dark:text-violet-200">
              AI icebreakers
            </p>
            <button
              type="button"
              onClick={handleIcebreaker}
              disabled={loading || icebreakerLoading}
              className="rounded-full bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-violet-700 disabled:opacity-50"
            >
              {icebreakerLoading ? "Generating..." : "Generate"}
            </button>
          </div>

          {icebreakerError && (
            <p className="text-sm text-red-500" role="alert">
              {icebreakerError}
            </p>
          )}

          {icebreakers.length > 0 && (
            <ul className="space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
              {icebreakers.map((line) => (
                <li
                  key={line}
                  className="rounded-lg bg-white/80 px-3 py-2 dark:bg-zinc-900/60"
                >
                  {line}
                </li>
              ))}
            </ul>
          )}

          {!icebreakerLoading && icebreakers.length === 0 && !icebreakerError && (
            <p className="text-sm text-zinc-500">
              Get opening lines powered by local Ollama.
            </p>
          )}
        </div>

        <div className="flex gap-3 pt-2">
          <button
            onClick={onPass}
            disabled={loading}
            className="flex-1 rounded-full border border-zinc-300 py-3 text-sm font-semibold transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Pass
          </button>
          <button
            onClick={onLike}
            disabled={loading}
            className="flex-1 rounded-full bg-violet-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-violet-700 disabled:opacity-50"
          >
            Like
          </button>
        </div>
      </div>
    </div>
  );
}
