# 🌍 Global Vibes - Complete App Overview
*Last Updated: March 14, 2025*

---

## 📊 **Project Statistics**
- **Total Lines of Code**: ~8,284 lines
- **Backend**: FastAPI + MongoDB (Motor async driver)
- **Frontend**: React + Tailwind CSS + Shadcn UI
- **Architecture**: Modular monorepo with hot reload
- **Launch Target**: 30 days from today

---

## 🎯 **App Purpose**
Global Vibes is a **social dating platform** that connects couples worldwide through:
- Real-time translation for cross-border connections
- Interactive multiplayer games for couples
- Tournament mode for competitive couples
- Speed dating with video/text chat options
- GPS safety features for real-world meetups
- Premium membership with Stripe payments

---

## 🏗️ **Technical Architecture**

### **Backend Structure** (`/app/backend/`)
```
backend/
├── server.py              # Main FastAPI app (1,293 lines)
│                         # - Database initialization
│                         # - Auth endpoints (Google OAuth)
│                         # - User CRUD
│                         # - Swipe/Match/Message logic
│                         # - Stripe payment integration
│                         # - Real-time translation (OpenAI GPT-4o)
│                         # - Referral system
│
├── models/               # Pydantic models for validation
│   ├── user.py          # User, UserUpdate, UserPreferences
│   ├── swipe.py         # SwipeAction, SwipeResponse
│   ├── match.py         # Match model
│   ├── message.py       # Message, MessageCreate
│   ├── payment.py       # Payment tracking
│   ├── referral.py      # Referral system
│   └── translation.py   # Translation request/response
│
├── routes/              # Feature-specific API routers
│   ├── categories.py    # Dating categories (hobbies, goals)
│   ├── games.py         # Game listing & gameplay (PLACEHOLDER)
│   ├── tournaments.py   # Tournament CRUD (BASIC LOGIC)
│   ├── speed_dating.py  # Speed dating rooms (PLACEHOLDER)
│   └── safety.py        # GPS location sharing (PLACEHOLDER)
│
└── utils/
    └── database.py      # DB connection & auth helpers
```

### **Frontend Structure** (`/app/frontend/src/`)
```
frontend/src/
├── App.js               # React Router setup
│
├── pages/               # 22 page components
│   ├── Landing.jsx      # Hero landing page
│   ├── AuthCallback.jsx # Google OAuth callback
│   ├── ProfileSetup.jsx # Onboarding flow
│   ├── Dashboard.jsx    # Main hub (cards for all features)
│   ├── Discover.jsx     # Swipe interface
│   ├── Matches.jsx      # Match list
│   ├── Messages.jsx     # Conversation list
│   ├── Chat.jsx         # 1-on-1 messaging with translation
│   ├── Categories.jsx   # Interest category selection
│   ├── DiscoverByCategory.jsx # Browse users by category
│   ├── Games.jsx        # Game lobby (NEEDS LOGIC)
│   ├── GamePlay.jsx     # Actual gameplay UI (NEEDS LOGIC)
│   ├── GameDemo.jsx     # Visual showcase of 15 games
│   ├── Tournaments.jsx  # Tournament browser (NEEDS LOGIC)
│   ├── SpeedDating.jsx  # Speed dating lobby (NEEDS VIDEO)
│   ├── SpeedDatingRoom.jsx # Active speed date (NEEDS VIDEO)
│   ├── Safety.jsx       # GPS tracking dashboard (NEEDS LOGIC)
│   ├── Upgrade.jsx      # Premium membership sales page
│   ├── Referral.jsx     # Referral dashboard & tracking
│   ├── ProfileEdit.jsx  # Edit profile + categories
│   ├── PaymentSuccess.jsx # Stripe success redirect
│   └── PaymentCancel.jsx  # Stripe cancel redirect
│
└── components/ui/       # 40+ Shadcn UI components
    ├── button.jsx, card.jsx, dialog.jsx, etc.
```

---

## ✅ **FULLY FUNCTIONAL FEATURES**

### 1. **Authentication & User Management**
- ✅ Google OAuth (Emergent-managed, no keys needed)
- ✅ User profiles with photos, bio, age, gender, location
- ✅ Profile completion tracking
- ✅ Interest tags and dating preferences

**Endpoints:**
- `GET /api/auth/google` - Initiate Google login
- `GET /api/auth/callback` - OAuth callback
- `GET /api/users/me` - Get current user
- `PUT /api/users/me` - Update profile

---

