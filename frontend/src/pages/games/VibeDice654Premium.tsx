import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { DollarSign, Brain } from 'lucide-react';
import vibezEngine from '@/utils/GlobalVibezEngine';

import RoomMenuBar from '@/components/games/RoomMenuBar';
import NovaDealerHeader from '@/components/games/vibedice654/NovaDealerHeader';

// Founder ask 2026-02-19: "Take Nova out the room and it'll probably make
// the room look better. The room, you gotta scroll down and up when you
// looking on the phone — it don't look right. So Nova gotta go."
// Replaced with a no-op so the dealerMessage / dealerMood props remain
// wired throughout the file but render nothing on the table.
const NovaDealerRetiredHeader = () => null;
import LockInProgress from '@/components/games/vibedice654/LockInProgress';
import DiceTable from '@/components/games/vibedice654/DiceTable';
import SideBetResultsPanel from '@/components/games/vibedice654/SideBetResultsPanel';
import BettingControls from '@/components/games/vibedice654/BettingControls';
import SideBetsPanel from '@/components/games/vibedice654/SideBetsPanel';
import PointPredictionModal from '@/components/games/vibedice654/PointPredictionModal';
import RecentRollsPanel from '@/components/games/vibedice654/RecentRollsPanel';
import WinCelebrationModal from '@/components/games/vibedice654/WinCelebrationModal';
import { MAX_SIDE_BETS } from '@/components/games/vibedice654/constants';
import { motion, AnimatePresence } from 'framer-motion';

import '../../styles/vibez-pro.css';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const getAuthToken = (): string | null => {
  const token = localStorage.getItem('token') || localStorage.getItem('auth_token');
  if (!token || token === 'null' || token === 'undefined') return null;
  return token;
};

/** Resolve the real authenticated user id (demo-login or email auth). */
const getStoredUserId = (): string => {
  return (
    localStorage.getItem('userId') ||
    localStorage.getItem('user_id') ||
    'demo_user'
  );
};

