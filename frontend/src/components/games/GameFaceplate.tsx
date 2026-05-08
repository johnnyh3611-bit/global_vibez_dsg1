/**
 * GameFaceplate
 * ─────────────
 * Renders a clean per-game cover image.
 *
 * Strategy:
 *   1. If a real PNG exists in /public, prefer that.
 *   2. If the PNG is missing or fails to load, fall back to a generated
 *      SVG-style "faceplate": gradient + giant emoji + game name overlay.
 *      Looks intentional, never broken-image-icon.
 *
 * Used by: pages/GamesNew.tsx (game card hero strip)
 */
import { useState } from "react";

interface GameFaceplateProps {
  imageUrl?: string | null;   // e.g. "/spades-card.png" or null
  gradient?: string;          // tailwind gradient classes, e.g. "from-purple-700 to-pink-600"
  emoji: string;              // fallback hero glyph
  name: string;               // game display name
  testId?: string;
}

export default function GameFaceplate({
  imageUrl,
  gradient = "from-slate-800 via-purple-900 to-slate-900",
  emoji,
  name,
  testId,
}: GameFaceplateProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const usePNG = imageUrl && !imgFailed;

  if (usePNG) {
    return (
      <div
        className="absolute inset-0 flex items-center justify-center bg-black"
        data-testid={testId ?? "game-faceplate-img"}
      >
        <img
          src={imageUrl!}
          alt={name}
          loading="lazy"
          onError={() => setImgFailed(true)}
          className="w-full h-full object-contain"
        />
      </div>
    );
  }

  // Generated faceplate fallback — styled to look intentional, not broken
  return (
    <div
      className={`absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br ${gradient} text-white overflow-hidden`}
      data-testid={testId ?? "game-faceplate-generated"}
    >
      {/* Geometric pattern overlay for depth */}
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <div className="absolute -top-8 -left-8 w-32 h-32 rounded-full bg-white blur-2xl" />
        <div className="absolute -bottom-8 -right-8 w-40 h-40 rounded-full bg-white blur-3xl" />
      </div>
      <div
        className="text-7xl mb-2 drop-shadow-[0_4px_20px_rgba(0,0,0,0.5)] select-none"
        aria-hidden
      >
        {emoji}
      </div>
      <div className="px-4 text-center">
        <div className="text-sm font-black tracking-widest uppercase drop-shadow-lg">
          {name}
        </div>
      </div>
    </div>
  );
}
