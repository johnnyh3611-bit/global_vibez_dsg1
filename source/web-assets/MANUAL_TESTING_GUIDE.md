# 🧪 Manual Testing Guide - Nova AI Dealer

## How to Test the Animated Dealer

### Step 1: Access Practice Mode
1. Open your app: http://localhost:3000
2. Login (if required)
3. Navigate to **Practice Arena** or **/practice**

### Step 2: Start Blackjack Game
1. **Click** on the "Blackjack" card (🃏 emoji, red-to-black gradient)
2. **Look at the RIGHT SIDEBAR** - a "Ready to Play" panel should appear
3. **Click** the big purple "Start Practice Game" button
4. Game should load with the casino table

### Step 3: Verify NovaDealer Component
Once in the game, you should see:
- **Nova Dealer Avatar**: Circular avatar at top-center of table
- **Visual Effects**:
  - Rotating cyan and pink glowing rings
  - Holographic purple/pink gradient blur
  - Sparkles rotating in corners
  - Floating particles
- **Text Elements**:
  - "NOVA" badge at bottom of avatar
  - "AI Holographic Dealer" label below
  - Status text: "✨ Ready"

### Step 4: Test Animation States

**Test Idle State** (Before dealing):
- Dealer should show 🎰 emoji (fallback) or idle video
- Status: "✨ Ready"

**Test Dealing State**:
- Place a bet (if betting phase)
- Start the hand
- **Expected**: 
  - Dealer shows 🃏 emoji or dealing video
  - Status: "🃏 Dealing..."
  - Cards appear on table

**Test Celebrating State**:
- Win a hand
- **Expected**:
  - Dealer shows 🎉 emoji or celebrating video
  - Status: "🎉 Celebrating!"
  - Speech bubble: "Congratulations! You win!"
  - Celebration lasts 2 seconds

**Test Big Win State**:
- Get Blackjack (21 with 2 cards: Ace + 10/J/Q/K)
- **Expected**:
  - Dealer shows 🎉 emoji with excited animation
  - Status: "🎉 Celebrating!"
  - Speech bubble: "🚨 JACKPOT! INCREDIBLE WIN! 🚨"
  - Celebration lasts 3 seconds
  - Confetti appears

### Step 5: Test Table Switching
1. Click the **Settings button** (⚙️ icon, bottom-left floating)
2. Try switching table styles:
   - Classic (green felt)
   - Cyberpunk (neon purple)
   - VIP (gold/black)
   - Minimalist (white)
3. **Expected**: NovaDealer works on all tables

---

## 🐛 Known Issues / Troubleshooting

### Issue: Game doesn't load after clicking "Start Practice Game"
**Symptoms**: Button says "Starting..." but never navigates to game
**Possible Causes**:
- Backend API `/api/practice/start` failing
- Session/auth issue
- Network error

**Debug Steps**:
1. Open browser DevTools (F12) → Console tab
2. Look for errors when clicking "Start Practice Game"
3. Check Network tab for failed API calls
4. Check backend logs: `tail -f /var/log/supervisor/backend.err.log`

### Issue: NovaDealer not visible
**Symptoms**: Table loads but no dealer avatar
**Possible Causes**:
- Component not rendering
- CSS/styling issue
- Import error

**Debug Steps**:
1. Open DevTools Console
2. Look for React errors
3. Check if `<NovaDealer>` element exists in DOM (Elements tab)

### Issue: Videos not playing
**Symptoms**: Emoji placeholders show instead of videos
**This is EXPECTED**: Videos haven't been added yet
**Solution**: Download videos and place in `/app/frontend/public/videos/` (see README)

---

## ✅ Success Checklist

After testing, verify:
- [ ] NovaDealer component renders
- [ ] Holographic effects visible (glowing rings, sparkles)
- [ ] Fallback emoji animations work (🎰 🎴 🃏 🎉)
- [ ] Status text changes based on game state
- [ ] Speech bubbles appear
- [ ] Celebration triggers on wins
- [ ] Component works on all table layouts
- [ ] No console errors

---

## 🆘 If Something's Broken

### Frontend Errors
Run linting:
```bash
cd /app/frontend && yarn lint
```

Check for compilation errors:
```bash
tail -f /var/log/supervisor/frontend.err.log
```

### Backend Errors
Check if practice API is working:
```bash
API_URL=$(grep REACT_APP_BACKEND_URL /app/frontend/.env | cut -d '=' -f2)
curl -X GET "$API_URL/api/practice/stats" -H "Cookie: session_id=test"
```

### Restart Services
```bash
sudo supervisorctl restart frontend
sudo supervisorctl restart backend
```

---

## 📸 What It Should Look Like

**NovaDealer (Fallback Mode)**:
- Circular avatar with emoji in center
- Rotating cyan/pink borders (2 rings)
- Purple/pink holographic glow
- Sparkles in top-right and bottom-left corners
- "NOVA" badge at bottom
- Speech bubble above with dealer phrase

**During Celebration**:
- 🎉 emoji grows and pulses
- Speech bubble says "Congratulations! You win!"
- Status text: "🎉 Celebrating!"
- Confetti falls from top of screen

---

Let me know what you see when you test!
