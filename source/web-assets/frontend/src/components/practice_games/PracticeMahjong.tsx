
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import cardSoundManager from '@/utils/cardSoundManager';
import ParticleEffectsOverlay from '@/components/ParticleEffectsOverlay';

const GameState = {
  WAITING: 'WAITING',
  PLAYING: 'PLAYING',
  RESULT: 'RESULT'
};

const Mahjong = () => {
  const [currentState, setCurrentState] = useState(GameState.WAITING);
  const [hand, setHand] = useState([]);
  const [wall, setWall] = useState([]);
  const [discarded, setDiscarded] = useState([]);
  const [selected, setSelected] = useState(null);
  const [credits, setCredits] = useState(5000);
  const [lastWin, setLastWin] = useState(0);
  const [melds, setMelds] = useState([]);

  const glassEffect = "bg-black/40 backdrop-blur-xl border border-white/10";

  // Simplified Mahjong tiles
  const tileTypes = {
    bamboo: [1, 2, 3, 4, 5, 6, 7, 8, 9],
    characters: [1, 2, 3, 4, 5, 6, 7, 8, 9],
    dots: [1, 2, 3, 4, 5, 6, 7, 8, 9],
    winds: ['E', 'S', 'W', 'N'],
    dragons: ['Red', 'Green', 'White']
  };

  const tileEmojis = {
    bamboo: '🎋',
    characters: '🀄',
    dots: '⚪',
    winds: '🌬️',
    dragons: '🐉'
  };

  const createTiles = () => {
    const tiles = [];
    let id = 0;

    // 4 copies of each tile (traditional Mahjong)
    for (let copy = 0; copy < 4; copy++) {
      Object.entries(tileTypes).forEach(([suit, values]) => {
        values.forEach(value => {
          tiles.push({ id: id++, suit, value, emoji: tileEmojis[suit] });
        });
      });
    }

    return shuffleTiles(tiles);
  };

  const shuffleTiles = (tiles) => {
    const shuffled = [...tiles];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  const startGame = () => {
    if (credits < 50) return;

    setCredits(credits - 50);
    cardSoundManager.playCardShuffle();

    const allTiles = createTiles();
    const playerHand = allTiles.slice(0, 14);
    const remainingWall = allTiles.slice(14);

    setHand(sortHand(playerHand));
    setWall(remainingWall);
    setDiscarded([]);
    setMelds([]);
    setSelected(null);
    setCurrentState(GameState.PLAYING);
  };

  const sortHand = (tiles) => {
    return [...tiles].sort((a, b) => {
      if (a.suit !== b.suit) return a.suit.localeCompare(b.suit);
      return String(a.value).localeCompare(String(b.value));
    });
  };

  const drawTile = async () => {
    if (wall.length === 0) return;

    try {
      const API = process.env.REACT_APP_BACKEND_URL;
      
      // 1. Place bet (server-authoritative)
      const betResponse = await fetch(`${API}/api/practice/casino/bet`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        
        body: JSON.stringify({
          game_type: 'mahjong',
          bet_amount: 10,
          bet_data: {}
        })
      });
      const {game_id} = await betResponse.json();
      
      // 2. Execute draw (server generates tile)
      const spinResponse = await fetch(`${API}/api/practice/casino/spin`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        
        body: JSON.stringify({game_id})
      });
      const {result} = await spinResponse.json();
      
      // 3. Create tile object from server result
      const newTile = {
        id: result.tile_id,
        suit: result.suit,
        value: result.value,
        emoji: tileEmojis[result.suit]
      };
      
      cardSoundManager.playCardFlip();
      setHand(sortHand([...hand, newTile]));
      setWall(wall.slice(1));
      
    } catch (error) {
      // console.error('Server-authoritative draw failed:', error);
      // Fallback to client-side
      cardSoundManager.playCardFlip();
      const newTile = wall[0];
      setHand(sortHand([...hand, newTile]));
      setWall(wall.slice(1));
    }
  };

  const discardTile = (tile) => {
    if (!tile) return;

    cardSoundManager.playCardSlam();
    setHand(hand.filter(t => t.id !== tile.id));
    setDiscarded([...discarded, tile]);
    setSelected(null);

    checkWin(hand.filter(t => t.id !== tile.id));
  };

  const tryMeld = () => {
    if (!selected) return;

    const selectedTile = hand.find(t => t.id === selected);
    const matches = hand.filter(
      t => t.suit === selectedTile.suit && t.value === selectedTile.value
    );

    if (matches.length >= 3) {
      // Pung (3 of a kind)
      cardSoundManager.playChipClink();
      const meld = matches.slice(0, 3);
      setMelds([...melds, { type: 'pung', tiles: meld }]);
      setHand(hand.filter(t => !meld.some(m => m.id === t.id)));
      setSelected(null);

      if (hand.length - 3 === 1) {
        handleWin('pung');
      }
    }
  };

  const checkWin = (currentHand) => {
    // Simplified win condition: all tiles melded or hand size = 1
    if (currentHand.length <= 1 || melds.length >= 4) {
      handleWin('mahjong');
    }
  };

  const handleWin = (type) => {
    setCurrentState(GameState.RESULT);
    cardSoundManager.playWinSound();

    const payouts = {
      pung: 200,
      mahjong: 1000,
      specialHand: 5000
    };

    const winAmount = payouts[type] || 100;
    setLastWin(winAmount);
    setCredits(credits + winAmount);

    setTimeout(() => {
      setCurrentState(GameState.WAITING);
      setHand([]);
      setWall([]);
      setDiscarded([]);
      setMelds([]);
    }, 3000);
  };

  const renderTile = (tile, onClick, isSelected = false) => (
    <motion.div
      key={tile.id}
      onClick={onClick}
      whileHover={{ scale: 1.1, y: -10 }}
      whileTap={{ scale: 0.95 }}
      className={`w-16 h-20 ${glassEffect} rounded-lg flex flex-col items-center justify-center cursor-pointer transition-all ${
        isSelected ? 'border-2 border-[#00F0FF] shadow-[0_0_20px_#00F0FF]' : 'hover:border-[#D4AF37]'
      }`}
    >
      <span className="text-2xl mb-1">{tile.emoji}</span>
      <span className="text-xs text-white/80 font-bold">{tile.value}</span>
    </motion.div>
  );

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4" 
         style={{ background: 'radial-gradient(circle at 50% 50%, #1A0B2E 0%, #08030F 60%, #000000 100%)' }}>
      <ParticleEffectsOverlay />
      
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        <h1 className="text-4xl md:text-6xl font-black text-[#D4AF37] mb-2 tracking-wider font-serif">
          麻將 MAHJONG
        </h1>
        <p className="text-white/60 text-sm uppercase tracking-[0.2em]">Classic Chinese Tile Game</p>
      </motion.div>

      {/* Melds Display */}
      {melds.length > 0 && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={`${glassEffect} rounded-2xl p-4 mb-6`}
        >
          <p className="text-xs uppercase tracking-[0.2em] text-white/40 mb-3">Melds ({melds.length})</p>
          <div className="flex gap-4">
            {melds.map((meld, idx) => (
              <div key={`meld-${idx}`} className="flex gap-1">
                {meld.tiles.map(tile => (
                  <div key={tile.id} className="w-12 h-16 bg-white/10 rounded flex flex-col items-center justify-center">
                    <span className="text-lg">{tile.emoji}</span>
                    <span className="text-[10px] text-white/60">{tile.value}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Player Hand */}
      {hand.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <p className="text-xs uppercase tracking-[0.2em] text-white/40 mb-3 text-center">Your Hand</p>
          <div className="flex gap-2 flex-wrap justify-center max-w-4xl">
            {hand.map(tile => renderTile(
              tile,
              () => setSelected(selected === tile.id ? null : tile.id),
              selected === tile.id
            ))}
          </div>
        </motion.div>
      )}

      {/* Game Actions */}
      {currentState === GameState.PLAYING && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex gap-4 mb-8"
        >
          <button
            onClick={drawTile}
            disabled={wall.length === 0}
            className="px-8 py-3 bg-[#D4AF37] text-black font-bold rounded-lg hover:scale-105 transition-all disabled:opacity-30"
          >
            Draw Tile ({wall.length})
          </button>
          <button
            onClick={tryMeld}
            disabled={!selected}
            className="px-8 py-3 bg-[#00F0FF] text-black font-bold rounded-lg hover:scale-105 transition-all disabled:opacity-30"
          >
            Form Meld
          </button>
          <button
            onClick={() => discardTile(hand.find(t => t.id === selected))}
            disabled={!selected}
            className="px-8 py-3 bg-red-500 text-white font-bold rounded-lg hover:scale-105 transition-all disabled:opacity-30"
          >
            Discard
          </button>
        </motion.div>
      )}

      {/* Discarded Tiles */}
      {discarded.length > 0 && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={`${glassEffect} rounded-2xl p-4 mb-6 max-w-3xl`}
        >
          <p className="text-xs uppercase tracking-[0.2em] text-white/40 mb-3">Discarded</p>
          <div className="flex gap-2 flex-wrap">
            {discarded.slice(-10).map((tile, idx) => (
              <div key={`discard-${tile.id || idx}`} className="w-10 h-12 bg-white/5 rounded flex flex-col items-center justify-center">
                <span className="text-sm">{tile.emoji}</span>
                <span className="text-[8px] text-white/40">{tile.value}</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Win Animation */}
      <AnimatePresence>
        {currentState === GameState.RESULT && (
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0 }}
            className="text-6xl font-black text-[#00F0FF] mb-8"
          >
            胡了! (MAHJONG!)
          </motion.div>
        )}
      </AnimatePresence>

      {/* Controls */}
      <div className="flex items-center gap-10">
        <div className="text-center">
          <p className="text-gray-400 text-xs uppercase tracking-widest">Credits</p>
          <p className="text-2xl font-black text-[#D4AF37]">${credits}</p>
        </div>

        {currentState === GameState.WAITING && (
          <button 
            onClick={startGame}
            disabled={credits < 50}
            className="px-20 py-5 bg-[#00F0FF] text-black font-black italic uppercase tracking-tighter hover:scale-105 active:scale-95 transition-all disabled:opacity-30 disabled:bg-gray-600"
            style={{ clipPath: 'polygon(5% 0, 100% 0, 95% 100%, 0 100%)' }}
          >
            New Game ($50)
          </button>
        )}

        <div className="text-center">
          <p className="text-gray-400 text-xs uppercase tracking-widest">Last Win</p>
          <p className="text-2xl font-black text-[#00F0FF]">${lastWin}</p>
        </div>
      </div>

      {/* Rules */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className={`mt-8 ${glassEffect} rounded-2xl p-6 max-w-2xl`}
      >
        <p className="text-xs uppercase tracking-[0.2em] text-white/40 mb-4">How to Play</p>
        <div className="space-y-2 text-sm text-white/80">
          <p>• Draw tiles to build a 14-tile hand</p>
          <p>• Form melds: 3+ matching tiles (same suit & value)</p>
          <p>• <span className="text-[#D4AF37] font-bold">Pung:</span> 3 identical tiles = $200</p>
          <p>• <span className="text-[#00F0FF] font-bold">Mahjong:</span> Complete hand = $1000</p>
          <p>• Select tile → Form Meld or Discard</p>
        </div>
      </motion.div>
    </div>
  );
};

export default Mahjong;
