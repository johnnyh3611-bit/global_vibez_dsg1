
/**
 * UniversalGameRoom.jsx - The Universal Card Game Renderer
 * 
 * A single adaptive UI component that works with ANY card game plugin.
 * Demonstrates the Core + Plugin architecture with:
 * - Dynamic seating layouts (2-10 players)
 * - Math-based positioning (no hardcoded positions)
 * - Sci-fi/neon aesthetic
 * - Real-time game state management
 * - Chat & game log sidebar
 * - Animated card dealing and actions
 * 
 * @version 1.0.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { GameEngine } from '../../engine/core/GameEngine';
import { PluginRegistry } from '../../engine/PluginRegistry';
import universalGameSounds from '../../utils/universalGameSounds';
import { 
  ConfettiSystem, 
  triggerScreenShake, 
  createFloatingText,
  triggerVictoryFireworks 
} from '../../utils/universalGameAnimations';
import './UniversalGameRoom.css';

const UniversalGameRoom = () => {
  const { gameType, roomCode } = useParams();
  const navigate = useNavigate();
  
  // Core state
  const [engine, setEngine] = useState(null);
  const [gameState, setGameState] = useState(null);
  const [currentPlayerId, setCurrentPlayerId] = useState(null);
  const [validActions, setValidActions] = useState([]);
  const [betAmount, setBetAmount] = useState(20000); // Start with 20,000 Coins (was $10)
  const [revealedCards, setRevealedCards] = useState(new Set()); // Track which cards are revealed
  
  // Split hand state (for Blackjack split feature)
  const [splitHands, setSplitHands] = useState([]);
  const [activeSplitHand, setActiveSplitHand] = useState(0);
  
  // Insurance and betting state
  const [insuranceOffered, setInsuranceOffered] = useState(false);
  const [insuranceTaken, setInsuranceTaken] = useState(false);
  const [lastBetAmount, setLastBetAmount] = useState(20000); // Last bet in coins
  const [soundEnabled, setSoundEnabled] = useState(true);
  
  // UI state
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeMessages, setActiveMessages] = useState({});
  const [chatMessages, setChatMessages] = useState([]);
  const [gameLogs, setGameLogs] = useState([]);
  const [animatingCards, setAnimatingCards] = useState([]);
  
  const tableRef = useRef(null);
  const confettiCanvasRef = useRef(null);
  const confettiSystemRef = useRef(null);
  const gameAreaRef = useRef(null);
  
  // === HELPER FUNCTIONS (Must be declared BEFORE initializeGame to avoid TDZ) ===
  
  // Add game log message
  const addGameLog = useCallback((playerId, message) => {
    const logEntry = { playerId, message, timestamp: Date.now() };
    setGameLogs(prev => [...prev, logEntry]);
  }, []);
  
  // === INITIALIZATION ===
  
  const initializeGame = useCallback(() => {
    try {
      // Get plugin from registry
      const plugin = PluginRegistry.get(gameType);
      
      // Create game engine
      const gameEngine = new GameEngine(plugin, roomCode);
      
      // Add current player (for demo - in real app, get from auth)
      const playerId = `player_${Date.now()}`;
      setCurrentPlayerId(playerId);
      
      gameEngine.addPlayer(playerId, 'You', null);
      
      // For Blackjack, add dealer and AI players for demo
      if (gameType === 'blackjack') {
        // Add AI players (optional for multiplayer mode)
        // gameEngine.addPlayer('ai_1', 'Player 2', null);
        // gameEngine.addPlayer('ai_2', 'Player 3', null);
      }
      
      setEngine(gameEngine);
      setGameState(gameEngine.getState());
      
      addGameLog('system', `Welcome to ${plugin.displayName}!`);
      addGameLog('system', `Room Code: ${roomCode}`);
      
    } catch (error) {
      console.error('Failed to initialize game:', error);
      alert(`Error: ${error.message}`);
    }
  }, [gameType, roomCode, addGameLog]);
  
  useEffect(() => {
    initializeGame();
  }, [initializeGame]);
  
  // Initialize confetti system
  useEffect(() => {
    if (confettiCanvasRef.current && !confettiSystemRef.current) {
      confettiSystemRef.current = new ConfettiSystem(confettiCanvasRef.current);
    }
  }, []);
  
  // === HELPER FUNCTIONS (Declared BEFORE executeAction to fix hoisting) ===
  
  // Update valid actions based on game state (THE "DOUBLE-TAKE" VALIDATION)
  const updateValidActions = useCallback((state) => {
    if (!state || !engine) {
      setValidActions([]);
      return;
    }
    
    try {
      // Optional chaining to prevent crashes
      const actions = engine?.getValidActions?.(currentPlayerId) || [];
      setValidActions(actions);
    } catch (error) {
      console.error('Failed to update valid actions:', error);
      setValidActions([]);
    }
  }, [engine, currentPlayerId]);
  
  // Animate card dealing with "power glide" effect
  const animateCardDealing = useCallback((state) => {
    if (!state?.room?.seats) return;
    
    const playerIds = state.room.seats.map(s => s?.player_id).filter(Boolean);
    
    // Slow "power-glide" dealing - 1.2s between cards (per user request)
    playerIds.forEach((playerId, playerIndex) => {
      const hand = state.hands?.[playerId];
      if (!hand?.cards) return;
      
      hand.cards.forEach((card, cardIndex) => {
        setTimeout(() => {
          if (card?.face_state === 'up') {
            setRevealedCards(prev => {
              const newSet = new Set(prev);
              newSet.add(card.id);
              return newSet;
            });
            universalGameSounds.playCardFlip();
          }
        }, (playerIndex * hand.cards.length + cardIndex) * 1200); // 1.2 second intervals
      });
    });
    
    // Update valid actions after all cards are dealt
    setTimeout(() => {
      updateValidActions(state);
      
      // Check for insurance offer (if dealer shows Ace in Blackjack)
      if (gameType === 'blackjack') {
        const dealerHand = state.hands?.['dealer'];
        if (dealerHand?.cards?.length >= 1) {
          const dealerUpCard = dealerHand.cards.find(card => card.face_state === 'up');
          if (dealerUpCard?.rank === 'A') {
            setInsuranceOffered(true);
            addGameLog('system', 'Dealer showing Ace - Insurance available!');
          }
        }
      }
    }, (playerIds.length * 2 + 1) * 1200);
  }, [updateValidActions, gameType, addGameLog]);
  
  // Handle split pairs action (Blackjack)
  const handleSplit = useCallback(() => {
    const playerHand = gameState?.hands?.[currentPlayerId];
    if (!playerHand || playerHand.cards?.length !== 2) return;
    
    const card1 = playerHand.cards[0];
    const card2 = playerHand.cards[1];
    
    // Check if cards match
    if (card1?.rank !== card2?.rank) {
      alert('Cards must match to split!');
      return;
    }
    
    // Check if player can afford split (needs to match original bet)
    const originalBet = betAmount;
    const playerChips = gameState?.game_state?.score?.players?.[currentPlayerId]?.current || 0;
    
    if (originalBet > playerChips) {
      alert('Not enough chips to split!');
      return;
    }
    
    universalGameSounds.playChipPlace();
    
    // Deduct second bet (with safety check)
    if (gameState?.game_state?.score?.players?.[currentPlayerId]) {
      gameState.game_state.score.players[currentPlayerId].current -= originalBet;
    }
    
    // Create two hands
    const hand1 = {
      cards: [card1],
      bet: originalBet,
      isStanding: false,
      isBusted: false,
      value: 0
    };
    
    const hand2 = {
      cards: [card2],
      bet: originalBet,
      isStanding: false,
      isBusted: false,
      value: 0
    };
    
    setSplitHands([hand1, hand2]);
    setActiveSplitHand(0);
    
    // Deal one card to each hand
    setTimeout(() => {
      const newCard1 = engine?.deckMechanics?.dealCard?.();
      if (newCard1) {
        newCard1.face_state = 'up';
        hand1.cards.push(newCard1);
        setRevealedCards(prev => new Set([...prev, newCard1.id]));
        universalGameSounds.playCardFlip();
      }
      
      setTimeout(() => {
        const newCard2 = engine?.deckMechanics?.dealCard?.();
        if (newCard2) {
          newCard2.face_state = 'up';
          hand2.cards.push(newCard2);
          setRevealedCards(prev => new Set([...prev, newCard2.id]));
          universalGameSounds.playCardFlip();
        }
        
        setSplitHands([hand1, hand2]);
        addGameLog(currentPlayerId, `Split into two hands! Playing hand 1 first.`);
      }, 600);
    }, 600);
    
  }, [gameState, currentPlayerId, betAmount, engine, addGameLog]);
  
  // === GAME ACTIONS ===
  
  const startGame = () => {
    try {
      universalGameSounds.resume(); // Resume audio context on user interaction
      universalGameSounds.playButtonClick();
      
      // Show shuffle animation
      setGameState(prev => ({ ...prev, shuffling: true }));
      addGameLog('system', 'Dealer shuffling deck...');
      
      setTimeout(() => {
        const newState = engine.startGame();
        newState.shuffling = false;
        setGameState(newState);
        updateValidActions(newState);
        addGameLog('system', 'Game started!');
      }, 2000); // 2 second shuffle animation
    } catch (error) {
      alert(error.message);
    }
  };
  
  const executeAction = useCallback((actionType, actionData = {}) => {
    try {
      const action = { type: actionType, ...actionData };
      
      // Handle split action specially
      if (actionType === 'split') {
        handleSplit();
        return;
      }
      
      const newState = engine.executeAction(currentPlayerId, action);
      
      // Animate card reveals after bet is placed
      if (actionType === 'bet') {
        setGameState(newState);
        animateCardDealing(newState);
      } else {
        setGameState(newState);
        updateValidActions(newState);
      }
      
      addGameLog(currentPlayerId, `${actionType.toUpperCase()}: ${JSON.stringify(actionData)}`);
      
      // Auto-advance turn if needed
      if (actionType === 'stand' || actionType === 'double') {
        setTimeout(() => {
          if (engine.state.game_state.phase.current === 'playing') {
            engine.nextTurn();
            setGameState(engine.getState());
            updateValidActions(engine.getState());
          }
        }, 500);
      }
      
    } catch (error) {
      alert(error.message);
      addGameLog('system', `Error: ${error.message}`);
    }
  }, [engine, currentPlayerId, handleSplit, animateCardDealing, updateValidActions, addGameLog]);
  
  // Move to next split hand (must be defined before handleSplitAction)
  const moveToNextHand = useCallback(() => {
    if (activeSplitHand < splitHands.length - 1) {
      setActiveSplitHand(activeSplitHand + 1);
      addGameLog('system', `Now playing hand ${activeSplitHand + 2}`);
    } else {
      // All hands played - dealer plays
      addGameLog('system', 'All hands complete. Dealer plays...');
      setTimeout(() => {
        // Dealer logic would go here
        // For now, just end the round
        if (gameState?.game_state?.phase) {
          gameState.game_state.phase.current = 'finished';
          setGameState({...gameState});
        }
      }, 1000);
    }
  }, [activeSplitHand, splitHands, addGameLog, gameState]);
  
  // Handle split hand actions
  const handleSplitAction = useCallback((actionType) => {
    const currentHand = splitHands[activeSplitHand];
    if (!currentHand) return;
    
    universalGameSounds.playButtonClick();
    
    if (actionType === 'hit') {
      // Deal card to current hand
      const newCard = engine.deckMechanics.dealCard();
      newCard.face_state = 'up';
      currentHand.cards.push(newCard);
      setRevealedCards(prev => new Set([...prev, newCard.id]));
      universalGameSounds.playCardFlip();
      
      // Calculate hand value
      let value = 0;
      let aces = 0;
      currentHand.cards.forEach(card => {
        if (card.rank === 'A') {
          aces++;
          value += 11;
        } else if (['K', 'Q', 'J'].includes(card.rank)) {
          value += 10;
        } else {
          value += parseInt(card.rank);
        }
      });
      
      while (value > 21 && aces > 0) {
        value -= 10;
        aces--;
      }
      
      currentHand.value = value;
      
      if (value > 21) {
        currentHand.isBusted = true;
        universalGameSounds.playBust();
        addGameLog(currentPlayerId, `Hand ${activeSplitHand + 1} busted with ${value}`);
        
        // Move to next hand
        setTimeout(() => moveToNextHand(), 1000);
      } else {
        addGameLog(currentPlayerId, `Hand ${activeSplitHand + 1} has ${value}`);
      }
      
      setSplitHands([...splitHands]);
      
    } else if (actionType === 'stand') {
      currentHand.isStanding = true;
      setSplitHands([...splitHands]);
      
      let value = 0;
      let aces = 0;
      currentHand.cards.forEach(card => {
        if (card.rank === 'A') {
          aces++;
          value += 11;
        } else if (['K', 'Q', 'J'].includes(card.rank)) {
          value += 10;
        } else {
          value += parseInt(card.rank);
        }
      });
      
      while (value > 21 && aces > 0) {
        value -= 10;
        aces--;
      }
      
      currentHand.value = value;
      
      addGameLog(currentPlayerId, `Hand ${activeSplitHand + 1} stands with ${value}`);
      
      // Move to next hand
      setTimeout(() => moveToNextHand(), 500);
    }
  }, [splitHands, activeSplitHand, engine, currentPlayerId, addGameLog, moveToNextHand]);
  
  const handleBet = useCallback(() => {
    if (betAmount < gameState.game_state.pot.min_bet) {
      alert(`Minimum bet is ₵${gameState.game_state.pot.min_bet.toLocaleString()}`);
      return;
    }
    universalGameSounds.playChipPlace();
    setLastBetAmount(betAmount); // Remember this bet
    executeAction('bet', { amount: betAmount });
  }, [betAmount, gameState, executeAction]);
  
  // === KEYBOARD SHORTCUTS (After all functions defined) ===
  
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e) => {
      // Don't trigger if typing in chat
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      
      const key = e.key.toLowerCase();
      
      if (validActions.length === 0) return;
      
      switch (key) {
        case 'h':
          if (validActions.some(a => a.type === 'hit')) {
            executeAction('hit');
          }
          break;
        case 's':
          if (validActions.some(a => a.type === 'stand')) {
            executeAction('stand');
          }
          break;
        case 'd':
          if (validActions.some(a => a.type === 'double')) {
            executeAction('double', { amount: betAmount });
          }
          break;
        default:
          break;
      }
    };
    
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [validActions, executeAction, betAmount]);
  
  // Update valid actions when engine or player changes
  useEffect(() => {
  
  // === RENDER HELPERS ===
    if (engine && currentPlayerId) {
      const actions = engine.getValidActions(currentPlayerId);
      setValidActions(actions);
    }
  }, [engine, currentPlayerId]);
  
  // Check if dealer has blackjack (for insurance)
  const checkDealerBlackjack = useCallback((insuranceBet) => {
    const dealerHand = gameState.hands['dealer'];
    if (!dealerHand || dealerHand.cards.length < 2) return;
    
    // Calculate dealer value
    let value = 0;
    let aces = 0;
    dealerHand.cards.forEach(card => {
      if (card.rank === 'A') {
        aces++;
        value += 11;
      } else if (['K', 'Q', 'J'].includes(card.rank)) {
        value += 10;
      } else {
        value += parseInt(card.rank);
      }
    });
    
    while (value > 21 && aces > 0) {
      value -= 10;
      aces--;
    }
    
    const hasBlackjack = value === 21 && dealerHand.cards.length === 2;
    
    if (hasBlackjack) {
      // Reveal dealer's hole card
      dealerHand.cards[1].face_state = 'up';
      setRevealedCards(prev => new Set([...prev, dealerHand.cards[1].id]));
      
      universalGameSounds.playCardFlip();
      setTimeout(() => {
        universalGameSounds.playBlackjack();
        
        // Pay insurance
        if (insuranceBet > 0) {
          const payout = insuranceBet * 3; // 2:1 + original bet back
          gameState.game_state.score.players[currentPlayerId].current += payout;
          setGameState({...gameState});
          createFloatingText(`Insurance Pays! +$${payout}`, window.innerWidth / 2 - 80, window.innerHeight / 2, '#22d3ee');
          addGameLog('system', `Insurance paid 2:1! (+$${payout})`);
        }
        
        addGameLog('system', 'Dealer has Blackjack!');
        
        // End round
        setTimeout(() => {
          gameState.game_state.phase.current = 'finished';
          setGameState({...gameState});
        }, 2000);
      }, 1000);
    } else {
      // No blackjack - insurance loses, continue game
      if (insuranceBet > 0) {
        addGameLog('system', `Insurance loses (-$${insuranceBet})`);
      }
      // Game continues normally
    }
  }, [gameState, currentPlayerId, addGameLog]);
  
  // === CHAT & SOCIAL ===
  
  const sendChatMessage = (message) => {
    const newMessage = {
      user: 'You',
      text: message,
      timestamp: new Date().toISOString()
    };
    setChatMessages(prev => [...prev, newMessage]);
  };
  
  const showPlayerMessage = (playerId, content) => {
    setActiveMessages(prev => ({ ...prev, [playerId]: content }));
    setTimeout(() => {
      setActiveMessages(prev => {
        const newMessages = { ...prev };
        delete newMessages[playerId];
        return newMessages;
      });
    }, 3000);
  };
  
  // === SEAT POSITIONING (Math-Based) ===
  
  const getSeatPosition = (index, total) => {
    // For single player Blackjack: Position on LEFT side
    if (total === 1) {
      return { left: '20%', top: '50%' };
    }
    
    // For multiple players, use elliptical layout
    const radiusX = 40;
    const radiusY = 35;
    const angle = (index / total) * 2 * Math.PI - Math.PI / 2;
    const x = 50 + radiusX * Math.cos(angle);
    const y = 50 + radiusY * Math.sin(angle);
    return { left: `${x}%`, top: `${y}%` };
  };
  
  // === RENDER HELPERS ===
  
  const renderCard = (card, index = 0) => {
    if (!card) return null;
    
    const isHidden = card.face_state === 'down';
    const isRevealed = revealedCards.has(card.id) || card.face_state === 'up';
    const shouldFlip = isRevealed;
    
    return (
      <div 
        key={card.id}
        className={`game-card ${shouldFlip ? 'card-flip-reveal' : ''}`}
      >
        <div className="card-inner">
          {/* Card Back */}
          <div className="card-back-side">
            <div className="card-back-pattern">🎰</div>
          </div>
          
          {/* Card Front */}
          <div className="card-front-side">
            <div className={`card-suit ${card.color}`}>{card.rank}</div>
            <div className="card-symbol">{getSuitSymbol(card.suit)}</div>
          </div>
        </div>
      </div>
    );
  };
  
  const getSuitSymbol = (suit) => {
    const symbols = {
      hearts: '♥',
      diamonds: '♦',
      clubs: '♣',
      spades: '♠'
    };
    return symbols[suit] || '';
  };
  
  const renderPlayerSeat = (seat, index) => {
    const playerHand = gameState.hands[seat.player_id];
    const isCurrentTurn = seat.is_current_turn;
    const isCurrentPlayer = seat.player_id === currentPlayerId;
    const position = getSeatPosition(index, gameState.room.seats.length);
    
    return (
      <div
        key={seat.player_id}
        className={`player-zone ${isCurrentTurn ? 'active-player-glow' : ''}`}
        style={position}
      >
        {/* Zone Label */}
        <div className="zone-label player-label-text">PLAYER</div>
        
        <div className="player-content">
          {/* Avatar */}
          <div className={`player-avatar ${isCurrentPlayer ? 'border-yellow-400' : 'border-blue-400'}`}>
            <div className="avatar-gradient" />
            {isCurrentTurn && <div className="turn-indicator">⚡</div>}
          </div>
          
          {/* Name & Chips */}
          <div className="player-info">
            <span className="player-name">{isCurrentPlayer ? 'You' : seat.player_name}</span>
            {gameState.game_state.score.players[seat.player_id] && (
              <span className="player-chips">
                💰 {gameState.game_state.score.players[seat.player_id].current}
              </span>
            )}
          </div>
          
          {/* Hand (Cards) */}
          {playerHand && playerHand.cards.length > 0 && (
            <div className="player-hand">
              <div className="cards-container">
                {(isCurrentPlayer ? playerHand.cards : playerHand.cards.slice(0, 2)).map((card, i) => 
                  renderCard(isCurrentPlayer ? card : { ...card, face_state: 'down' }, i)
                )}
              </div>
              {playerHand.hand_value > 0 && isCurrentPlayer && (
                <div className="hand-value">
                  {playerHand.hand_rank === 'blackjack' ? '🎰 BLACKJACK!' : `Total: ${playerHand.hand_value}`}
                </div>
              )}
            </div>
          )}
          
          {/* Player state */}
          {seat.state && seat.state !== 'waiting' && (
            <div className={`player-state ${seat.state}`}>
              {seat.state.toUpperCase()}
            </div>
          )}
          
          {/* Chat bubble */}
          {activeMessages[seat.player_id] && (
            <div className="chat-bubble animate-bounce">
              {activeMessages[seat.player_id]}
              <div className="chat-bubble-tail"></div>
            </div>
          )}
        </div>
      </div>
    );
  };
  
  const renderDealerHand = () => {
    const dealerHand = gameState.hands['dealer'];
    
    return (
      <div className="dealer-zone">
        {/* Zone Label */}
        <div className="zone-label dealer-label-text">DEALER'S SIDE</div>
        
        <div className="dealer-content">
          <div className="dealer-portal"></div>
          
          <div className="dealer-name">DEALER NOVA</div>
          
          {dealerHand && dealerHand.cards.length > 0 ? (
            <>
              <div className="dealer-cards">
                {dealerHand.cards.map((card, i) => renderCard(card, i))}
              </div>
              
              {dealerHand.hand_value > 0 && gameState.game_state.phase.current === 'finished' && (
                <div className="dealer-total">
                  Total: {dealerHand.hand_value}
                  {dealerHand.hand_rank === 'bust' && ' - BUST!'}
                </div>
              )}
            </>
          ) : (
            <div className="dealer-waiting">
              Waiting for bets...
            </div>
          )}
        </div>
      </div>
    );
  };
  
  const renderActionButtons = () => {
    const phase = gameState.game_state.phase.current;
    
    // Insurance is now handled by modal above - remove inline UI
    // Betting is now handled by modal above - remove inline UI
    
    if (phase === 'waiting') {
      return (
        <button onClick={startGame} className="action-btn primary" data-testid="btn-start-game">
          {gameState.shuffling ? 'Shuffling...' : 'Start Game'}
        </button>
      );
    }
    
    // Show shuffling animation
    if (gameState.shuffling) {
      return (
        <div className="shuffle-animation">
          <div className="shuffle-cards">
            {[...Array(7)].map((_, i) => (
              <div key={`shuffle-card-${i}`} className="shuffle-card" style={{ animationDelay: `${i * 0.1}s` }}>
                🎴
              </div>
            ))}
          </div>
          <p className="shuffle-text">Dealer shuffling deck...</p>
        </div>
      );
    }
    
    // Betting phase - modal handles this now
    if (phase === 'betting') {
      return null;
    }
    
    if (phase === 'playing') {
      // If we have split hands, show split hand controls
      if (splitHands.length > 0) {
        const currentHand = splitHands[activeSplitHand];
        const canHit = !currentHand.isStanding && !currentHand.isBusted;
        
        return (
          <div className="split-hands-controls">
            <div className="split-status">
              <h3>Playing Hand {activeSplitHand + 1} of {splitHands.length}</h3>
              <div className="split-hands-display">
                {splitHands.map((hand, idx) => (
                  <div 
                    key={`split-hand-${idx}-${hand.cards[0]?.id || idx}`} 
                    className={`split-hand-preview ${idx === activeSplitHand ? 'active' : ''} ${hand.isBusted ? 'busted' : ''} ${hand.isStanding ? 'standing' : ''}`}
                  >
                    <div className="split-hand-label">Hand {idx + 1}</div>
                    <div className="split-hand-cards">
                      {hand.cards.map((card, i) => (
                        <div key={card.id || `card-${i}`} className="mini-card">
                          {card.rank}{getSuitSymbol(card.suit)}
                        </div>
                      ))}
                    </div>
                    <div className="split-hand-value">
                      {hand.value > 0 ? `Value: ${hand.value}` : ''}
                      {hand.isBusted && ' BUST'}
                      {hand.isStanding && ' STAND'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="action-buttons">
              {canHit && (
                <>
                  <button
                    onClick={() => handleSplitAction('hit')}
                    className="action-btn"
                  >
                    Hit
                  </button>
                  <button
                    onClick={() => handleSplitAction('stand')}
                    className="action-btn"
                  >
                    Stand
                  </button>
                </>
              )}
            </div>
          </div>
        );
      }
      
      // Normal single hand controls
      const currentPlayer = gameState.room.seats.find(s => s.is_current_turn);
      if (currentPlayer && currentPlayer.player_id === currentPlayerId) {
        return (
          <div className="action-buttons">
            {validActions.map(action => (
              <button
                key={action.type}
                onClick={() => {
                  universalGameSounds.playButtonClick();
                  if (action.type === 'double') {
                    executeAction('double', { amount: betAmount });
                  } else {
                    executeAction(action.type);
                  }
                }}
                className="action-btn"
              >
                {action.label}
              </button>
            ))}
          </div>
        );
      }
    }
    
    if (phase === 'finished') {
      // Play result sounds and animations
      if (gameState.plugin_data.results && gameState.plugin_data.results[currentPlayerId]) {
        const result = gameState.plugin_data.results[currentPlayerId].result;
        const payout = gameState.plugin_data.results[currentPlayerId].payout;
        
        // Trigger effects based on result
        setTimeout(() => {
          if (result === 'blackjack') {
            universalGameSounds.playBlackjack();
            if (confettiSystemRef.current) {
              triggerVictoryFireworks(confettiCanvasRef.current);
              setTimeout(() => {
                confettiSystemRef.current.start(4000);
              }, 1000);
            }
            if (gameAreaRef.current) {
              createFloatingText('🎰 BLACKJACK! 🎰', window.innerWidth / 2 - 100, window.innerHeight / 2 - 50, '#fbbf24');
            }
          } else if (result === 'win') {
            universalGameSounds.playWin();
            if (confettiSystemRef.current) {
              confettiSystemRef.current.start(3000);
            }
            if (gameAreaRef.current) {
              createFloatingText(`+${payout} 💰`, window.innerWidth / 2 - 50, window.innerHeight / 2, '#22d3ee');
            }
          } else if (result === 'loss') {
            universalGameSounds.playLoss();
            if (gameAreaRef.current) {
              triggerScreenShake(gameAreaRef.current, 'medium');
            }
          } else if (result === 'push') {
            universalGameSounds.playPush();
          }
        }, 100);
      }
      
      return (
        <div className={`game-over ${gameState.plugin_data.results?.[currentPlayerId]?.result === 'win' || gameState.plugin_data.results?.[currentPlayerId]?.result === 'blackjack' ? 'victory-overlay' : 'loss-overlay'}`}>
          <h2>Round Complete!</h2>
          {gameState.plugin_data.results && (
            <div className="results">
              {(Object.entries(gameState.plugin_data.results) as Array<[string, { result: string; payout?: number }]>).map(([playerId, result]) => (
                <div key={playerId} className={`result-item ${result.result}`}>
                  {playerId === currentPlayerId ? 'You' : playerId}: {result.result.toUpperCase()}
                  {(result.payout || 0) > 0 && ` (+${result.payout} chips)`}
                </div>
              ))}
            </div>
          )}
          <button 
            onClick={() => {
              universalGameSounds.playButtonClick();
              setLastBetAmount(betAmount); // Save current bet before reloading
              window.location.reload();
            }} 
            className="action-btn primary"
          >
            New Round
          </button>
        </div>
      );
    }
    
    return null;
  };
  
  // === RENDER ===
  
  if (!gameState) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
        <p>Initializing Universal Game Engine...</p>
      </div>
    );
  }
  
  const plugin = PluginRegistry.getMetadata(gameType);
  
  return (
    <div className="universal-game-room">
      {/* Confetti Canvas */}
      <canvas ref={confettiCanvasRef} className="confetti-canvas"></canvas>
      
      {/* Header */}
      <div className="game-header">
        <button onClick={() => navigate('/games')} className="back-btn">← Back</button>
        <h1 className="game-title">{plugin.displayName}</h1>
        <div className="room-info">Room: {roomCode}</div>
        <button 
          onClick={() => {
            const newState = universalGameSounds.toggle();
            setSoundEnabled(newState);
          }} 
          className="sound-toggle"
          title={soundEnabled ? 'Sound On' : 'Sound Off'}
        >
          {soundEnabled ? '🔊' : '🔇'}
        </button>
        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="sidebar-toggle">
          {sidebarOpen ? '✕' : '💬'}
        </button>
      </div>
      
      {/* Main Game Area */}
      <div ref={gameAreaRef} className="game-area">
        {/* The Universal Table */}
        <div ref={tableRef} className="universal-table">
          
          {/* Center Area */}
          <div className="table-center">
            {/* Pot Display */}
            {gameState.game_state.pot && gameState.game_state.pot.total > 0 && (
              <div className="pot-display">
                POT: 💰 ₵{gameState.game_state.pot.total.toLocaleString()}
              </div>
            )}
          </div>
          
          {/* Player Zone (LEFT) */}
          {gameState.room.seats.map((seat, index) => renderPlayerSeat(seat, index))}
          
          {/* Dealer Zone (RIGHT) */}
          {gameType === 'blackjack' && renderDealerHand()}
        </div>
        
        {/* Action Panel */}
        <div className="action-panel">
          {renderActionButtons()}
        </div>
      </div>
      
      {/* Sidebar */}
      <Sidebar 
        isOpen={sidebarOpen}
        chatMessages={chatMessages}
        gameLogs={gameLogs}
        onSendMessage={sendChatMessage}
      />
      
      {/* Betting Modal - Table-Contained */}
      {gameState.game_state.phase.current === 'betting' && (
        <div className="table-modal-overlay" data-testid="betting-modal-overlay">
          <div className="table-modal-content betting-modal">
            <h2 className="modal-title">Place Your Bet</h2>
            
            <div className="modal-balance">
              <div className="balance-label">Available Chips</div>
              <div className="balance-amount">₵{gameState.game_state.score.players[currentPlayerId]?.current || 0}</div>
            </div>
            
            <div className="modal-bet-display">
              <div className="current-bet-label">Current Bet</div>
              <div className="current-bet-amount">₵{betAmount.toLocaleString()}</div>
            </div>
            
            {/* Re-Bet Button */}
            {lastBetAmount > 0 && lastBetAmount !== betAmount && (
              <button 
                className="rebet-button"
                onClick={() => {
                  universalGameSounds.playChipPlace();
                  setBetAmount(Math.min(lastBetAmount, gameState.game_state.score.players[currentPlayerId]?.current || 0));
                }}
                disabled={lastBetAmount > (gameState.game_state.score.players[currentPlayerId]?.current || 0)}
                data-testid="btn-rebet"
              >
                Repeat Last Bet (₵{lastBetAmount.toLocaleString()})
              </button>
            )}
            
            {/* Casino Chip Grid */}
            <div className="chip-grid">
              {[20000, 50000, 100000, 200000, 1000000].map(chipValue => (
                <button
                  key={chipValue}
                  className={`chip-button chip-${chipValue}`}
                  onClick={() => {
                    universalGameSounds.playChipPlace();
                    setBetAmount(prev => Math.min(prev + chipValue, gameState.game_state.score.players[currentPlayerId]?.current || 0));
                  }}
                  disabled={(gameState.game_state.score.players[currentPlayerId]?.current || 0) < chipValue}
                  data-testid={`chip-${chipValue}`}
                >
                  <div className="chip-value">₵{chipValue >= 1000 ? `${chipValue / 1000}K` : chipValue}</div>
                </button>
              ))}
            </div>
            
            {/* Control Buttons */}
            <div className="modal-actions">
              <button 
                className="modal-btn btn-clear"
                onClick={() => {
                  universalGameSounds.playButtonClick();
                  setBetAmount(0);
                }}
                data-testid="btn-clear-bet"
              >
                Clear
              </button>
              
              <button 
                className="modal-btn btn-place-bet"
                onClick={handleBet}
                disabled={betAmount < (gameState.game_state.pot.min_bet || 20000) || betAmount > (gameState.game_state.score.players[currentPlayerId]?.current || 0)}
                data-testid="btn-place-bet"
              >
                Place Bet (₵{betAmount.toLocaleString()})
              </button>
            </div>
            
            <div className="min-bet-notice">Minimum bet: ₵{(gameState.game_state.pot.min_bet || 20000).toLocaleString()}</div>
          </div>
        </div>
      )}
      
      {/* Insurance Modal - Table-Contained */}
      {insuranceOffered && !insuranceTaken && (
        <div className="table-modal-overlay" data-testid="insurance-modal-overlay">
          <div className="table-modal-content insurance-modal">
            <h2 className="modal-title insurance-title">Insurance Offer</h2>
            <p className="insurance-subtitle">Dealer shows Ace!</p>
            
            <div className="insurance-info-grid">
              <div className="info-card">
                <div className="info-label">Insurance Cost</div>
                <div className="info-value">₵{Math.floor(betAmount / 2).toLocaleString()}</div>
                <div className="info-detail">(Half your bet)</div>
              </div>
              
              <div className="info-card">
                <div className="info-label">Payout if Dealer has Blackjack</div>
                <div className="info-value">2:1</div>
                <div className="info-detail">₵{(Math.floor(betAmount / 2) * 3).toLocaleString()} total</div>
              </div>
            </div>
            
            <div className="modal-actions insurance-actions">
              <button 
                onClick={() => {
                  universalGameSounds.playButtonClick();
                  setInsuranceOffered(false);
                  addGameLog(currentPlayerId, 'Declined insurance');
                  setTimeout(() => checkDealerBlackjack(0), 500);
                }}
                className="modal-btn btn-insurance-no"
                data-testid="btn-insurance-no"
              >
                No Thanks
              </button>
              
              <button 
                onClick={() => {
                  const insuranceCost = Math.floor(betAmount / 2);
                  const playerChips = gameState.game_state.score.players[currentPlayerId]?.current || 0;
                  
                  universalGameSounds.playChipPlace();
                  if (playerChips >= insuranceCost) {
                    gameState.game_state.score.players[currentPlayerId].current -= insuranceCost;
                    setGameState({...gameState});
                    setInsuranceTaken(true);
                    setInsuranceOffered(false);
                    addGameLog(currentPlayerId, `Took insurance for ₵${insuranceCost.toLocaleString()}`);
                    setTimeout(() => checkDealerBlackjack(insuranceCost), 1000);
                  } else {
                    alert('Not enough chips for insurance!');
                  }
                }}
                className="modal-btn btn-insurance-yes"
                disabled={(gameState.game_state.score.players[currentPlayerId]?.current || 0) < Math.floor(betAmount / 2)}
                data-testid="btn-insurance-yes"
              >
                Take Insurance (₵{Math.floor(betAmount / 2).toLocaleString()})
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Results Modal - Win/Lose Pot Display */}
      {gameState.game_state.phase.current === 'finished' && gameState.plugin_data.results?.[currentPlayerId] && (
        <div className="table-modal-overlay" data-testid="results-modal-overlay">
          <div className="table-modal-content results-modal">
            {(() => {
              const result = gameState.plugin_data.results[currentPlayerId];
              const isWin = result.result === 'win' || result.result === 'blackjack';
              const isPush = result.result === 'push';
              
              return (
                <>
                  {/* Result Icon/Title */}
                  <div className={`result-icon ${result.result}`}>
                    {result.result === 'blackjack' && '🎰'}
                    {result.result === 'win' && '🏆'}
                    {result.result === 'loss' && '💔'}
                    {result.result === 'push' && '🤝'}
                  </div>
                  
                  <h2 className={`result-title ${result.result}`}>
                    {result.result === 'blackjack' && 'BLACKJACK!'}
                    {result.result === 'win' && 'YOU WIN!'}
                    {result.result === 'loss' && 'YOU LOSE'}
                    {result.result === 'push' && 'PUSH'}
                  </h2>
                  
                  {/* Pot Display */}
                  <div className="pot-display-modal">
                    {isWin && (
                      <>
                        <div className="pot-label">Winnings</div>
                        <div className="pot-amount win-amount">
                          +₵{result.payout.toLocaleString()}
                        </div>
                        <div className="pot-subtitle">
                          {result.result === 'blackjack' ? '3:2 Payout!' : 'Added to your balance'}
                        </div>
                      </>
                    )}
                    
                    {result.result === 'loss' && (
                      <>
                        <div className="pot-label">Lost Bet</div>
                        <div className="pot-amount lose-amount">
                          -₵{betAmount.toLocaleString()}
                        </div>
                        <div className="pot-subtitle">Better luck next time!</div>
                      </>
                    )}
                    
                    {isPush && (
                      <>
                        <div className="pot-label">Bet Returned</div>
                        <div className="pot-amount push-amount">
                          ₵{betAmount.toLocaleString()}
                        </div>
                        <div className="pot-subtitle">It's a tie!</div>
                      </>
                    )}
                  </div>
                  
                  {/* Current Balance */}
                  <div className="current-balance-display">
                    <span className="balance-text">New Balance:</span>
                    <span className="balance-value">
                      ₵{(gameState.game_state.score.players[currentPlayerId]?.current || 0).toLocaleString()}
                    </span>
                  </div>
                  
                  {/* Play Again Button */}
                  <button
                    className="modal-btn btn-play-again"
                    onClick={() => {
                      universalGameSounds.playButtonClick();
                      window.location.reload();
                    }}
                    data-testid="btn-play-again"
                  >
                    Play Again
                  </button>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};

// === SIDEBAR COMPONENT ===

const Sidebar = ({ isOpen, chatMessages, gameLogs, onSendMessage }) => {
  const [activeTab, setActiveTab] = useState('log');
  const [messageInput, setMessageInput] = useState('');
  
  const handleSend = () => {
    if (messageInput.trim()) {
      onSendMessage(messageInput);
      setMessageInput('');
    }
  };
  
  return (
    <div className={`sidebar-sci-fi ${isOpen ? 'open' : 'closed'}`}>
      {/* Tabs */}
      <div className="sidebar-tabs">
        <button 
          onClick={() => setActiveTab('chat')} 
          className={`tab-btn ${activeTab === 'chat' ? 'active' : ''}`}
        >
          Chat
        </button>
        <button 
          onClick={() => setActiveTab('log')} 
          className={`tab-btn ${activeTab === 'log' ? 'active' : ''}`}
        >
          Game Log
        </button>
      </div>
      
      {/* Messages Area */}
      <div className="messages-area">
        {(activeTab === 'chat' ? chatMessages : gameLogs).map((msg, i) => (
          <div key={msg.id || `msg-${msg.timestamp || i}`} className="message-item">
            <span className="message-user">{msg.user}: </span>
            <span className="message-text">{msg.text}</span>
          </div>
        ))}
      </div>
      
      {/* Input Area */}
      {activeTab === 'chat' && (
        <div className="message-input-area">
          <input 
            type="text" 
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Type message..." 
            className="message-input"
          />
          <button onClick={handleSend} className="send-btn">Send</button>
        </div>
      )}
    </div>
  );
};

export default UniversalGameRoom;
