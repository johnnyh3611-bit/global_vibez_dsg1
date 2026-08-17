
import React, { useState, useRef, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';

// 3D Board Component
function Board3D({ board, onMove, isMyTurn, currentPlayerColor, hoveredCol, setHoveredCol }) {
  const boardRef = useRef<any>(null);

  useFrame((state) => {
    if (boardRef.current) {
      boardRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.2) * 0.05;
    }
  });

  return (
    <group ref={boardRef}>
      {/* Board frame */}
      <mesh position={[0, 0, -0.5]}>
        <boxGeometry args={[8, 7, 1]} />
        <meshStandardMaterial 
          color="#1e3a8a" 
          metalness={0.6}
          roughness={0.2}
        />
      </mesh>

      {/* Slots */}
      {board.map((row, rowIndex) =>
        row.map((cell, colIndex) => {
          const x = (colIndex - 3) * 1.1;
          const y = (2.5 - rowIndex) * 1.1;
          
          return (
            <Disc
              key={`${rowIndex}-${colIndex}`}
              position={[x, y, 0]}
              color={cell === 'red' ? '#ef4444' : cell === 'yellow' ? '#facc15' : '#94a3b8'}
              isEmpty={cell === null}
              isHovered={isMyTurn && hoveredCol === colIndex}
              onPointerEnter={() => isMyTurn && setHoveredCol(colIndex)}
              onPointerLeave={() => setHoveredCol(null)}
              onClick={() => isMyTurn && cell === null && onMove({ col: colIndex })}
            />
          );
        })
      )}

      {/* Hover preview */}
      {isMyTurn && hoveredCol !== null && (
        <mesh position={[(hoveredCol - 3) * 1.1, 4.5, 0]}>
          <cylinderGeometry args={[0.4, 0.4, 0.3, 32]} />
          <meshStandardMaterial 
            color={currentPlayerColor === 'red' ? '#ef4444' : '#facc15'}
            transparent
            opacity={0.6}
            emissive={currentPlayerColor === 'red' ? '#ef4444' : '#facc15'}
            emissiveIntensity={0.5}
          />
        </mesh>
      )}
    </group>
  );
}

// Disc Component with animations
function Disc({ position, color, isEmpty, isHovered, onPointerEnter, onPointerLeave, onClick }) {
  const meshRef = useRef<any>(null);
  const [hovered, setHovered] = useState(false);

  useFrame((state) => {
    if (meshRef.current && !isEmpty) {
      meshRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 2 + position[0]) * 0.1;
    }
    
    if (meshRef.current && (hovered || isHovered)) {
      meshRef.current.scale.lerp(new THREE.Vector3(1.15, 1.15, 1.15), 0.1);
    } else if (meshRef.current) {
      meshRef.current.scale.lerp(new THREE.Vector3(1, 1, 1), 0.1);
    }
  });

  return (
    <mesh
      ref={meshRef}
      position={position}
      onPointerEnter={(e) => {
        e.stopPropagation();
        setHovered(true);
        onPointerEnter && onPointerEnter();
      }}
      onPointerLeave={(e) => {
        e.stopPropagation();
        setHovered(false);
        onPointerLeave && onPointerLeave();
      }}
      onClick={(e) => {
        e.stopPropagation();
        onClick && onClick();
      }}
    >
      <cylinderGeometry args={[0.45, 0.45, 0.3, 32]} />
      <meshStandardMaterial
        color={color}
        metalness={isEmpty ? 0.1 : 0.8}
        roughness={isEmpty ? 0.8 : 0.2}
        transparent={isEmpty}
        opacity={isEmpty ? 0.2 : 1}
        emissive={!isEmpty ? color : '#000000'}
        emissiveIntensity={isEmpty ? 0 : 0.3}
      />
    </mesh>
  );
}

// Particle effects for winning
function Particles({ show }) {
  const particlesRef = useRef<any>(null);
  const particleCount = 100;
  const positions = new Float32Array(particleCount * 3);

  for (let i = 0; i < particleCount; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 20;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 20;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 10;
  }

  useFrame((state) => {
    if (particlesRef.current && show) {
      particlesRef.current.rotation.y = state.clock.elapsedTime * 0.2;
    }
  });

  if (!show) return null;

  return (
    <points ref={particlesRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={particleCount}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.2}
        color="#fbbf24"
        transparent
        opacity={0.8}
        sizeAttenuation
      />
    </points>
  );
}

// Main Connect 4 3D Component
export default function Connect4_3D({ gameState, onMove, currentUserId }) {
  const board = gameState.state.board;
  const currentPlayer = gameState.players.find(p => p.user_id === currentUserId);
  const isMyTurn = gameState.current_turn === currentUserId;
  const [hoveredCol, setHoveredCol] = useState(null);
  const isGameOver = gameState.status === 'completed';

  return (
    <div className="w-full h-full flex flex-col items-center justify-center">
      {/* Game info */}
      <div className="mb-4 text-center">
        <h2 className="text-4xl font-bold text-white mb-2">Connect 4 - 3D</h2>
        <p className="text-xl text-purple-200">
          {isMyTurn ? `Your turn (${currentPlayer.role})` : "Opponent's turn"}
        </p>
      </div>

      {/* 3D Canvas */}
      <div className="w-full max-w-4xl h-[600px] bg-gradient-to-br from-purple-900/50 to-pink-900/50 rounded-3xl overflow-hidden">
        <Canvas shadows>
          <Suspense fallback={null}>
            <PerspectiveCamera makeDefault position={[0, 0, 15]} />
            
            {/* Lighting */}
            <ambientLight intensity={0.3} />
            <pointLight position={[10, 10, 10]} intensity={1} castShadow />
            <pointLight position={[-10, -10, 5]} intensity={0.5} color="#ec4899" />
            <spotLight
              position={[0, 10, 8]}
              angle={0.5}
              penumbra={1}
              intensity={1}
              castShadow
              color="#fbbf24"
            />

            {/* Board */}
            <Board3D
              board={board}
              onMove={onMove}
              isMyTurn={isMyTurn}
              currentPlayerColor={currentPlayer?.role}
              hoveredCol={hoveredCol}
              setHoveredCol={setHoveredCol}
            />

            {/* Particles for winning */}
            <Particles show={isGameOver} />

            {/* Environment */}
            <Environment preset="city" />
            
            {/* Controls */}
            <OrbitControls
              enablePan={false}
              enableZoom={true}
              minDistance={10}
              maxDistance={20}
              minPolarAngle={Math.PI / 4}
              maxPolarAngle={Math.PI / 2}
            />
          </Suspense>
        </Canvas>
      </div>

      {/* Game result */}
      {isGameOver && (
        <div className="mt-6 text-2xl font-bold text-white bg-gradient-to-r from-purple-500 to-pink-500 px-8 py-4 rounded-full animate-pulse">
          {gameState.winner === 'draw' ? '🤝 Draw!' : 
           gameState.winner === currentUserId ? '🎉 You Won!' : '😔 You Lost'}
        </div>
      )}
    </div>
  );
}
