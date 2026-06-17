
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CinematicCelebration } from '@/components/CinematicCelebration';
import { AIOpponentCard } from '@/components/AIOpponentCard';
import { getRandomOpponent } from '@/data/aiOpponents';
import RedesignedCasinoTable from '@/components/casino/RedesignedCasinoTable';

import cardSoundManager from '@/utils/cardSoundManager';
import ParticleEffectsOverlay from '@/components/ParticleEffectsOverlay';
import dealerVoice, { DealerCallouts } from '@/utils/dealerVoice';
import casinoSounds from '@/utils/casinoSoundManager';

export function PracticePoker({ game, onMove, makingMove, aiThinking }: { game?: any, onMove?: any, makingMove?: any, aiThinking?: any }) {
  const playerHand = game.game_state?.player_hand || [];
  const communityCards = game.game_state?.community_cards || [];
  const pot = game.game_state?.pot || 0;
  const playerChips = game.game_state?.player_chips || 1000;
  const aiChips = game.game_state?.ai_chips || 1000;
  const currentBet = game.game_state?.current_bet || 0;
  const [gameResult, setGameResult] = useState(null);
  const [selectedTable, setSelectedTable] = useState('professional');
  const [dealerStyle, setDealerStyle] = useState('elegant_female');
  const [aiOpponent, setAiOpponent] = useState(null);
  
  const gameOver = game.status === 'completed';
  const playerWon = gameOver && game.winner === 'player';

  useEffect(() => {
    if (!aiOpponent) {
      setAiOpponent(getRandomOpponent());
    }
  }, []);

  useEffect(() => {
    if (gameOver) {
      if (game.winner === 'player') {
        cardSoundManager.playWinSound(); // AAA Card Juice
        dealerVoice.speak(DealerCallouts.POKER_SHOWDOWN + " " + DealerCallouts.NICE_HAND); // Dealer announces
        setGameResult({ type: 'win', message: 'You Win the Pot! 🎉' });
      } else if (game.winner === 'ai') {
        cardSoundManager.playLoseSound(); // AAA Card Juice
        dealerVoice.speak(DealerCallouts.TOUGH_LUCK); // Dealer response
        setGameResult({ type: 'lose', message: 'AI Wins! 😔' });
      } else {
        setGameResult({ type: 'draw', message: 'Split Pot! 🤝' });
      }
    }
  }, [gameOver, game.winner]);

  return (
    <>
      {/* Use Redesigned Casino Table */}
      <RedesignedCasinoTable
        gameType="poker"
        playerHand={playerHand}
        communityCards={communityCards}
        playerChips={playerChips}
        currentBet={currentBet}
        pot={pot}
        onFold={() => {
          cardSoundManager.playCardSlam();
          dealerVoice.speak(DealerCallouts.FOLD);
          onMove({ action: 'fold' });
        }}
        onCall={() => {
          cardSoundManager.playCardFlip();
          casinoSounds.playChipPlace();
          dealerVoice.speak(DealerCallouts.CALL);
          onMove({ action: 'call' });
        }}
        onRaise={() => {
          cardSoundManager.playCardSlam();
          casinoSounds.playChipStack();
          dealerVoice.speak(DealerCallouts.RAISE(currentBet * 2));
          onMove({ action: 'raise' });
        }}
        disabled={makingMove || aiThinking || game.current_turn !== 'player'}
        gameOver={gameOver}
      />
      
      {/* AAA Card Juice - Particle Effects */}
      <ParticleEffectsOverlay />
    </>
  );
}
