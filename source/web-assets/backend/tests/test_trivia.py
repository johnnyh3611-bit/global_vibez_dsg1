"""
Trivia Game API Tests
Tests all trivia-related endpoints:
- GET /api/trivia/categories - Get trivia categories
- POST /api/trivia/start - Start a new trivia game
- GET /api/trivia/game/{game_id} - Get current game state
- POST /api/trivia/game/{game_id}/answer - Submit an answer
- GET /api/trivia/game/{game_id}/results - Get game results
- GET /api/trivia/leaderboard - Global leaderboard
- GET /api/trivia/stats - User statistics
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
SESSION_TOKEN = os.environ.get('TEST_SESSION_TOKEN', 'test_session_fixture')
USER_ID = os.environ.get('TEST_USER_ID', 'test_user_fixture')


class TestTriviaCategories:
    """Test trivia categories endpoint - Public endpoint"""
    
    def test_get_categories_success(self):
        """GET /api/trivia/categories should return all categories"""
        response = requests.get(f"{BASE_URL}/api/trivia/categories")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "categories" in data, "Response should contain 'categories' key"
        
        categories = data["categories"]
        assert isinstance(categories, list), "Categories should be a list"
        assert len(categories) == 8, f"Expected 8 categories, got {len(categories)}"
        
        # Verify category structure
        expected_ids = ["general", "science", "movies", "sports", "history", "geography", "music", "pop_culture"]
        actual_ids = [cat["id"] for cat in categories]
        for expected_id in expected_ids:
            assert expected_id in actual_ids, f"Category '{expected_id}' not found"
        
        # Verify each category has required fields
        for cat in categories:
            assert "id" in cat, "Category must have 'id'"
            assert "name" in cat, "Category must have 'name'"
            assert "emoji" in cat, "Category must have 'emoji'"
            assert "color" in cat, "Category must have 'color'"
        
        print("PASS: Categories endpoint returns all 8 categories with correct structure")


class TestTriviaGameStart:
    """Test starting a trivia game - Authenticated endpoint"""
    
    def test_start_game_unauthorized(self):
        """POST /api/trivia/start should return 401 without auth"""
        response = requests.post(
            f"{BASE_URL}/api/trivia/start",
            json={"category": "mixed", "num_questions": 10, "difficulty": "mixed"}
        )
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("PASS: Start game returns 401 without authentication")
    
    def test_start_game_mixed_category(self):
        """POST /api/trivia/start with mixed category should work"""
        response = requests.post(
            f"{BASE_URL}/api/trivia/start",
            headers={"Authorization": f"Bearer {SESSION_TOKEN}"},
            json={"category": "mixed", "num_questions": 10, "difficulty": "mixed"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "game_id" in data, "Response must have game_id"
        assert data["game_id"].startswith("trivia_"), "game_id should start with 'trivia_'"
        assert "num_questions" in data, "Response must have num_questions"
        assert "first_question" in data, "Response must have first_question"
        
        # Verify first question structure
        first_q = data["first_question"]
        assert "id" in first_q
        assert "question" in first_q
        assert "options" in first_q
        assert len(first_q["options"]) == 4, "Should have 4 options"
        assert "question_number" in first_q
        assert first_q["question_number"] == 1
        
        print(f"PASS: Started game {data['game_id']} with {data['num_questions']} questions")
        return data["game_id"]
    
    def test_start_game_specific_category(self):
        """POST /api/trivia/start with specific category should work"""
        response = requests.post(
            f"{BASE_URL}/api/trivia/start",
            headers={"Authorization": f"Bearer {SESSION_TOKEN}"},
            json={"category": "science", "num_questions": 5, "difficulty": "easy"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["category"] == "science", "Category should be 'science'"
        
        # First question should be from science category
        assert data["first_question"]["category"] == "science", "Question should be from science category"
        
        print(f"PASS: Started science game {data['game_id']}")


class TestTriviaGamePlay:
    """Test trivia game play flow"""
    
    @pytest.fixture(autouse=True)
    def setup_game(self):
        """Setup: Start a new game for each test"""
        response = requests.post(
            f"{BASE_URL}/api/trivia/start",
            headers={"Authorization": f"Bearer {SESSION_TOKEN}"},
            json={"category": "mixed", "num_questions": 5, "difficulty": "mixed"}
        )
        assert response.status_code == 200
        self.game_data = response.json()
        self.game_id = self.game_data["game_id"]
        self.first_question = self.game_data["first_question"]
    
    def test_get_game_state(self):
        """GET /api/trivia/game/{game_id} should return game state"""
        response = requests.get(
            f"{BASE_URL}/api/trivia/game/{self.game_id}",
            headers={"Authorization": f"Bearer {SESSION_TOKEN}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["status"] == "in_progress"
        assert "current_question" in data
        assert data["score"] == 0
        
        print(f"PASS: Game state retrieved for {self.game_id}")
    
    def test_get_game_unauthorized(self):
        """GET /api/trivia/game/{game_id} should return 401 without auth"""
        response = requests.get(f"{BASE_URL}/api/trivia/game/{self.game_id}")
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("PASS: Get game state returns 401 without auth")
    
    def test_get_game_not_found(self):
        """GET /api/trivia/game/{game_id} should return 404 for invalid game"""
        response = requests.get(
            f"{BASE_URL}/api/trivia/game/trivia_nonexistent123",
            headers={"Authorization": f"Bearer {SESSION_TOKEN}"}
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("PASS: Get non-existent game returns 404")
    
    def test_submit_answer_correct(self):
        """POST /api/trivia/game/{game_id}/answer should accept correct answer"""
        # Submit answer for first question
        response = requests.post(
            f"{BASE_URL}/api/trivia/game/{self.game_id}/answer",
            headers={"Authorization": f"Bearer {SESSION_TOKEN}"},
            json={
                "question_id": self.first_question["id"],
                "user_answer": self.first_question["options"][0]["id"],  # Just pick first option
                "time_taken": 5
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "is_correct" in data
        assert "correct_answer" in data
        assert "explanation" in data
        assert "points_earned" in data
        assert "new_score" in data
        
        print(f"PASS: Submitted answer, correct={data['is_correct']}, points={data['points_earned']}")
    
    def test_submit_answer_question_mismatch(self):
        """POST /api/trivia/game/{game_id}/answer should reject mismatched question_id"""
        response = requests.post(
            f"{BASE_URL}/api/trivia/game/{self.game_id}/answer",
            headers={"Authorization": f"Bearer {SESSION_TOKEN}"},
            json={
                "question_id": "wrong_question_id",
                "user_answer": "a",
                "time_taken": 5
            }
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("PASS: Reject mismatched question_id")


class TestTriviaFullGameFlow:
    """Test complete game flow from start to finish"""
    
    def test_complete_game_and_results(self):
        """Complete a full game and verify results"""
        # Start game with 5 questions
        start_response = requests.post(
            f"{BASE_URL}/api/trivia/start",
            headers={"Authorization": f"Bearer {SESSION_TOKEN}"},
            json={"category": "mixed", "num_questions": 5, "difficulty": "easy"}
        )
        
        assert start_response.status_code == 200
        game_data = start_response.json()
        game_id = game_data["game_id"]
        current_question = game_data["first_question"]
        
        print(f"Started game {game_id} with 5 questions")
        
        # Answer all 5 questions
        for i in range(5):
            answer_response = requests.post(
                f"{BASE_URL}/api/trivia/game/{game_id}/answer",
                headers={"Authorization": f"Bearer {SESSION_TOKEN}"},
                json={
                    "question_id": current_question["id"],
                    "user_answer": "a",  # Just pick 'a' for all
                    "time_taken": 3
                }
            )
            
            assert answer_response.status_code == 200, f"Answer {i+1} failed: {answer_response.text}"
            answer_data = answer_response.json()
            
            print(f"  Q{i+1}: correct={answer_data['is_correct']}, score={answer_data['new_score']}")
            
            if i < 4:  # Not last question
                assert "next_question" in answer_data, f"Should have next_question for question {i+1}"
                current_question = answer_data["next_question"]
            else:  # Last question
                assert answer_data.get("game_completed"), "Last answer should indicate game completed"
                assert "final_results" in answer_data
        
        # Verify game is completed
        game_state_response = requests.get(
            f"{BASE_URL}/api/trivia/game/{game_id}",
            headers={"Authorization": f"Bearer {SESSION_TOKEN}"}
        )
        
        assert game_state_response.status_code == 200
        state_data = game_state_response.json()
        assert state_data["status"] == "completed"
        
        # Get detailed results
        results_response = requests.get(
            f"{BASE_URL}/api/trivia/game/{game_id}/results",
            headers={"Authorization": f"Bearer {SESSION_TOKEN}"}
        )
        
        assert results_response.status_code == 200, f"Results failed: {results_response.text}"
        results_data = results_response.json()
        
        assert results_data["game_id"] == game_id
        assert results_data["total_questions"] == 5
        assert "score" in results_data
        assert "correct_answers" in results_data
        assert "percentage" in results_data
        assert "answers_detail" in results_data
        assert len(results_data["answers_detail"]) == 5
        
        print(f"PASS: Completed game - Score: {results_data['score']}, Correct: {results_data['correct_answers']}/5 ({results_data['percentage']}%)")
        return game_id


class TestTriviaLeaderboard:
    """Test trivia leaderboard endpoint"""
    
    def test_get_leaderboard(self):
        """GET /api/trivia/leaderboard should return top scores"""
        response = requests.get(f"{BASE_URL}/api/trivia/leaderboard")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "leaderboard" in data
        assert isinstance(data["leaderboard"], list)
        
        # Verify structure if there are entries
        if len(data["leaderboard"]) > 0:
            entry = data["leaderboard"][0]
            assert "game_id" in entry
            assert "user_name" in entry
            assert "score" in entry
            assert "correct_answers" in entry
            assert "percentage" in entry
        
        print(f"PASS: Leaderboard has {len(data['leaderboard'])} entries")
    
    def test_get_leaderboard_with_category_filter(self):
        """GET /api/trivia/leaderboard?category=science should filter by category"""
        response = requests.get(f"{BASE_URL}/api/trivia/leaderboard?category=science")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data["category"] == "science"
        
        # All entries should be from science category
        for entry in data["leaderboard"]:
            assert entry["category"] == "science", f"Entry category is {entry['category']}, expected science"
        
        print("PASS: Leaderboard filtered by science category")


class TestTriviaUserStats:
    """Test user statistics endpoint"""
    
    def test_get_stats_unauthorized(self):
        """GET /api/trivia/stats should return 401 without auth"""
        response = requests.get(f"{BASE_URL}/api/trivia/stats")
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("PASS: Stats returns 401 without auth")
    
    def test_get_stats_no_games(self):
        """GET /api/trivia/stats for user with no games should return zeros"""
        # Create a new user with no games
        ts = int(time.time() * 1000)
        
        response = requests.get(
            f"{BASE_URL}/api/trivia/stats",
            headers={"Authorization": f"Bearer {SESSION_TOKEN}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "total_games" in data
        assert "total_score" in data
        assert "average_score" in data
        assert "accuracy" in data
        assert "best_score" in data
        
        print(f"PASS: Stats returned - Games: {data['total_games']}, Total Score: {data['total_score']}")


class TestTriviaResultsEdgeCases:
    """Test edge cases for results endpoint"""
    
    def test_results_game_not_completed(self):
        """GET /api/trivia/game/{game_id}/results should return 400 for incomplete game"""
        # Start a game but don't complete it
        start_response = requests.post(
            f"{BASE_URL}/api/trivia/start",
            headers={"Authorization": f"Bearer {SESSION_TOKEN}"},
            json={"category": "mixed", "num_questions": 5, "difficulty": "mixed"}
        )
        
        assert start_response.status_code == 200
        game_id = start_response.json()["game_id"]
        
        # Try to get results without completing
        results_response = requests.get(
            f"{BASE_URL}/api/trivia/game/{game_id}/results",
            headers={"Authorization": f"Bearer {SESSION_TOKEN}"}
        )
        
        assert results_response.status_code == 400, f"Expected 400, got {results_response.status_code}"
        print("PASS: Results returns 400 for incomplete game")
    
    def test_submit_answer_completed_game(self):
        """POST /api/trivia/game/{game_id}/answer should return 400 for completed game"""
        # Start and complete a game
        start_response = requests.post(
            f"{BASE_URL}/api/trivia/start",
            headers={"Authorization": f"Bearer {SESSION_TOKEN}"},
            json={"category": "mixed", "num_questions": 1, "difficulty": "easy"}
        )
        
        assert start_response.status_code == 200
        game_data = start_response.json()
        game_id = game_data["game_id"]
        question = game_data["first_question"]
        
        # Answer the only question to complete the game
        answer_response = requests.post(
            f"{BASE_URL}/api/trivia/game/{game_id}/answer",
            headers={"Authorization": f"Bearer {SESSION_TOKEN}"},
            json={
                "question_id": question["id"],
                "user_answer": "a",
                "time_taken": 2
            }
        )
        
        assert answer_response.status_code == 200
        
        # Try to submit another answer
        second_answer = requests.post(
            f"{BASE_URL}/api/trivia/game/{game_id}/answer",
            headers={"Authorization": f"Bearer {SESSION_TOKEN}"},
            json={
                "question_id": "some_id",
                "user_answer": "b",
                "time_taken": 2
            }
        )
        
        assert second_answer.status_code == 400, f"Expected 400, got {second_answer.status_code}"
        print("PASS: Cannot submit answer to completed game")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
