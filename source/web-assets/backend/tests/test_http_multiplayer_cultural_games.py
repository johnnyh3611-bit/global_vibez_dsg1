"""
HTTP Multiplayer Cultural Games API Tests
Tests for all 10 cultural games: Ludo, Dominoes, Mancala, Backgammon, 
Chinese Checkers, Parcheesi, Mahjong, Carrom, Shogi, Xiangqi
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Cultural games to test
CULTURAL_GAMES = [
    'ludo', 'dominoes', 'mancala', 'backgammon', 
    'chinesecheckers', 'parcheesi', 'mahjong', 
    'carrom', 'shogi', 'xiangqi'
]

class TestHttpMultiplayerStats:
    """Test multiplayer stats endpoint"""
    
    def test_get_stats(self):
        """Test getting multiplayer statistics"""
        response = requests.get(f"{BASE_URL}/api/http-multiplayer/stats")
        assert response.status_code == 200
        data = response.json()
        assert 'active_games' in data
        assert 'total_games' in data
        assert 'online_players' in data
        assert 'matchmaking_queues' in data
        print(f"✅ Stats endpoint working: {data['active_games']} active games, {data['online_players']} players")


class TestCulturalGamesMatchmaking:
    """Test matchmaking for all 10 cultural games"""
    
    @pytest.mark.parametrize("game_type", CULTURAL_GAMES)
    def test_join_queue_for_cultural_game(self, game_type):
        """Test joining matchmaking queue for each cultural game"""
        player1_id = f"test_{game_type}_p1"
        player2_id = f"test_{game_type}_p2"
        
        # Player 1 joins queue
        response1 = requests.post(
            f"{BASE_URL}/api/http-multiplayer/join-queue",
            json={
                "game_type": game_type,
                "user_id": player1_id,
                "user_name": f"Player1_{game_type}"
            }
        )
        assert response1.status_code == 200
        data1 = response1.json()
        assert data1['success']
        print(f"✅ {game_type}: Player 1 joined queue")
        
        # Player 2 joins queue - should create match
        response2 = requests.post(
            f"{BASE_URL}/api/http-multiplayer/join-queue",
            json={
                "game_type": game_type,
                "user_id": player2_id,
                "user_name": f"Player2_{game_type}"
            }
        )
        assert response2.status_code == 200
        data2 = response2.json()
        assert data2['success']
        assert data2['match_found']
        assert 'game_id' in data2
        print(f"✅ {game_type}: Match found! Game ID: {data2['game_id']}")
        
        return data2['game_id']


class TestCulturalGamesInitialization:
    """Test game state initialization for all 10 cultural games"""
    
    @pytest.mark.parametrize("game_type", CULTURAL_GAMES)
    def test_game_state_initialization(self, game_type):
        """Test that each cultural game initializes with correct state"""
        player1_id = f"test_init_{game_type}_p1"
        player2_id = f"test_init_{game_type}_p2"
        
        # Create a match
        requests.post(
            f"{BASE_URL}/api/http-multiplayer/join-queue",
            json={"game_type": game_type, "user_id": player1_id, "user_name": "P1"}
        )
        response = requests.post(
            f"{BASE_URL}/api/http-multiplayer/join-queue",
            json={"game_type": game_type, "user_id": player2_id, "user_name": "P2"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data['match_found']
        game_id = data['game_id']
        
        # Get game state
        game_response = requests.get(
            f"{BASE_URL}/api/http-multiplayer/game/{game_id}?user_id={player1_id}"
        )
        assert game_response.status_code == 200
        game_data = game_response.json()
        
        # Verify common fields
        assert game_data['game_type'] == game_type
        assert game_data['status'] == 'playing'
        assert 'game_state' in game_data
        assert 'my_role' in game_data
        assert game_data['my_role'] in ['player1', 'player2']
        
        # Verify game-specific state
        game_state = game_data['game_state']
        self._verify_game_specific_state(game_type, game_state)
        print(f"✅ {game_type}: Game state initialized correctly")
    
    def _verify_game_specific_state(self, game_type, state):
        """Verify game-specific state structure"""
        if game_type == 'ludo':
            assert 'positions' in state
            assert 'red' in state['positions']
            assert 'blue' in state['positions']
            assert len(state['positions']['red']) == 4
            assert len(state['positions']['blue']) == 4
            
        elif game_type == 'dominoes':
            assert 'hands' in state
            assert 'player1' in state['hands']
            assert 'player2' in state['hands']
            assert len(state['hands']['player1']) == 7
            assert len(state['hands']['player2']) == 7
            assert 'boneyard' in state
            
        elif game_type == 'mancala':
            assert 'pits' in state
            assert 'stores' in state
            assert len(state['pits']['player1']) == 6
            assert len(state['pits']['player2']) == 6
            
        elif game_type == 'backgammon':
            assert 'board' in state
            assert 'bar' in state
            assert 'off' in state
            assert 'dice' in state
            
        elif game_type == 'chinesecheckers':
            assert 'positions' in state
            assert 'player1' in state['positions']
            assert 'player2' in state['positions']
            assert len(state['positions']['player1']) == 10
            
        elif game_type == 'parcheesi':
            assert 'positions' in state
            assert 'dice' in state
            assert 'safe_spaces' in state
            
        elif game_type == 'mahjong':
            assert 'hands' in state
            assert 'wall' in state
            assert len(state['hands']['player1']) == 13
            assert len(state['hands']['player2']) == 13
            
        elif game_type == 'carrom':
            assert 'pieces' in state
            assert 'scores' in state
            assert 'striker_position' in state
            
        elif game_type == 'shogi':
            assert 'board' in state
            assert 'captures' in state
            assert len(state['board']) == 81  # 9x9 board
            
        elif game_type == 'xiangqi':
            assert 'board' in state
            assert len(state['board']) == 90  # 9x10 board


class TestGameMoves:
    """Test making moves in cultural games"""
    
    def test_make_move_in_ludo(self):
        """Test making a move in Ludo"""
        player1_id = "test_move_ludo_p1"
        player2_id = "test_move_ludo_p2"
        
        # Create match
        requests.post(
            f"{BASE_URL}/api/http-multiplayer/join-queue",
            json={"game_type": "ludo", "user_id": player1_id, "user_name": "P1"}
        )
        response = requests.post(
            f"{BASE_URL}/api/http-multiplayer/join-queue",
            json={"game_type": "ludo", "user_id": player2_id, "user_name": "P2"}
        )
        game_id = response.json()['game_id']
        
        # Get game state to find whose turn
        game_response = requests.get(
            f"{BASE_URL}/api/http-multiplayer/game/{game_id}?user_id={player1_id}"
        )
        game_data = game_response.json()
        
        # Make a move as the current player
        current_player = player1_id if game_data['is_my_turn'] else player2_id
        
        move_response = requests.post(
            f"{BASE_URL}/api/http-multiplayer/make-move?user_id={current_player}",
            json={
                "game_id": game_id,
                "move": {"action": "roll", "value": 6},
                "new_game_state": {
                    "positions": {"red": [6, 0, 0, 0], "blue": [0, 0, 0, 0]},
                    "dice_value": 6
                }
            }
        )
        assert move_response.status_code == 200
        move_data = move_response.json()
        assert move_data['success']
        print("✅ Ludo: Move made successfully")


class TestHeartbeat:
    """Test heartbeat/session management"""
    
    def test_heartbeat(self):
        """Test heartbeat endpoint"""
        user_id = "test_heartbeat_user"
        response = requests.post(
            f"{BASE_URL}/api/http-multiplayer/heartbeat?user_id={user_id}"
        )
        assert response.status_code == 200
        data = response.json()
        assert data['success']
        assert 'session_id' in data
        print(f"✅ Heartbeat working, session: {data['session_id']}")


class TestLeaveQueue:
    """Test leaving matchmaking queue"""
    
    def test_leave_queue(self):
        """Test leaving matchmaking queue"""
        user_id = "test_leave_queue_user"
        
        # Join queue first
        requests.post(
            f"{BASE_URL}/api/http-multiplayer/join-queue",
            json={"game_type": "ludo", "user_id": user_id, "user_name": "TestUser"}
        )
        
        # Leave queue
        response = requests.post(
            f"{BASE_URL}/api/http-multiplayer/leave-queue?user_id={user_id}"
        )
        assert response.status_code == 200
        data = response.json()
        assert data['success']
        print("✅ Leave queue working")


class TestCheckMatch:
    """Test check match status endpoint"""
    
    def test_check_match_not_in_queue(self):
        """Test checking match when not in queue"""
        user_id = "test_check_match_user"
        response = requests.get(
            f"{BASE_URL}/api/http-multiplayer/check-match/{user_id}?game_type=ludo"
        )
        assert response.status_code == 200
        data = response.json()
        assert not data['match_found']
        print("✅ Check match endpoint working")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
