/**
 * JFTNTeaser — 10-second blurred preview that gates real content behind a
 * 24-hour Solana pass. Tap "Get 24hr Pass" to fire `onUnlock` (parent owns
 * the purchase modal).
 */
import React from "react";
import { motion } from "framer-motion";
import { Lock, Sparkles } from "lucide-react";

type JFTNTeaserProps = {
  videoSrc?: string;
  posterSrc?: string;
  isUnlocked: boolean;
  /** Primary price in Vibez Coins. */
  feeCoins?: number;
  onUnlock?: () => void;
  testId?: string;
};

export default function JFTNTeaser({
  videoSrc,
  posterSrc,
  isUnlocked,
  feeCoins = 1000,
  onUnlock,
  testId = "jftn-teaser",
}: JFTNTeaserProps) {
  return (
    <div
      className="relative w-full max-w-sm overflow-hidden rounded-xl border-2 border-cyan-500 shadow-[0_0_20px_rgba(6,182,212,0.5)]"
      data-testid={testId}
    >
      {videoSrc ? (
        <video
          src={videoSrc}
          autoPlay
          muted
          loop
          playsInline
          poster={posterSrc}
          className={`w-full h-56 object-cover ${!isUnlocked ? "blur-md scale-110" : ""}`}
        />
      ) : (
        <div
          className={`w-full h-56 bg-cover bg-center ${!isUnlocked ? "blur-md scale-110" : ""}`}
          style={{
            backgroundImage: posterSrc
              ? `url(${posterSrc})`
              : "linear-gradient(135deg,#0f172a,#1e1b4b 60%,#3b0764)",
          }}
        />
      )}

      {!isUnlocked && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 text-white p-4"
        >
          <Lock className="w-7 h-7 text-cyan-300 mb-2" />
          <h3 className="text-xl font-['Cinzel'] font-bold uppercase tracking-widest">
            Just for the Night
          </h3>
          <p className="text-xs mb-4 text-cyan-300 text-center">
            Private access — ₵{feeCoins.toLocaleString()} · 24 hour pass
          </p>
          <button
            onClick={onUnlock}
            className="bg-gradient-to-r from-purple-600 to-cyan-500 hover:from-purple-500 hover:to-cyan-400 px-6 py-2 rounded-full font-bold transition-all flex items-center gap-2 shadow-lg shadow-cyan-500/30"
            data-testid={`${testId}-unlock-btn`}
          >
            <Sparkles className="w-4 h-4" />
            Get 24hr Pass
          </button>
        </motion.div>
      )}

      {isUnlocked && (
        <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-emerald-500/90 text-emerald-50 text-[10px] font-black uppercase tracking-widest shadow-lg">
          Unlocked
        </div>
      )}
    </div>
  );
}
