"""
Global Vibez DSG — GISA Locust load / integrity suite.

Canonical classes LOCKED in:
  memory/locked_specs/v8_GISA_AUDIT_BLUEPRINT.md

GlobalVibezAuditor  — blind auditor (concurrency, ledger, isolation)
StressAgent         — master-audit high-cadence variant
"""
import os

import locust
from locust import events, task

# Backend URL from environment (matches CRA / backend local defaults)
BACKEND_URL = os.getenv("REACT_APP_BACKEND_URL", "http://localhost:8001")


class GlobalVibezAuditor(locust.HttpUser):
    """Blind Auditor — pressure-tests the four GISA health vectors."""

    wait_time = locust.between(0.1, 0.5)
    host = BACKEND_URL

    @locust.task(5)
    def test_game_sockets(self):
        self.client.get(
            "/ws/gaming/vibe-check",
            headers={"Audit-Mode": "True"},
        )

    @locust.task(2)
    def test_transaction_throughput(self):
        # Stress the Solana Gateway for DSG Tokens.
        # Watches for latency spikes and double-entry failures.
        self.client.post(
            "/api/v1/ledger/validate",
            json={"sim_volume": 10000},
            headers={"Audit-Mode": "True"},
        )

    @locust.task(1)
    def test_cross_service_leak(self):
        # Check if Hunger Vibez data is accessible via VibeRidez endpoint.
        response = self.client.get(
            "/api/v1/logistics/integrity-ping",
            headers={"Audit-Mode": "True"},
        )
        if "leaked_data" in response.text:
            print("CRITICAL: Cross-service intertwining detected.")


class StressAgent(locust.HttpUser):
    """Master-audit variant — faster cadence for betting + logistics."""

    wait_time = locust.between(0.01, 0.05)
    host = BACKEND_URL

    @task
    def simulate_betting_load(self):
        self.client.post(
            "/api/v1/gaming/bet",
            json={"user_id": "sim_bot", "amount": 100},
            headers={"Audit-Mode": "True"},
        )

    @task
    def simulate_delivery_ping(self):
        self.client.get(
            "/api/v1/logistics/status",
            headers={"Audit-Mode": "True"},
        )


@events.request.add_listener
def on_request(
    request_type, name, response_time, response_length, exception, **kwargs
):
    """Flag critical breakdowns and slow paths during GISA runs."""
    if exception:
        print(f"CRITICAL BREAKDOWN in {name}: {exception}")
    if response_time > 2000:
        print(f"SLOW REQUEST: {name} took {response_time}ms")


@events.test_start.add_listener
def on_test_start(environment, **kwargs):
    print("=" * 60)
    print("GISA / GLOBAL VIBEZ DSG LOAD TEST STARTING")
    print(f"Target: {BACKEND_URL}")
    print("=" * 60)


@events.test_stop.add_listener
def on_test_stop(environment, **kwargs):
    stats = environment.stats
    print("\n" + "=" * 60)
    print("GISA / GLOBAL VIBEZ DSG LOAD TEST COMPLETE")
    print("=" * 60)
    print(f"Total Requests: {stats.total.num_requests}")
    print(f"Failures: {stats.total.num_failures}")
    print(f"Avg Response Time: {stats.total.avg_response_time:.2f}ms")
    print(f"Max Response Time: {stats.total.max_response_time:.2f}ms")
    print(f"Requests/sec: {stats.total.total_rps:.2f}")
    print("=" * 60)
