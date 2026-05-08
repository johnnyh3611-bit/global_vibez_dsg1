"""
Test WebRTC Video Chat Feature
"""
from fastapi.testclient import TestClient
from server import app

client = TestClient(app)

def test_create_video_room():
    """Test creating a video chat room"""
    response = client.post("/api/video-chat/create-room", 
                          json={"game_type": "spades"})
    assert response.status_code == 200
    
    data = response.json()
    assert data["success"]
    assert "room_id" in data
    assert "signaling_url" in data
    assert data["room_id"].startswith("room_")

def test_get_active_rooms():
    """Test fetching active video chat rooms"""
    # Create a room first
    create_response = client.post("/api/video-chat/create-room",
                                 json={"game_type": "poker"})
    room_id = create_response.json()["room_id"]
    
    # Get rooms
    response = client.get("/api/video-chat/rooms")
    assert response.status_code == 200
    
    data = response.json()
    assert data["success"]
    assert len(data["rooms"]) > 0

def test_get_room_info():
    """Test getting specific room information"""
    # Create a room
    create_response = client.post("/api/video-chat/create-room",
                                 json={"game_type": "dating"})
    room_id = create_response.json()["room_id"]
    
    # Get room info
    response = client.get(f"/api/video-chat/room/{room_id}")
    assert response.status_code == 200
    
    data = response.json()
    assert data["success"]
    assert data["room"]["room_id"] == room_id
    assert data["room"]["game_type"] == "dating"
    assert data["room"]["participant_count"] == 0

def test_get_nonexistent_room():
    """Test getting info for non-existent room"""
    response = client.get("/api/video-chat/room/fake_room_123")
    assert response.status_code == 404

def test_websocket_signaling():
    """Test WebSocket signaling connection"""
    # Create a room
    create_response = client.post("/api/video-chat/create-room")
    room_id = create_response.json()["room_id"]
    
    # Connect to WebSocket (basic connection test)
    with client.websocket_connect(f"/api/ws/video-chat/{room_id}") as websocket:
        # Send join message
        websocket.send_json({
            "type": "join",
            "user_id": "test_user_123",
            "username": "TestUser"
        })
        
        # Receive joined confirmation
        response = websocket.receive_json()
        assert response["type"] == "joined"
        assert response["room_id"] == room_id
        assert "test_user_123" in response["participants"]
