import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { Sparkles, Lock, Unlock, Trophy, Coins, MessageCircleOff } from "lucide-react";
import VanishingChat from "./VanishingChat";
import VibeCallRoom from "@/components/voice/VibeCallRoom";
import CallButton from "@/components/voice/CallButton";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export const JustForTheNightRoom = ({ 
  roomData,
  onChallengeStart,
  onExit 
}) => {
  const [isGameWon, setIsGameWon] = useState(false);
  const [showChallenge, setShowChallenge] = useState(false);
  const [bonusTokens, setBonusTokens] = useState(0);
  const [watermarkId, setWatermarkId] = useState(null);

  useEffect(() => {
    if (roomData?.watermark_id) {
      setWatermarkId(roomData.watermark_id);
    }
  }, [roomData]);

  const handleChallengeComplete = (won) => {
    setIsGameWon(won);
    setShowChallenge(false);
    
    // If won and Founder AI dealer, show bonus
    if (won && roomData?.challenge?.dealer_type === "founder_ai") {
      setBonusTokens(50);
    }
  };

  const getDealerBadge = (dealerType) => {
    switch (dealerType) {
      case "founder_ai":
        return (
          <div className="flex items-center gap-2 px-3 py-1 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 rounded-full">
            <Sparkles className="w-4 h-4 text-yellow-400" />
            <span className="text-xs font-bold text-yellow-300">FOUNDER AI</span>
          </div>
        );
      case "personal_avatar":
        return (
          <div className="flex items-center gap-2 px-3 py-1 bg-purple-500/20 border border-purple-500/30 rounded-full">
            <span className="text-xs font-bold text-purple-300">PERSONAL</span>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="relative w-full h-full min-h-[600px] bg-gradient-to-b from-gray-900 via-purple-900/20 to-gray-900">
      {/* Main Video Container */}
      <div className="relative w-full h-[500px] rounded-3xl overflow-hidden bg-black shadow-2xl">
        {/* Blur Reveal Animation */}
        <motion.div
          animate={{ 
            filter: isGameWon ? "blur(0px)" : "blur(40px) saturate(150%)",
            scale: isGameWon ? 1 : 1.1
          }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          className="w-full h-full relative"
        >
          {roomData?.stream_url ? (
            <video 
              src={roomData.stream_url} 
              autoPlay 
              loop 
              muted 
              playsInline
              className="w-full h-full object-cover" 
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-purple-900 via-pink-900 to-purple-900 animate-pulse" />
          )}
          
          {/* Watermark (Anti-Recording) */}
          {watermarkId && (
            <div className="absolute bottom-4 right-4 text-white/10 text-xs font-mono select-none pointer-events-none">
              {watermarkId}
            </div>
          )}
        </motion.div>

        {/* Mystery Overlay (Before Win) */}
        <AnimatePresence>
          {!isGameWon && (
            <motion.div
              initial={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1 }}
              className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-black/40 via-black/60 to-black/80 backdrop-blur-sm"
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="text-center px-6"
              >
                <Lock className="w-16 h-16 text-pink-400 mx-auto mb-4 animate-pulse" />
                
                <h2 className="text-4xl md:text-5xl font-black tracking-tighter uppercase italic bg-gradient-to-r from-pink-400 via-purple-400 to-pink-400 text-transparent bg-clip-text mb-3">
                  Just For The Night
                </h2>
                
                <p className="text-lg font-medium text-gray-300 mb-6">
                  Beat the {roomData?.challenge?.game || "challenge"} to unlock...
                </p>

                {/* Dealer Badge */}
                <div className="flex justify-center mb-6">
                  {getDealerBadge(roomData?.challenge?.dealer_type)}
                </div>

                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    setShowChallenge(true);
                    onChallengeStart?.();
                  }}
                  className="px-8 py-4 bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 rounded-xl font-bold text-white shadow-lg shadow-pink-500/50 transition-all"
                >
                  <span className="flex items-center gap-2">
                    <Trophy className="w-5 h-5" />
                    Start Challenge
                  </span>
                </motion.button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Victory Overlay */}
        <AnimatePresence>
          {isGameWon && bonusTokens > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ delay: 0.5 }}
              className="absolute top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-yellow-500 to-orange-500 px-6 py-3 rounded-full shadow-xl"
            >
              <div className="flex items-center gap-2 text-white font-bold">
                <Coins className="w-5 h-5" />
                <span>Founder Bonus: +{bonusTokens} Vibez Coins!</span>
                <Sparkles className="w-5 h-5 animate-pulse" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Unlocked Badge */}
        <AnimatePresence>
          {isGameWon && (
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", duration: 0.8 }}
              className="absolute top-4 right-4 bg-green-500/20 border border-green-500/50 rounded-full p-3 backdrop-blur-sm"
            >
              <Unlock className="w-6 h-6 text-green-400" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Room Info Footer */}
      <div className="mt-6 bg-gray-800/50 rounded-2xl p-6 backdrop-blur-sm">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-2xl font-bold text-white mb-2">
              {roomData?.title || "Premium Room"}
            </h3>
            <p className="text-gray-400 text-sm mb-4">
              {roomData?.description || "A mysterious experience awaits..."}
            </p>
            <div className="flex items-center gap-4 text-sm">
              <span className="text-gray-500">
                Hosted by <span className="text-purple-400 font-semibold">{roomData?.owner_name || "Anonymous"}</span>
              </span>
              {roomData?.owner_id && roomData.owner_id !== roomData.current_user_id && (
                <CallButton
                  userId={roomData.owner_id}
                  displayName={roomData.owner_name || "Host"}
                  size="sm"
                />
              )}
              {roomData?.total_visits > 0 && (
                <span className="text-gray-500">
                  {roomData.total_visits} visit{roomData.total_visits !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
          
          {onExit && (
            <button
              onClick={onExit}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white font-medium transition-colors"
            >
              Exit Room
            </button>
          )}
        </div>
      </div>

      {/* Vanishing Chat — only visible after win (privacy: no chat with host before unlocking) */}
      {isGameWon && roomData?.owner_id && roomData?.current_user_id && (
        <div className="mt-6" data-testid="jftn-vanishing-chat">
          <div className="flex items-center gap-2 mb-3">
            <MessageCircleOff className="w-5 h-5 text-fuchsia-400" />
            <h3 className="text-xl font-black italic tracking-tighter text-white">
              Vanishing Chat
            </h3>
            <span className="text-[10px] font-mono uppercase tracking-widest text-fuchsia-300 px-2 py-0.5 rounded-full bg-fuchsia-500/10 border border-fuchsia-400/30">
              3 min fuse
            </span>
          </div>
          <div className="h-[480px]">
            <VanishingChat
              roomId={roomData.room_id}
              currentUserId={roomData.current_user_id}
              peerUserId={roomData.owner_id}
              peerName={roomData.owner_name}
            />
          </div>

          {/* Vibe Call — push-to-talk audio chat scoped to this JFTN room */}
          <div className="mt-4">
            <VibeCallRoom channel={`jftn-${roomData.room_id}`} />
          </div>
        </div>
      )}

      {/* Challenge Modal Integration Point */}
      {showChallenge && !isGameWon && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-3xl p-8 max-w-4xl w-full shadow-2xl border border-purple-500/30">
            <h3 className="text-3xl font-bold text-white mb-6 text-center">
              {roomData?.challenge?.game?.toUpperCase() || "CHALLENGE"}
            </h3>
            
            {/* Game component would load here */}
            <div className="bg-gray-800 rounded-xl p-8 text-center">
              <p className="text-gray-400 mb-6">
                Game component integration point<br />
                ({roomData?.challenge?.game} - {roomData?.challenge?.difficulty} difficulty)
              </p>
              
              {/* Mock win/lose buttons for demo */}
              <div className="flex gap-4 justify-center">
                <button
                  onClick={() => handleChallengeComplete(true)}
                  className="px-6 py-3 bg-green-500 hover:bg-green-600 rounded-lg font-bold text-white transition-colors"
                >
                  ✓ Win (Demo)
                </button>
                <button
                  onClick={() => handleChallengeComplete(false)}
                  className="px-6 py-3 bg-red-500 hover:bg-red-600 rounded-lg font-bold text-white transition-colors"
                >
                  ✗ Lose (Demo)
                </button>
                <button
                  onClick={() => setShowChallenge(false)}
                  className="px-6 py-3 bg-gray-600 hover:bg-gray-500 rounded-lg font-medium text-white transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default JustForTheNightRoom;
