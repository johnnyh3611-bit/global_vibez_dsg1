import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Users } from 'lucide-react';

import BackButton from '../BackButton';
import SocialOverlay from '../social/SocialOverlay';
import useBlackjackSocket from '../../hooks/useBlackjackSocket';
import { useSocialSocket } from '../../hooks/useSocialSocket';

import HUDPanel from './blackjack/HUDPanel';
import DealerSection from './blackjack/DealerSection';
import PlayerHand from './blackjack/PlayerHand';
import BettingPanel from './blackjack/BettingPanel';
import ActionButtons from './blackjack/ActionButtons';
import ResultPanel from './blackjack/ResultPanel';
import GameLogPanel from './blackjack/GameLogPanel';
import LiveStatusIndicator from './blackjack/LiveStatusIndicator';
import { parseCard, calculateScore } from './blackjack/utils';
import { LOUNGE } from './blackjack/loungeTheme';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function BlackjackGameSimple() {
  const [credits, setCredits] = useState(1000);
  const [currentBet, setCurrentBet] = useState(0);
  const [chipValue, setChipValue] = useState(25);
  const [gameStatus, setGameStatus] = useState('BETTING'); // BETTING | DEALING | PLAYER_TURN | DEALER_TURN | RESULT
  const [playerHands, setPlayerHands] = useState([[]]);
  const [currentHandIndex, setCurrentHandIndex] = useState(0);
  const [betAmounts, setBetAmounts] = useState([0]);
  const [dealerHand, setDealerHand] = useState([]);
  const [playerScores, setPlayerScores] = useState([0]);
  const [dealerScore, setDealerScore] = useState(0);
  const [results, setResults] = useState([null]);
  const [sessionId, setSessionId] = useState(null);
  const [gameLogs, setGameLogs] = useState([]);
  const [showGameLog, setShowGameLog] = useState(false);

  // Social state
  const [showSocialOverlay, setShowSocialOverlay] = useState(false);
  const [nearbyPlayers, setNearbyPlayers] = useState([]);

  // Sockets
  const [roomId] = useState(`blackjack-${Date.now()}`);
  const [username] = useState(`Player${Math.floor(Math.random() * 1000)}`);
  const socketData = useBlackjackSocket(roomId, sessionId, username);
  const connected = socketData?.connected || false;
  const players = socketData?.players || [];
  const spectators = socketData?.spectators || 0;
  const broadcastAction = socketData?.broadcastAction || (() => {});

  const {
    isConnected,
    joinGameRoom,
    leaveGameRoom,
    onPlayerJoinedGame,
    onPlayerLeftGame,
  } = useSocialSocket('current_user', username);

  // Responsive body-zoom (keep behavior)
  useEffect(() => {
    const handleResize = () => {
      document.body.style.zoom = window.innerWidth < 600 ? '0.9' : '1.0';
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Social room join/leave
  useEffect(() => {
    if (!isConnected) return;
    joinGameRoom('blackjack', 'table_main_1').catch(() => {});
    return () => {
      if (isConnected) leaveGameRoom('blackjack', 'table_main_1');
    };
  }, [joinGameRoom, leaveGameRoom, isConnected]);

  const fetchNearbyPlayers = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/social/nearby-players`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: 'current_user',
          game_id: 'blackjack',
          table_id: 'table_main_1',
        }),
      });
      const data = await response.json();
      setNearbyPlayers(data.players || []);
    } catch (error) {
      // silent
    }
  }, []);

  useEffect(() => {
    const unsubJoin = onPlayerJoinedGame(() => fetchNearbyPlayers());
    const unsubLeave = onPlayerLeftGame(() => fetchNearbyPlayers());
    return () => {
      unsubJoin();
      unsubLeave();
    };
  }, [onPlayerJoinedGame, onPlayerLeftGame, fetchNearbyPlayers]);

  const handleSendVibe = async (player) => {
    try {
      await fetch(`${API_URL}/api/social/send-vibe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from_user_id: 'current_user',
          to_user_id: player.id,
          vibe_type: 'drink',
          message: 'Great game!',
        }),
      });
    } catch (error) {
      // silent
    }
  };

  const addLog = (action, details) => {
    const timestamp = new Date().toLocaleTimeString();
    setGameLogs((prev) => [{ timestamp, action, details }, ...prev].slice(0, 20));
  };

  // Betting actions
  const placeBet = () => {
    if (gameStatus !== 'BETTING' || credits < chipValue) return;
    setCurrentBet(currentBet + chipValue);
    setCredits((prev) => prev - chipValue);
    addLog('BET_PLACED', `Added $${chipValue} chip to bet`);
  };

  const clearBet = () => {
    if (gameStatus !== 'BETTING') return;
    setCredits((prev) => prev + currentBet);
    setCurrentBet(0);
    addLog('BET_CLEARED', 'Bet cleared');
  };

  const deal = async () => {
    if (currentBet === 0) return;
    setGameStatus('DEALING');
    addLog('DEAL', `Dealing cards with $${currentBet} bet`);
    try {
      const response = await fetch(`${API_URL}/api/blackjack/deal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player_id: 'player_1',
          bet_amount: currentBet,
          side_bets: {},
          lightning_active: false,
          client_seed: Math.random().toString(36).substring(7),
        }),
      });
      const data = await response.json();
      if (!data.session_id || !Array.isArray(data.player_cards)) {
        addLog('ERROR', 'Invalid server response');
        setGameStatus('BETTING');
        return;
      }
      setSessionId(data.session_id);
      setPlayerHands([data.player_cards]);
      setBetAmounts([currentBet]);
      setDealerHand([data.dealer_up_card, 'BACK']);
      setTimeout(() => {
        const score = calculateScore(data.player_cards);
        setPlayerScores([score]);
        setGameStatus('PLAYER_TURN');
        addLog(
          'CARDS_DEALT',
          `Player: ${data.player_cards?.join(', ') || 'N/A'} (${score}) | Dealer: ${data.dealer_up_card} + ?`
        );
      }, 1000);
    } catch (error) {
      setGameStatus('BETTING');
      addLog('ERROR', 'Failed to deal cards');
    }
  };

  const endGame = (data) => {
    setGameStatus('RESULT');
    setDealerHand(data.dealer_cards);
    setDealerScore(calculateScore(data.dealer_cards));
    const newResults = [...results];
    newResults[currentHandIndex] = data.winner;
    setResults(newResults);

    const winnerText =
      data.winner === 'player' ? 'YOU WIN!' : data.winner === 'dealer' ? 'DEALER WINS' : 'PUSH';
    addLog(
      'RESULT',
      `Hand ${currentHandIndex + 1}: ${winnerText} (P:${playerScores[currentHandIndex]} vs D:${calculateScore(data.dealer_cards)})`
    );
    if (data.payout > 0) {
      setCredits((prev) => prev + data.payout);
      addLog('PAYOUT', `Won ₵${data.payout - betAmounts[currentHandIndex]}`);
    }
  };

  const hit = async () => {
    if (!sessionId || gameStatus !== 'PLAYER_TURN') return;
    addLog('HIT', `Hand ${currentHandIndex + 1} requests card`);
    try {
      const response = await fetch(`${API_URL}/api/blackjack/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, action: 'hit', hand_index: currentHandIndex }),
      });
      const data = await response.json();
      const newHands = [...playerHands];
      newHands[currentHandIndex] = data.player_cards;
      setPlayerHands(newHands);
      const newScores = [...playerScores];
      newScores[currentHandIndex] = calculateScore(data.player_cards);
      setPlayerScores(newScores);
      addLog(
        'CARD_DEALT',
        `Drew ${data.player_cards[data.player_cards.length - 1]} (Total: ${newScores[currentHandIndex]})`
      );

      if (data.game_over) {
        addLog('BUST', `Hand ${currentHandIndex + 1} busted with ${newScores[currentHandIndex]}`);
        broadcastAction('hit', currentHandIndex, {
          playerHands: newHands,
          playerScores: newScores,
          busted: true,
        });
        if (currentHandIndex < playerHands.length - 1) {
          addLog('NEXT_HAND', `Moving to Hand ${currentHandIndex + 2}`);
          setCurrentHandIndex(currentHandIndex + 1);
        } else {
          setTimeout(() => endGame(data), 500);
        }
      } else {
        broadcastAction('hit', currentHandIndex, {
          playerHands: newHands,
          playerScores: newScores,
        });
      }
    } catch (error) {
      addLog('ERROR', 'Failed to hit');
    }
  };

  const stand = async () => {
    if (!sessionId || gameStatus !== 'PLAYER_TURN') return;
    addLog('STAND', `Hand ${currentHandIndex + 1} stands with ${playerScores[currentHandIndex]}`);
    broadcastAction('stand', currentHandIndex, { playerHands, playerScores, currentHandIndex });

    if (currentHandIndex < playerHands.length - 1) {
      addLog('NEXT_HAND', `Moving to Hand ${currentHandIndex + 2}`);
      setCurrentHandIndex(currentHandIndex + 1);
      return;
    }

    setGameStatus('DEALER_TURN');
    try {
      const response = await fetch(`${API_URL}/api/blackjack/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          action: 'stand',
          hand_index: currentHandIndex,
        }),
      });
      const data = await response.json();
      if (!Array.isArray(data.dealer_cards)) {
        addLog('ERROR', 'Invalid server response');
        return;
      }
      setDealerHand(data.dealer_cards);
      const dScore = calculateScore(data.dealer_cards);
      setDealerScore(dScore);
      addLog('DEALER_REVEAL', `Dealer flips: ${data.dealer_cards?.join(', ') || 'N/A'} (${dScore})`);
      setTimeout(() => endGame(data), 1000);
    } catch (error) {
      addLog('ERROR', 'Failed to stand');
    }
  };

  const doubleDown = async () => {
    if (!sessionId || gameStatus !== 'PLAYER_TURN' || credits < betAmounts[currentHandIndex]) return;
    const betAmount = betAmounts[currentHandIndex];
    setCredits((prev) => prev - betAmount);
    const newBetAmounts = [...betAmounts];
    newBetAmounts[currentHandIndex] = betAmount * 2;
    setBetAmounts(newBetAmounts);
    addLog('DOUBLE', `Doubled bet to $${betAmount * 2} on Hand ${currentHandIndex + 1}`);
    try {
      const response = await fetch(`${API_URL}/api/blackjack/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          action: 'double',
          hand_index: currentHandIndex,
        }),
      });
      const data = await response.json();
      if (!Array.isArray(data.player_cards) || !Array.isArray(data.dealer_cards)) {
        addLog('ERROR', 'Invalid server response for double down');
        setGameStatus('PLAYER_TURN');
        return;
      }
      const newHands = [...playerHands];
      newHands[currentHandIndex] = data.player_cards;
      setPlayerHands(newHands);
      const newScores = [...playerScores];
      newScores[currentHandIndex] = calculateScore(data.player_cards);
      setPlayerScores(newScores);
      addLog(
        'CARD_DEALT',
        `Drew ${data.player_cards[data.player_cards.length - 1]} (Total: ${newScores[currentHandIndex]})`
      );
      setGameStatus('DEALER_TURN');
      setTimeout(() => {
        setDealerHand(data.dealer_cards);
        setDealerScore(calculateScore(data.dealer_cards));
        addLog(
          'DEALER_PLAYS',
          `Dealer: ${data.dealer_cards?.join(', ') || 'N/A'} (${calculateScore(data.dealer_cards)})`
        );
        setTimeout(() => endGame(data), 800);
      }, 600);
    } catch (error) {
      addLog('ERROR', 'Failed to double');
    }
  };

  const split = () => {
    const currentHand = playerHands[currentHandIndex];
    if (!currentHand || currentHand.length !== 2) return;
    const card1 = parseCard(currentHand[0]);
    const card2 = parseCard(currentHand[1]);
    if (card1?.val !== card2?.val) return;
    if (credits < betAmounts[currentHandIndex]) return;

    setCredits((prev) => prev - betAmounts[currentHandIndex]);
    const hand1 = [currentHand[0]];
    const hand2 = [currentHand[1]];
    const newHands = [...playerHands];
    newHands[currentHandIndex] = hand1;
    newHands.push(hand2);
    setPlayerHands(newHands);

    const newBetAmounts = [...betAmounts];
    newBetAmounts.push(betAmounts[currentHandIndex]);
    setBetAmounts(newBetAmounts);

    const newScores = [...playerScores];
    newScores[currentHandIndex] = calculateScore(hand1);
    newScores.push(calculateScore(hand2));
    setPlayerScores(newScores);

    const newResults = [...results];
    newResults.push(null);
    setResults(newResults);

    addLog('SPLIT', `Split pair of ${card1.val}s. Bet: $${betAmounts[currentHandIndex]} per hand`);
  };

  const newRound = () => {
    setGameStatus('BETTING');
    setPlayerHands([[]]);
    setDealerHand([]);
    setPlayerScores([0]);
    setDealerScore(0);
    setCurrentBet(0);
    setBetAmounts([0]);
    setResults([null]);
    setSessionId(null);
    setCurrentHandIndex(0);
    addLog('NEW_ROUND', 'Starting new round');
  };

  return (
    <div
      className="relative min-h-screen w-full"
      style={{ background: LOUNGE.roomBg }}
    >
      <BackButton to="/games" label="Back" variant="casino" />

      <LiveStatusIndicator
        connected={connected}
        playerCount={players.length}
        spectatorCount={spectators}
      />

      <motion.button
        data-testid="game-log-toggle"
        onClick={() => setShowGameLog(!showGameLog)}
        className="fixed top-36 right-5 z-50 px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all"
        style={{
          background: LOUNGE.bg.charcoal,
          color: LOUNGE.goldLight,
          border: `1px solid ${LOUNGE.goldDark}`,
          fontFamily: LOUNGE.fontBody,
          boxShadow: LOUNGE.shadow.soft,
        }}
        whileHover={{ scale: 1.05, y: -2 }}
        whileTap={{ scale: 0.95 }}
      >
        <span>Game Log</span>
        {gameLogs.length > 0 && (
          <span
            className="text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={{ background: LOUNGE.gold, color: '#1a0f08' }}
          >
            {gameLogs.length}
          </span>
        )}
      </motion.button>

      <motion.button
        data-testid="players-toggle"
        onClick={() => {
          setShowSocialOverlay(true);
          fetchNearbyPlayers();
        }}
        className="fixed top-52 right-5 z-50 px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all"
        style={{
          background: LOUNGE.bg.burgundy,
          color: '#f5e6d3',
          border: `1px solid ${LOUNGE.goldDark}`,
          fontFamily: LOUNGE.fontBody,
          boxShadow: LOUNGE.shadow.soft,
        }}
        whileHover={{ scale: 1.05, y: -2 }}
        whileTap={{ scale: 0.95 }}
      >
        <Users className="w-4 h-4" />
        <span>Players</span>
        {nearbyPlayers.length > 0 && (
          <span
            className="text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={{ background: LOUNGE.gold, color: '#1a0f08' }}
          >
            {nearbyPlayers.length}
          </span>
        )}
      </motion.button>

      <SocialOverlay
        visible={showSocialOverlay}
        onClose={() => setShowSocialOverlay(false)}
        nearbyPlayers={nearbyPlayers}
        onSendVibe={handleSendVibe}
      />

      <GameLogPanel
        open={showGameLog}
        logs={gameLogs}
        onClose={() => setShowGameLog(false)}
      />

      <div
        className="relative min-h-screen flex items-center justify-center p-4 sm:p-8"
        style={{
          background: LOUNGE.roomBg,
          backgroundBlendMode: 'normal',
        }}
      >
        {/* Soft amber overhead spotlight */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: LOUNGE.spotlightBg }}
        />
        {/* Subtle wood-grain atmosphere */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ backgroundImage: LOUNGE.woodGrain, mixBlendMode: 'overlay', opacity: 0.5 }}
        />

        <HUDPanel credits={credits} currentBet={currentBet} />

        {/* Leather rail around the felt */}
        <div
          className="relative w-full max-w-6xl h-[calc(100vh-120px)] rounded-[32px] flex flex-col items-center justify-between p-2"
          style={{
            background: LOUNGE.leatherRail,
            boxShadow: `${LOUNGE.shadow.deep}, 0 0 0 1px ${LOUNGE.goldDark}`,
          }}
        >
          {/* Inner felt table */}
          <div
            className="relative w-full h-full rounded-[28px] flex flex-col items-center justify-between p-6 overflow-hidden"
            style={{
              background: LOUNGE.feltBg,
              border: `1.5px solid ${LOUNGE.goldDark}`,
              boxShadow: 'inset 0 0 80px rgba(0,0,0,0.6), inset 0 2px 0 rgba(255,193,94,0.08)',
            }}
            data-testid="blackjack-table"
          >
            {/* Gold inner circle (table seal) */}
            <div
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[70%] aspect-[1.4/1] rounded-full pointer-events-none"
              style={{
                border: `1px dashed ${LOUNGE.goldDark}`,
                opacity: 0.35,
              }}
            />

            <DealerSection dealerHand={dealerHand} />

            <div className="flex flex-col items-center gap-6 sm:gap-8 relative z-10">
              <PlayerHand hand={playerHands[0]} />

              {gameStatus === 'BETTING' && (
                <BettingPanel
                  currentBet={currentBet}
                  chipValue={chipValue}
                  setChipValue={setChipValue}
                  placeBet={placeBet}
                  clearBet={clearBet}
                  deal={deal}
                />
              )}

              {gameStatus === 'PLAYER_TURN' && (
                <ActionButtons
                  playerHands={playerHands}
                  currentHandIndex={currentHandIndex}
                  credits={credits}
                  betAmounts={betAmounts}
                  onHit={hit}
                  onStand={stand}
                  onDouble={doubleDown}
                  onSplit={split}
                />
              )}

              {gameStatus === 'RESULT' && (
                <ResultPanel
                  result={results[currentHandIndex]}
                  playerScore={playerScores[currentHandIndex]}
                  dealerScore={dealerScore}
                  onNewRound={newRound}
                />
              )}
            </div>

            {/* Watermark score */}
            <div className="absolute right-8 sm:right-20 top-1/2 -translate-y-1/2 text-right hidden sm:block">
              {playerScores[0] > 0 && (
                <>
                  <div
                    className="text-5xl sm:text-6xl font-black italic select-none tabular-nums"
                    style={{
                      color: 'rgba(212, 175, 55, 0.14)',
                      fontFamily: LOUNGE.fontDisplay,
                    }}
                  >
                    {playerScores[0]}
                  </div>
                  <div
                    className="text-[10px] font-bold tracking-[0.3em] uppercase"
                    style={{ color: 'rgba(212, 175, 55, 0.4)' }}
                  >
                    Current Total
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
