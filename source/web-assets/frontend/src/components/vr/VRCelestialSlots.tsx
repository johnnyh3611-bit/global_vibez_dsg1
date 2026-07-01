
import React, { useState, useRef, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { XR, createXRStore } from '@react-three/xr';
import { Text, OrbitControls, Environment, PerspectiveCamera } from '@react-three/drei';
import { motion } from 'framer-motion';
import BackButton from '../BackButton';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Symbol colors matching web version
const SYMBOL_COLORS = {
  MIDNIGHT_WILD: '#06b6d4',      // Cyan
  CELESTIAL_CROWN: '#fbbf24',    // Amber
  HEART_VIBE: '#ec4899',         // Pink
  DICE_PAIR: '#a855f7',          // Purple
  LIVE_STREAM: '#10b981',        // Green
  CHERRY: '#ef4444',             // Red
  STAR: '#f97316'                // Orange
};

const SYMBOL_EMOJIS = {
  MIDNIGHT_WILD: '💎',
  CELESTIAL_CROWN: '👑',
  HEART_VIBE: '💝',
  DICE_PAIR: '🎲',
  LIVE_STREAM: '📺',
  CHERRY: '🍒',
  STAR: '⭐'
};

// 3D Reel component
function Reel({ position, symbol, isSpinning }: { position?: any, symbol?: any, isSpinning?: any }) {
  const meshRef = useRef<any>(null);
  const color = SYMBOL_COLORS[symbol] || '#ffffff';

  useEffect(() => {
    if (isSpinning && meshRef.current) {
      meshRef.current.rotation.x += 0.5;
    }
  }, [isSpinning]);

  return (
    <group position={position}>
      {/* Reel cylinder */}
      <mesh ref={meshRef}>
        <cylinderGeometry args={[0.3, 0.3, 0.6, 32]} />
        <meshStandardMaterial color={color} metalness={0.8} roughness={0.2} emissive={color} emissiveIntensity={0.3} />
      </mesh>
      
      {/* Symbol text */}
      <Text
        position={[0, 0, 0.31]}
        fontSize={0.3}
        color="white"
        anchorX="center"
        anchorY="middle"
      >
        {SYMBOL_EMOJIS[symbol]}
      </Text>
    </group>
  );
}

// Interactive Lever
function Lever({ onPull, disabled }: { onPull?: any, disabled?: any }) {
  const [isPulled, setIsPulled] = useState(false);
  const leverRef = useRef<any>(null);

  const handleSelect = () => {
    if (disabled) return;
    
    setIsPulled(true);
    onPull();
    
    // Animate lever pull
    if (leverRef.current) {
      leverRef.current.rotation.z = Math.PI / 4;
      setTimeout(() => {
        if (leverRef.current) {
          leverRef.current.rotation.z = 0;
        }
        setIsPulled(false);
      }, 500);
    }
  };

  return (
    <group position={[1.2, 0, 0]} ref={leverRef}>
      {/* Lever handle */}
      <mesh position={[0, 0.5, 0]} onClick={handleSelect}>
        <sphereGeometry args={[0.1, 16, 16]} />
        <meshStandardMaterial color={disabled ? '#666666' : '#ff0000'} metalness={0.9} roughness={0.1} />
      </mesh>
      
      {/* Lever rod */}
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 1, 16]} />
        <meshStandardMaterial color="#888888" metalness={0.8} roughness={0.3} />
      </mesh>
    </group>
  );
}

// 3D Button
function Button3D({ position, text, onClick, color = '#06b6d4', disabled = false }: { position?: any, text?: any, onClick?: any, color?: any, disabled?: any }) {
  const [hovered, setHovered] = useState(false);

  return (
    <group position={position}>
      <mesh
        onClick={onClick}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
      >
        <boxGeometry args={[0.4, 0.2, 0.1]} />
        <meshStandardMaterial 
          color={disabled ? '#444444' : (hovered ? '#ffffff' : color)} 
          metalness={0.5} 
          roughness={0.5}
        />
      </mesh>
      <Text
        position={[0, 0, 0.06]}
        fontSize={0.08}
        color="black"
        anchorX="center"
        anchorY="middle"
      >
        {text}
      </Text>
    </group>
  );
}

