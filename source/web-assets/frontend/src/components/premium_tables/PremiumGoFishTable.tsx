import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TopDownGameTable } from './TopDownGameTable';
import { ViewToggle } from './ViewToggle';
import { getRandomAvatar } from './avatarSystem';
import { useUserAvatar, UserAvatarManager } from './UserAvatarManager';

export function PremiumGoFishTable({ onBack }: { onBack?: any; theme?: any }) {
  const [view, setView] = useState('2d'); // '3d' or '2d'
  const [playerHand, setPlayerHand] = useState([]);
  const [opponentCardCount, setOpponentCardCount] = useState(7);
  const [playerBooks, setPlayerBooks] = useState([]);
  const [opponentBooks, setOpponentBooks] = useState([]);
  const [selectedCard, setSelectedCard] = useState(null);
  const [message, setMessage] = useState("Ask your opponent for a card!");
  const [playerTurn, setPlayerTurn] = useState(true);
  const [gameOver, setGameOver] = useState(false);
  const [aiThinking, setAiThinking] = useState(false);
  
  // Player avatars
  const userAvatar = useUserAvatar(); // Get from localStorage
  const [opponentAvatars] = useState(() => [
    getRandomAvatar(),
    getRandomAvatar(),
    getRandomAvatar(),
  ]);

  // Card ranks for Go Fish
  const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const suits = ['♥️', '♦️', '♣️', '♠️'];

  // Initialize game
  useEffect(() => {
    startNewGame();
  }, []);

  const startNewGame = () => {
    // Deal 7 cards to player
    const newHand = [];
    for (let i = 0; i < 7; i++) {
      const rank = ranks[Math.floor(Math.random() * ranks.length)];
      const suit = suits[Math.floor(Math.random() * suits.length)];
      newHand.push({ rank, suit, id: `${rank}-${suit}-${Date.now()}-${i}` });
    }
    setPlayerHand(newHand);
    setOpponentCardCount(7);
    setPlayerBooks([]);
    setOpponentBooks([]);
    setPlayerTurn(true);
    setGameOver(false);
    setMessage("Ask your opponent for a card!");
  };

  const checkForBooks = (hand, isPlayer) => {
    const rankCounts = {};
    hand.forEach(card => {
      rankCounts[card.rank] = (rankCounts[card.rank] || 0) + 1;
    });

    const newBooks = [];
    const remainingCards = [...hand];

    Object.entries(rankCounts).forEach(([rank, count]) => {
      if (count === 4) {
        newBooks.push(rank);
        // Remove all 4 cards of this rank
        for (let i = remainingCards.length - 1; i >= 0; i--) {
          if (remainingCards[i].rank === rank) {
            remainingCards.splice(i, 1);
          }
        }
      }
    });

    if (newBooks.length > 0) {
      if (isPlayer) {
        setPlayerBooks(prev => [...prev, ...newBooks]);
        setPlayerHand(remainingCards);
        setMessage(`You completed a book of ${newBooks.join(', ')}s! 🎉`);
      } else {
        setOpponentBooks(prev => [...prev, ...newBooks]);
        setOpponentCardCount(remainingCards.length);
        setMessage(`Opponent completed a book! 😮`);
      }
    }

    return remainingCards;
  };

  const handleCardAsk = (askedRank) => {
    if (!playerTurn || aiThinking) return;

    setSelectedCard(null);
    
    // Check if opponent has the card
    const hasCard = Math.random() > 0.5; // Simulate opponent's hand

    if (hasCard) {
      // Add card to player's hand
      const suit = suits[Math.floor(Math.random() * suits.length)];
      const newCard = { rank: askedRank, suit, id: `${askedRank}-${suit}-${Date.now()}` };
      const newHand = [...playerHand, newCard];
      setPlayerHand(newHand);
      setOpponentCardCount(prev => Math.max(0, prev - 1));
      setMessage(`You got a ${askedRank}! Ask again!`);
      
      // Check for books
      setTimeout(() => checkForBooks(newHand, true), 500);
    } else {
      // Go Fish!
      setMessage("GO FISH! 🐟");
      goFish(true);
    }
  };

  const goFish = (isPlayer) => {
    if (isPlayer) {
      // Player draws a card
      const rank = ranks[Math.floor(Math.random() * ranks.length)];
      const suit = suits[Math.floor(Math.random() * suits.length)];
      const newCard = { rank, suit, id: `${rank}-${suit}-${Date.now()}` };
      const newHand = [...playerHand, newCard];
      setPlayerHand(newHand);
      
      setTimeout(() => {
        checkForBooks(newHand, true);
        setPlayerTurn(false);
        setTimeout(() => opponentTurn(), 1000);
      }, 1000);
    } else {
      // Opponent draws
      setOpponentCardCount(prev => prev + 1);
      setPlayerTurn(true);
      setMessage("Your turn! Ask for a card.");
    }
  };

  const opponentTurn = () => {
    setAiThinking(true);
    setMessage("Opponent is thinking...");

    setTimeout(() => {
      const askedRank = ranks[Math.floor(Math.random() * ranks.length)];
      const playerHasCard = playerHand.some(card => card.rank === askedRank);

      if (playerHasCard) {
        // Remove card from player's hand
        const newHand = playerHand.filter(card => card.rank !== askedRank);
        setPlayerHand(newHand);
        setOpponentCardCount(prev => prev + 1);
        setMessage(`Opponent asked for ${askedRank} and got it!`);
        
        setTimeout(() => {
          checkForBooks([], false);
          opponentTurn(); // Opponent goes again
        }, 1000);
      } else {
        setMessage(`Opponent asked for ${askedRank}. GO FISH! 🐟`);
        goFish(false);
      }
      
      setAiThinking(false);
    }, 2000);
  };

  // Check win condition
  useEffect(() => {
    const totalBooks = playerBooks.length + opponentBooks.length;
    if (totalBooks === 13) {
      setGameOver(true);
      if (playerBooks.length > opponentBooks.length) {
        setMessage("🎉 YOU WIN! 🎉");
      } else if (opponentBooks.length > playerBooks.length) {
        setMessage("😔 Opponent Wins!");
      } else {
        setMessage("It's a TIE! 🤝");
      }
    }
  }, [playerBooks, opponentBooks]);

  // Prepare data for 2D view
  const opponentPositions = [
    { 
      position: 'top', 
      cardCount: Math.floor(opponentCardCount / 3), 
      name: opponentAvatars[0].name,
      avatar: opponentAvatars[0]
    },
    { 
      position: 'left', 
      cardCount: Math.floor(opponentCardCount / 3), 
      name: opponentAvatars[1].name,
      avatar: opponentAvatars[1]
    },
    { 
      position: 'right', 
      cardCount: Math.ceil(opponentCardCount / 3), 
      name: opponentAvatars[2].name,
      avatar: opponentAvatars[2]
    },
  ];

  const centerCards = [
    { rank: 'Ask', suit: '🐟', rotation: 5 },
  ];

  const scoreInfo = {
    blue: playerBooks.length,
    red: opponentBooks.length,
    text: `Books: You ${playerBooks.length} - Opp ${opponentBooks.length}`,
  };

  // 2D Top-Down View
  if (view === '2d') {
    return (
      <div className="relative w-full h-screen">
        <ViewToggle view={view} onToggle={setView} />
        <UserAvatarManager />
        
        <TopDownGameTable
          playerHand={playerHand}
          playerAvatar={userAvatar}
          playerName={userAvatar?.name || 'You'}
          opponentPositions={opponentPositions}
          centerCards={centerCards}
          scoreInfo={scoreInfo}
          onCardClick={(card, index) => {
            if (playerTurn && !aiThinking && !gameOver) {
              setSelectedCard(card.rank);
              setTimeout(() => handleCardAsk(card.rank), 300);
            }
          }}
        >
          {/* Message Overlay */}
          <div className="absolute top-1/3 left-1/2 transform -translate-x-1/2 z-20">
            <motion.div
              key={message}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-fuchsia-600 px-8 py-4 rounded-2xl border-2 border-white shadow-2xl"
            >
              <p className="text-2xl font-black text-white text-center">{message}</p>
            </motion.div>
          </div>

          {/* Game Over Overlay */}
          <AnimatePresence>
            {gameOver && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center"
              >
                <div className="text-center">
                  <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', stiffness: 150 }}
                  >
                    <p className="text-9xl mb-4">{playerBooks.length > opponentBooks.length ? '🏆' : '😔'}</p>
                    <h3 className="text-6xl font-black mb-4 text-transparent bg-gradient-to-r from-fuchsia-500 to-purple-500 bg-clip-text">
                      {message}
                    </h3>
                    <p className="text-2xl text-white mb-2">Final Score:</p>
                    <p className="text-xl text-white">You: {playerBooks.length} | Opponent: {opponentBooks.length}</p>
                    
                    <button
                      onClick={startNewGame}
                      className="mt-8 px-12 py-4 bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white text-xl font-black rounded-xl hover:scale-105 transition-transform"
                    >
                      Play Again
                    </button>
                  </motion.div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </TopDownGameTable>

        {onBack && (
          <button
            onClick={onBack}
            className="absolute top-4 left-4 z-40 px-6 py-2 bg-purple-900/80 backdrop-blur-xl text-purple-300 font-bold rounded-lg hover:bg-purple-800/80 transition-all border-2 border-purple-500"
          >
            ← Back
          </button>
        )}
      </div>
    );
  }

  // 3D Perspective View
  return (
    <div className="relative w-full h-screen bg-black">
      <ViewToggle view={view} onToggle={setView} />
      <UserAvatarManager />
      {/* Neon Grid Background */}
      <div 
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: `
            linear-gradient(rgba(168, 85, 247, 0.3) 1px, transparent 1px),
            linear-gradient(90deg, rgba(168, 85, 247, 0.3) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px',
        }}
      />

      {/* Purple Glows */}
      <motion.div
        animate={{ scale: [1, 1.3, 1], opacity: [0.2, 0.4, 0.2] }}
        transition={{ duration: 4, repeat: Infinity }}
        className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-600 rounded-full blur-[120px]"
      />

      {/* Header */}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-20">
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="bg-black/70 backdrop-blur-xl px-8 py-3 rounded-2xl border-2 border-fuchsia-500"
        >
          <h2 className="text-3xl font-black text-transparent bg-gradient-to-r from-fuchsia-500 to-purple-500 bg-clip-text text-center">
            🐟 Premium Go Fish 🐟
          </h2>
          <p className="text-white/50 text-xs text-center mt-1">Global Vibez DSG™ | Premium Tables</p>
        </motion.div>
      </div>

      {/* Score Display */}
      <div className="absolute top-20 left-4 z-20">
        <div className="bg-black/80 backdrop-blur-xl p-4 rounded-xl border-2 border-purple-500">
          <p className="text-fuchsia-400 font-bold text-sm mb-2">📚 BOOKS</p>
          <div className="space-y-2">
            <div>
              <p className="text-white text-xs">You:</p>
              <p className="text-2xl font-black text-green-400">{playerBooks.length}</p>
            </div>
            <div>
              <p className="text-white text-xs">Opponent:</p>
              <p className="text-2xl font-black text-red-400">{opponentBooks.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Message Display */}
      <div className="absolute top-1/3 left-1/2 transform -translate-x-1/2 z-20">
        <motion.div
          key={message}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-fuchsia-600 px-8 py-4 rounded-2xl border-2 border-white"
        >
          <p className="text-2xl font-black text-white text-center">{message}</p>
        </motion.div>
      </div>

      {/* Opponent's Cards */}
      <div className="absolute top-32 left-1/2 transform -translate-x-1/2 z-10">
        <div className="flex gap-1">
          {[...Array(opponentCardCount)].map((_, i) => (
            <motion.div
              key={_.id || _.name || `item-${i}`}
              initial={{ y: -100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: i * 0.05 }}
              className="w-16 h-24 bg-gradient-to-br from-purple-900 to-fuchsia-900 rounded-lg border-2 border-fuchsia-500 flex items-center justify-center"
            >
              <p className="text-4xl">🎴</p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Player's Hand */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-10">
        <div className="flex gap-3">
          {playerHand.map((card, i) => (
            <motion.div
              key={card.id}
              initial={{ y: 100, opacity: 0 }}
              animate={{ 
                y: 0, 
                opacity: 1,
                scale: selectedCard === card.rank ? 1.1 : 1,
              }}
              whileHover={{ y: -20, scale: 1.1 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => {
                if (playerTurn && !aiThinking && !gameOver) {
                  setSelectedCard(card.rank);
                  setTimeout(() => handleCardAsk(card.rank), 300);
                }
              }}
              className={`w-20 h-32 bg-white rounded-xl border-4 cursor-pointer ${
                selectedCard === card.rank ? 'border-yellow-400' : 'border-purple-500'
              } flex flex-col items-center justify-center shadow-2xl`}
            >
              <p className="text-4xl mb-1">{card.suit}</p>
              <p className="text-3xl font-black text-gray-800">{card.rank}</p>
            </motion.div>
          ))}
        </div>
        <p className="text-center text-purple-400 text-sm mt-2 font-bold">
          {playerTurn && !gameOver ? 'Click a card to ask for it!' : ''}
        </p>
      </div>

      {/* Game Over Overlay */}
      <AnimatePresence>
        {gameOver && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center"
          >
            <div className="text-center">
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 150 }}
              >
                <p className="text-9xl mb-4">{playerBooks.length > opponentBooks.length ? '🏆' : '😔'}</p>
                <h3 className="text-6xl font-black mb-4 text-transparent bg-gradient-to-r from-fuchsia-500 to-purple-500 bg-clip-text">
                  {message}
                </h3>
                <p className="text-2xl text-white mb-2">Final Score:</p>
                <p className="text-xl text-white">You: {playerBooks.length} books | Opponent: {opponentBooks.length} books</p>
                
                <button
                  onClick={startNewGame}
                  className="mt-8 px-12 py-4 bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white text-xl font-black rounded-xl hover:scale-105 transition-transform"
                >
                  Play Again
                </button>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Back Button */}
      {onBack && (
        <button
          onClick={onBack}
          className="absolute top-4 left-4 z-20 px-6 py-2 bg-purple-900/50 backdrop-blur-xl text-purple-300 font-bold rounded-lg hover:bg-purple-800/50 transition-all border-2 border-purple-500"
        >
          ← Back
        </button>
      )}
    </div>
  );
}
