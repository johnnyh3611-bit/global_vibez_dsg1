
import React, { useState, useEffect, useRef } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { motion, AnimatePresence } from 'framer-motion';
import { CinematicCelebration } from '@/components/CinematicCelebration';
import { useWindowSize } from 'react-use';
import { BoardGameLayout, BoardStatBadge } from './BoardGameLayout';
import { AIOpponentCard } from '@/components/AIOpponentCard';
import { getRandomOpponent } from '@/data/aiOpponents';
import HoloPiece from '@/components/games/HoloBoard/HoloPiece';

import cardSoundManager from '@/utils/cardSoundManager';
import ParticleEffectsOverlay from '@/components/ParticleEffectsOverlay';
import PracticeChessBattleMode from './PracticeChessBattleMode';

export function PracticeChess({ game, onMove, makingMove, aiThinking }: { game?: any, onMove?: any, makingMove?: any, aiThinking?: any }) {
  const [fen, setFen] = useState('start');
  const [gameResult, setGameResult] = useState(null);
  const [lastMove, setLastMove] = useState(null);
  const [capturedPieces, setCapturedPieces] = useState({ white: [], black: [] });
  const [piecesRemaining, setPiecesRemaining] = useState({ white: 16, black: 16 });
  const [aiOpponent, setAiOpponent] = useState(null);
  const [particleTrigger, setParticleTrigger] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);
  // 2-way view mode: 'classic' | 'battle'. Persisted in localStorage.
  // NOTE: The 3D "Neon Arena" variant is parked until the app-wide R3F crash
  // (`applyProps$1 → Array.reduce → 'file'`, affects poker_3d / chess_3d / VR
  // alike) is resolved via a React 19 + R3F v9 migration. The Battle Mode
  // below now bakes in the user-supplied visual DNA (reflective floor,
  // starfield backdrop, neon cross-glow) as a 2D facade.
  const [viewMode, setViewMode] = useState<'classic' | 'battle'>(() => {
    try {
      const saved = localStorage.getItem('chess_view_mode');
      if (saved === 'classic' || saved === 'battle') return saved;
      return localStorage.getItem('chess_battle_mode') === 'true' ? 'battle' : 'classic';
    } catch { return 'classic'; }
  });
  const battleMode = viewMode === 'battle';
  const chessRef = useRef(null);

  // Initialize chess instance
  useEffect(() => {
    if (!chessRef.current) {
      chessRef.current = new Chess();
      // Prime the piece counts so the badge never shows 0 at game start.
      updateCapturedPieces();
    }
    if (!aiOpponent) {
      setAiOpponent(getRandomOpponent());
    }
  }, []);

  // Sync FEN from game state
  useEffect(() => {
    if (game.game_state?.fen && chessRef.current) {
      const gameFen = game.game_state.fen;
      const currentFen = chessRef.current.fen();
      
      if (gameFen !== currentFen) {
        try {
          chessRef.current.load(gameFen);
          setFen(gameFen);
          updateCapturedPieces();
        } catch (e) {
          // console.error('[Chess] Failed to load FEN:', e);
        }
      }
    }
  }, [game.game_state?.fen]);

  // Check for game completion
  useEffect(() => {
    if (game.status === 'completed' && chessRef.current) {
      if (chessRef.current.isCheckmate()) {
        const winner = game.winner === 'player' ? 'You' : 'AI';
        if (game.winner === 'player') {
          cardSoundManager.playWinSound(); // AAA Card Juice - Win sound
          setShowConfetti(true);
          setTimeout(() => setShowConfetti(false), 3000);
        } else {
          cardSoundManager.playLoseSound(); // AAA Card Juice - Lose sound
        }
        setGameResult({ type: game.winner, message: `Checkmate! ${winner} Win! 👑` });
      } else if (chessRef.current.isDraw()) {
        cardSoundManager.playCardFlip(); // AAA Card Juice - Draw sound
        setGameResult({ type: 'draw', message: 'Draw! 🤝' });
      } else if (chessRef.current.isStalemate()) {
        cardSoundManager.playCardFlip(); // AAA Card Juice - Stalemate sound
        setGameResult({ type: 'draw', message: 'Stalemate! 🤝' });
      }
    }
  }, [game.status, game.winner]);

  // Update captured pieces
  const updateCapturedPieces = () => {
    if (!chessRef.current) return;
    
    const board = chessRef.current.board();
    const pieces = { w: [], b: [] };
    const captured = { white: [], black: [] };
    
    // Count pieces on board
    board.flat().forEach(square => {
      if (square) {
        pieces[square.color].push(square.type);
      }
    });
    
    // Calculate captured (starting pieces - current pieces)
    const startingPieces = { p: 8, n: 2, b: 2, r: 2, q: 1 };
    
    ['p', 'n', 'b', 'r', 'q'].forEach(type => {
      const whiteCaptured = startingPieces[type] - pieces.w.filter(p => p === type).length;
      const blackCaptured = startingPieces[type] - pieces.b.filter(p => p === type).length;
      
      for (let i = 0; i < blackCaptured; i++) {
        captured.white.push(type); // White captured black pieces
      }
      for (let i = 0; i < whiteCaptured; i++) {
        captured.black.push(type); // Black captured white pieces
      }
    });
    
    // AAA Card Juice - Play capture sound if pieces were captured
    const totalCaptured = captured.white.length + captured.black.length;
    const prevTotalCaptured = capturedPieces.white.length + capturedPieces.black.length;
    if (totalCaptured > prevTotalCaptured) {
      cardSoundManager.playCardSlam(); // Piece capture sound
      setParticleTrigger(prev => prev + 1); // Trigger particle effect
    }
    
    setCapturedPieces(captured);
    // Remaining pieces on the board (kings included) — drives "Your Pieces" badge.
    setPiecesRemaining({ white: pieces.w.length, black: pieces.b.length });
  };

  // Handle piece drop
  const handleDrop = (sourceSquare, targetSquare) => {
    if (!chessRef.current || makingMove || aiThinking || game.status === 'completed') {
      return false;
    }

    try {
      const move = chessRef.current.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: 'q'
      });

      if (move === null) {
        return false;
      }

      // Update state
      const newFen = chessRef.current.fen();
      setFen(newFen);
      setLastMove({ from: sourceSquare, to: targetSquare });
      updateCapturedPieces();

      // AAA Card Juice - Play move sound
      cardSoundManager.playCardFlip();

      // Send to backend
      onMove({
        from: sourceSquare,
        to: targetSquare,
        fen: newFen
      });

      return true;
    } catch (error) {
      // console.error('[Chess] Move error:', error);
      return false;
    }
  };

  // Custom square styles
  const getCustomSquareStyles = () => {
    const styles = {};
    
    // Highlight last move (yellow)
    if (lastMove) {
      styles[lastMove.from] = {
        backgroundColor: 'rgba(255, 255, 0, 0.4)',
        boxShadow: 'inset 0 0 8px rgba(255, 255, 0, 0.6)'
      };
      styles[lastMove.to] = {
        backgroundColor: 'rgba(255, 255, 0, 0.5)',
        boxShadow: 'inset 0 0 12px rgba(255, 255, 0, 0.8)'
      };
    }
    
    // Highlight check (red glow)
    if (chessRef.current && chessRef.current.inCheck()) {
      const turn = chessRef.current.turn();
      const board = chessRef.current.board();
      
      for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
          const piece = board[i][j];
          if (piece && piece.type === 'k' && piece.color === turn) {
            const file = String.fromCharCode(97 + j);
            const rank = 8 - i;
            const square = `${file}${rank}`;
            styles[square] = {
              backgroundColor: 'rgba(255, 0, 0, 0.5)',
              boxShadow: 'inset 0 0 20px rgba(255, 0, 0, 1), 0 0 15px rgba(255, 0, 0, 0.8)'
            };
          }
        }
      }
    }
    
    return styles;
  };

  const { width, height } = useWindowSize();
  const pieceSymbols = {
    p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚'
  };

  const gameOver = game.status === 'completed';
  const isDraggable = game.current_turn === 'player' && !gameOver && !makingMove && !aiThinking;
  const playerWon = gameOver && game.winner === 'player';

  // Calculate player scores (captured pieces count)
  const playerScore = capturedPieces.white.length;
  const aiScore = capturedPieces.black.length;

  return (
    <>
      {/* AAA Card Juice - Particle Effects */}
      <ParticleEffectsOverlay triggerSparkle={particleTrigger} />
      
      {/* Confetti on win */}
      <AnimatePresence>
        {showConfetti && gameResult && gameResult.type === 'player' && (
          // @ts-expect-error — CinematicCelebration v2 added onRestart/onContinue; this legacy call site only uses it for display on win.
          <CinematicCelebration 
            result="win"
            message={gameResult.message}
            opponentName={aiOpponent?.name || 'AI'}
            playerScore={playerScore}
            opponentScore={aiScore}
            coinsEarned={100}
          />
        )}
      </AnimatePresence>
      
      {/* Cinematic Celebration */}
      <AnimatePresence>
        {gameResult && !showConfetti && (
          <CinematicCelebration
            result={gameResult.type}
            message={gameResult.message}
            opponentName={aiOpponent?.name || 'AI'}
            playerScore={playerScore}
            opponentScore={aiScore}
            coinsEarned={gameResult.type === 'win' ? 100 : 0}
            onRestart={() => window.location.reload()}
            onContinue={() => window.history.back()}
          />
        )}
      </AnimatePresence>

      {/* BOARD GAME LAYOUT */}
      <BoardGameLayout
        topLeftStat={
          <BoardStatBadge 
            label="Your Pieces" 
            value={piecesRemaining.white}
            icon="♙"
            color="yellow"
          />
        }
        
        topRightStat={
          <AIOpponentCard opponent={aiOpponent} compact={true} />
        }
        
        gameTitle={
          <div className="flex items-center gap-3 flex-wrap justify-center">
            <motion.div
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="inline-block bg-black/60 backdrop-blur-md px-8 py-3 rounded-full border-4 border-amber-500"
              style={{ boxShadow: '0 0 40px rgba(245, 158, 11, 0.8)' }}
            >
              <p className="text-3xl font-black text-transparent bg-gradient-to-r from-amber-300 via-yellow-300 to-amber-300 bg-clip-text">
                CHESS ♚
              </p>
            </motion.div>
            <div
              className="flex gap-1 p-1 rounded-full bg-black/60 border-2 border-amber-500/40"
              data-testid="chess-view-mode-picker"
            >
              {([
                { key: 'classic', label: 'Classic', emoji: '♟️' },
                { key: 'battle', label: 'Neon Arena', emoji: '✨' },
              ] as const).map((m) => (
                <button
                  key={m.key}
                  onClick={() => {
                    setViewMode(m.key);
                    try { localStorage.setItem('chess_view_mode', m.key); } catch {/* ignore */}
                  }}
                  data-testid={`chess-view-${m.key}`}
                  aria-pressed={viewMode === m.key}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-black italic uppercase tracking-widest transition-all ${
                    viewMode === m.key
                      ? 'bg-gradient-to-r from-fuchsia-500 to-cyan-400 text-black shadow-lg shadow-fuchsia-500/40'
                      : 'text-amber-200 hover:bg-white/5'
                  }`}
                >
                  {m.emoji} {m.label}
                </button>
              ))}
            </div>
          </div>
        }
        
        gameBoard={
          battleMode ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-full"
              data-testid="chess-battle-mode-wrapper"
            >
              <PracticeChessBattleMode
                chessInstance={chessRef.current}
                isMyTurn={game.current_turn === 'player'}
                gameStatus={game.status}
                winner={game.winner}
                makingMove={makingMove}
                aiThinking={aiThinking}
                getCustomSquareStyles={getCustomSquareStyles}
                isDraggable={isDraggable}
                onMove={({ from, to }) => {
                  const ok = handleDrop(from, to);
                  return !!ok;
                }}
              />
            </motion.div>
          ) : (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="rounded-3xl overflow-hidden p-2"
            style={{
              /* Cyber-Casino chess room (Revolutionary Games Blueprint
                 v1, May 2026). Translucent floating board with cyan
                 glow + dark glass squares. */
              background:
                'linear-gradient(135deg, rgba(40, 50, 90, 0.85) 0%, rgba(15, 20, 40, 0.95) 100%)',
              boxShadow:
                '0 0 60px rgba(34, 211, 238, 0.25), inset 0 0 24px rgba(34, 211, 238, 0.15)',
              border: '1px solid rgba(34, 211, 238, 0.3)',
              padding: '18px',
            }}
          >
            {/* react-chessboard v5 tightened some style props to a Pick<>; cast to any during UI ship. */}
            {(() => {
              const ChessboardAny = Chessboard as any;
              // Holographic Solid-Light piece set — every piece glows
              // and pulses; uses HoloPiece glyphs for the unicode chess
              // symbols. White pieces get warm gold glow, black pieces
              // get cool cyan glow per the Revolutionary Games spec.
              const HOLOPIECE_MAP: Record<string, string> = {
                wK: '♚', wQ: '♛', wR: '♜', wB: '♝', wN: '♞', wP: '♟',
                bK: '♚', bQ: '♛', bR: '♜', bB: '♝', bN: '♞', bP: '♟',
              };
              const customPieces: Record<string, (props: { squareWidth: number }) => React.ReactNode> = {};
              Object.keys(HOLOPIECE_MAP).forEach((pieceKey) => {
                const isWhite = pieceKey.startsWith('w');
                const glyph = HOLOPIECE_MAP[pieceKey];
                customPieces[pieceKey] = ({ squareWidth }: { squareWidth: number }) => (
                  <div
                    style={{
                      width: squareWidth,
                      height: squareWidth,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      pointerEvents: 'none',
                    }}
                  >
                    <HoloPiece
                      color={isWhite ? 'white' : 'black'}
                      glyph={glyph}
                      size={Math.round(squareWidth * 0.85)}
                    />
                  </div>
                );
              });
              return (
                <ChessboardAny
                  position={fen}
                  onPieceDrop={handleDrop}
                  boardWidth={Math.min(600, window.innerWidth - 100)}
                  customBoardStyle={{
                    borderRadius: '8px',
                    boxShadow: '0 0 32px rgba(34, 211, 238, 0.25), inset 0 0 16px rgba(0,0,0,0.6)',
                  }}
                  customDarkSquareStyle={{
                    background: 'linear-gradient(135deg, rgba(20, 30, 60, 0.92) 0%, rgba(40, 50, 90, 0.82) 100%)',
                    boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.5), inset 0 -1px 1px rgba(255,255,255,0.05)',
                  }}
                  customLightSquareStyle={{
                    background: 'linear-gradient(135deg, rgba(220, 228, 255, 0.18) 0%, rgba(180, 200, 240, 0.10) 100%)',
                    boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.18), inset 0 -1px 1px rgba(0,0,0,0.3)',
                  }}
                  customSquareStyles={getCustomSquareStyles()}
                  customPieces={customPieces}
                  arePiecesDraggable={isDraggable}
                  boardOrientation="white"
                  customDarkSquareClassName="chess-dark-square"
                  customLightSquareClassName="chess-light-square"
                />
              );
            })()}
          </motion.div>
          )
        }
        
        bottomActions={
          !gameOver && (
            <div className="text-center space-y-2">
              <motion.p
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="text-amber-400 font-bold text-lg flex items-center justify-center gap-2"
              >
                {game.current_turn === 'player' ? (
                  <>
                    <span className="w-3 h-3 bg-green-400 rounded-full animate-pulse" />
                    ♙ Your Turn - Drag Pieces
                  </>
                ) : (
                  <>
                    <motion.span 
                      animate={{ rotate: 360 }}
                      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    >
                      🤖
                    </motion.span>
                    AI Thinking...
                  </>
                )}
              </motion.p>
              
              {chessRef.current && chessRef.current.inCheck() && (
                <motion.p 
                  initial={{ scale: 0 }}
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ repeat: Infinity, duration: 1 }}
                  className="text-red-400 font-bold text-sm"
                >
                  ⚠️ CHECK! ⚠️
                </motion.p>
              )}
            </div>
          )
        }
      />
      {/* AAA Card Juice - Particle Effects */}

      <ParticleEffectsOverlay />

    </>
  );
}
