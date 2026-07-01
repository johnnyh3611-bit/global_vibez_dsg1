#!/bin/bash
# Fix missing useParams imports in all game files

GAME_FILES=(
  "/app/frontend/src/pages/games/HttpMultiplayerUno.jsx"
  "/app/frontend/src/pages/games/HttpMultiplayerHearts.jsx"
  "/app/frontend/src/pages/games/HttpMultiplayerRummy.jsx"
  "/app/frontend/src/pages/games/HttpMultiplayerBlackjack.jsx"
  "/app/frontend/src/pages/games/HttpMultiplayerGoFish.jsx"
  "/app/frontend/src/pages/games/HttpMultiplayerChess.jsx"
  "/app/frontend/src/pages/games/HttpMultiplayerConnect4.jsx"
  "/app/frontend/src/pages/games/HttpMultiplayerTrivia.jsx"
  "/app/frontend/src/pages/games/HttpMultiplayerTruthOrDare.jsx"
)

for file in "${GAME_FILES[@]}"; do
  if [ -f "$file" ]; then
    # Fix import line
    sed -i "s/from 'react-router-dom';/from 'react-router-dom';/g" "$file"
    sed -i "s/import { useNavigate } from 'react-router-dom'/import { useNavigate, useParams } from 'react-router-dom'/g" "$file"
    echo "Fixed: $file"
  fi
done

echo "All game files fixed!"
