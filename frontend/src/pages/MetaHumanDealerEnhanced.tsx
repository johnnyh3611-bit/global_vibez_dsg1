
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Play, Users, Coins, Sparkles, Crown, MessageSquare, Eye, 
  Volume2, VolumeX, Settings, ChevronRight, Trophy, Zap 
} from 'lucide-react';
import UnifiedNavigation from '../components/hub/UnifiedNavigation';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Dealer personality responses based on bet amount
const DEALER_RESPONSES = {
  welcome: [
    "Welcome to the table, high roller!",
    "Ah, fresh blood. Let's see what you've got.",
    "Take a seat. The cards await your command."
  ],
  smallBet: [
    "Playing it safe today, I see.",
    "A cautious approach. Wise... or scared?",
    "Small bets won't win big pots, friend."
  ],
  mediumBet: [
    "Now we're talking! That's the spirit.",
    "A respectable wager. Let's see if it pays off.",
    "Good energy at this table. I like it."
  ],
  bigBet: [
    "HIGH ROLLER ALERT! 🔥 Everyone, take notes!",
    "Bold move! The table is watching now.",
    "This is what I live for. BIG bets, BIG rewards!"
  ],
  playerWins: [
    "Well played! The cards favored you tonight.",
    "Congratulations! Your strategy paid off.",
    "A worthy victory. Will you press your luck?"
  ],
  playerLoses: [
    "Tough break. The cards can be cruel.",
    "Not your hand this time. Regroup and try again.",
    "Fortune favors the persistent. Another round?"
  ],
  allIn: [
    "ALL IN?! The tension is palpable!",
    "Everything on the line. I respect the courage.",
    "This is it, folks. All or nothing!"
  ]
};

// Card component
const PlayingCard = ({ card, hidden }: { card: any; hidden?: boolean }) => {
  if (hidden) {
    return (
      <div className="w-16 h-24 bg-gradient-to-br from-red-900 to-red-700 rounded-lg border-2 border-red-600 flex items-center justify-center">
        <div className="text-white text-2xl">🂠</div>
      </div>
    );
  }
  
  const isRed = card.suit === '♥' || card.suit === '♦';
  return (
    <motion.div
      initial={{ scale: 0, rotateY: 180 }}
      animate={{ scale: 1, rotateY: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 20 }}
      className={`w-16 h-24 bg-white rounded-lg border-2 ${isRed ? 'border-red-500' : 'border-gray-800'} flex flex-col items-center justify-center shadow-lg`}
    >
      <div className={`text-2xl font-bold ${isRed ? 'text-red-600' : 'text-gray-800'}`}>
        {card.value}
      </div>
      <div className={`text-3xl ${isRed ? 'text-red-600' : 'text-gray-800'}`}>
        {card.suit}
      </div>
    </motion.div>
  );
};

// Player Seat Component
const PlayerSeat = ({ position, player, isActive, onSit }: { position: string; player?: any; isActive?: boolean; onSit?: () => void }) => {
  const isEmpty = !player;
  
  return (
    <div className={`absolute ${position}`}>
      <motion.div
        whileHover={{ scale: isEmpty ? 1.05 : 1 }}
        className={`relative w-24 h-24 rounded-full border-4 ${
          isActive ? 'border-yellow-400 shadow-xl shadow-yellow-400/50' : 'border-white/30'
        } ${isEmpty ? 'cursor-pointer bg-white/10 hover:bg-white/20' : 'bg-gradient-to-br from-cyan-500 to-purple-500'} transition-all`}
        onClick={isEmpty ? onSit : undefined}
      >
        {isEmpty ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <Users className="w-8 h-8 text-white/50" />
          </div>
        ) : (
          <>
            <div className="absolute inset-0 flex items-center justify-center text-2xl">
              {player.avatar || '👤'}
            </div>
            {/* Player info tooltip */}
            <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 bg-black/90 px-2 py-1 rounded text-xs whitespace-nowrap">
              {player.name}
            </div>
            {/* Player chips */}
            <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 bg-yellow-500 px-2 py-1 rounded-full text-xs font-bold text-black">
              ${player.chips || 1000}
            </div>
          </>
        )}
      </motion.div>
      
      {/* Player cards */}
      {player && player.cards && (
        <div className="absolute -bottom-28 left-1/2 transform -translate-x-1/2 flex gap-1">
          {player.cards.map((card, idx) => (
            <PlayingCard key={`player-card-${card.rank}-${card.suit}-${idx}`} card={card} />
          ))}
        </div>
      )}
    </div>
  );
};

