
// AI Opponent System for Practice Mode
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Bot, Play, Settings, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';

const AI_DIFFICULTIES = {
  easy: {
    name: 'Easy',
    icon: '🟢',
    color: 'from-green-600 to-emerald-600',
    description: 'Perfect for beginners',
    thinkTime: 1000,
    randomness: 0.3
  },
  medium: {
    name: 'Medium',
    icon: '🟡',
    color: 'from-yellow-600 to-orange-600',
    description: 'A balanced challenge',
    thinkTime: 1500,
    randomness: 0.2
  },
  hard: {
    name: 'Hard',
    icon: '🔴',
    color: 'from-red-600 to-rose-600',
    description: 'For experienced players',
    thinkTime: 2000,
    randomness: 0.1
  },
  expert: {
    name: 'Expert',
    icon: '⚫',
    color: 'from-purple-600 to-indigo-600',
    description: 'Maximum difficulty',
    thinkTime: 2500,
    randomness: 0.05
  }
};

export default function AIPracticeMode() {
  const navigate = useNavigate();
  const [selectedGame, setSelectedGame] = useState('ludo');
  const [selectedDifficulty, setSelectedDifficulty] = useState('medium');

  const games = [
    { id: 'ludo', name: 'Ludo', emoji: '🎲' },
    { id: 'dominoes', name: 'Dominoes', emoji: '🀫' },
    { id: 'mancala', name: 'Mancala', emoji: '🪨' },
    { id: 'backgammon', name: 'Backgammon', emoji: '🎲' },
    { id: 'chinesecheckers', name: 'Chinese Checkers', emoji: '⭐' },
    { id: 'parcheesi', name: 'Parcheesi', emoji: '🎲' },
    { id: 'mahjong', name: 'Mahjong', emoji: '🀄' },
    { id: 'carrom', name: 'Carrom', emoji: '🎯' },
    { id: 'shogi', name: 'Shogi', emoji: '将' },
    { id: 'xiangqi', name: 'Xiangqi', emoji: '象' }
  ];

  const startPractice = () => {
    // Would start a practice game against AI
    navigate(`/practice/${selectedGame}?difficulty=${selectedDifficulty}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="flex items-center justify-center mb-4">
            <Bot className="w-16 h-16 text-cyan-400 mr-4" />
            <h1 className="text-6xl font-black text-transparent bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text">
              AI Practice
            </h1>
          </div>
          <p className="text-xl text-gray-400">Sharpen your skills against AI opponents</p>
        </motion.div>

        {/* Game Selection */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
            <Play className="w-6 h-6 text-green-400" />
            Select Game
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {games.map((game) => (
              <motion.button
                key={game.id}
                onClick={() => setSelectedGame(game.id)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`p-4 rounded-xl border-2 transition-all ${
                  selectedGame === game.id
                    ? 'bg-cyan-600 border-cyan-400 shadow-lg shadow-cyan-500/50'
                    : 'bg-slate-800 border-slate-700 hover:border-slate-600'
                }`}
              >
                <div className="text-4xl mb-2">{game.emoji}</div>
                <div className="text-sm font-bold">{game.name}</div>
              </motion.button>
            ))}
          </div>
        </div>

        {/* Difficulty Selection */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
            <Zap className="w-6 h-6 text-yellow-400" />
            Select Difficulty
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.entries(AI_DIFFICULTIES).map(([key, diff]) => (
              <motion.button
                key={key}
                onClick={() => setSelectedDifficulty(key)}
                whileHover={{ scale: 1.05, y: -5 }}
                whileTap={{ scale: 0.95 }}
                className={`relative overflow-hidden rounded-xl border-2 p-6 transition-all ${
                  selectedDifficulty === key
                    ? 'border-white shadow-xl'
                    : 'border-slate-700 hover:border-slate-600'
                }`}
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${diff.color} opacity-${selectedDifficulty === key ? '100' : '20'}`} />
                <div className="relative z-10">
                  <div className="text-4xl mb-2">{diff.icon}</div>
                  <div className="text-xl font-bold mb-1">{diff.name}</div>
                  <div className="text-xs text-gray-300">{diff.description}</div>
                </div>
              </motion.button>
            ))}
          </div>
        </div>

        {/* Start Button */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <Button
            onClick={startPractice}
            className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white font-bold text-xl px-12 py-6 rounded-2xl shadow-2xl"
          >
            <Bot className="w-6 h-6 mr-3" />
            Start Practice Match
          </Button>
          
          <p className="text-sm text-gray-400 mt-4">
            Playing: {games.find(g => g.id === selectedGame)?.name} • 
            Difficulty: {AI_DIFFICULTIES[selectedDifficulty].name}
          </p>
        </motion.div>

        {/* AI Features */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-slate-900/50 border-cyan-500/30 p-6">
            <Bot className="w-12 h-12 text-cyan-400 mb-4" />
            <h3 className="text-lg font-bold mb-2">Smart AI</h3>
            <p className="text-sm text-gray-400">
              Advanced algorithms that adapt to your play style
            </p>
          </Card>
          
          <Card className="bg-slate-900/50 border-green-500/30 p-6">
            <Zap className="w-12 h-12 text-green-400 mb-4" />
            <h3 className="text-lg font-bold mb-2">No Wait Time</h3>
            <p className="text-sm text-gray-400">
              Practice anytime without waiting for opponents
            </p>
          </Card>
          
          <Card className="bg-slate-900/50 border-purple-500/30 p-6">
            <Settings className="w-12 h-12 text-purple-400 mb-4" />
            <h3 className="text-lg font-bold mb-2">Customizable</h3>
            <p className="text-sm text-gray-400">
              Adjust difficulty and AI behavior to your needs
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}

// AI Move Calculator (basic implementation)
interface AIDifficultyConfig {
  thinkTime: number;
  randomness: number;
  [k: string]: any;
}

export class AIPlayer {
  difficulty: string;
  gameType: string;
  config: AIDifficultyConfig;

  constructor(difficulty: string = 'medium', gameType: string) {
    this.difficulty = difficulty;
    this.gameType = gameType;
    this.config = (AI_DIFFICULTIES as Record<string, AIDifficultyConfig>)[difficulty];
  }

  async calculateMove(gameState: any, validMoves: any[]): Promise<any> {
    // Simulate thinking time
    await new Promise(resolve => setTimeout(resolve, this.config.thinkTime));

    if (!validMoves || validMoves.length === 0) return null;

    // Add randomness based on difficulty
    if (Math.random() < this.config.randomness) {
      // Make a random move
      return validMoves[Math.floor(Math.random() * validMoves.length)];
    }

    // Calculate best move based on game type
    return this.calculateBestMove(gameState, validMoves);
  }

  calculateBestMove(gameState: any, validMoves: any[]): any {
    // Basic heuristic: prefer moves that advance pieces
    // This is a simplified version - each game would need specific logic
    
    if (validMoves.length === 1) return validMoves[0];

    // For now, return a semi-random move weighted towards better positions
    const weights = validMoves.map(move => this.evaluateMove(move, gameState));
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    
    let random = Math.random() * totalWeight;
    for (let i = 0; i < validMoves.length; i++) {
      random -= weights[i];
      if (random <= 0) return validMoves[i];
    }

    return validMoves[0];
  }

  evaluateMove(_move: any, _gameState: any): number {
    // Basic move evaluation
    // Higher difficulty = better evaluation
    const baseWeight = 1;
    const difficultyMultiplier = ({
      easy: 1,
      medium: 2,
      hard: 3,
      expert: 4
    } as Record<string, number>)[this.difficulty] || 1;

    return baseWeight * difficultyMultiplier;
  }
}
