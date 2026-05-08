import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Confetti from 'react-confetti';
import { useWindowSize } from 'react-use';

import FireworksLayer from './celebration/FireworksLayer';
import LightRaysLayer from './celebration/LightRaysLayer';
import FloatingParticlesLayer from './celebration/FloatingParticlesLayer';
import ResultHeadline from './celebration/ResultHeadline';
import StatsDisplay from './celebration/StatsDisplay';
import CelebrationActionButtons from './celebration/CelebrationActionButtons';

const CONFETTI_COLORS = ['#FFD700', '#FFA500', '#FF6347', '#FF1493', '#00CED1', '#32CD32'];

/**
 * Cinematic Game Celebration — Realistic, immersive, no borders.
 * AAA game quality victory screen.
 */
export function CinematicCelebration({
  result,
  message,
  opponentName = 'AI',
  playerScore,
  opponentScore,
  coinsEarned,
  onRestart,
  onContinue,
}) {
  const { width, height } = useWindowSize();
  const [showElements, setShowElements] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => setShowElements(true), 500);
    return () => clearTimeout(timeout);
  }, []);

  if (!result) return null;

  const isWin = result === 'win';
  const isLose = result === 'lose';

  const backgroundStyle = {
    background: isWin
      ? 'radial-gradient(circle at center, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.95) 100%)'
      : 'radial-gradient(circle at center, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.98) 100%)',
    backdropFilter: 'blur(10px)',
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 overflow-hidden" data-testid="cinematic-celebration">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0"
          style={backgroundStyle}
        />

        {isWin && (
          <>
            <Confetti
              width={width}
              height={height}
              recycle
              numberOfPieces={400}
              gravity={0.3}
              wind={0.02}
              colors={CONFETTI_COLORS}
              opacity={0.9}
            />
            <FireworksLayer />
            <LightRaysLayer />
            <FloatingParticlesLayer width={width} height={height} />
          </>
        )}

        <motion.div
          animate={isWin ? { x: [0, -5, 5, -5, 5, 0], y: [0, 5, -5, 5, -5, 0] } : {}}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="absolute inset-0 flex items-center justify-center"
        >
          <div className="relative w-full h-full flex flex-col items-center justify-center px-8">
            <motion.div
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 0.4, scale: 2 }}
              transition={{ duration: 1 }}
              className="absolute top-1/4 w-[600px] h-[600px] rounded-full blur-[150px]"
              style={{
                background: isWin
                  ? 'radial-gradient(circle, #FFD700, #FFA500, transparent)'
                  : 'radial-gradient(circle, #6B7280, #4B5563, transparent)',
              }}
            />

            <ResultHeadline
              isWin={isWin}
              showElements={showElements}
              message={message}
              opponentName={opponentName}
            />

            {showElements && (playerScore !== undefined || coinsEarned !== undefined) && (
              <StatsDisplay
                playerScore={playerScore}
                opponentScore={opponentScore}
                opponentName={opponentName}
                coinsEarned={coinsEarned}
              />
            )}

            {showElements && (
              <CelebrationActionButtons
                isWin={isWin}
                onRestart={onRestart}
                onContinue={onContinue}
              />
            )}

            {isLose && showElements && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.2 }}
                className="text-gray-400 text-lg italic mt-8 max-w-2xl text-center"
                style={{ textShadow: '0 2px 10px rgba(0,0,0,0.8)' }}
              >
                &ldquo;The master has failed more times than the beginner has even tried.&rdquo;
              </motion.p>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export default CinematicCelebration;
