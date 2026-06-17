"""
Test Suite for Global Vibez Chat System
Tests REST APIs, WebSocket connections, and AI moderation
"""

import pytest
import requests
import asyncio
import json
import os
import websockets
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://social-connect-953.preview.emergentagent.com').rstrip('/')

class TestChatRESTAPIs:
    """Test Chat REST API endpoints"""
    
    def test_get_chat_rooms(self):
        """Test GET /api/chat/rooms - returns list of available rooms"""
        response = requests.get(f"{BASE_URL}/api/chat/rooms")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert 'rooms' in data, "Response should contain 'rooms' key"
        assert len(data['rooms']) >= 3, "Should have at least 3 default rooms"
        
        # Verify room structure
        room_ids = [r['id'] for r in data['rooms']]
        assert 'global_lobby' in room_ids, "Should have global_lobby room"
        assert 'dating_lounge' in room_ids, "Should have dating_lounge room"
        assert 'game_central' in room_ids, "Should have game_central room"
        
        # Verify room properties
        for room in data['rooms']:
            assert 'id' in room, "Room should have 'id'"
            assert 'name' in room, "Room should have 'name'"
            assert 'type' in room, "Room should have 'type'"
        
        print(f"✅ GET /api/chat/rooms - Found {len(data['rooms'])} rooms")
    
    def test_get_online_users(self):
        """Test GET /api/chat/online - returns online users count"""
        response = requests.get(f"{BASE_URL}/api/chat/online")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert 'online_users' in data, "Response should contain 'online_users'"
        assert 'count' in data, "Response should contain 'count'"
        assert isinstance(data['online_users'], list), "online_users should be a list"
        assert isinstance(data['count'], int), "count should be an integer"
        assert data['count'] >= 0, "count should be non-negative"
        
        print(f"✅ GET /api/chat/online - {data['count']} users online")
    
    def test_get_room_history_global_lobby(self):
        """Test GET /api/chat/history/global_lobby - returns message history"""
        response = requests.get(f"{BASE_URL}/api/chat/history/global_lobby")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert 'room_id' in data, "Response should contain 'room_id'"
        assert 'messages' in data, "Response should contain 'messages'"
        assert 'count' in data, "Response should contain 'count'"
        assert data['room_id'] == 'global_lobby', "room_id should match requested room"
        assert isinstance(data['messages'], list), "messages should be a list"
        
        print(f"✅ GET /api/chat/history/global_lobby - {data['count']} messages")
    
    def test_get_room_history_dating_lounge(self):
        """Test GET /api/chat/history/dating_lounge"""
        response = requests.get(f"{BASE_URL}/api/chat/history/dating_lounge")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data['room_id'] == 'dating_lounge'
        print(f"✅ GET /api/chat/history/dating_lounge - {data['count']} messages")
    
    def test_get_room_history_game_central(self):
        """Test GET /api/chat/history/game_central"""
        response = requests.get(f"{BASE_URL}/api/chat/history/game_central")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data['room_id'] == 'game_central'
        print(f"✅ GET /api/chat/history/game_central - {data['count']} messages")
    
    def test_get_room_history_with_limit(self):
        """Test GET /api/chat/history with custom limit"""
        response = requests.get(f"{BASE_URL}/api/chat/history/global_lobby?limit=10")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert len(data['messages']) <= 10, "Should respect limit parameter"
        print(f"✅ GET /api/chat/history with limit=10 - {len(data['messages'])} messages")
    
    def test_get_room_history_nonexistent_room(self):
        """Test GET /api/chat/history for non-existent room - should return empty"""
        response = requests.get(f"{BASE_URL}/api/chat/history/nonexistent_room_xyz")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data['room_id'] == 'nonexistent_room_xyz'
        assert data['count'] == 0, "Non-existent room should have 0 messages"
        print("✅ GET /api/chat/history for non-existent room - returns empty")


