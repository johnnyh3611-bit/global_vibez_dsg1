# 🔧 Local WebSocket Testing Guide

## Overview

This guide helps you test multiplayer features **locally** by bypassing the Kubernetes ingress blocker. Local mode connects directly to `localhost:8001`, avoiding the WebSocket upgrade issues.

---

## 🚀 Quick Start

### Switch to Local Mode

```bash
cd /app
./switch_websocket_mode.sh local
```

This will:
- ✅ Backup your current `.env` file
- ✅ Update `REACT_APP_BACKEND_URL` to `http://localhost:8001`
- ✅ Restart the frontend service
- ✅ Enable WebSocket connections via localhost

### Switch Back to Production Mode

```bash
./switch_websocket_mode.sh production
```

---

## 🧪 Testing Multiplayer Locally

### Method 1: Two Browser Windows (Same Machine)

**Requirements:**
- Access to the pod's localhost via port forwarding or direct access

**Steps:**

1. **Start Local Mode:**
   ```bash
   ./switch_websocket_mode.sh local
   ```

2. **Open Two Browser Windows:**
   - Window 1: `http://localhost:3000`
   - Window 2: `http://localhost:3000` (incognito/private mode)

3. **Authenticate Both:**
   - Sign in with Google Auth in both windows
   - Use different Google accounts or same account

4. **Test Matchmaking:**
   - **Window 1 (Player 1):**
     - Navigate to `/multiplayer`
     - Enter name "Alice"
     - Select "Tic-Tac-Toe"
     - Click "FIND MATCH"
   
   - **Window 2 (Player 2):**
     - Navigate to `/multiplayer`
     - Enter name "Bob"
     - Select "Tic-Tac-Toe"
     - Click "FIND MATCH"
     - Should see "MATCH FOUND!" with Alice's name
     - Click "ACCEPT"

5. **Play the Game:**
   - Both windows navigate to game room automatically
   - Alice (X) goes first
   - Take turns clicking cells
   - Verify moves sync in real-time
   - Check winner celebration

---

### Method 2: Using Frontend Testing Agent

**After switching to local mode**, you can use the frontend testing agent to simulate two players:

```bash
# The testing agent can open multiple browser contexts
# and simulate real multiplayer gameplay
```

---

## 📊 Verification Checklist

After switching to local mode, verify:

- [ ] Connection status badge shows "Connected" (green)
- [ ] Online player count shows > 0
- [ ] "FIND MATCH" button is enabled (not grayed out)
- [ ] Browser console shows: "✅ Connected to multiplayer server"
- [ ] No WebSocket timeout errors

---

## 🔄 How It Works

### Production Mode (Default)
```
Frontend → Kubernetes Ingress → Backend Socket.IO
          ❌ WebSocket blocked here
```

### Local Mode
```
Frontend → localhost:8001 → Backend Socket.IO
          ✅ Direct connection, no ingress
```

**Key Difference:**
- Local mode bypasses the Kubernetes NGINX ingress entirely
- Connects directly to the backend running on port 8001
- WebSocket upgrade succeeds because there's no proxy in between

---

## 🛠️ Configuration Details

### What Gets Changed

**Frontend `.env` File:**

**Production Mode:**
```bash
REACT_APP_BACKEND_URL=https://social-connect-953.preview.emergentagent.com
```

**Local Mode:**
```bash
REACT_APP_BACKEND_URL=http://localhost:8001
```

### Backend Configuration
No changes needed! The backend Socket.IO server is already configured to accept connections from any origin (`cors_allowed_origins='*'`).

---

## 🚨 Important Notes

### Limitations of Local Mode

1. **Pod Access Only:**
   - Only works when accessing from within the pod or via port forwarding
   - External users cannot test (they need production mode with WebSocket support)

2. **No Public Preview:**
   - The preview URL will NOT work in local mode
   - You must use `http://localhost:3000`

3. **Testing Scope:**
   - Great for development and debugging
   - Not suitable for showing to users/clients
   - Need production WebSocket support for public testing

### When to Use Each Mode

| Use Case | Mode |
|----------|------|
| Local development & testing | **Local** |
| Debugging multiplayer logic | **Local** |
| Testing with 2+ browser windows | **Local** |
| Public preview/demo | **Production** (requires WebSocket fix) |
| Sharing with users | **Production** (requires WebSocket fix) |
| Production deployment | **Production** (requires WebSocket fix) |

