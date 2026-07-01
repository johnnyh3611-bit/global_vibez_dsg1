
import { useRef, useState, useEffect, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Text, Box, Sphere, Environment } from '@react-three/drei';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import * as THREE from 'three';

// Jazz Club Color Palette
const JAZZ_PALETTE = {
  darkWood: '#1a0f0a',
  burgundy: '#4a0e0e',
  gold: '#d4af37',
  brass: '#b5a642',
  dimLight: '#fff4e6',
  shadow: '#0a0604'
};

// Table Stations Configuration
const TABLE_STATIONS = [
  { 
    id: 'blackjack', 
    name: 'Vibez Casino\nBlackjack', 
    position: [-8, 0, -5], 
    color: '#0a4d0a',
    route: '/vibez-casino-blackjack',
    icon: '🎰'
  },
  { 
    id: 'poker', 
    name: 'High Stakes\nPoker', 
    position: [-3, 0, -5], 
    color: '#0a1a4d',
    route: '/poker-room',
    icon: '♠️'
  },
  { 
    id: 'bid-whist', 
    name: 'Grand Master\nBid Whist', 
    position: [3, 0, -5], 
    color: '#4d0a1a',
    route: '/grand-master-bid-whist',
    icon: '🏆'
  },
  { 
    id: 'spades', 
    name: 'Spades AAA', 
    position: [8, 0, -5], 
    color: '#0a1f44',
    route: '/spades',
    icon: '♠️'
  },
  { 
    id: 'uno', 
    name: 'Multiplayer\nUNO', 
    position: [-5, 0, 2], 
    color: '#4d1a0a',
    route: '/multiplayer/uno',
    icon: '🎴'
  },
  { 
    id: 'protocol-omega', 
    name: 'Protocol:\nOmega', 
    position: [5, 0, 2], 
    color: '#0a4d4d',
    route: '/protocol-omega',
    icon: '♟️'
  }
];

// Interactive Table Component
function TableStation({ station, onHover, onLeave, onClick, isHovered }) {
  const meshRef = useRef<any>(null);
  const [hovered, setHovered] = useState(false);
  
  // Reusable Vector3 objects to prevent memory leaks
  const scaleHovered = useRef(new THREE.Vector3(1.1, 1.1, 1.1));
  const scaleNormal = useRef(new THREE.Vector3(1, 1, 1));

  useFrame((state) => {
    if (meshRef.current) {
      // Gentle floating animation
      meshRef.current.position.y = station.position[1] + Math.sin(state.clock.elapsedTime * 0.5) * 0.05;
      
      // Glow effect when hovered (using cached Vector3 objects)
      if (hovered || isHovered) {
        meshRef.current.scale.lerp(scaleHovered.current, 0.1);
      } else {
        meshRef.current.scale.lerp(scaleNormal.current, 0.1);
      }
    }
  });

  return (
    <group position={station.position}>
      {/* Table Surface */}
      <Box
        ref={meshRef}
        args={[2, 0.1, 1.5]}
        position={[0, 0.75, 0]}
        onPointerOver={() => {
          setHovered(true);
          onHover(station);
        }}
        onPointerOut={() => {
          setHovered(false);
          onLeave();
        }}
        onClick={onClick}
      >
        <meshStandardMaterial 
          color={station.color} 
          emissive={hovered || isHovered ? station.color : '#000000'}
          emissiveIntensity={hovered || isHovered ? 0.5 : 0}
          roughness={0.3}
          metalness={0.6}
        />
      </Box>

      {/* Table Legs */}
      {[[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]].map((pos, i) => (
        <Box key={`item-${i}`} args={[0.1, 0.7, 0.1]} position={[pos[0], 0.35, pos[1]]}>
          <meshStandardMaterial color={JAZZ_PALETTE.darkWood} roughness={0.8} />
        </Box>
      ))}

      {/* Spotlight above table */}
      <spotLight
        position={[0, 3, 0]}
        angle={0.4}
        penumbra={0.5}
        intensity={hovered || isHovered ? 2 : 1}
        color={JAZZ_PALETTE.dimLight}
        castShadow
      />

      {/* Table Name */}
      <Text
        position={[0, 1.5, 0]}
        fontSize={0.2}
        color={JAZZ_PALETTE.gold}
        anchorX="center"
        anchorY="middle"
        font="/fonts/Cinzel-Bold.ttf"
        outlineWidth={0.02}
        outlineColor="#000000"
      >
        {station.name}
      </Text>

      {/* Icon */}
      <Text
        position={[0, 0.85, 0]}
        fontSize={0.5}
        anchorX="center"
        anchorY="middle"
      >
        {station.icon}
      </Text>

      {/* Glow ring when hovered */}
      {(hovered || isHovered) && (
        <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.2, 1.4, 32]} />
          <meshBasicMaterial color={JAZZ_PALETTE.gold} transparent opacity={0.3} />
        </mesh>
      )}
    </group>
  );
}

