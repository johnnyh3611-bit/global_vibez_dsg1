/**
 * LandingHeroVideo — Cinematic homepage walkthrough hero
 * (Ultimate Blueprint v3 backlog · May 2026 · Sora 2).
 *
 * Polls /api/landing-video/latest on mount. If a video URL is
 * available, renders an autoplaying / muted / looping mp4 with a
 * subtle vignette + neon accent ring. If null, falls back to a
 * gradient — never blank, never broken.
 *
 * Sized to fit naturally above the existing hero copy without pushing
 * the rest of the landing down: 16:9 aspect, max-h-[420px] on mobile,
 * 600px on desktop. Caller controls placement.
 */
import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

interface VideoState {
  url: string | null;
  generated_at: string | null;
}

export default function LandingHeroVideo() {
  const [video, setVideo] = useState<VideoState>({ url: null, generated_at: null });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API}/api/landing-video/latest`);
        if (!res.ok) throw new Error(`status ${res.status}`);
        const data: VideoState = await res.json();
        if (!cancelled) setVideo(data);
      } catch {
        // Marketing widget — silent fall-through to gradient.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <motion.div
      data-testid="landing-hero-video"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8 }}
      className="relative w-full overflow-hidden rounded-3xl border border-fuchsia-500/30"
      style={{
        aspectRatio: "16 / 9",
        background:
          "radial-gradient(ellipse at center, rgba(217,70,239,0.15) 0%, rgba(15,20,40,1) 70%)",
        boxShadow:
          "0 0 60px rgba(217, 70, 239, 0.25), inset 0 0 32px rgba(34, 211, 238, 0.18)",
      }}
    >
      {/* Neon scan lines + grid backdrop (visible only while video
          is missing or still loading). */}
      {(!video.url || !loaded) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div
            className="absolute inset-0 opacity-30"
            style={{
              backgroundImage: `linear-gradient(rgba(168,85,247,0.3) 1px, transparent 1px),
                                linear-gradient(90deg, rgba(168,85,247,0.3) 1px, transparent 1px)`,
              backgroundSize: "50px 50px",
              transform: "perspective(500px) rotateX(60deg)",
              transformOrigin: "center top",
            }}
          />
          <motion.div
            animate={{
              opacity: [0.6, 1, 0.6],
              scale: [1, 1.05, 1],
            }}
            transition={{ duration: 2.4, repeat: Infinity }}
            className="relative z-10 flex flex-col items-center gap-3 text-fuchsia-300"
          >
            <Sparkles className="w-10 h-10" />
            <span className="font-mono text-[11px] uppercase tracking-[0.4em]">
              {video.url ? "Loading" : "Cinematic incoming"}
            </span>
          </motion.div>
        </div>
      )}

      {video.url && (
        <video
          key={video.url}
          src={video.url}
          autoPlay
          loop
          muted
          playsInline
          onCanPlay={() => setLoaded(true)}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${
            loaded ? "opacity-100" : "opacity-0"
          }`}
          data-testid="landing-hero-video-element"
        />
      )}

      {/* Vignette + neon accent ring */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(circle, transparent 50%, rgba(0,0,0,0.5) 100%)",
        }}
      />

      {/* Bottom-left tag */}
      <div className="absolute bottom-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-fuchsia-400/40 bg-black/50 backdrop-blur text-[9px] font-mono uppercase tracking-[0.3em] text-fuchsia-300">
        <span className="w-1.5 h-1.5 rounded-full bg-fuchsia-400 animate-pulse" />
        Live · Cyber Casino Walkthrough
      </div>
    </motion.div>
  );
}
