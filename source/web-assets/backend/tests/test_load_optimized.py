"""
Global Vibez DSG - Optimized Load Test
======================================
Optimized load test for faster execution while still testing at scale.
Tests: Bot creation, game playing, leaderboards, stats APIs
"""

import pytest
import requests
import time
import secrets
secure_random = secrets.SystemRandom()
import json
import os
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed
import statistics

# Configuration
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://social-connect-953.preview.emergentagent.com').rstrip('/')

# Optimized test parameters
BOT_COUNT = 100  # Reduced for faster testing
CONCURRENT_REQUESTS = 20
GAMES_PER_TYPE = 20

# Metrics
class Metrics:
    def __init__(self):
        self.start_time = time.time()
        self.requests = 0
        self.success = 0
        self.failed = 0
        self.times = []
        self.errors = []
        self.bots = 0
        self.games = 0
        
    def record(self, success, elapsed, error=None):
        self.requests += 1
        self.times.append(elapsed)
        if success:
            self.success += 1
        else:
            self.failed += 1
            if error:
                self.errors.append(str(error)[:100])
                
    def report(self):
        duration = time.time() - self.start_time
        return {
            "duration_sec": round(duration, 2),
            "total_requests": self.requests,
            "success": self.success,
            "failed": self.failed,
            "success_rate": round((self.success / max(1, self.requests)) * 100, 2),
            "rps": round(self.requests / max(1, duration), 2),
            "avg_ms": round(statistics.mean(self.times) * 1000, 2) if self.times else 0,
            "p95_ms": round(sorted(self.times)[int(len(self.times) * 0.95)] * 1000, 2) if len(self.times) > 20 else 0,
            "bots_created": self.bots,
            "games_played": self.games,
            "errors": list(set(self.errors))[:5]
        }

metrics = Metrics()


def create_bot(session):
    """Create a test bot user"""
    start = time.time()
    try:
        resp = session.post(f"{BASE_URL}/api/auth/test-user", timeout=30)
        elapsed = time.time() - start
        if resp.status_code == 200:
            data = resp.json()
            metrics.record(True, elapsed)
            metrics.bots += 1
            return {"ok": True, "token": data.get("session_token"), "user_id": data.get("user_id")}
        metrics.record(False, elapsed, f"Status {resp.status_code}")
        return {"ok": False}
    except Exception as e:
        metrics.record(False, time.time() - start, str(e))
        return {"ok": False}


def play_game(session, token, game_type):
    """Play a practice game"""
    headers = {"Authorization": f"Bearer {token}"}
    start = time.time()
    try:
        # Start game
        resp = session.post(
            f"{BASE_URL}/api/practice/start",
            json={"game_type": game_type, "difficulty": "medium"},
            headers=headers,
            timeout=30
        )
        elapsed = time.time() - start
        
        if resp.status_code == 200:
            game_id = resp.json().get("game_id")
            metrics.record(True, elapsed)
            metrics.games += 1
            
            # Make one move
            if game_type == "blackjack":
                session.post(
                    f"{BASE_URL}/api/practice/game/{game_id}/move",
                    json={"move_data": {"action": "stand"}},
                    headers=headers,
                    timeout=30
                )
            elif game_type == "tictactoe":
                session.post(
                    f"{BASE_URL}/api/practice/game/{game_id}/move",
                    json={"move_data": {"row": 1, "col": 1}},
                    headers=headers,
                    timeout=30
                )
            return {"ok": True, "game_id": game_id}
        
        metrics.record(False, elapsed, f"Game start: {resp.status_code}")
        return {"ok": False}
    except Exception as e:
        metrics.record(False, time.time() - start, str(e))
        return {"ok": False}


def get_leaderboard(session, game_type):
    """Get leaderboard"""
    start = time.time()
    try:
        resp = session.get(f"{BASE_URL}/api/stats/leaderboard/{game_type}", timeout=30)
        elapsed = time.time() - start
        metrics.record(resp.status_code == 200, elapsed, None if resp.status_code == 200 else f"LB: {resp.status_code}")
        return {"ok": resp.status_code == 200}
    except Exception as e:
        metrics.record(False, time.time() - start, str(e))
        return {"ok": False}


def get_global_stats(session):
    """Get global stats"""
    start = time.time()
    try:
        resp = session.get(f"{BASE_URL}/api/stats/global", timeout=30)
        elapsed = time.time() - start
        metrics.record(resp.status_code == 200, elapsed)
        if resp.status_code == 200:
            return {"ok": True, "data": resp.json()}
        return {"ok": False}
    except Exception as e:
        metrics.record(False, time.time() - start, str(e))
        return {"ok": False}


