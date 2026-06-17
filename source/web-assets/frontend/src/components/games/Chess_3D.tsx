
import React, { useState, useRef, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Html } from '@react-three/drei';
import * as THREE from 'three';

// Chess Piece 3D
function ChessPiece({ position, piece, isSelected, onClick, canMove }) {
  const meshRef = useRef<any>(null);
  const [hovered, setHovered] = useState(false);

  useFrame((state) => {
    if (meshRef.current) {
      if (isSelected) {
        meshRef.current.position.y = Math.sin(state.clock.elapsedTime * 3) * 0.2 + 1;
      }
      
      if (hovered && !isSelected) {
        meshRef.current.scale.lerp(new THREE.Vector3(1.2, 1.2, 1.2), 0.1);
      } else if (!isSelected) {
        meshRef.current.scale.lerp(new THREE.Vector3(1, 1, 1), 0.1);
      }
    }
  });

  if (!piece) return null;

  const isWhite = piece === piece.toUpperCase();
  const pieceColor = isWhite ? '#f0f0f0' : '#1a1a1a';
  const emissiveColor = isWhite ? '#ffffff' : '#444444';

  // Map piece types to shapes
  const getPieceGeometry = () => {
    const type = piece.toLowerCase();
    switch (type) {
      case 'k': return <coneGeometry args={[0.3, 1, 4]} />; // King - square pyramid
      case 'q': return <coneGeometry args={[0.35, 0.9, 8]} />; // Queen - octagonal
      case 'r': return <boxGeometry args={[0.5, 0.8, 0.5]} />; // Rook - castle
      case 'b': return <coneGeometry args={[0.25, 1, 3]} />; // Bishop - triangle
      case 'n': return <dodecahedronGeometry args={[0.3]} />; // Knight - unique
      case 'p': return <sphereGeometry args={[0.25, 16, 16]} />; // Pawn - sphere
      default: return <sphereGeometry args={[0.2]} />;
    }
  };

  return (
    <mesh
      ref={meshRef}
      position={[position[0], isSelected ? 1 : 0.5, position[1]]}
      onClick={(e) => {
        e.stopPropagation();
        onClick && onClick();
      }}
      onPointerEnter={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerLeave={(e) => {
        e.stopPropagation();
        setHovered(false);
      }}
    >
      {getPieceGeometry()}
      <meshStandardMaterial
        color={pieceColor}
        metalness={0.7}
        roughness={0.3}
        emissive={isSelected ? '#fbbf24' : emissiveColor}
        emissiveIntensity={isSelected ? 0.5 : 0.2}
      />
      
      {/* Piece label using Html */}
      <Html position={[0, 1, 0]} center>
        <div style={{
          color: isWhite ? '#ffffff' : '#000000',
          fontSize: '14px',
          fontWeight: 'bold',
          textShadow: '0 0 5px rgba(0,0,0,0.5)',
          pointerEvents: 'none'
        }}>
          {piece.toUpperCase()}
        </div>
      </Html>
    </mesh>
  );
}

// Chess Board 3D
function ChessBoard3D({ board, selectedSquare, possibleMoves, onSquareClick, hoveredSquare, setHoveredSquare }) {
  const boardRef = useRef<any>(null);

  useFrame((state) => {
    if (boardRef.current) {
      boardRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.15) * 0.03;
    }
  });

  return (
    <group ref={boardRef}>
      {/* Board base */}
      <mesh position={[0, -0.2, 0]} receiveShadow>
        <boxGeometry args={[9, 0.3, 9]} />
        <meshStandardMaterial color="#8B4513" metalness={0.4} roughness={0.6} />
      </mesh>

      {/* Squares */}
      {board.map((row, rowIndex) =>
        row.map((piece, colIndex) => {
          const x = (colIndex - 3.5);
          const z = (rowIndex - 3.5);
          const isLight = (rowIndex + colIndex) % 2 === 0;
          const isSelected = selectedSquare && selectedSquare[0] === rowIndex && selectedSquare[1] === colIndex;
          const isPossibleMove = possibleMoves.some(([r, c]) => r === rowIndex && c === colIndex);
          const isHovered = hoveredSquare && hoveredSquare[0] === rowIndex && hoveredSquare[1] === colIndex;

          return (
            <group key={`${rowIndex}-${colIndex}`}>
              {/* Square */}
              <mesh
                position={[x, 0, z]}
                receiveShadow
                onClick={(e) => {
                  e.stopPropagation();
                  onSquareClick(rowIndex, colIndex);
                }}
                onPointerEnter={(e) => {
                  e.stopPropagation();
                  setHoveredSquare([rowIndex, colIndex]);
                }}
                onPointerLeave={(e) => {
                  e.stopPropagation();
                  setHoveredSquare(null);
                }}
              >
                <boxGeometry args={[0.95, 0.1, 0.95]} />
                <meshStandardMaterial
                  color={
                    isSelected ? '#fbbf24' :
                    isPossibleMove ? '#22c55e' :
                    isHovered ? '#60a5fa' :
                    isLight ? '#f5f5f5' : '#374151'
                  }
                  metalness={0.2}
                  roughness={0.7}
                  emissive={isSelected || isPossibleMove || isHovered ? '#ffffff' : '#000000'}
                  emissiveIntensity={isSelected ? 0.3 : isPossibleMove ? 0.2 : isHovered ? 0.1 : 0}
                />
              </mesh>

              {/* Piece */}
              {piece && (
                <ChessPiece
                  position={[x, z]}
                  piece={piece}
                  isSelected={isSelected}
                  onClick={() => onSquareClick(rowIndex, colIndex)}
                  canMove={isPossibleMove}
                />
              )}

              {/* Possible move indicator */}
              {isPossibleMove && !piece && (
                <mesh position={[x, 0.15, z]}>
                  <cylinderGeometry args={[0.15, 0.15, 0.05, 16]} />
                  <meshStandardMaterial
                    color="#22c55e"
                    transparent
                    opacity={0.6}
                    emissive="#22c55e"
                    emissiveIntensity={0.5}
                  />
                </mesh>
              )}
            </group>
          );
        })
      )}

      {/* Board labels */}
      {['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((letter, i) => (
        <Html key={`col-${i}`} position={[(i - 3.5), -0.4, 4.2]} center>
          <div style={{ color: '#ffffff', fontSize: '12px', pointerEvents: 'none' }}>
            {letter}
          </div>
        </Html>
      ))}
      {['8', '7', '6', '5', '4', '3', '2', '1'].map((num, i) => (
        <Html key={`row-${i}`} position={[-4.2, -0.4, (i - 3.5)]} center>
          <div style={{ color: '#ffffff', fontSize: '12px', pointerEvents: 'none' }}>
            {num}
          </div>
        </Html>
      ))}
    </group>
  );
}