### 2. **Swipe & Match System**
- ✅ Tinder-style swipe interface
- ✅ Like/dislike actions
- ✅ Automatic match detection when both users like each other
- ✅ Daily swipe limits (Free: 20/day, Premium: unlimited)
- ✅ Discovery feed with age/distance filters

**Endpoints:**
- `GET /api/discover` - Get swipeable profiles
- `POST /api/swipe` - Record swipe action
- `GET /api/matches` - Get all matches (optimized query)

**Database:**
- `swipes` collection: {swiper_id, swiped_id, action, timestamp}
- `matches` collection: {user1_id, user2_id, both_ids, created_at}

---

### 3. **Real-Time Messaging**
- ✅ One-on-one chat between matched users
- ✅ Message persistence in MongoDB
- ✅ Auto-refresh with 3-second polling
- ✅ Unread message tracking
- ✅ Conversation list with last message preview

**Endpoints:**
- `GET /api/messages` - Get conversation list
- `GET /api/conversation/{match_id}` - Get messages
- `POST /api/conversation/{match_id}/message` - Send message

**Database:**
- `conversations` collection: {conversation_id, participants, last_message, unread_count}
- `messages` collection: {message_id, conversation_id, sender_id, content, timestamp}

---

### 4. **Real-Time Translation** 🌍
- ✅ OpenAI GPT-4o integration via Emergent LLM Key
- ✅ Translate messages between any languages
- ✅ Automatic language detection
- ✅ Preserves original + translation side-by-side

**Endpoint:**
- `POST /api/translate` - Translate text

**Integration:**
- Uses `emergentintegrations` library
- Powered by Emergent Universal Key (no user API key needed)

---

### 5. **Premium Membership & Payments** 💳
- ✅ Stripe integration (test mode)
- ✅ $9.99/month Premium tier
- ✅ Checkout flow with success/cancel redirects
- ✅ Automatic membership upgrade on payment
- ✅ Feature gating (unlimited swipes for premium)

**Endpoints:**
- `POST /api/create-checkout-session` - Start Stripe checkout
- `GET /api/checkout/status?session_id=xxx` - Verify payment

**Test Card:**
- Number: `4242 4242 4242 4242`
- Expiry: Any future date
- CVC: Any 3 digits

---

### 6. **Referral System** 🎁
- ✅ Unique referral codes for each user
- ✅ Referral tracking (who referred whom)
- ✅ Leaderboard of top referrers
- ✅ Reward system (3 referrals = 1 month free Premium)
- ✅ Auto-apply Premium when threshold reached

**Endpoints:**
- `GET /api/referral/dashboard` - User's referral stats
- `POST /api/referral/apply-code` - Apply someone's code
- `GET /api/referral/leaderboard` - Top referrers

---

### 7. **Dating Categories** 🎯
- ✅ 24 interest-based categories (Hiking, Foodie, Gaming, Fitness, etc.)
- ✅ Users select 3-5 categories in profile
- ✅ Browse users by shared interests
- ✅ Category filtering in discovery

**Endpoints:**
- `GET /api/categories/all` - List all 24 categories
- `GET /api/categories/{category}/users` - Browse users by category

---

### 8. **Database Optimization** ⚡
- ✅ Fixed N+1 query issues in matches/messages
- ✅ Added indexes on frequently queried fields (user_id, match_id, timestamp)
- ✅ Bulk operations for efficiency
- ✅ Proper projection (exclude `_id` to avoid serialization issues)

---

## 🟡 **PLACEHOLDER FEATURES** (Need Implementation)

### 9. **Interactive Games** 🎮
**Status:** UI + API scaffold exists, NO game logic

**What Exists:**
- ✅ Game lobby page (`Games.jsx`)
- ✅ Gameplay page (`GamePlay.jsx`)
- ✅ Demo page showcasing 15 games (`GameDemo.jsx`)
- ✅ API endpoints: `/api/games/list`, `/api/games/play/:gameId`
- ✅ 15 games listed:
  - **Card Games**: Poker, Blackjack, UNO, Go Fish, Rummy, Hearts, Spades, Crazy Eights
  - **Board Games**: Chess, Checkers, Connect 4, Tic Tac Toe, Reversi, Backgammon, Ludo

**What's Missing:**
- ❌ Game state management (board/card state)
- ❌ Turn-based logic (whose turn, valid moves)
- ❌ Game rules enforcement
- ❌ Real-time updates between players
- ❌ Win condition detection

**Implementation Priority:** 🔴 HIGH (User requested this first)

