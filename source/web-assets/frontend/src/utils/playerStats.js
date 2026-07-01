/**
 * Player Statistics Tracker
 * Tracks wins, losses, biggest win, current streak, etc.
 */

const STATS_KEY = 'blackjack_player_stats';

export class PlayerStats {
  constructor() {
    this.loadStats();
  }
  
  loadStats() {
    try {
      const saved = localStorage.getItem(STATS_KEY);
      if (saved) {
        this.stats = JSON.parse(saved);
      } else {
        this.resetStats();
      }
    } catch (error) {
      console.error('Error loading stats:', error);
      this.resetStats();
    }
  }
  
  resetStats() {
    this.stats = {
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      pushes: 0,
      blackjacks: 0,
      busts: 0,
      biggestWin: 0,
      biggestLoss: 0,
      currentStreak: 0,
      bestStreak: 0,
      totalWinnings: 0,
      totalLosses: 0,
      handsPlayed: 0,
      splits: 0,
      doubles: 0,
      insurancesTaken: 0,
      insurancesWon: 0
    };
    this.saveStats();
  }
  
  saveStats() {
    try {
      localStorage.setItem(STATS_KEY, JSON.stringify(this.stats));
    } catch (error) {
      console.error('Error saving stats:', error);
    }
  }
  
  recordGame(result, payout, betAmount) {
    this.stats.gamesPlayed++;
    this.stats.handsPlayed++;
    
    if (result === 'win' || result === 'blackjack') {
      this.stats.wins++;
      this.stats.currentStreak = Math.max(0, this.stats.currentStreak) + 1;
      this.stats.totalWinnings += payout;
      
      if (payout > this.stats.biggestWin) {
        this.stats.biggestWin = payout;
      }
      
      if (result === 'blackjack') {
        this.stats.blackjacks++;
      }
    } else if (result === 'loss') {
      this.stats.losses++;
      this.stats.currentStreak = Math.min(0, this.stats.currentStreak) - 1;
      this.stats.totalLosses += betAmount;
      
      if (betAmount > this.stats.biggestLoss) {
        this.stats.biggestLoss = betAmount;
      }
    } else if (result === 'push') {
      this.stats.pushes++;
      this.stats.currentStreak = 0;
    }
    
    if (this.stats.currentStreak > this.stats.bestStreak) {
      this.stats.bestStreak = this.stats.currentStreak;
    }
    
    this.saveStats();
  }
  
  recordBust() {
    this.stats.busts++;
    this.saveStats();
  }
  
  recordSplit() {
    this.stats.splits++;
    this.saveStats();
  }
  
  recordDouble() {
    this.stats.doubles++;
    this.saveStats();
  }
  
  recordInsurance(won) {
    this.stats.insurancesTaken++;
    if (won) {
      this.stats.insurancesWon++;
    }
    this.saveStats();
  }
  
  getStats() {
    return { ...this.stats };
  }
  
  getWinRate() {
    if (this.stats.gamesPlayed === 0) return 0;
    return ((this.stats.wins / this.stats.gamesPlayed) * 100).toFixed(1);
  }
  
  getNetProfit() {
    return this.stats.totalWinnings - this.stats.totalLosses;
  }
}

export const playerStats = new PlayerStats();
