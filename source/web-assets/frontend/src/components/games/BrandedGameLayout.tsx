import { motion } from 'framer-motion';
import { ArrowLeft, RotateCcw, Trophy, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GameWatermark, CopyrightFooter, GlobalVibesLogo } from './GlobalVibesBranding';
import { HowToPlayGuide } from './HowToPlayGuide';
import { useState } from 'react';

/**
 * Branded game layout wrapper
 * Consistent layout for all Global Vibez DSG™ games
 */
export const BrandedGameLayout = ({
  children,
  gameName,
  gameType,
  gameIcon,
  onBack,
  onRestart,
  status,
  showWatermark = true,
  playerScore,
  aiScore,
  difficulty,
  aiThinking = false
}: {
  children?: any;
  gameName?: any;
  gameType?: any;
  gameIcon?: any;
  onBack?: any;
  onRestart?: any;
  status?: any;
  showWatermark?: boolean;
  playerScore?: any;
  aiScore?: any;
  difficulty?: any;
  aiThinking?: boolean;
  showParticles?: boolean;
}) => {
  const [showGuide, setShowGuide] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-purple-950 relative overflow-hidden">
      {/* Animated Background Grid */}
      <motion.div
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: `linear-gradient(rgba(6,182,212,0.3) 1px, transparent 1px),
                           linear-gradient(90deg, rgba(6,182,212,0.3) 1px, transparent 1px)`,
          backgroundSize: '50px 50px'
        }}
        animate={{
          backgroundPosition: ['0px 0px', '50px 50px']
        }}
        transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
      />

      {/* Global Vibez DSG Watermark */}
      {showWatermark && <GameWatermark position="bottom-right" />}

      {/* Main Content */}
      <div className="relative z-10 max-w-7xl mx-auto p-6">
        {/* Header */}
        <motion.div
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between mb-4">
            <Button
              onClick={onBack}
              variant="ghost"
              className="text-white hover:bg-white/10"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            
            <GlobalVibesLogo size="md" />

            <div className="flex gap-2">
              <Button
                onClick={() => setShowGuide(true)}
                variant="ghost"
                className="text-white hover:bg-white/10"
                title="How to Play"
              >
                <HelpCircle className="h-5 w-5" />
              </Button>
              {onRestart && (
                <Button
                  onClick={onRestart}
                  variant="ghost"
                  className="text-white hover:bg-white/10"
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  New Game
                </Button>
              )}
            </div>
          </div>

          {/* Game Title Card */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-gradient-to-br from-cyan-500 to-purple-500 rounded-xl">
                  {gameIcon || <Trophy className="w-8 h-8 text-white" />}
                </div>
                <div>
                  <h1 className="text-4xl font-black text-white">{gameName}</h1>
                  <p className="text-white/60 text-sm mt-1">Global Vibez DSG™ Gaming Experience</p>
                </div>
              </div>

              {/* Game Stats */}
              <div className="flex gap-6">
                {difficulty && (
                  <div className="text-center">
                    <p className="text-white/40 text-xs mb-1">Difficulty</p>
                    <p className="text-white font-bold capitalize">{difficulty}</p>
                  </div>
                )}
                {playerScore !== undefined && (
                  <div className="text-center">
                    <p className="text-white/40 text-xs mb-1">You</p>
                    <p className="text-2xl font-black text-cyan-400">{playerScore}</p>
                  </div>
                )}
                {aiScore !== undefined && (
                  <div className="text-center">
                    <p className="text-white/40 text-xs mb-1">AI</p>
                    <p className="text-2xl font-black text-purple-400">{aiScore}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Status Bar */}
            {status && (
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="mt-4 flex items-center justify-center gap-2 px-4 py-2 bg-white/5 rounded-lg border border-white/10"
              >
                {aiThinking && (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full"
                  />
                )}
                <p className="text-white/80 text-sm font-medium">{status}</p>
              </motion.div>
            )}
          </div>
        </motion.div>

        {/* Game Board Area */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl min-h-[500px]"
        >
          {children}
        </motion.div>

        {/* Copyright Footer */}
        <CopyrightFooter />
      </div>

      {/* How to Play Guide */}
      {showGuide && (
        <HowToPlayGuide 
          gameType={gameType} 
          onClose={() => setShowGuide(false)} 
        />
      )}
    </div>
  );
};

export default BrandedGameLayout;
