
import { useState, useEffect, useRef, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Stars, Html } from '@react-three/drei';
import { motion, AnimatePresence } from 'framer-motion';
import * as THREE from 'three';
import cardSoundManager from '@/utils/cardSoundManager';
import ParticleEffectsOverlay, { ConfettiCelebration } from '@/components/ParticleEffectsOverlay';

// PROTOCOL: OMEGA - Cyberpunk Color Palette
const OMEGA_COLORS = {
  void: '#000000',
  cyan: '#00ffff',
  magenta: '#ff00ff',
  glass: '#0a1f2e',
  neon_cyan: '#00fff5',
  neon_magenta: '#ff00dd',
  threat: '#ff0000',
  warning: '#ffaa00',
  grid: '#0a4a5a'
};

// Energy Program wireframe geometries
const PROGRAM_GEOMETRIES = {
  PAWN: 'tetrahedron',     // Simple pyramid
  ROOK: 'box',             // Tower
  KNIGHT: 'octahedron',    // L-shaped construct
  BISHOP: 'cone',          // Beam projector
  QUEEN: 'sphere',         // Reflective shield
  KING: 'icosahedron',     // Singularity core
  VOID_LEECH: 'torus'      // Virus ring
};

// Glass Layer Component
function GlassLayer({ layerIndex, opacity, isRefragging }) {
  const meshRef = useRef<any>(null);
  const { z, gridSize } = { z: layerIndex * 100, gridSize: 10 };

  useFrame((state) => {
    if (meshRef.current) {
      // Subtle pulsing effect
      meshRef.current.material.opacity = opacity + Math.sin(state.clock.elapsedTime * 0.5) * 0.05;
      
      // System Refrag animation
      if (isRefragging) {
        meshRef.current.rotation.z += 0.02;
      }
    }
  });

  return (
    <group position={[0, 0, z]}>
      {/* Glass plane */}
      <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[gridSize * 10, gridSize * 10]} />
        <meshPhysicalMaterial
          color={OMEGA_COLORS.glass}
          transparent
          opacity={opacity}
          metalness={0.9}
          roughness={0.1}
          transmission={0.9}
          thickness={1}
        />
      </mesh>

      {/* Neon grid lines */}
      <GridLines gridSize={gridSize} color={layerIndex === 1 ? OMEGA_COLORS.cyan : OMEGA_COLORS.grid} />
    </group>
  );
}

// Neon Grid Lines
function GridLines({ gridSize, color }) {
  const geometryRef = useRef<any>(null);
  const [geometry, setGeometry] = useState(null);
  
  useEffect(() => {
    const points = [];
    const cellSize = 10;

    // Vertical lines
    for (let i = 0; i <= gridSize; i++) {
      const x = (i - gridSize / 2) * cellSize;
      points.push(
        new THREE.Vector3(x, -(gridSize / 2) * cellSize, 0),
        new THREE.Vector3(x, (gridSize / 2) * cellSize, 0)
      );
    }

    // Horizontal lines
    for (let i = 0; i <= gridSize; i++) {
      const y = (i - gridSize / 2) * cellSize;
      points.push(
        new THREE.Vector3(-(gridSize / 2) * cellSize, y, 0),
        new THREE.Vector3((gridSize / 2) * cellSize, y, 0)
      );
    }

    const newGeometry = new THREE.BufferGeometry().setFromPoints(points);
    geometryRef.current = newGeometry;
    setGeometry(newGeometry);
    
    // Cleanup on unmount
    return () => {
      if (geometryRef.current) {
        geometryRef.current.dispose();
      }
    };
  }, [gridSize]);

  if (!geometry) return null;

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color={color} transparent opacity={0.3} />
    </lineSegments>
  );
}

