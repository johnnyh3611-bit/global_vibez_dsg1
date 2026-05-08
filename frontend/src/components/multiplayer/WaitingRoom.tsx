import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Crown, 
  Users, 
  Copy, 
  Check, 
  Settings, 
  Play,
  X,
  Eye,
  UserPlus,
  Zap
} from 'lucide-react';
import { toast } from 'react-hot-toast';

/**
 * WaitingRoom - Universal Multiplayer Waiting Room
 * Works for ANY 4-player card game (Bid Whist, Spades, Hearts, etc.)
 * 
 * Features:
 * - 4 visual player seats
 * - Ready-up system
 * - Room code sharing
 * - Spectator slots
 * - Host controls
 * - Public/Private toggle
 */

export interface WaitingRoomPlayer {
  name: string;
  position: 'north' | 'east' | 'south' | 'west' | string;
  team?: 'team1' | 'team2' | string;
  is_ready?: boolean;
}

export interface WaitingRoomSpectator {
  id?: string;
  name: string;
}

export interface WaitingRoomSettings {
  is_public?: boolean;
  wager?: number;
  winning_score?: number;
}

export interface WaitingRoomProps {
  roomCode: string;
  players?: Record<string, WaitingRoomPlayer>;
  spectators?: WaitingRoomSpectator[];
  hostId?: string;
  mySessionId?: string;
  isHost?: boolean;
  roomSettings?: WaitingRoomSettings;
  onReady?: () => void;
  onKickPlayer?: (sessionId: string) => void;
  onStartGame?: () => void;
  onLeaveRoom?: () => void;
  onInvitePlayer?: () => void;
  onTogglePublic?: () => void;
  gameName?: string;
}

