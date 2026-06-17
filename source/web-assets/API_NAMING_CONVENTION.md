# API Naming Convention & Route Documentation
## Global Vibez DSG Platform

**Last Updated**: April 17, 2026  
**Total Routes**: 112 backend Python files

---

## 📋 NAMING CONVENTIONS (Established)

### URL Paths (Frontend-facing)
- **Format**: `kebab-case`
- **Examples**: 
  - `/api/bid-whist/start`
  - `/api/admin/master-stats`
  - `/api/multiplayer-poker/join`

### Backend File Names
- **Format**: `snake_case`
- **Examples**:
  - `bid_whist.py`
  - `admin_dashboard.py`
  - `multiplayer_poker.py`

### Python Functions/Variables
- **Format**: `snake_case`
- **Examples**:
  - `def get_user_stats():`
  - `current_player_index = 0`
  - `room_code = generate_code()`

### Route Prefixes
All backend routes MUST use `/api` prefix for Kubernetes ingress routing:
- ✅ Correct: `/api/games/start`
- ❌ Wrong: `/games/start`

---

## 🎮 GAME ROUTES

### Bid Whist (`/routes/bid_whist.py`)
- `POST /api/bid-whist/start` - Start new game
- `POST /api/bid-whist/bid` - Place bid
- `POST /api/bid-whist/play-card` - Play card
- `POST /api/bid-whist/forfeit` - Forfeit game (15% penalty)

### Bid Whist Practice (`/routes/bid_whist_practice.py`)
- `POST /api/bid-whist-practice/start` - AI practice mode
- `POST /api/bid-whist-practice/bid` - Practice bidding
- `POST /api/bid-whist-practice/play-card` - Practice play

### Bid Whist Meta (`/routes/bid_whist_meta.py`)
- `POST /api/bid-whist-meta/start` - MetaHuman dealer version

### Poker (`/routes/poker.py`)
- `POST /api/poker/create-table`
- `POST /api/poker/join-table`
- `POST /api/poker/fold`
- `POST /api/poker/call`
- `POST /api/poker/raise`

### UNO (`/routes/uno.py`)
- `POST /api/uno/create-room`
- `POST /api/uno/play-card`
- `POST /api/uno/draw-card`
- `POST /api/uno/call-uno`

### Blackjack (`/routes/blackjack.py`)
- `POST /api/blackjack/start`
- `POST /api/blackjack/hit`
- `POST /api/blackjack/stand`
- `POST /api/blackjack/double-down`
- `POST /api/blackjack/split`

### Baccarat (`/routes/baccarat.py`)
- `POST /api/baccarat/start`
- `POST /api/baccarat/bet`

### Roulette (`/routes/roulette.py`)
- `POST /api/roulette/spin`
- `POST /api/roulette/place-bet`

### Slots (`/routes/slots.py`)
- `POST /api/slots/spin`
- `GET /api/slots/jackpot`

### 654 Dice (`/routes/dice_654.py`)
- `POST /api/dice-654/roll`
- `POST /api/dice-654/bet`

---

## 👤 USER & AUTH ROUTES

### Authentication (`/routes/google_auth.py`, `/routes/email_auth.py`)
- `POST /api/auth/google/login` - Google OAuth
- `POST /api/auth/google/callback`
- `POST /api/auth/email/register` - Email/password
- `POST /api/auth/email/login`
- `POST /api/auth/logout`

### User Profile (`/routes/user.py`)
- `GET /api/user/profile`
- `PUT /api/user/profile`
- `GET /api/user/stats`
- `GET /api/user/balance`

### Wallet (`/routes/wallet.py`)
- `GET /api/wallet/balance`
- `POST /api/wallet/deposit`
- `POST /api/wallet/withdraw`
- `GET /api/wallet/transactions`

---

## 🏆 SOCIAL & COMMUNITY ROUTES

### Leaderboard (`/routes/leaderboard.py`)
- `GET /api/leaderboard/global`
- `GET /api/leaderboard/game/{game_type}`
- `GET /api/leaderboard/weekly`

### Tournaments (`/routes/tournaments.py`)
- `GET /api/tournaments/list`
- `POST /api/tournaments/create`
- `POST /api/tournaments/join/{tournament_id}`
- `GET /api/tournaments/{tournament_id}`

### Friends (`/routes/friends.py`)
- `GET /api/friends/list`
- `POST /api/friends/add`
- `POST /api/friends/remove`
- `GET /api/friends/online`

### Messaging (`/routes/messaging.py`)
- `GET /api/messages/inbox`
- `POST /api/messages/send`
- `PUT /api/messages/read/{message_id}`

---

## 🎥 STREAMING & MEDIA ROUTES

