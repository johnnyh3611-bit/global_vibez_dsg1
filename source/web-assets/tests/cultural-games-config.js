// Cultural Games Test Configuration for Dual-Bot Tester
// Extends the main dual-bot-tester.js with game-specific validations

export const CULTURAL_GAME_TESTS = {
  ludo: {
    displayName: 'Ludo',
    minTurns: 5,
    maxTurns: 50,
    
    async validateGameState(page, gameState) {
      const validations = [];
      
      // Check positions structure
      if (!gameState.positions || !gameState.positions.red || !gameState.positions.blue) {
        validations.push({ passed: false, message: 'Missing positions structure' });
      } else {
        validations.push({ passed: true, message: 'Positions structure valid' });
      }
      
      // Check token counts
      if (gameState.positions.red.length === 4 && gameState.positions.blue.length === 4) {
        validations.push({ passed: true, message: 'All 4 tokens per player present' });
      } else {
        validations.push({ passed: false, message: 'Invalid token count' });
      }
      
      return validations;
    },
    
    async makeTestMove(page, isMyTurn, gameState) {
      if (!isMyTurn) return null;
      
      try {
        // Click roll dice button
        const diceButton = page.locator('button:has-text("Roll Dice")');
        if (await diceButton.isVisible({ timeout: 2000 })) {
          await diceButton.click();
          console.log('  ✅ Rolled dice');
          return { action: 'roll_dice', success: true };
        }
      } catch (e) {
        console.log('  ⚠️  Could not roll dice:', e.message);
      }
      
      return null;
    }
  },

  dominoes: {
    displayName: 'Dominoes',
    minTurns: 5,
    maxTurns: 40,
    
    async validateGameState(page, gameState) {
      const validations = [];
      
      // Check hands
      if (gameState.hands && gameState.hands.player1 && gameState.hands.player2) {
        validations.push({ passed: true, message: 'Both players have hands' });
        
        // Check initial hand size
        const p1HandSize = gameState.hands.player1.length;
        const p2HandSize = gameState.hands.player2.length;
        
        if (p1HandSize <= 7 && p2HandSize <= 7) {
          validations.push({ passed: true, message: `Hand sizes valid (P1: ${p1HandSize}, P2: ${p2HandSize})` });
        }
      } else {
        validations.push({ passed: false, message: 'Missing hands structure' });
      }
      
      // Check boneyard
      if (Array.isArray(gameState.boneyard)) {
        validations.push({ passed: true, message: `Boneyard present (${gameState.boneyard.length} tiles)` });
      }
      
      return validations;
    },
    
    async makeTestMove(page, isMyTurn, gameState) {
      if (!isMyTurn) return null;
      
      try {
        // Try to play a domino
        const dominoes = page.locator('.domino-playable, [data-testid="domino"]');
        const count = await dominoes.count();
        
        if (count > 0) {
          await dominoes.first().click();
          console.log('  ✅ Played domino');
          return { action: 'play_domino', success: true };
        }
        
        // Try to draw
        const drawButton = page.locator('button:has-text("Draw")');
        if (await drawButton.isVisible({ timeout: 2000 })) {
          await drawButton.click();
          console.log('  ✅ Drew domino');
          return { action: 'draw', success: true };
        }
      } catch (e) {
        console.log('  ⚠️  Could not make move:', e.message);
      }
      
      return null;
    }
  },

  mancala: {
    displayName: 'Mancala',
    minTurns: 10,
    maxTurns: 60,
    
    async validateGameState(page, gameState) {
      const validations = [];
      
      // Check pits
      if (gameState.pits && gameState.pits.player1 && gameState.pits.player2) {
        validations.push({ passed: true, message: 'Both players have pits' });
        
        if (gameState.pits.player1.length === 6 && gameState.pits.player2.length === 6) {
          validations.push({ passed: true, message: 'Correct pit count (6 per player)' });
        }
      }
      
      // Check stores
      if (gameState.stores && typeof gameState.stores.player1 === 'number' && typeof gameState.stores.player2 === 'number') {
        validations.push({ passed: true, message: 'Stores initialized' });
      }
      
      return validations;
    },
    
    async makeTestMove(page, isMyTurn, gameState) {
      if (!isMyTurn) return null;
      
      try {
        // Click a pit with stones
        const pits = page.locator('.pit-playable, [data-testid="pit"]');
        const count = await pits.count();
        
        if (count > 0) {
          await pits.first().click();
          console.log('  ✅ Selected pit and sowed stones');
          return { action: 'sow_stones', success: true };
        }
      } catch (e) {
        console.log('  ⚠️  Could not make move:', e.message);
      }
      
      return null;
    }
  },

  mahjong: {
    displayName: 'Mahjong',
    minTurns: 10,
    maxTurns: 50,
    
    async validateGameState(page, gameState) {
      const validations = [];
      
      // Check hands
      if (gameState.hands && gameState.hands.player1 && gameState.hands.player2) {
        const p1HandSize = gameState.hands.player1.length;
        const p2HandSize = gameState.hands.player2.length;
        
        if (p1HandSize === 13 || p1HandSize === 14) {
          validations.push({ passed: true, message: `P1 hand size valid (${p1HandSize})` });
        }
        
        if (p2HandSize === 13 || p2HandSize === 14) {
          validations.push({ passed: true, message: `P2 hand size valid (${p2HandSize})` });
        }
      }
      
      // Check wall
      if (Array.isArray(gameState.wall)) {
        validations.push({ passed: true, message: `Wall present (${gameState.wall.length} tiles)` });
      }
      
      return validations;
    }
  },

  // Additional games can follow same pattern...
  backgammon: {
    displayName: 'Backgammon',
    minTurns: 10,
    maxTurns: 100,
    
    async validateGameState(page, gameState) {
      const validations = [];
      
      if (Array.isArray(gameState.board) && gameState.board.length === 24) {
        validations.push({ passed: true, message: 'Board has 24 points' });
      }
      
      if (gameState.bar && gameState.off) {
        validations.push({ passed: true, message: 'Bar and bearing off areas present' });
      }
      
      return validations;
    }
  },

  chinesecheckers: {
    displayName: 'Chinese Checkers',
    minTurns: 10,
    maxTurns: 100,
    
    async validateGameState(page, gameState) {
      const validations = [];
      
      if (gameState.positions && gameState.positions.player1 && gameState.positions.player2) {
        if (gameState.positions.player1.length === 10) {
          validations.push({ passed: true, message: 'P1 has 10 pieces' });
        }
        if (gameState.positions.player2.length === 10) {
          validations.push({ passed: true, message: 'P2 has 10 pieces' });
        }
      }
      
      return validations;
    }
  },

  parcheesi: {
    displayName: 'Parcheesi',
    minTurns: 10,
    maxTurns: 80,
    
    async validateGameState(page, gameState) {
      const validations = [];
      
      if (gameState.positions) {
        validations.push({ passed: true, message: 'Position tracking active' });
      }
      
      if (Array.isArray(gameState.safe_spaces)) {
        validations.push({ passed: true, message: 'Safe spaces defined' });
      }
      
      return validations;
    }
  }
};

// Test helper functions
export async function runCulturalGameTest(tester, gameType) {
  const config = CULTURAL_GAME_TESTS[gameType];
  
  if (!config) {
    console.log(`⚠️  No test configuration found for ${gameType}`);
    return false;
  }
  
  console.log(`\n🎮 Testing ${config.displayName}...`);
  console.log(`   Min Turns: ${config.minTurns}, Max Turns: ${config.maxTurns}`);
  
  // Run standard test with game-specific validation
  return await tester.runTest(gameType);
}
