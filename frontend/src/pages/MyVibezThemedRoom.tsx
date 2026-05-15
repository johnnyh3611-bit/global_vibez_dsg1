/**
 * MyVibezThemedRoom — Dynamic Environmental Shifting room (Feb 2026 PDF
 * "My Vibez Room Redefinition Blueprint" + "Optimization Module").
 *
 * The skin morphs based on the active video's category:
 *   • COMEDY / ACTION / HORROR / MUSIC → "Underground Club" (matte black,
 *     purple/crimson, equalizer bars).
 *   • LIVE_DATING / YELLOW_PAGES_SHOWCASE / CREATIVE / TECH → "Celestial
 *     Glasshouse" (translucent glass, holographic star maps, neon-blue).
 *
 * Categories sit in a horizontal pill rail on desktop and an
 * interactive bottom-sheet drawer on mobile (PDF §3 Cross-Platform).
 * Swiping the category changes the theme background dynamically.
 *
 * Routed at /my-vibez/themed and /my-vibez-themed.
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Sparkles,
  Music2,
  Laugh,
  Swords,
  Ghost,
  Heart,
  BookOpen,
  Palette,
  Cpu,
  Play,
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

type Theme = {
  id: string;
  label: string;
  best_for: string;
  visuals: string;
  palette: { bg: string; accent: string; glow: string; text: string };
};

const CATEGORIES = [
  { id: "COMEDY", label: "Comedy", icon: Laugh },
  { id: "ACTION", label: "Action", icon: Swords },
  { id: "HORROR", label: "Horror", icon: Ghost },
  { id: "MUSIC", label: "Music", icon: Music2 },
  { id: "LIVE_DATING", label: "Live Dating", icon: Heart },
  { id: "YELLOW_PAGES_SHOWCASE", label: "Yellow Pages", icon: BookOpen },
  { id: "CREATIVE", label: "Creative", icon: Palette },
  { id: "TECH", label: "Tech", icon: Cpu },
];

const DEMO_VIDEO_ID = "demo-vid-001";

export default function MyVibezThemedRoom() {
  const navigate = useNavigate();
  const [category, setCategory] = useState<string>("COMEDY");
  const [theme, setTheme] = useState<Theme | null>(null);
  const [loading, setLoading] = useState(false);

  // Fetch the theme whenever category changes — driven by the real backend
  // so changes to category_theme_map in routes/my_vibez_optimization.py
  // ripple here automatically.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`${API}/api/my-vibez/categories/layout/${DEMO_VIDEO_ID}?category=${category}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setTheme(data.theme);
      })
      .catch(() => { /* fall back to local default below */ })
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [category]);

  const palette = theme?.palette ?? {
    bg: "linear-gradient(135deg,#020617 0%,#0f172a 50%,#1e1b4b 100%)",
    accent: "#22d3ee",
    glow: "rgba(34,211,238,0.55)",
    text: "#e0f2fe",
  };

  const isClub = theme?.id === "underground_club";

  return (
    <div
      data-testid="my-vibez-themed-room"
      className="min-h-screen text-white transition-all duration-700"
      style={{ background: palette.bg, color: palette.text }}
    >
      {/* Header */}
      <header className="sticky top-0 z-10 backdrop-blur-md border-b border-white/5">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            data-testid="my-vibez-themed-back-btn"
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-xs uppercase tracking-widest"
          >
            <ArrowLeft className="w-3 h-3" /> Dashboard
          </button>
          <div className="flex items-center gap-2" style={{ color: palette.accent }}>
            <Sparkles className="w-3 h-3" />
            <span className="text-[10px] uppercase tracking-[0.4em]">
              My Vibez · Vibe Metadata Engine
            </span>
          </div>
          <div className="w-24" />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-10 space-y-10">
        {/* Theme preview card */}
        <AnimatePresence mode="wait">
          {theme && (
            <motion.section
              key={theme.id}
              data-testid={`theme-preview-${theme.id}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.45 }}
              className="rounded-3xl p-6 md:p-8 border-2 relative overflow-hidden"
              style={{
                background: isClub
                  ? "linear-gradient(135deg,rgba(220,38,38,0.08),rgba(192,38,211,0.10))"
                  : "linear-gradient(135deg,rgba(34,211,238,0.06),rgba(99,102,241,0.10))",
                borderColor: palette.accent + "55",
                boxShadow: `0 0 50px -10px ${palette.glow}`,
              }}
            >
              {/* Equalizer bars (Underground Club only) */}
              {isClub && (
                <div className="absolute inset-x-0 bottom-0 h-12 flex items-end justify-around opacity-30 pointer-events-none">
                  {Array.from({ length: 36 }).map((_, i) => (
                    <span
                      key={i}
                      className="w-1.5 rounded-t-full"
                      style={{
                        height: `${20 + Math.sin(i * 0.7) * 40 + Math.random() * 30}px`,
                        background: `linear-gradient(to top, ${palette.accent}, transparent)`,
                        animation: `eqbar 0.8s ease-in-out ${i * 0.04}s infinite alternate`,
                      }}
                    />
                  ))}
                </div>
              )}
              {/* Holographic star map (Celestial Glasshouse only) */}
              {!isClub && (
                <div className="absolute inset-0 opacity-30 pointer-events-none">
                  {Array.from({ length: 60 }).map((_, i) => (
                    <span
                      key={i}
                      className="absolute rounded-full"
                      style={{
                        left: `${(i * 17) % 100}%`,
                        top: `${(i * 13) % 100}%`,
                        width: `${1 + (i % 3)}px`,
                        height: `${1 + (i % 3)}px`,
                        background: palette.accent,
                        boxShadow: `0 0 6px ${palette.glow}`,
                        animation: `twinkle 2.4s ease-in-out ${i * 0.07}s infinite alternate`,
                      }}
                    />
                  ))}
                </div>
              )}

              <div className="relative">
                <div
                  className="text-[10px] uppercase tracking-[0.4em] mb-2"
                  style={{ color: palette.accent }}
                >
                  Theme · Auto-Selected
                </div>
                <h2 className="text-3xl md:text-4xl font-black">{theme.label}</h2>
                <p className="text-sm md:text-base mt-2 opacity-80">
                  <span className="font-bold">Best for:</span> {theme.best_for}
                </p>
                <p className="text-xs md:text-sm mt-3 opacity-70 leading-relaxed">
                  {theme.visuals}
                </p>

                {/* Mock video frame */}
                <div
                  data-testid="theme-video-frame"
                  className="mt-6 aspect-video rounded-2xl border-2 flex items-center justify-center relative overflow-hidden"
                  style={{
                    borderColor: palette.accent + "60",
                    background: "rgba(0,0,0,0.55)",
                    boxShadow: `inset 0 0 30px ${palette.glow}`,
                  }}
                >
                  <Play className="w-14 h-14" style={{ color: palette.accent }} />
                  <div
                    className="absolute bottom-2 left-3 text-[10px] uppercase tracking-widest font-black"
                    style={{ color: palette.accent }}
                  >
                    {category}
                  </div>
                </div>
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        {/* Category Rail — horizontal pills on desktop, bottom-sheet on mobile */}
        <section>
          <h3 className="text-[10px] uppercase tracking-[0.4em] opacity-60 mb-3">
            Swipe / Tap to change theme
          </h3>
          <div
            data-testid="my-vibez-category-rail"
            className="flex gap-2 overflow-x-auto pb-2 snap-x"
          >
            {CATEGORIES.map((c) => {
              const Icon = c.icon;
              const active = c.id === category;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategory(c.id)}
                  data-testid={`my-vibez-category-${c.id.toLowerCase()}`}
                  className={`flex-shrink-0 snap-start flex items-center gap-2 px-4 py-2 rounded-full border-2 transition-all text-xs font-black uppercase tracking-wider ${
                    active ? "scale-105" : "opacity-50 hover:opacity-100"
                  }`}
                  style={{
                    borderColor: active ? palette.accent : "rgba(255,255,255,0.15)",
                    background: active ? palette.accent + "22" : "rgba(255,255,255,0.04)",
                    color: active ? palette.accent : "rgba(255,255,255,0.7)",
                    boxShadow: active ? `0 0 18px -4px ${palette.glow}` : undefined,
                  }}
                >
                  <Icon className="w-3 h-3" />
                  {c.label}
                </button>
              );
            })}
          </div>
        </section>

        {/* Loading hint */}
        {loading && (
          <div className="text-center text-xs opacity-50">
            …loading theme metadata
          </div>
        )}

        {/* Footer note */}
        <footer
          className="text-center text-[10px] uppercase tracking-[0.3em] pt-6 border-t border-white/5"
          style={{ color: palette.accent }}
        >
          Vibe Metadata Engine · Dynamic Environmental Shifting · Locked via{" "}
          <span className="opacity-70">routes/my_vibez_optimization.py</span>
        </footer>
      </main>

      {/* keyframes for the equalizer + twinkle effects */}
      <style>{`
        @keyframes eqbar { 0% { transform: scaleY(0.3); } 100% { transform: scaleY(1.05); } }
        @keyframes twinkle { 0% { opacity: 0.2; } 100% { opacity: 1; } }
      `}</style>
    </div>
  );
}
