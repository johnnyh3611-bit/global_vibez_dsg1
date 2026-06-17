/**
 * BettingMechanics.js - Universal Betting System
 * 
 * Atomic mechanics for games with betting/wagering.
 * Used by Poker, Blackjack, and other betting games.
 * 
 * Operations:
 * - Place bet
 * - Raise bet
 * - Call bet
 * - Fold
 * - Calculate pot
 * - Distribute pot to winners
 * - Handle side pots
 */

export const BettingMechanics = {
  /**
   * Place a bet
   */
  placeBet(playerId, amount, pot, playerBalance) {
    if (amount < 0) {
      throw new Error('Bet amount must be positive');
    }
    
    if (amount > playerBalance) {
      throw new Error('Insufficient balance');
    }
    
    return {
      newPot: pot + amount,
      newBalance: playerBalance - amount,
      betAmount: amount
    };
  },
  
  /**
   * Raise the current bet
   */
  raiseBet(currentBet, raiseAmount, minRaise) {
    if (raiseAmount < minRaise) {
      throw new Error(`Raise must be at least ${minRaise}`);
    }
    
    return currentBet + raiseAmount;
  },
  
  /**
   * Call the current bet
   */
  callBet(currentBet, playerCurrentBet) {
    return currentBet - playerCurrentBet;
  },
  
  /**
   * Check if player can check (no bet to call)
   */
  canCheck(currentBet, playerCurrentBet) {
    return currentBet === playerCurrentBet;
  },
  
  /**
   * Calculate total pot
   */
  calculatePot(playerBets) {
    return Object.values(playerBets).reduce((sum, bet) => sum + bet, 0);
  },
  
  /**
   * Distribute pot to winner(s)
   */
  distributePot(pot, winners) {
    const winnersArray = Array.isArray(winners) ? winners : [winners];
    const sharePerWinner = Math.floor(pot / winnersArray.length);
    
    const payouts = {};
    winnersArray.forEach(winner => {
      payouts[winner] = sharePerWinner;
    });
    
    return payouts;
  },
  
  /**
   * Create side pots for all-in situations
   */
  createSidePots(playerBets, playerBalances) {
    const players = Object.keys(playerBets);
    const sidePots = [];
    
    // Sort players by bet amount
    const sortedPlayers = players.sort((a, b) => playerBets[a] - playerBets[b]);
    
    let previousBet = 0;
    sortedPlayers.forEach(player => {
      const bet = playerBets[player];
      
      if (bet > previousBet) {
        const potAmount = (bet - previousBet) * players.filter(p => 
          playerBets[p] >= bet
        ).length;
        
        sidePots.push({
          amount: potAmount,
          eligiblePlayers: players.filter(p => playerBets[p] >= bet)
        });
        
        previousBet = bet;
      }
    });
    
    return sidePots;
  },
  
  /**
   * Get minimum bet for current round
   */
  getMinimumBet(currentBet, bigBlind = null) {
    if (currentBet === 0 && bigBlind) {
      return bigBlind;
    }
    return currentBet;
  },
  
  /**
   * Check if player is all-in
   */
  isAllIn(playerBalance) {
    return playerBalance === 0;
  },
  
  /**
   * Calculate ante (forced bet before dealing)
   */
  collectAnte(players, anteAmount) {
    const antes = {};
    players.forEach(player => {
      antes[player.player_id] = anteAmount;
    });
    
    return {
      antes,
      totalPot: anteAmount * players.length
    };
  },
  
  /**
   * Collect blinds (small and big blind for poker)
   */
  collectBlinds(dealerIndex, players, smallBlind, bigBlind) {
    const playerCount = players.length;
    const smallBlindIndex = (dealerIndex + 1) % playerCount;
    const bigBlindIndex = (dealerIndex + 2) % playerCount;
    
    return {
      smallBlind: {
        playerId: players[smallBlindIndex].player_id,
        amount: smallBlind
      },
      bigBlind: {
        playerId: players[bigBlindIndex].player_id,
        amount: bigBlind
      },
      totalPot: smallBlind + bigBlind
    };
  }
};

export default BettingMechanics;