class TestWebSocketConnection:
    """Test WebSocket connection and messaging"""
    
    @pytest.mark.asyncio
    async def test_websocket_connection(self):
        """Test WebSocket connection establishment"""
        ws_url = BASE_URL.replace('https://', 'wss://').replace('http://', 'ws://')
        test_user_id = f"test_user_{datetime.now().timestamp()}"
        
        try:
            async with websockets.connect(
                f"{ws_url}/api/ws/chat?token={test_user_id}",
                open_timeout=10,
                close_timeout=5
            ) as ws:
                # Should receive welcome message
                response = await asyncio.wait_for(ws.recv(), timeout=5)
                data = json.loads(response)
                
                assert data['type'] == 'system', f"Expected system message, got {data['type']}"
                assert 'Welcome' in data['message'], "Should receive welcome message"
                
                print(f"✅ WebSocket connected - received: {data['message']}")
                
        except Exception as e:
            pytest.fail(f"WebSocket connection failed: {e}")
    
    @pytest.mark.asyncio
    async def test_websocket_join_room(self):
        """Test joining a room via WebSocket"""
        ws_url = BASE_URL.replace('https://', 'wss://').replace('http://', 'ws://')
        test_user_id = f"test_user_{datetime.now().timestamp()}"
        
        try:
            async with websockets.connect(
                f"{ws_url}/api/ws/chat?token={test_user_id}",
                open_timeout=10,
                close_timeout=5
            ) as ws:
                # Receive welcome message
                await asyncio.wait_for(ws.recv(), timeout=5)
                
                # Join a room
                await ws.send(json.dumps({
                    'action': 'join_room',
                    'room': 'game_central'
                }))
                
                # Should receive room history
                response = await asyncio.wait_for(ws.recv(), timeout=5)
                data = json.loads(response)
                
                assert data['type'] == 'room_history', f"Expected room_history, got {data['type']}"
                assert data['room'] == 'game_central', "Room should match"
                assert 'messages' in data, "Should contain messages array"
                
                print(f"✅ Joined room game_central - received {len(data['messages'])} history messages")
                
        except Exception as e:
            pytest.fail(f"WebSocket join room failed: {e}")
    
    @pytest.mark.asyncio
    async def test_websocket_send_message(self):
        """Test sending a message via WebSocket"""
        ws_url = BASE_URL.replace('https://', 'wss://').replace('http://', 'ws://')
        test_user_id = f"test_user_{datetime.now().timestamp()}"
        test_message = f"Test message at {datetime.now().isoformat()}"
        
        try:
            async with websockets.connect(
                f"{ws_url}/api/ws/chat?token={test_user_id}",
                open_timeout=10,
                close_timeout=5
            ) as ws:
                # Receive welcome message
                await asyncio.wait_for(ws.recv(), timeout=5)
                
                # Send a message to global_lobby (auto-joined)
                await ws.send(json.dumps({
                    'action': 'send_message',
                    'room': 'global_lobby',
                    'message': test_message
                }))
                
                # Should receive the message back (broadcast to room including sender)
                response = await asyncio.wait_for(ws.recv(), timeout=10)
                data = json.loads(response)
                
                assert data['type'] == 'message', f"Expected message, got {data['type']}"
                assert data['message'] == test_message, "Message content should match"
                assert data['room'] == 'global_lobby', "Room should match"
                assert 'sender_id' in data, "Should have sender_id"
                assert 'timestamp' in data, "Should have timestamp"
                
                print(f"✅ Sent and received message: {test_message[:30]}...")
                
        except Exception as e:
            pytest.fail(f"WebSocket send message failed: {e}")
    
    @pytest.mark.asyncio
    async def test_websocket_typing_indicator(self):
        """Test typing indicator via WebSocket"""
        ws_url = BASE_URL.replace('https://', 'wss://').replace('http://', 'ws://')
        test_user_id = f"test_user_{datetime.now().timestamp()}"
        
        try:
            async with websockets.connect(
                f"{ws_url}/api/ws/chat?token={test_user_id}",
                open_timeout=10,
                close_timeout=5
            ) as ws:
                # Receive welcome message
                await asyncio.wait_for(ws.recv(), timeout=5)
                
                # Send typing indicator
                await ws.send(json.dumps({
                    'action': 'typing',
                    'room': 'global_lobby',
                    'is_typing': True
                }))
                
                # Typing indicators are broadcast to others, not self
                # So we just verify no error occurs
                await asyncio.sleep(0.5)
                
                # Send stop typing
                await ws.send(json.dumps({
                    'action': 'typing',
                    'room': 'global_lobby',
                    'is_typing': False
                }))
                
                print("✅ Typing indicator sent successfully")
                
        except Exception as e:
            pytest.fail(f"WebSocket typing indicator failed: {e}")
    
    @pytest.mark.asyncio
    async def test_websocket_get_online_users(self):
        """Test getting online users via WebSocket"""
        ws_url = BASE_URL.replace('https://', 'wss://').replace('http://', 'ws://')
        test_user_id = f"test_user_{datetime.now().timestamp()}"
        
        try:
            async with websockets.connect(
                f"{ws_url}/api/ws/chat?token={test_user_id}",
                open_timeout=10,
                close_timeout=5
            ) as ws:
                # Receive welcome message
                await asyncio.wait_for(ws.recv(), timeout=5)
                
                # Request online users
                await ws.send(json.dumps({
                    'action': 'get_online_users'
                }))
                
                # Should receive online users list
                response = await asyncio.wait_for(ws.recv(), timeout=5)
                data = json.loads(response)
                
                assert data['type'] == 'online_users', f"Expected online_users, got {data['type']}"
                assert 'users' in data, "Should have users list"
                assert 'count' in data, "Should have count"
                assert test_user_id in data['users'], "Current user should be in online list"
                
                print(f"✅ Got online users - {data['count']} users online")
                
        except Exception as e:
            pytest.fail(f"WebSocket get online users failed: {e}")