### Streaming (`/routes/streaming.py`)
- `POST /api/streaming/start`
- `POST /api/streaming/stop`
- `GET /api/streaming/active`

### My Vibez (User Content) (`/routes/my_vibez.py`)
- `GET /api/my-vibez/feed`
- `POST /api/my-vibez/upload`
- `GET /api/my-vibez/video/{video_id}`

### Watch & Wager (`/routes/watch_wager.py`)
- `GET /api/watch-wager/streams`
- `POST /api/watch-wager/bet`

---

## 👑 ADMIN ROUTES

### God Mode Dashboard (`/routes/admin_dashboard.py`)
- `POST /api/admin/vault-auth` - Admin login (HttpOnly cookie)
- `POST /api/admin/vault-logout` - Admin logout
- `GET /api/admin/master-stats` - Overview statistics
- `GET /api/admin/token-velocity` - Financial metrics
- `GET /api/admin/live-activity` - Real-time activity
- `GET /api/admin/all-users` - User management
- `GET /api/admin/user-detail/{user_id}` - User details
- `POST /api/admin/ban-user` - Ban user

**Security**: All admin routes protected by `Depends(verify_admin_cookie)`

### Casino God Mode (`/routes/god_mode_casino.py`)
- `GET /api/god-mode/casino-stats`
- `POST /api/god-mode/adjust-odds`

### System Monitor (`/routes/system_monitor.py`)
- `GET /api/system/health`
- `GET /api/system/metrics`

---

## 💰 PAYMENT ROUTES

### Stripe (`/routes/stripe_payments.py`)
- `POST /api/payments/create-checkout`
- `POST /api/payments/webhook`
- `GET /api/payments/history`

### Crypto Payments (`/routes/crypto_payments.py`)
- `POST /api/crypto/create-payment`
- `GET /api/crypto/verify/{payment_id}`

---

## 🎮 MULTIPLAYER INFRASTRUCTURE

### WebSocket Events (Socket.IO) (`/routes/metahuman_websocket.py`)
All multiplayer games use Socket.IO for real-time communication:

**UNO Events**:
- `create_uno_room`
- `join_uno_room`
- `uno_table_created`
- `uno_state_update`
- `uno_play_card`
- `uno_called`

**Poker Events**:
- `create_poker_room`
- `join_poker_room`
- `poker_table_created`
- `poker_state_update`
- `poker_fold`, `poker_call`, `poker_raise`

**Blackjack Events**:
- `create_blackjack_table`
- `join_blackjack_table`
- `blackjack_table_created`
- `blackjack_state_update`
- `blackjack_hit`, `blackjack_stand`

### HTTP Multiplayer Lobby (`/routes/http_multiplayer.py`)
- `POST /api/http-multiplayer/create`
- `POST /api/http-multiplayer/join/{room_code}`
- `GET /api/http-multiplayer/rooms`

---

## 🔧 UTILITY ROUTES

### Health Check
- `GET /api/health` - Service health status

### Uploads (`/routes/uploads.py`)
- `POST /api/uploads/image`
- `POST /api/uploads/video`
- `GET /api/uploads/{file_id}`

### Notifications (`/routes/notifications.py`)
- `GET /api/notifications/unread`
- `PUT /api/notifications/mark-read`

---

## 📊 ROUTE STATISTICS

| Category | Route Count | Security Level |
|----------|-------------|----------------|
| Game Routes | ~40 | Public (with auth) |
| User/Auth | ~10 | Mixed |
| Admin | ~15 | HttpOnly Cookie |
| Social | ~12 | Authenticated |
| Streaming | ~8 | Authenticated |
| Payments | ~6 | Stripe Webhook |
| Multiplayer | ~20 | Socket.IO |
| Utility | ~5 | Public |

**Total Backend Files**: 112 Python route files  
**Total API Endpoints**: ~200+ endpoints

---

## ✅ COMPLIANCE CHECKLIST

When adding new routes, ensure:
- [ ] URL uses kebab-case: `/api/my-new-route`
- [ ] File uses snake_case: `my_new_route.py`
- [ ] All routes prefixed with `/api`
- [ ] Authentication added where needed
- [ ] CORS credentials enabled for auth routes
- [ ] Error handling implemented
- [ ] Documented in this file

---

## 🔒 SECURITY NOTES

### Protected Routes
- Admin routes: `Depends(verify_admin_cookie)`
- User routes: `Depends(get_current_user)`
- Payment webhooks: Stripe signature verification

### CORS Configuration
- Specific origins only (no wildcard for credential routes)
- `allow_credentials=True` for auth/admin routes

---

**Maintained By**: Development Team  
**Review Frequency**: Monthly or after major route additions
