/**
 * CommHubButton — in-line variant of the Comms Hub for use inside a
 * RoomMenuBar's rightSlot. Renders the same dropdown menu as the
 * floating CommHubDropdown, but anchored to its parent element instead
 * of the viewport. Per founder directive (May 2026):
 *   "Everything should be inside the menu bar inside the game.
 *    That includes the communications tabs."
 */
import React, { useEffect, useRef, useState } from "react";
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

interface Props {
  /** Compact variant: shorter button copy on small screens. */
  compact?: boolean;
}

export const CommHubButton: React.FC<Props> = ({ compact = false }) => {
  const [open, setOpen] = useState(false);
  const [muted, setMuted] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  let vmActive = false;
  try {
    const vm = useVoiceMirror();
    vmActive = !!vm?.enabled;
  } catch {
    /* hook is safe in any tree */
  }

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const fire = (event: string, detail?: unknown) => {
    window.dispatchEvent(new CustomEvent(event, { detail }));
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative" data-testid="commhub-inline-root">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        data-testid="commhub-inline-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        title="Communications"
        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg backdrop-blur border transition-all ${
          open
            ? "bg-fuchsia-500/30 border-fuchsia-300 text-fuchsia-100"
            : "bg-black/40 border-white/10 hover:border-fuchsia-400/50 text-slate-200"
        }`}
      >
        <Headphones className="w-4 h-4" />
        {!compact && (
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] hidden md:inline">
            Comms
          </span>
        )}
        {(vmActive || muted) && (
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              muted ? "bg-rose-400" : "bg-emerald-400 animate-pulse"
            }`}
            data-testid="commhub-inline-status-dot"
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
            data-testid="commhub-inline-menu"
            className="absolute right-0 top-full mt-2 w-60 rounded-2xl border border-fuchsia-500/30 bg-slate-950/95 backdrop-blur-xl shadow-[0_0_32px_rgba(168,85,247,0.25)] p-2 z-[140]"
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

            <Item
              testid="commhub-inline-voice-mirror"
              icon={<Languages className="w-4 h-4" />}
              label="Voice Mirror"
              hint="Real-time speech translation"
              active={vmActive}
              onClick={() => fire("commhub:voice-mirror-toggle")}
            />
            <Item
              testid="commhub-inline-game-voice"
              icon={<Mic className="w-4 h-4" />}
              label="Game Voice"
              hint="Talk to your table"
              onClick={() => fire("commhub:game-voice-toggle")}
            />
            <Item
              testid="commhub-inline-video"
              icon={<Video className="w-4 h-4" />}
              label="Video Call"
              hint="Hop into a video room"
              onClick={() => fire("commhub:video-toggle")}
            />

            <div className="my-1 h-px bg-white/10" />

            <Item
              testid="commhub-inline-mute"
              icon={muted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              label={muted ? "Unmute everything" : "Mute everything"}
              hint="Kill every comms surface"
              danger
              onClick={() => {
                setMuted((m) => !m);
                fire("commhub:mute-all", { muted: !muted });
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const Item: React.FC<{
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
    className={`w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
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

export default CommHubButton;
