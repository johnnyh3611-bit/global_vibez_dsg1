#!/usr/bin/env node

/**
 * COMPREHENSIVE GAME FUNCTIONALITY TESTER
 * Tests all 54 games for component existence, logic, and functionality
 */

import fs from 'fs';
import path from 'path';

const GAMES_DIR = '/app/frontend/src/components/practice_games';
const RESULTS_FILE = '/app/test_reports/game_functionality_audit.json';

// All 54 games that should exist
const EXPECTED_GAMES = [
  // Card Games
  'PracticePoker', 'PracticeBlackjack', 'PracticeUno', 'PracticeGoFish',
  'PracticeCrazyEights', 'PracticeHearts', 'PracticeSpades', 'PracticeRummy',
  'PracticeGinRummy', 'PracticeWar', 'PracticeSolitaire', 'PracticeKlondike',
  
  // Casino Table Games
  'PracticeRoulette', 'PracticeBaccarat', 'PracticeCaribbeanStud',
  'PracticeThreeCardPoker', 'PracticePaiGow', 'PracticeCheminDeFer',
  'PracticeCasinoWar', 'PracticeEuropeanRoulette',
  
  // Casino Dice Games
  'PracticeCraps', 'PracticeSicBo', 'PracticeHazard', 'PracticeChuckALuck',
  
  // Casino Wheel Games
  'PracticeBigSixWheel', 'PracticeVibesWheel',
  
  // Video/Electronic
  'PracticeJacksOrBetter', 'PracticeVibesSlots', 'PracticeKeno', 'PracticeBingo',
  
  // Classic Casino
  'PracticeFanTan', 'PracticeFaro', 'PracticeVibesDarts',
  
  // Board Games
  'PracticeChess', 'PracticeCheckers', 'PracticeConnect4', 'PracticeTicTacToe',
  'PracticeReversi', 'PracticeMancala', 'PracticeDominoes', 'PracticeBattleship',
  'PracticeMahjong', 'PracticeYahtzee',
  
  // Arcade
  'PracticeSnake', 'PracticeMemoryMatch', 'PracticePingPong', 'PracticePool8Ball',
  
  // Party
  'PracticeTrivia', 'PracticeTruthOrDare', 'PracticeTwoTruthsLie',
  
  // Premium
  'PracticeBlackjackNew', 'PracticePoker3D', 'PracticePokerCSS3D'
];

const results = {
  timestamp: new Date().toISOString(),
  totalGames: EXPECTED_GAMES.length,
  summary: {
    existing: 0,
    missing: 0,
    hasLogic: 0,
    minimal: 0
  },
  games: []
};

console.log('🎮 COMPREHENSIVE GAME FUNCTIONALITY AUDIT');
console.log(`Testing ${EXPECTED_GAMES.length} games...\n`);

for (const gameName of EXPECTED_GAMES) {
  const filePath = path.join(GAMES_DIR, `${gameName}.jsx`);
  const exists = fs.existsSync(filePath);
  
  const gameResult = {
    name: gameName,
    exists,
    fileSize: 0,
    hasGameLogic: false,
    hasState: false,
    hasInteractions: false,
    complexity: 'unknown',
    issues: []
  };

  if (exists) {
    results.summary.existing++;
    
    // Read file and analyze
    const content = fs.readFileSync(filePath, 'utf8');
    gameResult.fileSize = content.length;
    
    // Check for game logic indicators
    const hasUseState = content.includes('useState');
    const hasUseEffect = content.includes('useEffect');
    const hasOnClick = content.includes('onClick');
    const hasGameState = content.includes('gameState') || content.includes('game_state');
    const hasMotion = content.includes('motion.');
    const hasShuffle = content.includes('shuffle') || content.includes('deal');
    const hasScore = content.includes('score') || content.includes('points');
    
    gameResult.hasState = hasUseState || hasGameState;
    gameResult.hasInteractions = hasOnClick;
    gameResult.hasGameLogic = hasShuffle || hasScore || (hasUseState && hasOnClick);
    
    // Determine complexity
    if (content.length < 1000) {
      gameResult.complexity = 'minimal';
      results.summary.minimal++;
      gameResult.issues.push('Component is very small (< 1000 chars) - may be incomplete');
    } else if (content.length < 3000) {
      gameResult.complexity = 'simple';
    } else if (content.length < 8000) {
      gameResult.complexity = 'medium';
      if (hasGameLogic) results.summary.hasLogic++;
    } else {
      gameResult.complexity = 'complex';
      if (hasGameLogic) results.summary.hasLogic++;
    }
    
    // Check for common issues
    if (!hasUseState && !hasGameState) {
      gameResult.issues.push('No state management detected');
    }
    if (!hasOnClick && content.length > 2000) {
      gameResult.issues.push('No click interactions detected');
    }
    if (!hasMotion && content.length > 5000) {
      gameResult.issues.push('No animations detected (Framer Motion)');
    }
    if (content.includes('TODO') || content.includes('FIXME')) {
      gameResult.issues.push('Contains TODO/FIXME comments');
    }
    
    console.log(`✅ ${gameName}: ${gameResult.complexity} (${gameResult.fileSize} chars) ${gameResult.issues.length > 0 ? '⚠️' : ''}`);
    if (gameResult.issues.length > 0) {
      gameResult.issues.forEach(issue => console.log(`   ⚠️  ${issue}`));
    }
  } else {
    results.summary.missing++;
    gameResult.issues.push('Component file does not exist');
    console.log(`❌ ${gameName}: MISSING`);
  }
  
  results.games.push(gameResult);
}

// Save results
fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));

// Print summary
console.log('\n' + '='.repeat(80));
console.log('📊 AUDIT SUMMARY');
console.log('='.repeat(80));
console.log(`Total Games Expected: ${results.totalGames}`);
console.log(`✅ Existing: ${results.summary.existing}`);
console.log(`❌ Missing: ${results.summary.missing}`);
console.log(`🎮 Has Game Logic: ${results.summary.hasLogic}`);
console.log(`⚠️  Minimal/Incomplete: ${results.summary.minimal}`);
console.log(`\nFull report: ${RESULTS_FILE}`);
console.log('='.repeat(80));
