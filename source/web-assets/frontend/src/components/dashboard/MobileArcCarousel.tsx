/**
 * MobileArcCarousel — Planet-Shift 2D arc nav for phones (Feb 2026).
 *
 * Master Blueprint v2 spec: on phones the 3D Volumetric Galaxy is
 * replaced by a 2D arc carousel — six category "planets" splayed on a
 * gentle semicircle. The focused planet sits dead-center, larger and
 * pulsing. Swipe left / right (or tap the side planets / arrows) to
 * rotate the focused tier. Tapping the centered planet expands its
 * room tiles below.
 *
 * Why not the Three.js Canvas on phones? Beta-tester reports + the
 * lean-profile audit confirmed:
 *   • 3000+ stars + 6 hovering planets pushes mid-range Androids into
 *     5-8 fps + thermal throttling
 *   • OS-level horizontal swipe (back gesture) fights the OrbitControls
 *     drag, so users can't reliably advance planets
 *   • The Three.js bundle alone is ~500KB gzipped — a CSS arc is ~4KB.
 *
 * This component reads the SAME CATEGORIES array as the desktop scene
 * so adding a new category lights it up in both surfaces.
 */
import React, { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import MobileGalaxyTour from "@/components/dashboard/MobileGalaxyTour";

type CategoryRoom = { id: string; label: string; emoji: string; path: string };
type Category = {
  id: string;
  label: string;
  color: string;
  aura: string;
  pulsing?: boolean;
  rooms: CategoryRoom[];
};

const CATEGORY_EMOJI: Record<string, string> = {
  games: "🎮",
  dating: "💞",
  rides: "🚗",
  food: "🍕",
  streaming: "📡",
  vault: "💎",
};

const ARC_RADIUS_PX = 110;     // arc bow-out distance — gentle, fits a 360px viewport
const SWIPE_THRESHOLD = 48;    // iOS HIG "deliberate swipe" threshold

interface Props {
  categories: Category[];
  onBackToClassic: () => void;
}

const MobileArcCarousel: React.FC<Props> = ({ categories, onBackToClassic }) => {
  const navigate = useNavigate();
  const [focusedIdx, setFocusedIdx] = useState(0);
  const touchStartX = useRef<number | null>(null);

  const advance = useCallback(
    (dir: 1 | -1) => {
      setFocusedIdx((i) => (i + dir + categories.length) % categories.length);
    },
    [categories.length],
  );

  // Keyboard arrows work on tablets w/ external keyboards too.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") advance(1);
      else if (e.key === "ArrowLeft") advance(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [advance]);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) < SWIPE_THRESHOLD) return;
    advance(dx < 0 ? 1 : -1);
  };

  const focused = categories[focusedIdx];

  // Compute the three visible slots (prev / focused / next) with their
  // arc offsets. We only render 3 at a time so the layout fits a phone
  // without stacking; the remaining categories rotate in as you swipe.
  const slots = [
    { idx: (focusedIdx - 1 + categories.length) % categories.length, position: -1 },
    { idx: focusedIdx, position: 0 },
    { idx: (focusedIdx + 1) % categories.length, position: 1 },
  ];

  return (
    <div
      className="fixed inset-0 bg-gradient-to-b from-[#070219] via-[#040208] to-black text-white overflow-y-auto"
      data-testid="mobile-arc-carousel"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* First-time coach-mark walkthrough — auto-dismisses for repeat
          visitors via localStorage. */}
      <MobileGalaxyTour />
      {/* Top bar */}
      <header className="sticky top-0 z-20 px-4 py-3 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent backdrop-blur-sm">
        <button
          type="button"
          onClick={onBackToClassic}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 border border-white/20 text-[10px] uppercase tracking-widest"
          data-testid="mobile-arc-carousel-classic-btn"
        >
          <ArrowLeft className="w-3 h-3" /> Classic
        </button>
        <div className="flex items-center gap-1.5 text-fuchsia-300">
          <Sparkles className="w-4 h-4" />
          <h1 className="text-xs tracking-[0.3em] uppercase">Galaxy · Mobile</h1>
        </div>
        <span className="text-[10px] uppercase tracking-widest text-white/40">
          {focusedIdx + 1}/{categories.length}
        </span>
      </header>

      {/* Arc */}
      <div
        className="relative h-[280px] flex items-end justify-center mt-6 select-none"
        data-testid="mobile-arc-carousel-arc"
      >
        {slots.map(({ idx, position }) => {
          const cat = categories[idx];
          const isFocused = position === 0;
          // Place prev/next planets on the arc — translate X by ±radius,
          // pull down slightly to fake the bow.
          const transform = isFocused
            ? "translateX(0) scale(1.18)"
            : `translateX(${position * ARC_RADIUS_PX}px) translateY(28px) scale(0.78)`;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setFocusedIdx(idx)}
              className="absolute bottom-4 transition-transform duration-300 ease-out"
              style={{
                transform,
                filter: isFocused ? "none" : "saturate(0.6) opacity(0.7)",
              }}
              aria-label={`${cat.label}${isFocused ? " (focused)" : ""}`}
              data-testid={`mobile-arc-carousel-planet-${cat.id}`}
            >
              <div
                className={`relative w-24 h-24 rounded-full flex items-center justify-center text-4xl shadow-[0_0_40px_rgba(255,255,255,0.18)] ${
                  isFocused && cat.pulsing ? "animate-pulse" : ""
                }`}
                style={{
                  background: `radial-gradient(circle at 30% 30%, ${cat.aura}66, ${cat.color}cc 55%, ${cat.color}55 100%)`,
                  boxShadow: isFocused
                    ? `0 0 50px ${cat.aura}aa, 0 0 22px ${cat.color}66 inset`
                    : `0 0 18px ${cat.color}55`,
                }}
              >
                <span aria-hidden>{CATEGORY_EMOJI[cat.id] || "✨"}</span>
              </div>
              <div
                className={`mt-2 text-center text-[11px] uppercase tracking-[0.25em] ${
                  isFocused ? "text-white" : "text-white/50"
                }`}
              >
                {cat.label}
              </div>
            </button>
          );
        })}

        {/* Arrow nudge buttons — backup for users who don't discover
            swipe, especially on iPhones where horizontal swipe contends
            with the back-edge gesture. */}
        <button
          type="button"
          aria-label="Previous category"
          onClick={() => advance(-1)}
          className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 active:bg-white/30"
          data-testid="mobile-arc-carousel-prev-btn"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <button
          type="button"
          aria-label="Next category"
          onClick={() => advance(1)}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 active:bg-white/30"
          data-testid="mobile-arc-carousel-next-btn"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Focused category — rooms revealed below */}
      <section
        className="px-4 pb-24"
        data-testid={`mobile-arc-carousel-rooms-${focused.id}`}
      >
        <h2 className="text-center text-2xl font-black tracking-wide mb-1">
          {focused.label}
        </h2>
        <p className="text-center text-[11px] uppercase tracking-widest text-white/40 mb-5">
          Tap any room to dive in
        </p>
        <ul className="grid grid-cols-2 gap-3">
          {focused.rooms.map((room) => (
            <li key={room.id}>
              <button
                type="button"
                onClick={() => navigate(room.path)}
                className="w-full h-full p-4 rounded-2xl bg-white/5 border border-white/10 text-left active:bg-white/15 transition-colors"
                data-testid={`mobile-arc-carousel-room-${room.id}`}
              >
                <div className="text-2xl mb-1">{room.emoji}</div>
                <div className="text-sm font-bold text-white leading-tight">
                  {room.label}
                </div>
                <div className="mt-1 text-[10px] uppercase tracking-widest text-white/40 truncate">
                  {room.path}
                </div>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
};

export default MobileArcCarousel;