export default function VibeDice654Premium() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string>(getStoredUserId());
  const [tableId, setTableId] = useState<string>('');
  const [balance, setBalance] = useState(0);

  // Betting
  const [mainBet, setMainBet] = useState(0);
  const [sideBets, setSideBets] = useState({});
  const [sideBetInsurance, setSideBetInsurance] = useState({});
  const [selectedChip, setSelectedChip] = useState(10);
  const [predictedPoint, setPredictedPoint] = useState(null);
  const [showPointSelector, setShowPointSelector] = useState(false);

  // Panel visibility
  const [showSideBetsPanel, setShowSideBetsPanel] = useState(false);
  const [showRecentRollsPanel, setShowRecentRollsPanel] = useState(false);
  const [showSideBetResultsPanel, setShowSideBetResultsPanel] = useState(false);

  // Game state machine
  const [rollsRemaining, setRollsRemaining] = useState(3);
  const [gamePhase, setGamePhase] = useState('IDLE'); // IDLE | ROLLING | DECISION | COMPLETE
  const [isQualified, setIsQualified] = useState(false);
  const [lockedDice, setLockedDice] = useState([]);
  const [pointDice, setPointDice] = useState([]);
  const [currentPointScore, setCurrentPointScore] = useState(0);
  const [currentDiceRoll, setCurrentDiceRoll] = useState([]);
  const [dealerEnvy] = useState(0);

  // Multi-roll
  const [allRollsData, setAllRollsData] = useState(null);
  const [currentRollIndex, setCurrentRollIndex] = useState(0);

  // Side bet results
  const [sideBetResults, setSideBetResults] = useState([]);
  const [showSideBetResults, setShowSideBetResults] = useState(false);

  // Win celebration
  const [showWinCelebration, setShowWinCelebration] = useState(false);
  const [totalWinAmount, setTotalWinAmount] = useState(0);

  // Misc
  const [rollHistory, setRollHistory] = useState([]);
  const [dealerMessage, setDealerMessage] = useState('');
  const [dealerMood, setDealerMood] = useState('professional');

  // Fetch balance — tries wallets endpoint first, falls back to /auth/me
  // (demo accounts don't have a wallets row; they carry credits_balance on
  // the users doc). Mirrors the Solo Vault's dual-wallet handling.
  const fetchBalance = useCallback(async () => {
    try {
      const token = getAuthToken();
      if (!token) return;

      // 1) /auth/me is the source of truth for demo users — they carry
      //    credits_balance on the users doc, not a separate wallets row.
      try {
        const meRes = await fetch(`${API_URL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (meRes.ok) {
          const me = await meRes.json();
          const u = me?.user ?? me ?? {};
          const bal =
            (typeof u.token_balance === 'number' && u.token_balance) ||
            (typeof u.credits_balance === 'number' && u.credits_balance) ||
            0;
          if (bal > 0) {
            setBalance(bal);
            vibezEngine.walletBalance = bal;
            return;
          }
        }
      } catch { /* fall through */ }

      // 2) Fallback to the canonical wallets row (zero-balance ok here).
      try {
        const res = await fetch(`${API_URL}/api/wallet/balance/${userId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data?.success && typeof data.balance === 'number') {
          setBalance(data.balance);
          vibezEngine.walletBalance = data.balance;
        }
      } catch { /* silent */ }
    } catch {
      /* silent */
    }
  }, [userId]);

  // Resolve a real table_id once — pick the first active table or create one.
  const resolveTableId = useCallback(async () => {
    try {
      const r = await fetch(`${API_URL}/api/games/vibe654/tables/active`);
      const data = await r.json();
      const rows = (data?.tables || []) as Array<{ table_id: string }>;
      const live = rows.find((t) => t.table_id && t.table_id.length > 0);
      if (live) {
        setTableId(live.table_id);
        return;
      }
      // No live table → create one.
      const cr = await fetch(`${API_URL}/api/games/vibe654/create-table`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table_id: `tbl_${Date.now().toString(36)}`,
          name: 'Vibe Dice 654',
          min_bet: 5,  // Vibe Dice 654 exception — uses 5-coin starter chip
          max_bet: 500,
        }),
      });
      const created = await cr.json();
      const tid =
        created?.table_id ||
        created?.table?.table_id ||
        `tbl_${Date.now().toString(36)}`;
      setTableId(tid);
    } catch {
      setTableId(`tbl_${Date.now().toString(36)}`);
    }
  }, []);

  useEffect(() => {
    // Re-pick the user id on mount in case the page was opened in a fresh
    // session and localStorage has been updated since the initial render.
    setUserId(getStoredUserId());
    setDealerMessage(vibezEngine.getDealerGreeting());
    fetchBalance();
    resolveTableId();
  }, [fetchBalance, resolveTableId]);

  // Betting actions
  const handleMainBet = () => {
    const result = vibezEngine.handleBet(selectedChip, 'main');
    if (!result.success) {
      setDealerMessage(result.message);
      setDealerMood('professional');
      return;
    }
    setMainBet((prev) => prev + selectedChip);
    setBalance(result.balance);
    setDealerMessage(result.message);
    setDealerMood('professional');
  };

  const handleSideBet = (betId) => {
    if (Object.keys(sideBets).length >= MAX_SIDE_BETS && !sideBets[betId]) {
      setDealerMessage(`Maximum ${MAX_SIDE_BETS} side bets allowed. Clear some bets first.`);
      setDealerMood('professional');
      return;
    }
    if (betId === 'POINT_PREDICTION' && !predictedPoint) {
      setShowPointSelector(true);
      return;
    }
    const result = vibezEngine.handleBet(selectedChip, `side_${betId}`);
    if (!result.success) {
      setDealerMessage(result.message);
      return;
    }
    setSideBets((prev) => ({ ...prev, [betId]: (prev[betId] || 0) + selectedChip }));
    setBalance(result.balance);
    setDealerMessage(result.message);
  };

  const selectPredictedPoint = (point) => {
    setPredictedPoint(point);
    setShowPointSelector(false);
    const result = vibezEngine.handleBet(selectedChip, 'side_POINT_PREDICTION');
    if (!result.success) {
      setDealerMessage(result.message);
      setPredictedPoint(null);
      return;
    }
    setSideBets((prev) => ({
      ...prev,
      POINT_PREDICTION: (prev['POINT_PREDICTION'] || 0) + selectedChip,
    }));
    setBalance(result.balance);
    setDealerMessage(`Point Prediction: ${point}. Let's roll!`);
  };

  const clearBets = () => {
    const totalBets = mainBet + (Object.values(sideBets) as number[]).reduce((a, b) => a + b, 0);
    setBalance((prev) => prev + totalBets);
    vibezEngine.walletBalance += totalBets;
    setMainBet(0);
    setSideBets({});
    setSideBetInsurance({});
    setPredictedPoint(null);
    setDealerMessage('Bets cleared. Ready when you are.');
  };

  const newRound = () => {
    setMainBet(0);
    setSideBets({});
    setSideBetInsurance({});
    setPredictedPoint(null);
    setRollsRemaining(3);
    setGamePhase('IDLE');
    setIsQualified(false);
    setCurrentPointScore(0);
    setLockedDice([]);
    setPointDice([]);
    setCurrentDiceRoll([]);
    setAllRollsData(null);
    setCurrentRollIndex(0);
    setSideBetResults([]);
    setShowSideBetResults(false);
    window.currentRollId = null;
    setDealerMessage(vibezEngine.getDealerMoodPhrase('professional'));
    setDealerMood('professional');
  };

  // Stand / Re-roll server actions
  const handleStand = async () => {
    if (!window.currentRollId) {
      setDealerMessage('No active roll to stand on.');
      return;
    }
    setDealerMessage('Locking in your score...');
    setDealerMood('professional');
    try {
      const token = getAuthToken();
      const res = await fetch(
        `${API_URL}/api/games/vibe654/stand?roll_id=${window.currentRollId}&user_id=${userId}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      if (data.success) {
        setDealerMessage(data.nova_reaction.message);
        setDealerMood(data.nova_reaction.mood);
        setBalance((prev) => prev + data.payout);
        vibezEngine.walletBalance += data.payout;
        setGamePhase('COMPLETE');
        setTimeout(newRound, 3000);
      }
    } catch (err) {
      setDealerMessage('Error processing stand. Try again.');
    }
  };

  const handleReRoll = async () => {
    if (!window.currentRollId) {
      setDealerMessage('No active roll to re-roll.');
      return;
    }
    if (rollsRemaining <= 0) {
      setDealerMessage('No rolls left. You must stand.');
      return;
    }
    setDealerMessage('Going for the gold. I like the hustle.');
    setDealerMood('professional');
    try {
      const token = getAuthToken();
      const res = await fetch(
        `${API_URL}/api/games/vibe654/reroll-point-dice?roll_id=${window.currentRollId}&user_id=${userId}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      if (data.success) {
        setCurrentPointScore(data.new_point_score);
        setRollsRemaining(data.rolls_left);
        setDealerMessage(data.nova_reaction.message);
        setDealerMood(data.nova_reaction.mood);
        setPointDice(data.new_point_dice);
      }
    } catch (err) {
      setDealerMessage('Error processing re-roll. Try again.');
    }
  };

  // Roll dice (server)
  const rollDice = async () => {
    if (mainBet === 0) {
      setDealerMessage("Place a main bet first, then we'll roll.");
      return;
    }
    setGamePhase('ROLLING');
    setDealerMessage('Dice are live!');
    setDealerMood('professional');

    try {
      const sideBetsArray = Object.entries(sideBets).map(([type, amount]) => ({
        type,
        amount,
        has_insurance: sideBetInsurance[type] || false,
        predicted_point: type === 'POINT_PREDICTION' ? predictedPoint : null,
      }));

      const token = getAuthToken();
      const res = await fetch(`${API_URL}/api/games/vibe654/play`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          user_id: userId,
          table_id: tableId,
          main_bet: mainBet,
          side_bets: sideBetsArray,
          dealer_personality: 'nova',
        }),
      });
      const data = await res.json();
      if (!data.success) return;

      setAllRollsData(data);
      setCurrentRollIndex(0);
      const firstRoll = data.all_rolls[0] || [];
      const gameResult = data.game_result;

      setCurrentDiceRoll(firstRoll);
      setRollsRemaining(data.all_rolls.length - 1);

      if (data.side_bet_results && data.side_bet_results.length > 0) {
        setSideBetResults(data.side_bet_results);
        setShowSideBetResults(true);
        const totalSideBetWin = data.side_bet_payout || 0;
        if (totalSideBetWin > 0) {
          const winningBets = data.side_bet_results.map((r) => r.bet_type).join(', ');
          setDealerMessage(`Side Bet WIN! Hit: ${winningBets} for $${totalSideBetWin.toFixed(2)}`);
          setDealerMood('celebrating');
          setTimeout(() => {
            setShowSideBetResults(false);
            setSideBetResults([]);
          }, 4000);
        }
      } else if (Object.keys(sideBets).length > 0) {
        setShowSideBetResults(false);
      }

      setTimeout(() => {
        const lockedAfterRoll1 = [];
        const displayDice = [...firstRoll];

        if (gameResult.has_6 && displayDice.includes(6)) {
          lockedAfterRoll1.push(6);
          displayDice.splice(displayDice.indexOf(6), 1);
        }
        if (lockedAfterRoll1.includes(6) && gameResult.has_5 && displayDice.includes(5)) {
          lockedAfterRoll1.push(5);
          displayDice.splice(displayDice.indexOf(5), 1);
        }
        if (lockedAfterRoll1.includes(5) && gameResult.has_4 && displayDice.includes(4)) {
          lockedAfterRoll1.push(4);
          displayDice.splice(displayDice.indexOf(4), 1);
        }

        setLockedDice(lockedAfterRoll1);
        setCurrentDiceRoll(displayDice);

        if (data.all_rolls.length > 1 && !gameResult.qualified) {
          setGamePhase('ROLLING');
          setDealerMessage('Ready for next roll - click ROLL AGAIN when ready!');
          setDealerMood('professional');
        } else {
          setTimeout(() => {
            setLockedDice(gameResult.locked_numbers || []);
            setPointDice(gameResult.point_dice || []);
            setIsQualified(gameResult.qualified);
            setCurrentPointScore(gameResult.point_score);
            if (gameResult.qualified) setCurrentDiceRoll(gameResult.point_dice || []);
            fetchBalance();
            setGamePhase('COMPLETE');
            setDealerMessage(data.nova_reaction?.message || 'Roll complete!');
            setDealerMood(data.nova_reaction?.mood || 'professional');
            setRollHistory((prev) => [data, ...prev].slice(0, 10));
          }, 400);
        }
      }, 800);
    } catch (err) {
      setGamePhase('IDLE');
      setDealerMessage("System error. Let's try that again.");
    }
  };

  const handleRollAgain = () => {
    if (!allRollsData || currentRollIndex >= allRollsData.all_rolls.length - 1) return;
    const nextIndex = currentRollIndex + 1;
    setCurrentRollIndex(nextIndex);
    const nextRoll = allRollsData.all_rolls[nextIndex];
    const gameResult = allRollsData.game_result;
    const currentLocked = [...lockedDice];

    setCurrentDiceRoll(nextRoll);
    setRollsRemaining(allRollsData.all_rolls.length - nextIndex - 1);

    setTimeout(() => {
      const displayDice = [...nextRoll];
      const newLocked = [...currentLocked];
      if (!newLocked.includes(6) && gameResult.has_6 && displayDice.includes(6)) {
        newLocked.push(6);
        displayDice.splice(displayDice.indexOf(6), 1);
      }
      if (newLocked.includes(6) && !newLocked.includes(5) && gameResult.has_5 && displayDice.includes(5)) {
        newLocked.push(5);
        displayDice.splice(displayDice.indexOf(5), 1);
      }
      if (newLocked.includes(5) && !newLocked.includes(4) && gameResult.has_4 && displayDice.includes(4)) {
        newLocked.push(4);
        displayDice.splice(displayDice.indexOf(4), 1);
      }
      setLockedDice(newLocked);
      setCurrentDiceRoll(displayDice);
    }, 800);

    if (nextIndex >= allRollsData.all_rolls.length - 1) {
      setTimeout(() => {
        setLockedDice(gameResult.locked_numbers || []);
        setPointDice(gameResult.point_dice || []);
        setIsQualified(gameResult.qualified);
        setCurrentPointScore(gameResult.point_score);
        if (gameResult.qualified) setCurrentDiceRoll(gameResult.point_dice || []);
        fetchBalance();
        const totalPayout = allRollsData.pot_info?.winner_payout || 0;
        if (gameResult.qualified && totalPayout > 0) {
          setTotalWinAmount(totalPayout);
          setShowWinCelebration(true);
          setTimeout(() => setShowWinCelebration(false), 3000);
        }
        setGamePhase('COMPLETE');
        setDealerMessage(allRollsData.nova_reaction?.message || 'Roll complete!');
        setDealerMood(allRollsData.nova_reaction?.mood || 'professional');
        setRollHistory((prev) => [allRollsData, ...prev].slice(0, 10));
      }, 1500);
    }
  };

  return (
    <div
      className="h-[100dvh] flex flex-col overflow-hidden text-white relative bg-[radial-gradient(ellipse_at_top,_#2a1848_0%,_#0a0014_60%,_#000_100%)]"
      data-testid="vibedice-page"
    >
      {/* marble floor texture matching the Solo Vault aesthetic */}
      <div
        className="absolute inset-0 opacity-30 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(115deg, rgba(255,255,255,0.04) 0%, transparent 40%), radial-gradient(circle at 30% 60%, rgba(251,191,36,0.08), transparent 50%)',
        }}
        aria-hidden
      />
      {/* subtle gold orbit ring at the edges */}
      <div
        className="absolute inset-0 opacity-40 pointer-events-none"
        style={{
          background:
            'conic-gradient(from 0deg, rgba(251,191,36,0.08), transparent 25%, rgba(217,70,239,0.08) 50%, transparent 75%, rgba(251,191,36,0.08))',
        }}
        aria-hidden
      />

      <RoomMenuBar
        theme="vibe654"
        title="Vibe Dice 6-5-4"
        subtitle="Nova's Parlour · 5 dice · Max 3 rolls"
        icon={<Brain className="w-4 h-4" />}
        backTo="/games"
        testIdSuffix="vibe654"
        rightSlot={
          <div className="flex items-center gap-2" data-testid="balance-chip">
            <div className="flex flex-col items-end leading-tight">
              <span className="text-[9px] uppercase tracking-[0.3em] text-amber-300/80">
                Stack
              </span>
              <span className="text-sm font-black text-emerald-300">
                ₵{Math.round(balance).toLocaleString()}
              </span>
            </div>
            <button
              data-testid="topup-wallet-btn"
              type="button"
              onClick={() => navigate('/wallet')}
              className="hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-600/20 border border-emerald-400/40 text-emerald-200 text-[10px] font-bold uppercase tracking-wider hover:bg-emerald-600/30"
            >
              <DollarSign className="w-3 h-3" /> Top Up
            </button>
          </div>
        }
      />

      <NovaDealerRetiredHeader />

      {/* MAIN — locked-height scrollable play area; only this region
          scrolls if content overflows on very small phones. Founder
          confirmed the original "perfect" build kept overflow-y-auto
          so chip drawer + sidebets stay reachable on mobile. */}
      <main className="flex-1 min-h-0 overflow-y-auto px-3 sm:px-5 lg:px-6 py-3">
        <div className="max-w-3xl mx-auto space-y-3">
          {gamePhase !== 'IDLE' && (
            <LockInProgress
              lockedDice={lockedDice}
              rollsRemaining={rollsRemaining}
              isQualified={isQualified}
              currentPointScore={currentPointScore}
            />
          )}

          <DiceTable
            currentDiceRoll={currentDiceRoll}
            lockedDice={lockedDice}
            gamePhase={gamePhase}
            isQualified={isQualified}
            currentPointScore={currentPointScore}
            dealerEnvy={dealerEnvy}
          />

          <SideBetResultsPanel
            showSideBetResults={showSideBetResults}
            sideBetResults={sideBetResults}
            sideBets={sideBets}
            showSideBetResultsPanel={showSideBetResultsPanel}
            setShowSideBetResultsPanel={setShowSideBetResultsPanel}
          />

          <AnimatePresence>
            {gamePhase !== 'IDLE' && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="glass-card p-2.5 bg-gradient-to-r from-red-900/60 to-orange-900/60 border-2 border-red-500 rounded-xl"
                data-testid="betting-closed-banner"
              >
                <p className="text-red-300 font-black text-center text-sm">
                  🔒 BETTING CLOSED — round in progress
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          <BettingControls
            selectedChip={selectedChip}
            setSelectedChip={setSelectedChip}
            mainBet={mainBet}
            sideBets={sideBets}
            sideBetInsurance={sideBetInsurance}
            setSideBetInsurance={setSideBetInsurance}
            gamePhase={gamePhase}
            rollsRemaining={rollsRemaining}
            currentPointScore={currentPointScore}
            handleMainBet={handleMainBet}
            handleRollDice={rollDice}
            handleClearBets={clearBets}
            handleNewRound={newRound}
            handleRollAgain={handleRollAgain}
            handleStand={handleStand}
            handleReRoll={handleReRoll}
            setDealerMessage={setDealerMessage}
            showSideBetsPanel={showSideBetsPanel}
            setShowSideBetsPanel={setShowSideBetsPanel}
            showRecentRollsPanel={showRecentRollsPanel}
            setShowRecentRollsPanel={setShowRecentRollsPanel}
            rollHistoryCount={rollHistory.length}
          />
        </div>
      </main>

      {/* Side Bets — true popup overlay, only mounted when triggered */}
      <AnimatePresence>
        {showSideBetsPanel && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSideBetsPanel(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
              data-testid="sidebets-popup-backdrop"
            />
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[min(92vw,520px)] max-h-[70vh] overflow-y-auto z-50 rounded-2xl border border-fuchsia-400/40 bg-black/95 shadow-2xl"
              data-testid="sidebets-popup"
            >
              <SideBetsPanel
                showPanel={true}
                setShowPanel={() => setShowSideBetsPanel(false)}
                sideBets={sideBets}
                sideBetInsurance={sideBetInsurance}
                predictedPoint={predictedPoint}
                gamePhase={gamePhase}
                handleSideBet={handleSideBet}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <PointPredictionModal
        open={showPointSelector}
        onClose={() => setShowPointSelector(false)}
        onSelect={selectPredictedPoint}
      />

      {/* Recent Rolls — true popup overlay, only mounted when triggered */}
      <AnimatePresence>
        {showRecentRollsPanel && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowRecentRollsPanel(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
              data-testid="recent-rolls-popup-backdrop"
            />
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[min(92vw,520px)] max-h-[70vh] overflow-y-auto z-50 rounded-2xl border border-cyan-400/40 bg-black/95 shadow-2xl"
              data-testid="recent-rolls-popup"
            >
              <RecentRollsPanel
                showPanel={true}
                setShowPanel={() => setShowRecentRollsPanel(false)}
                rollHistory={rollHistory}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <WinCelebrationModal open={showWinCelebration} totalWinAmount={totalWinAmount} />
    </div>
  );
}
