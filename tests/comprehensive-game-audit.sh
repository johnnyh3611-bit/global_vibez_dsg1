#!/bin/bash

echo "🎮 COMPREHENSIVE GAME AUDIT - Testing All 54 Games"
echo "=================================================="
echo ""

# Casino Table Games (8)
CASINO_TABLE=("PracticeBaccarat" "PracticeCaribbeanStud" "PracticeThreeCardPoker" "PracticePaiGow" "PracticeCheminDeFer" "PracticeCasinoWar" "PracticeEuropeanRoulette" "PracticeRoulette")

# Casino Dice Games (4)
CASINO_DICE=("PracticeCraps" "PracticeSicBo" "PracticeHazard" "PracticeChuckALuck")

# Casino Wheel Games (2)
CASINO_WHEEL=("PracticeBigSixWheel" "PracticeVibesWheel")

# Video/Electronic (4)
CASINO_VIDEO=("PracticeJacksOrBetter" "PracticeVibesSlots" "PracticeKeno" "PracticeBingo")

# Classic Casino (3)
CASINO_CLASSIC=("PracticeFanTan" "PracticeFaro" "PracticeVibesDarts")

# Card Games (12)
CARD_GAMES=("PracticePoker" "PracticeBlackjack" "PracticeUno" "PracticeGoFish" "PracticeCrazyEights" "PracticeHearts" "PracticeSpades" "PracticeRummy" "PracticeGinRummy" "PracticeWar" "PracticeSolitaire" "PracticeKlondike")

# Board Games (11)
BOARD_GAMES=("PracticeChess" "PracticeCheckers" "PracticeConnect4" "PracticeTicTacToe" "PracticeReversi" "PracticeMancala" "PracticeDominoes" "PracticeBattleship" "PracticeMahjong" "PracticeYahtzee")

# Arcade (4)
ARCADE_GAMES=("PracticeSnake" "PracticeMemoryMatch" "PracticePingPong" "PracticePool8Ball")

# Party (3)
PARTY_GAMES=("PracticeTrivia" "PracticeTruthOrDare" "PracticeTwoTruthsLie")

# Premium (3)
PREMIUM_GAMES=("PracticeBlackjackNew" "PracticePoker3D" "PracticePokerCSS3D")

GAMES_DIR="/app/frontend/src/components/practice_games"

check_game() {
    local game=$1
    local file="${GAMES_DIR}/${game}.jsx"
    
    if [ ! -f "$file" ]; then
        echo "❌ $game: FILE MISSING"
        return 1
    fi
    
    local size=$(wc -c < "$file")
    local has_state=$(grep -c "useState\|gameState" "$file" || true)
    local has_logic=$(grep -c "onClick\|onMove\|deal\|shuffle\|score" "$file" || true)
    local has_ui=$(grep -c "return\|render\|motion\|Button" "$file" || true)
    
    if [ $size -lt 1500 ]; then
        echo "⚠️  $game: MINIMAL ($size chars) - May be incomplete"
        return 2
    elif [ $has_state -eq 0 ] && [ $size -gt 2000 ]; then
        echo "⚠️  $game: NO STATE ($size chars) - Missing game logic?"
        return 2
    elif [ $has_logic -eq 0 ] && [ $size -gt 2000 ]; then
        echo "⚠️  $game: NO INTERACTIONS ($size chars) - Static component?"
        return 2
    else
        echo "✅ $game: COMPLETE ($size chars, state:$has_state, logic:$has_logic)"
        return 0
    fi
}

total=0
complete=0
issues=0

echo "🎰 CASINO TABLE GAMES (8)"
for game in "${CASINO_TABLE[@]}"; do
    check_game "$game"
    status=$?
    total=$((total + 1))
    [ $status -eq 0 ] && complete=$((complete + 1)) || issues=$((issues + 1))
done
echo ""

echo "🎲 CASINO DICE GAMES (4)"
for game in "${CASINO_DICE[@]}"; do
    check_game "$game"
    status=$?
    total=$((total + 1))
    [ $status -eq 0 ] && complete=$((complete + 1)) || issues=$((issues + 1))
done
echo ""

echo "🎡 CASINO WHEEL GAMES (2)"
for game in "${CASINO_WHEEL[@]}"; do
    check_game "$game"
    status=$?
    total=$((total + 1))
    [ $status -eq 0 ] && complete=$((complete + 1)) || issues=$((issues + 1))
done
echo ""

echo "🎰 VIDEO/ELECTRONIC (4)"
for game in "${CASINO_VIDEO[@]}"; do
    check_game "$game"
    status=$?
    total=$((total + 1))
    [ $status -eq 0 ] && complete=$((complete + 1)) || issues=$((issues + 1))
done
echo ""

echo "🎴 CLASSIC CASINO (3)"
for game in "${CASINO_CLASSIC[@]}"; do
    check_game "$game"
    status=$?
    total=$((total + 1))
    [ $status -eq 0 ] && complete=$((complete + 1)) || issues=$((issues + 1))
done
echo ""

echo "🃏 CARD GAMES (12)"
for game in "${CARD_GAMES[@]}"; do
    check_game "$game"
    status=$?
    total=$((total + 1))
    [ $status -eq 0 ] && complete=$((complete + 1)) || issues=$((issues + 1))
done
echo ""

echo "🎮 BOARD GAMES (11)"
for game in "${BOARD_GAMES[@]}"; do
    check_game "$game"
    status=$?
    total=$((total + 1))
    [ $status -eq 0 ] && complete=$((complete + 1)) || issues=$((issues + 1))
done
echo ""

echo "🕹️ ARCADE GAMES (4)"
for game in "${ARCADE_GAMES[@]}"; do
    check_game "$game"
    status=$?
    total=$((total + 1))
    [ $status -eq 0 ] && complete=$((complete + 1)) || issues=$((issues + 1))
done
echo ""

echo "🎉 PARTY GAMES (3)"
for game in "${PARTY_GAMES[@]}"; do
    check_game "$game"
    status=$?
    total=$((total + 1))
    [ $status -eq 0 ] && complete=$((complete + 1)) || issues=$((issues + 1))
done
echo ""

echo "👑 PREMIUM GAMES (3)"
for game in "${PREMIUM_GAMES[@]}"; do
    check_game "$game"
    status=$?
    total=$((total + 1))
    [ $status -eq 0 ] && complete=$((complete + 1)) || issues=$((issues + 1))
done
echo ""

echo "=================================================="
echo "📊 FINAL SUMMARY"
echo "=================================================="
echo "Total Games Tested: $total"
echo "✅ Complete: $complete"
echo "⚠️  Issues Found: $issues"
echo "Success Rate: $((complete * 100 / total))%"
echo ""
