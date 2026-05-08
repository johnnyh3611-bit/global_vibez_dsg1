#!/bin/bash

# Test all games with the dual-bot framework
# Usage: ./run-all-game-tests.sh

BASE_URL="https://social-connect-953.preview.emergentagent.com"
API_URL="https://social-connect-953.preview.emergentagent.com"

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🤖 DUAL-BOT TESTING FRAMEWORK"
echo "=============================="
echo ""

# Array of games to test
GAMES=(
  "tictactoe"
  "connect4"
  "chess"
  "checkers"
  "trivia"
  "poker"
  "blackjack"
)

PASSED=0
FAILED=0

for game in "${GAMES[@]}"; do
  echo ""
  echo "Testing $game..."
  echo "---"
  
  if BASE_URL="$BASE_URL" API_URL="$API_URL" timeout 120 node /app/tests/dual-bot-tester.js "$game" 2>&1 | tail -5 | grep -q "TEST PASSED"; then
    echo -e "${GREEN}✅ $game PASSED${NC}"
    ((PASSED++))
  else
    echo -e "${RED}❌ $game FAILED${NC}"
    ((FAILED++))
  fi
done

echo ""
echo "=============================="
echo "📊 RESULTS:"
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo "=============================="

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}🎉 ALL TESTS PASSED!${NC}"
  exit 0
else
  echo -e "${YELLOW}⚠️  Some tests failed${NC}"
  exit 1
fi
