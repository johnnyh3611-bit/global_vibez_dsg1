# 🔧 Troubleshooting Guide - Demo Login & Baccarat AAA

## Issue 1: Demo Login Not Working

### Expected Behavior:
1. Click "🎮 Demo Login (Quick Access)" button on login page
2. Automatically log in as demo user
3. Redirect to `/dashboard`

### Current Status:
- **Backend API works**: `/api/auth/demo-login` returns 200 OK ✅
- **Frontend button exists**: LoginPage.jsx line 234-262 ✅
- **Code looks correct**: Proper fetch, credentials, navigation ✅

### To Test Manually:
1. Open browser console (F12)
2. Click "Demo Login" button
3. Check for any errors in console
4. Look for network request to `/api/auth/demo-login`
5. Check response

### Possible Issues:
- **CORS error**: Console shows "Access-Control-Allow-Origin" error
- **Cookie not being set**: Check Application > Cookies in DevTools
- **Navigation blocked**: Check if redirect happens

---

## Issue 2: Baccarat AAA Loads But Has Errors/Blank Screen

### Expected Behavior:
After login → `/games` → Casino tab → Baccarat → Should see AAA casino table

### Files Involved:
- `/app/frontend/src/components/practice_games/PracticeBaccaratAAA.jsx` - Main component
- `/app/frontend/src/components/casino/CasinoTable3D.jsx` - Table component  
- `/app/frontend/src/components/casino/PlayingCard3D.jsx` - Card component
- `/app/frontend/src/utils/casinoTheme.js` - Design tokens
- `/app/frontend/src/utils/shuffleAlgorithm.js` - Card logic

### Debugging Steps:

#### Step 1: Check Console Errors
```javascript
// Open browser console (F12) when on Baccarat page
// Look for:
- "Cannot read property of undefined"
- "X is not a function"  
- Import errors
- "Failed to compile"
```

#### Step 2: Check Network Tab
```
- Is `/api/practice/game/baccarat` being called?
- What's the response?
- Any 404/500 errors?
```

#### Step 3: Check Component Rendering
```javascript
// In console, type:
React.version // Should show React version
document.querySelector('canvas') // Should find canvas if CasinoTable3D rendered
```

#### Step 4: Common Issues to Check:

**A) Missing Dependencies:**
```bash
# Check if these exist:
ls /app/frontend/src/components/casino/CasinoChip.jsx
ls /app/frontend/src/components/ParticleEffectsOverlay.jsx
ls /app/frontend/src/utils/cardSoundManager.js
```

**B) Import Errors:**
Check browser console for:
- "Module not found"
- "Cannot resolve '@/components/...'"

**C) State Management:**
- Component uses `currentGameState` (renamed from `gameState` to avoid prop conflict)
- All useState hooks properly imported

---

## Quick Fix Checklist:

### For Demo Login:
- [ ] Clear browser cache/cookies
- [ ] Try incognito/private window
- [ ] Check if backend is running: `curl https://social-connect-953.preview.emergentagent.com/api/auth/demo-login -X POST`
- [ ] Check browser console for errors

### For Baccarat AAA:
- [ ] Frontend compiled without errors: `tail /var/log/supervisor/frontend.out.log`
- [ ] Navigate to `/games` (not old `/practice`)
- [ ] Click Casino tab (not searching for it)
- [ ] Click "Practice vs AI" button on Baccarat card
- [ ] Check browser console for errors
- [ ] Take screenshot of what you see

---

## What User Sees vs What Should Happen:

### Demo Login:
**What should happen:**
1. Click button → Loading state → Navigate to dashboard

**If broken:**
- Button does nothing
- Gets error message
- Stays on login page

### Baccarat AAA:
**What should happen:**
1. Click Baccarat → Page loads → See green casino table, betting zones, chips

**If broken (Option 2 - "loads but errors/blank"):**
- White/blank screen
- Error message shown
- Partial render (some elements missing)
- Console shows JavaScript errors

---

## Manual Testing Script:

```
1. Open https://social-connect-953.preview.emergentagent.com
2. Click "🎮 Demo Login (Quick Access)"
3. Expected: Redirect to /dashboard
4. Actual: _____________

5. Navigate to /games
6. Click "Casino" tab
7. Find "Baccarat" card
8. Click "Practice vs AI" button
9. Expected: AAA casino table loads
10. Actual: _____________
```

---

## Need More Info:

Please provide:
1. **Screenshot** of what you see when clicking Baccarat
2. **Browser console errors** (F12 → Console tab)
3. **Network tab** - any failed requests?
4. **Exact steps** you're taking

This will help me pinpoint the exact issue!
