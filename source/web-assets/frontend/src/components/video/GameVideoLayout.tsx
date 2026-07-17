/**
 * GameVideoLayout — keeps video from fighting the game canvas.
 *
 * - Game stays center (focus)
 * - Video sits in a collapsible / draggable PiP dock (lower z-index than cards/bets)
 * - When `criticalDecision` is true, video dims + soft-mutes to reduce distraction
 */
import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Video, ChevronDown, ChevronUp, Maximize2 } from "lucide-react";
import { GAME_Z } from "@/components/betting/BetSlip";

export type VideoDockMode = "dock" | "pip" | "hidden";

export default function GameVideoLayout({
  children,
  video,
  criticalDecision = false,
  defaultMode = "pip",
  testid = "game-video-layout",
}: {
  children: React.ReactNode;
  /** Optional video node (VibeCallRoom, stream, etc.) */
  video?: React.ReactNode;
  /** True while betting / on the clock — dims video */
  criticalDecision?: boolean;
  defaultMode?: VideoDockMode;
  testid?: string;
}) {
  const [mode, setMode] = useState<VideoDockMode>(video ? defaultMode : "hidden");

  useEffect(() => {
    if (!video) setMode("hidden");
    else if (mode === "hidden") setMode(defaultMode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Boolean(video)]);

  return (
    <div
      className="relative w-full min-h-0"
      data-testid={testid}
      data-critical={criticalDecision ? "1" : "0"}
    >
      {/* Game canvas — always the focus plane */}
      <div
        className="relative w-full"
        style={{ zIndex: GAME_Z.table }}
        data-testid={`${testid}-game`}
      >
        {children}
      </div>

      {/* Card / bet overlays sit above video via sibling stacking + GAME_Z */}
      <AnimatePresence>
        {video && mode !== "hidden" && (
          <motion.div
            drag={mode === "pip"}
            dragMomentum={false}
            dragConstraints={{ top: 72, left: 8, right: 8, bottom: 96 }}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{
              opacity: criticalDecision ? 0.35 : 1,
              scale: 1,
              filter: criticalDecision ? "grayscale(0.4)" : "none",
            }}
            exit={{ opacity: 0, scale: 0.96 }}
            className={
              mode === "dock"
                ? "fixed left-0 right-0 bottom-0 sm:left-auto sm:right-0 sm:top-20 sm:bottom-auto sm:w-72"
                : "fixed bottom-24 right-3 w-36 sm:w-44"
            }
            style={{ zIndex: GAME_Z.videoDock }}
            data-testid={`${testid}-video-dock`}
            data-dimmed={criticalDecision ? "true" : "false"}
          >
            <div className="rounded-2xl overflow-hidden border border-white/20 bg-black/80 shadow-2xl backdrop-blur">
              <div className="flex items-center justify-between px-2 py-1.5 bg-black/60 border-b border-white/10">
                <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-white/70">
                  <Video className="w-3 h-3" />
                  {criticalDecision ? "On the clock" : "Live"}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    className="p-1 text-white/50 hover:text-white"
                    title={mode === "dock" ? "Picture-in-picture" : "Expand dock"}
                    onClick={() => setMode(mode === "dock" ? "pip" : "dock")}
                    data-testid={`${testid}-toggle-mode`}
                  >
                    {mode === "dock" ? (
                      <Maximize2 className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronUp className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <button
                    type="button"
                    className="p-1 text-white/50 hover:text-white"
                    title="Hide video"
                    onClick={() => setMode("hidden")}
                    data-testid={`${testid}-hide`}
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div
                className={
                  mode === "dock" ? "aspect-video max-h-48" : "aspect-[3/4]"
                }
                // Soft-mute hint for nested video elements during critical decisions
                style={
                  criticalDecision
                    ? ({ ["--gv-video-mute" as string]: "1" } as React.CSSProperties)
                    : undefined
                }
              >
                <div className="w-full h-full [&_video]:pointer-events-none">
                  {video}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {video && mode === "hidden" && (
        <button
          type="button"
          onClick={() => setMode("pip")}
          className="fixed bottom-24 right-3 z-[21] px-3 py-2 rounded-full bg-black/80 border border-white/20 text-xs font-bold text-white/80"
          data-testid={`${testid}-show-video`}
        >
          Show video
        </button>
      )}
    </div>
  );
}