// Energy Program (Neon Wireframe Piece)
function EnergyProgram({ program, onClick, isSelected }) {
  const meshRef = useRef<any>(null);
  const { type, team, position, layer, integrity, energy } = program;
  
  const color = team === 'cyan' ? OMEGA_COLORS.neon_cyan : OMEGA_COLORS.neon_magenta;
  const cellSize = 10;
  const x = (position[0] - 4.5) * cellSize;
  const y = (position[1] - 4.5) * cellSize;
  const z = layer * 100 + 5; // Slight elevation above grid

  useFrame((state) => {
    if (meshRef.current) {
      // Pulse effect
      const pulse = 1 + Math.sin(state.clock.elapsedTime * 2) * 0.05;
      meshRef.current.scale.set(pulse, pulse, pulse);
      
      // Rotate King (Singularity core)
      if (type === 'king') {
        meshRef.current.rotation.y += 0.02;
        meshRef.current.rotation.x += 0.01;
      }
      
      // Selected highlight
      if (isSelected) {
        meshRef.current.material.emissiveIntensity = 2 + Math.sin(state.clock.elapsedTime * 5);
      }
    }
  });

  // Get geometry based on piece type
  const getGeometry = () => {
    switch (type) {
      case 'pawn':
        return <tetrahedronGeometry args={[2, 0]} />;
      case 'rook':
        return <boxGeometry args={[3, 6, 3]} />;
      case 'knight':
        return <octahedronGeometry args={[2.5, 0]} />;
      case 'bishop':
        return <coneGeometry args={[2, 5, 4]} />;
      case 'queen':
        return <sphereGeometry args={[3, 16, 16]} />;
      case 'king':
        return <icosahedronGeometry args={[3, 1]} />;
      case 'void_leech':
        return <torusGeometry args={[2, 0.8, 16, 32]} />;
      default:
        return <boxGeometry args={[2, 2, 2]} />;
    }
  };

  return (
    <mesh
      ref={meshRef}
      position={[x, y, z]}
      onClick={onClick}
    >
      {getGeometry()}
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={isSelected ? 2 : 1}
        wireframe
        transparent
        opacity={0.8}
      />
      
      {/* Integrity/Energy HUD */}
      <Html distanceFactor={15}>
        <div className="text-xs text-center" style={{ color, minWidth: '60px' }}>
          <div className="font-bold">HP: {integrity}</div>
          <div>EP: {energy}</div>
        </div>
      </Html>
    </mesh>
  );
}

// Data-Fall Particles (Matrix effect)
function DataFallParticles() {
  const particlesRef = useRef<any>(null);
  const particleCount = 1000;

  useFrame((state) => {
    if (particlesRef.current) {
      const positions = particlesRef.current.geometry.attributes.position.array;
      
      for (let i = 0; i < particleCount; i++) {
        const i3 = i * 3;
        // Move particles down
        positions[i3 + 1] -= 0.5; // Y position
        
        // Reset to top when reaching bottom
        if (positions[i3 + 1] < -100) {
          positions[i3 + 1] = 300;
        }
      }
      
      particlesRef.current.geometry.attributes.position.needsUpdate = true;
    }
  });

  const particles = new Float32Array(particleCount * 3);
  for (let i = 0; i < particleCount; i++) {
    particles[i * 3] = (Math.random() - 0.5) * 200;     // X
    particles[i * 3 + 1] = Math.random() * 300;         // Y
    particles[i * 3 + 2] = (Math.random() - 0.5) * 200; // Z
  }

  return (
    <points ref={particlesRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={particleCount}
          array={particles}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.5}
        color={OMEGA_COLORS.cyan}
        transparent
        opacity={0.3}
        sizeAttenuation
      />
    </points>
  );
}

// Threat Vector Beam (Attack visualization)
function ThreatVector({ from, to, color = OMEGA_COLORS.threat }) {
  const geometryRef = useRef<any>(null);
  const [geometry, setGeometry] = useState(null);
  
  // Create and update geometry
  useEffect(() => {
    const points = [
      new THREE.Vector3(from[0], from[1], from[2]),
      new THREE.Vector3(to[0], to[1], to[2])
    ];
    
    const newGeometry = new THREE.BufferGeometry().setFromPoints(points);
    
    // Dispose old geometry if it exists
    if (geometryRef.current) {
      geometryRef.current.dispose();
    }
    
    geometryRef.current = newGeometry;
    setGeometry(newGeometry);
    
    // Cleanup on unmount
    return () => {
      if (geometryRef.current) {
        geometryRef.current.dispose();
      }
    };
  }, [from, to]);

  if (!geometry) return null;

  return (
    // @ts-expect-error — r3f lowercase <line> collides with React's SVG line type; geometry prop is r3f-specific.
    <line geometry={geometry}>
      <lineBasicMaterial color={color} linewidth={3} />
    </line>
  );
}

