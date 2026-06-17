"""
Dating System Backend Tests
Tests for: Profile, Discovery, Matching, Game Invites, Chemistry APIs
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test session token - will be set by fixture
TEST_SESSION_TOKEN = None
TEST_USER_ID = None
MATCH_USER_ID = None


@pytest.fixture(scope="module")
def setup_test_users():
    """Create test users and session for dating tests"""
    import subprocess
    import re
    
    result = subprocess.run([
        'mongosh', '--quiet', '--eval', '''
use('test_database');
var userId = 'test-dating-pytest-' + Date.now();
var sessionToken = process.env.TEST_SESSION_TOKEN || 'test_dating_pytest_' + Date.now(); // Use env var or generate

// Create test user
db.users.insertOne({
  user_id: userId,
  email: 'test.dating.pytest.' + Date.now() + '@example.com',
  name: 'Test Dating Pytest User',
  picture: 'https://via.placeholder.com/150',
  created_at: new Date()
});

// Create session
db.user_sessions.insertOne({
  user_id: userId,
  session_token: sessionToken,
  expires_at: new Date(Date.now() + 7*24*60*60*1000),
  created_at: new Date()
});

// Create a second user for matching tests
var userId2 = 'test-dating-match-pytest-' + Date.now();
db.users.insertOne({
  user_id: userId2,
  email: 'test.match.pytest.' + Date.now() + '@example.com',
  name: 'Test Match Pytest User',
  picture: 'https://via.placeholder.com/150',
  created_at: new Date(),
  dating_profile: {
    bio: 'I love gaming and meeting new people! This is a test profile.',
    age: 25,
    gender: 'female',
    looking_for: 'male',
    interests: ['Gaming', 'Movies', 'Music'],
    favorite_games: ['UNO', 'Chess', 'Poker'],
    personality_traits: ['Adventurous', 'Creative', 'Funny'],
    gaming_style: 'casual',
    relationship_goals: 'serious',
    photos: [],
    is_active: true,
    updated_at: new Date().toISOString()
  }
});

print('SESSION_TOKEN=' + sessionToken);
print('USER_ID=' + userId);
print('MATCH_USER_ID=' + userId2);
'''
    ], capture_output=True, text=True)
    
    output = result.stdout
    session_token = re.search(r'SESSION_TOKEN=(\S+)', output)
    user_id = re.search(r'USER_ID=(\S+)', output)
    match_user_id = re.search(r'MATCH_USER_ID=(\S+)', output)
    
    if session_token and user_id and match_user_id:
        return {
            'session_token': session_token.group(1),
            'user_id': user_id.group(1),
            'match_user_id': match_user_id.group(1)
        }
    else:
        pytest.skip("Failed to create test users")


@pytest.fixture
def auth_headers(setup_test_users):
    """Get auth headers with session token"""
    return {
        'Authorization': f'Bearer {setup_test_users["session_token"]}',
        'Content-Type': 'application/json'
    }


class TestDatingProfileEndpoints:
    """Tests for dating profile CRUD operations"""
    
    def test_get_profile_me_unauthenticated(self):
        """Test that unauthenticated requests are rejected"""
        response = requests.get(f"{BASE_URL}/api/dating/profile/me")
        assert response.status_code == 401
        print("✅ Unauthenticated profile request rejected with 401")
    
    def test_get_profile_me_empty(self, auth_headers):
        """Test getting profile when none exists"""
        response = requests.get(
            f"{BASE_URL}/api/dating/profile/me",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data['success']
        assert not data['is_complete']
        assert data['profile'] is None
        print("✅ Empty profile returns is_complete=False")
    
    def test_update_profile_basic(self, auth_headers):
        """Test creating/updating dating profile with basic info"""
        profile_data = {
            "bio": "I love gaming and meeting new people! Test profile.",
            "age": 28,
            "gender": "male",
            "looking_for": "female",
            "location": "New York, USA",
            "interests": ["Gaming", "Movies", "Music"],
            "favorite_games": ["UNO", "Chess", "Poker"],
            "personality_traits": [],
            "gaming_style": None,
            "relationship_goals": None,
            "photos": []
        }
        
        response = requests.post(
            f"{BASE_URL}/api/dating/profile/update",
            headers=auth_headers,
            json=profile_data
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data['success']
        assert data['profile']['bio'] == profile_data['bio']
        assert data['profile']['age'] == profile_data['age']
        assert data['profile']['gender'] == profile_data['gender']
        assert data['profile']['is_active']
        print("✅ Basic profile created successfully")
    
    def test_update_profile_detailed(self, auth_headers):
        """Test updating profile with detailed fields (1b requirement)"""
        profile_data = {
            "bio": "I love gaming and meeting new people! Updated test profile.",
            "age": 28,
            "gender": "male",
            "looking_for": "female",
            "location": "New York, USA",
            "interests": ["Gaming", "Movies", "Music", "Travel"],
            "favorite_games": ["UNO", "Chess", "Poker", "Hearts"],
            "personality_traits": ["Adventurous", "Creative", "Funny", "Intelligent"],
            "gaming_style": "competitive",
            "relationship_goals": "serious",
            "photos": []
        }
        
        response = requests.post(
            f"{BASE_URL}/api/dating/profile/update",
            headers=auth_headers,
            json=profile_data
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data['success']
        assert data['profile']['personality_traits'] == profile_data['personality_traits']
        assert data['profile']['gaming_style'] == profile_data['gaming_style']
        assert data['profile']['relationship_goals'] == profile_data['relationship_goals']
        print("✅ Detailed profile with personality_traits, gaming_style, relationship_goals updated")
    
    def test_get_profile_me_after_update(self, auth_headers):
        """Test getting profile after update"""
        response = requests.get(
            f"{BASE_URL}/api/dating/profile/me",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data['success']
        assert data['is_complete']
        assert data['profile'] is not None
        assert 'bio' in data['profile']
        assert 'personality_traits' in data['profile']
        print("✅ Profile retrieved successfully after update")


class TestDatingDiscoveryEndpoints:
    """Tests for dating discovery/matching"""
    
    def test_discover_profiles(self, auth_headers, setup_test_users):
        """Test discovering potential matches"""
        response = requests.get(
            f"{BASE_URL}/api/dating/discover?limit=20",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data['success']
        assert 'profiles' in data
        assert 'count' in data
        assert isinstance(data['profiles'], list)
        print(f"✅ Discovery returned {data['count']} profiles")
    
    def test_like_profile(self, auth_headers, setup_test_users):
        """Test liking a profile"""
        match_user_id = setup_test_users['match_user_id']
        
        response = requests.post(
            f"{BASE_URL}/api/dating/like/{match_user_id}",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data['success']
        assert 'is_match' in data
        assert 'message' in data
        print(f"✅ Like sent, is_match={data['is_match']}")
    
    def test_get_matches_empty(self, auth_headers):
        """Test getting matches (may be empty initially)"""
        response = requests.get(
            f"{BASE_URL}/api/dating/matches",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data['success']
        assert 'matches' in data
        assert 'count' in data
        assert isinstance(data['matches'], list)
        print(f"✅ Matches endpoint returned {data['count']} matches")


class TestDatingGameInvites:
    """Tests for game invite system"""
    
    def test_send_game_invite(self, auth_headers, setup_test_users):
        """Test sending a game invite"""
        match_user_id = setup_test_users['match_user_id']
        
        invite_data = {
            "to_user_id": match_user_id,
            "game_type": "uno",
            "message": "Let's play UNO together! 🎮"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/dating/invite/game",
            headers=auth_headers,
            json=invite_data
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data['success']
        assert data['message'] == "Game invite sent!"
        assert 'invite' in data
        assert data['invite']['game_type'] == 'uno'
        print("✅ Game invite sent successfully")
    
    def test_get_game_invites(self, auth_headers):
        """Test getting pending game invites"""
        response = requests.get(
            f"{BASE_URL}/api/dating/invites",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data['success']
        assert 'invites' in data
        assert 'count' in data
        assert isinstance(data['invites'], list)
        print(f"✅ Invites endpoint returned {data['count']} invites")


class TestDatingChemistry:
    """Tests for chemistry scoring system"""
    
    def test_calculate_chemistry(self, auth_headers, setup_test_users):
        """Test chemistry calculation after game"""
        match_user_id = setup_test_users['match_user_id']
        
        chemistry_data = {
            "game_type": "chess",
            "partner_id": match_user_id,
            "game_data": {
                "finished_game": True,
                "close_game": True,
                "positive_interaction": True,
                "good_sportsmanship": True
            }
        }
        
        response = requests.post(
            f"{BASE_URL}/api/dating/chemistry/calculate",
            headers=auth_headers,
            json=chemistry_data
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data['success']
        assert 'chemistry_score' in data
        assert 'insights' in data
        assert isinstance(data['chemistry_score'], (int, float))
        assert data['chemistry_score'] >= 0 and data['chemistry_score'] <= 100
        print(f"✅ Chemistry calculated: {data['chemistry_score']}%")
    
    def test_get_icebreakers(self):
        """Test getting ice-breaker conversation starters"""
        game_types = ['uno', 'chess', 'poker', 'hearts', 'tictactoe']
        
        for game_type in game_types:
            response = requests.get(
                f"{BASE_URL}/api/dating/icebreakers/{game_type}"
            )
            
            assert response.status_code == 200
            data = response.json()
            assert data['success']
            assert 'icebreakers' in data
            assert isinstance(data['icebreakers'], list)
            assert len(data['icebreakers']) > 0
        
        print(f"✅ Icebreakers returned for all {len(game_types)} game types")


class TestDatingPhotoUpload:
    """Tests for dating photo upload endpoint"""
    
    def test_upload_dating_photo_unauthenticated(self):
        """Test that unauthenticated uploads are rejected"""
        # Create a simple test image
        import io
        
        # Create a minimal valid JPEG
        jpeg_data = bytes([
            0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
            0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
            0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
            0x09, 0x08, 0x0A, 0x0C, 0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12,
            0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D, 0x1A, 0x1C, 0x1C, 0x20,
            0x24, 0x2E, 0x27, 0x20, 0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29,
            0x2C, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27, 0x39, 0x3D, 0x38, 0x32,
            0x3C, 0x2E, 0x33, 0x34, 0x32, 0xFF, 0xC0, 0x00, 0x0B, 0x08, 0x00, 0x01,
            0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xFF, 0xC4, 0x00, 0x1F, 0x00, 0x00,
            0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
            0x09, 0x0A, 0x0B, 0xFF, 0xC4, 0x00, 0xB5, 0x10, 0x00, 0x02, 0x01, 0x03,
            0x03, 0x02, 0x04, 0x03, 0x05, 0x05, 0x04, 0x04, 0x00, 0x00, 0x01, 0x7D,
            0xFF, 0xDA, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3F, 0x00, 0x7F, 0xFF,
            0xD9
        ])
        
        files = {'file': ('test.jpg', io.BytesIO(jpeg_data), 'image/jpeg')}
        
        response = requests.post(
            f"{BASE_URL}/api/uploads/dating-photo",
            files=files
        )
        
        assert response.status_code == 401
        print("✅ Unauthenticated photo upload rejected with 401")
    
    def test_upload_dating_photo_authenticated(self, auth_headers, setup_test_users):
        """Test authenticated photo upload"""
        import io
        
        # Create a minimal valid JPEG
        jpeg_data = bytes([
            0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
            0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
            0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
            0x09, 0x08, 0x0A, 0x0C, 0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12,
            0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D, 0x1A, 0x1C, 0x1C, 0x20,
            0x24, 0x2E, 0x27, 0x20, 0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29,
            0x2C, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27, 0x39, 0x3D, 0x38, 0x32,
            0x3C, 0x2E, 0x33, 0x34, 0x32, 0xFF, 0xC0, 0x00, 0x0B, 0x08, 0x00, 0x01,
            0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xFF, 0xC4, 0x00, 0x1F, 0x00, 0x00,
            0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
            0x09, 0x0A, 0x0B, 0xFF, 0xC4, 0x00, 0xB5, 0x10, 0x00, 0x02, 0x01, 0x03,
            0x03, 0x02, 0x04, 0x03, 0x05, 0x05, 0x04, 0x04, 0x00, 0x00, 0x01, 0x7D,
            0xFF, 0xDA, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3F, 0x00, 0x7F, 0xFF,
            0xD9
        ])
        
        # Remove Content-Type from headers for multipart upload
        upload_headers = {'Authorization': auth_headers['Authorization']}
        files = {'file': ('test_dating.jpg', io.BytesIO(jpeg_data), 'image/jpeg')}
        
        response = requests.post(
            f"{BASE_URL}/api/uploads/dating-photo",
            headers=upload_headers,
            files=files
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data['success']
        assert 'file_url' in data
        assert 'filename' in data
        assert data['file_url'].startswith('/api/uploads/dating_photos/')
        print(f"✅ Photo uploaded successfully: {data['file_url']}")


class TestDatingMutualMatch:
    """Tests for mutual matching flow"""
    
    def test_mutual_match_creates_match_record(self, setup_test_users):
        """Test that mutual likes create a match record"""
        import subprocess
        import re
        
        # Create two users who will like each other
        result = subprocess.run([
            'mongosh', '--quiet', '--eval', '''
use('test_database');
var user1Id = 'test-mutual-1-' + Date.now();
var user2Id = 'test-mutual-2-' + Date.now();
var session1 = 'test_mutual_session_1_' + Date.now();
var session2 = 'test_mutual_session_2_' + Date.now();

// Create user 1
db.users.insertOne({
  user_id: user1Id,
  email: 'mutual1.' + Date.now() + '@example.com',
  name: 'Mutual Test User 1',
  created_at: new Date(),
  dating_profile: {
    bio: 'Test user 1',
    age: 25,
    gender: 'male',
    looking_for: 'female',
    is_active: true
  }
});

// Create user 2
db.users.insertOne({
  user_id: user2Id,
  email: 'mutual2.' + Date.now() + '@example.com',
  name: 'Mutual Test User 2',
  created_at: new Date(),
  dating_profile: {
    bio: 'Test user 2',
    age: 24,
    gender: 'female',
    looking_for: 'male',
    is_active: true
  }
});

// Create sessions
db.user_sessions.insertOne({
  user_id: user1Id,
  session_token: session1,
  expires_at: new Date(Date.now() + 7*24*60*60*1000),
  created_at: new Date()
});

db.user_sessions.insertOne({
  user_id: user2Id,
  session_token: session2,
  expires_at: new Date(Date.now() + 7*24*60*60*1000),
  created_at: new Date()
});

print('USER1_ID=' + user1Id);
print('USER2_ID=' + user2Id);
print('SESSION1=' + session1);
print('SESSION2=' + session2);
'''
        ], capture_output=True, text=True)
        
        output = result.stdout
        user1_id = re.search(r'USER1_ID=(\S+)', output).group(1)
        user2_id = re.search(r'USER2_ID=(\S+)', output).group(1)
        session1 = re.search(r'SESSION1=(\S+)', output).group(1)
        session2 = re.search(r'SESSION2=(\S+)', output).group(1)
        
        # User 1 likes User 2
        response1 = requests.post(
            f"{BASE_URL}/api/dating/like/{user2_id}",
            headers={'Authorization': f'Bearer {session1}', 'Content-Type': 'application/json'}
        )
        assert response1.status_code == 200
        data1 = response1.json()
        assert not data1['is_match']  # First like, no match yet
        
        # User 2 likes User 1 (mutual match!)
        response2 = requests.post(
            f"{BASE_URL}/api/dating/like/{user1_id}",
            headers={'Authorization': f'Bearer {session2}', 'Content-Type': 'application/json'}
        )
        assert response2.status_code == 200
        data2 = response2.json()
        assert data2['is_match']  # Mutual match!
        assert "It's a match!" in data2['message']
        
        # Verify match record was created
        response3 = requests.get(
            f"{BASE_URL}/api/dating/matches",
            headers={'Authorization': f'Bearer {session1}', 'Content-Type': 'application/json'}
        )
        assert response3.status_code == 200
        data3 = response3.json()
        assert data3['count'] >= 1
        
        print("✅ Mutual match flow works correctly")


def test_cleanup():
    """Cleanup test data after all tests"""
    import subprocess
    subprocess.run([
        'mongosh', '--quiet', '--eval', '''
use('test_database');
db.users.deleteMany({email: /test\.dating\./});
db.users.deleteMany({email: /test\.match\./});
db.users.deleteMany({email: /mutual/});
db.user_sessions.deleteMany({session_token: /test_dating/});
db.user_sessions.deleteMany({session_token: /test_mutual/});
db.dating_likes.deleteMany({from_user_id: /test-dating/});
db.dating_likes.deleteMany({from_user_id: /test-mutual/});
db.dating_matches.deleteMany({user1_id: /test-dating/});
db.dating_matches.deleteMany({user1_id: /test-mutual/});
db.game_invites.deleteMany({from_user_id: /test-dating/});
print('Test data cleaned up');
'''
    ], capture_output=True, text=True)
    print("✅ Test data cleaned up")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
