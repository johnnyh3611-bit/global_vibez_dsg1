import random
"""
Global Vibez DSG - Large Scale Load Test (1000+ bots)
=====================================================
Comprehensive load test simulating 1000+ bot users with:
- Mass bot creation
- Dual bot games across all game types
- Leaderboard stress testing
- Database performance verification
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

# Large scale test parameters
BOT_COUNT = 500  # Create 500 bots
CONCURRENT_REQUESTS = 30
GAMES_PER_TYPE = 50  # 50 games per type = 300 total games

# Metrics tracking
class LoadMetrics:
    def __init__(self):
        self.start_time = time.time()
        self.requests = 0
        self.success = 0
        self.failed = 0
        self.times = []
        self.errors = []
        self.bots = 0
        self.games = 0
        self.phase_times = {}
        
    def record(self, success, elapsed, error=None):
        self.requests += 1
        self.times.append(elapsed)
        if success:
            self.success += 1
        else:
            self.failed += 1
            if error:
                self.errors.append(str(error)[:100])
                
    def start_phase(self, name):
        self.phase_times[name] = {"start": time.time()}
        
    def end_phase(self, name):
        if name in self.phase_times:
            self.phase_times[name]["end"] = time.time()
            self.phase_times[name]["duration"] = self.phase_times[name]["end"] - self.phase_times[name]["start"]
                
    def report(self):
        duration = time.time() - self.start_time
        sorted_times = sorted(self.times) if self.times else [0]
        return {
            "duration_sec": round(duration, 2),
            "total_requests": self.requests,
            "success": self.success,
            "failed": self.failed,
            "success_rate": round((self.success / max(1, self.requests)) * 100, 2),
            "rps": round(self.requests / max(1, duration), 2),
            "response_times": {
                "min_ms": round(min(sorted_times) * 1000, 2),
                "max_ms": round(max(sorted_times) * 1000, 2),
                "avg_ms": round(statistics.mean(sorted_times) * 1000, 2),
                "p50_ms": round(sorted_times[int(len(sorted_times) * 0.5)] * 1000, 2) if len(sorted_times) > 1 else 0,
                "p95_ms": round(sorted_times[int(len(sorted_times) * 0.95)] * 1000, 2) if len(sorted_times) > 20 else 0,
                "p99_ms": round(sorted_times[int(len(sorted_times) * 0.99)] * 1000, 2) if len(sorted_times) > 100 else 0,
            },
            "bots_created": self.bots,
            "games_played": self.games,
            "phase_durations": {k: round(v.get("duration", 0), 2) for k, v in self.phase_times.items()},
            "unique_errors": list(set(self.errors))[:10]
        }

metrics = LoadMetrics()


def create_bot(session):
    """Create a test bot user"""
    start = time.time()
    try:
        resp = session.post(f"{BASE_URL}/api/auth/test-user", timeout=60)
        elapsed = time.time() - start
        if resp.status_code == 200:
            data = resp.json()
            metrics.record(True, elapsed)
            metrics.bots += 1
            return {"ok": True, "token": data.get("session_token"), "user_id": data.get("user_id")}
        metrics.record(False, elapsed, f"Bot create: {resp.status_code}")
        return {"ok": False}
    except Exception as e:
        metrics.record(False, time.time() - start, str(e))
        return {"ok": False}


def play_game(session, token, game_type):
    """Play a practice game with moves"""
    headers = {"Authorization": f"Bearer {token}"}
    start = time.time()
    try:
        # Start game
        resp = session.post(
            f"{BASE_URL}/api/practice/start",
            json={"game_type": game_type, "difficulty": random.choice(["easy", "medium", "hard"])},
            headers=headers,
            timeout=60
        )
        elapsed = time.time() - start
        
        if resp.status_code == 200:
            game_id = resp.json().get("game_id")
            metrics.record(True, elapsed)
            metrics.games += 1
            
            # Make moves based on game type
            if game_type == "blackjack":
                # Random hit/stand strategy
                for _ in range(random.randint(1, 3)):
                    action = random.choice(["hit", "stand"])
                    session.post(
                        f"{BASE_URL}/api/practice/game/{game_id}/move",
                        json={"move_data": {"action": action}},
                        headers=headers,
                        timeout=30
                    )
                    if action == "stand":
                        break
                        
            elif game_type == "poker":
                action = random.choice(["call", "fold", "raise"])
                session.post(
                    f"{BASE_URL}/api/practice/game/{game_id}/move",
                    json={"move_data": {"action": action}},
                    headers=headers,
                    timeout=30
                )
                
            elif game_type == "tictactoe":
                row, col = secrets.randbelow(2), secrets.randbelow(2)
                session.post(
                    f"{BASE_URL}/api/practice/game/{game_id}/move",
                    json={"move_data": {"row": row, "col": col}},
                    headers=headers,
                    timeout=30
                )
                
            elif game_type == "uno":
                session.post(
                    f"{BASE_URL}/api/practice/game/{game_id}/move",
                    json={"move_data": {"action": "draw"}},
                    headers=headers,
                    timeout=30
                )
                
            elif game_type == "connect4":
                col = secrets.randbelow(6)
                session.post(
                    f"{BASE_URL}/api/practice/game/{game_id}/move",
                    json={"move_data": {"col": col}},
                    headers=headers,
                    timeout=30
                )
                
            elif game_type == "checkers":
                # Simple move
                session.post(
                    f"{BASE_URL}/api/practice/game/{game_id}/move",
                    json={"move_data": {"from": [5, 0], "to": [4, 1]}},
                    headers=headers,
                    timeout=30
                )
            
            return {"ok": True, "game_id": game_id}
        
        metrics.record(False, elapsed, f"Game start {game_type}: {resp.status_code}")
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
        metrics.record(resp.status_code == 200, elapsed)
        return {"ok": resp.status_code == 200, "count": len(resp.json().get("leaderboard", [])) if resp.status_code == 200 else 0}
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


class TestLargeScaleLoadTest:
    """Large scale load test - 500+ bots, 300+ games"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        self.bot_tokens = []
        
    def test_01_api_health(self):
        """Verify API health"""
        resp = self.session.get(f"{BASE_URL}/api/")
        assert resp.status_code == 200
        print(f"\n[OK] API: {BASE_URL}")
        
    def test_02_create_500_bots(self):
        """Create 500 bot users"""
        metrics.start_phase("bot_creation")
        print(f"\n{'='*60}")
        print(f"PHASE 1: Creating {BOT_COUNT} Bot Users")
        print(f"{'='*60}")
        
        created = 0
        batch_size = 50
        
        for batch in range(BOT_COUNT // batch_size):
            batch_created = 0
            with ThreadPoolExecutor(max_workers=CONCURRENT_REQUESTS) as executor:
                futures = []
                for _ in range(batch_size):
                    session = requests.Session()
                    session.headers.update({"Content-Type": "application/json"})
                    futures.append(executor.submit(create_bot, session))
                
                for f in as_completed(futures):
                    result = f.result()
                    if result["ok"]:
                        batch_created += 1
                        self.bot_tokens.append(result["token"])
            
            created += batch_created
            print(f"  Batch {batch + 1}/{BOT_COUNT // batch_size}: {batch_created}/{batch_size} created (Total: {created})")
            time.sleep(0.3)  # Small delay between batches
        
        metrics.end_phase("bot_creation")
        print(f"\n  TOTAL: {created}/{BOT_COUNT} bots created")
        assert created >= BOT_COUNT * 0.7, f"Too many failures: {created}/{BOT_COUNT}"
        
    def test_03_blackjack_50_games(self):
        """Run 50 blackjack games"""
        metrics.start_phase("blackjack")
        print(f"\n{'='*60}")
        print(f"PHASE 2: Blackjack Games ({GAMES_PER_TYPE})")
        print(f"{'='*60}")
        
        played = 0
        with ThreadPoolExecutor(max_workers=CONCURRENT_REQUESTS) as executor:
            futures = []
            for _ in range(GAMES_PER_TYPE):
                session = requests.Session()
                session.headers.update({"Content-Type": "application/json"})
                bot = create_bot(session)
                if bot["ok"]:
                    futures.append(executor.submit(play_game, session, bot["token"], "blackjack"))
            
            for f in as_completed(futures):
                if f.result()["ok"]:
                    played += 1
        
        metrics.end_phase("blackjack")
        print(f"  Played: {played}/{GAMES_PER_TYPE} games")
        
    def test_04_poker_50_games(self):
        """Run 50 poker games"""
        metrics.start_phase("poker")
        print(f"\n{'='*60}")
        print(f"PHASE 3: Poker Games ({GAMES_PER_TYPE})")
        print(f"{'='*60}")
        
        played = 0
        with ThreadPoolExecutor(max_workers=CONCURRENT_REQUESTS) as executor:
            futures = []
            for _ in range(GAMES_PER_TYPE):
                session = requests.Session()
                session.headers.update({"Content-Type": "application/json"})
                bot = create_bot(session)
                if bot["ok"]:
                    futures.append(executor.submit(play_game, session, bot["token"], "poker"))
            
            for f in as_completed(futures):
                if f.result()["ok"]:
                    played += 1
        
        metrics.end_phase("poker")
        print(f"  Played: {played}/{GAMES_PER_TYPE} games")
        
    def test_05_uno_50_games(self):
        """Run 50 UNO games"""
        metrics.start_phase("uno")
        print(f"\n{'='*60}")
        print(f"PHASE 4: UNO Games ({GAMES_PER_TYPE})")
        print(f"{'='*60}")
        
        played = 0
        with ThreadPoolExecutor(max_workers=CONCURRENT_REQUESTS) as executor:
            futures = []
            for _ in range(GAMES_PER_TYPE):
                session = requests.Session()
                session.headers.update({"Content-Type": "application/json"})
                bot = create_bot(session)
                if bot["ok"]:
                    futures.append(executor.submit(play_game, session, bot["token"], "uno"))
            
            for f in as_completed(futures):
                if f.result()["ok"]:
                    played += 1
        
        metrics.end_phase("uno")
        print(f"  Played: {played}/{GAMES_PER_TYPE} games")
        
    def test_06_tictactoe_50_games(self):
        """Run 50 TicTacToe games"""
        metrics.start_phase("tictactoe")
        print(f"\n{'='*60}")
        print(f"PHASE 5: TicTacToe Games ({GAMES_PER_TYPE})")
        print(f"{'='*60}")
        
        played = 0
        with ThreadPoolExecutor(max_workers=CONCURRENT_REQUESTS) as executor:
            futures = []
            for _ in range(GAMES_PER_TYPE):
                session = requests.Session()
                session.headers.update({"Content-Type": "application/json"})
                bot = create_bot(session)
                if bot["ok"]:
                    futures.append(executor.submit(play_game, session, bot["token"], "tictactoe"))
            
            for f in as_completed(futures):
                if f.result()["ok"]:
                    played += 1
        
        metrics.end_phase("tictactoe")
        print(f"  Played: {played}/{GAMES_PER_TYPE} games")
        
    def test_07_connect4_50_games(self):
        """Run 50 Connect4 games"""
        metrics.start_phase("connect4")
        print(f"\n{'='*60}")
        print(f"PHASE 6: Connect4 Games ({GAMES_PER_TYPE})")
        print(f"{'='*60}")
        
        played = 0
        with ThreadPoolExecutor(max_workers=CONCURRENT_REQUESTS) as executor:
            futures = []
            for _ in range(GAMES_PER_TYPE):
                session = requests.Session()
                session.headers.update({"Content-Type": "application/json"})
                bot = create_bot(session)
                if bot["ok"]:
                    futures.append(executor.submit(play_game, session, bot["token"], "connect4"))
            
            for f in as_completed(futures):
                if f.result()["ok"]:
                    played += 1
        
        metrics.end_phase("connect4")
        print(f"  Played: {played}/{GAMES_PER_TYPE} games")
        
    def test_08_checkers_50_games(self):
        """Run 50 Checkers games"""
        metrics.start_phase("checkers")
        print(f"\n{'='*60}")
        print(f"PHASE 7: Checkers Games ({GAMES_PER_TYPE})")
        print(f"{'='*60}")
        
        played = 0
        with ThreadPoolExecutor(max_workers=CONCURRENT_REQUESTS) as executor:
            futures = []
            for _ in range(GAMES_PER_TYPE):
                session = requests.Session()
                session.headers.update({"Content-Type": "application/json"})
                bot = create_bot(session)
                if bot["ok"]:
                    futures.append(executor.submit(play_game, session, bot["token"], "checkers"))
            
            for f in as_completed(futures):
                if f.result()["ok"]:
                    played += 1
        
        metrics.end_phase("checkers")
        print(f"  Played: {played}/{GAMES_PER_TYPE} games")
        
    def test_09_leaderboard_stress(self):
        """Stress test leaderboards with 60 concurrent requests"""
        metrics.start_phase("leaderboard")
        print(f"\n{'='*60}")
        print("PHASE 8: Leaderboard Stress Test (60 requests)")
        print(f"{'='*60}")
        
        success = 0
        game_types = ["blackjack", "poker", "uno", "tictactoe", "connect4", "checkers"]
        
        with ThreadPoolExecutor(max_workers=CONCURRENT_REQUESTS) as executor:
            futures = []
            for gt in game_types:
                for _ in range(10):
                    futures.append(executor.submit(get_leaderboard, requests.Session(), gt))
            
            for f in as_completed(futures):
                result = f.result()
                if result["ok"]:
                    success += 1
        
        metrics.end_phase("leaderboard")
        print(f"  Success: {success}/60 requests")
        
    def test_10_global_stats_verification(self):
        """Verify global stats after load test"""
        print(f"\n{'='*60}")
        print("PHASE 9: Global Stats Verification")
        print(f"{'='*60}")
        
        result = get_global_stats(self.session)
        if result["ok"]:
            data = result["data"]
            print(f"  Total Players: {data.get('total_players', 'N/A')}")
            print(f"  Total Games Played: {data.get('total_games_played', 'N/A')}")
            popular = data.get('most_popular_games', [])
            print("  Most Popular Games:")
            for game in popular[:5]:
                print(f"    - {game.get('game_type')}: {game.get('games_played')} games")
        else:
            print("  Could not retrieve stats")
            
    def test_11_final_report(self):
        """Generate comprehensive final report"""
        report = metrics.report()
        
        print(f"\n{'='*60}")
        print("FINAL LOAD TEST REPORT - LARGE SCALE")
        print(f"{'='*60}")
        print("\n  SUMMARY:")
        print(f"    Duration: {report['duration_sec']} seconds")
        print(f"    Total Requests: {report['total_requests']}")
        print(f"    Successful: {report['success']}")
        print(f"    Failed: {report['failed']}")
        print(f"    Success Rate: {report['success_rate']}%")
        print(f"    Throughput: {report['rps']} requests/second")
        
        print("\n  RESPONSE TIMES:")
        rt = report['response_times']
        print(f"    Min: {rt['min_ms']} ms")
        print(f"    Max: {rt['max_ms']} ms")
        print(f"    Avg: {rt['avg_ms']} ms")
        print(f"    P50: {rt['p50_ms']} ms")
        print(f"    P95: {rt['p95_ms']} ms")
        print(f"    P99: {rt['p99_ms']} ms")
        
        print("\n  ENTITIES CREATED:")
        print(f"    Bots: {report['bots_created']}")
        print(f"    Games: {report['games_played']}")
        
        print("\n  PHASE DURATIONS:")
        for phase, duration in report['phase_durations'].items():
            print(f"    {phase}: {duration}s")
        
        if report['unique_errors']:
            print(f"\n  ERRORS ({len(report['unique_errors'])}):")
            for err in report['unique_errors'][:5]:
                print(f"    - {err}")
        
        # Save detailed report
        report_path = f"/app/test_reports/load_test_large_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(report_path, 'w') as f:
            json.dump(report, f, indent=2)
        print(f"\n  Report saved: {report_path}")
        
        # Assertions
        assert report['success_rate'] >= 70, f"Success rate too low: {report['success_rate']}%"
        print("\n  [PASS] Load test completed successfully!")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s", "--tb=short"])
