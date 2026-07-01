
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, Play, Shuffle, DollarSign, Gift, Clock, 
  Volume2, VolumeX, Mic, MicOff, Zap, Users, Trophy,
  RotateCcw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import CardPhysicsEngine from '@/components/casino/CardPhysicsEngine';
import dealerVoice, { DealerCallouts } from '@/utils/dealerVoice';
import casinoSounds from '@/utils/casinoSoundManager';

export default function ProfessionalDealerShowcase() {
  const navigate = useNavigate();
  const canvasRef = useRef(null);
  const [selectedGame, setSelectedGame] = useState('blackjack');
  const [dealerMessage, setDealerMessage] = useState('Welcome to the table.');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [isDealing, setIsDealing] = useState(false);

  useEffect(() => {
    casinoSounds.setEnabled(soundEnabled);
  }, [soundEnabled]);

  useEffect(() => {
    dealerVoice.setEnabled(voiceEnabled);
  }, [voiceEnabled]);

  const games = [
    { 
      id: 'blackjack', 
      name: 'Blackjack', 
      icon: '🃏',
      description: 'Professional 21 dealing',
      pattern: '1 Up, 1 Down, 1 Up, 1 Up'
    },
    { 
      id: 'poker', 
      name: "Texas Hold'em", 
      icon: '♠️',
      description: 'Tournament poker',
      pattern: '2 Down per player, Burn, Flop'
    },
    { 
      id: 'spades', 
      name: 'Spades', 
      icon: '♠',
      description: 'Classic card game',
      pattern: '13 cards to everyone'
    }
  ];

  const scenarios = [
    {
      id: 'start',
      label: 'Start Hand',
      icon: <Play className="w-4 h-4" />,
      message: DealerCallouts.STARTING_HAND,
      action: () => {
        dealCards('start');
        casinoSounds.playCardShuffle();
      }
    },
    {
      id: 'shuffle',
      label: 'Shuffle Deck',
      icon: <Shuffle className="w-4 h-4" />,
      message: DealerCallouts.SHUFFLING,
      action: () => {
        casinoSounds.playCardShuffle();
      }
    },
    {
      id: 'bet',
      label: 'Player Bets',
      icon: <DollarSign className="w-4 h-4" />,
      message: DealerCallouts.PLAYER_BET('Player 1', '$50'),
      action: () => {
        casinoSounds.playChipPlace();
      }
    },
    {
      id: 'high_stakes',
      label: 'High Stakes',
      icon: <Trophy className="w-4 h-4" />,
      message: DealerCallouts.HIGH_STAKES_BET,
      action: () => {
        casinoSounds.playChipStack();
      }
    },
    {
      id: 'tip',
      label: 'Tip Dealer',
      icon: <Gift className="w-4 h-4" />,
      message: DealerCallouts.LARGE_TIP,
      action: () => {
        casinoSounds.playChipPlace();
      }
    },
    {
      id: 'stall',
      label: 'Player Stalls',
      icon: <Clock className="w-4 h-4" />,
      message: DealerCallouts.PLAYER_STALLING,
      action: () => {}
    },
    {
      id: 'win',
      label: 'Player Wins',
      icon: <Zap className="w-4 h-4" />,
      message: selectedGame === 'blackjack' ? DealerCallouts.BJ_PLAYER_BLACKJACK : DealerCallouts.NICE_HAND,
      action: () => {
        casinoSounds.playWinSound();
      }
    },
    {
      id: 'new_player',
      label: 'New Player',
      icon: <Users className="w-4 h-4" />,
      message: DealerCallouts.NEW_PLAYER,
      action: () => {}
    }
  ];

  const triggerScenario = (scenario) => {
    setDealerMessage(scenario.message);
    if (voiceEnabled) {
      dealerVoice.speak(scenario.message);
    }
    if (scenario.action) {
      scenario.action();
    }
  };

  const dealCards = (type = 'single') => {
    if (!canvasRef.current) return;
    
    setIsDealing(true);
    
    if (type === 'start') {
      // Deal to multiple positions
      const positions = [
        { x: 200, y: 400 }, // Player 1
        { x: 400, y: 450 }, // Player 2
        { x: 600, y: 400 }, // Player 3
      ];

      positions.forEach((pos, i) => {
        setTimeout(() => {
          canvasRef.current.pitchCard(pos.x, pos.y);
          casinoSounds.playCardDeal();
        }, i * 300);
      });

      setTimeout(() => setIsDealing(false), positions.length * 300 + 1000);
    } else {
      canvasRef.current.pitchCard();
      casinoSounds.playCardDeal();
      setTimeout(() => setIsDealing(false), 1000);
    }
  };

  const clearTable = () => {
    if (canvasRef.current && canvasRef.current.clearCards) {
      canvasRef.current.clearCards();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate('/games')}
            className="text-white hover:bg-white/10"
          >
            <ArrowLeft className="mr-2 h-5 w-5" />
            Back to Games
          </Button>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`border-slate-700 ${soundEnabled ? 'text-cyan-400' : 'text-gray-500'}`}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setVoiceEnabled(!voiceEnabled)}
              className={`border-slate-700 ${voiceEnabled ? 'text-cyan-400' : 'text-gray-500'}`}
            >
              {voiceEnabled ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="text-5xl font-black text-white mb-4">
            <span className="bg-gradient-to-r from-yellow-400 via-orange-400 to-red-400 bg-clip-text text-transparent">
              Professional Dealer
            </span>
            <br />
            <span className="text-3xl bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
              Showcase
            </span>
          </h1>
          <p className="text-gray-300 text-lg">
            Experience AAA casino dealer mechanics with realistic physics, voice synthesis & sound effects
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Canvas */}
          <div className="lg:col-span-2">
            <Card className="bg-slate-800/50 border-slate-700 p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">Card Physics Table</h2>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearTable}
                  className="border-slate-700 text-white"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Clear Table
                </Button>
              </div>
              
              <div className="mb-4 p-4 bg-slate-900/50 rounded-lg border border-cyan-500/30">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center">
                    <span className="text-2xl">🎰</span>
                  </div>
                  <div className="flex-1">
                    <div className="text-sm text-cyan-400 font-semibold mb-1">DEALER SAYS:</div>
                    <div className="text-white font-medium">{dealerMessage}</div>
                  </div>
                </div>
              </div>

              <CardPhysicsEngine
                {...({ ref: canvasRef } as any)}
                width={800}
                height={500}
                dealerPosition={{ x: 400, y: 80 }}
                onCardLanded={(card: any) => {
                }}
              />

              <div className="mt-4 text-sm text-gray-400 text-center">
                💡 Click anywhere on the table to pitch a card • Dealer uses realistic spin physics
              </div>
            </Card>
          </div>

          {/* Controls Sidebar */}
          <div className="space-y-6">
            {/* Game Selector */}
            <Card className="bg-slate-800/50 border-slate-700 p-6">
              <h3 className="text-lg font-bold text-white mb-4">Select Game</h3>
              <div className="space-y-2">
                {games.map((game) => (
                  <button
                    key={game.id}
                    onClick={() => setSelectedGame(game.id)}
                    className={`w-full p-3 rounded-lg border-2 transition-all text-left ${
                      selectedGame === game.id
                        ? 'border-yellow-400 bg-yellow-900/20'
                        : 'border-slate-700 hover:border-slate-600 bg-slate-900/30'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{game.icon}</span>
                      <div className="flex-1">
                        <div className="text-white font-semibold">{game.name}</div>
                        <div className="text-xs text-gray-400">{game.pattern}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </Card>

            {/* Scenario Triggers */}
            <Card className="bg-slate-800/50 border-slate-700 p-6">
              <h3 className="text-lg font-bold text-white mb-4">Dealer Scenarios</h3>
              <div className="grid grid-cols-2 gap-2">
                {scenarios.map((scenario) => (
                  <Button
                    key={scenario.id}
                    variant="outline"
                    size="sm"
                    onClick={() => triggerScenario(scenario)}
                    disabled={isDealing}
                    className="border-slate-700 text-white hover:bg-cyan-900/30 hover:border-cyan-500"
                  >
                    {scenario.icon}
                    <span className="ml-2 text-xs">{scenario.label}</span>
                  </Button>
                ))}
              </div>
            </Card>

            {/* Info */}
            <Card className="bg-gradient-to-br from-cyan-900/20 to-blue-900/20 border-cyan-700/50 p-6">
              <h3 className="text-lg font-bold text-cyan-400 mb-3">Features</h3>
              <ul className="space-y-2 text-sm text-gray-300">
                <li className="flex items-start gap-2">
                  <span className="text-cyan-400">✓</span>
                  <span>Realistic card physics with pitch & spin</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-cyan-400">✓</span>
                  <span>Professional dealer voice synthesis</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-cyan-400">✓</span>
                  <span>Casino sound effects (cards, chips)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-cyan-400">✓</span>
                  <span>Context-aware dealer callouts</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-cyan-400">✓</span>
                  <span>Game-specific dealing patterns</span>
                </li>
              </ul>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
