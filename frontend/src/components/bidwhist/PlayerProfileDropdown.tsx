import { motion } from 'framer-motion';
import { User, Trophy, Target, UserPlus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

/**
 * Player Profile Dropdown - Shows when clicking on a player badge
 * Displays: Profile picture, game stats, win statistics, Add Friend button
 * Team colors: Team 1 = Red, Team 2 = Blue
 */
export default function PlayerProfileDropdown({ playerName,
  position,
  team,
  isOpen,
  onClose,
  onAddFriend }: { playerName?: any, position?: any, team?: any, isOpen?: any, onClose?: any, onAddFriend?: any }) {
  const [friendRequestSent, setFriendRequestSent] = useState(false);

  // Team colors
  const teamColors = {
    team1: {
      bg: 'from-red-600 to-rose-600',
      border: 'border-red-500',
      text: 'text-red-400',
      glow: 'shadow-[0_0_20px_rgba(239,68,68,0.4)]'
    },
    team2: {
      bg: 'from-blue-600 to-cyan-600',
      border: 'border-blue-500',
      text: 'text-blue-400',
      glow: 'shadow-[0_0_20px_rgba(59,130,246,0.4)]'
    }
  };

  const teamColor = teamColors[team] || teamColors.team1;

  // Mock stats - these would come from backend in real implementation
  const playerStats = {
    gamesPlayed: 247,
    wins: 156,
    losses: 91,
    winRate: 63,
    totalBooks: 1842,
    avgBooksPerGame: 7.5,
    highestBid: 7,
    bidSuccessRate: 71
  };

  const handleAddFriend = () => {
    setFriendRequestSent(true);
    if (onAddFriend) {
      onAddFriend(playerName, position);
    }
    setTimeout(() => {
      onClose();
    }, 2000);
  };

  return (
    <div
      className={`w-full max-w-lg bg-gradient-to-br ${teamColor.bg} rounded-2xl border-4 ${teamColor.border} ${teamColor.glow} p-6 shadow-2xl`}
      style={{
        maxHeight: '90vh',
        overflowY: 'auto'
      }}
    >
            {/* Close Button - Larger and more visible */}
            <button
              onClick={onClose}
              className="absolute top-3 right-3 w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-all hover:scale-110 border-2 border-white/30"
            >
              <X className="w-6 h-6 text-white" />
            </button>

            {/* Profile Header */}
            <div className="flex items-center gap-4 mb-6 mt-2">
              {/* Profile Picture - Larger */}
              <div className={`w-24 h-24 rounded-full border-4 ${teamColor.border} bg-slate-900 flex items-center justify-center overflow-hidden shadow-lg`}>
                <User className="w-14 h-14 text-slate-400" />
              </div>
              
              {/* Player Info */}
              <div className="flex-1">
                <h3 className="text-3xl font-['Cinzel'] font-bold text-white mb-1 drop-shadow-lg">
                  {playerName || position.toUpperCase()}
                </h3>
                <div className="flex items-center gap-2">
                  <span className="text-base text-white/90 uppercase tracking-wider font-bold">
                    {position}
                  </span>
                  <span className="text-white/60">•</span>
                  <span className={`text-base font-bold ${teamColor.text} drop-shadow-md`}>
                    {team === 'team1' ? 'Red Team' : 'Blue Team'}
                  </span>
                </div>
              </div>
            </div>

            {/* Game Stats */}
            <div className="bg-black/40 rounded-xl p-5 mb-4 border border-white/20">
              <div className="flex items-center gap-2 mb-4">
                <Trophy className="w-6 h-6 text-amber-400" />
                <h4 className="font-['Cinzel'] font-bold text-white text-lg">Game Statistics</h4>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                {/* Games Played */}
                <div className="bg-white/10 rounded-lg p-3 border border-white/20">
                  <div className="text-xs text-white/70 mb-1 font-medium">Games Played</div>
                  <div className="text-2xl font-bold text-white">{playerStats.gamesPlayed}</div>
                </div>
                
                {/* Win Rate */}
                <div className="bg-white/10 rounded-lg p-3 border border-white/20">
                  <div className="text-xs text-white/70 mb-1 font-medium">Win Rate</div>
                  <div className="text-2xl font-bold text-green-400">{playerStats.winRate}%</div>
                </div>
                
                {/* Wins */}
                <div className="bg-white/10 rounded-lg p-3 border border-white/20">
                  <div className="text-xs text-white/70 mb-1 font-medium">Wins</div>
                  <div className="text-xl font-bold text-white">{playerStats.wins}</div>
                </div>
                
                {/* Losses */}
                <div className="bg-white/10 rounded-lg p-3 border border-white/20">
                  <div className="text-xs text-white/70 mb-1 font-medium">Losses</div>
                  <div className="text-xl font-bold text-white">{playerStats.losses}</div>
                </div>
              </div>
            </div>

            {/* Bid Whist Specific Stats */}
            <div className="bg-black/40 rounded-xl p-5 mb-5 border border-white/20">
              <div className="flex items-center gap-2 mb-4">
                <Target className="w-6 h-6 text-amber-400" />
                <h4 className="font-['Cinzel'] font-bold text-white text-lg">Bid Whist Stats</h4>
              </div>
              
              <div className="space-y-3">
                <div className="flex justify-between items-center bg-white/5 rounded-lg p-3 border border-white/10">
                  <span className="text-sm text-white/80 font-medium">Total Books Won</span>
                  <span className="text-lg font-bold text-amber-300">{playerStats.totalBooks}</span>
                </div>
                <div className="flex justify-between items-center bg-white/5 rounded-lg p-3 border border-white/10">
                  <span className="text-sm text-white/80 font-medium">Avg Books/Game</span>
                  <span className="text-lg font-bold text-amber-300">{playerStats.avgBooksPerGame}</span>
                </div>
                <div className="flex justify-between items-center bg-white/5 rounded-lg p-3 border border-white/10">
                  <span className="text-sm text-white/80 font-medium">Highest Bid</span>
                  <span className="text-lg font-bold text-amber-300">{playerStats.highestBid}</span>
                </div>
                <div className="flex justify-between items-center bg-white/5 rounded-lg p-3 border border-white/10">
                  <span className="text-sm text-white/80 font-medium">Bid Success Rate</span>
                  <span className="text-lg font-bold text-green-400">{playerStats.bidSuccessRate}%</span>
                </div>
              </div>
            </div>

            {/* Add Friend Button */}
            <Button
              onClick={handleAddFriend}
              disabled={friendRequestSent}
              className={`w-full py-4 font-['Cinzel'] font-bold text-lg ${
                friendRequestSent
                  ? 'bg-green-600 hover:bg-green-600'
                  : 'bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-700 hover:to-yellow-700'
              } text-white shadow-xl`}
            >
              {friendRequestSent ? (
                <>✓ Friend Request Sent</>
              ) : (
                <>
                  <UserPlus className="w-5 h-5 mr-2 inline" />
                  Add Friend
                </>
              )}
            </Button>
          </div>
  );
}