// Floating Info Panel
function InfoPanel({ position, title, value, color = '#ffffff' }: { position?: any, title?: any, value?: any, color?: any }) {
  return (
    <group position={position}>
      {/* Panel background */}
      <mesh>
        <planeGeometry args={[0.8, 0.3]} />
        <meshStandardMaterial color="#0a0a0a" transparent opacity={0.8} />
      </mesh>
      
      {/* Title */}
      <Text
        position={[0, 0.08, 0.01]}
        fontSize={0.06}
        color="#888888"
        anchorX="center"
        anchorY="middle"
      >
        {title}
      </Text>
      
      {/* Value */}
      <Text
        position={[0, -0.05, 0.01]}
        fontSize={0.12}
        color={color}
        anchorX="center"
        anchorY="middle"
      >
        {value}
      </Text>
    </group>
  );
}

// Main VR Scene
function VRScene({ gameState, onSpin, onBetChange }: { gameState?: any, onSpin?: any, onBetChange?: any }) {
  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.5} />
      <pointLight position={[0, 3, 0]} intensity={1.5} color="#06b6d4" />
      <pointLight position={[2, 2, 2]} intensity={1} color="#fbbf24" />
      <spotLight position={[0, 5, 0]} angle={0.5} intensity={2} castShadow />

      {/* Environment */}
      <Environment preset="night" />

      {/* Camera */}
      <PerspectiveCamera makeDefault position={[0, 1.6, 3]} />

      {/* Slot Machine Frame */}
      <mesh position={[0, 0, -0.5]}>
        <boxGeometry args={[3, 2, 0.2]} />
        <meshStandardMaterial color="#1a1a1a" metalness={0.8} roughness={0.3} />
      </mesh>

      {/* 5 Reels */}
      {gameState.symbols.map((symbol, index) => (
        <Reel
          key={`symbols-${index}`}
          position={[-1.2 + index * 0.6, 0, 0]}
          symbol={symbol}
          isSpinning={gameState.isSpinning}
        />
      ))}

      {/* Lever */}
      <Lever 
        onPull={onSpin} 
        disabled={gameState.isSpinning || gameState.credits < gameState.betAmount}
      />

      {/* Info Panels */}
      <InfoPanel
        position={[-1.5, 1.2, 0]}
        title="CREDITS"
        value={`$${gameState.credits.toLocaleString()}`}
        color="#fbbf24"
      />

      <InfoPanel
        position={[0, 1.2, 0]}
        title="BET"
        value={`$${gameState.betAmount}`}
        color="#06b6d4"
      />

      <InfoPanel
        position={[1.5, 1.2, 0]}
        title="LAST WIN"
        value={gameState.lastWin ? `$${gameState.lastWin}` : '$0'}
        color="#10b981"
      />

      {/* Bet Controls */}
      <Button3D
        position={[-0.3, -0.8, 0]}
        text="BET -"
        onClick={() => onBetChange(-1)}
        color="#ec4899"
      />

      <Button3D
        position={[0.3, -0.8, 0]}
        text="BET +"
        onClick={() => onBetChange(1)}
        color="#a855f7"
      />

      {/* Dating Bonus Indicator */}
      {gameState.datingMultiplier > 1.0 && (
        <group position={[0, -1.2, 0]}>
          <Text
            fontSize={0.15}
            color="#ec4899"
            anchorX="center"
            anchorY="middle"
          >
            💝 DATING BONUS {gameState.datingMultiplier.toFixed(2)}x
          </Text>
        </group>
      )}

      {/* Win Celebration */}
      {gameState.showWin && (
        <group position={[0, 0.5, 0.5]}>
          <Text
            fontSize={0.3}
            color="#fbbf24"
            anchorX="center"
            anchorY="middle"
          >
            🎊 WIN ${gameState.lastWin}! 🎊
          </Text>
        </group>
      )}

      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1, 0]} receiveShadow>
        <planeGeometry args={[10, 10]} />
        <meshStandardMaterial color="#050505" metalness={0.5} roughness={0.8} />
      </mesh>

      {/* Controls */}
      <OrbitControls />
    </>
  );
}