// Dealer Avatar Component
const DealerAvatar = ({ message, mood = 'neutral' }) => {
  const moodEmoji = {
    happy: '😊',
    excited: '🤩',
    neutral: '😎',
    concerned: '🤔',
    celebrating: '🎉'
  };
  
  return (
    <motion.div
      animate={{ y: message ? [0, -5, 0] : 0 }}
      transition={{ repeat: message ? Infinity : 0, duration: 2 }}
      className="relative"
    >
      <div className="w-32 h-32 rounded-full bg-gradient-to-br from-cyan-500 via-purple-500 to-pink-500 p-1">
        <div className="w-full h-full rounded-full bg-gray-900 flex items-center justify-center text-6xl">
          {moodEmoji[mood]}
        </div>
      </div>
      <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-gradient-to-br from-amber-500 to-yellow-500 rounded-full flex items-center justify-center shadow-lg">
        <Crown className="w-6 h-6 text-white" />
      </div>
    </motion.div>
  );
};

// Main Component
function MetaHumanDealerEnhanced() {
  const [tables, setTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState(null);
  const [balance, setBalance] = useState(10000);
  const [dealerMessage, setDealerMessage] = useState(null);
  const [dealerMood, setDealerMood] = useState('neutral');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [currentPlayer, setCurrentPlayer] = useState({ id: 'demo_user', name: 'You', avatar: '🎮', chips: 5000 });
  
  // Poker game state
  interface MetaDealerGameState {
    players: any[];
    communityCards: any[];
    pot: number;
    currentBet: number;
    phase: string;
    activePlayerIndex: number;
    deck?: any[];
  }
  const [gameState, setGameState] = useState<MetaDealerGameState>({
    players: [],
    communityCards: [],
    pot: 0,
    currentBet: 0,
    phase: 'waiting', // waiting, betting, flop, turn, river, showdown
    activePlayerIndex: 0
  });

  useEffect(() => {
    fetchTables();
  }, []);

  const fetchTables = async () => {
    try {
      const response = await fetch(`${API_URL}/api/tables/list`);
      const data = await response.json();
      setTables(data.tables || []);
    } catch (error) {
      // console.error('Failed to fetch tables:', error);
    }
  };

  const createTable = async (gameType) => {
    const configs = {
      'Poker_Holdem': {
        table_name: 'Executive Poker Table',
        game_type: 'Poker_Holdem',
        max_players: 9,
        assets: {},
        spatial_data: {}
      },
      'Bid_Whist': {
        table_name: 'Bid Whist Lounge',
        game_type: 'Bid_Whist',
        max_players: 4,
        assets: {},
        spatial_data: {}
      },
      'Baccarat': {
        table_name: 'Baccarat Salon',
        game_type: 'Baccarat',
        max_players: 14,
        assets: {},
        spatial_data: {}
      }
    };

    try {
      const response = await fetch(`${API_URL}/api/tables/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configs[gameType])
      });
      const data = await response.json();
      if (data.success) {
        fetchTables();
        showDealerMessage(
          DEALER_RESPONSES.welcome[Math.floor(Math.random() * DEALER_RESPONSES.welcome.length)],
          'happy'
        );
      }
    } catch (error) {
      // console.error('Failed to create table:', error);
    }
  };

  const joinTable = (table) => {
    setSelectedTable(table);
    // Add current player to seat 0
    setGameState(prev => ({
      ...prev,
      players: [currentPlayer, null, null, null, null, null, null, null, null]
    }));
    showDealerMessage(
      DEALER_RESPONSES.welcome[Math.floor(Math.random() * DEALER_RESPONSES.welcome.length)],
      'excited'
    );
  };

  const placeBet = async (amount) => {
    if (amount > balance) {
      showDealerMessage("Insufficient funds, friend. Top up your balance first.", 'concerned');
      return;
    }

    let response;
    if (amount >= 2000) {
      response = DEALER_RESPONSES.bigBet[Math.floor(Math.random() * DEALER_RESPONSES.bigBet.length)];
      setDealerMood('excited');
    } else if (amount >= 500) {
      response = DEALER_RESPONSES.mediumBet[Math.floor(Math.random() * DEALER_RESPONSES.mediumBet.length)];
      setDealerMood('happy');
    } else {
      response = DEALER_RESPONSES.smallBet[Math.floor(Math.random() * DEALER_RESPONSES.smallBet.length)];
      setDealerMood('neutral');
    }

    setBalance(prev => prev - amount);
    setGameState(prev => ({ ...prev, pot: prev.pot + amount }));
    showDealerMessage(response, dealerMood);
    
    // Play sound effect
    if (soundEnabled) {
      playSound('chip');
    }
  };

  const dealCards = () => {
    // Deal 2 cards to each player
    const deck = generateDeck();
    const newPlayers = gameState.players.map((player, idx) => {
      if (!player) return null;
      return {
        ...player,
        cards: [deck.pop(), deck.pop()]
      };
    });
    
    setGameState(prev => ({
      ...prev,
      players: newPlayers,
      phase: 'betting',
      deck
    }));
    
    showDealerMessage("Cards are dealt. Let the game begin!", 'excited');
    if (soundEnabled) playSound('deal');
  };

  const dealFlop = () => {
    const { deck } = gameState;
    const flop = [deck.pop(), deck.pop(), deck.pop()];
    setGameState(prev => ({
      ...prev,
      communityCards: flop,
      phase: 'flop'
    }));
    showDealerMessage("The flop is revealed!", 'neutral');
    if (soundEnabled) playSound('deal');
  };

  const generateDeck = () => {
    const suits = ['♠', '♥', '♦', '♣'];
    const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    const deck = [];
    for (const suit of suits) {
      for (const value of values) {
        deck.push({ suit, value });
      }
    }
    // Shuffle
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
  };

  const showDealerMessage = (message, mood = 'neutral') => {
    setDealerMessage(message);
    setDealerMood(mood);
    setTimeout(() => setDealerMessage(null), 4000);
  };

  const playSound = (type) => {
    // Sound effect placeholder (would use Audio API in production)

  };

  const sendChatMessage = () => {
    if (!chatInput.trim()) return;
    setChatMessages(prev => [...prev, {
      player: currentPlayer.name,
      message: chatInput,
      timestamp: new Date()
    }]);
    setChatInput('');
  };

  // Render table selection screen
  if (!selectedTable) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-indigo-900 via-black to-cyan-900 text-white">
        <UnifiedNavigation />
        <div className="pt-20 p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 bg-purple-500/20 border border-purple-500/30 px-4 py-2 rounded-full mb-4"
            >
              <Sparkles size={16} className="text-purple-400" />
              <span className="text-purple-400 text-sm font-bold">METAHUMAN DEALER SYSTEM</span>
            </motion.div>
            
            <h1 className="text-6xl font-black mb-4">
              MetaHuman Dealer <span className="bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">Tables</span>
            </h1>
            
            <p className="text-white/70 text-lg max-w-2xl mx-auto mb-8">
              Experience next-generation AI dealers with real-time spatial awareness and immersive gameplay
            </p>

            <div className="inline-flex items-center gap-2 bg-yellow-500/20 border border-yellow-500/30 px-6 py-3 rounded-xl">
              <Coins size={20} className="text-yellow-400" />
              <span className="text-yellow-400 font-bold text-xl">{balance.toLocaleString()}</span>
              <span className="text-yellow-400/60 text-sm">GV Coins</span>
            </div>
          </div>

          {/* Create New Table */}
          <div className="grid md:grid-cols-3 gap-6 mb-12">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => createTable('Poker_Holdem')}
              className="bg-gradient-to-br from-green-600 to-emerald-600 p-6 rounded-2xl border-2 border-green-400/50 hover:border-green-400 transition-all"
            >
              <div className="text-4xl mb-3">🃏</div>
              <h3 className="text-xl font-bold mb-2">Create Poker Table</h3>
              <p className="text-sm text-white/70">Texas Hold'em • Up to 9 players</p>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => createTable('Bid_Whist')}
              className="bg-gradient-to-br from-purple-600 to-violet-600 p-6 rounded-2xl border-2 border-purple-400/50 hover:border-purple-400 transition-all"
            >
              <div className="text-4xl mb-3">🎴</div>
              <h3 className="text-xl font-bold mb-2">Create Bid Whist</h3>
              <p className="text-sm text-white/70">Classic Partnership • 4 players</p>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => createTable('Baccarat')}
              className="bg-gradient-to-br from-cyan-600 to-blue-600 p-6 rounded-2xl border-2 border-cyan-400/50 hover:border-cyan-400 transition-all"
            >
              <div className="text-4xl mb-3">💎</div>
              <h3 className="text-xl font-bold mb-2">Create Baccarat</h3>
              <p className="text-sm text-white/70">High Stakes • Up to 14 players</p>
            </motion.button>
          </div>

          {/* Active Tables */}
          <div>
            <h2 className="text-3xl font-bold mb-6 flex items-center gap-2">
              <Users className="text-purple-400" />
              Active Tables ({tables.length})
            </h2>
            
            {tables.length === 0 ? (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-12 text-center">
                <p className="text-white/50 text-lg">No active tables. Create one to get started!</p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {tables.map(table => (
                  <motion.div
                    key={table.table_id}
                    whileHover={{ scale: 1.02 }}
                    className="bg-white/5 border border-white/20 rounded-2xl p-6 cursor-pointer hover:border-purple-400/50 transition-all"
                    onClick={() => joinTable(table)}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-xl font-bold">{table.game_type.replace('_', ' ')}</h3>
                      <span className="bg-yellow-500 text-black text-xs font-bold px-3 py-1 rounded-full">
                        {table.status}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm text-white/70">
                      <span>Players: {table.current_players || 0}/{table.max_players}</span>
                      <ChevronRight className="text-purple-400" />
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>
        </div>
      </div>
    );
  }

  // Render active game table
  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-900 via-black to-cyan-900 text-white">
      <UnifiedNavigation />
      <div className="pt-20 p-4">
      <div className="max-w-7xl mx-auto">
        
        {/* Top Bar */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => setSelectedTable(null)}
            className="flex items-center gap-2 bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg transition-all"
          >
            ← Back to Lobby
          </button>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-yellow-500/20 border border-yellow-500/30 px-4 py-2 rounded-lg">
              <Coins className="text-yellow-400" size={20} />
              <span className="text-yellow-400 font-bold">₵{balance.toLocaleString()}</span>
            </div>
            
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="bg-white/10 hover:bg-white/20 p-2 rounded-lg transition-all"
            >
              {soundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
            </button>
          </div>
        </div>

        <div className="grid lg:grid-cols-4 gap-6">
          
          {/* Main Table Area */}
          <div className="lg:col-span-3">
            {/* Dealer */}
            <div className="flex justify-center mb-8">
              <div className="text-center">
                <DealerAvatar message={dealerMessage} mood={dealerMood} />
                <AnimatePresence>
                  {dealerMessage && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="mt-4 bg-purple-500/90 backdrop-blur-xl border-2 border-cyan-400/50 px-6 py-3 rounded-2xl max-w-md shadow-2xl"
                    >
                      <p className="text-lg font-medium italic">"{dealerMessage}"</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Poker Table */}
            <div className="relative bg-gradient-to-br from-green-800 to-green-900 rounded-full aspect-[2/1] border-8 border-amber-700 shadow-2xl p-8">
              
              {/* Pot */}
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
                <div className="bg-black/50 backdrop-blur-sm px-6 py-3 rounded-xl border-2 border-yellow-400/50">
                  <div className="text-sm text-yellow-400/70 mb-1">POT</div>
                  <div className="text-3xl font-black text-yellow-400">₵{(gameState.pot || 0).toLocaleString()}</div>
                </div>
                
                {/* Community Cards */}
                {gameState.communityCards.length > 0 && (
                  <div className="flex gap-2 justify-center mt-6">
                    {gameState.communityCards.map((card, idx) => (
                      <PlayingCard key={`community-${card.rank}-${card.suit}-${idx}`} card={card} />
                    ))}
                  </div>
                )}
              </div>

              {/* Player Seats */}
              <PlayerSeat position="bottom-4 left-1/2 transform -translate-x-1/2" player={gameState.players[0]} isActive={gameState.activePlayerIndex === 0} />
              <PlayerSeat position="bottom-1/3 left-12" player={gameState.players[1]} isActive={gameState.activePlayerIndex === 1} />
              <PlayerSeat position="top-1/3 left-8" player={gameState.players[2]} isActive={gameState.activePlayerIndex === 2} />
              <PlayerSeat position="top-4 left-1/4" player={gameState.players[3]} isActive={gameState.activePlayerIndex === 3} />
              <PlayerSeat position="top-4 right-1/4" player={gameState.players[4]} isActive={gameState.activePlayerIndex === 4} />
              <PlayerSeat position="top-1/3 right-8" player={gameState.players[5]} isActive={gameState.activePlayerIndex === 5} />
              <PlayerSeat position="bottom-1/3 right-12" player={gameState.players[6]} isActive={gameState.activePlayerIndex === 6} />
            </div>

            {/* Game Controls */}
            <div className="mt-8 flex items-center justify-center gap-4">
              {gameState.phase === 'waiting' && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={dealCards}
                  className="bg-gradient-to-r from-green-500 to-emerald-500 px-8 py-4 rounded-xl font-bold text-lg flex items-center gap-2 shadow-lg hover:shadow-green-500/50 transition-all"
                >
                  <Play size={24} />
                  Deal Cards
                </motion.button>
              )}
              
              {gameState.phase === 'betting' && (
                <>
                  <button onClick={() => placeBet(100)} className="bg-cyan-600 hover:bg-cyan-500 px-6 py-3 rounded-lg font-bold transition-all">
                    Bet $100
                  </button>
                  <button onClick={() => placeBet(500)} className="bg-purple-600 hover:bg-purple-500 px-6 py-3 rounded-lg font-bold transition-all">
                    Bet $500
                  </button>
                  <button onClick={() => placeBet(2000)} className="bg-amber-600 hover:bg-amber-500 px-6 py-3 rounded-lg font-bold transition-all">
                    Bet $2000
                  </button>
                  <button onClick={dealFlop} className="bg-green-600 hover:bg-green-500 px-6 py-3 rounded-lg font-bold transition-all">
                    Next →
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Side Panel - Chat */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/20 rounded-2xl p-4 h-fit">
            <div className="flex items-center gap-2 mb-4">
              <MessageSquare className="text-cyan-400" />
              <h3 className="font-bold">Table Chat</h3>
            </div>
            
            <div className="space-y-3 mb-4 max-h-96 overflow-y-auto">
              {chatMessages.map((msg, idx) => (
                <div key={`chat-${msg.timestamp || Date.now()}-${idx}`} className="bg-white/5 p-3 rounded-lg">
                  <div className="text-xs text-cyan-400 font-bold mb-1">{msg.player}</div>
                  <div className="text-sm">{msg.message}</div>
                </div>
              ))}
              {chatMessages.length === 0 && (
                <div className="text-white/30 text-sm text-center py-8">
                  No messages yet. Say hello!
                </div>
              )}
            </div>
            
            <div className="flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendChatMessage()}
                placeholder="Type a message..."
                className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-400"
              />
              <button
                onClick={sendChatMessage}
                className="bg-cyan-600 hover:bg-cyan-500 px-4 py-2 rounded-lg transition-all"
              >
                Send
              </button>
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}

export default MetaHumanDealerEnhanced;
