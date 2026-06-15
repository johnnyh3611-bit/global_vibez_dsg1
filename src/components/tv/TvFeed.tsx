"use client";

import { useCallback, useEffect, useState } from "react";
import { GlobalCard } from "@/components/ui/GlobalCard";
import { brand } from "@/styles/design-tokens";
import type { BroadcastItem } from "@/lib/tv/broadcast-feed";
import type { VideoScriptKind } from "@/lib/tv/content-engine";

const KIND_LABEL: Record<VideoScriptKind, string> = {
  "game-highlight": "Highlight",
  "winner-announcement": "Winners",
  "economic-recap": "House Report",
};

const POLL_MS = 8000;

function ClipStage({ item }: { item: BroadcastItem }) {
  const { script, clip } = item;
  if (clip.status === "ready" && clip.url) {
    return (
      <video
        className="h-full w-full object-cover"
        src={clip.url}
        autoPlay
        muted
        loop
        playsInline
      />
    );
  }

  // No real clip yet (mock provider or still rendering): render a generated
  // poster from the script's overlay tokens.
  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center"
      style={{
        background: `radial-gradient(circle at 50% 30%, ${script.overlay.glow}33, transparent 60%), ${script.overlay.background}`,
      }}
    >
      <span
        className="text-[11px] font-semibold uppercase tracking-[0.35em]"
        style={{ color: script.overlay.accent }}
      >
        {clip.status === "ready" ? "Now Playing" : "Rendering…"}
      </span>
      <p className="text-2xl font-bold text-white sm:text-3xl">
        {script.scenes[0]?.caption ?? script.title}
      </p>
      <p className="max-w-md text-sm text-white/60">{script.narration}</p>
    </div>
  );
}

export function TvFeed() {
  const [items, setItems] = useState<BroadcastItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/tv/feed", { cache: "no-store" });
      const data = await res.json();
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch {
      setError("Could not reach the broadcast feed.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initial = setTimeout(load, 0);
    const timer = setInterval(load, POLL_MS);
    return () => {
      clearTimeout(initial);
      clearInterval(timer);
    };
  }, [load]);

  async function goLive() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/tv/feed", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Broadcast failed");
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Broadcast failed");
    } finally {
      setGenerating(false);
    }
  }

  const [featured, ...rest] = items;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="flex h-2.5 w-2.5 items-center justify-center">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
          </span>
          <span className="text-xs font-semibold uppercase tracking-[0.3em] text-white/70">
            {items.length > 0 ? "On Air" : "Standby"}
          </span>
        </div>
        <button
          type="button"
          onClick={goLive}
          disabled={generating}
          className={brand.button}
        >
          {generating ? "Generating…" : "Generate broadcast"}
        </button>
      </div>

      {error && (
        <p className="mb-4 text-sm text-red-300">{error}</p>
      )}

      {loading ? (
        <GlobalCard className="p-10 text-center text-white/60">
          Tuning in…
        </GlobalCard>
      ) : featured ? (
        <>
          <GlobalCard className="overflow-hidden p-0">
            <div className="relative aspect-video w-full bg-background-abyss">
              <ClipStage item={featured} />
              <span className="absolute left-4 top-4 rounded-full bg-black/50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-brand-accent backdrop-blur-md">
                {KIND_LABEL[featured.script.kind]}
              </span>
            </div>
            <div className="px-6 py-4">
              <h2 className="text-lg font-bold">{featured.script.title}</h2>
              <p className="mt-1 text-sm text-white/60">
                {featured.script.narration}
              </p>
            </div>
          </GlobalCard>

          {rest.length > 0 && (
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {rest.map((item) => (
                <GlobalCard
                  key={item.script.id}
                  interactive
                  className="overflow-hidden p-0"
                >
                  <div className="relative aspect-video w-full bg-background-abyss">
                    <ClipStage item={item} />
                    <span className="absolute left-3 top-3 rounded-full bg-black/50 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.25em] text-brand-accent backdrop-blur-md">
                      {KIND_LABEL[item.script.kind]}
                    </span>
                  </div>
                  <div className="px-4 py-3">
                    <p className="truncate text-sm font-semibold">
                      {item.script.title}
                    </p>
                  </div>
                </GlobalCard>
              ))}
            </div>
          )}
        </>
      ) : (
        <GlobalCard className="p-10 text-center text-white/60">
          No broadcasts yet. Hit “Generate broadcast” to put the network on air.
        </GlobalCard>
      )}
    </div>
  );
}
