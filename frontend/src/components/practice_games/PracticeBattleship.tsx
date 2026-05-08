
import React, { useState } from 'react';
import { Anchor, Target, RotateCcw } from 'lucide-react';

import cardSoundManager from '@/utils/cardSoundManager';
import ParticleEffectsOverlay from '@/components/ParticleEffectsOverlay';
const GRID_SIZE = 10;
const SHIPS = [
  { name: 'Carrier', size: 5, emoji: '🚢' },
  { name: 'Battleship', size: 4, emoji: '⛴️' },
  { name: 'Cruiser', size: 3, emoji: '🛳️' },
  { name: 'Submarine', size: 3, emoji: '🚤' },
  { name: 'Destroyer', size: 2, emoji: '⛵' }
];

const createGrid = () => Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(null));

export default function PracticeBattleship({ onMove, gameState }: { onMove?: any, gameState?: any }) {
  const [playerGrid, setPlayerGrid] = useState(createGrid());
  const [aiGrid, setAiGrid] = useState(createGrid());
  const [playerShots, setPlayerShots] = useState(createGrid());
  const [aiShots, setAiShots] = useState(createGrid());
  const [gameStarted, setGameStarted] = useState(false);
  const [playerShipsSunk, setPlayerShipsSunk] = useState(0);
  const [aiShipsSunk, setAiShipsSunk] = useState(0);
  const [message, setMessage] = useState('Place your ships!');
  const [gameOver, setGameOver] = useState(false);
  const [particleTrigger, setParticleTrigger] = useState(0);

  const placeShipsRandomly = (_grid?: any) => {
    const newGrid = createGrid();
    SHIPS.forEach(ship => {
      let placed = false;
      while (!placed) {
        const horizontal = Math.random() > 0.5;
        const row = Math.floor(Math.random() * GRID_SIZE);
        const col = Math.floor(Math.random() * GRID_SIZE);
        
        if (canPlaceShip(newGrid, row, col, ship.size, horizontal)) {
          placeShip(newGrid, row, col, ship.size, horizontal, ship.name);
          placed = true;
        }
      }
    });
    return newGrid;
  };

  const canPlaceShip = (grid, row, col, size, horizontal) => {
    for (let i = 0; i < size; i++) {
      const r = horizontal ? row : row + i;
      const c = horizontal ? col + i : col;
      if (r >= GRID_SIZE || c >= GRID_SIZE || grid[r][c]) return false;
    }
    return true;
  };

  const placeShip = (grid, row, col, size, horizontal, name) => {
    for (let i = 0; i < size; i++) {
      const r = horizontal ? row : row + i;
      const c = horizontal ? col + i : col;
      grid[r][c] = name;
    }
  };

  const startGame = () => {
    const pGrid = placeShipsRandomly();
    const aGrid = placeShipsRandomly();
    setPlayerGrid(pGrid);
    setAiGrid(aGrid);
    setPlayerShots(createGrid());
    setAiShots(createGrid());
    setGameStarted(true);
    setPlayerShipsSunk(0);
    setAiShipsSunk(0);
    setMessage('Your turn! Fire away!');
    setGameOver(false);
  };

  const handleShot = (row, col) => {
    if (!gameStarted || gameOver || playerShots[row][col]) return;

    cardSoundManager.playCardSlam();
    const newShots = playerShots.map(r => [...r]);
    newShots[row][col] = aiGrid[row][col] ? 'hit' : 'miss';
    setPlayerShots(newShots);

    if (aiGrid[row][col]) {
      setMessage('🎯 HIT!');
      const sunk = checkIfSunk(aiGrid, newShots, aiGrid[row][col]);
      if (sunk) {
        const newSunk = aiShipsSunk + 1;
        setAiShipsSunk(newSunk);
        setMessage(`💥 You sank their ${aiGrid[row][col]}!`);
        if (newSunk === SHIPS.length) {
          cardSoundManager.playWinSound();
          setParticleTrigger(prev => prev + 1);
          setGameOver(true);
          setMessage('🏆 VICTORY! You win!');
          return;
        }
      }
    } else {
      setMessage('💨 Miss!');
    }

    // AI turn
    setTimeout(() => {
      aiTurn();
    }, 1000);
  };

  const aiTurn = () => {
    const newShots = aiShots.map(r => [...r]);
    let row, col;
    do {
      row = Math.floor(Math.random() * GRID_SIZE);
      col = Math.floor(Math.random() * GRID_SIZE);
    } while (newShots[row][col]);

    newShots[row][col] = playerGrid[row][col] ? 'hit' : 'miss';
    setAiShots(newShots);

    if (playerGrid[row][col]) {
      const sunk = checkIfSunk(playerGrid, newShots, playerGrid[row][col]);
      if (sunk) {
        const newSunk = playerShipsSunk + 1;
        setPlayerShipsSunk(newSunk);
        setMessage(`😱 AI sank your ${playerGrid[row][col]}!`);
        if (newSunk === SHIPS.length) {
          cardSoundManager.playLoseSound();
          setGameOver(true);
          setMessage('💔 DEFEAT! AI wins!');
          return;
        }
      } else {
        setMessage('⚠️ AI hit your ship!');
      }
    } else {
      setMessage('Your turn!');
    }
  };

  const checkIfSunk = (grid, shots, shipName) => {
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if (grid[r][c] === shipName && shots[r][c] !== 'hit') {
          return false;
        }
      }
    }
    return true;
  };

  const GridDisplay = ({ grid, shots, isPlayer, onCellClick }: { grid: any; shots: any; isPlayer: boolean; onCellClick?: (row: number, col: number) => void }) => (
    <div className="space-y-2">
      <h3 className="text-xl font-bold text-center">{isPlayer ? 'Your Fleet' : 'Enemy Waters'}</h3>
      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${GRID_SIZE}, minmax(0, 1fr))` }}>
        {grid.map((row, r) => row.map((cell, c) => {
          const shot = shots[r][c];
          return (
            <button
              key={`${r}-${c}`}
              onClick={() => onCellClick && onCellClick(r, c)}
              disabled={isPlayer || !gameStarted || gameOver}
              className={`
                aspect-square rounded text-xs font-bold border-2 transition-all
                ${shot === 'hit' ? 'bg-red-600 border-red-400' : ''}
                ${shot === 'miss' ? 'bg-blue-400 border-blue-300' : ''}
                ${!shot && isPlayer && cell ? 'bg-gray-600 border-gray-400' : ''}
                ${!shot && !cell ? 'bg-blue-900 border-blue-700 hover:bg-blue-800' : ''}
              `}
            >
              {shot === 'hit' ? '💥' : shot === 'miss' ? '💨' : ''}
            </button>
          );
        }))}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-cyan-900 to-black p-4">
      {/* Particle Effects */}
      <ParticleEffectsOverlay triggerSparkle={particleTrigger > 0 ? { x: 0, y: 0 } : null} />
      
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-6">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent mb-2">
            ⚓ BATTLESHIP
          </h1>
          <p className="text-cyan-300 text-xl">{message}</p>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-gradient-to-br from-blue-600 to-cyan-600 rounded-xl p-4 border-2 border-blue-400">
            <div className="text-blue-100 text-sm">Your Ships Sunk</div>
            <div className="text-3xl font-bold text-white">{playerShipsSunk}/{SHIPS.length}</div>
          </div>
          <div className="bg-gradient-to-br from-red-600 to-orange-600 rounded-xl p-4 border-2 border-red-400">
            <div className="text-red-100 text-sm">Enemy Ships Sunk</div>
            <div className="text-3xl font-bold text-white">{aiShipsSunk}/{SHIPS.length}</div>
          </div>
        </div>

        {!gameStarted ? (
          <div className="text-center">
            <button
              onClick={startGame}
              className="px-12 py-6 bg-gradient-to-r from-green-600 to-cyan-600 text-white font-bold text-2xl rounded-xl border-2 border-green-400 hover:scale-105 transition-transform"
            >
              START BATTLE
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gradient-to-br from-gray-900 to-blue-900 rounded-2xl p-6 border-4 border-cyan-600">
              <GridDisplay grid={playerGrid} shots={aiShots} isPlayer={true} />
            </div>
            <div className="bg-gradient-to-br from-gray-900 to-red-900 rounded-2xl p-6 border-4 border-red-600">
              <GridDisplay grid={aiGrid} shots={playerShots} isPlayer={false} onCellClick={handleShot} />
            </div>
          </div>
        )}

        {gameStarted && (
          <div className="mt-6 text-center">
            <button
              onClick={startGame}
              className="px-8 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-xl hover:scale-105 transition-transform flex items-center gap-2 mx-auto"
            >
              <RotateCcw className="w-5 h-5" />
              New Game
            </button>
          </div>
        )}
      </div>
    </div>
  );
}