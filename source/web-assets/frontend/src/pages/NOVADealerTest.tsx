import React, { useState } from 'react';
import HumanHolographicDealerV2, { getDealerReaction } from '../components/casino/HumanHolographicDealerV2';
import BackButton from '../components/BackButton';

/**
 * NOVA Dealer V2 - Standalone Test Page
 * Test all the AAA+ features before integrating into Blackjack
 */
export default function NOVADealerTest() {
  const [dealerType, setDealerType] = useState('nova');
  const [phrase, setPhrase] = useState('Welcome to the table');
  const [isDealing, setIsDealing] = useState(false);
  const [isShuffling, setIsShuffling] = useState(false);
  const [isCelebrating, setIsCelebrating] = useState(false);
  const [currentBet, setCurrentBet] = useState(0);
  const [gameState, setGameState] = useState('IDLE');

  // Test dealer reactions
  const testReaction = (state, outcome = null) => {
    const reaction = getDealerReaction(state, outcome);
    setPhrase(reaction.phrase);
    setGameState(state);
    
    if (reaction.animation === 'celebrating') {
      setIsCelebrating(true);
      setTimeout(() => setIsCelebrating(false), 2000);
    }
  };

  // Simulate bet placement
  const placeBet = (amount) => {
    setCurrentBet(amount);
    setPhrase(`Bet confirmed: ${amount} credits.`);
    setTimeout(() => {
      setPhrase("Good luck!");
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
      <BackButton />
      
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-4xl font-black text-white mb-2">🎭 NOVA DEALER V2 TEST</h1>
        <p className="text-slate-400">AAA+ Meta-Human with Diegetic UI & Physics</p>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Panel - Controls */}
        <div className="lg:col-span-1 space-y-4">
          
          {/* Dealer Selection */}
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6">
            <h3 className="text-white font-bold mb-4 flex items-center gap-2">
              <span>👤</span> Select Dealer
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {['nova', 'ace', 'ruby', 'jade'].map(dealer => (
                <button
                  key={dealer}
                  onClick={() => {
                    setDealerType(dealer);
                    setPhrase(`${dealer.toUpperCase()} reporting for duty`);
                  }}
                  className={`px-4 py-2 rounded-lg font-bold uppercase text-sm transition-all ${
                    dealerType === dealer
                      ? 'bg-cyan-500 text-black'
                      : 'bg-slate-700 text-white hover:bg-slate-600'
                  }`}
                >
                  {dealer}
                </button>
              ))}
            </div>
          </div>

          {/* Animation Controls */}
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6">
            <h3 className="text-white font-bold mb-4 flex items-center gap-2">
              <span>🎬</span> Test Animations
            </h3>
            <div className="space-y-2">
              <button
                onClick={() => {
                  setIsDealing(!isDealing);
                  if (!isDealing) setPhrase("Dealing cards...");
                }}
                className={`w-full px-4 py-3 rounded-lg font-bold transition-all ${
                  isDealing
                    ? 'bg-red-500 text-white'
                    : 'bg-green-500 text-black hover:bg-green-400'
                }`}
              >
                {isDealing ? '⏹️ Stop Dealing' : '🃏 Start Dealing'}
              </button>
              
              <button
                onClick={() => {
                  setIsShuffling(!isShuffling);
                  if (!isShuffling) setPhrase("Shuffling the deck...");
                }}
                className={`w-full px-4 py-3 rounded-lg font-bold transition-all ${
                  isShuffling
                    ? 'bg-red-500 text-white'
                    : 'bg-purple-500 text-white hover:bg-purple-400'
                }`}
              >
                {isShuffling ? '⏹️ Stop Shuffling' : '🎴 Start Shuffling'}
              </button>
              
              <button
                onClick={() => {
                  setIsCelebrating(true);
                  setPhrase("🎉 Celebrating!");
                  setTimeout(() => setIsCelebrating(false), 2000);
                }}
                className="w-full px-4 py-3 rounded-lg font-bold bg-yellow-500 text-black hover:bg-yellow-400 transition-all"
              >
                🎉 Test Celebration
              </button>
            </div>
          </div>

          {/* Game State Reactions */}
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6">
            <h3 className="text-white font-bold mb-4 flex items-center gap-2">
              <span>🎮</span> Test Game States
            </h3>
            <div className="space-y-2">
              <button
                onClick={() => testReaction('PLACING_BETS')}
                className="w-full px-4 py-2 rounded-lg bg-cyan-500/20 border border-cyan-500 text-cyan-400 hover:bg-cyan-500/30 transition-all text-sm"
              >
                "Place Your Bets"
              </button>
              
              <button
                onClick={() => testReaction('PLAYER_WIN')}
                className="w-full px-4 py-2 rounded-lg bg-green-500/20 border border-green-500 text-green-400 hover:bg-green-500/30 transition-all text-sm"
              >
                "You Win!"
              </button>
              
              <button
                onClick={() => testReaction('DEALER_WIN', 'BIG_LOSS')}
                className="w-full px-4 py-2 rounded-lg bg-red-500/20 border border-red-500 text-red-400 hover:bg-red-500/30 transition-all text-sm"
              >
                "Big Loss"
              </button>
              
              <button
                onClick={() => {
                  setPhrase("Ready for the next round?");
                  setGameState('IDLE');
                }}
                className="w-full px-4 py-2 rounded-lg bg-slate-600 text-white hover:bg-slate-500 transition-all text-sm"
              >
                Reset to Idle
              </button>
            </div>
          </div>

          {/* Bet Simulation */}
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6">
            <h3 className="text-white font-bold mb-4 flex items-center gap-2">
              <span>💰</span> Simulate Bets
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {[25, 50, 100, 500].map(amount => (
                <button
                  key={amount}
                  onClick={() => placeBet(amount)}
                  className="px-4 py-2 rounded-lg bg-yellow-500/20 border border-yellow-500 text-yellow-400 hover:bg-yellow-500/30 transition-all font-bold"
                >
                  ₵{amount}
                </button>
              ))}
            </div>
            <div className="mt-3 text-center">
              <p className="text-slate-400 text-sm">Current Bet:</p>
              <p className="text-white text-2xl font-black">₵{currentBet.toLocaleString()}</p>
            </div>
          </div>

          {/* Custom Phrase */}
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6">
            <h3 className="text-white font-bold mb-4 flex items-center gap-2">
              <span>💬</span> Custom Phrase
            </h3>
            <input
              type="text"
              value={phrase}
              onChange={(e) => setPhrase(e.target.value)}
              className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:border-cyan-400 focus:outline-none"
              placeholder="Type a custom phrase..."
            />
          </div>
        </div>

        {/* Right Panel - NOVA Display */}
        <div className="lg:col-span-2">
          <div className="bg-gradient-to-br from-green-900 via-green-950 to-black rounded-3xl border-4 border-amber-900/50 p-8 min-h-[600px] shadow-2xl relative overflow-hidden">
            
            {/* Table felt texture */}
            <div className="absolute inset-0 opacity-20" style={{
              backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.1) 2px, rgba(0,0,0,0.1) 4px), repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(0,0,0,0.1) 2px, rgba(0,0,0,0.1) 4px)`
            }} />
            
            {/* Info Panel */}
            <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md border border-cyan-400/30 rounded-lg p-4 z-40">
              <p className="text-cyan-400 text-xs font-mono mb-1">CURRENT STATE</p>
              <p className="text-white font-bold">{gameState}</p>
              <p className="text-slate-400 text-xs mt-2">
                Dealing: {isDealing ? '✅' : '❌'} | 
                Shuffling: {isShuffling ? '✅' : '❌'} | 
                Celebrating: {isCelebrating ? '✅' : '❌'}
              </p>
            </div>

            {/* NOVA Dealer */}
            <div className="relative z-10">
              <HumanHolographicDealerV2
                dealerType={dealerType}
                phrase={phrase}
                isDealing={isDealing}
                isShuffling={isShuffling}
                isCelebrating={isCelebrating}
                tableHeight={200}
              />
            </div>

            {/* Layer Legend */}
            <div className="absolute bottom-4 right-4 bg-black/60 backdrop-blur-md border border-slate-600 rounded-lg p-3 text-xs">
              <p className="text-slate-400 font-mono mb-2">Z-INDEX LAYERS:</p>
              <div className="space-y-1">
                <p className="text-slate-500">0: Background</p>
                <p className="text-cyan-400">10: Dealer (z-20)</p>
                <p className="text-white">30: Cards (z-30)</p>
              </div>
            </div>
          </div>

          {/* Feature List */}
          <div className="mt-6 grid grid-cols-2 gap-4">
            <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-4">
              <h4 className="text-white font-bold mb-2 text-sm">✨ New Features</h4>
              <ul className="text-slate-400 text-xs space-y-1">
                <li>✅ Physics-based card dealing</li>
                <li>✅ 3D perspective tilt (10deg)</li>
                <li>✅ Table reflection on vest</li>
                <li>✅ Diegetic AI_COMMS_V2 UI</li>
                <li>✅ Nod animation on bet</li>
              </ul>
            </div>
            
            <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-4">
              <h4 className="text-white font-bold mb-2 text-sm">🎯 Optimizations</h4>
              <ul className="text-slate-400 text-xs space-y-1">
                <li>✅ useMemo for dealer configs</li>
                <li>✅ Smooth arc trajectories</li>
                <li>✅ Table anchor glow</li>
                <li>✅ Game state reactions</li>
                <li>✅ Color-coded feedback</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