// Singularity Effect (King Ultimate)
function SingularityEffect({ position, active }) {
  const meshRef = useRef<any>(null);
  const startTime = useRef(Date.now());

  useFrame((state) => {
    if (meshRef.current && active) {
      // Calculate time-based expansion (max 2 seconds)
      const elapsed = (Date.now() - startTime.current) / 1000;
      const expansionFactor = Math.min(elapsed * 2.5, 10); // Cap at 10x size
      
      meshRef.current.scale.setScalar(1 + expansionFactor);
      meshRef.current.material.opacity = Math.max(0, 1 - elapsed * 0.5);
    }
  });
  
  // Reset start time when activated
  useEffect(() => {
    if (active) {
      startTime.current = Date.now();
    }
  }, [active]);

  if (!active) return null;

  return (
    <mesh ref={meshRef} position={position}>
      <sphereGeometry args={[1, 32, 32]} />
      <meshBasicMaterial
        color="#ffffff"
        transparent
        opacity={1}
      />
    </mesh>
  );
}

// Main 3D Scene
function OmegaScene({ gameState, onProgramClick, selectedProgram }) {
  const [isRefragging, setIsRefragging] = useState(false);

  useEffect(() => {
    if (gameState?.game_state === 'system_refrag') {
      setIsRefragging(true);
      setTimeout(() => setIsRefragging(false), 3000);
    }
  }, [gameState?.game_state]);

  return (
    <>
      {/* Ambient lighting */}
      <ambientLight intensity={0.2} />
      <pointLight position={[0, 50, 100]} intensity={0.8} color={OMEGA_COLORS.cyan} />
      <pointLight position={[0, -50, 100]} intensity={0.8} color={OMEGA_COLORS.magenta} />

      {/* Glass layers */}
      {[0, 1, 2].map((layerIndex) => (
        <GlassLayer
          key={layerIndex}
          layerIndex={layerIndex}
          opacity={0.1 + layerIndex * 0.1}
          isRefragging={isRefragging}
        />
      ))}

      {/* Energy Programs */}
      {gameState?.layers && Object.entries(gameState.layers).map(([layerIdx, layer]) =>
        (layer as any).programs.map((program: any) => (
          <EnergyProgram
            key={program.id}
            program={program}
            onClick={() => onProgramClick(program)}
            isSelected={selectedProgram?.id === program.id}
          />
        ))
      )}

      {/* Data-fall particles */}
      <DataFallParticles />

      {/* Stars background */}
      <Stars
        radius={300}
        depth={50}
        count={5000}
        factor={4}
        saturation={0}
        fade
        speed={1}
      />
    </>
  );
}

