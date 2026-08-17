/**
 * Universal GameCarousel — horizontal, snap-to-center game cards.
 *
 * Each card shows logo / art, a short description, and Play Now.
 * Selecting a card (or tapping Play Now) calls `onSelect`, which
 * should fetch / start game state for that title.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  motion,
  useMotionValue,
  animate,
  type PanInfo,
} from "framer-motion";
import { Play } from "lucide-react";

export interface GameCarouselItem {
  id: string;
  name: string;
  description?: string;
  image?: string;
  emoji?: string;
  badge?: string;
}

export interface GameCarouselProps {
  games: GameCarouselItem[];
  /** Called when a card is activated — parent fetches / starts game state. */
  onSelect: (game: GameCarouselItem) => void | Promise<void>;
  /** Optional initially centered game id. */
  initialActiveId?: string;
  /** Disable interactions while a start request is in flight. */
  busy?: boolean;
  className?: string;
  /** Section heading above the track. */
  title?: string;
}

const CARD_GAP = 16;

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function GameCarousel({
  games,
  onSelect,
  initialActiveId,
  busy = false,
  className = "",
  title = "Quick Play",
}: GameCarouselProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [cardWidth, setCardWidth] = useState(280);
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  const [selectingId, setSelectingId] = useState<string | null>(null);

  useEffect(() => {
    if (!games.length) return;
    if (initialActiveId) {
      const idx = games.findIndex((g) => g.id === initialActiveId);
      if (idx >= 0) setActiveIndex(idx);
    }
  }, [games, initialActiveId]);

  const measure = useCallback(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const vw = vp.clientWidth;
    const next = Math.min(280, Math.max(220, vw * 0.72));
    setCardWidth(next);
  }, []);

  useEffect(() => {
    measure();
    const ro = new ResizeObserver(measure);
    if (viewportRef.current) ro.observe(viewportRef.current);
    return () => ro.disconnect();
  }, [measure]);

  const offsetForIndex = useCallback(
    (index: number) => {
      const vp = viewportRef.current;
      if (!vp) return 0;
      const centerPad = (vp.clientWidth - cardWidth) / 2;
      return -(index * (cardWidth + CARD_GAP)) + centerPad;
    },
    [cardWidth],
  );

  const snapTo = useCallback(
    (index: number) => {
      const next = clamp(index, 0, Math.max(games.length - 1, 0));
      setActiveIndex(next);
      animate(x, offsetForIndex(next), {
        type: "spring",
        stiffness: 280,
        damping: 32,
        mass: 0.85,
      });
    },
    [games.length, offsetForIndex, x],
  );

  useEffect(() => {
    snapTo(activeIndex);
    // Re-center when card width changes (orientation / resize).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardWidth, games.length]);

  const nearestIndex = useCallback(() => {
    const vp = viewportRef.current;
    if (!vp || !games.length) return 0;
    const centerPad = (vp.clientWidth - cardWidth) / 2;
    const current = x.get();
    const raw = (-current + centerPad) / (cardWidth + CARD_GAP);
    return clamp(Math.round(raw), 0, games.length - 1);
  }, [cardWidth, games.length, x]);

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    const velocityBias = info.velocity.x > 400 ? -1 : info.velocity.x < -400 ? 1 : 0;
    snapTo(nearestIndex() + velocityBias);
  };

  const handleSelect = async (game: GameCarouselItem) => {
    if (busy || selectingId) return;
    setSelectingId(game.id);
    try {
      await onSelect(game);
    } finally {
      setSelectingId(null);
    }
  };

  if (!games.length) return null;

  return (
    <section
      className={`gv-carousel ${className}`}
      data-testid="game-carousel"
      aria-label={title}
    >
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="text-sm font-bold tracking-wide text-cyan-200/90 uppercase">
          {title}
        </h2>
        <span className="text-[11px] text-white/40 tabular-nums">
          {activeIndex + 1} / {games.length}
        </span>
      </div>

      <div ref={viewportRef} className="relative overflow-hidden">
        <motion.div
          ref={trackRef}
          className="gv-carousel-track"
          style={{ x }}
          drag="x"
          dragConstraints={{
            left: offsetForIndex(games.length - 1) - 40,
            right: offsetForIndex(0) + 40,
          }}
          dragElastic={0.12}
          onDragEnd={handleDragEnd}
        >
          {games.map((game, i) => {
            const isActive = i === activeIndex;
            const imgFailed = failedImages.has(game.id);
            const loading = selectingId === game.id;
            return (
              <motion.article
                key={game.id}
                className={`gv-carousel-card ${isActive ? "is-active" : ""}`}
                style={{ width: cardWidth, flexBasis: cardWidth }}
                data-testid={`game-carousel-card-${game.id}`}
                aria-current={isActive ? "true" : undefined}
                whileHover={{ y: -4 }}
                transition={{ type: "spring", stiffness: 400, damping: 28 }}
                onClick={() => {
                  if (!isActive) {
                    snapTo(i);
                    return;
                  }
                  void handleSelect(game);
                }}
              >
                <div className="gv-carousel-card__media">
                  {game.image && !imgFailed ? (
                    <img
                      src={game.image}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover opacity-85"
                      onError={() =>
                        setFailedImages((prev) => new Set(prev).add(game.id))
                      }
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-5xl">
                      {game.emoji ?? "🎴"}
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-cyan-500/10 to-transparent" />
                  {game.badge ? (
                    <span className="absolute top-2 right-2 rounded-full bg-cyan-400/90 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-slate-950">
                      {game.badge}
                    </span>
                  ) : null}
                </div>

                <div className="gv-carousel-card__body">
                  <h3 className="gv-carousel-card__title">{game.name}</h3>
                  <p className="gv-carousel-card__desc">
                    {game.description ||
                      "Jump into a Vibez table — practice vs AI or go live."}
                  </p>
                  <button
                    type="button"
                    className="gv-carousel-card__cta"
                    disabled={busy || loading}
                    data-testid={`game-carousel-play-${game.id}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      snapTo(i);
                      void handleSelect(game);
                    }}
                  >
                    <span className="inline-flex items-center justify-center gap-1.5">
                      <Play className="h-3.5 w-3.5 fill-current" />
                      {loading ? "Starting…" : "Play Now"}
                    </span>
                  </button>
                </div>
              </motion.article>
            );
          })}
        </motion.div>
      </div>

      {/* Dot indicators */}
      <div
        className="mt-1 flex justify-center gap-1.5"
        role="tablist"
        aria-label="Carousel position"
      >
        {games.map((g, i) => (
          <button
            key={g.id}
            type="button"
            role="tab"
            aria-selected={i === activeIndex}
            aria-label={`Show ${g.name}`}
            className={`h-1.5 rounded-full transition-all ${
              i === activeIndex
                ? "w-5 bg-gradient-to-r from-fuchsia-500 to-pink-500 shadow-[0_0_12px_rgba(232,121,249,0.55)]"
                : "w-1.5 bg-white/25 hover:bg-white/40"
            }`}
            onClick={() => snapTo(i)}
          />
        ))}
      </div>
    </section>
  );
}

export default GameCarousel;