---

## 🧪 Testing Scenarios

### Scenario 1: Test Tic-Tac-Toe

```bash
# Switch to local mode
./switch_websocket_mode.sh local

# Open browser: http://localhost:3000/multiplayer
# Player 1: Enter name, select Tic-Tac-Toe, FIND MATCH
# Player 2: (new window) Enter name, select Tic-Tac-Toe, FIND MATCH
# Player 2: Click ACCEPT
# Play game: Alternate turns until win/lose/draw
```

### Scenario 2: Test Connect 4

```bash
# Same as above, but select "Connect 4" instead
# Test gravity physics and 4-in-a-row detection
```

### Scenario 3: Test Accept/Reject

```bash
# Player 1: Start matchmaking
# Player 2: Start matchmaking, receive proposal
# Player 2: Click REJECT
# Verify: Both players return to searching
# Player 2: Find new match, click ACCEPT
# Verify: Game starts successfully
```

### Scenario 4: Test Disconnection

```bash
# Start a game between two players
# Close one browser window (simulate disconnect)
# Verify: Other player sees "Player left" message
# Verify: Room closes gracefully
```

---

## 📝 Troubleshooting

### Issue: Still Shows "Disconnected"

**Check:**
1. Frontend service restarted after switching modes?
   ```bash
   sudo supervisorctl status frontend
   ```

2. Correct URL in `.env`?
   ```bash
   grep REACT_APP_BACKEND_URL /app/frontend/.env
   # Should show: http://localhost:8001
   ```

3. Backend Socket.IO running?
   ```bash
   curl http://localhost:8001/socket.io/
   # Should return: {"code":0,"message":"Transport unknown"}
   ```

**Solution:**
```bash
# Restart both services
sudo supervisorctl restart backend frontend

# Wait 10 seconds, then refresh browser
```

---

### Issue: Can't Access localhost:3000

**If you're not inside the pod:**

1. **Set up port forwarding:**
   ```bash
   kubectl port-forward pod/your-pod-name 3000:3000 8001:8001
   ```

2. **Or use VS Code port forwarding** (if available)

3. **Or switch back to production mode** and wait for WebSocket fix

---

### Issue: Authentication Fails

**In local mode, ensure:**
- Emergent Google Auth callback URLs include `localhost:3000`
- Session cookies work on localhost
- Try using the same browser for both players (one normal, one incognito)

---

## 🔙 Restoring Production Mode

When Emergent support fixes WebSocket:

```bash
./switch_websocket_mode.sh production
```

This will:
- Restore the original preview URL
- Restart frontend service
- Re-enable public access

---

## 📊 Monitoring

### Check WebSocket Connection

**Browser Console:**
```javascript
// Should see:
✅ Connected to multiplayer server

// Should NOT see:
❌ Connection error: Error: timeout
❌ WebSocket is closed before the connection is established
```

### Check Backend Logs

```bash
tail -f /var/log/supervisor/backend.*.log | grep socket
```

Look for:
```
✅ Client connected: <session_id> (Total online: 1)
🎮 Match proposed: Alice vs Bob
✅ Match accepted! Room: ABC123
```

---

## 🎯 Success Criteria

Your local setup is working if:

- ✅ Connection badge is GREEN ("Connected")
- ✅ Online player count updates in real-time
- ✅ FIND MATCH button is enabled
- ✅ Match proposals appear instantly
- ✅ Accept button navigates to game room
- ✅ Moves sync in real-time between players
- ✅ Winner/loser screens show correctly
- ✅ No console errors related to WebSocket

---

## 📧 Need Help?

If local mode isn't working:

1. Check all troubleshooting steps above
2. Review `/app/MULTIPLAYER_README.md` for architecture details
3. Inspect browser console for specific errors
4. Check backend logs for Socket.IO connection events

---

## 🚀 Next Steps

Once local testing is complete and everything works:

1. **Document any bugs found** → Fix them
2. **Switch back to production mode**
3. **Contact Emergent support** with WebSocket request
4. **Test publicly** once WebSocket is enabled

---

**Happy Testing!** 🎮✨
