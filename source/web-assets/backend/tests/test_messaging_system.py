"""
Messaging System Tests
Tests: Send messages, conversations, unread counts, online status, read receipts
Requires: Two matched users to test messaging between them
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestMessagingSystem:
    """Test messaging endpoints between matched users"""
    
    @pytest.fixture(scope="class")
    def user_a(self):
        """Create first test user"""
        response = requests.post(f"{BASE_URL}/api/auth/test-user")
        assert response.status_code == 200, f"Failed to create user A: {response.text}"
        data = response.json()
        return {
            "user_id": data["user_id"],
            "session_token": data["session_token"],
            "name": data["name"]
        }
    
    @pytest.fixture(scope="class")
    def user_b(self):
        """Create second test user"""
        response = requests.post(f"{BASE_URL}/api/auth/test-user")
        assert response.status_code == 200, f"Failed to create user B: {response.text}"
        data = response.json()
        return {
            "user_id": data["user_id"],
            "session_token": data["session_token"],
            "name": data["name"]
        }
    
    @pytest.fixture(scope="class")
    def matched_users(self, user_a, user_b):
        """Create a match between user A and user B"""
        # User A likes User B
        response = requests.post(
            f"{BASE_URL}/api/swipe",
            json={"target_user_id": user_b["user_id"], "action": "like"},
            cookies={"session_token": user_a["session_token"]}
        )
        assert response.status_code == 200, f"User A swipe failed: {response.text}"
        
        # User B likes User A (creates match)
        response = requests.post(
            f"{BASE_URL}/api/swipe",
            json={"target_user_id": user_a["user_id"], "action": "like"},
            cookies={"session_token": user_b["session_token"]}
        )
        assert response.status_code == 200, f"User B swipe failed: {response.text}"
        data = response.json()
        assert data.get("is_match"), "Match was not created"
        
        return {
            "user_a": user_a,
            "user_b": user_b,
            "match_id": data.get("match_id")
        }
    
    # ==================== SEND MESSAGE TESTS ====================
    
    def test_send_message_success(self, matched_users):
        """Test sending a message between matched users"""
        user_a = matched_users["user_a"]
        user_b = matched_users["user_b"]
        
        response = requests.post(
            f"{BASE_URL}/api/messaging/send",
            json={
                "receiver_id": user_b["user_id"],
                "content": "Hello from User A!",
                "message_type": "text"
            },
            cookies={"session_token": user_a["session_token"]}
        )
        
        assert response.status_code == 200, f"Send message failed: {response.text}"
        data = response.json()
        assert data.get("success")
        assert "message" in data
        assert data["message"]["content"] == "Hello from User A!"
        assert data["message"]["sender_id"] == user_a["user_id"]
        assert data["message"]["receiver_id"] == user_b["user_id"]
        assert not data["message"]["read"]
        print(f"✅ Message sent successfully: {data['message']['message_id']}")
    
    def test_send_message_to_unmatched_user_fails(self, user_a):
        """Test that sending message to unmatched user fails"""
        response = requests.post(
            f"{BASE_URL}/api/messaging/send",
            json={
                "receiver_id": "nonexistent_user_123",
                "content": "This should fail",
                "message_type": "text"
            },
            cookies={"session_token": user_a["session_token"]}
        )
        
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print("✅ Correctly rejected message to unmatched user")
    
    def test_send_message_unauthenticated_fails(self):
        """Test that unauthenticated user cannot send messages"""
        response = requests.post(
            f"{BASE_URL}/api/messaging/send",
            json={
                "receiver_id": "some_user",
                "content": "Test",
                "message_type": "text"
            }
        )
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✅ Correctly rejected unauthenticated message")
    
    # ==================== CONVERSATION TESTS ====================
    
    def test_get_conversations_list(self, matched_users):
        """Test getting list of conversations"""
        user_b = matched_users["user_b"]
        
        response = requests.get(
            f"{BASE_URL}/api/messaging/conversations",
            cookies={"session_token": user_b["session_token"]}
        )
        
        assert response.status_code == 200, f"Get conversations failed: {response.text}"
        data = response.json()
        assert "conversations" in data
        assert len(data["conversations"]) >= 1, "Should have at least 1 conversation"
        
        # Check conversation structure
        conv = data["conversations"][0]
        assert "match_id" in conv
        assert "other_user" in conv
        assert "last_message" in conv
        assert "unread_count" in conv
        print(f"✅ Found {len(data['conversations'])} conversation(s)")
    
    def test_get_conversation_history(self, matched_users):
        """Test getting conversation history between two users"""
        user_a = matched_users["user_a"]
        user_b = matched_users["user_b"]
        
        response = requests.get(
            f"{BASE_URL}/api/messaging/conversation/{user_a['user_id']}",
            cookies={"session_token": user_b["session_token"]}
        )
        
        assert response.status_code == 200, f"Get conversation failed: {response.text}"
        data = response.json()
        assert "messages" in data
        assert len(data["messages"]) >= 1, "Should have at least 1 message"
        
        # Check message structure
        msg = data["messages"][0]
        assert "message_id" in msg
        assert "content" in msg
        assert "sender_id" in msg
        assert "receiver_id" in msg
        assert "created_at" in msg
        print(f"✅ Found {len(data['messages'])} message(s) in conversation")
    
    def test_get_conversation_with_unmatched_user(self, user_a):
        """Test getting conversation with unmatched user returns empty"""
        response = requests.get(
            f"{BASE_URL}/api/messaging/conversation/nonexistent_user_123",
            cookies={"session_token": user_a["session_token"]}
        )
        
        # Should return empty conversation, not error
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert data.get("messages") == []
        print("✅ Correctly returned empty conversation for unmatched user")
    
    # ==================== UNREAD COUNT TESTS ====================
    
    def test_unread_count(self, matched_users):
        """Test getting unread message count"""
        user_b = matched_users["user_b"]
        
        response = requests.get(
            f"{BASE_URL}/api/messaging/unread-count",
            cookies={"session_token": user_b["session_token"]}
        )
        
        assert response.status_code == 200, f"Get unread count failed: {response.text}"
        data = response.json()
        assert "unread_count" in data
        assert isinstance(data["unread_count"], int)
        print(f"✅ Unread count: {data['unread_count']}")
    
    def test_unread_count_decreases_after_reading(self, matched_users):
        """Test that unread count decreases after viewing conversation"""
        user_a = matched_users["user_a"]
        user_b = matched_users["user_b"]
        
        # Send a new message from A to B
        requests.post(
            f"{BASE_URL}/api/messaging/send",
            json={
                "receiver_id": user_b["user_id"],
                "content": "New unread message",
                "message_type": "text"
            },
            cookies={"session_token": user_a["session_token"]}
        )
        
        # Get unread count before reading
        response = requests.get(
            f"{BASE_URL}/api/messaging/unread-count",
            cookies={"session_token": user_b["session_token"]}
        )
        unread_before = response.json()["unread_count"]
        
        # Read the conversation (marks messages as read)
        requests.get(
            f"{BASE_URL}/api/messaging/conversation/{user_a['user_id']}",
            cookies={"session_token": user_b["session_token"]}
        )
        
        # Get unread count after reading
        response = requests.get(
            f"{BASE_URL}/api/messaging/unread-count",
            cookies={"session_token": user_b["session_token"]}
        )
        unread_after = response.json()["unread_count"]
        
        assert unread_after < unread_before, f"Unread count should decrease: {unread_before} -> {unread_after}"
        print(f"✅ Unread count decreased from {unread_before} to {unread_after}")
    
    # ==================== ONLINE STATUS TESTS ====================
    
    def test_set_online_status(self, user_a):
        """Test setting user online status"""
        response = requests.post(
            f"{BASE_URL}/api/messaging/status/online",
            cookies={"session_token": user_a["session_token"]}
        )
        
        assert response.status_code == 200, f"Set online failed: {response.text}"
        data = response.json()
        assert data.get("success")
        assert data.get("status") == "online"
        print("✅ User set to online")
    
    def test_set_offline_status(self, user_a):
        """Test setting user offline status"""
        response = requests.post(
            f"{BASE_URL}/api/messaging/status/offline",
            cookies={"session_token": user_a["session_token"]}
        )
        
        assert response.status_code == 200, f"Set offline failed: {response.text}"
        data = response.json()
        assert data.get("success")
        assert data.get("status") == "offline"
        print("✅ User set to offline")
    
    def test_get_user_status(self, matched_users):
        """Test getting another user's online status"""
        user_a = matched_users["user_a"]
        user_b = matched_users["user_b"]
        
        # First set user A online
        requests.post(
            f"{BASE_URL}/api/messaging/status/online",
            cookies={"session_token": user_a["session_token"]}
        )
        
        # Get user A's status from user B's perspective
        response = requests.get(
            f"{BASE_URL}/api/messaging/status/{user_a['user_id']}",
            cookies={"session_token": user_b["session_token"]}
        )
        
        assert response.status_code == 200, f"Get status failed: {response.text}"
        data = response.json()
        assert "user_id" in data
        assert "online" in data
        assert "last_seen" in data
        assert data["online"]
        print(f"✅ User status: online={data['online']}, last_seen={data['last_seen']}")
    
    def test_get_nonexistent_user_status(self, user_a):
        """Test getting status of nonexistent user"""
        response = requests.get(
            f"{BASE_URL}/api/messaging/status/nonexistent_user_123",
            cookies={"session_token": user_a["session_token"]}
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✅ Correctly returned 404 for nonexistent user status")
    
    # ==================== READ RECEIPTS TESTS ====================
    
    def test_read_receipts_flow(self, matched_users):
        """Test that messages are marked as read when conversation is viewed"""
        user_a = matched_users["user_a"]
        user_b = matched_users["user_b"]
        
        # Send message from A to B
        send_response = requests.post(
            f"{BASE_URL}/api/messaging/send",
            json={
                "receiver_id": user_b["user_id"],
                "content": "Test read receipt message",
                "message_type": "text"
            },
            cookies={"session_token": user_a["session_token"]}
        )
        assert send_response.status_code == 200
        message_id = send_response.json()["message"]["message_id"]
        
        # Verify message is unread initially
        conv_response = requests.get(
            f"{BASE_URL}/api/messaging/conversation/{user_a['user_id']}",
            cookies={"session_token": user_b["session_token"]}
        )
        assert conv_response.status_code == 200
        
        # After viewing, messages should be marked as read
        # Check from sender's perspective
        conv_response_a = requests.get(
            f"{BASE_URL}/api/messaging/conversation/{user_b['user_id']}",
            cookies={"session_token": user_a["session_token"]}
        )
        messages = conv_response_a.json()["messages"]
        
        # Find our test message
        test_msg = next((m for m in messages if m["message_id"] == message_id), None)
        assert test_msg is not None, "Test message not found"
        assert test_msg["read"], "Message should be marked as read"
        print("✅ Read receipt working - message marked as read after viewing")
    
    # ==================== MARK AS READ TESTS ====================
    
    def test_mark_messages_as_read(self, matched_users):
        """Test manually marking messages as read"""
        user_a = matched_users["user_a"]
        user_b = matched_users["user_b"]
        
        # Send a message
        send_response = requests.post(
            f"{BASE_URL}/api/messaging/send",
            json={
                "receiver_id": user_b["user_id"],
                "content": "Mark this as read",
                "message_type": "text"
            },
            cookies={"session_token": user_a["session_token"]}
        )
        message_id = send_response.json()["message"]["message_id"]
        
        # Mark as read
        response = requests.post(
            f"{BASE_URL}/api/messaging/mark-read",
            json={"message_ids": [message_id]},
            cookies={"session_token": user_b["session_token"]}
        )
        
        assert response.status_code == 200, f"Mark read failed: {response.text}"
        data = response.json()
        assert data.get("success")
        print(f"✅ Marked {data.get('updated_count', 0)} message(s) as read")
    
    # ==================== DELETE MESSAGE TESTS ====================
    
    def test_delete_own_message(self, matched_users):
        """Test deleting own message"""
        user_a = matched_users["user_a"]
        user_b = matched_users["user_b"]
        
        # Send a message
        send_response = requests.post(
            f"{BASE_URL}/api/messaging/send",
            json={
                "receiver_id": user_b["user_id"],
                "content": "Delete this message",
                "message_type": "text"
            },
            cookies={"session_token": user_a["session_token"]}
        )
        message_id = send_response.json()["message"]["message_id"]
        
        # Delete the message
        response = requests.delete(
            f"{BASE_URL}/api/messaging/message/{message_id}",
            cookies={"session_token": user_a["session_token"]}
        )
        
        assert response.status_code == 200, f"Delete failed: {response.text}"
        data = response.json()
        assert data.get("success")
        print("✅ Message deleted successfully")
    
    def test_cannot_delete_others_message(self, matched_users):
        """Test that user cannot delete another user's message"""
        user_a = matched_users["user_a"]
        user_b = matched_users["user_b"]
        
        # Send a message from A
        send_response = requests.post(
            f"{BASE_URL}/api/messaging/send",
            json={
                "receiver_id": user_b["user_id"],
                "content": "Cannot delete this",
                "message_type": "text"
            },
            cookies={"session_token": user_a["session_token"]}
        )
        message_id = send_response.json()["message"]["message_id"]
        
        # Try to delete from B's account
        response = requests.delete(
            f"{BASE_URL}/api/messaging/message/{message_id}",
            cookies={"session_token": user_b["session_token"]}
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✅ Correctly prevented deletion of other user's message")
    
    # ==================== MULTIPLE MESSAGES TEST ====================
    
    def test_multiple_messages_order(self, matched_users):
        """Test that multiple messages are returned in correct order"""
        user_a = matched_users["user_a"]
        user_b = matched_users["user_b"]
        
        # Send multiple messages
        for i in range(3):
            requests.post(
                f"{BASE_URL}/api/messaging/send",
                json={
                    "receiver_id": user_b["user_id"],
                    "content": f"Message {i+1}",
                    "message_type": "text"
                },
                cookies={"session_token": user_a["session_token"]}
            )
            time.sleep(0.1)  # Small delay to ensure order
        
        # Get conversation
        response = requests.get(
            f"{BASE_URL}/api/messaging/conversation/{user_a['user_id']}",
            cookies={"session_token": user_b["session_token"]}
        )
        
        messages = response.json()["messages"]
        assert len(messages) >= 3, "Should have at least 3 messages"
        
        # Verify messages are in chronological order
        timestamps = [m["created_at"] for m in messages]
        assert timestamps == sorted(timestamps), "Messages should be in chronological order"
        print(f"✅ {len(messages)} messages returned in correct chronological order")


class TestMessagingEdgeCases:
    """Edge case tests for messaging system"""
    
    @pytest.fixture(scope="class")
    def test_user(self):
        """Create a test user"""
        response = requests.post(f"{BASE_URL}/api/auth/test-user")
        assert response.status_code == 200
        return response.json()
    
    def test_empty_conversations_list(self, test_user):
        """Test getting conversations when user has no matches"""
        response = requests.get(
            f"{BASE_URL}/api/messaging/conversations",
            cookies={"session_token": test_user["session_token"]}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("conversations") == []
        print("✅ Empty conversations list returned correctly")
    
    def test_unread_count_zero_for_new_user(self, test_user):
        """Test unread count == 0 for new user"""
        response = requests.get(
            f"{BASE_URL}/api/messaging/unread-count",
            cookies={"session_token": test_user["session_token"]}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["unread_count"] == 0
        print("✅ Unread count == 0 for new user")
    
    def test_send_empty_message_fails(self, test_user):
        """Test that sending empty message fails validation"""
        response = requests.post(
            f"{BASE_URL}/api/messaging/send",
            json={
                "receiver_id": "some_user",
                "content": "",
                "message_type": "text"
            },
            cookies={"session_token": test_user["session_token"]}
        )
        
        # Should fail - either 403 (not matched) or 422 (validation)
        assert response.status_code in [403, 422], f"Expected 403 or 422, got {response.status_code}"
        print("✅ Empty message correctly rejected")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
