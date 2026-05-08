#!/bin/bash
# Dual-Bot Test Runner
# Tests all multiplayer games with two AI players

set -e

echo "🤖 DUAL-BOT TESTING SYSTEM"
echo "Testing all multiplayer games..."
echo ""

# Array of all games to test
GAMES=(
  "tictactoe"
  "connect4"
  "chess"
  "trivia"
  "uno"
  "poker"
  "rummy"
  "hearts"
  "truthordare"
  "checkers"
  "blackjack"
  "spades"
  "gofish"
)

PASSED=0
FAILED=0
FAILED_GAMES=()

START_TIME=$(date +%s)

# Test each game
for game in "${GAMES[@]}"; do
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "Testing: $game"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  
  if node /app/tests/dual-bot-tester.js "$game"; then
    echo "✅ $game PASSED"
    ((PASSED++))
  else
    echo "❌ $game FAILED"
    ((FAILED++))
    FAILED_GAMES+=("$game")
  fi
  
  echo ""
  sleep 2
done

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

# Summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎯 TEST SUMMARY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Total Games: $((PASSED + FAILED))"
echo "✅ Passed: $PASSED"
echo "❌ Failed: $FAILED"
echo "⏱️  Duration: ${DURATION}s"
echo ""

if [ $FAILED -eq 0 ]; then
  echo "🎉 ALL GAMES WORKING! 100% PASS RATE"
  echo ""
  exit 0
else
  echo "⚠️  FAILED GAMES:"
  for failed_game in "${FAILED_GAMES[@]}"; do
    echo "   - $failed_game"
  done
  echo ""
  echo "Please fix the failed games before deployment."
  exit 1
fi