class TestAIModeration:
    """Test AI moderation functionality"""
    
    @pytest.mark.asyncio
    async def test_appropriate_message_passes(self):
        """Test that appropriate messages pass moderation"""
        ws_url = BASE_URL.replace('https://', 'wss://').replace('http://', 'ws://')
        test_user_id = f"test_user_{datetime.now().timestamp()}"
        
        appropriate_messages = [
            "Hello everyone! How are you?",
            "Great game! GG!",
            "Anyone want to play checkers?",
            "Nice to meet you!",
            "What's your favorite game?"
        ]
        
        try:
            async with websockets.connect(
                f"{ws_url}/api/ws/chat?token={test_user_id}",
                open_timeout=10,
                close_timeout=5
            ) as ws:
                # Receive welcome message
                await asyncio.wait_for(ws.recv(), timeout=5)
                
                for msg in appropriate_messages:
                    await ws.send(json.dumps({
                        'action': 'send_message',
                        'room': 'global_lobby',
                        'message': msg
                    }))
                    
                    # Should receive the message back (not an error)
                    response = await asyncio.wait_for(ws.recv(), timeout=15)
                    data = json.loads(response)
                    
                    assert data['type'] == 'message', f"Expected message for '{msg}', got {data['type']}: {data.get('message', '')}"
                    print(f"✅ Appropriate message passed: {msg[:30]}...")
                
        except Exception as e:
            pytest.fail(f"Appropriate message test failed: {e}")
    
    @pytest.mark.asyncio
    async def test_message_persistence(self):
        """Test that messages are persisted to MongoDB"""
        ws_url = BASE_URL.replace('https://', 'wss://').replace('http://', 'ws://')
        test_user_id = f"test_user_{datetime.now().timestamp()}"
        unique_message = f"Persistence test {datetime.now().isoformat()}"
        
        try:
            # Send a message via WebSocket
            async with websockets.connect(
                f"{ws_url}/api/ws/chat?token={test_user_id}",
                open_timeout=10,
                close_timeout=5
            ) as ws:
                await asyncio.wait_for(ws.recv(), timeout=5)  # Welcome
                
                await ws.send(json.dumps({
                    'action': 'send_message',
                    'room': 'global_lobby',
                    'message': unique_message
                }))
                
                await asyncio.wait_for(ws.recv(), timeout=15)  # Message confirmation
            
            # Wait a moment for persistence
            await asyncio.sleep(1)
            
            # Verify via REST API
            response = requests.get(f"{BASE_URL}/api/chat/history/global_lobby?limit=10")
            assert response.status_code == 200
            
            data = response.json()
            messages = [m['message'] for m in data['messages'] if 'message' in m]
            
            assert unique_message in messages, f"Message should be persisted. Found: {messages}"
            print(f"✅ Message persisted to MongoDB: {unique_message[:30]}...")
            
        except Exception as e:
            pytest.fail(f"Message persistence test failed: {e}")


class TestMultiUserSync:
    """Test multi-user real-time synchronization"""
    
    @pytest.mark.asyncio
    async def test_two_users_same_room(self):
        """Test that two users in the same room receive each other's messages"""
        ws_url = BASE_URL.replace('https://', 'wss://').replace('http://', 'ws://')
        user1_id = f"test_user1_{datetime.now().timestamp()}"
        user2_id = f"test_user2_{datetime.now().timestamp()}"
        test_message = f"Multi-user test {datetime.now().isoformat()}"
        
        try:
            # Connect both users
            async with websockets.connect(
                f"{ws_url}/api/ws/chat?token={user1_id}",
                open_timeout=10,
                close_timeout=5
            ) as ws1, websockets.connect(
                f"{ws_url}/api/ws/chat?token={user2_id}",
                open_timeout=10,
                close_timeout=5
            ) as ws2:
                # Both receive welcome messages
                await asyncio.wait_for(ws1.recv(), timeout=5)
                await asyncio.wait_for(ws2.recv(), timeout=5)
                
                # Wait a moment for both connections to stabilize
                await asyncio.sleep(0.5)
                
                # Drain any pending user_joined notifications for user1
                try:
                    while True:
                        response = await asyncio.wait_for(ws1.recv(), timeout=0.5)
                        data = json.loads(response)
                        if data['type'] not in ['user_joined', 'user_left']:
                            break
                except asyncio.TimeoutError:
                    pass  # No more pending messages
                
                # User 1 sends a message
                await ws1.send(json.dumps({
                    'action': 'send_message',
                    'room': 'global_lobby',
                    'message': test_message
                }))
                
                # User 1 receives their own message (skip any user_joined)
                data1 = None
                for _ in range(5):
                    response1 = await asyncio.wait_for(ws1.recv(), timeout=15)
                    data1 = json.loads(response1)
                    if data1['type'] == 'message':
                        break
                
                assert data1 and data1['type'] == 'message', f"User1 should receive message, got {data1['type'] if data1 else 'None'}"
                
                # User 2 should also receive the message (skip any user_joined)
                data2 = None
                for _ in range(5):
                    response2 = await asyncio.wait_for(ws2.recv(), timeout=15)
                    data2 = json.loads(response2)
                    if data2['type'] == 'message':
                        break
                
                assert data2 and data2['type'] == 'message', f"User2 should receive message, got {data2['type'] if data2 else 'None'}"
                assert data2['message'] == test_message, "Message content should match"
                
                print(f"✅ Multi-user sync working - both users received: {test_message[:30]}...")
                
        except Exception as e:
            pytest.fail(f"Multi-user sync test failed: {e}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
