"""
Pure Public Health Endpoint Load Test
Tests the simplest possible endpoint
"""
from locust import HttpUser, task, between, events
import os

BACKEND_URL = os.getenv('REACT_APP_BACKEND_URL', 'http://localhost:8001')


class HealthCheckUser(HttpUser):
    """Only test public health endpoint"""
    wait_time = between(0.1, 0.5)
    host = BACKEND_URL

    @task
    def health_check(self):
        """Simple health check"""
        self.client.get("/health")


@events.test_stop.add_listener  
def on_test_stop(environment, **kwargs):
    stats = environment.stats
    
    print("\n" + "=" * 70)
    print("🏥 HEALTH ENDPOINT STRESS TEST RESULTS")
    print("=" * 70)
    print(f"✅ Total Requests: {stats.total.num_requests:,}")
    print(f"❌ Failures: {stats.total.num_failures:,} ({stats.total.fail_ratio*100:.2f}%)")
    print(f"📊 Success Rate: {(1-stats.total.fail_ratio)*100:.2f}%")
    print(f"⚡ Avg Response: {stats.total.avg_response_time:.0f}ms")
    print(f"🚀 Requests/sec: {stats.total.total_rps:.0f}")
    print("=" * 70)
