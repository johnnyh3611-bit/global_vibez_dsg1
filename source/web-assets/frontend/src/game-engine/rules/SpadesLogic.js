/**
 * SPADES Game Logic (4-Player Partnership)
 * Implements trick-taking card game rules with bidding, nil, blind, and bags
 */
import { GameLogic } from '../GameLogic';
import { parseCard, canFollowSuit, getLedSuit, determineTrickWinner, getSuitName } from '../utils/CardUtils';

export class SpadesLogic extends GameLogic {
  /**
   * Validate if a card play is legal
   */
  validateMove(state, action) {
    const { card, playerId } = action.payload;
    
    // Get player's hand
    const hand = state.hands?.[playerId] || state[`${playerId}_hand`];
    
    if (!hand) {
      return { valid: false, reason: "Player hand not found" };
    }

    // Check if player has this card
    if (!hand.includes(card)) {
      return { valid: false, reason: "You don't have this card!" };
    }

    const currentTrick = state.current_trick || [];
    const parsedCard = parseCard(card);

    if (!parsedCard) {
      return { valid: false, reason: "Invalid card format" };
    }

    // 1. If it's the start of a trick, leadSuit is null
    if (currentTrick.length === 0) {
      // Spades haven't been broken yet
      if (parsedCard.suit === 'S' && !state.spades_broken) {
        // Check if player has anything other than spades
        const hasOtherSuits = hand.some(c => {
          const p = parseCard(c);
          return p && p.suit !== 'S';
        });

        if (hasOtherSuits) {
          return { valid: false, reason: "Spades haven't been broken yet!" };
        }
      }
      
      return { valid: true };
    }

    // 2. Must follow suit if possible
    const ledSuit = getLedSuit(currentTrick);
    const hasLeadSuit = hand.some(c => {
      const p = parseCard(c);
      return p && p.suit === ledSuit;
    });
    
    if (parsedCard.suit !== ledSuit && hasLeadSuit) {
      return { 
        valid: false, 
        reason: `You must follow suit: ${getSuitName(ledSuit)}` 
      };
    }

    return { valid: true };
  }

  /**
   * Calculate winner based on tricks won (4-player partnership scoring)
   */
  calculateWin(state) {
    const rounds = state.rounds_completed || 0;
    
    // Check if all 13 tricks have been played
    const totalTricks = (state.team1_tricks || 0) + (state.team2_tricks || 0);
    
    if (totalTricks < 13 && rounds === 0) {
      return null; // Round not finished
    }

    // Check if either team reached 500 points
    const team1Score = state.team1_score || 0;
    const team2Score = state.team2_score || 0;

    if (team1Score >= 500 || team2Score >= 500) {
      const winner = team1Score > team2Score ? 'team1' : 'team2';
      return { 
        winner, 
        reason: `Reached ${Math.max(team1Score, team2Score)} points!`,
        finalScore: { team1: team1Score, team2: team2Score }
      };
    }

    return null;
  }

  /**
   * Get next player in 4-player rotation
   */
  getNextPlayer(state) {
    const currentTrick = state.current_trick || [];
    const players = ['player1', 'player2', 'player3', 'player4'];
    
    // If trick is complete (4 cards), winner leads next trick
    if (currentTrick.length === 4) {
      const winner = determineTrickWinner(currentTrick, 'S'); // Spades are trump
      return winner.player;
    }
    
    // Otherwise, rotate to next player
    const currentIndex = players.indexOf(state.current_turn);
    const nextIndex = (currentIndex + 1) % 4;
    return players[nextIndex];
  }

  /**
   * Process a card play and update game state
   */
  processMove(state, action) {
    const { card, playerId } = action.payload;
    const newState = { ...state };
    
    // Remove card from player's hand
    const handKey = state.hands ? 'hands' : `${playerId}_hand`;
    if (state.hands) {
      newState.hands = { ...state.hands };
      newState.hands[playerId] = state.hands[playerId].filter(c => c !== card);
    } else {
      newState[handKey] = state[handKey].filter(c => c !== card);
    }
    
    // Add card to current trick
    newState.current_trick = [
      ...(state.current_trick || []),
      { player: playerId, card }
    ];

    // Check if spades are now broken
    const parsedCard = parseCard(card);
    if (parsedCard.suit === 'S') {
      newState.spades_broken = true;
    }

    // If trick is complete (4 cards), determine winner
    if (newState.current_trick.length === 4) {
      const trickWinner = determineTrickWinner(newState.current_trick, 'S');
      
      // Determine which team won (player1+player3 vs player2+player4)
      const winnerTeam = (trickWinner.player === 'player1' || trickWinner.player === 'player3') 
        ? 'team1' : 'team2';
      
      // Award trick to team
      const tricksKey = `${winnerTeam}_tricks`;
      newState[tricksKey] = (state[tricksKey] || 0) + 1;
      
      // Clear trick for next round
      newState.current_trick = [];
      newState.current_turn = trickWinner.player; // Winner leads next trick
    }

    return newState;
  }
}
