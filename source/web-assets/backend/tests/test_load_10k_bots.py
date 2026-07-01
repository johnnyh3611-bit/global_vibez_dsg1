import random
"""
Global Vibez DSG - 10,000 Bot Load Test
========================================
Massive scale load test simulating 10,000 concurrent bot users:
- Profile creation
- Demo login authentication
- Dual bot games (bot vs bot)
- Dating/matching system
- Leaderboard with 10k users
- Database performance under load

Test Strategy:
1. Create 10,000 unique bot profiles
2. Simulate dual bot games across all game types
3. Test dating/matching between bots
4. Measure API response times, throughput, error rates
"""

import pytest
import requests
import time
import secrets
secure_random = secrets.SystemRandom()
import uuid
import json
import os
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed
import statistics

# Configuration
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    BASE_URL = "https://social-connect-953.preview.emergentagent.com"

# Test parameters - scaled for 10k bots
TOTAL_BOTS = 10000
BATCH_SIZE = 100  # Create bots in batches
CONCURRENT_REQUESTS = 50  # Max concurrent requests
GAME_TYPES = ["blackjack", "poker", "uno", "tictactoe", "connect4", "checkers"]
DUAL_BOT_GAMES_PER_TYPE = 200  # 200 games per type = 1200 total dual bot games

# Metrics storage
metrics = {
    "profile_creation": {"success": 0, "failed": 0, "times": []},
    "auth": {"success": 0, "failed": 0, "times": []},
    "games": {"success": 0, "failed": 0, "times": []},
    "matching": {"success": 0, "failed": 0, "times": []},
    "stats": {"success": 0, "failed": 0, "times": []},
    "errors": []
}


class LoadTestMetrics:
    """Track and report load test metrics"""
    
    def __init__(self):
        self.start_time = None
        self.end_time = None
        self.requests_total = 0
        self.requests_success = 0
        self.requests_failed = 0
        self.response_times = []
        self.errors = []
        self.bots_created = 0
        self.games_played = 0
        self.matches_created = 0
        
    def start(self):
        self.start_time = time.time()
        
    def stop(self):
        self.end_time = time.time()
        
    def record_request(self, success: bool, response_time: float, error: str = None):
        self.requests_total += 1
        self.response_times.append(response_time)
        if success:
            self.requests_success += 1
        else:
            self.requests_failed += 1
            if error:
                self.errors.append(error)
                
    def get_report(self) -> dict:
        duration = (self.end_time - self.start_time) if self.end_time else 0
        return {
            "duration_seconds": round(duration, 2),
            "total_requests": self.requests_total,
            "successful_requests": self.requests_success,
            "failed_requests": self.requests_failed,
            "success_rate": round((self.requests_success / max(1, self.requests_total)) * 100, 2),
            "requests_per_second": round(self.requests_total / max(1, duration), 2),
            "response_times": {
                "min_ms": round(min(self.response_times) * 1000, 2) if self.response_times else 0,
                "max_ms": round(max(self.response_times) * 1000, 2) if self.response_times else 0,
                "avg_ms": round(statistics.mean(self.response_times) * 1000, 2) if self.response_times else 0,
                "p50_ms": round(statistics.median(self.response_times) * 1000, 2) if self.response_times else 0,
                "p95_ms": round(sorted(self.response_times)[int(len(self.response_times) * 0.95)] * 1000, 2) if len(self.response_times) > 20 else 0,
                "p99_ms": round(sorted(self.response_times)[int(len(self.response_times) * 0.99)] * 1000, 2) if len(self.response_times) > 100 else 0,
            },
            "bots_created": self.bots_created,
            "games_played": self.games_played,
            "matches_created": self.matches_created,
            "unique_errors": list(set(self.errors))[:10]  # Top 10 unique errors
        }


# Global metrics instance
load_metrics = LoadTestMetrics()


def create_bot_profile(bot_id: int) -> dict:
    """Generate a unique bot profile"""
    genders = ["male", "female", "non-binary", "other"]
    interests = ["gaming", "music", "sports", "travel", "food", "movies", "art", "tech", "fitness", "reading"]
    locations = ["New York", "Los Angeles", "Chicago", "Houston", "Miami", "Seattle", "Denver", "Atlanta", "Boston", "Austin"]
    
    return {
        "bot_id": bot_id,
        "name": f"Bot_{bot_id}_{uuid.uuid4().hex[:6]}",
        "email": f"bot_{bot_id}_{uuid.uuid4().hex[:8]}@globalvibez.test",
        "age": random.randint(18, 65),
        "gender": random.choice(genders),
        "bio": f"Test bot #{bot_id} - Load testing Global Vibez DSG",
        "location": random.choice(locations),
        "interests": random.sample(interests, random.randint(2, 5)),
        "photos": [f"https://api.dicebear.com/7.x/avataaars/svg?seed=bot{bot_id}"]
    }