// Player Avatar
function PlayerAvatar({ position }) {
  const meshRef = useRef<any>(null);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.position.y = 0.5 + Math.sin(state.clock.elapsedTime * 2) * 0.05;
    }
  });

  return (
    <group position={position}>
      <Sphere ref={meshRef} args={[0.3, 16, 16]} position={[0, 0.5, 0]}>
        <meshStandardMaterial color="#4a90e2" emissive="#2060c0" emissiveIntensity={0.3} />
      </Sphere>
      <Box args={[0.4, 0.6, 0.3]} position={[0, 0, 0]}>
        <meshStandardMaterial color="#2c3e50" />
      </Box>
    </group>
  );
}

// Jazz Club Scene
function JazzClubScene({ onTableSelect, hoveredTable, setHoveredTable, playerPosition, setPlayerPosition }) {
  const { camera } = useThree();
  
  // Reusable Vector3 for camera position to prevent memory leaks
  const targetCameraPosition = useRef(new THREE.Vector3());

  // Camera follows player at 110cm height (sitting presence)
  useFrame(() => {
    targetCameraPosition.current.set(
      playerPosition[0], 
      1.1, // 110cm "sitting at table" height (2026 Leader spec)
      playerPosition[2] + 3
    );
    camera.position.lerp(targetCameraPosition.current, 0.05);
    camera.lookAt(playerPosition[0], playerPosition[1] + 0.5, playerPosition[2]);
  });

  // Keyboard movement
  useEffect(() => {
    const keys = { w: false, a: false, s: false, d: false };
    
    const handleKeyDown = (e) => {
      const key = e.key.toLowerCase();
      if (keys.hasOwnProperty(key)) {
        keys[key] = true;
      }
    };

    const handleKeyUp = (e) => {
      const key = e.key.toLowerCase();
      if (keys.hasOwnProperty(key)) {
        keys[key] = false;
      }
    };

    const movePlayer = () => {
      setPlayerPosition((prev) => {
        let [x, y, z] = prev;
        const speed = 0.1;

        if (keys.w) z -= speed;
        if (keys.s) z += speed;
        if (keys.a) x -= speed;
        if (keys.d) x += speed;

        // Boundaries
        x = Math.max(-12, Math.min(12, x));
        z = Math.max(-8, Math.min(5, z));

        return [x, y, z];
      });
      requestAnimationFrame(movePlayer);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    const animationId = requestAnimationFrame(movePlayer);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      cancelAnimationFrame(animationId);
    };
  }, [setPlayerPosition]);

  return (
    <>
      {/* Ambient lighting */}
      <ambientLight intensity={0.1} />
      <pointLight position={[0, 5, 0]} intensity={0.3} color={JAZZ_PALETTE.dimLight} />

      {/* Floor */}
      <Box args={[30, 0.1, 20]} position={[0, -0.05, -2]} receiveShadow>
        <meshStandardMaterial 
          color={JAZZ_PALETTE.darkWood} 
          roughness={0.9}
          metalness={0.1}
        />
      </Box>

      {/* Back wall */}
      <Box args={[30, 8, 0.2]} position={[0, 4, -8]}>
        <meshStandardMaterial color={JAZZ_PALETTE.burgundy} roughness={0.8} />
      </Box>

      {/* Side walls */}
      <Box args={[0.2, 8, 20]} position={[-15, 4, -2]}>
        <meshStandardMaterial color={JAZZ_PALETTE.burgundy} roughness={0.8} />
      </Box>
      <Box args={[0.2, 8, 20]} position={[15, 4, -2]}>
        <meshStandardMaterial color={JAZZ_PALETTE.burgundy} roughness={0.8} />
      </Box>

      {/* Ceiling lights */}
      {[-8, -3, 3, 8].map((x, i) => (
        <pointLight
          key={`item-${i}`}
          position={[x, 6, -2]}
          intensity={0.5}
          color={JAZZ_PALETTE.dimLight}
          distance={8}
          decay={2}
        />
      ))}

      {/* Table Stations */}
      {TABLE_STATIONS.map((station) => (
        <TableStation
          key={station.id}
          station={station}
          onHover={setHoveredTable}
          onLeave={() => setHoveredTable(null)}
          onClick={() => onTableSelect(station)}
          isHovered={hoveredTable?.id === station.id}
        />
      ))}

      {/* Player Avatar */}
      <PlayerAvatar position={playerPosition} />

      {/* Environment */}
      <Environment preset="night" />
    </>
  );
}

