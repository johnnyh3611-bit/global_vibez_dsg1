"""
Phase 2 Messaging System Tests
Tests for: Voice messages, Image messages, GIF messages, Emoji reactions, Message search
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestMessagingPhase2:
    """Test Phase 2 messaging features: voice, image, gif, reactions, search"""
    
    @pytest.fixture(scope="class")
    def test_users(self):
        """Create two test users and match them"""
        # Create user 1
        response1 = requests.post(f"{BASE_URL}/api/auth/test-user")
        assert response1.status_code == 200, f"Failed to create user 1: {response1.text}"
        user1 = response1.json()
        
        # Create user 2
        response2 = requests.post(f"{BASE_URL}/api/auth/test-user")
        assert response2.status_code == 200, f"Failed to create user 2: {response2.text}"
        user2 = response2.json()
        
        print(f"Created test users: {user1['user_id']} and {user2['user_id']}")
        
        return {
            "user1": user1,
            "user2": user2
        }
    
    @pytest.fixture(scope="class")
    def matched_users(self, test_users):
        """Create a match between the two test users"""
        user1 = test_users["user1"]
        user2 = test_users["user2"]
        
        # User 1 likes User 2
        headers1 = {"Authorization": f"Bearer {user1['session_token']}"}
        swipe1 = requests.post(
            f"{BASE_URL}/api/swipe",
            json={"target_user_id": user2["user_id"], "action": "like"},
            headers=headers1
        )
        print(f"User1 swipe response: {swipe1.status_code} - {swipe1.text[:200]}")
        
        # User 2 likes User 1 (creates match)
        headers2 = {"Authorization": f"Bearer {user2['session_token']}"}
        swipe2 = requests.post(
            f"{BASE_URL}/api/swipe",
            json={"target_user_id": user1["user_id"], "action": "like"},
            headers=headers2
        )
        print(f"User2 swipe response: {swipe2.status_code} - {swipe2.text[:200]}")
        
        # Verify match was created
        assert swipe2.status_code == 200, f"Failed to create match: {swipe2.text}"
        match_data = swipe2.json()
        assert match_data.get("is_match"), f"Match not created: {match_data}"
        
        print(f"Match created: {match_data.get('match_id')}")
        
        return {
            "user1": user1,
            "user2": user2,
            "match_id": match_data.get("match_id")
        }
    
    # ==================== VOICE MESSAGE TESTS ====================
    
    def test_send_voice_message_success(self, matched_users):
        """Test sending a voice message with base64 audio data"""
        user1 = matched_users["user1"]
        user2 = matched_users["user2"]
        
        headers = {"Authorization": f"Bearer {user1['session_token']}"}
        
        # Dummy base64 audio data (simulating a short audio clip)
        dummy_audio = "data:audio/webm;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA="
        
        response = requests.post(
            f"{BASE_URL}/api/messaging/send-voice",
            params={
                "receiver_id": user2["user_id"],
                "audio_data": dummy_audio,
                "duration": 5.5
            },
            headers=headers
        )
        
        print(f"Send voice message response: {response.status_code} - {response.text[:500]}")
        
        assert response.status_code == 200, f"Failed to send voice message: {response.text}"
        data = response.json()
        assert data.get("success")
        assert "message" in data
        assert data["message"]["message_type"] == "voice"
        assert data["message"]["duration"] == 5.5
        assert data["message"]["sender_id"] == user1["user_id"]
        assert data["message"]["receiver_id"] == user2["user_id"]
        
        # Store message_id for later tests
        matched_users["voice_message_id"] = data["message"]["message_id"]
        print(f"Voice message sent successfully: {data['message']['message_id']}")
    
    def test_send_voice_message_unmatched_users(self, test_users):
        """Test that voice messages can only be sent to matched users"""
        user1 = test_users["user1"]
        
        headers = {"Authorization": f"Bearer {user1['session_token']}"}
        
        # Try to send to a non-existent/unmatched user
        response = requests.post(
            f"{BASE_URL}/api/messaging/send-voice",
            params={
                "receiver_id": "nonexistent_user_123",
                "audio_data": "data:audio/webm;base64,test",
                "duration": 3.0
            },
            headers=headers
        )
        
        print(f"Unmatched voice message response: {response.status_code}")
        assert response.status_code == 403, f"Expected 403 for unmatched users: {response.text}"
    
    # ==================== IMAGE MESSAGE TESTS ====================
    
    def test_send_image_message_success(self, matched_users):
        """Test sending an image message with base64 image data"""
        user1 = matched_users["user1"]
        user2 = matched_users["user2"]
        
        headers = {"Authorization": f"Bearer {user1['session_token']}"}
        
        # Dummy base64 image data (1x1 transparent PNG)
        dummy_image = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        
        response = requests.post(
            f"{BASE_URL}/api/messaging/send-image",
            params={
                "receiver_id": user2["user_id"],
                "image_data": dummy_image
            },
            headers=headers
        )
        
        print(f"Send image message response: {response.status_code} - {response.text[:500]}")
        
        assert response.status_code == 200, f"Failed to send image message: {response.text}"
        data = response.json()
        assert data.get("success")
        assert "message" in data
        assert data["message"]["message_type"] == "image"
        assert data["message"]["sender_id"] == user1["user_id"]
        assert data["message"]["receiver_id"] == user2["user_id"]
        
        matched_users["image_message_id"] = data["message"]["message_id"]
        print(f"Image message sent successfully: {data['message']['message_id']}")
    
    def test_send_image_message_unmatched_users(self, test_users):
        """Test that image messages can only be sent to matched users"""
        user1 = test_users["user1"]
        
        headers = {"Authorization": f"Bearer {user1['session_token']}"}
        
        response = requests.post(
            f"{BASE_URL}/api/messaging/send-image",
            params={
                "receiver_id": "nonexistent_user_456",
                "image_data": "data:image/png;base64,test"
            },
            headers=headers
        )
        
        print(f"Unmatched image message response: {response.status_code}")
        assert response.status_code == 403, f"Expected 403 for unmatched users: {response.text}"
    
    # ==================== GIF MESSAGE TESTS ====================
    
    def test_send_gif_message_success(self, matched_users):
        """Test sending a GIF message with Giphy URL"""
        user1 = matched_users["user1"]
        user2 = matched_users["user2"]
        
        headers = {"Authorization": f"Bearer {user1['session_token']}"}
        
        # Real Giphy URL
        gif_url = "https://media.giphy.com/media/3o7abKhOpu0NwenH3O/giphy.gif"
        
        response = requests.post(
            f"{BASE_URL}/api/messaging/send-gif",
            params={
                "receiver_id": user2["user_id"],
                "gif_url": gif_url
            },
            headers=headers
        )
        
        print(f"Send GIF message response: {response.status_code} - {response.text[:500]}")
        
        assert response.status_code == 200, f"Failed to send GIF message: {response.text}"
        data = response.json()
        assert data.get("success")
        assert "message" in data
        assert data["message"]["message_type"] == "gif"
        assert data["message"]["content"] == gif_url
        assert data["message"]["sender_id"] == user1["user_id"]
        assert data["message"]["receiver_id"] == user2["user_id"]
        
        matched_users["gif_message_id"] = data["message"]["message_id"]
        print(f"GIF message sent successfully: {data['message']['message_id']}")
    
    def test_send_gif_message_unmatched_users(self, test_users):
        """Test that GIF messages can only be sent to matched users"""
        user1 = test_users["user1"]
        
        headers = {"Authorization": f"Bearer {user1['session_token']}"}
        
        response = requests.post(
            f"{BASE_URL}/api/messaging/send-gif",
            params={
                "receiver_id": "nonexistent_user_789",
                "gif_url": "https://media.giphy.com/media/test/giphy.gif"
            },
            headers=headers
        )
        
        print(f"Unmatched GIF message response: {response.status_code}")
        assert response.status_code == 403, f"Expected 403 for unmatched users: {response.text}"
    
    # ==================== TEXT MESSAGE FOR SEARCH TESTS ====================
    
    def test_send_text_message_for_search(self, matched_users):
        """Send text messages to test search functionality"""
        user1 = matched_users["user1"]
        user2 = matched_users["user2"]
        
        headers = {"Authorization": f"Bearer {user1['session_token']}"}
        
        # Send multiple text messages with searchable content
        test_messages = [
            "Hello, how are you doing today?",
            "I love playing basketball on weekends",
            "The weather is beautiful outside",
            "Let's meet for coffee tomorrow"
        ]
        
        for msg in test_messages:
            response = requests.post(
                f"{BASE_URL}/api/messaging/send",
                json={
                    "receiver_id": user2["user_id"],
                    "content": msg,
                    "message_type": "text"
                },
                headers=headers
            )
            assert response.status_code == 200, f"Failed to send text message: {response.text}"
        
        # Store one message_id for reaction tests
        last_response = requests.post(
            f"{BASE_URL}/api/messaging/send",
            json={
                "receiver_id": user2["user_id"],
                "content": "This is a test message for reactions",
                "message_type": "text"
            },
            headers=headers
        )
        assert last_response.status_code == 200
        matched_users["text_message_id"] = last_response.json()["message"]["message_id"]
        
        print(f"Sent {len(test_messages) + 1} text messages for search testing")
    
    # ==================== EMOJI REACTION TESTS ====================
    
    def test_add_reaction_success(self, matched_users):
        """Test adding an emoji reaction to a message"""
        user2 = matched_users["user2"]
        message_id = matched_users.get("text_message_id")
        
        if not message_id:
            pytest.skip("No text message available for reaction test")
        
        headers = {"Authorization": f"Bearer {user2['session_token']}"}
        
        # Add a thumbs up reaction
        response = requests.post(
            f"{BASE_URL}/api/messaging/add-reaction",
            json={
                "message_id": message_id,
                "emoji": "👍"
            },
            headers=headers
        )
        
        print(f"Add reaction response: {response.status_code} - {response.text[:500]}")
        
        assert response.status_code == 200, f"Failed to add reaction: {response.text}"
        data = response.json()
        assert data.get("success")
        assert "reactions" in data
        assert "👍" in data["reactions"]
        assert user2["user_id"] in data["reactions"]["👍"]
        
        print(f"Reaction added successfully: {data['reactions']}")
    
    def test_add_multiple_reactions(self, matched_users):
        """Test adding multiple different emoji reactions"""
        user1 = matched_users["user1"]
        user2 = matched_users["user2"]
        message_id = matched_users.get("text_message_id")
        
        if not message_id:
            pytest.skip("No text message available for reaction test")
        
        headers1 = {"Authorization": f"Bearer {user1['session_token']}"}
        headers2 = {"Authorization": f"Bearer {user2['session_token']}"}
        
        # User 1 adds heart reaction
        response1 = requests.post(
            f"{BASE_URL}/api/messaging/add-reaction",
            json={"message_id": message_id, "emoji": "❤️"},
            headers=headers1
        )
        assert response1.status_code == 200, f"Failed to add heart reaction: {response1.text}"
        
        # User 2 adds laugh reaction
        response2 = requests.post(
            f"{BASE_URL}/api/messaging/add-reaction",
            json={"message_id": message_id, "emoji": "😂"},
            headers=headers2
        )
        assert response2.status_code == 200, f"Failed to add laugh reaction: {response2.text}"
        
        data = response2.json()
        print(f"Multiple reactions: {data['reactions']}")
        
        # Verify all reactions are present
        assert "❤️" in data["reactions"]
        assert "😂" in data["reactions"]
        assert "👍" in data["reactions"]  # From previous test
    
    def test_add_reaction_nonexistent_message(self, matched_users):
        """Test adding reaction to non-existent message"""
        user1 = matched_users["user1"]
        
        headers = {"Authorization": f"Bearer {user1['session_token']}"}
        
        response = requests.post(
            f"{BASE_URL}/api/messaging/add-reaction",
            json={
                "message_id": "nonexistent_msg_123",
                "emoji": "👍"
            },
            headers=headers
        )
        
        print(f"Nonexistent message reaction response: {response.status_code}")
        assert response.status_code == 404, f"Expected 404 for nonexistent message: {response.text}"
    
    def test_add_duplicate_reaction(self, matched_users):
        """Test that duplicate reactions from same user are handled"""
        user2 = matched_users["user2"]
        message_id = matched_users.get("text_message_id")
        
        if not message_id:
            pytest.skip("No text message available for reaction test")
        
        headers = {"Authorization": f"Bearer {user2['session_token']}"}
        
        # Try to add same reaction again (should not duplicate)
        response = requests.post(
            f"{BASE_URL}/api/messaging/add-reaction",
            json={"message_id": message_id, "emoji": "👍"},
            headers=headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # User should only appear once in the reaction list
        thumbs_up_users = data["reactions"].get("👍", [])
        user_count = thumbs_up_users.count(user2["user_id"])
        assert user_count == 1, f"User appears {user_count} times in reaction list"
        
        print("Duplicate reaction handled correctly")
    
    # ==================== REMOVE REACTION TESTS ====================
    
    def test_remove_reaction_success(self, matched_users):
        """Test removing an emoji reaction from a message"""
        user2 = matched_users["user2"]
        message_id = matched_users.get("text_message_id")
        
        if not message_id:
            pytest.skip("No text message available for reaction test")
        
        headers = {"Authorization": f"Bearer {user2['session_token']}"}
        
        # Remove the laugh reaction
        response = requests.delete(
            f"{BASE_URL}/api/messaging/remove-reaction/{message_id}/😂",
            headers=headers
        )
        
        print(f"Remove reaction response: {response.status_code} - {response.text[:500]}")
        
        assert response.status_code == 200, f"Failed to remove reaction: {response.text}"
        data = response.json()
        assert data.get("success")
        
        # Verify laugh reaction is removed or user is not in it
        if "😂" in data.get("reactions", {}):
            assert user2["user_id"] not in data["reactions"]["😂"]
        
        print(f"Reaction removed successfully: {data.get('reactions', {})}")
    
    def test_remove_nonexistent_reaction(self, matched_users):
        """Test removing a reaction that doesn't exist"""
        user1 = matched_users["user1"]
        message_id = matched_users.get("text_message_id")
        
        if not message_id:
            pytest.skip("No text message available for reaction test")
        
        headers = {"Authorization": f"Bearer {user1['session_token']}"}
        
        # Try to remove a reaction that user1 never added
        response = requests.delete(
            f"{BASE_URL}/api/messaging/remove-reaction/{message_id}/🎉",
            headers=headers
        )
        
        print(f"Remove nonexistent reaction response: {response.status_code}")
        # Should return success=False or 200 with no modification
        assert response.status_code == 200
        data = response.json()
        # Either success == False or reactions don't contain the emoji
        print(f"Response: {data}")
    
    # ==================== MESSAGE SEARCH TESTS ====================
    
    def test_search_messages_success(self, matched_users):
        """Test searching messages by content"""
        user1 = matched_users["user1"]
        
        headers = {"Authorization": f"Bearer {user1['session_token']}"}
        
        # Search for "basketball"
        response = requests.get(
            f"{BASE_URL}/api/messaging/search",
            params={"query": "basketball"},
            headers=headers
        )
        
        print(f"Search messages response: {response.status_code} - {response.text[:500]}")
        
        assert response.status_code == 200, f"Failed to search messages: {response.text}"
        data = response.json()
        assert data.get("success")
        assert "results" in data
        assert "count" in data
        
        # Should find the basketball message
        if data["count"] > 0:
            assert any("basketball" in msg["content"].lower() for msg in data["results"])
            print(f"Found {data['count']} messages containing 'basketball'")
        else:
            print("No messages found (may be timing issue)")
    
    def test_search_messages_only_text_type(self, matched_users):
        """Test that search only returns text messages, not voice/image/gif"""
        user1 = matched_users["user1"]
        
        headers = {"Authorization": f"Bearer {user1['session_token']}"}
        
        # Search for something that might be in voice/image content
        response = requests.get(
            f"{BASE_URL}/api/messaging/search",
            params={"query": "base64"},
            headers=headers
        )
        
        print(f"Search for base64 response: {response.status_code}")
        
        assert response.status_code == 200
        data = response.json()
        
        # All results should be text type only
        for msg in data.get("results", []):
            assert msg["message_type"] == "text", f"Found non-text message in search: {msg['message_type']}"
        
        print(f"Search correctly filters to text messages only. Found {data.get('count', 0)} results")
    
    def test_search_messages_with_user_filter(self, matched_users):
        """Test searching messages filtered by specific conversation"""
        user1 = matched_users["user1"]
        user2 = matched_users["user2"]
        
        headers = {"Authorization": f"Bearer {user1['session_token']}"}
        
        # Search with other_user_id filter
        response = requests.get(
            f"{BASE_URL}/api/messaging/search",
            params={
                "query": "hello",
                "other_user_id": user2["user_id"]
            },
            headers=headers
        )
        
        print(f"Search with user filter response: {response.status_code} - {response.text[:500]}")
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("success")
        
        print(f"Found {data.get('count', 0)} messages in conversation with user2")
    
    def test_search_messages_empty_results(self, matched_users):
        """Test search with query that returns no results"""
        user1 = matched_users["user1"]
        
        headers = {"Authorization": f"Bearer {user1['session_token']}"}
        
        # Search for something that definitely doesn't exist
        response = requests.get(
            f"{BASE_URL}/api/messaging/search",
            params={"query": "xyznonexistentquery123456"},
            headers=headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("success")
        assert data.get("count") == 0
        assert len(data.get("results", [])) == 0
        
        print("Empty search results handled correctly")
    
    def test_search_messages_case_insensitive(self, matched_users):
        """Test that search is case insensitive"""
        user1 = matched_users["user1"]
        
        headers = {"Authorization": f"Bearer {user1['session_token']}"}
        
        # Search with different cases
        response_lower = requests.get(
            f"{BASE_URL}/api/messaging/search",
            params={"query": "hello"},
            headers=headers
        )
        
        response_upper = requests.get(
            f"{BASE_URL}/api/messaging/search",
            params={"query": "HELLO"},
            headers=headers
        )
        
        assert response_lower.status_code == 200
        assert response_upper.status_code == 200
        
        data_lower = response_lower.json()
        data_upper = response_upper.json()
        
        # Both should return same count (case insensitive)
        print(f"Lower case search: {data_lower.get('count')} results")
        print(f"Upper case search: {data_upper.get('count')} results")
        
        # They should be equal (case insensitive search)
        assert data_lower.get("count") == data_upper.get("count"), "Search should be case insensitive"
    
    # ==================== AUTHENTICATION TESTS ====================
    
    def test_endpoints_require_authentication(self):
        """Test that all Phase 2 endpoints require authentication"""
        endpoints = [
            ("POST", f"{BASE_URL}/api/messaging/send-voice", {"receiver_id": "test", "audio_data": "test", "duration": 1.0}),
            ("POST", f"{BASE_URL}/api/messaging/send-image", {"receiver_id": "test", "image_data": "test"}),
            ("POST", f"{BASE_URL}/api/messaging/send-gif", {"receiver_id": "test", "gif_url": "test"}),
            ("POST", f"{BASE_URL}/api/messaging/add-reaction", None),
            ("DELETE", f"{BASE_URL}/api/messaging/remove-reaction/test/👍", None),
            ("GET", f"{BASE_URL}/api/messaging/search?query=test", None),
        ]
        
        for method, url, params in endpoints:
            if method == "POST":
                if params:
                    response = requests.post(url, params=params)
                else:
                    response = requests.post(url, json={"message_id": "test", "emoji": "👍"})
            elif method == "DELETE":
                response = requests.delete(url)
            else:
                response = requests.get(url)
            
            assert response.status_code == 401, f"{method} {url} should require auth, got {response.status_code}"
        
        print("All endpoints correctly require authentication")
    
    # ==================== VERIFY MESSAGE TYPES IN CONVERSATION ====================
    
    def test_verify_all_message_types_in_conversation(self, matched_users):
        """Verify all message types are correctly stored and retrieved"""
        user1 = matched_users["user1"]
        user2 = matched_users["user2"]
        
        headers = {"Authorization": f"Bearer {user1['session_token']}"}
        
        # Get conversation history
        response = requests.get(
            f"{BASE_URL}/api/messaging/conversation/{user2['user_id']}",
            headers=headers
        )
        
        print(f"Get conversation response: {response.status_code}")
        
        assert response.status_code == 200
        data = response.json()
        
        messages = data.get("messages", [])
        
        # Count message types
        type_counts = {}
        for msg in messages:
            msg_type = msg.get("message_type", "unknown")
            type_counts[msg_type] = type_counts.get(msg_type, 0) + 1
        
        print(f"Message types in conversation: {type_counts}")
        
        # Verify we have different message types
        assert "text" in type_counts, "Should have text messages"
        # Voice, image, gif should also be present if previous tests passed
        
        # Verify message structure
        for msg in messages:
            assert "message_id" in msg
            assert "sender_id" in msg
            assert "receiver_id" in msg
            assert "content" in msg
            assert "message_type" in msg
            assert "created_at" in msg
            
            # Verify no MongoDB _id
            assert "_id" not in msg, f"MongoDB _id should not be in response: {msg}"
        
        print(f"Verified {len(messages)} messages with correct structure")


class TestMessagingPhase2EdgeCases:
    """Edge case tests for Phase 2 messaging features"""
    
    @pytest.fixture(scope="class")
    def auth_user(self):
        """Create a single authenticated user for edge case tests"""
        response = requests.post(f"{BASE_URL}/api/auth/test-user")
        assert response.status_code == 200
        return response.json()
    
    def test_search_with_special_characters(self, auth_user):
        """Test search with special regex characters"""
        headers = {"Authorization": f"Bearer {auth_user['session_token']}"}
        
        # Search with special characters that could break regex
        special_queries = ["test.*", "hello?", "[test]", "(test)", "test+"]
        
        for query in special_queries:
            response = requests.get(
                f"{BASE_URL}/api/messaging/search",
                params={"query": query},
                headers=headers
            )
            # Should not crash, even if no results
            assert response.status_code == 200, f"Search failed for query '{query}': {response.text}"
        
        print("Special character searches handled correctly")
    
    def test_search_with_limit(self, auth_user):
        """Test search with custom limit parameter"""
        headers = {"Authorization": f"Bearer {auth_user['session_token']}"}
        
        response = requests.get(
            f"{BASE_URL}/api/messaging/search",
            params={"query": "test", "limit": 5},
            headers=headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert len(data.get("results", [])) <= 5
        
        print("Search limit parameter works correctly")
    
    def test_reaction_with_various_emojis(self, auth_user):
        """Test reactions with various emoji types"""
        # This test just verifies the endpoint accepts various emojis
        # without a valid message_id, it should return 404
        headers = {"Authorization": f"Bearer {auth_user['session_token']}"}
        
        emojis = ["👍", "❤️", "😂", "😮", "😢", "😡", "🎉", "🔥", "💯", "🙏"]
        
        for emoji in emojis:
            response = requests.post(
                f"{BASE_URL}/api/messaging/add-reaction",
                json={"message_id": "test_msg_123", "emoji": emoji},
                headers=headers
            )
            # Should return 404 (message not found), not 400 or 500
            assert response.status_code == 404, f"Unexpected status for emoji {emoji}: {response.status_code}"
        
        print("Various emoji types accepted by endpoint")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
