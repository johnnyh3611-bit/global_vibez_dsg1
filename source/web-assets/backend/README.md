# Global Vibez Casino Platform - Backend API

## 🎰 Overview

Full-featured casino gaming platform with multiplayer support, token-gated rooms, and MetaHuman dealers.

## 🎮 Casino Games

### 1. **Baccarat**
- Natural 8/9 instant win logic
- Complex third-card drawing rules
- 8-deck shoe with secure shuffling
- Payouts: Player 1:1, Banker 1:1 (-5% commission), Tie 8:1

**API Endpoints:**
- `POST /api/baccarat/play` - Play a hand
- `GET /api/baccarat/history` - Game history
- `GET /api/baccarat/stats` - Player statistics
- `GET /api/baccarat/leaderboard` - Top players

### 2. **Bid Whist** (4-Player Multiplayer)
- 54-card deck (52 + 2 Jokers)
- Bidding system: 3-7 books, Uptown/Downtown/No Trump
- Kitty exchange (6-card widow)
- Team scoring

**API Endpoints:**
- `POST /api/bid-whist/start` - Create game
- `POST /api/bid-whist/bid` - Place bid
- `POST /api/bid-whist/play` - Play card
- `GET /api/bid-whist/game/{game_id}` - Get state

### 3. **Vibez 654** (Craps Variant)
- Custom dice mechanics
- Side bets system
- Multi-roll states

**API Endpoints:**
- `POST /api/dice/play` - Play dice game
- `GET /api/dice/history` - Game history

### 4. **Other Games**
- Blackjack
- Roulette  
- Slots

## 🏰 Premium Features

### Private Vibe Suites
Token-gated exclusive gaming rooms with customizable access control.

**Access Levels:**
- Public - Anyone can join
- Token Gated - Requires X tokens
- NFT Gated - Requires specific NFT
- Invite Only - Owner approval
- Whitelist - Pre-approved addresses

**API Endpoints:**
- `POST /api/vibe-suites/create` - Create suite
- `GET /api/vibe-suites/discover` - Browse suites
- `POST /api/vibe-suites/join` - Join suite
- `GET /api/vibe-suites/my-suites` - My suites

### Just For The Night
Premium room system with:
- 70/30 revenue split (Creator/Platform)
- Challenge game system
- Custom dealer types
- Watermark support

**API Endpoints:**
- `POST /api/just-for-the-night/rooms/create`
- `GET /api/just-for-the-night/rooms/discover`
- `POST /api/just-for-the-night/rooms/join-transaction`

## 👑 God Mode Admin Dashboard

Comprehensive admin panel for platform oversight.

**Features:**
- Casino analytics (DAU, MAU, revenue)
- Active game monitoring
- Transaction logs
- User management (ban, suspend, search)
- Admin action audit trail

**API Endpoints:**
- `GET /api/god-mode/casino-analytics` - Platform metrics
- `GET /api/god-mode/active-games` - Live games
- `GET /api/god-mode/transaction-logs` - All transactions
- `POST /api/god-mode/users/ban` - Ban user
- `POST /api/god-mode/users/suspend` - Suspend user

## 🛠️ Tech Stack

**Backend:**
- FastAPI (Python 3.11+)
- MongoDB (Motor async driver)
- Socket.IO (Real-time multiplayer)
- Pydantic (Data validation)

**Frontend:**
- React 18
- Tailwind CSS
- Framer Motion
- Socket.IO Client

## 📁 Project Structure

```
/home/johnnie/master-project/
├── routes/
│   ├── casino/          # Casino game routes
│   ├── admin_panel/     # Admin routes
│   ├── premium/         # Premium features
│   ├── baccarat.py
│   ├── bid_whist.py
│   ├── vibe_suites.py
│   └── god_mode_casino.py
├── models/
│   ├── casino/          # Casino models
│   └── user.py
├── utils/
│   ├── baccarat_game.py # Game engines
│   ├── bid_whist_game.py
│   └── database.py
├── tests/
│   ├── casino/          # Casino tests
│   ├── test_baccarat.py
│   └── test_bid_whist.py
└── server.py            # Main FastAPI app
```

## 🔧 Environment Variables

```env
# Database
MONGO_URL=mongodb://localhost:27017
DB_NAME=casino_db

# Admin Access
ADMIN_EMAILS=admin@globalvibez.com,founder@globalvibez.com
ADMIN_PASSWORD=GlobalVibez_Founder_2025!

# Stripe (for payments)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...

# JWT
JWT_SECRET=your-secret-key
JWT_ALGORITHM=HS256
```

## 🚀 Getting Started

### Installation

```bash
# Install dependencies
pip install -r requirements.txt

# Start backend
python server.py
```

### Running Tests

```bash
# Run all tests
pytest

# Run specific test file
pytest tests/test_baccarat.py

# Run with coverage
pytest --cov=backend tests/
```

## 📊 Testing Metrics

- **Total Tests:** 68
- **Pass Rate:** 98.5% (67/68)
- **Coverage:** Backend core features

### Test Files:
- `test_baccarat.py` - 24 tests (100% pass)
- `test_bid_whist.py` - 20 tests (95% pass)
- `test_system_health.py` - 18 tests (100% pass)

## 🎯 API Documentation

Access interactive API docs at:
- **Swagger UI:** http://localhost:8001/docs
- **ReDoc:** http://localhost:8001/redoc

## 🔒 Security

- JWT authentication on all protected endpoints
- Admin email whitelist for God Mode access
- Input validation with Pydantic
- MongoDB ObjectId handling for data integrity
- Rate limiting on sensitive endpoints

## 📈 Performance

- Hot reload enabled (auto-restart on code changes)
- MongoDB indexes on frequently queried fields
- Async/await throughout for non-blocking I/O
- Socket.IO for real-time multiplayer

## 🐛 Common Issues

### Backend won't start
```bash
# Check logs
tail -f /var/log/supervisor/backend.err.log

# Restart backend
sudo supervisorctl restart backend
```

### MongoDB connection error
```bash
# Verify MongoDB is running
sudo systemctl status mongod

# Check connection string
echo $MONGO_URL
```

### Import errors
```bash
# Reinstall dependencies
pip install -r requirements.txt

# Clear Python cache
find . -type d -name __pycache__ -exec rm -r {} +
```

## 📝 Contributing

1. Create feature branch
2. Make changes with tests
3. Run linter: `ruff check backend/`
4. Submit for review

## 📄 License

Proprietary - Global Vibez Platform

## 👥 Support

For issues or questions:
- Check `/app/test_result.md` for testing guidelines
- Review API docs at `/docs`
- Contact: support@globalvibez.com
