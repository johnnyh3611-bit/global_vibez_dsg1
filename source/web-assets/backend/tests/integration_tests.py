"""
Automated Testing Suite
Tests all critical endpoints and features
"""
import asyncio
import aiohttp

API_BASE = "https://social-connect-953.preview.emergentagent.com/api"

class TestResults:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.errors = []
    
    def record_pass(self, test_name):
        self.passed += 1
        print(f"✅ {test_name}")
    
    def record_fail(self, test_name, error):
        self.failed += 1
        self.errors.append({"test": test_name, "error": str(error)})
        print(f"❌ {test_name}: {error}")
    
    def summary(self):
        total = self.passed + self.failed
        print(f"\n{'='*50}")
        print(f"Test Results: {self.passed}/{total} passed")
        print(f"Success Rate: {(self.passed/total*100):.1f}%")
        if self.errors:
            print("\nFailed Tests:")
            for err in self.errors:
                print(f"  - {err['test']}: {err['error']}")
        print(f"{'='*50}\n")

results = TestResults()

async def test_subscription_tiers():
    """Test subscription system"""
    async with aiohttp.ClientSession() as session:
        try:
            async with session.get(f"{API_BASE}/subscriptions/tiers") as resp:
                data = await resp.json()
                assert data["success"]
                assert len(data["tiers"]) == 5
                results.record_pass("Subscription Tiers")
        except Exception as e:
            results.record_fail("Subscription Tiers", e)

async def test_battle_pass():
    """Test battle pass system"""
    async with aiohttp.ClientSession() as session:
        try:
            async with session.get(f"{API_BASE}/battlepass/current-season") as resp:
                data = await resp.json()
                assert data["success"]
                assert "season" in data
                results.record_pass("Battle Pass Current Season")
        except Exception as e:
            results.record_fail("Battle Pass Current Season", e)

async def test_crypto_payments():
    """Test crypto payment system"""
    async with aiohttp.ClientSession() as session:
        try:
            async with session.get(f"{API_BASE}/crypto-payments/supported-currencies") as resp:
                data = await resp.json()
                assert data["success"]
                assert "BTC" in data["currencies"]
                assert "ETH" in data["currencies"]
                results.record_pass("Crypto Supported Currencies")
        except Exception as e:
            results.record_fail("Crypto Supported Currencies", e)

async def test_dynamic_pricing():
    """Test dynamic pricing system"""
    async with aiohttp.ClientSession() as session:
        try:
            async with session.get(f"{API_BASE}/dynamic-pricing/pricing-schedule") as resp:
                data = await resp.json()
                assert data["success"]
                assert "base_prices" in data
                results.record_pass("Dynamic Pricing Schedule")
        except Exception as e:
            results.record_fail("Dynamic Pricing Schedule", e)

async def test_tournaments():
    """Test tournament system"""
    async with aiohttp.ClientSession() as session:
        try:
            async with session.get(f"{API_BASE}/tournaments/list") as resp:
                data = await resp.json()
                assert data["success"]
                assert "tournaments" in data
                results.record_pass("Tournament List")
        except Exception as e:
            results.record_fail("Tournament List", e)

async def test_leaderboards():
    """Test leaderboard system"""
    async with aiohttp.ClientSession() as session:
        try:
            async with session.get(f"{API_BASE}/leaderboards/global/blackjack") as resp:
                data = await resp.json()
                assert data["success"]
                results.record_pass("Global Leaderboard")
        except Exception as e:
            results.record_fail("Global Leaderboard", e)

async def test_metahuman():
    """Test MetaHuman system"""
    async with aiohttp.ClientSession() as session:
        try:
            async with session.get(f"{API_BASE}/metahuman/active-dealers") as resp:
                data = await resp.json()
                assert data["success"]
                results.record_pass("MetaHuman Active Dealers")
        except Exception as e:
            results.record_fail("MetaHuman Active Dealers", e)

async def test_admin_dashboard():
    """Test admin dashboard endpoints"""
    async with aiohttp.ClientSession() as session:
        try:
            # Test announcements
            async with session.get(f"{API_BASE}/admin/announcements?active_only=false") as resp:
                data = await resp.json()
                assert data["success"]
                results.record_pass("Admin Announcements")
        except Exception as e:
            results.record_fail("Admin Announcements", e)

async def run_all_tests():
    """Run all tests"""
    print("\n🧪 Starting Automated Test Suite...\n")
    
    tests = [
        test_subscription_tiers(),
        test_battle_pass(),
        test_crypto_payments(),
        test_dynamic_pricing(),
        test_tournaments(),
        test_leaderboards(),
        test_metahuman(),
        test_admin_dashboard()
    ]
    
    await asyncio.gather(*tests)
    
    results.summary()

if __name__ == "__main__":
    asyncio.run(run_all_tests())
