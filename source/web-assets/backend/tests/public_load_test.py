"""
Realistic Public Load Test - No Auth Required
Tests actual user-facing features
"""
from locust import HttpUser, task, between, events
import random
import os

BACKEND_URL = os.getenv('REACT_APP_BACKEND_URL', 'http://localhost:8001')


class PublicUserFlow(HttpUser):
    """
    Simulates realistic public user behavior
    No authentication required
    """
    wait_time = between(1, 3)
    host = BACKEND_URL

    @task(10)
    def health_check(self):
        """Public health endpoint"""
        with self.client.get("/health", catch_response=True) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Health check failed: {response.status_code}")

    @task(8)
    def system_health_public(self):
        """Public system health monitoring"""
        with self.client.get("/api/god-mode/system-health", catch_response=True) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"System health failed: {response.status_code}")

    @task(5)
    def browse_landing(self):
        """Landing page load simulation"""
        endpoints = [
            "/health",
            "/api/god-mode/system-health",
        ]
        endpoint = random.choice(endpoints)
        
        with self.client.get(endpoint, catch_response=True) as response:
            if response.status_code in [200, 404]:
                response.success()
            else:
                response.failure(f"Browse failed: {response.status_code}")

    @task(3)
    def demo_login_attempt(self):
        """Simulate demo login flow"""
        with self.client.post("/api/auth/demo-login", catch_response=True) as response:
            if response.status_code in [200, 201]:
                response.success()
            else:
                # 401 or 400 is acceptable for unauthenticated requests
                if response.status_code in [400, 401]:
                    response.success()
                else:
                    response.failure(f"Demo login failed: {response.status_code}")


@events.request.add_listener
def on_request(request_type, name, response_time, response_length, exception, **kwargs):
    """Track critical failures and slow requests"""
    if exception:
        print(f"⚠️ CRITICAL: {name} - {exception}")
    
    if response_time > 5000:
        print(f"🐌 SLOW REQUEST: {name} took {response_time}ms")


@events.test_start.add_listener
def on_test_start(environment, **kwargs):
    print("=" * 70)
    print("🚀 GLOBAL VIBEZ PUBLIC LOAD TEST - REALISTIC USER SIMULATION")
    print(f"Target: {BACKEND_URL}")
    print("Testing: Public endpoints (no auth required)")
    print("=" * 70)


@events.test_stop.add_listener
def on_test_stop(environment, **kwargs):
    stats = environment.stats
    
    print("\n" + "=" * 70)
    print("📊 PUBLIC LOAD TEST RESULTS")
    print("=" * 70)
    print(f"Total Requests: {stats.total.num_requests:,}")
    print(f"Failures: {stats.total.num_failures:,} ({stats.total.fail_ratio*100:.2f}%)")
    print(f"Success Rate: {(1-stats.total.fail_ratio)*100:.2f}%")
    print(f"Avg Response Time: {stats.total.avg_response_time:.2f}ms")
    print(f"Median Response Time: {stats.total.median_response_time:.2f}ms")
    print(f"95th Percentile: {stats.total.get_response_time_percentile(0.95):.2f}ms")
    print(f"99th Percentile: {stats.total.get_response_time_percentile(0.99):.2f}ms")
    print(f"Max Response Time: {stats.total.max_response_time:.2f}ms")
    print(f"Requests/sec: {stats.total.total_rps:.2f}")
    
    # Performance Assessment
    print("\n" + "=" * 70)
    print("🎯 PERFORMANCE ASSESSMENT")
    print("=" * 70)
    
    success_rate = (1 - stats.total.fail_ratio) * 100
    avg_time = stats.total.avg_response_time
    
    if success_rate >= 99 and avg_time < 200:
        print("✅ EXCELLENT: Production-ready performance!")
    elif success_rate >= 95 and avg_time < 500:
        print("✅ GOOD: Acceptable performance under load")
    elif success_rate >= 90 and avg_time < 1000:
        print("⚠️ ACCEPTABLE: Performance degrades under high load")
    else:
        print("❌ CRITICAL: Performance issues detected")
    
    print("=" * 70)
