export const CULTURAL_GAME_TESTS = {
  HungryVibez: {
    displayName: "Hungry Vibez",
    chairPrice: 20,
    diceCount: 5,
    minTurns: 20,
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

export async function runCulturalGameTest(tester, gameType) {
  const config = CULTURAL_GAME_TESTS[gameType];
  if (!config) {
    console.log(`⚠️ No test configuration found for ${gameType}`);
    return false;
  }
  console.log(`\n🎮 Testing ${config.displayName}...`);
  console.log(`   Price: $${config.chairPrice}, Dice: ${config.diceCount}`);
  return await tester.runTest(gameType);
}
