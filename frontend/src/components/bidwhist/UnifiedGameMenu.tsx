import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, Volume2, VolumeX, Maximize, LogOut, HelpCircle, MessageCircle, X, Monitor, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

export default function UnifiedGameMenu({ gameId, 
  onLeave, 
  onOpenChat,
  unreadMessages = 0,
  viewMode = 'classic',
  onViewModeChange }: { gameId?: any, onLeave?: any, onOpenChat?: any, unreadMessages?: any, viewMode?: any, onViewModeChange?: any }) {
  const [isOpen, setIsOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const navigate = useNavigate();

  const toggleSound = () => {
    setSoundEnabled(!soundEnabled);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  const handleLeaveGame = () => {
    if (confirm('Are you sure you want to leave the game?')) {
      if (onLeave) onLeave();
      navigate('/games');
    }
  };

  const handleOpenChat = () => {
    setIsOpen(false);
    if (onOpenChat) onOpenChat();
  };

  return (
    <div className="fixed top-4 right-4 z-50">
      
      {/* Menu Toggle Button - ENHANCED VISIBILITY */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className="relative w-16 h-16 bg-gradient-to-br from-amber-600 via-yellow-600 to-amber-600 backdrop-blur-xl rounded-2xl border-3 border-amber-400 hover:border-yellow-300 flex items-center justify-center shadow-[0_0_20px_rgba(251,191,36,0.5)] hover:shadow-[0_0_30px_rgba(251,191,36,0.8)] transition-all"
      >
        {isOpen ? (
          <X className="w-7 h-7 text-white drop-shadow-lg" />
        ) : (
          <Menu className="w-7 h-7 text-white drop-shadow-lg" />
        )}
        
        {/* Unread Messages Badge */}
        {unreadMessages > 0 && !isOpen && (
          <div className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center border-2 border-white shadow-lg">
            <span className="text-white text-xs font-bold">{unreadMessages}</span>
          </div>
        )}
      </motion.button>

      {/* Dropdown Menu - POPS OUT TO THE LEFT */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, x: 20, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 20, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="absolute top-20 right-20 w-72 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 backdrop-blur-2xl rounded-2xl border-3 border-amber-500/50 shadow-[0_0_40px_rgba(0,0,0,0.9)] overflow-hidden"
          >
            {/* Header - CENTERED & COMPACT */}
            <div className="bg-gradient-to-r from-amber-600 via-yellow-600 to-amber-600 p-3 border-b-2 border-amber-400">
              <h3 className="text-white text-sm font-bold text-center drop-shadow-lg font-['Cinzel']">
                Game Menu
              </h3>
            </div>

            {/* Menu Items - COMPACT SIZE */}
            <div className="p-2 space-y-1">{/* Messages - COMPACT */}
              <button
                onClick={handleOpenChat}
                className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-amber-600/20 hover:border hover:border-amber-500/50 transition-all text-left group"
              >
                <div className="relative flex-shrink-0">
                  <MessageCircle className="w-4 h-4 text-blue-400 group-hover:text-blue-300 transition-colors" />
                  {unreadMessages > 0 && (
                    <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 rounded-full flex items-center justify-center border border-white">
                      <span className="text-white text-[9px] font-bold">{unreadMessages}</span>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-xs font-semibold truncate group-hover:text-amber-200">Messages</p>
                  {unreadMessages > 0 && (
                    <p className="text-blue-300 text-[10px] truncate">{unreadMessages} new</p>
                  )}
                </div>
              </button>

              {/* Sound Toggle - COMPACT */}
              <button
                onClick={toggleSound}
                className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-amber-600/20 hover:border hover:border-amber-500/50 transition-all group"
              >
                {soundEnabled ? (
                  <Volume2 className="w-4 h-4 text-green-400 flex-shrink-0 group-hover:text-green-300" />
                ) : (
                  <VolumeX className="w-4 h-4 text-slate-400 flex-shrink-0 group-hover:text-slate-300" />
                )}
                <span className="text-white text-xs font-semibold truncate group-hover:text-amber-200">
                  Sound {soundEnabled ? 'On' : 'Off'}
                </span>
              </button>

              {/* Fullscreen - COMPACT */}
              <button
                onClick={toggleFullscreen}
                className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-amber-600/20 hover:border hover:border-amber-500/50 transition-all group"
              >
                <Maximize className="w-4 h-4 text-purple-400 flex-shrink-0 group-hover:text-purple-300" />
                <span className="text-white text-xs font-semibold truncate group-hover:text-amber-200">Fullscreen</span>
              </button>

              {/* View Mode Selector - COMPACT VERTICAL */}
              <div className="p-2 bg-slate-800/50 rounded-xl border border-amber-500/30">
                <div className="text-[10px] text-amber-300 font-['Cinzel'] font-bold mb-1.5 text-center">View Mode</div>
                <div className="flex flex-col gap-1.5">
                  {/* Classic View */}
                  <button
                    onClick={() => onViewModeChange && onViewModeChange('classic')}
                    className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg transition-all ${
                      viewMode === 'classic'
                        ? 'bg-gradient-to-br from-amber-600 to-yellow-600 text-white shadow-lg shadow-amber-500/50'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    <Monitor className="w-4 h-4" />
                    <span className="text-xs font-bold">Classic View</span>
                  </button>

                  {/* Responsive/Mobile View */}
                  <button
                    onClick={() => onViewModeChange && onViewModeChange('responsive')}
                    className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg transition-all ${
                      viewMode === 'responsive'
                        ? 'bg-gradient-to-br from-amber-600 to-yellow-600 text-white shadow-lg shadow-amber-500/50'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    <Smartphone className="w-4 h-4" />
                    <span className="text-xs font-bold">Mobile View</span>
                  </button>
                </div>
              </div>

              {/* Help/Rules - COMPACT */}
              <details className="group/details">
                <summary className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-amber-600/20 hover:border hover:border-amber-500/50 transition-all cursor-pointer list-none group">
                  <HelpCircle className="w-4 h-4 text-amber-400 flex-shrink-0 group-hover:text-amber-300" />
                  <span className="text-white text-xs font-semibold flex-1 truncate group-hover:text-amber-200">Rules</span>
                  <span className="text-amber-400 group-open/details:rotate-180 transition-transform text-xs">▼</span>
                </summary>
                
                <div className="mt-1 p-2 bg-slate-800/70 rounded-xl border border-amber-500/20 space-y-1.5 text-[10px] text-slate-200">
                  <div>
                    <p className="font-bold text-amber-300 text-[10px] mb-0.5">Objective:</p>
                    <p className="leading-relaxed">Win 7 books first</p>
                  </div>
                  <div>
                    <p className="font-bold text-amber-300 text-[10px] mb-0.5">Bidding:</p>
                    <p className="leading-relaxed">Bid 3-7 books</p>
                  </div>
                  <div>
                    <p className="font-bold text-amber-300 text-[10px] mb-0.5">Playing:</p>
                    <p className="leading-relaxed">Follow suit required</p>
                  </div>
                </div>
              </details>

              {/* Divider */}
              <div className="my-1.5 border-t-2 border-amber-500/30"></div>

              {/* Leave Game - COMPACT */}
              <button
                onClick={handleLeaveGame}
                className="w-full flex items-center gap-2 p-2 rounded-lg bg-red-900/30 hover:bg-red-900/50 transition-all border-2 border-red-500/50 hover:border-red-400 group"
              >
                <LogOut className="w-4 h-4 text-red-400 flex-shrink-0 group-hover:text-red-300" />
                <span className="text-red-300 text-xs font-bold truncate group-hover:text-red-200">Leave Game</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
