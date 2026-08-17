import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Dices } from 'lucide-react';
import { useState } from 'react';

/**
 * Ludo Board Component - Global Vibez DSG™ Edition
 * Full 4-player Ludo game with animations
 */
export const LudoBoard = ({ gameState, onMove, disabled }) => {
  const [selectedPiece, setSelectedPiece] = useState(null);
  const [rollingDice, setRollingDice] = useState(false);

  const board = gameState?.board || {};
  const diceValue = gameState?.dice_value;
  const currentPlayer = gameState?.current_player || 'player';
  const colors = gameState?.colors || { player: 'red', ai1: 'blue', ai2: 'green', ai3: 'yellow' };
  const canRoll = gameState?.can_roll;

  const colorClasses = {
    red: 'bg-red-500 border-red-700',
    blue: 'bg-blue-500 border-blue-700',
    green: 'bg-green-500 border-green-700',
    yellow: 'bg-yellow-500 border-yellow-700'
  };

  const handleRollDice = () => {
    if (disabled || !canRoll || currentPlayer !== 'player') return;
    
    setRollingDice(true);
    setTimeout(() => {
      setRollingDice(false);
      onMove({ action: 'roll' });
    }, 600);
  };

  const handlePieceClick = (player, pieceId) => {
    if (disabled || currentPlayer !== 'player' || !diceValue) return;
    onMove({ action: 'move', player, piece_id: pieceId });
    setSelectedPiece(null);
  };

  const renderHome = (player, position) => {
    const playerColor = colors[player];
    const pieces = board[player] || [];
    const homePieces = pieces.filter(p => p.position === -1);

    return (
      <div className={`${colorClasses[playerColor]} rounded-2xl p-4 ${position}`}>
        <div className="grid grid-cols-2 gap-2">
          {[0, 1, 2, 3].map((i) => {
            const piece = homePieces[i];
            return (
              <motion.button
                key={`item-${i}`}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => piece && diceValue === 6 && handlePieceClick(player, piece.id)}
                disabled={!piece || diceValue !== 6 || currentPlayer !== 'player'}
                className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  piece ? `${colorClasses[playerColor]} border-4 border-white shadow-lg` : 'bg-white/20 border-2 border-white/40'
                } transition-all`}
              >
                {piece && <span className="text-white font-bold text-sm">{piece.id + 1}</span>}
              </motion.button>
            );
          })}
        </div>
        <p className="text-white text-xs text-center mt-2 font-bold uppercase">{player}</p>
      </div>
    );
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="max-w-4xl mx-auto"
    >
      {/* Dice Control */}
      <div className="text-center mb-6">
        <div className="flex items-center justify-center gap-6">
          {/* Current Player Indicator */}
          <div className="flex items-center gap-2">
            <div className={`w-4 h-4 rounded-full ${colorClasses[colors[currentPlayer]]}`} />
            <span className="text-white font-semibold capitalize">{currentPlayer}'s Turn</span>
          </div>

          {/* Dice Display */}
          <motion.div
            animate={rollingDice ? { rotate: [0, 360, 720] } : {}}
            transition={{ duration: 0.6 }}
            className="bg-white rounded-xl p-4 shadow-2xl min-w-[80px]"
          >
            {diceValue ? (
              <div className="text-5xl font-black text-purple-600">{diceValue}</div>
            ) : (
              <Dices className="w-12 h-12 text-gray-400" />
            )}
          </motion.div>

          {/* Roll Button */}
          {currentPlayer === 'player' && canRoll && (
            <Button
              onClick={handleRollDice}
              disabled={disabled || rollingDice}
              className="bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 px-8 py-6 text-lg font-bold shadow-lg"
            >
              🎲 Roll Dice
            </Button>
          )}
        </div>
      </div>

      {/* Ludo Board */}
      <div className="relative bg-white/10 backdrop-blur-sm p-8 rounded-3xl border-4 border-white/20 shadow-2xl">
        {/* 11x11 Grid Board */}
        <div className="grid grid-cols-11 gap-1 bg-white/5 p-4 rounded-2xl">
          {/* Top Section */}
          <div className="col-span-4 row-span-4 p-2">
            {renderHome('ai2', 'relative')}
          </div>
          <div className="col-span-3 row-span-4 grid grid-cols-3 gap-1">
            {/* Top path */}
            {[...Array(12)].map((_, i) => (
              <div key={`top-${i}`} className="bg-white/20 rounded aspect-square" />
            ))}
          </div>
          <div className="col-span-4 row-span-4 p-2">
            {renderHome('ai1', 'relative')}
          </div>

          {/* Middle Section */}
          <div className="col-span-4 row-span-3 grid grid-rows-3 gap-1">
            {/* Left path */}
            {[...Array(12)].map((_, i) => (
              <div key={`left-${i}`} className="bg-white/20 rounded" />
            ))}
          </div>
          <div className="col-span-3 row-span-3 bg-gradient-to-br from-purple-500 via-pink-500 to-cyan-500 rounded-xl flex items-center justify-center">
            <div className="text-center text-white">
              <div className="text-4xl mb-2">❤️</div>
              <p className="font-black text-xl">GLOBAL</p>
              <p className="font-black text-xl">VIBES</p>
              <p className="text-xs mt-1">™</p>
            </div>
          </div>
          <div className="col-span-4 row-span-3 grid grid-rows-3 gap-1">
            {/* Right path */}
            {[...Array(12)].map((_, i) => (
              <div key={`right-${i}`} className="bg-white/20 rounded" />
            ))}
          </div>

          {/* Bottom Section */}
          <div className="col-span-4 row-span-4 p-2">
            {renderHome('player', 'relative')}
          </div>
          <div className="col-span-3 row-span-4 grid grid-cols-3 gap-1">
            {/* Bottom path */}
            {[...Array(12)].map((_, i) => (
              <div key={`bottom-${i}`} className="bg-white/20 rounded aspect-square" />
            ))}
          </div>
          <div className="col-span-4 row-span-4 p-2">
            {renderHome('ai3', 'relative')}
          </div>
        </div>

        {/* Global Vibez DSG Watermark */}
        <div className="absolute bottom-4 right-4 text-white/20 text-xs">
          Global Vibez DSG™ Ludo
        </div>
      </div>

      {/* Instructions */}
      <div className="mt-6 text-center">
        <p className="text-white/60 text-sm">
          Roll a 6 to bring pieces out of home. First to finish all pieces wins!
        </p>
      </div>
    </motion.div>
  );
};

export default LudoBoard;