**Next Steps:**
1. Implement Tic Tac Toe (simplest, 3x3 grid, turn-based)
2. Implement Connect 4 (similar to Tic Tac Toe, 6x7 grid, gravity)
3. Implement UNO (card game, more complex state management)

---

### 10. **Tournament Mode** 🏆
**Status:** Basic CRUD exists, NO bracket/progression logic

**What Exists:**
- ✅ Tournament page (`Tournaments.jsx`)
- ✅ API endpoints:
  - `POST /api/tournaments/create` - Create tournament
  - `POST /api/tournaments/join` - Join with partner
  - `GET /api/tournaments/list` - List tournaments
  - `GET /api/tournaments/{id}` - Get details
  - `GET /api/tournaments/{id}/bracket` - Get bracket structure
- ✅ Team registration (couples form teams)
- ✅ Basic validation (must be matched to partner)

**What's Missing:**
- ❌ Bracket generation & management (single/double elimination)
- ❌ Match progression logic (advance winners to next round)
- ❌ Score tracking & winner declaration
- ❌ Real-time bracket updates
- ❌ Tournament lifecycle (registration → in_progress → completed)

**Implementation Priority:** 🟡 MEDIUM (Works with games)

---

### 11. **Speed Dating** 🎥
**Status:** UI exists, NO video integration

**What Exists:**
- ✅ Speed dating lobby (`SpeedDating.jsx`)
- ✅ Speed dating room (`SpeedDatingRoom.jsx`)
- ✅ API endpoints: `/api/speed-dating/room`, `/api/speed-dating/rooms/active`
- ✅ Timer UI (5-minute countdown)

**What's Missing:**
- ❌ Video chat integration (Daily.co, Agora, or WebRTC)
- ❌ Real-time room matching
- ❌ Audio/video device selection
- ❌ Mutual like detection at end of date
- ❌ Session limits (Free: 3/day, Premium: unlimited)

**Implementation Priority:** 🟡 MEDIUM (Requires 3rd party, user said no 3rd party for now)

---

### 12. **GPS Safety Tracking** 📍
**Status:** UI exists, NO real tracking

**What Exists:**
- ✅ Safety dashboard (`Safety.jsx`)
- ✅ API endpoints: `/api/safety/share-location`, `/api/safety/sos`
- ✅ UI for emergency contacts and check-ins

**What's Missing:**
- ❌ Browser Geolocation API integration
- ❌ Real-time location sharing (WebSocket or polling)
- ❌ Map visualization (Google Maps or Leaflet)
- ❌ Emergency SOS alerts
- ❌ Time-limited sharing (2-4 hours)

**Implementation Priority:** 🟢 LOW (Nice-to-have for launch)

---

### 13. **Date Planning** 📅
**Status:** NOT STARTED

**What's Needed:**
- ❌ Restaurant/venue suggestions (Google Places API)
- ❌ Activity ideas based on location
- ❌ Calendar integration for scheduling
- ❌ Split bill calculator
- ❌ Date itinerary builder

**Implementation Priority:** 🟢 LOW (Not critical for MVP)

---

### 14. **3D/4D Visuals** 🎨
**Status:** COSMETIC ONLY (CSS text, not real 3D)

**What Exists:**
- ✅ CSS classes that say "4D" in game demo

**What's Missing:**
- ❌ Three.js or Babylon.js integration
- ❌ 3D game boards
- ❌ 3D card/piece models
- ❌ Animations and visual effects

**Implementation Priority:** 🟢 LOW (Nice visual polish, not critical)

---

## 🗄️ **Database Schema**

### Collections:
1. **users** - User profiles, preferences, membership
2. **swipes** - Swipe actions (like/dislike)
3. **matches** - Matched pairs
4. **conversations** - Conversation metadata
5. **messages** - Individual messages
6. **payments** - Transaction records
7. **referrals** - Referral tracking
8. **tournaments** - Tournament data (needs expansion)
9. **games** - Game state (needs creation)

---

## 🔐 **Environment Variables**

### Backend (`.env`):
```bash
MONGO_URL=mongodb://localhost:27017
DB_NAME=dating_app
STRIPE_API_KEY=sk_test_... (provided by Emergent)
EMERGENT_LLM_KEY=... (Emergent Universal Key)
GOOGLE_CLIENT_ID=... (Emergent-managed)
GOOGLE_CLIENT_SECRET=... (Emergent-managed)
```

### Frontend (`.env`):
```bash
REACT_APP_BACKEND_URL=https://social-connect-953.preview.emergentagent.com
```

---