// Main Lobby Component
export default function JazzClubLobby() {
  const navigate = useNavigate();
  const [hoveredTable, setHoveredTable] = useState(null);
  const [selectedTable, setSelectedTable] = useState(null);
  const [playerPosition, setPlayerPosition] = useState([0, 0, 0]);
  const [showInstructions, setShowInstructions] = useState(true);

  // Hide instructions after 5 seconds
  useEffect(() => {
    const timer = setTimeout(() => setShowInstructions(false), 5000);
    return () => clearTimeout(timer);
  }, []);

  const handleTableSelect = (station) => {
    setSelectedTable(station);
  };

  const handleJoinTable = () => {
    if (selectedTable) {
      navigate(selectedTable.route);
    }
  };

  return (
    <div className="fixed inset-0 bg-black">
      {/* Three.js Canvas with Volumetric Fog */}
      <Canvas
        shadows
        camera={{ position: [0, 3, 5], fov: 60 }}
        gl={{ antialias: true, alpha: false }}
        // @ts-expect-error — `fog` is a valid r3f Canvas prop via Scene but not typed on the Canvas wrapper.
        fog={new THREE.FogExp2(JAZZ_PALETTE.shadow, 0.018)}
      >
        <Suspense fallback={null}>
          <JazzClubScene
            onTableSelect={handleTableSelect}
            hoveredTable={hoveredTable}
            setHoveredTable={setHoveredTable}
            playerPosition={playerPosition}
            setPlayerPosition={setPlayerPosition}
          />
        </Suspense>
      </Canvas>

      {/* UI Overlay - Enhanced Glassmorphism */}
      <div className="fixed inset-0 pointer-events-none">
        {/* Header - Premium Glass Effect */}
        <div className="absolute top-4 left-4 right-4 flex justify-between items-center pointer-events-auto gap-4">
          <button
            onClick={() => navigate('/games')}
            className="backdrop-blur-2xl bg-gradient-to-br from-white/10 to-white/5 border border-amber-400/30 
              px-6 py-3 rounded-xl text-amber-200 hover:bg-white/15 hover:border-amber-400/50 
              transition-all duration-300 font-['Cinzel'] shadow-[0_0_20px_rgba(251,191,36,0.2)]
              hover:shadow-[0_0_30px_rgba(251,191,36,0.4)]"
          >
            ← Exit Lobby
          </button>

          <div className="backdrop-blur-2xl bg-gradient-to-br from-amber-900/20 to-amber-950/10 
            border border-amber-400/40 px-8 py-3 rounded-xl text-amber-100 font-['Cinzel'] text-xl
            shadow-[0_0_30px_rgba(251,191,36,0.3)] flex items-center gap-3">
            <span className="text-2xl">🎺</span>
            <span>Global Vibez Jazz Club</span>
          </div>

          <div className="backdrop-blur-2xl bg-gradient-to-br from-white/10 to-white/5 border border-cyan-400/30 
            px-6 py-3 rounded-xl text-cyan-200 font-['Cinzel'] text-sm
            shadow-[0_0_20px_rgba(34,211,238,0.2)]">
            <span className="text-cyan-400">●</span> Online: 1 Player
          </div>
        </div>

        {/* Instructions - Enhanced Glass */}
        <AnimatePresence>
          {showInstructions && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute top-24 left-1/2 -translate-x-1/2 backdrop-blur-2xl bg-gradient-to-br 
                from-white/10 to-white/5 border-2 border-amber-400/40 rounded-xl px-8 py-5 text-center 
                pointer-events-auto shadow-[0_0_40px_rgba(251,191,36,0.3)]"
            >
              <div className="text-amber-200 font-['Cinzel'] text-lg mb-3 flex items-center justify-center gap-2">
                <span className="text-2xl">🎹</span>
                Welcome to the Jazz Club
              </div>
              <div className="text-amber-300/90 text-sm flex items-center justify-center gap-2">
                <kbd className="px-3 py-2 bg-amber-900/30 backdrop-blur-sm rounded-lg border border-amber-600/30">W</kbd>
                <kbd className="px-3 py-2 bg-amber-900/30 backdrop-blur-sm rounded-lg border border-amber-600/30">A</kbd>
                <kbd className="px-3 py-2 bg-amber-900/30 backdrop-blur-sm rounded-lg border border-amber-600/30">S</kbd>
                <kbd className="px-3 py-2 bg-amber-900/30 backdrop-blur-sm rounded-lg border border-amber-600/30">D</kbd>
                <span className="ml-2">to move • Click tables to join</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Hovered Table Info - Premium Glass */}
        <AnimatePresence>
          {hoveredTable && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="absolute bottom-32 left-1/2 -translate-x-1/2 backdrop-blur-2xl bg-gradient-to-br 
                from-fuchsia-900/20 to-fuchsia-950/10 border-2 border-fuchsia-400/40 rounded-xl px-8 py-4 
                text-center pointer-events-auto shadow-[0_0_40px_rgba(232,121,249,0.4)]"
            >
              <div className="text-fuchsia-200 font-['Cinzel'] text-xl flex items-center justify-center gap-3">
                <span className="text-3xl">{hoveredTable.icon}</span>
                <span>{hoveredTable.name.replace('\n', ' ')}</span>
              </div>
              <div className="text-fuchsia-300/70 text-sm mt-2">
                Click to join table
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Selected Table - Join Modal */}
        <AnimatePresence>
          {selectedTable && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center pointer-events-auto"
              onClick={() => setSelectedTable(null)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-gradient-to-br from-black via-amber-950/20 to-black border-2 border-amber-600
                  rounded-lg p-8 max-w-md w-full mx-4"
              >
                <div className="text-center mb-6">
                  <div className="text-6xl mb-4">{selectedTable.icon}</div>
                  <h2 className="text-amber-200 font-['Cinzel'] text-2xl mb-2">
                    {selectedTable.name.replace('\n', ' ')}
                  </h2>
                  <p className="text-amber-400/60 text-sm">
                    Ready to join this table?
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setSelectedTable(null)}
                    className="flex-1 bg-black/60 border border-amber-600/40 text-amber-200 py-3 rounded-lg
                      hover:bg-black/80 transition-all font-['Cinzel']"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleJoinTable}
                    className="flex-1 bg-gradient-to-r from-amber-600 to-amber-700 text-white py-3 rounded-lg
                      hover:from-amber-500 hover:to-amber-600 transition-all font-['Cinzel'] font-bold"
                  >
                    Join Table
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Controls Guide - Subtle Glass */}
        <div className="absolute bottom-4 left-4 backdrop-blur-2xl bg-white/5 border border-white/10
          px-5 py-3 rounded-xl text-white/50 text-xs font-['Cinzel'] pointer-events-auto">
          <div>WASD - Move</div>
          <div>Click - Select Table</div>
          <div>ESC - Exit Lobby</div>
        </div>
      </div>
    </div>
  );
}