// HUD Overlay
function OmegaHUD({ gameState, onSingularity, onAegisToggle }) {
  return (
    <div className="fixed inset-0 pointer-events-none">
      {/* Top status bar - Premium Glass */}
      <div className="absolute top-0 left-0 right-0 p-4 flex justify-between pointer-events-auto gap-4">
        <div className="backdrop-blur-2xl bg-gradient-to-br from-cyan-900/30 to-cyan-950/20 
          border-2 border-cyan-400/50 rounded-xl px-8 py-4
          shadow-[0_0_40px_rgba(0,255,255,0.4)]">
          <div className="font-['Orbitron'] text-cyan-300 text-xl uppercase tracking-widest">
            Protocol: Omega
          </div>
          <div className="text-cyan-400/80 text-sm mt-2 flex items-center gap-2">
            <span className="animate-pulse">⬢</span>
            Turn: {gameState?.current_turn || 0}
          </div>
        </div>

        <div className="backdrop-blur-2xl bg-gradient-to-br from-orange-900/30 to-red-900/20 
          border-2 border-orange-400/50 rounded-xl px-8 py-4
          shadow-[0_0_40px_rgba(255,170,0,0.4)]">
          <div className="font-['Orbitron'] text-orange-300 text-sm uppercase tracking-wider flex items-center gap-2">
            <span className="text-xl animate-pulse">⚠️</span>
            System Refrag: {gameState?.turns_until_refrag || 3} Turns
          </div>
        </div>
      </div>

      {/* Bottom control panel */}
      <div className="absolute bottom-0 left-0 right-0 p-4 flex justify-center gap-4 pointer-events-auto">
        {/* Singularity button */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => onSingularity()}
          disabled={!gameState?.singularity_ready?.cyan}
          className={`px-8 py-4 rounded-lg font-['Orbitron'] font-bold text-lg
            ${gameState?.singularity_ready?.cyan
              ? 'bg-gradient-to-r from-white via-cyan-400 to-white text-black border-2 border-white shadow-[0_0_30px_rgba(255,255,255,0.8)]'
              : 'bg-gray-800 text-gray-500 border-2 border-gray-700'
            }
            transition-all`}
        >
          ⚡ SINGULARITY {!gameState?.singularity_ready?.cyan && `(${gameState?.singularity_cooldown?.cyan || 0})`}
        </motion.button>

        {/* Reflective Aegis toggle */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => onAegisToggle()}
          className={`px-8 py-4 rounded-lg font-['Orbitron'] font-bold text-lg
            ${gameState?.aegis_active?.cyan
              ? 'bg-gradient-to-r from-magenta-600 to-purple-600 text-white border-2 border-magenta-400 shadow-[0_0_30px_rgba(255,0,255,0.6)]'
              : 'bg-gray-800 text-gray-400 border-2 border-gray-700'
            }
            transition-all`}
        >
          🛡️ REFLECTIVE AEGIS
        </motion.button>
      </div>

      {/* Combat log - Glass Cards */}
      {gameState?.combat_log_recent && gameState.combat_log_recent.length > 0 && (
        <div className="absolute right-4 top-24 w-96 space-y-3">
          {gameState.combat_log_recent.slice(-3).map((log, i) => (
            <motion.div
              key={`item-${i}`}
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              className="backdrop-blur-2xl bg-gradient-to-br from-cyan-900/20 to-cyan-950/10 
                border border-cyan-400/40 rounded-xl p-4
                font-['Courier_New'] text-cyan-300 text-sm
                shadow-[0_0_20px_rgba(0,255,255,0.2)]"
            >
              {log.message || `${log.event}: Turn ${log.turn}`}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

// Singularity Screen Effect
function SingularityScreenEffect({ active }) {
  if (!active) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 1, 1, 0] }}
      transition={{ duration: 3, times: [0, 0.2, 0.8, 1] }}
      className="fixed inset-0 z-50 pointer-events-none"
    >
      {/* White flash */}
      <div className="absolute inset-0 bg-white" />
      
      {/* Glitch overlay */}
      <div className="absolute inset-0 bg-black opacity-20"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' xmlns='http://www.w3.org/2000/svg'%3E%3Crect width='100' height='2' fill='%23fff' y='20'/%3E%3Crect width='100' height='2' fill='%23fff' y='50'/%3E%3Crect width='100' height='2' fill='%23fff' y='80'/%3E%3C/svg%3E")`,
          animation: 'glitch 0.1s infinite'
        }}
      />
      
      {/* Status text */}
      <div className="absolute inset-0 flex items-center justify-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="font-['Orbitron'] text-6xl font-bold text-black"
        >
          SYSTEM OVERWRITTEN
        </motion.div>
      </div>
    </motion.div>
  );
}

// Main Protocol: Omega Component
export default function ProtocolOmega() {
  const [gameState, setGameState] = useState(null);
  const [selectedProgram, setSelectedProgram] = useState(null);
  const [singularityActive, setSingularityActive] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [particleTrigger, setParticleTrigger] = useState(null);

  // Mock game state for demonstration
  useEffect(() => {
    const mockState = {
      game_state: 'active',
      current_turn: 5,
      turns_until_refrag: 2,
      singularity_ready: { cyan: true, magenta: false },
      singularity_cooldown: { cyan: 0, magenta: 3 },
      aegis_active: { cyan: false, magenta: true },
      layers: {
        0: { programs: [] },
        1: {
          programs: [
            {
              id: 'prog_1',
              team: 'cyan',
              type: 'king',
              layer: 1,
              position: [4, 0],
              integrity: 100,
              energy: 85
            },
            {
              id: 'prog_2',
              team: 'cyan',
              type: 'queen',
              layer: 1,
              position: [3, 0],
              integrity: 100,
              energy: 70
            },
            {
              id: 'prog_3',
              team: 'magenta',
              type: 'king',
              layer: 1,
              position: [4, 9],
              integrity: 80,
              energy: 90
            },
            {
              id: 'prog_4',
              team: 'magenta',
              type: 'rook',
              layer: 1,
              position: [0, 9],
              integrity: 65,
              energy: 50
            }
          ]
        },
        2: { programs: [] }
      },
      combat_log_recent: [
        { event: 'COMBAT', turn: 4, message: '⚔️ Rook attacks Bishop: 25 damage' },
        { event: 'VOID_LEECH_SPAWN', turn: 5, message: '🦠 VOID-LEECH DETECTED: [C7, Layer 2]' }
      ]
    };
    
    setGameState(mockState);
  }, []);

  const handleProgramClick = (program) => {
    setSelectedProgram(program);
    // Cyberpunk select sound
    cardSoundManager.playCardFlip();
  };

  const handleSingularity = () => {
    if (gameState?.singularity_ready?.cyan) {
      setSingularityActive(true);
      setTimeout(() => setSingularityActive(false), 3000);
      // Epic activation sound
      cardSoundManager.playWinSound();
      // Trigger particles at center
      setParticleTrigger({ x: window.innerWidth / 2, y: window.innerHeight / 2, color: '#00ffff' });
      setTimeout(() => setParticleTrigger(null), 100);
    }
  };

  const handleAegisToggle = () => {
    // Shield activation sound
    cardSoundManager.playChipClink();
  };

  const handleProgramMove = (program, newPosition) => {
    // Play move sound
    cardSoundManager.playCardSlam();
  };

  const handleProgramCapture = (program) => {
    // Play capture sound with particles
    cardSoundManager.playCardSlam();
    cardSoundManager.triggerHaptic('heavy');
  };

  const handleVictory = (team) => {
    // Victory celebration
    cardSoundManager.playWinSound();
    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 3000);
  };

  return (
    <div className="w-screen h-screen bg-black overflow-hidden">
      {/* 3D Canvas with Volumetric Fog */}
      {/* @ts-expect-error — `fog` is a valid r3f Canvas prop via Scene but not typed on the Canvas wrapper. */}
      <Canvas fog={new THREE.FogExp2('#000a0f', 0.008)}>
        <Suspense fallback={null}>
          <PerspectiveCamera makeDefault position={[0, -80, 110]} fov={60} />
          <OrbitControls
            enablePan
            enableZoom
            enableRotate
            minDistance={50}
            maxDistance={300}
          />
          <OmegaScene
            gameState={gameState}
            onProgramClick={handleProgramClick}
            selectedProgram={selectedProgram}
          />
        </Suspense>
      </Canvas>

      {/* HUD Overlay */}
      <OmegaHUD
        gameState={gameState}
        onSingularity={handleSingularity}
        onAegisToggle={handleAegisToggle}
      />

      {/* Singularity screen effect */}
      <SingularityScreenEffect active={singularityActive} />

      {/* CSS for glitch animation */}
      <style>{`
        @keyframes glitch {
          0% { transform: translate(0); }
          20% { transform: translate(-2px, 2px); }
          40% { transform: translate(-2px, -2px); }
          60% { transform: translate(2px, 2px); }
          80% { transform: translate(2px, -2px); }
          100% { transform: translate(0); }
        }
      `}</style>

      {/* Particle Effects Overlay */}
      <ParticleEffectsOverlay triggerSparkle={particleTrigger} />

      {/* Confetti Celebration on Victory */}
      <ConfettiCelebration active={showConfetti} />
    </div>
  );
}
