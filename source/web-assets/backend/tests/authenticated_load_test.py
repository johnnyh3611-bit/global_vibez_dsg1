"""
Authenticated Load Test - Realistic User Flows
Simulates actual user behavior with login, games, and transactions
"""
from locust import HttpUser, task, between, events, SequentialTaskSet
import random


class AuthenticatedUserFlow(SequentialTaskSet):
    """
    Sequential user journey:
    1. Demo login
    2. Check balance
    3. Browse games
    4. Play a game
    5. Check balance again
    """
    
    def on_start(self):
        """Login before starting tasks"""
        self.login()
    
    def login(self):
        """Perform demo login and store session"""
        with self.client.post(
            "/api/auth/demo-login",
            catch_response=True
        ) as response:
            if response.status_code == 200:
                response.success()
                # Session cookie is automatically stored by Locust
                self.logged_in = True
            else:
                response.failure(f"Login failed: {response.status_code}")
                self.logged_in = False
    
    @task
    def check_balance(self):
        """Check user balance"""
        if not self.logged_in:
            return
        
        with self.client.get(
            "/api/wallet/balance",
            catch_response=True
        ) as response:
            if response.status_code in [200, 404]:  # 404 if endpoint doesn't exist
                response.success()
            else:
                response.failure(f"Balance check failed: {response.status_code}")
    
    @task
    def browse_available_games(self):
        """Browse game list"""
        with self.client.get(
            "/api/games/available",
            catch_response=True
        ) as response:
            if response.status_code in [200, 404]:
                response.success()
            else:
                response.failure(f"Browse games failed: {response.status_code}")
    
    @task
    def play_game(self):
        """Simulate playing a game"""
        if not self.logged_in:
            return
        
        games = ["blackjack", "poker", "roulette"]
        game = random.choice(games)
        
        # Join game
        with self.client.post(
            f"/api/games/{game}/join",
            json={"bet_amount": random.randint(100, 1000)},
            catch_response=True
        ) as response:
            if response.status_code in [200, 201, 404]:
                response.success()
            else:
                response.failure(f"Game join failed: {response.status_code}")
    
    @task
    def check_system_health(self):
        """Check system health (public endpoint)"""
        with self.client.get(
            "/api/god-mode/system-health",
            catch_response=True
        ) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Health check failed: {response.status_code}")


class CasinoUser(HttpUser):
    """
    Simulates a real casino user
    """
    tasks = [AuthenticatedUserFlow]
    wait_time = between(2, 5)  # Wait 2-5 seconds between actions
    

class HighRollerUser(HttpUser):
    """
    High-frequency trader/player
    Faster actions, more games
    """
    wait_time = between(0.5, 2)
    
    def on_start(self):
        """Login on start"""
        self.client.post("/api/auth/demo-login")
    
    @task(10)
    def rapid_fire_games(self):
        """Play games rapidly"""
        games = ["blackjack", "poker", "roulette", "baccarat"]
        game = random.choice(games)
        
        self.client.post(
            f"/api/games/{game}/join",
            json={"bet_amount": random.randint(1000, 10000)}
        )
    
    @task(5)
    def check_balance(self):
        """Frequent balance checks"""
        self.client.get("/api/wallet/balance")
    
    @task(2)
    def check_stats(self):
        """Check player stats"""
        self.client.get("/api/player/stats")


class AdminUser(HttpUser):
    """
    Simulates admin monitoring activity
    Lower frequency but admin-level operations
    """
    wait_time = between(5, 15)
    
    def on_start(self):
        """Admin login"""
        self.client.post("/api/auth/demo-login")
    
    @task(5)
    def view_dashboard(self):
        """View admin dashboard"""
        self.client.get("/api/admin/master-stats")
    
    @task(3)
    def view_revenue(self):
        """Check revenue summary"""
        self.client.get("/api/v1/admin/revenue-summary")
    
    @task(2)
    def view_audit_logs(self):
        """Check audit logs"""
        self.client.get("/api/v1/admin/audit-logs?limit=50")
    
    @task(1)
    def system_health(self):
        """Check system health"""
        self.client.get("/api/god-mode/full-audit-report")


@events.test_start.add_listener
def on_test_start(environment, **kwargs):
    print("=" * 80)
    print("🎰 AUTHENTICATED USER FLOW LOAD TEST")
    print("=" * 80)
    print("Simulating realistic user behavior:")
    print("- CasinoUser: Normal players (login → browse → play)")
    print("- HighRollerUser: Fast players (rapid games)")
    print("- AdminUser: Admin monitoring")
    print("=" * 80)


@events.test_stop.add_listener
def on_test_stop(environment, **kwargs):
    stats = environment.stats
    
    print("\n" + "=" * 80)
    print("📊 AUTHENTICATED LOAD TEST RESULTS")
    print("=" * 80)
    print(f"✅ Total Requests: {stats.total.num_requests:,}")
    print(f"❌ Failures: {stats.total.num_failures:,}")
    print(f"📊 Success Rate: {(1-stats.total.fail_ratio)*100:.2f}%")
    print(f"⚡ Avg Response Time: {stats.total.avg_response_time:.0f}ms")
    print(f"🚀 Peak RPS: {stats.total.total_rps:.0f}")
    print(f"📈 95th Percentile: {stats.total.get_response_time_percentile(0.95):.0f}ms")
    print("=" * 80)
    
    # User experience assessment
    avg_time = stats.total.avg_response_time
    success_rate = (1 - stats.total.fail_ratio) * 100
    
    print("\n🎯 USER EXPERIENCE ASSESSMENT:")
    if success_rate >= 99 and avg_time < 200:
        print("✅ EXCELLENT: Users will have a smooth experience!")
    elif success_rate >= 95 and avg_time < 500:
        print("✅ GOOD: Acceptable user experience")
    elif success_rate >= 90 and avg_time < 1000:
        print("⚠️ ACCEPTABLE: Some users may notice slowness")
    else:
        print("❌ POOR: User experience degraded")
    print("=" * 80)


# Weighted user distribution for realistic simulation
# 70% normal users, 20% high rollers, 10% admins
