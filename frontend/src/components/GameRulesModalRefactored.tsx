import React from 'react';
import { AnimatePresence } from 'framer-motion';
import { GAME_RULES, GAME_EMOJIS } from '@/data/gameRulesData';
import ModalWrapper from './rules/ModalWrapper';
import RuleSection from './rules/RuleSection';
import RulesList from './rules/RulesList';

export default function GameRulesModalRefactored({ isOpen, onClose, gameType }) {
  const rules = GAME_RULES[gameType];
  const emoji = GAME_EMOJIS[gameType] || '🎮';

  if (!rules) {
    return (
      <AnimatePresence>
        {isOpen && (
          <ModalWrapper isOpen={isOpen} onClose={onClose} title="Rules Not Found" emoji="❓">
            <p className="text-white">Rules for this game are not available yet.</p>
            <button
              onClick={onClose}
              className="w-full py-4 bg-gradient-to-r from-cyan-600 to-purple-600 text-white font-bold text-xl rounded-xl hover:scale-105 transition-transform"
            >
              Close
            </button>
          </ModalWrapper>
        )}
      </AnimatePresence>
    );
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <ModalWrapper isOpen={isOpen} onClose={onClose} title={rules.title} emoji={emoji}>
          {/* Objective */}
          <RuleSection
            title="Objective"
            content={rules.objective}
            variant="objective"
          />

          {/* Rules */}
          <RulesList rules={rules.rules} />

          {/* How to Win */}
          <RuleSection
            title="How to Win"
            content={rules.howToWin}
            variant="win"
          />

          {/* Play button */}
          <button
            onClick={onClose}
            className="w-full py-4 bg-gradient-to-r from-green-600 to-cyan-600 text-white font-bold text-xl rounded-xl hover:scale-105 transition-transform border-2 border-green-400"
          >
            Got It! Let's Play! 🎮
          </button>
        </ModalWrapper>
      )}
    </AnimatePresence>
  );
}

// Export original for backwards compatibility
export { GAME_RULES };
