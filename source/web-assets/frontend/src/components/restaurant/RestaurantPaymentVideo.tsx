/**
 * RestaurantPaymentVideo — Dish Sizzle Clip + Atmosphere Loop player.
 *
 * Spec source: Restaurant_Payment_Video_Implementation v1+v2.pdf
 *   • 5-10s "Dish Sizzle Clip" plays after a successful order/booking
 *     payment as a celebratory transition.
 *   • Atmosphere Loop = ambient looping background video on the venue
 *     detail page.
 *   • 0-2s stats reveal: small price-per-plate / wait-time chip
 *     fades in over the first 2 seconds.
 *
 * Used by:
 *   • Date Spot Finder venue detail
 *   • Hungry Vibez delivery confirmation
 *   • Vibe Venues Vibe-Check success
 */
import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Volume2, VolumeX, DollarSign, Clock } from "lucide-react";

export type DishStats = {
  price_per_plate_usd?: number;
  wait_minutes?: number;
  servings?: number;
};

export const DishSizzleOverlay: React.FC<{
  videoUrl: string;
  durationMs?: number;       // auto-close after N ms (default 8000 = 8s)
  stats?: DishStats;
  onClose: () => void;
}> = ({ videoUrl, durationMs = 8000, stats, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    const t = setTimeout(onClose, durationMs);
    return () => clearTimeout(t);
  }, [durationMs, onClose]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[80] bg-black/95 flex items-center justify-center p-4"
        data-testid="dish-sizzle-overlay"
      >
        <motion.div
          initial={{ scale: 0.96, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="relative w-full max-w-2xl rounded-3xl overflow-hidden border border-fuchsia-500/30 shadow-[0_0_60px_rgba(217,70,239,0.55)]"
        >
          <video
            ref={videoRef}
            src={videoUrl}
            autoPlay
            playsInline
            muted={muted}
            loop={false}
            className="w-full h-full object-cover bg-black"
          />

          {/* 0-2s stats reveal */}
          {stats && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.0, duration: 2.0 }}
              className="absolute bottom-6 left-6 flex flex-wrap gap-2"
              data-testid="dish-sizzle-stats"
            >
              {stats.price_per_plate_usd != null && (
                <div className="px-3 py-1.5 rounded-full bg-black/60 backdrop-blur border border-fuchsia-500/30 text-white text-sm font-bold flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-fuchsia-300" />
                  {stats.price_per_plate_usd}/plate
                </div>
              )}
              {stats.wait_minutes != null && (
                <div className="px-3 py-1.5 rounded-full bg-black/60 backdrop-blur border border-cyan-500/30 text-white text-sm font-bold flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-cyan-300" />
                  {stats.wait_minutes} min wait
                </div>
              )}
              {stats.servings != null && (
                <div className="px-3 py-1.5 rounded-full bg-black/60 backdrop-blur border border-orange-500/30 text-white text-sm font-bold">
                  Serves {stats.servings}
                </div>
              )}
            </motion.div>
          )}

          {/* Controls */}
          <button
            onClick={() => setMuted((m) => !m)}
            className="absolute top-4 left-4 w-9 h-9 rounded-full bg-black/60 backdrop-blur border border-white/10 text-white flex items-center justify-center hover:bg-black/80 transition-colors"
            data-testid="dish-sizzle-mute-btn"
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/60 backdrop-blur border border-white/10 text-white flex items-center justify-center hover:bg-black/80 transition-colors"
            data-testid="dish-sizzle-close-btn"
          >
            <X className="w-4 h-4" />
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

/**
 * AtmosphereLoop — auto-playing muted ambient video for the top of a
 * venue detail page. 4-15s clip on loop, no controls, no audio. Falls
 * back to the cover photo if the video fails to load.
 */
export const AtmosphereLoop: React.FC<{
  videoUrl?: string;
  posterUrl?: string;
  className?: string;
}> = ({ videoUrl, posterUrl, className = "" }) => {
  if (!videoUrl) {
    return posterUrl ? (
      <img
        src={posterUrl}
        alt=""
        className={`w-full h-full object-cover ${className}`}
        data-testid="atmosphere-loop-fallback-img"
      />
    ) : null;
  }
  return (
    <video
      src={videoUrl}
      poster={posterUrl}
      autoPlay
      muted
      loop
      playsInline
      className={`w-full h-full object-cover ${className}`}
      data-testid="atmosphere-loop"
    />
  );
};
