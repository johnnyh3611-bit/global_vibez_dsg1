/**
 * SpadesGameMenu — Dropdown menu under the "Lobby" button.
 *
 * Per the user's request: "another dropdown box, like, with the menu,
 * the sound, messages, if they wanna exit the game... in the left-hand
 * corner right up under where the lobby sign is at".
 *
 * Items:
 *   • Menu      → noop placeholder (future: settings modal)
 *   • Sound     → toggles audio (persists to localStorage)
 *   • Messages  → opens a simple chat drawer (stub for AI mode)
 *   • Exit Game → calls onExit (back to lobby)
 *
 * Amber accent to match the Vibe Wiz Premium aesthetic.
 */
import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LogOut,
  Menu as MenuIcon,
  MessageCircle,
  Volume2,
  VolumeX,
} from "lucide-react";

interface Props {
  onExit: () => void;
  onOpenMessages?: () => void;
  onOpenSettings?: () => void;
}

const SOUND_KEY = "spades_sound_enabled";

export const SpadesGameMenu: React.FC<Props> = ({
  onExit,
  onOpenMessages,
  onOpenSettings,
}) => {
  const [open, setOpen] = useState(false);
  const [soundOn, setSoundOn] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const v = window.localStorage.getItem(SOUND_KEY);
    return v === null ? true : v === "1";
  });
  const btnRef = useRef<HTMLDivElement>(null);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (btnRef.current && !btnRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);

  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    try {
      window.localStorage.setItem(SOUND_KEY, next ? "1" : "0");
    } catch {
      /* ignore */
    }
  };

  return (
    <div ref={btnRef} className="relative inline-block" data-testid="spades-game-menu">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-950/70 backdrop-blur border border-amber-500/40 hover:border-amber-400/70 transition text-amber-200 text-xs font-bold"
        data-testid="spades-game-menu-btn"
      >
        <MenuIcon className="w-3.5 h-3.5" />
        <span className="uppercase tracking-[0.2em]">Menu</span>
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.96 }}
            transition={{ duration: 0.16 }}
            className="absolute top-full left-0 mt-2 min-w-[180px] z-[55]"
            data-testid="spades-game-menu-dropdown"
          >
            <div className="bg-slate-950/95 backdrop-blur-xl border-2 border-amber-500/50 rounded-lg shadow-2xl overflow-hidden">
              <MenuItem
                icon={<MenuIcon className="w-4 h-4" />}
                label="Settings"
                onClick={() => {
                  setOpen(false);
                  onOpenSettings?.();
                }}
                testid="spades-menu-settings"
              />
              <MenuItem
                icon={soundOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                label={`Sound · ${soundOn ? "On" : "Off"}`}
                onClick={toggleSound}
                testid="spades-menu-sound"
                highlighted={soundOn}
              />
              <MenuItem
                icon={<MessageCircle className="w-4 h-4" />}
                label="Messages"
                onClick={() => {
                  setOpen(false);
                  onOpenMessages?.();
                }}
                testid="spades-menu-messages"
              />
              <div className="border-t border-amber-500/20" />
              <MenuItem
                icon={<LogOut className="w-4 h-4" />}
                label="Exit Game"
                onClick={() => {
                  setOpen(false);
                  onExit();
                }}
                testid="spades-menu-exit"
                danger
              />
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
};

const MenuItem: React.FC<{
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  testid: string;
  danger?: boolean;
  highlighted?: boolean;
}> = ({ icon, label, onClick, testid, danger, highlighted }) => (
  <button
    type="button"
    onClick={onClick}
    data-testid={testid}
    className={`w-full flex items-center gap-2 px-3 py-2 text-left text-xs font-bold uppercase tracking-wider transition ${
      danger
        ? "text-rose-300 hover:bg-rose-500/15"
        : highlighted
          ? "text-amber-300 hover:bg-amber-500/15"
          : "text-amber-200/90 hover:bg-amber-500/10"
    }`}
    style={{ fontFamily: "'Cinzel', serif" }}
  >
    <span className="shrink-0">{icon}</span>
    <span className="flex-1">{label}</span>
  </button>
);

export default SpadesGameMenu;
