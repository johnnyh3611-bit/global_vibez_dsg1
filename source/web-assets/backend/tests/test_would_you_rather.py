"""
Tests for Would You Rather game endpoints
- GET /api/games/would-you-rather/random - Get random question
- POST /api/games/would-you-rather/vote - Submit vote
- GET /api/games/would-you-rather/my-votes - Get voting history
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Using existing test session from MongoDB (load from env or create fixture)
EXISTING_SESSION_TOKEN = os.environ.get('TEST_SESSION_TOKEN', 'test_session_fixture')


@pytest.fixture
def api_client():
    """Shared requests session with auth"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {EXISTING_SESSION_TOKEN}"
    })
    return session


class TestWouldYouRatherRandomEndpoint:
    """Tests for GET /api/games/would-you-rather/random"""
    
    def test_get_random_question_success(self, api_client):
        """Test fetching a random Would You Rather question"""
        response = api_client.get(f"{BASE_URL}/api/games/would-you-rather/random")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "question" in data
        assert "game_type" in data
        assert data["game_type"] == "would_you_rather"
        
        question = data["question"]
        assert "id" in question
        assert "category" in question
        assert "question" in question
        assert "option_a" in question
        assert "option_b" in question
        
        print(f"SUCCESS: Got random question ID: {question['id']}")
    
    def test_get_random_question_unauthenticated(self):
        """Test that unauthenticated requests are rejected"""
        response = requests.get(f"{BASE_URL}/api/games/would-you-rather/random")
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("SUCCESS: Unauthenticated request rejected with 401")


class TestWouldYouRatherVoteEndpoint:
    """Tests for POST /api/games/would-you-rather/vote"""
    
    def test_submit_vote_option_a(self, api_client):
        """Test submitting vote for option A"""
        vote_payload = {
            "question_id": "wyr5",
            "choice": "a"
        }
        
        response = api_client.post(
            f"{BASE_URL}/api/games/would-you-rather/vote",
            json=vote_payload
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["vote_recorded"]
        assert data["your_choice"] == "a"
        assert "statistics" in data
        
        stats = data["statistics"]
        assert "total_votes" in stats
        assert "option_a" in stats
        assert "option_b" in stats
        assert stats["total_votes"] >= 1
        assert "percentage" in stats["option_a"]
        assert "votes" in stats["option_a"]
        
        print(f"SUCCESS: Vote recorded. Stats: {stats['total_votes']} total votes")
    
    def test_submit_vote_option_b(self, api_client):
        """Test submitting vote for option B"""
        vote_payload = {
            "question_id": "wyr6",
            "choice": "b"
        }
        
        response = api_client.post(
            f"{BASE_URL}/api/games/would-you-rather/vote",
            json=vote_payload
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["vote_recorded"]
        assert data["your_choice"] == "b"
        
        print("SUCCESS: Vote for option B recorded")
    
    def test_update_existing_vote(self, api_client):
        """Test that voting again on same question updates the vote"""
        question_id = "wyr7"
        
        # First vote for option A
        vote1 = api_client.post(
            f"{BASE_URL}/api/games/would-you-rather/vote",
            json={"question_id": question_id, "choice": "a"}
        )
        assert vote1.status_code == 200
        
        # Change vote to option B
        vote2 = api_client.post(
            f"{BASE_URL}/api/games/would-you-rather/vote",
            json={"question_id": question_id, "choice": "b"}
        )
        assert vote2.status_code == 200
        
        data = vote2.json()
        assert data["your_choice"] == "b"
        
        print("SUCCESS: Vote update works correctly")
    
    def test_vote_invalid_question(self, api_client):
        """Test voting on non-existent question"""
        vote_payload = {
            "question_id": "invalid_question_xyz",
            "choice": "a"
        }
        
        response = api_client.post(
            f"{BASE_URL}/api/games/would-you-rather/vote",
            json=vote_payload
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("SUCCESS: Invalid question rejected with 404")
    
    def test_vote_unauthenticated(self):
        """Test that unauthenticated votes are rejected"""
        response = requests.post(
            f"{BASE_URL}/api/games/would-you-rather/vote",
            json={"question_id": "wyr1", "choice": "a"},
            headers={"Content-Type": "application/json"}
        )
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("SUCCESS: Unauthenticated vote rejected with 401")


class TestWouldYouRatherMyVotesEndpoint:
    """Tests for GET /api/games/would-you-rather/my-votes"""
    
    def test_get_vote_history(self, api_client):
        """Test fetching voting history after voting"""
        # First submit a vote to ensure we have history
        api_client.post(
            f"{BASE_URL}/api/games/would-you-rather/vote",
            json={"question_id": "wyr8", "choice": "a"}
        )
        
        # Get history
        response = api_client.get(f"{BASE_URL}/api/games/would-you-rather/my-votes")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        
        # Check that at least one vote has the expected structure
        vote = data[0]
        assert "vote_id" in vote
        assert "question_id" in vote
        assert "choice" in vote
        assert "created_at" in vote
        assert "question_text" in vote
        assert "option_a_text" in vote
        assert "option_b_text" in vote
        
        print(f"SUCCESS: Got {len(data)} votes in history")
    
    def test_get_vote_history_with_limit(self, api_client):
        """Test fetching voting history with limit parameter"""
        response = api_client.get(f"{BASE_URL}/api/games/would-you-rather/my-votes?limit=5")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list)
        assert len(data) <= 5
        
        print(f"SUCCESS: Got {len(data)} votes with limit=5")
    
    def test_vote_history_unauthenticated(self):
        """Test that unauthenticated history requests are rejected"""
        response = requests.get(f"{BASE_URL}/api/games/would-you-rather/my-votes")
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("SUCCESS: Unauthenticated history request rejected with 401")


class TestGamesList:
    """Tests to verify Would You Rather appears in games list"""
    
    def test_would_you_rather_in_games_list(self, api_client):
        """Test that Would You Rather appears in the games list"""
        response = api_client.get(f"{BASE_URL}/api/games/list")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "games" in data
        
        games = data["games"]
        assert "would_you_rather" in games, "Would You Rather should be in games list"
        
        wyr_game = games["would_you_rather"]
        assert wyr_game["name"] == "Would You Rather"
        assert wyr_game["emoji"] == "🤔"
        assert wyr_game["implemented"]
        assert wyr_game["type"] == "social"
        assert wyr_game["players"] == 1
        
        print("SUCCESS: Would You Rather is in games list with correct metadata")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