// Main Chess 3D Component
export default function Chess_3D({ gameState, onMove, currentUserId }) {
  const board = gameState.state.board;
  const currentPlayer = gameState.players.find(p => p.user_id === currentUserId);
  const isMyTurn = gameState.current_turn === currentUserId;
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [possibleMoves, setPossibleMoves] = useState([]);
  const [hoveredSquare, setHoveredSquare] = useState(null);
  const isGameOver = gameState.status === 'completed';

  const handleSquareClick = (row, col) => {
    if (!isMyTurn) return;

    const piece = board[row][col];

    // If clicking a possible move
    if (selectedSquare && possibleMoves.some(([r, c]) => r === row && c === col)) {
      onMove({
        from: selectedSquare,
        to: [row, col]
      });
      setSelectedSquare(null);
      setPossibleMoves([]);
      return;
    }

    // If clicking own piece
    if (piece && ((currentPlayer.color === 'white' && piece === piece.toUpperCase()) ||
                   (currentPlayer.color === 'black' && piece === piece.toLowerCase()))) {
      setSelectedSquare([row, col]);
      // Calculate possible moves (simplified - in real game, fetch from backend)
      const moves = calculatePossibleMoves(board, row, col, piece);
      setPossibleMoves(moves);
    } else {
      setSelectedSquare(null);
      setPossibleMoves([]);
    }
  };

  // Simplified move calculation (for UI purposes)
  const calculatePossibleMoves = (board, row, col, piece) => {
    const moves = [];
    const directions = {
      'p': [[1, 0], [2, 0]], // Pawn (simplified)
      'r': [[0, 1], [0, -1], [1, 0], [-1, 0]], // Rook
      'n': [[2, 1], [2, -1], [-2, 1], [-2, -1], [1, 2], [1, -2], [-1, 2], [-1, -2]], // Knight
      'b': [[1, 1], [1, -1], [-1, 1], [-1, -1]], // Bishop
      'q': [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]], // Queen
      'k': [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]], // King
    };

    const pieceType = piece.toLowerCase();
    const dirs = directions[pieceType] || [];

    dirs.forEach(([dr, dc]) => {
      const newRow = row + dr;
      const newCol = col + dc;
      if (newRow >= 0 && newRow < 8 && newCol >= 0 && newCol < 8) {
        moves.push([newRow, newCol]);
      }
    });

    return moves;
  };

  return (
    <div className="w-full h-full flex flex-col items-center justify-center">
      {/* Game info */}
      <div className="mb-4 text-center">
        <h2 className="text-4xl font-bold text-white mb-2">Chess - 3D</h2>
        <p className="text-xl text-purple-200">
          {isMyTurn ? `Your turn (${currentPlayer?.color})` : "Opponent's turn"}
        </p>
      </div>

      {/* 3D Canvas */}
      <div className="w-full max-w-5xl h-[700px] bg-gradient-to-br from-purple-900/50 to-blue-900/50 rounded-3xl overflow-hidden">
        <Canvas shadows style={{ background: "#0b0418" }}>
          <Suspense fallback={null}>
            <PerspectiveCamera makeDefault position={[0, 12, 12]} />
            
            {/* Lighting */}
            <ambientLight intensity={0.4} />
            <directionalLight
              position={[10, 15, 5]}
              intensity={1}
              castShadow
              shadow-mapSize-width={2048}
              shadow-mapSize-height={2048}
            />
            <pointLight position={[-5, 5, 5]} intensity={0.5} color="#ec4899" />
            <pointLight position={[5, 5, -5]} intensity={0.5} color="#8b5cf6" />

            {/* Chess Board */}
            <ChessBoard3D
              board={board}
              selectedSquare={selectedSquare}
              possibleMoves={possibleMoves}
              onSquareClick={handleSquareClick}
              hoveredSquare={hoveredSquare}
              setHoveredSquare={setHoveredSquare}
            />

            {/* Soft fog backdrop — replaces Environment preset (which requires
                HDR CDN fetch and crashed on first-paint). Looks great without
                the external asset dependency. */}
            <fog attach="fog" args={["#1a0b2e", 15, 50]} />
            
            {/* Controls */}
            <OrbitControls
              enablePan={false}
              enableZoom={true}
              minDistance={10}
              maxDistance={25}
              minPolarAngle={Math.PI / 6}
              maxPolarAngle={Math.PI / 2.5}
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

      {/* Instructions */}
      <div className="mt-4 text-sm text-purple-200 text-center">
        Click a piece to select it, then click a highlighted square to move
      </div>
    </div>
  );
}
