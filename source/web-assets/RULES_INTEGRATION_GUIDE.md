# Game Rules Integration Guide

## Status: 3/10 Complete ✅

### Completed:
- ✅ Ludo - Full rules integration with modal
- ✅ Dominoes - Full rules integration with modal  
- ✅ Mancala - Full rules integration with modal

### Pending (7 games):
- Backgammon
- Chinese Checkers
- Parcheesi
- Mahjong
- Carrom
- Shogi
- Xiangqi

---

## Integration Pattern (5-10 minutes per game)

### Step 1: Add Imports
```javascript
import { BookOpen } from 'lucide-react';
import { GameRulesModal } from '@/components/GameRulesModal';
import { GAME_RULES } from '@/config/gameRules';
```

### Step 2: Add State
```javascript
const [showRules, setShowRules] = useState(false);
```

### Step 3: Add Modal Component (after return statement, before main div)
```javascript
{/* Rules Modal */}
<GameRulesModal
  isOpen={showRules}
  onClose={() => setShowRules(false)}
  title="[Game Icon] [Game Name] Rules"
  rules={GAME_RULES.[gameid]}
/>
```

### Step 4: Add Rules Button in Header
Replace spacer div or add alongside Leave button:
```javascript
<Button
  variant="ghost"
  onClick={() => setShowRules(true)}
  className="text-white hover:bg-white/10 border border-white/30"
>
  <BookOpen className="w-5 h-5 mr-2" />
  Rules
</Button>
```

---

## Game-Specific Details

### Backgammon
- **File:** `/app/frontend/src/pages/HttpMultiplayerBackgammon.jsx`
- **Rules Key:** `GAME_RULES.backgammon`
- **Title:** "🎲 Backgammon Rules"

### Chinese Checkers
- **File:** `/app/frontend/src/pages/HttpMultiplayerChineseCheckers.jsx`
- **Rules Key:** `GAME_RULES.chinesecheckers`
- **Title:** "⭐ Chinese Checkers Rules"

### Parcheesi
- **File:** `/app/frontend/src/pages/HttpMultiplayerParcheesi.jsx`
- **Rules Key:** `GAME_RULES.parcheesi`
- **Title:** "🎲 Parcheesi Rules"

### Mahjong
- **File:** `/app/frontend/src/pages/HttpMultiplayerMahjong.jsx`
- **Rules Key:** `GAME_RULES.mahjong`
- **Title:** "🀄 Mahjong Rules"

### Carrom
- **File:** `/app/frontend/src/pages/HttpMultiplayerCarrom.jsx`
- **Rules Key:** `GAME_RULES.carrom`
- **Title:** "🎯 Carrom Rules"

### Shogi
- **File:** `/app/frontend/src/pages/HttpMultiplayerShogi.jsx`
- **Rules Key:** `GAME_RULES.shogi`
- **Title:** "将 Shogi Rules"

### Xiangqi
- **File:** `/app/frontend/src/pages/HttpMultiplayerXiangqi.jsx`
- **Rules Key:** `GAME_RULES.xiangqi`
- **Title:** "象 Xiangqi Rules"

---

## Testing After Integration

1. Start the game
2. Click "Rules" button in top-right header
3. Verify modal opens with correct content
4. Verify all sections display:
   - 🎯 Objective
   - 🎲 Setup
   - 🎮 How to Play
   - ⚡ Special Rules
   - 🏆 Winning Condition
5. Click "Got it! Let's Play" or X to close
6. Verify modal closes properly

---

## Files Reference

**Components:**
- `/app/frontend/src/components/GameRulesModal.jsx` - Modal component
- `/app/frontend/src/config/gameRules.js` - All rules data

**Game Files:**
- All located in `/app/frontend/src/pages/HttpMultiplayer*.jsx`
