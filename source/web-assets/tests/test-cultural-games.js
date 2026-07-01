#!/usr/bin/env node

/**
 * Cultural Games Test Runner
 * Tests all 10 cultural games using the dual-bot framework
 */

import { DualBotTester } from './dual-bot-tester.js';
import { CULTURAL_GAME_TESTS } from './cultural-games-config.js';

const GAMES_TO_TEST = [
  'ludo',
  'dominoes',
  'mancala',
  'backgammon',
  'chinesecheckers',
  'parcheesi',
  'mahjong',
  'carrom',
  'shogi',
  'xiangqi'
];

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('   🎮 CULTURAL GAMES AUTOMATED TESTING SUITE 🎮');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  const results = {
    passed: [],
    failed: [],
    skipped: []
  };
  
  const startTime = Date.now();
  
  for (const gameType of GAMES_TO_TEST) {
    const config = CULTURAL_GAME_TESTS[gameType];
    const displayName = config?.displayName || gameType.toUpperCase();
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`  Testing: ${displayName}`);
    console.log(`${'='.repeat(60)}\n`);
    
    if (!config) {
      console.log(`⚠️  No test configuration found for ${gameType}. Skipping...`);
      results.skipped.push(gameType);
      continue;
    }
    
    try {
      const tester = new DualBotTester();
      const passed = await tester.runTest(gameType);
      
      if (passed) {
        results.passed.push(gameType);
        console.log(`\n✅ ${displayName} - PASSED\n`);
      } else {
        results.failed.push(gameType);
        console.log(`\n❌ ${displayName} - FAILED\n`);
      }
    } catch (error) {
      console.error(`\n❌ ${displayName} - ERROR:`, error.message);
      results.failed.push(gameType);
    }
    
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000 / 60).toFixed(2);
  
  // Print summary
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('                     TEST SUMMARY');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  console.log(`Total Games Tested: ${GAMES_TO_TEST.length}`);
  console.log(`✅ Passed: ${results.passed.length}`);
  console.log(`❌ Failed: ${results.failed.length}`);
  console.log(`⏭️  Skipped: ${results.skipped.length}`);
  console.log(`⏱️  Duration: ${duration} minutes\n`);
  
  if (results.passed.length > 0) {
    console.log('✅ Passed Games:');
    results.passed.forEach(game => console.log(`   - ${game}`));
    console.log('');
  }
  
  if (results.failed.length > 0) {
    console.log('❌ Failed Games:');
    results.failed.forEach(game => console.log(`   - ${game}`));
    console.log('');
  }
  
  if (results.skipped.length > 0) {
    console.log('⏭️  Skipped Games:');
    results.skipped.forEach(game => console.log(`   - ${game}`));
    console.log('');
  }
  
  console.log('═══════════════════════════════════════════════════════════\n');
  
  // Exit with appropriate code
  process.exit(results.failed.length === 0 ? 0 : 1);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
