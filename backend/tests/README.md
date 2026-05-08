# Backend Testing Guide

## 📋 Test Organization

Tests are organized by feature area:

```
/app/backend/tests/
├── casino/              # Casino game tests
│   ├── test_baccarat.py
│   ├── test_bid_whist.py
│   └── test_dice.py
├── admin/               # Admin feature tests
│   └── test_god_mode.py
├── premium/             # Premium feature tests
│   └── test_vibe_suites.py
├── test_system_health.py
└── conftest.py          # Shared fixtures
```

## 🧪 Running Tests

### Run All Tests
```bash
pytest
```

### Run Specific Test File
```bash
pytest tests/test_baccarat.py
```

### Run Tests by Category
```bash
# Casino tests only
pytest tests/casino/

# Admin tests only  
pytest tests/admin/

# With verbose output
pytest -v tests/
```

### Run with Coverage
```bash
pytest --cov=backend --cov-report=html tests/
```

## ✅ Test Coverage

### Current Coverage (98.5%)

**Baccarat (100% - 24/24 tests)**
- ✅ Play hand with Player bet
- ✅ Play hand with Banker bet
- ✅ Play hand with Tie bet
- ✅ Natural 8/9 detection
- ✅ Player draws on 0-5
- ✅ Banker drawing rules (6 scenarios)
- ✅ Payout calculations
- ✅ Game history
- ✅ Statistics
- ✅ Leaderboard

**Bid Whist (95% - 19/20 tests)**
- ✅ Create 4-player game
- ✅ Place bid (3-7, Uptown/Downtown)
- ✅ Pass bid
- ✅ Kitty exchange
- ✅ Play card
- ✅ Game state retrieval
- ⚠️ Kitty error handling (minor)

**System Health (100% - 18/18 tests)**
- ✅ Dice wallet integration
- ✅ Balance updates
- ✅ Transaction logging

## 📝 Writing Tests

### Test Template

```python
import pytest
from httpx import AsyncClient
from server import app

@pytest.mark.asyncio
async def test_game_feature():
    """Test description"""
    async with AsyncClient(app=app, base_url="http://test") as client:
        # Setup
        response = await client.post(
            "/api/game/endpoint",
            headers={"Authorization": f"Bearer {token}"},
            json={"data": "value"}
        )
        
        # Assert
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
```

### Best Practices

1. **Use descriptive test names**
   ```python
   # Good
   async def test_baccarat_natural_8_wins_instantly():
   
   # Bad
   async def test_game():
   ```

2. **Arrange-Act-Assert pattern**
   ```python
   # Arrange - Setup test data
   bet_amount = 100
   
   # Act - Execute the action
   response = await client.post("/api/bet", json={"amount": bet_amount})
   
   # Assert - Verify results
   assert response.status_code == 200
   ```

3. **Test edge cases**
   - Minimum/maximum values
   - Empty inputs
   - Invalid data types
   - Unauthorized access

4. **Use fixtures for common setup**
   ```python
   @pytest.fixture
   async def authenticated_client():
       # Return client with auth token
       pass
   ```

## 🐛 Debugging Failed Tests

### Check Test Output
```bash
pytest -v --tb=short tests/test_baccarat.py
```

### Run Single Test
```bash
pytest tests/test_baccarat.py::test_play_baccarat_player_bet -v
```

### Print Debug Info
```python
async def test_with_debug():
    response = await client.post("/api/endpoint")
    print(f"Response: {response.json()}")  # Will show in pytest output
    assert response.status_code == 200
```

## 📊 Test Metrics

### Coverage Goals
- **Critical paths:** 100% coverage
- **API endpoints:** 95%+ coverage
- **Business logic:** 90%+ coverage
- **Edge cases:** 80%+ coverage

### Current Status
```
Total Tests: 68
Passing: 67 (98.5%)
Failing: 1 (1.5%)
Coverage: ~85% (backend core)
```

## 🔄 Continuous Integration

Tests run automatically on:
- Code commits
- Pull requests
- Deployments

### Pre-commit Checks
```bash
# Run linter
ruff check backend/

# Run type checking
mypy backend/

# Run tests
pytest
```

## 📈 Adding New Tests

When adding a new feature:

1. **Create test file** in appropriate directory
2. **Write tests** covering main flow + edge cases
3. **Run tests** to verify they pass
4. **Check coverage** to ensure adequate testing

Example workflow:
```bash
# 1. Create test file
touch tests/casino/test_new_game.py

# 2. Write tests
# ... edit file ...

# 3. Run tests
pytest tests/casino/test_new_game.py -v

# 4. Check coverage
pytest --cov=backend.routes.new_game tests/casino/test_new_game.py
```

## 🎯 Testing Checklist

Before merging code:
- [ ] All tests pass
- [ ] New features have tests
- [ ] Coverage doesn't decrease
- [ ] Tests are documented
- [ ] Edge cases covered
- [ ] Integration tests included

## 📞 Help & Resources

- Testing framework: pytest
- Async testing: pytest-asyncio
- HTTP testing: httpx
- Coverage: pytest-cov

For questions, check:
1. Existing tests for patterns
2. pytest documentation
3. Team testing guidelines