## 🚀 **30-Day Launch Roadmap**

### **Week 1 (Days 1-7): Game Implementation** 🎮
- **Day 1-2**: Tic Tac Toe (full logic + UI)
- **Day 3-4**: Connect 4 (full logic + UI)
- **Day 5-7**: UNO (basic version: draw, play, win conditions)
- **Testing**: Multiplayer game sessions between matched users

### **Week 2 (Days 8-14): Tournament System** 🏆
- **Day 8-9**: Bracket generation (single elimination, 4/8/16 teams)
- **Day 10-11**: Match progression & score tracking
- **Day 12-13**: Tournament lifecycle management
- **Day 14**: Testing & bug fixes

### **Week 3 (Days 15-21): Polish & Testing** ✨
- **Day 15-16**: Comprehensive testing (all features)
- **Day 17-18**: Bug fixes & edge cases
- **Day 19-20**: Performance optimization
- **Day 21**: User experience improvements

### **Week 4 (Days 22-30): Production Prep** 🚢
- **Day 22-23**: Stripe live mode setup (user's own API keys)
- **Day 24-25**: Security audit & final testing
- **Day 26-27**: Analytics & monitoring setup
- **Day 28-29**: Soft launch & bug fixes
- **Day 30**: 🎉 **PUBLIC LAUNCH**

---

## 📋 **API Endpoint Summary**

### **Authentication**
- `GET /api/auth/google` - Google OAuth login
- `GET /api/auth/callback` - OAuth callback
- `GET /api/users/me` - Get current user
- `PUT /api/users/me` - Update profile

### **Swipe & Match**
- `GET /api/discover` - Get swipeable profiles
- `POST /api/swipe` - Record swipe
- `GET /api/matches` - Get matches

### **Messaging**
- `GET /api/messages` - Conversation list
- `GET /api/conversation/{match_id}` - Get messages
- `POST /api/conversation/{match_id}/message` - Send message
- `POST /api/translate` - Translate text

### **Payments**
- `POST /api/create-checkout-session` - Stripe checkout
- `GET /api/checkout/status` - Payment status

### **Referrals**
- `GET /api/referral/dashboard` - Referral stats
- `POST /api/referral/apply-code` - Apply code
- `GET /api/referral/leaderboard` - Leaderboard

### **Categories**
- `GET /api/categories/all` - List categories
- `GET /api/categories/{category}/users` - Browse by category

### **Games** (PLACEHOLDER)
- `GET /api/games/list` - List available games
- `POST /api/games/play/:gameId` - Start game session

### **Tournaments** (BASIC)
- `POST /api/tournaments/create` - Create tournament
- `POST /api/tournaments/join` - Join tournament
- `GET /api/tournaments/list` - List tournaments
- `GET /api/tournaments/{id}` - Tournament details
- `GET /api/tournaments/{id}/bracket` - Get bracket

### **Speed Dating** (PLACEHOLDER)
- `POST /api/speed-dating/room` - Create/join room
- `GET /api/speed-dating/rooms/active` - Active rooms

### **Safety** (PLACEHOLDER)
- `POST /api/safety/share-location` - Share location
- `POST /api/safety/sos` - Emergency alert

---

## 🎨 **UI Design System**
- **Framework**: Tailwind CSS + Shadcn UI
- **Colors**: Pink/purple gradient theme
- **Components**: 40+ pre-built UI components (buttons, cards, dialogs, etc.)
- **Responsive**: Mobile-first design

---

## 🧪 **Testing Status**
- ✅ Core features manually tested
- ❌ Comprehensive testing pending (Week 3)
- ❌ No automated tests yet
- ❌ No performance testing yet

---

## 📝 **Next Immediate Steps**
1. ✅ Create this overview document
2. 🔴 Implement Tic Tac Toe game logic
3. 🔴 Implement Connect 4 game logic
4. 🔴 Implement UNO game logic
5. 🟡 Build tournament bracket system
6. ✅ Comprehensive testing before launch

---

## 🎯 **Success Metrics for Launch**
- [ ] All 3 games (Tic Tac Toe, Connect 4, UNO) fully playable
- [ ] Tournaments functional with bracket progression
- [ ] No critical bugs in core features (auth, swipe, match, message)
- [ ] Payment flow tested and working
- [ ] Translation working between multiple languages
- [ ] Mobile-responsive UI
- [ ] Performance: < 2s page load time

---

**📧 Support:** For any questions, contact the development team.
**🚀 Deployment:** Preview URL auto-updates on code changes. Redeploy for production updates.
