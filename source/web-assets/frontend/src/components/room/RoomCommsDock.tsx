import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Video, Sparkles, Users } from 'lucide-react';
import VibeRoomVoice from '@/components/games/VibeRoomVoice';
import { VibezCloseControl } from '@/components/ui/VibezCloseControl';

interface RoomCommsDockProps {
  roomId: string;
  userId: string;
  userName?: string;
  label?: string;
}

/**
 * RoomCommsDock — a single collapsible panel that brings the owned
 * VibeRoomVoice (WebRTC) video/voice bar into every room. It starts
 * collapsed so users opt-in, and exposes a Voice Mirror shortcut so
 * players can translate/change voice while talking.
 */
const RoomCommsDock: React.FC<RoomCommsDockProps> = ({
  roomId,
  userId,
  userName,
  label = 'Room',
}) => {
  const [open, setOpen] = useState(false);

  const openVoiceMirror = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('commhub:voice-mirror-toggle'));
    }
  };

  return (
    <div
      className="fixed z-[55] flex flex-col items-end gap-1.5"
      style={{
        top: "max(0.4rem, env(safe-area-inset-top))",
        right: "max(0.5rem, env(safe-area-inset-right))",
      }}
      data-testid="room-comms-dock"
    >
      <AnimatePresence>
        {open && (
          <motion.div
            key="panel"
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ duration: 0.18 }}
            className="mb-2 w-[310px] sm:w-[360px] max-w-[calc(100vw-2rem)] rounded-2xl border border-cyan-400/30 bg-[#0A0A0F]/95 backdrop-blur-xl shadow-[0_0_40px_rgba(34,211,238,0.18)] overflow-hidden"
          >
            <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 bg-gradient-to-r from-cyan-500/10 to-transparent">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-cyan-200/80 font-black">
                <Users className="w-3.5 h-3.5" />
                <span className="truncate max-w-[180px]">{label} Video</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={openVoiceMirror}
                  title="Voice Mirror — translate or change your voice"
                  className="w-8 h-8 rounded-full flex items-center justify-center bg-white/5 hover:bg-fuchsia-500/30 text-white/70 hover:text-fuchsia-200 transition"
                  aria-label="Open Voice Mirror"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                </button>
                <VibezCloseControl
                  onClick={() => setOpen(false)}
                  label="Close"
                  testId="room-comms-dock-close"
                />
              </div>
            </div>
            <div className="p-2">
              <VibeRoomVoice
                roomId={roomId}
                userId={userId}
                userName={userName}
                maxFocusTiles={4}
                onClose={() => setOpen(false)}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!open && (
        <motion.button
          type="button"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 px-2.5 py-2 rounded-full bg-[#0A0A0F]/95 hover:bg-[#1a1a25] text-cyan-300 border border-cyan-400/40 text-[10px] font-black uppercase tracking-wider shadow-[0_0_20px_rgba(34,211,238,0.15)] backdrop-blur-md transition-all hover:scale-105 active:scale-95"
          title="Join room video and voice"
          aria-label="Join room video and voice"
        >
          <Video className="w-3.5 h-3.5" />
          <span className="hidden lg:inline">{label} Video</span>
        </motion.button>
      )}
    </div>
  );
};

export default RoomCommsDock;
