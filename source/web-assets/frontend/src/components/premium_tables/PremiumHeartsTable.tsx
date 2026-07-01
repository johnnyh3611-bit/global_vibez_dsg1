
import React, { useState } from 'react';
import { PremiumGameTable } from './PremiumGameTable';
import { AllInOneHandView } from './AllInOneHandView';
import { ViewToggle } from './ViewToggle';
import { useUserAvatar, UserAvatarManager } from './UserAvatarManager';
import { getRandomAvatar } from './avatarSystem';
import { EnhancedCard3D } from './EnhancedCard3D';
import { SuitConfetti } from './ParticleSystem';
import { motion, AnimatePresence } from 'framer-motion';

export function PremiumHeartsTable({ game, onMove, makingMove, aiThinking, theme = 'rose' }: { game?: any, onMove?: any, makingMove?: any, aiThinking?: any, theme?: any }) {
  const [view, setView] = useState('2d');
  const userAvatar = useUserAvatar();
  const [opponentAvatars] = useState(() => [getRandomAvatar(), getRandomAvatar(), getRandomAvatar()]);
  
  const playerHand = game?.game_state?.player_hand || ['2H', '5D', 'QS', 'KH'];
  const trickCards = game?.game_state?.trick_cards || [];
  const scores = game?.game_state?.scores || [0, 0, 0, 0];
  const currentPlayer = game?.current_turn || 'player';
  const gameOver = game?.status === 'completed';
  const playerWon = gameOver && game?.winner === 'player';

  const handleCardClick = (card, index) => {
    if (makingMove || aiThinking || gameOver || currentPlayer !== 'player') return;
    onMove({ card, index });
  };

  const convertedPlayerHand = playerHand.map((card, i) => {
    const suit = card.slice(-1);
    const rank = card.slice(0, -1);
    const suitMap = { H: '♥️', D: '♦️', C: '♣️', S: '♠️' };
    return { id: `${card}-${i}`, suit: suitMap[suit] || '🎴', rank };
  });

  const opponentPositions = [
    { position: 'top', cardCount: 13, name: opponentAvatars[0]?.name || 'Player 2', avatar: opponentAvatars[0] },
    { position: 'left', cardCount: 13, name: opponentAvatars[1]?.name || 'Player 3', avatar: opponentAvatars[1] },
    { position: 'right', cardCount: 13, name: opponentAvatars[2]?.name || 'Player 4', avatar: opponentAvatars[2] },
  ];

  if (view === '2d') {
    return (
      <AllInOneHandView
        playerHand={convertedPlayerHand}
        opponentAvatar={{ emoji: opponentAvatars[0]?.emoji || '❤️', name: opponentAvatars[0]?.name || 'AI Player' }}
        onCardPlay={(card) => {
          const index = playerHand.findIndex((c, idx) => `${c}-${idx}` === card.id);
          if (index >= 0) handleCardClick(playerHand[index], index);
        }}
      >
        {/* Hearts-specific overlays */}
        <AnimatePresence>
          {playerWon && <SuitConfetti active={true} colors={['#EC4899', '#EF4444', '#F59E0B']} />}
        </AnimatePresence>
      </AllInOneHandView>
    );
  }

  return (
    <div className="relative w-full h-screen bg-[#080C16]">
      <ViewToggle view={view} onToggle={setView} />
      <UserAvatarManager />
      <SuitConfetti active={playerWon} colors={['#EC4899', '#EF4444', '#F59E0B']} />

      <PremiumGameTable theme={theme} activePlayerPosition={{ x: 50, y: 80 }} potAmount={0}>
        {playerHand.map((card, i) => (
          <EnhancedCard3D key={card.id || `playerHand-${i}`} card={card} position3D={{ x: -200 + i * 100, y: 300, z: 100 }} rotation3D={{ x: -20, y: 0, z: 0 }} faceUp={true} onClick={() => handleCardClick(card, i)} disabled={makingMove || aiThinking || gameOver} size="lg" theme={theme} />
        ))}
      </PremiumGameTable>

      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-20">
        <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-black/70 backdrop-blur-xl px-8 py-3 rounded-2xl border-2 border-pink-500/30">
          <h2 className="text-3xl font-black text-transparent bg-gradient-to-r from-pink-400 via-red-500 to-pink-400 bg-clip-text text-center">♥️ Hearts ♠️</h2>
          <p className="text-white/50 text-xs text-center mt-1">Global Vibez DSG™ | Card Games</p>
        </motion.div>
      </div>

      <AnimatePresence>
        {gameOver && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-center">
              <div className="text-9xl mb-4">{playerWon ? '🏆' : '😔'}</div>
              <h3 className={`text-6xl font-black mb-4 ${playerWon ? 'text-pink-400' : 'text-red-400'}`}>{playerWon ? 'YOU WIN!' : 'YOU LOSE!'}</h3>
              <p className="text-white text-2xl mb-6">Final Score: {scores[0]} points</p>
              <button onClick={() => onMove({ action: 'new_game' })} className="mt-6 bg-gradient-to-r from-pink-600 to-red-600 text-white font-black px-8 py-4 rounded-xl text-lg">🎮 PLAY AGAIN</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
