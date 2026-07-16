# MetaHuman Dealer Migration Plan

## Objective
Replace all AI dealers with MetaHuman dealers throughout the Global Vibez DSG app.

## Current State
- **MetaHuman Dealer Component**: `HumanHolographicDealer.jsx`
- **AI Dealer Components**: `NovaDealer.jsx`, `AIDealerHero.jsx`, `RealisticDealer.jsx`
- **Dealer Hook**: `useAIDealerVoice.js`

## Files to Update

### 1. Game Pages with Dealers
- `pages/games/HttpMultiplayerBlackjack.jsx`
- `pages/games/HttpMultiplayerPoker.jsx`
- `pages/games/VibezUno.jsx`
- `components/practice_games/PracticePoker.jsx`

### 2. Components with AI Dealers
- `components/ai/AIDealerHero.jsx` → Replace with HumanHolographicDealer
- `components/casino/NovaDealer.jsx` → Deprecate, use HumanHolographicDealer
- `components/casino/RealisticDealer.jsx` → Deprecate, use HumanHolographicDealer

### 3. Premium Tables
- `components/premium_tables/PremiumBlackjackTable.jsx`
- `components/premium_tables/BlackjackEnhancements.jsx`

### 4. Showcase Pages
- `pages/DealerShowcase.jsx` → Show only MetaHuman dealers
- `pages/MetaHumanDealerDemo.jsx` → Already correct
- `pages/MetaHumanDealerEnhanced.jsx` → Already correct
- `pages/ProfessionalDealerShowcase.jsx` → Already correct

## MetaHuman Dealer Features
- 4 diverse realistic dealers: Nova, Ace, Ruby, Jade
- Holographic overlay effects
- Realistic animations (dealing, shuffling, celebrating)
- Professional personality responses
- Mood-based expressions
- Tip dealer functionality

## Implementation Strategy

1. **Create Universal Dealer Component** (`MetaHumanDealer.jsx`)
   - Wrapper around HumanHolographicDealer
   - Easy drop-in replacement for all games
   - Smart context-aware responses

2. **Update All Games**
   - Replace NovaDealer imports with MetaHumanDealer
   - Update dealer props to match MetaHuman API
   - Ensure dealer animations sync with game state

3. **Deprecate AI Dealers**
   - Add deprecation notices to AI dealer files
   - Update documentation

4. **Testing**
   - Verify dealer appears in all games
   - Check animations work correctly
   - Test dealer voice/chat functionality

## Dealer Types Available
- **Nova** (African male) - Professional, confident
- **Ace** (Asian male) - Analytical, precise
- **Ruby** (Latina female) - Warm, encouraging
- **Jade** (Mixed female) - Cool, strategic

## Next Steps
1. Create universal MetaHumanDealer wrapper component
2. Update all game files to use new dealer
3. Remove/deprecate AI dealer references
4. Test across all games
5. Update documentation
