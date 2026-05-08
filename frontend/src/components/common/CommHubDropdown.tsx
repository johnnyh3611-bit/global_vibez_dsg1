/**
 * CommHubDropdown — Universal Communications Hub (UDA §4)
 *
 *   "Move video/voice from the main screen to a Drop-down menu in the
 *   top nav."
 *
 * A single round button anchored in the top-right corner of every
 * authenticated route. Click it to expose:
 *   • Voice Mirror — open the live translation dock
 *   • Game Voice — toggle in-room voice chat (Agora)
 *   • Mute All — kill every comms surface in one tap
 *
 * The existing dock components (VoiceMirrorDock, GameVoiceDockMounter)
 * remain mounted so their state-management contracts stay intact; this
 * component just gives users a single discoverable entry-point in the
 * top nav, replacing the previous "two floating bubbles" layout.
 */
import React, { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Headphones,
  Mic,
  MicOff,
  Languages,
  Video,
  X,
  ChevronDown,
} from "lucide-react";
import { useVoiceMirror } from "@/contexts/VoiceMirrorContext";

// Hide on pre-auth routes — there's no comms to manage there.
const HIDDEN_ROUTES = new Set([
  "/",
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/auth-callback",
]);

export const CommHubDropdown: React.FC = () => {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [muted, setMuted] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  // Read the live Voice Mirror state so the indicator reflects reality.
  let vmActive = false;
  try {
    const vm = useVoiceMirror();
    vmActive = !!vm?.enabled;
  } catch {
    /* hook is safe in any tree but guard for unmount edge-cases */
  }

  // Click-outside to close.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  if (HIDDEN_ROUTES.has(pathname)) return null;

  const triggerVoiceMirror = () => {
    // The existing VoiceMirrorDock listens for a custom event from the
    // app — we re-use that contract instead of reaching into its state.
    window.dispatchEvent(new CustomEvent("commhub:voice-mirror-toggle"));
    setOpen(false);
  };

  const triggerGameVoice = () => {
    window.dispatchEvent(new CustomEvent("commhub:game-voice-toggle"));
    setOpen(false);
  };

  const toggleMute = () => {
    setMuted((m) => !m);
    window.dispatchEvent(
      new CustomEvent("commhub:mute-all", { detail: { muted: !muted } }),
    );
  };

  return (
    <div
      ref={ref}
      className="fixed top-3 right-3 z-[130] select-none"
      data-testid="commhub-root"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        data-testid="commhub-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        className={`flex items-center gap-1.5 px-3 py-2 rounded-full backdrop-blur-xl border transition-all shadow-lg ${
          open
            ? "bg-fuchsia-500/30 border-fuchsia-300 text-fuchsia-100"
            : "bg-slate-950/70 border-white/15 text-slate-200 hover:border-fuchsia-400/50"
        }`}
      >
        <Headphones className="w-4 h-4" />
        <span className="text-[10px] font-mono uppercase tracking-[0.2em] hidden sm:inline">
          Comm Hub
        </span>
        {/* Live status dot — green when any comms surface is active */}
        {(vmActive || muted) && (
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              muted ? "bg-rose-400" : "bg-emerald-400 animate-pulse"
            }`}
            data-testid="commhub-status-dot"
          />
        )}
        <ChevronDown
          className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            key="menu"
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.16 }}
            role="menu"
            data-testid="commhub-menu"
            className="absolute right-0 top-full mt-2 w-64 rounded-2xl border border-fuchsia-500/30 bg-slate-950/95 backdrop-blur-xl shadow-[0_0_32px_rgba(168,85,247,0.25)] p-2"
          >
            <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 mb-1">
              <span className="text-[10px] font-mono uppercase tracking-[0.3em] text-fuchsia-300">
                Communications
              </span>
              <button
                onClick={() => setOpen(false)}
                className="text-slate-500 hover:text-white"
                aria-label="Close"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <MenuItem
              testid="commhub-voice-mirror"
              icon={<Languages className="w-4 h-4" />}
              label="Voice Mirror"
              hint="Real-time speech translation"
              active={vmActive}
              onClick={triggerVoiceMirror}
            />
            <MenuItem
              testid="commhub-game-voice"
              icon={<Mic className="w-4 h-4" />}
              label="Game Voice"
              hint="Talk to your table"
              onClick={triggerGameVoice}
            />
            <MenuItem
              testid="commhub-video"
              icon={<Video className="w-4 h-4" />}
              label="Video Call"
              hint="Hop into a video room"
              onClick={() => {
                window.dispatchEvent(new CustomEvent("commhub:video-toggle"));
                setOpen(false);
              }}
            />

            <div className="my-1 h-px bg-white/10" />

            <MenuItem
              testid="commhub-mute"
              icon={muted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              label={muted ? "Unmute everything" : "Mute everything"}
              hint="Kill every comms surface"
              danger
              onClick={toggleMute}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const MenuItem: React.FC<{
  icon: React.ReactNode;
  label: string;
  hint?: string;
  active?: boolean;
  danger?: boolean;
  onClick: () => void;
  testid?: string;
}> = ({ icon, label, hint, active, danger, onClick, testid }) => (
  <button
    type="button"
    role="menuitem"
    onClick={onClick}
    data-testid={testid}
    className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
      danger
        ? "text-rose-300 hover:bg-rose-500/10"
        : active
          ? "bg-emerald-500/10 text-emerald-200"
          : "text-slate-100 hover:bg-white/5"
    }`}
  >
    <span
      className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${
        active ? "bg-emerald-400/20" : "bg-white/5"
      }`}
    >
      {icon}
    </span>
    <span className="flex-1 min-w-0">
      <span className="block text-sm font-bold truncate">{label}</span>
      {hint && (
        <span className="block text-[11px] text-slate-400 truncate">{hint}</span>
      )}
    </span>
    {active && (
      <span className="text-[9px] font-mono uppercase tracking-[0.2em] text-emerald-400">
        Live
      </span>
    )}
  </button>
);

export default CommHubDropdown;