class TestOptimizedLoadTest:
    """Optimized load test suite"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
    def test_01_api_health(self):
        """Check API health"""
        resp = self.session.get(f"{BASE_URL}/api/")
        assert resp.status_code == 200
        print(f"\n[OK] API accessible at {BASE_URL}")
        
    def test_02_create_100_bots(self):
        """Create 100 bot users in parallel"""
        print(f"\n{'='*50}")
        print("PHASE 1: Creating 100 Bot Users")
        print(f"{'='*50}")
        
        created = 0
        with ThreadPoolExecutor(max_workers=CONCURRENT_REQUESTS) as executor:
            futures = [executor.submit(create_bot, requests.Session()) for _ in range(BOT_COUNT)]
            for f in as_completed(futures):
                if f.result()["ok"]:
                    created += 1
        
        print(f"  Created: {created}/{BOT_COUNT} bots")
        assert created >= BOT_COUNT * 0.5, f"Too many failures: {created}/{BOT_COUNT}"
        
    def test_03_blackjack_games(self):
        """Run 20 blackjack games"""
        print(f"\n{'='*50}")
        print("PHASE 2: Blackjack Games (20)")
        print(f"{'='*50}")
        
        played = 0
        with ThreadPoolExecutor(max_workers=CONCURRENT_REQUESTS) as executor:
            futures = []
            for _ in range(GAMES_PER_TYPE):
                session = requests.Session()
                bot = create_bot(session)
                if bot["ok"]:
                    futures.append(executor.submit(play_game, session, bot["token"], "blackjack"))
            
            for f in as_completed(futures):
                if f.result()["ok"]:
                    played += 1
        
        print(f"  Played: {played}/{GAMES_PER_TYPE} games")
        
    def test_04_poker_games(self):
        """Run 20 poker games"""
        print(f"\n{'='*50}")
        print("PHASE 3: Poker Games (20)")
        print(f"{'='*50}")
        
        played = 0
        with ThreadPoolExecutor(max_workers=CONCURRENT_REQUESTS) as executor:
            futures = []
            for _ in range(GAMES_PER_TYPE):
                session = requests.Session()
                bot = create_bot(session)
                if bot["ok"]:
                    futures.append(executor.submit(play_game, session, bot["token"], "poker"))
            
            for f in as_completed(futures):
                if f.result()["ok"]:
                    played += 1
        
        print(f"  Played: {played}/{GAMES_PER_TYPE} games")
        
    def test_05_uno_games(self):
        """Run 20 UNO games"""
        print(f"\n{'='*50}")
        print("PHASE 4: UNO Games (20)")
        print(f"{'='*50}")
        
        played = 0
        with ThreadPoolExecutor(max_workers=CONCURRENT_REQUESTS) as executor:
            futures = []
            for _ in range(GAMES_PER_TYPE):
                session = requests.Session()
                bot = create_bot(session)
                if bot["ok"]:
                    futures.append(executor.submit(play_game, session, bot["token"], "uno"))
            
            for f in as_completed(futures):
                if f.result()["ok"]:
                    played += 1
        
        print(f"  Played: {played}/{GAMES_PER_TYPE} games")
        
    def test_06_tictactoe_games(self):
        """Run 20 TicTacToe games"""
        print(f"\n{'='*50}")
        print("PHASE 5: TicTacToe Games (20)")
        print(f"{'='*50}")
        
        played = 0
        with ThreadPoolExecutor(max_workers=CONCURRENT_REQUESTS) as executor:
            futures = []
            for _ in range(GAMES_PER_TYPE):
                session = requests.Session()
                bot = create_bot(session)
                if bot["ok"]:
                    futures.append(executor.submit(play_game, session, bot["token"], "tictactoe"))
            
            for f in as_completed(futures):
                if f.result()["ok"]:
                    played += 1
        
        print(f"  Played: {played}/{GAMES_PER_TYPE} games")
        
    def test_07_leaderboard_stress(self):
        """Stress test leaderboards"""
        print(f"\n{'='*50}")
        print("PHASE 6: Leaderboard Stress Test")
        print(f"{'='*50}")
        
        success = 0
        game_types = ["blackjack", "poker", "uno", "tictactoe", "connect4", "checkers"]
        
        with ThreadPoolExecutor(max_workers=CONCURRENT_REQUESTS) as executor:
            futures = []
            for gt in game_types:
                for _ in range(5):
                    futures.append(executor.submit(get_leaderboard, requests.Session(), gt))
            
            for f in as_completed(futures):
                if f.result()["ok"]:
                    success += 1
        
        print(f"  Success: {success}/{len(game_types) * 5} requests")
        
    def test_08_global_stats(self):
        """Get global stats"""
        print(f"\n{'='*50}")
        print("PHASE 7: Global Stats")
        print(f"{'='*50}")
        
        result = get_global_stats(self.session)
        if result["ok"]:
            data = result["data"]
            print(f"  Total Players: {data.get('total_players', 'N/A')}")
            print(f"  Total Games: {data.get('total_games_played', 'N/A')}")
            print(f"  Popular Games: {data.get('most_popular_games', [])[:3]}")
        else:
            print("  Could not retrieve stats")
            
    def test_09_final_report(self):
        """Generate final report"""
        report = metrics.report()
        
        print(f"\n{'='*50}")
        print("FINAL LOAD TEST REPORT")
        print(f"{'='*50}")
        print(f"  Duration: {report['duration_sec']}s")
        print(f"  Total Requests: {report['total_requests']}")
        print(f"  Success: {report['success']} | Failed: {report['failed']}")
        print(f"  Success Rate: {report['success_rate']}%")
        print(f"  Requests/sec: {report['rps']}")
        print(f"  Avg Response: {report['avg_ms']}ms")
        print(f"  P95 Response: {report['p95_ms']}ms")
        print(f"  Bots Created: {report['bots_created']}")
        print(f"  Games Played: {report['games_played']}")
        
        if report['errors']:
            print(f"\n  Errors: {report['errors']}")
        
        # Save report
        report_path = f"/app/test_reports/load_test_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(report_path, 'w') as f:
            json.dump(report, f, indent=2)
        print(f"\n  Report: {report_path}")
        
        assert report['success_rate'] >= 50, f"Success rate too low: {report['success_rate']}%"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s", "--tb=short"])