// Main VR Component
export default function VRCelestialSlots() {
  // Create XR store for @react-three/xr v6
  const store = createXRStore();

  const [gameState, setGameState] = useState({
    credits: 5000,
    betAmount: 50,
    symbols: ['CHERRY', 'STAR', 'CHERRY', 'STAR', 'CHERRY'],
    isSpinning: false,
    lastWin: null,
    showWin: false,
    datingMultiplier: 1.0
  });

  const BET_AMOUNTS = [10, 25, 50, 100, 250, 500, 1000];
  const [betIndex, setBetIndex] = useState(2); // Start at $50

  const handleBetChange = (direction) => {
    if (gameState.isSpinning) return;
    
    const newIndex = Math.max(0, Math.min(BET_AMOUNTS.length - 1, betIndex + direction));
    setBetIndex(newIndex);
    setGameState(prev => ({ ...prev, betAmount: BET_AMOUNTS[newIndex] }));
  };

  const handleSpin = async () => {
    if (gameState.isSpinning || gameState.credits < gameState.betAmount) return;

    setGameState(prev => ({ ...prev, isSpinning: true, showWin: false }));

    try {
      // Spinning animation
      const spinDuration = 2000;
      const interval = setInterval(() => {
        const randomSymbols = Object.keys(SYMBOL_COLORS);
        setGameState(prev => ({
          ...prev,
          symbols: Array(5).fill(0).map(() => 
            randomSymbols[Math.floor(Math.random() * randomSymbols.length)]
          )
        }));
      }, 100);

      // Call backend
      const response = await fetch(`${API_URL}/api/slots/spin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: 'vr_user',
          bet_amount: gameState.betAmount
        })
      });

      const result = await response.json();

      // Stop spinning
      setTimeout(() => {
        clearInterval(interval);
        
        const netWin = result.final_payout - gameState.betAmount;
        
        setGameState(prev => ({
          ...prev,
          symbols: result.symbols,
          credits: prev.credits + netWin,
          lastWin: result.final_payout,
          showWin: result.final_payout > 0,
          datingMultiplier: result.dating_multiplier,
          isSpinning: false
        }));

        // Hide win message after 3 seconds
        if (result.final_payout > 0) {
          setTimeout(() => {
            setGameState(prev => ({ ...prev, showWin: false }));
          }, 3000);
        }
      }, spinDuration);

    } catch (error) {
      // console.error('Spin error:', error);
      setGameState(prev => ({ ...prev, isSpinning: false }));
    }
  };

  return (
    <div className="relative w-full h-screen bg-black">
      {/* Back button */}
      <div className="absolute top-4 left-4 z-50">
        <BackButton to="/games" label="← Exit VR" variant="casino" />
      </div>

      {/* Instructions */}
      <div className="absolute top-4 right-4 z-50 bg-black/80 backdrop-blur-sm border border-cyan-400/30 rounded-lg p-4 text-white max-w-sm">
        <h3 className="text-lg font-bold text-cyan-400 mb-2">🎮 VR Controls</h3>
        <ul className="text-sm space-y-1">
          <li>👆 <strong>Click</strong> with mouse (or point with controllers in VR)</li>
          <li>🎰 <strong>Click RED LEVER</strong> to spin</li>
          <li>💰 <strong>BET +/-</strong> buttons to adjust bet</li>
          <li>💝 Dating bonus shows when compatible players nearby</li>
          <li>🖱️ <strong>Drag to rotate</strong> | Scroll to zoom</li>
        </ul>
      </div>

      {/* VR Enter Button */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-50">
        <button
          onClick={() => store.enterVR()}
          className="bg-gradient-to-r from-cyan-500 to-purple-500 text-white px-8 py-4 rounded-lg font-bold text-xl shadow-2xl hover:scale-105 transition"
        >
          🥽 ENTER VR
        </button>
      </div>

      {/* 3D Canvas */}
      <Canvas shadows gl={{ preserveDrawingBuffer: true }}>
        <XR store={store}>
          <VRScene 
            gameState={gameState}
            onSpin={handleSpin}
            onBetChange={handleBetChange}
          />
        </XR>
      </Canvas>

      {/* Desktop Preview Info */}
      <div className="absolute bottom-24 left-1/2 transform -translate-x-1/2 z-40 bg-pink-500/20 backdrop-blur-sm border border-pink-400/30 rounded-lg px-6 py-3">
        <p className="text-pink-400 font-bold text-center">
          🥽 Desktop preview active | Put on VR headset for full immersion!
        </p>
      </div>
    </div>
  );
}
