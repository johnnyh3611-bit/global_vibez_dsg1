#!/bin/bash

echo "🎨 VISUAL POLISH AUDIT - Checking Game Room Design & UX"
echo "========================================================"

GAMES_DIR="/app/frontend/src/components/practice_games"

check_polish() {
    local game=$1
    local file="${GAMES_DIR}/${game}.jsx"
    
    if [ ! -f "$file" ]; then
        echo "❌ $game: MISSING"
        return
    fi
    
    # Check visual elements
    local has_motion=$(grep -c "motion\." "$file" || true)
    local has_gradient=$(grep -c "gradient\|from-\|to-\|via-" "$file" || true)
    local has_shadow=$(grep -c "shadow\|drop-shadow" "$file" || true)
    local has_glass=$(grep -c "backdrop-blur\|bg-.*\/\|opacity-" "$file" || true)
    local has_rounded=$(grep -c "rounded" "$file" || true)
    local has_transitions=$(grep -c "transition\|duration\|ease" "$file" || true)
    
    # Check layout/room design
    local has_background=$(grep -c "bg-gradient\|bg-\[" "$file" || true)
    local has_card_layout=$(grep -c "flex\|grid\|absolute\|relative" "$file" || true)
    
    local polish_score=$((has_motion + has_gradient + has_shadow + has_glass + has_rounded + has_transitions))
    
    if [ $polish_score -lt 5 ]; then
        echo "⚠️  $game: LOW POLISH (score: $polish_score/20)"
        echo "    - Motion: $has_motion, Gradients: $has_gradient, Shadows: $has_shadow"
        echo "    - Glass: $has_glass, Rounded: $has_rounded, Transitions: $has_transitions"
    elif [ $polish_score -lt 15 ]; then
        echo "✅ $game: GOOD POLISH (score: $polish_score/20)"
    else
        echo "🌟 $game: PREMIUM POLISH (score: $polish_score/20)"
    fi
}

echo ""
echo "🎰 CASINO GAMES - Visual Polish Check"
echo "---"

CASINO=("PracticeBaccarat" "PracticeCaribbeanStud" "PracticeThreeCardPoker" "PracticePaiGow" "PracticeRoulette" "PracticeCraps" "PracticeSicBo")

for game in "${CASINO[@]}"; do
    check_polish "$game"
done

echo ""
echo "🃏 CARD GAMES - Visual Polish Check"  
echo "---"

CARDS=("PracticePoker" "PracticeBlackjack" "PracticeUno" "PracticeHearts")

for game in "${CARDS[@]}"; do
    check_polish "$game"
done