export default function WaitingRoom({
  roomCode,
  players = {},
  spectators = [],
  hostId,
  mySessionId,
  isHost,
  roomSettings = {},
  onReady,
  onKickPlayer,
  onStartGame,
  onLeaveRoom,
  onInvitePlayer,
  onTogglePublic,
  gameName = 'Card Game'
}: WaitingRoomProps) {
  const [copied, setCopied] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Player positions (clockwise: North, East, South, West)
  const positions = ['north', 'east', 'south', 'west'];
  
  // Map players to positions
  const getPlayerAtPosition = (position: string): [string, WaitingRoomPlayer] | undefined => {
    return (Object.entries(players) as Array<[string, WaitingRoomPlayer]>)
      .find(([_sid, player]) => player.position === position);
  };

  // Check if all players are ready
  const allPlayersReady = Object.keys(players).length === 4 &&
    (Object.values(players) as WaitingRoomPlayer[]).every(p => p.is_ready);

  const canStartGame = isHost && allPlayersReady;

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    toast.success('Room code copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  const shareRoom = () => {
    const shareUrl = `${window.location.origin}/games/multiplayer/${gameName.toLowerCase().replace(' ', '-')}/${roomCode}`;
    navigator.clipboard.writeText(shareUrl);
    toast.success('Room link copied! Share with friends.');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-purple-950 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-4xl font-['Cinzel'] text-amber-400 flex items-center gap-3">
              <Users className="w-10 h-10" />
              {gameName} Lobby
            </h1>
            <p className="text-slate-400 text-sm mt-1">Waiting for players...</p>
          </div>

          <Button
            variant="ghost"
            onClick={onLeaveRoom}
            className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
          >
            <X className="w-5 h-5 mr-2" />
            Leave Room
          </Button>
        </div>

        {/* Room Code Card */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-amber-900/30 to-yellow-900/30 backdrop-blur-xl rounded-2xl p-6 border-2 border-amber-500/50 mb-6"
        >
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <div className="text-amber-300/70 text-sm mb-1">Room Code</div>
              <div className="flex items-center gap-3">
                <span className="text-5xl font-black font-['Courier_New'] text-amber-400 tracking-widest">
                  {roomCode}
                </span>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={copyRoomCode}
                  className="p-3 bg-amber-500/20 hover:bg-amber-500/30 rounded-lg transition-colors"
                >
                  {copied ? (
                    <Check className="w-6 h-6 text-green-400" />
                  ) : (
                    <Copy className="w-6 h-6 text-amber-300" />
                  )}
                </motion.button>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button
                onClick={shareRoom}
                className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white"
              >
                <UserPlus className="w-5 h-5 mr-2" />
                Invite Friends
              </Button>

              {isHost && (
                <Button
                  onClick={() => setShowSettings(!showSettings)}
                  variant="outline"
                  className="border-amber-500/50 text-amber-300"
                >
                  <Settings className="w-5 h-5 mr-2" />
                  Settings
                </Button>
              )}
            </div>
          </div>

          {/* Room Settings Display */}
          <div className="mt-4 flex items-center gap-6 text-sm text-amber-200/70">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${roomSettings.is_public ? 'bg-green-400' : 'bg-orange-400'}`} />
              {roomSettings.is_public ? 'Public Room' : 'Private Room'}
            </div>
            {roomSettings.wager > 0 && (
              <div>💰 Bet: {roomSettings.wager} credits</div>
            )}
            {roomSettings.winning_score && (
              <div>🏆 Win at: {roomSettings.winning_score} points</div>
            )}
          </div>
        </motion.div>

        {/* 4-Player Seats Grid */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          {positions.map((position, idx) => {
            const playerEntry = getPlayerAtPosition(position);
            const player = playerEntry ? playerEntry[1] : null;
            const sessionId = playerEntry ? playerEntry[0] : null;
            const isOccupied = !!player;
            const isMe = sessionId === mySessionId;
            const isPlayerHost = sessionId === hostId;

            return (
              <motion.div
                key={position}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.1 }}
                className={`relative bg-slate-900/50 backdrop-blur-sm rounded-2xl p-6 border-2 ${
                  isOccupied 
                    ? isMe 
                      ? 'border-amber-500 shadow-lg shadow-amber-500/30' 
                      : 'border-slate-600'
                    : 'border-dashed border-slate-700'
                }`}
              >
                {/* Position Label */}
                <div className="absolute top-3 left-3 text-xs font-bold text-slate-500 uppercase">
                  {position}
                </div>

                {/* Host Crown */}
                {isPlayerHost && (
                  <motion.div
                    initial={{ scale: 0, rotate: 180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    className="absolute top-3 right-3"
                  >
                    <Crown className="w-6 h-6 text-amber-400" />
                  </motion.div>
                )}

                {isOccupied ? (
                  <div className="flex flex-col items-center justify-center min-h-[160px]">
                    {/* Avatar */}
                    <div className={`w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold mb-3 ${
                      player.is_ready 
                        ? 'bg-gradient-to-br from-green-500 to-emerald-600 shadow-lg shadow-green-500/50' 
                        : 'bg-gradient-to-br from-slate-600 to-slate-700'
                    }`}>
                      {player.name.charAt(0).toUpperCase()}
                    </div>

                    {/* Player Name */}
                    <div className="text-white font-bold text-lg mb-2">
                      {player.name}
                      {isMe && <span className="text-amber-400 text-sm ml-2">(You)</span>}
                    </div>

                    {/* Team Badge */}
                    <div className={`px-3 py-1 rounded-full text-xs font-bold mb-3 ${
                      player.team === 'team1' 
                        ? 'bg-blue-500/30 text-blue-300' 
                        : 'bg-red-500/30 text-red-300'
                    }`}>
                      {player.team === 'team1' ? 'Team 1' : 'Team 2'}
                    </div>

                    {/* Ready Status */}
                    {player.is_ready ? (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="flex items-center gap-2 bg-green-500/20 px-4 py-2 rounded-lg border border-green-500/50"
                      >
                        <Check className="w-5 h-5 text-green-400" />
                        <span className="text-green-300 font-bold">READY</span>
                      </motion.div>
                    ) : (
                      <div className="text-slate-400 text-sm">Waiting...</div>
                    )}

                    {/* Ready Button (for current player) */}
                    {isMe && !player.is_ready && (
                      <Button
                        onClick={onReady}
                        className="mt-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white"
                      >
                        <Zap className="w-4 h-4 mr-2" />
                        Ready Up
                      </Button>
                    )}

                    {/* Kick Button (for host) */}
                    {isHost && !isMe && (
                      <Button
                        onClick={() => onKickPlayer(sessionId)}
                        variant="ghost"
                        size="sm"
                        className="mt-2 text-red-400 hover:text-red-300 hover:bg-red-900/20"
                      >
                        Kick
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center min-h-[160px] text-slate-500">
                    <Users className="w-16 h-16 mb-3 opacity-30" />
                    <div className="text-sm">Waiting for player...</div>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Spectators Section */}
        {spectators.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-slate-900/50 backdrop-blur-sm rounded-xl p-4 border border-slate-700 mb-6"
          >
            <div className="flex items-center gap-2 text-slate-400 text-sm mb-3">
              <Eye className="w-4 h-4" />
              Spectators ({spectators.length})
            </div>
            <div className="flex flex-wrap gap-3">
              {spectators.map((spectator, idx) => (
                <div
                  key={`spectator-${spectator.id || spectator.name}-${idx}`}
                  className="flex items-center gap-2 bg-slate-800/50 px-3 py-2 rounded-lg"
                >
                  <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs">
                    {spectator.name.charAt(0)}
                  </div>
                  <span className="text-white text-sm">{spectator.name}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Start Game Button */}
        <div className="flex justify-center">
          <Button
            onClick={onStartGame}
            disabled={!canStartGame}
            className={`px-12 py-6 text-2xl font-['Cinzel'] font-bold rounded-xl transition-all ${
              canStartGame
                ? 'bg-gradient-to-r from-amber-600 via-yellow-600 to-amber-600 text-white shadow-2xl hover:shadow-amber-500/50 scale-100 hover:scale-105'
                : 'bg-slate-700 text-slate-500 cursor-not-allowed'
            }`}
          >
            <Play className="w-8 h-8 mr-3" />
            Start Game
          </Button>
        </div>

        {!canStartGame && (
          <p className="text-center text-slate-400 text-sm mt-4">
            {Object.keys(players).length < 4 
              ? `Waiting for ${4 - Object.keys(players).length} more player(s)...` 
              : 'Waiting for all players to ready up...'}
          </p>
        )}
      </div>
    </div>
  );
}
