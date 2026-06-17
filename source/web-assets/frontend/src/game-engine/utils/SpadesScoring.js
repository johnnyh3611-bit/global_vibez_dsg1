/**
 * Spades Scoring Engine
 * Handles Nil bids, Blind bids, Bags, and penalties
 */

/**
 * Calculate score for a team after a round
 * @param {Object} teamState - Team's bid and tricks won
 * @returns {Object} { points, bags, penalties }
 */
export const calculateTeamScore = (teamState) => {
  let roundScore = 0;
  let bags = 0;
  const penalties = [];
  
  const { bid, tricksWon, isBlind, isNil } = teamState;

  // 1. Handling NIL (The Ultimate Social Gamble)
  if (isNil) {
    if (tricksWon === 0) {
      roundScore += 100; // Successful Nil!
      penalties.push({ type: 'NIL_SUCCESS', value: 100 });
    } else {
      roundScore -= 100; // Failed Nil penalty
      penalties.push({ type: 'NIL_FAILED', value: -100 });
    }
    return { points: roundScore, bags: 0, penalties };
  }

  // 2. Standard Bidding & Blind Multipliers
  const multiplier = isBlind ? 2 : 1;
  
  if (tricksWon >= bid) {
    // Successful Bid
    const bidPoints = bid * 10 * multiplier;
    roundScore += bidPoints;
    
    // Calculate "Bags" (Overtricks)
    bags = tricksWon - bid;
    roundScore += bags; // Each bag is worth 1 point
    
    penalties.push({ 
      type: isBlind ? 'BLIND_SUCCESS' : 'BID_SUCCESS', 
      value: bidPoints 
    });
    
    if (bags > 0) {
      penalties.push({ type: 'BAGS_EARNED', value: bags });
    }
  } else {
    // "Set" - Failed to reach the bid
    const penaltyPoints = bid * 10 * multiplier;
    roundScore -= penaltyPoints;
    penalties.push({ 
      type: isBlind ? 'BLIND_FAILED' : 'BID_FAILED', 
      value: -penaltyPoints 
    });
  }

  return { points: roundScore, bags, penalties };
};

/**
 * Check and apply bag penalty (10 bags = -100 points)
 * @param {number} currentBags - Current bag count
 * @returns {Object} { penalty, newBagCount }
 */
export const checkBagPenalty = (currentBags) => {
  if (currentBags >= 10) {
    return {
      penalty: -100,
      newBagCount: currentBags - 10,
      triggered: true
    };
  }
  return {
    penalty: 0,
    newBagCount: currentBags,
    triggered: false
  };
};

/**
 * Calculate scores for both teams (4-player partnerships)
 * @param {Object} gameState - Full game state
 * @returns {Object} Updated scores and bags
 */
export const calculateRoundScores = (gameState) => {
  const team1State = {
    bid: gameState.team1_bid || 0,
    tricksWon: gameState.team1_tricks || 0,
    isBlind: gameState.team1_blind || false,
    isNil: gameState.team1_nil || false
  };

  const team2State = {
    bid: gameState.team2_bid || 0,
    tricksWon: gameState.team2_tricks || 0,
    isBlind: gameState.team2_blind || false,
    isNil: gameState.team2_nil || false
  };

  // Calculate team scores
  const team1Result = calculateTeamScore(team1State);
  const team2Result = calculateTeamScore(team2State);

  // Update total bags
  const team1TotalBags = (gameState.team1_bags || 0) + team1Result.bags;
  const team2TotalBags = (gameState.team2_bags || 0) + team2Result.bags;

  // Check for bag penalties
  const team1BagCheck = checkBagPenalty(team1TotalBags);
  const team2BagCheck = checkBagPenalty(team2TotalBags);

  return {
    team1: {
      points: team1Result.points + team1BagCheck.penalty,
      bags: team1BagCheck.newBagCount,
      penalties: team1Result.penalties,
      bagPenalty: team1BagCheck.triggered
    },
    team2: {
      points: team2Result.points + team2BagCheck.penalty,
      bags: team2BagCheck.newBagCount,
      penalties: team2Result.penalties,
      bagPenalty: team2BagCheck.triggered
    }
  };
};

/**
 * Determine bid type from player input
 */
export const getBidType = (bidValue) => {
  if (bidValue === 0) return 'NIL';
  if (bidValue === 'blind') return 'BLIND';
  return 'STANDARD';
};

/**
 * Validate bid value
 */
export const isValidBid = (bidValue, isBlind = false) => {
  if (isBlind) return true; // Blind bids are always valid
  if (bidValue === 0) return true; // Nil is valid
  return bidValue >= 1 && bidValue <= 13;
};