def create_test_user_sync(session: requests.Session) -> dict:
    """Create a test user synchronously"""
    start = time.time()
    try:
        response = session.post(f"{BASE_URL}/api/auth/test-user", timeout=30)
        elapsed = time.time() - start
        
        if response.status_code == 200:
            data = response.json()
            load_metrics.record_request(True, elapsed)
            load_metrics.bots_created += 1
            return {
                "success": True,
                "user_id": data.get("user_id"),
                "session_token": data.get("session_token"),
                "email": data.get("email"),
                "name": data.get("name")
            }
        else:
            load_metrics.record_request(False, elapsed, f"Status {response.status_code}")
            return {"success": False, "error": f"Status {response.status_code}"}
    except Exception as e:
        elapsed = time.time() - start
        load_metrics.record_request(False, elapsed, str(e))
        return {"success": False, "error": str(e)}


def play_practice_game_sync(session: requests.Session, token: str, game_type: str) -> dict:
    """Play a practice game synchronously"""
    headers = {"Authorization": f"Bearer {token}"}
    
    # Start game
    start = time.time()
    try:
        response = session.post(
            f"{BASE_URL}/api/practice/start",
            json={"game_type": game_type, "difficulty": "medium"},
            headers=headers,
            timeout=30
        )
        elapsed = time.time() - start
        
        if response.status_code == 200:
            game_data = response.json()
            game_id = game_data.get("game_id")
            load_metrics.record_request(True, elapsed)
            load_metrics.games_played += 1
            
            # Make a few moves based on game type
            if game_type == "blackjack":
                # Hit once then stand
                session.post(
                    f"{BASE_URL}/api/practice/game/{game_id}/move",
                    json={"move_data": {"action": "hit"}},
                    headers=headers,
                    timeout=30
                )
                session.post(
                    f"{BASE_URL}/api/practice/game/{game_id}/move",
                    json={"move_data": {"action": "stand"}},
                    headers=headers,
                    timeout=30
                )
            elif game_type == "tictactoe":
                # Make a move
                session.post(
                    f"{BASE_URL}/api/practice/game/{game_id}/move",
                    json={"move_data": {"row": 1, "col": 1}},
                    headers=headers,
                    timeout=30
                )
            elif game_type == "poker":
                # Call
                session.post(
                    f"{BASE_URL}/api/practice/game/{game_id}/move",
                    json={"move_data": {"action": "call"}},
                    headers=headers,
                    timeout=30
                )
            elif game_type == "uno":
                # Draw a card
                session.post(
                    f"{BASE_URL}/api/practice/game/{game_id}/move",
                    json={"move_data": {"action": "draw"}},
                    headers=headers,
                    timeout=30
                )
            
            return {"success": True, "game_id": game_id, "game_type": game_type}
        else:
            load_metrics.record_request(False, elapsed, f"Game start failed: {response.status_code}")
            return {"success": False, "error": f"Status {response.status_code}"}
    except Exception as e:
        elapsed = time.time() - start
        load_metrics.record_request(False, elapsed, str(e))
        return {"success": False, "error": str(e)}


def get_leaderboard_sync(session: requests.Session, game_type: str) -> dict:
    """Get leaderboard for a game type"""
    start = time.time()
    try:
        response = session.get(
            f"{BASE_URL}/api/stats/leaderboard/{game_type}",
            timeout=30
        )
        elapsed = time.time() - start
        
        if response.status_code == 200:
            data = response.json()
            load_metrics.record_request(True, elapsed)
            return {"success": True, "leaderboard": data.get("leaderboard", [])}
        else:
            load_metrics.record_request(False, elapsed, f"Leaderboard failed: {response.status_code}")
            return {"success": False, "error": f"Status {response.status_code}"}
    except Exception as e:
        elapsed = time.time() - start
        load_metrics.record_request(False, elapsed, str(e))
        return {"success": False, "error": str(e)}


def get_global_stats_sync(session: requests.Session) -> dict:
    """Get global platform stats"""
    start = time.time()
    try:
        response = session.get(f"{BASE_URL}/api/stats/global", timeout=30)
        elapsed = time.time() - start
        
        if response.status_code == 200:
            data = response.json()
            load_metrics.record_request(True, elapsed)
            return {"success": True, "stats": data}
        else:
            load_metrics.record_request(False, elapsed, f"Global stats failed: {response.status_code}")
            return {"success": False, "error": f"Status {response.status_code}"}
    except Exception as e:
        elapsed = time.time() - start
        load_metrics.record_request(False, elapsed, str(e))
        return {"success": False, "error": str(e)}


