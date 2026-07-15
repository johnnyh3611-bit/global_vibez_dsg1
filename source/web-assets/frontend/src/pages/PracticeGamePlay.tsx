import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Brain, Trophy, ArrowLeft, RotateCcw, Gamepad2 } from 'lucide-react';
import { BrandedGameLayout } from '@/components/games/BrandedGameLayout';
import { ModernCard } from '@/components/games/ModernCard';
import { VictoryAnimation } from '@/components/games/VictoryAnimation';
import { GameParticles } from '@/components/games/GameParticles';
import { LudoBoard } from '@/components/games/LudoBoard';
import { motion } from 'framer-motion';
import BackButton from '@/components/BackButton';
import * as PracticeGames from '@/components/practice_games';
import PracticeBowling from '@/components/practice_games/PracticeBowling';
import ComingSoonOverlay from '@/components/games/ComingSoonOverlay';
import { isComingSoon } from '@/data/comingSoonGames';
import { getGameById, getGameName as getRegisteredGameName } from '@/data/gamesRegistry';
import { authFetch } from '@/utils/secureAuth';

const API = process.env.REACT_APP_BACKEND_URL;

export default function PracticeGamePlay() {
  const { gameId: rawGameId } = useParams();
  const gameId = (rawGameId ?? '').toLowerCase();
  const navigate = useNavigate();
  const [game, setGame] = useState(null);
  const [loading, setLoading] = useState(true);
  const [makingMove, setMakingMove] = useState(false);
  const [aiThinking, setAiThinking] = useState(false);
  const [showVictory, setShowVictory] = useState(false);
  const [particleTrigger, setParticleTrigger] = useState(0);
  const [particlePosition, setParticlePosition] = useState({ x: 0, y: 0 });
  const [loadError, setLoadError] = useState<string | null>(null);
  // When the user lands on `/practice/play/chess`, `gameId` is the game
  // **type**, not a real practice game UUID. We bootstrap a real game on
  // mount and stash its id here for all subsequent move calls.
  const [activeGameId, setActiveGameId] = useState<string | null>(null);

  // Single source of truth for whether a game runs entirely in the browser
  // or needs a backend practice session. Derived from src/data/gamesRegistry.
  const gameMeta = getGameById(gameId);
  const isClientSide = gameMeta?.mode === 'client';
  const gameComingSoon = isComingSoon(gameId);

  useEffect(() => {
    if (gameComingSoon) {
      // Coming Soon games short-circuit at render — skip fetch entirely.
      setLoading(false);
      return;
    }
    if (isClientSide) {
      // Client-side games don't need to fetch from backend
      setGame({ 
        id: gameId, 
        game_type: gameId, 
        status: 'active',
        game_state: {} 
      });
      setLoading(false);
    } else {
      fetchGame();
    }
  }, [gameId, isClientSide, gameComingSoon]);

  const fetchGame = async () => {
    try {
      // If the URL param is a game **type** (not a real `practice_xxx`
      // UUID), bootstrap a fresh practice game via POST /practice/start
      // first. This unblocks Chess / Checkers / etc that were stuck
      // because there was no real game record to fetch from.
      const looksLikeGameId = typeof gameId === 'string' && gameId.startsWith('practice_');
      if (!looksLikeGameId) {
        const startRes = await authFetch(`${API}/api/practice/start`, {
          method: 'POST',
          credentials: 'include',
          body: JSON.stringify({ game_type: gameId, difficulty: 'medium' }),
        });
        if (!startRes.ok) {
          throw new Error('start_failed');
        }
        const started = await startRes.json();
        setActiveGameId(started.game_id);
        // The POST response already has every field the renderer needs.
        setGame(started);
        setLoading(false);
        return;
      }

      // Existing fetch path for resume-by-id (rare).
      const response = await authFetch(`${API}/api/practice/game/${gameId}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch game');
      }

      const data = await response.json();
      setActiveGameId(data.game_id);
      setGame(data);
      setLoading(false);

      // Check if game just completed
      if (data.status === 'completed' && !showVictory) {
        setTimeout(() => setShowVictory(true), 500);
      }
    } catch (err) {
      // Surface the actual problem instead of silently navigating back to the
      // games index — that was masking the three broken card-game routes.
      setLoadError(`We couldn't load "${gameId}". The backend doesn't have a practice endpoint for this game yet.`);
      setLoading(false);
    }
  };

  const makeMove = async (moveData) => {
    if (makingMove || aiThinking || game?.status === 'completed') return;
    
    // Client-side games handle their own state, no API calls needed
    if (isClientSide) {
      return;
    }

    setMakingMove(true);
    setAiThinking(true);

    try {
      const response = await authFetch(`${API}/api/practice/game/${activeGameId || gameId}/move`, {
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ move_data: moveData })
      });

      if (!response.ok) {
        throw new Error('Failed to make move');
      }

      const data = await response.json();
      setGame(prev => ({
        ...prev,
        game_state: data.game_state,
        status: data.status,
        winner: data.winner,
        current_turn: data.current_turn
      }));

      setAiThinking(false);
      
      // Trigger particles
      setParticleTrigger(prev => prev + 1);
      
      // Show victory if game completed
      if (data.status === 'completed') {
        setTimeout(() => setShowVictory(true), 500);
      }
    } catch (err) {
      // console.error('Error making move:', err);
      alert('Failed to make move');
      setAiThinking(false);
    } finally {
      setMakingMove(false);
    }
  };

  const playAgain = () => {
    navigate('/practice');
  };

  // COMING SOON gate — render the polished overlay instead of trying
  // to fetch / mount the game. Placed AFTER all hooks so React's
  // rules of hooks remain satisfied across gameId changes. Source
  // of truth: src/data/comingSoonGames.ts
  if (gameComingSoon) {
    return <ComingSoonOverlay gameName={gameId ?? "This game"} testId={`coming-soon-${gameId}`} />;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900">
        <p className="text-white text-2xl">Loading game...</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex items-center justify-center p-6" data-testid="practice-game-load-error">
        <div className="max-w-md w-full bg-black/50 backdrop-blur border border-white/10 rounded-2xl p-8 text-center">
          <Gamepad2 className="w-12 h-12 text-pink-400 mx-auto mb-4" />
          <h2 className="text-xl font-black italic text-white mb-2">Hmm — that one's not wired up.</h2>
          <p className="text-sm text-white/70 mb-6">{loadError}</p>
          <div className="flex gap-3 justify-center">
            <Button onClick={() => navigate('/multiplayer')} className="bg-fuchsia-600 hover:bg-fuchsia-500">
              Try Multiplayer
            </Button>
            <Button onClick={() => navigate('/games-menu')} variant="outline" className="border-white/20 text-white">
              Browse Games
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!game) return null;

  const renderGameBoard = () => {
    // Use extracted components for all games - clean and maintainable!
    const gameComponents = {
      // Original games
      'tictactoe': <PracticeGames.PracticeTicTacToe game={game} onMove={makeMove} makingMove={makingMove} aiThinking={aiThinking} />,
      'connect4': <PracticeGames.PracticeConnect4 game={game} onMove={makeMove} makingMove={makingMove} aiThinking={aiThinking} />,
      'blackjack': <PracticeGames.BlackjackGameSimple />,
      'chess': <PracticeGames.PracticeChess game={game} onMove={makeMove} makingMove={makingMove} aiThinking={aiThinking} />,
      'checkers': <PracticeGames.PracticeCheckers game={game} onMove={makeMove} makingMove={makingMove} aiThinking={aiThinking} />,
      'reversi': <PracticeGames.PracticeReversi game={game} onMove={makeMove} makingMove={makingMove} aiThinking={aiThinking} />,
      'go_fish': <PracticeGames.PracticeGoFish game={game} onMove={makeMove} makingMove={makingMove} aiThinking={aiThinking} />,
      'crazy_eights': <PracticeGames.PracticeCrazyEights game={game} onMove={makeMove} makingMove={makingMove} aiThinking={aiThinking} />,
      'hearts': <PracticeGames.PracticeHearts game={game} onMove={makeMove} makingMove={makingMove} aiThinking={aiThinking} />,
      'poker': <PracticeGames.PracticePoker game={game} onMove={makeMove} makingMove={makingMove} aiThinking={aiThinking} />,
      'spades': <PracticeGames.PracticeSpades game={game} onMove={makeMove} makingMove={makingMove} aiThinking={aiThinking} />,
      'trivia': <PracticeGames.PracticeTrivia game={game} onMove={makeMove} makingMove={makingMove} aiThinking={aiThinking} />,
      'truthordare': <PracticeGames.PracticeTruthOrDare game={game} onMove={makeMove} makingMove={makingMove} aiThinking={aiThinking} />,
      'rummy': <PracticeGames.PracticeRummy game={game} onMove={makeMove} makingMove={makingMove} aiThinking={aiThinking} />,
      'ludo': <LudoBoard gameState={game.game_state} onMove={makeMove} disabled={makingMove || aiThinking} />,
      'backgammon': <PracticeGames.PracticeBackgammon game={game} onMove={makeMove} makingMove={makingMove} aiThinking={aiThinking} />,

      // Arcade Games
      'snake': <PracticeGames.PracticeSnake gameState={game.game_state} onMove={makeMove} />,
      'memory_match': <PracticeGames.PracticeMemoryMatch gameState={game.game_state} onMove={makeMove} />,
      'pool_8ball': <PracticeGames.PracticePool8Ball gameState={game.game_state} onMove={makeMove} />,
      'bowling': <PracticeBowling gameState={game.game_state} onMove={makeMove} />,
      'ping_pong': <PracticeGames.PracticePingPong gameState={game.game_state} onMove={makeMove} />,
      
      // Card Games - Advanced
      'war': <PracticeGames.PracticeWar gameState={game.game_state} onMove={makeMove} />,
      'solitaire': <PracticeGames.PracticeSolitaire gameState={game.game_state} onMove={makeMove} />,
      'gin_rummy': <PracticeGames.PracticeGinRummy gameState={game.game_state} onMove={makeMove} />,
      
      // Casino Table Games
      'roulette': <PracticeGames.PracticeRoulette gameState={game.game_state} onMove={makeMove} />,
      'baccarat': <PracticeGames.PracticeBaccarat gameState={game.game_state} onMove={makeMove} />,
      'caribbean_stud': <PracticeGames.PracticeCaribbeanStud gameState={game.game_state} onMove={makeMove} />,
      'three_card_poker': <PracticeGames.PracticeThreeCardPoker gameState={game.game_state} onMove={makeMove} />,
      'pai_gow': <PracticeGames.PracticePaiGow gameState={game.game_state} onMove={makeMove} />,
      'chemin_de_fer': <PracticeGames.PracticeCheminDeFer gameState={game.game_state} onMove={makeMove} />,
      'casino_war': <PracticeGames.PracticeCasinoWar gameState={game.game_state} onMove={makeMove} />,
      'european_roulette': <PracticeGames.PracticeEuropeanRoulette gameState={game.game_state} onMove={makeMove} />,
      
      // Casino Dice Games
      'craps': <PracticeGames.PracticeCraps gameState={game.game_state} onMove={makeMove} />,
      'sic_bo': <PracticeGames.PracticeSicBo gameState={game.game_state} onMove={makeMove} />,
      'hazard': <PracticeGames.PracticeHazard gameState={game.game_state} onMove={makeMove} />,
      'chuck_a_luck': <PracticeGames.PracticeChuckALuck gameState={game.game_state} onMove={makeMove} />,
      
      // Casino Wheel Games
      'big_six_wheel': <PracticeGames.PracticeBigSixWheel gameState={game.game_state} onMove={makeMove} />,
      'vibes_wheel': <PracticeGames.PracticeVibesWheel gameState={game.game_state} onMove={makeMove} />,
      
      // Video/Electronic Casino
      'jacks_or_better': <PracticeGames.PracticeJacksOrBetter gameState={game.game_state} onMove={makeMove} />,
      'vibes_slots': <PracticeGames.PracticeVibesSlots gameState={game.game_state} onMove={makeMove} />,
      'keno': <PracticeGames.PracticeKeno gameState={game.game_state} onMove={makeMove} />,
      'bingo': <PracticeGames.PracticeBingo gameState={game.game_state} onMove={makeMove} />,
      
      // Classic Casino Games
      'fan_tan': <PracticeGames.PracticeFanTan gameState={game.game_state} onMove={makeMove} />,
      'faro': <PracticeGames.PracticeFaro gameState={game.game_state} onMove={makeMove} />,
      'vibes_darts': <PracticeGames.PracticeVibesDarts gameState={game.game_state} onMove={makeMove} />,
      
      // Board/Strategy Games
      'battleship': <PracticeGames.PracticeBattleship gameState={game.game_state} onMove={makeMove} />,
      'yahtzee': <PracticeGames.PracticeYahtzee gameState={game.game_state} onMove={makeMove} />,
      'mancala': <PracticeGames.PracticeMancala gameState={game.game_state} onMove={makeMove} />,
      'dominoes': <PracticeGames.PracticeDominoes gameState={game.game_state} onMove={makeMove} />,
      'mahjong': <PracticeGames.PracticeMahjong gameState={game.game_state} onMove={makeMove} />,
      'klondike': <PracticeGames.PracticeKlondike gameState={game.game_state} onMove={makeMove} />,
      
      // Party/Social Games
      'two_truths_lie': <PracticeGames.PracticeTwoTruthsLie gameState={game.game_state} onMove={makeMove} />,
      
      // Premium Casino (3D/Enhanced)
      'blackjack_new': <PracticeGames.PracticeBlackjackNew game={game} onMove={makeMove} makingMove={makingMove} aiThinking={aiThinking} />
      // poker_3d / poker_css3d removed 2026-02-16 (founder directive — 3D Poker rooms deleted).
    };

    return gameComponents[game.game_type] || (
      <div className="text-center py-12">
        <p className="text-white text-lg mb-4">
          Game type "{game.game_type}" UI not yet implemented
        </p>
        <p className="text-white/60">This practice game id is not supported yet.</p>
        <a href="/games-menu" className="text-cyan-400 underline mt-2 inline-block">Back to Games Menu</a>
      </div>
    );
  };


  const gameName = getRegisteredGameName(game.game_type);

  const getGameIcon = () => {
    return <Gamepad2 className="w-8 h-8 text-white" />;
  };

  // Games that ship with their own full-screen GameShell wrapper. Wrapping
  // them again in BrandedGameLayout produces duplicate headers and broken
  // mobile scroll areas.
  const SHELL_GAMES = new Set<string>([
    'snake',
    'memory_match',
    'ping_pong',
    'pool_8ball',
    'bowling',
  ]);

  const getWinner = () => {
    if (game.winner === 'player') return 'player';
    if (game.winner === 'ai') return 'ai';
    return 'draw';
  };

  return (
    <>
      {/* Some games render their own full-screen shell and should not be
          wrapped in a second layout. */}
      {(game.game_type === 'poker' || game.game_type === 'uno' || game.game_type === 'spades' || SHELL_GAMES.has(game.game_type)) ? (
        <>
          {!SHELL_GAMES.has(game.game_type) && (
            <BackButton to="/games" label="Back to Games" variant="casino" />
          )}
          {renderGameBoard()}
        </>
      ) : (
        /* Other games use branded layout */
        <BrandedGameLayout
          gameName={gameName}
          gameType={game.game_type}
          gameIcon={getGameIcon()}
          onBack={() => navigate('/practice')}
          onRestart={playAgain}
          status={
            game.status === 'completed' ? 'Game Over!' :
            aiThinking ? 'AI is thinking...' :
            'Your Turn'
          }
          difficulty={game.difficulty}
          aiThinking={aiThinking}
        >
          {renderGameBoard()}
        </BrandedGameLayout>
      )}

      {/* Victory Animation - Only for games NOT using CinematicCelebration or their own modal */}
      {!['tictactoe', 'connect4', 'chess', 'checkers', 'reversi', 'trivia', 'backgammon', ...SHELL_GAMES].includes(game?.game_type) && (
        <VictoryAnimation
          show={showVictory}
          winner={getWinner()}
          onClose={() => {
            setShowVictory(false);
            playAgain();
          }}
        />
      )}

      {/* Particle Effects */}
      <GameParticles
        trigger={particleTrigger}
        position={particlePosition}
        color="cyan"
      />
    </>
  );
}
