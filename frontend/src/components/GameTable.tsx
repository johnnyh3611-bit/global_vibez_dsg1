import { motion } from 'framer-motion';
import { Crown, Clock, Trophy } from 'lucide-react';

/**
 * GameTable Component - Modern table-style layout inspired by Spades Plus
 * Positions players around a virtual table with avatars, names, and status
 */
export const GameTable = ({ 
  players = [], 
  currentTurn, 
  currentUserId,
  gameType = 'card', // 'card', 'board', 'trivia'
  children 
}) => {
  // Position players: For 2 players (bottom=you, top=opponent)
  // For 4 players (bottom=you, left=partner, top=opponent1, right=opponent2)
  const getPlayerPosition = (index, totalPlayers) => {
    if (totalPlayers === 2) {
      return index === 0 ? 'bottom' : 'top';
    } else if (totalPlayers === 4) {
      const positions = ['bottom', 'left', 'top', 'right'];
      return positions[index];
    }
    return 'bottom';
  };

  const positionClasses = {
    top: 'absolute top-4 left-1/2 -translate-x-1/2',
    bottom: 'absolute bottom-4 left-1/2 -translate-x-1/2',
    left: 'absolute left-4 top-1/2 -translate-y-1/2',
    right: 'absolute right-4 top-1/2 -translate-y-1/2'
  };

  return (
    <div className="relative w-full h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div 
          className="absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
            backgroundSize: '40px 40px'
          }}
        />
      </div>

      {/* Game Table Surface */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative w-full max-w-7xl h-full px-4 py-4">
          {/* Player Seats */}
          {players.map((player, index) => {
            const position = getPlayerPosition(index, players.length);
            const isCurrentPlayer = player.user_id === currentUserId;
            const isTheirTurn = currentTurn === player.user_id;
            
            return (
              <motion.div
                key={player.user_id}
                className={positionClasses[position]}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.1 }}
              >
                <PlayerSeat
                  player={player}
                  isCurrentPlayer={isCurrentPlayer}
                  isTheirTurn={isTheirTurn}
                  position={position}
                />
              </motion.div>
            );
          })}

          {/* Center Game Area */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="pointer-events-auto">
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * PlayerSeat - Individual player card with avatar, name, and status
 */
const PlayerSeat = ({ player, isCurrentPlayer, isTheirTurn, position }) => {
  const isVertical = position === 'left' || position === 'right';

  return (
    <motion.div
      className={`relative ${isVertical ? 'w-24' : 'w-auto'}`}
      animate={{
        scale: isTheirTurn ? 1.05 : 1,
      }}
      transition={{ duration: 0.3 }}
    >
      {/* Turn Indicator Glow */}
      {isTheirTurn && (
        <motion.div
          className="absolute inset-0 bg-yellow-400 rounded-2xl blur-xl opacity-50"
          animate={{
            opacity: [0.3, 0.6, 0.3],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
          }}
        />
      )}

      {/* Player Card */}
      <div className={`relative bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-4 border-2 ${
        isTheirTurn ? 'border-yellow-400' : 'border-slate-700'
      } shadow-2xl backdrop-blur-lg ${isVertical ? 'flex flex-col items-center' : 'flex items-center gap-4'}`}>
        
        {/* Avatar */}
        <div className="relative">
          <div className={`${isVertical ? 'w-16 h-16' : 'w-14 h-14'} rounded-full bg-gradient-to-br ${
            isCurrentPlayer 
              ? 'from-blue-500 to-purple-600' 
              : 'from-slate-600 to-slate-700'
          } flex items-center justify-center text-2xl font-bold text-white border-3 ${
            isTheirTurn ? 'border-yellow-400' : 'border-slate-600'
          } shadow-lg`}>
            {player.picture ? (
              <img 
                src={player.picture} 
                alt={player.name}
                className="w-full h-full rounded-full object-cover" loading="lazy" />
            ) : (
              <span>{player.name?.charAt(0).toUpperCase()}</span>
            )}
          </div>

          {/* Crown for winner/leader */}
          {player.score > 0 && (
            <div className="absolute -top-2 -right-2 bg-yellow-400 rounded-full p-1">
              <Crown className="w-4 h-4 text-yellow-900" />
            </div>
          )}

          {/* Turn Clock */}
          {isTheirTurn && (
            <motion.div
              className="absolute -bottom-1 -right-1 bg-yellow-400 rounded-full p-1"
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            >
              <Clock className="w-4 h-4 text-yellow-900" />
            </motion.div>
          )}
        </div>

        {/* Player Info */}
        <div className={`${isVertical ? 'text-center mt-2' : 'flex-1'}`}>
          <div className="flex items-center gap-2">
            <p className={`font-bold text-white ${isVertical ? 'text-xs' : 'text-sm'}`}>
              {isCurrentPlayer ? 'You' : player.name || 'Player'}
            </p>
            {isCurrentPlayer && (
              <div className="bg-blue-500 text-white text-xs px-2 py-0.5 rounded-full">
                ME
              </div>
            )}
          </div>

          {/* Score */}
          {player.score !== undefined && (
            <div className="flex items-center gap-1 mt-1">
              <Trophy className="w-3 h-3 text-yellow-400" />
              <span className="text-xs text-slate-300 font-semibold">
                {player.score}
              </span>
            </div>
          )}

          {/* Status */}
          {player.status && (
            <p className="text-xs text-slate-400 mt-1">
              {player.status}
            </p>
          )}
        </div>

        {/* Turn Indicator Text */}
        {isTheirTurn && (
          <motion.div
            className="absolute -top-8 left-1/2 -translate-x-1/2 bg-yellow-400 text-yellow-900 px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {isCurrentPlayer ? 'YOUR TURN' : 'PLAYING...'}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
};

export default GameTable;