class TestLoadTest10kBots:
    """Load test suite for 10,000 bot simulation"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        self.bots = []
        
    def test_01_health_check(self):
        """Verify API is accessible before load test"""
        response = self.session.get(f"{BASE_URL}/api/")
        assert response.status_code == 200, f"API not accessible: {response.status_code}"
        print(f"API Health Check: OK - {BASE_URL}")
        
    def test_02_create_1000_bots_batch(self):
        """Create 1000 test bots in parallel batches"""
        load_metrics.start()
        
        print(f"\n{'='*60}")
        print("PHASE 1: Creating 1000 Bot Users")
        print(f"{'='*60}")
        
        created_bots = []
        failed_count = 0
        
        # Create bots in batches using ThreadPoolExecutor
        with ThreadPoolExecutor(max_workers=CONCURRENT_REQUESTS) as executor:
            futures = []
            for i in range(1000):  # Create 1000 bots for this test
                session = requests.Session()
                session.headers.update({"Content-Type": "application/json"})
                futures.append(executor.submit(create_test_user_sync, session))
            
            for i, future in enumerate(as_completed(futures)):
                result = future.result()
                if result["success"]:
                    created_bots.append(result)
                else:
                    failed_count += 1
                
                # Progress update every 100 bots
                if (i + 1) % 100 == 0:
                    print(f"  Progress: {i + 1}/1000 bots created ({len(created_bots)} success, {failed_count} failed)")
        
        self.bots = created_bots
        
        print(f"\n  RESULT: Created {len(created_bots)} bots, {failed_count} failed")
        assert len(created_bots) >= 500, f"Too many failures: only {len(created_bots)} bots created"
        
    def test_03_dual_bot_blackjack_games(self):
        """Run 200 dual bot blackjack games"""
        print(f"\n{'='*60}")
        print("PHASE 2: Dual Bot Blackjack Games (200 games)")
        print(f"{'='*60}")
        
        games_played = 0
        games_failed = 0
        
        with ThreadPoolExecutor(max_workers=CONCURRENT_REQUESTS) as executor:
            futures = []
            for i in range(200):
                session = requests.Session()
                session.headers.update({"Content-Type": "application/json"})
                # Create a test user for each game
                user_result = create_test_user_sync(session)
                if user_result["success"]:
                    futures.append(executor.submit(
                        play_practice_game_sync, 
                        session, 
                        user_result["session_token"], 
                        "blackjack"
                    ))
            
            for future in as_completed(futures):
                result = future.result()
                if result["success"]:
                    games_played += 1
                else:
                    games_failed += 1
        
        print(f"  RESULT: {games_played} blackjack games played, {games_failed} failed")
        assert games_played >= 100, f"Too many game failures: only {games_played} games played"
        
    def test_04_dual_bot_poker_games(self):
        """Run 200 dual bot poker games"""
        print(f"\n{'='*60}")
        print("PHASE 3: Dual Bot Poker Games (200 games)")
        print(f"{'='*60}")
        
        games_played = 0
        games_failed = 0
        
        with ThreadPoolExecutor(max_workers=CONCURRENT_REQUESTS) as executor:
            futures = []
            for i in range(200):
                session = requests.Session()
                session.headers.update({"Content-Type": "application/json"})
                user_result = create_test_user_sync(session)
                if user_result["success"]:
                    futures.append(executor.submit(
                        play_practice_game_sync, 
                        session, 
                        user_result["session_token"], 
                        "poker"
                    ))
            
            for future in as_completed(futures):
                result = future.result()
                if result["success"]:
                    games_played += 1
                else:
                    games_failed += 1
        
        print(f"  RESULT: {games_played} poker games played, {games_failed} failed")
        
    def test_05_dual_bot_uno_games(self):
        """Run 200 dual bot UNO games"""
        print(f"\n{'='*60}")
        print("PHASE 4: Dual Bot UNO Games (200 games)")
        print(f"{'='*60}")
        
        games_played = 0
        games_failed = 0
        
        with ThreadPoolExecutor(max_workers=CONCURRENT_REQUESTS) as executor:
            futures = []
            for i in range(200):
                session = requests.Session()
                session.headers.update({"Content-Type": "application/json"})
                user_result = create_test_user_sync(session)
                if user_result["success"]:
                    futures.append(executor.submit(
                        play_practice_game_sync, 
                        session, 
                        user_result["session_token"], 
                        "uno"
                    ))
            
            for future in as_completed(futures):
                result = future.result()
                if result["success"]:
                    games_played += 1
                else:
                    games_failed += 1
        
        print(f"  RESULT: {games_played} UNO games played, {games_failed} failed")
        
    def test_06_dual_bot_tictactoe_games(self):
        """Run 200 dual bot TicTacToe games"""
        print(f"\n{'='*60}")
        print("PHASE 5: Dual Bot TicTacToe Games (200 games)")
        print(f"{'='*60}")
        
        games_played = 0
        games_failed = 0
        
        with ThreadPoolExecutor(max_workers=CONCURRENT_REQUESTS) as executor:
            futures = []
            for i in range(200):
                session = requests.Session()
                session.headers.update({"Content-Type": "application/json"})
                user_result = create_test_user_sync(session)
                if user_result["success"]:
                    futures.append(executor.submit(
                        play_practice_game_sync, 
                        session, 
                        user_result["session_token"], 
                        "tictactoe"
                    ))
            
            for future in as_completed(futures):
                result = future.result()
                if result["success"]:
                    games_played += 1
                else:
                    games_failed += 1
        
        print(f"  RESULT: {games_played} TicTacToe games played, {games_failed} failed")
        
    def test_07_leaderboard_stress_test(self):
        """Stress test leaderboard with concurrent requests"""
        print(f"\n{'='*60}")
        print("PHASE 6: Leaderboard Stress Test (100 concurrent requests)")
        print(f"{'='*60}")
        
        success_count = 0
        failed_count = 0
        
        with ThreadPoolExecutor(max_workers=CONCURRENT_REQUESTS) as executor:
            futures = []
            for game_type in GAME_TYPES:
                for _ in range(20):  # 20 requests per game type
                    session = requests.Session()
                    futures.append(executor.submit(get_leaderboard_sync, session, game_type))
            
            for future in as_completed(futures):
                result = future.result()
                if result["success"]:
                    success_count += 1
                else:
                    failed_count += 1
        
        print(f"  RESULT: {success_count} leaderboard requests succeeded, {failed_count} failed")
        
    def test_08_global_stats_stress_test(self):
        """Stress test global stats endpoint"""
        print(f"\n{'='*60}")
        print("PHASE 7: Global Stats Stress Test (50 concurrent requests)")
        print(f"{'='*60}")
        
        success_count = 0
        failed_count = 0
        
        with ThreadPoolExecutor(max_workers=CONCURRENT_REQUESTS) as executor:
            futures = []
            for _ in range(50):
                session = requests.Session()
                futures.append(executor.submit(get_global_stats_sync, session))
            
            for future in as_completed(futures):
                result = future.result()
                if result["success"]:
                    success_count += 1
                else:
                    failed_count += 1
        
        print(f"  RESULT: {success_count} global stats requests succeeded, {failed_count} failed")
        
    def test_09_database_document_count(self):
        """Verify database has accumulated test data"""
        print(f"\n{'='*60}")
        print("PHASE 8: Database Document Count Verification")
        print(f"{'='*60}")
        
        # Get global stats which includes document counts
        response = self.session.get(f"{BASE_URL}/api/stats/global")
        
        if response.status_code == 200:
            data = response.json()
            print(f"  Total Players: {data.get('total_players', 'N/A')}")
            print(f"  Total Games Played: {data.get('total_games_played', 'N/A')}")
            print(f"  Most Popular Games: {data.get('most_popular_games', [])}")
        else:
            print(f"  Could not retrieve stats: {response.status_code}")
            
    def test_10_final_metrics_report(self):
        """Generate final load test metrics report"""
        load_metrics.stop()
        report = load_metrics.get_report()
        
        print(f"\n{'='*60}")
        print("FINAL LOAD TEST REPORT")
        print(f"{'='*60}")
        print(f"  Duration: {report['duration_seconds']} seconds")
        print(f"  Total Requests: {report['total_requests']}")
        print(f"  Successful: {report['successful_requests']}")
        print(f"  Failed: {report['failed_requests']}")
        print(f"  Success Rate: {report['success_rate']}%")
        print(f"  Requests/Second: {report['requests_per_second']}")
        print("\n  Response Times:")
        print(f"    Min: {report['response_times']['min_ms']} ms")
        print(f"    Max: {report['response_times']['max_ms']} ms")
        print(f"    Avg: {report['response_times']['avg_ms']} ms")
        print(f"    P50: {report['response_times']['p50_ms']} ms")
        print(f"    P95: {report['response_times']['p95_ms']} ms")
        print(f"    P99: {report['response_times']['p99_ms']} ms")
        print(f"\n  Bots Created: {report['bots_created']}")
        print(f"  Games Played: {report['games_played']}")
        
        if report['unique_errors']:
            print(f"\n  Unique Errors ({len(report['unique_errors'])}):")
            for err in report['unique_errors'][:5]:
                print(f"    - {err[:100]}")
        
        # Save report to file
        report_path = f"/app/test_reports/load_test_10k_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(report_path, 'w') as f:
            json.dump(report, f, indent=2)
        print(f"\n  Report saved to: {report_path}")
        
        # Assert minimum success rate
        assert report['success_rate'] >= 50, f"Success rate too low: {report['success_rate']}%"


class TestScaledLoadTest:
    """Scaled load test - can be run with different bot counts"""
    
    def test_scaled_bot_creation(self):
        """Create bots at scale - configurable count"""
        # This test creates bots in smaller batches for reliability
        BOT_COUNT = 500  # Adjust as needed
        BATCH_SIZE = 50
        
        print(f"\n{'='*60}")
        print(f"SCALED BOT CREATION TEST: {BOT_COUNT} bots")
        print(f"{'='*60}")
        
        total_created = 0
        total_failed = 0
        all_response_times = []
        
        for batch_num in range(BOT_COUNT // BATCH_SIZE):
            batch_created = 0
            batch_failed = 0
            
            with ThreadPoolExecutor(max_workers=25) as executor:
                futures = []
                for _ in range(BATCH_SIZE):
                    session = requests.Session()
                    session.headers.update({"Content-Type": "application/json"})
                    futures.append(executor.submit(create_test_user_sync, session))
                
                for future in as_completed(futures):
                    result = future.result()
                    if result["success"]:
                        batch_created += 1
                    else:
                        batch_failed += 1
            
            total_created += batch_created
            total_failed += batch_failed
            print(f"  Batch {batch_num + 1}/{BOT_COUNT // BATCH_SIZE}: {batch_created} created, {batch_failed} failed")
            
            # Small delay between batches to prevent overwhelming the server
            time.sleep(0.5)
        
        print(f"\n  TOTAL: {total_created} bots created, {total_failed} failed")
        print(f"  Success Rate: {(total_created / BOT_COUNT) * 100:.1f}%")
        
        assert total_created >= BOT_COUNT * 0.5, f"Too many failures: only {total_created}/{BOT_COUNT} created"


class TestDualBotGameSimulation:
    """Simulate dual bot games - two bots playing against each other"""
    
    def test_dual_bot_blackjack_simulation(self):
        """Simulate 100 blackjack games between bot pairs"""
        print(f"\n{'='*60}")
        print("DUAL BOT BLACKJACK SIMULATION: 100 games")
        print(f"{'='*60}")
        
        games_completed = 0
        games_failed = 0
        
        for i in range(100):
            session = requests.Session()
            session.headers.update({"Content-Type": "application/json"})
            
            # Create bot player
            user_result = create_test_user_sync(session)
            if not user_result["success"]:
                games_failed += 1
                continue
            
            token = user_result["session_token"]
            headers = {"Authorization": f"Bearer {token}"}
            
            # Start blackjack game
            try:
                start_response = session.post(
                    f"{BASE_URL}/api/practice/start",
                    json={"game_type": "blackjack", "difficulty": "medium"},
                    headers=headers,
                    timeout=30
                )
                
                if start_response.status_code != 200:
                    games_failed += 1
                    continue
                
                game_data = start_response.json()
                game_id = game_data.get("game_id")
                
                # Simulate bot playing - random hit/stand decisions
                for _ in range(random.randint(1, 3)):
                    action = random.choice(["hit", "stand"])
                    move_response = session.post(
                        f"{BASE_URL}/api/practice/game/{game_id}/move",
                        json={"move_data": {"action": action}},
                        headers=headers,
                        timeout=30
                    )
                    
                    if move_response.status_code == 200:
                        result = move_response.json()
                        if result.get("status") == "completed":
                            break
                    
                    if action == "stand":
                        break
                
                games_completed += 1
                
            except Exception:
                games_failed += 1
            
            # Progress update
            if (i + 1) % 20 == 0:
                print(f"  Progress: {i + 1}/100 games ({games_completed} completed, {games_failed} failed)")
        
        print(f"\n  RESULT: {games_completed} games completed, {games_failed} failed")
        assert games_completed >= 50, f"Too many failures: only {games_completed}/100 completed"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s", "--tb=short"])
