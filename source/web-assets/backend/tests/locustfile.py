"""
Global Vibez Load Testing Suite
Uses Locust to simulate 10k concurrent users
"""
from locust import HttpUser, task, between, events
import random
import os

# Backend URL from environment
BACKEND_URL = os.getenv('REACT_APP_BACKEND_URL', 'http://localhost:8001')


class GlobalVibezAuditor(HttpUser):
    """
    Simulates real user behavior across the casino platform
    - Login/Auth flows
    - Game interactions
    - Admin operations
    - Streaming features
    """
    wait_time = between(1, 5)  # Users wait 1-5 seconds between actions
    host = BACKEND_URL

    def on_start(self):
        """Called when a user starts - perform login"""
        # SSL verification stays ON (default). The preview env uses a real
        # HTTPS cert; disabling verification would create an MITM attack
        # surface during load tests + train wrong habits.

        # Simulate demo login
        response = self.client.post(
            "/api/auth/demo-login",
            catch_response=True
        )
        
        if response.status_code == 200:
            response.success()
        else:
            response.failure(f"Demo login failed: {response.status_code}")

    @task(10)
    def browse_games(self):
        """Most common action - browsing available games"""
        with self.client.get("/api/games/available", catch_response=True) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Games list failed: {response.status_code}")

    @task(5)
    def check_balance(self):
        """Check user balance - frequent operation"""
        with self.client.get("/api/wallet/balance", catch_response=True) as response:
            if response.status_code in [200, 401]:  # 401 is OK for non-auth users
                response.success()
            else:
                response.failure(f"Balance check failed: {response.status_code}")

    @task(3)
    def play_blackjack(self):
        """Simulate blackjack game session"""
        games = ["blackjack", "poker", "roulette"]
        game = random.choice(games)
        
        with self.client.post(
            f"/api/games/{game}/join",
            json={"bet_amount": random.randint(100, 1000)},
            catch_response=True
        ) as response:
            if response.status_code in [200, 401, 404]:
                response.success()
            else:
                response.failure(f"Game join failed: {response.status_code}")

    @task(2)
    def admin_health_check(self):
        """Simulate admin monitoring - lighter load"""
        with self.client.get("/api/admin/master-stats", catch_response=True) as response:
            if response.status_code in [200, 401]:  # 401 expected for non-admin
                response.success()
            else:
                response.failure(f"Admin check failed: {response.status_code}")

    @task(1)
    def streaming_health(self):
        """Check streaming infrastructure"""
        with self.client.get("/api/streaming/health-check", catch_response=True) as response:
            if response.status_code in [200, 404]:
                response.success()
            else:
                response.failure(f"Streaming check failed: {response.status_code}")


class AdminStressTest(HttpUser):
    """
    Focused admin/high-privilege operations testing
    Lower frequency but critical paths
    """
    wait_time = between(0.1, 1.0)  # Faster interactions
    host = BACKEND_URL

    @task(5)
    def admin_dashboard(self):
        """Test admin dashboard load"""
        with self.client.get("/api/admin/master-stats", catch_response=True) as response:
            if response.status_code in [200, 401]:
                response.success()
            else:
                response.failure(f"Admin dashboard failed: {response.status_code}")

    @task(3)
    def treasury_stats(self):
        """Test treasury/financial endpoints"""
        with self.client.get("/api/v1/admin/revenue-summary", catch_response=True) as response:
            if response.status_code in [200, 401]:
                response.success()
            else:
                response.failure(f"Treasury stats failed: {response.status_code}")

    @task(2)
    def audit_logs(self):
        """Test audit log retrieval"""
        with self.client.get("/api/v1/admin/audit-logs?limit=50", catch_response=True) as response:
            if response.status_code in [200, 401]:
                response.success()
            else:
                response.failure(f"Audit logs failed: {response.status_code}")


@events.request.add_listener
def on_request(request_type, name, response_time, response_length, exception, **kwargs):
    """
    Global event listener for tracking critical failures
    """
    if exception:
        print(f"⚠️ CRITICAL BREAKDOWN in {name}: {exception}")
    
    # Log slow requests (>2 seconds)
    if response_time > 2000:
        print(f"🐌 SLOW REQUEST: {name} took {response_time}ms")


@events.test_start.add_listener
def on_test_start(environment, **kwargs):
    """Called when load test starts"""
    print("=" * 60)
    print("🚀 GLOBAL VIBEZ LOAD TEST STARTING")
    print(f"Target: {BACKEND_URL}")
    print("=" * 60)


@events.test_stop.add_listener
def on_test_stop(environment, **kwargs):
    """Called when load test ends"""
    stats = environment.stats
    
    print("\n" + "=" * 60)
    print("📊 GLOBAL VIBEZ LOAD TEST COMPLETE")
    print("=" * 60)
    print(f"Total Requests: {stats.total.num_requests}")
    print(f"Failures: {stats.total.num_failures}")
    print(f"Avg Response Time: {stats.total.avg_response_time:.2f}ms")
    print(f"Max Response Time: {stats.total.max_response_time:.2f}ms")
    print(f"Requests/sec: {stats.total.total_rps:.2f}")
    print("=" * 60)
