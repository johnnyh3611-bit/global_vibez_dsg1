/**
 * GameVoiceDock — drop-in voice/video chat for any multiplayer game room.
 *
 * Founder directive (2026-02-16): "in every game, we did implement it so
 * people could actually virtually talk to each other and play the game…
 * is that active for every game in the app?"
 *
 * Yes — drop this component into any multiplayer game page and players
 * on different phones can talk while they play. Wraps the canonical
 * <VibeCallRoom> Agora-RTC audio room with a minimize / leave control,
 * a single mic mute, and respects the master AI-Dealer voice mute (so
 * the menu-bar AI Dealer toggle silences both the dealer AND the room
 * audio in one shot — opt-in via prop).
 *
 * Usage:
 *   <GameVoiceDock channel={`game-${room.code}`} gameLabel="Spades" />
 *
 * The component is collapsed-by-default — users tap "Join Voice" to opt
 * in. No surprise mic activation, no auto-join.
 */
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Headphones, ChevronUp, ChevronDown, X, Users } from 'lucide-react';
import VibeCallRoom from '@/components/voice/VibeCallRoom';
import { isAIDealerVoiceMuted, subscribeToAIDealerVoice } from '@/utils/aiDealerVoice';

interface GameVoiceDockProps {
  /** Unique room channel — usually `game-${roomCode}` or `${gameId}-${tableId}`. */
  channel: string;
  /** Human-readable label shown above the dock. */
  gameLabel?: string;
  /**
   * If true, the dock starts in 'expanded' state (joined). Default false —
   * users tap "Join Voice" to opt in (no surprise mic).
   */
  autoJoin?: boolean;
  /**
   * If true, the master AI Dealer voice toggle (set on the menu bar)
   * also collapses this dock. Useful for solo-vs-AI rooms where the
   * dealer is the only "voice". Default false.
   */
  respectAIDealerMute?: boolean;
  /** Initial dock state — 'collapsed' (default) or 'expanded'. */
  defaultOpen?: boolean;
}

type DockState = 'collapsed' | 'connecting' | 'live';

export function GameVoiceDock({
  channel,
  gameLabel = 'Game',
  autoJoin = false,
  respectAIDealerMute = false,
  defaultOpen = false,
}: GameVoiceDockProps) {
  const [state, setState] = useState<DockState>(autoJoin ? 'connecting' : 'collapsed');
  const [minimized, setMinimized] = useState(!defaultOpen && !autoJoin);

  // Master AI Dealer voice toggle — if respectAIDealerMute is on AND the
  // master switch is muted, collapse the dock and force-leave.
  useEffect(() => {
    if (!respectAIDealerMute) return;
    if (isAIDealerVoiceMuted()) setState('collapsed');
    return subscribeToAIDealerVoice((muted) => {
      if (muted) setState('collapsed');
    });
  }, [respectAIDealerMute]);

  const join = () => {
    setMinimized(false);
    setState('connecting');
    // VibeCallRoom transitions to 'live' on successful Agora join — we
    // mirror the state via onLeave callback below. The intermediate
    // 'connecting' label gives the user instant feedback.
    setTimeout(() => setState('live'), 120);
  };

  const leave = () => {
    setState('collapsed');
    setMinimized(true);
  };

  return (
    <div
      data-testid="game-voice-dock"
      data-channel={channel}
      className="fixed bottom-4 right-4 z-40 select-none"
    >
      <AnimatePresence mode="wait">
        {state === 'collapsed' && (
          <motion.button
            key="collapsed"
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.85, opacity: 0 }}
            onClick={join}
            data-testid="game-voice-dock-join"
            className="flex items-center gap-2 px-4 py-3 rounded-full bg-[#0A0A0F]/95 hover:bg-[#1a1a25] text-[#00E5C7] border border-[#00E5C7]/40 text-sm font-bold shadow-lg shadow-[#00E5C7]/10 backdrop-blur-md transition-all hover:scale-105 active:scale-95"
            title={`Talk to your opponents in ${gameLabel}`}
          >
            <Mic className="w-4 h-4" />
            <span className="hidden sm:inline">Join Voice</span>
            <Users className="w-4 h-4" />
          </motion.button>
        )}

        {state !== 'collapsed' && minimized && (
          <motion.button
            key="minimized"
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            onClick={() => setMinimized(false)}
            data-testid="game-voice-dock-restore"
            className="flex items-center gap-2 px-3 py-2 rounded-full bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-400/40 text-xs font-bold backdrop-blur-md"
            title="Voice chat is live — tap to expand"
          >
            <Headphones className="w-4 h-4 animate-pulse" />
            <span className="hidden sm:inline">{gameLabel} Voice</span>
            <ChevronUp className="w-3 h-3" />
          </motion.button>
        )}

        {state !== 'collapsed' && !minimized && (
          <motion.div
            key="expanded"
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 30, opacity: 0 }}
            className="bg-[#0A0A0F]/95 border border-[#00E5C7]/30 rounded-2xl shadow-2xl shadow-[#00E5C7]/10 backdrop-blur-md overflow-hidden w-[280px] sm:w-[320px]"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 bg-gradient-to-r from-[#00E5C7]/10 to-transparent">
              <div className="flex items-center gap-2 text-[#00E5C7] text-xs font-black uppercase tracking-widest">
                <Headphones className="w-3.5 h-3.5" />
                {gameLabel} Voice
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setMinimized(true)}
                  data-testid="game-voice-dock-minimize"
                  className="p-1 rounded text-white/50 hover:text-white hover:bg-white/5"
                  title="Minimize"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
                <button
                  onClick={leave}
                  data-testid="game-voice-dock-leave"
                  className="p-1 rounded text-rose-300 hover:text-rose-200 hover:bg-rose-500/10"
                  title="Leave voice"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Body — embed canonical VibeCallRoom */}
            <div className="p-3">
              <VibeCallRoom channel={channel} onLeave={leave} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default GameVoiceDock;
