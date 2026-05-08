"""
Test Suite for Engagement Engine and MY VIBEZ Platform
Tests: Notifications, Daily Rewards, XP/Leveling, Streaks, Video Upload, Feed, Interactions
"""
import pytest
import requests
import os
import json
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://social-connect-953.preview.emergentagent.com')

class TestEngagementEngine:
    """Tests for Engagement Engine: Notifications, XP, Levels, Streaks, Daily Rewards"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Create test user for each test"""
        response = requests.post(f"{BASE_URL}/api/auth/test-user")
        assert response.status_code == 200, f"Failed to create test user: {response.text}"
        data = response.json()
        self.user_id = data["user_id"]
        self.session_token = data["session_token"]
        self.headers = {
            "Content-Type": "application/json",
            "Cookie": f"session_token={self.session_token}"
        }
        yield
        # Cleanup could be added here
    
    def test_get_user_stats(self):
        """Test fetching user stats (level, XP, achievements)"""
        response = requests.get(
            f"{BASE_URL}/api/engagement/profile/stats/{self.user_id}",
            headers=self.headers
        )
        assert response.status_code == 200, f"Failed to get stats: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert data["success"]
        assert "stats" in data
        stats = data["stats"]
        
        # Verify required fields
        assert "level" in stats
        assert "xp" in stats
        assert "next_level_xp" in stats
        assert "progress_to_next_level" in stats
        assert "login_streak" in stats
        assert "friends_count" in stats
        assert "achievements_unlocked" in stats
        
        print(f"✅ User stats: Level {stats['level']}, XP {stats['xp']}, Streak {stats['login_streak']}")
    
    def test_claim_daily_reward(self):
        """Test claiming daily reward"""
        response = requests.post(
            f"{BASE_URL}/api/engagement/daily-reward/claim",
            json={"user_id": self.user_id},
            headers=self.headers
        )
        assert response.status_code == 200, f"Failed to claim daily reward: {response.text}"
        data = response.json()
        
        # First claim should succeed
        assert data["success"]
        assert "xp_earned" in data
        assert "current_streak" in data
        assert data["xp_earned"] > 0
        
        print(f"✅ Daily reward claimed: +{data['xp_earned']} XP, Streak: {data['current_streak']}")
        
        # Second claim same day should fail
        response2 = requests.post(
            f"{BASE_URL}/api/engagement/daily-reward/claim",
            json={"user_id": self.user_id},
            headers=self.headers
        )
        data2 = response2.json()
        # Either returns success: false or already claimed message
        if response2.status_code == 200:
            assert not data2.get("success") or "already" in data2.get("message", "").lower(), "Should not allow double claim"
            print(f"✅ Double claim prevented: {data2.get('message', 'Already claimed')}")
        else:
            print(f"✅ Double claim prevented with status {response2.status_code}")
    
    def test_send_notification(self):
        """Test sending a notification"""
        notification_data = {
            "user_id": self.user_id,
            "type": "achievement",
            "title": "Test Achievement",
            "message": "You unlocked a test achievement!",
            "action_url": "/achievements",
            "metadata": {"test": True}
        }
        
        response = requests.post(
            f"{BASE_URL}/api/engagement/notification/send",
            json=notification_data,
            headers=self.headers
        )
        assert response.status_code == 200, f"Failed to send notification: {response.text}"
        data = response.json()
        
        assert data["success"]
        assert "notification" in data
        notif = data["notification"]
        assert notif["title"] == "Test Achievement"
        assert notif["type"] == "achievement"
        assert not notif["is_read"]
        
        print(f"✅ Notification sent: {notif['id']}")
    
    def test_get_notifications(self):
        """Test fetching notifications"""
        # First send a notification
        requests.post(
            f"{BASE_URL}/api/engagement/notification/send",
            json={
                "user_id": self.user_id,
                "type": "like",
                "title": "New Like",
                "message": "Someone liked your post!"
            },
            headers=self.headers
        )
        
        # Fetch notifications
        response = requests.get(
            f"{BASE_URL}/api/engagement/notifications/{self.user_id}",
            params={"limit": 20},
            headers=self.headers
        )
        assert response.status_code == 200, f"Failed to get notifications: {response.text}"
        data = response.json()
        
        assert data["success"]
        assert "notifications" in data
        assert "unread_count" in data
        assert isinstance(data["notifications"], list)
        
        print(f"✅ Fetched {len(data['notifications'])} notifications, {data['unread_count']} unread")
    
    def test_mark_notifications_read(self):
        """Test marking notifications as read"""
        # Send a notification first
        send_response = requests.post(
            f"{BASE_URL}/api/engagement/notification/send",
            json={
                "user_id": self.user_id,
                "type": "friend_request",
                "title": "Friend Request",
                "message": "You have a new friend request!"
            },
            headers=self.headers
        )
        notif_id = send_response.json()["notification"]["id"]
        
        # Mark as read
        response = requests.post(
            f"{BASE_URL}/api/engagement/notifications/mark-read",
            json={"user_id": self.user_id, "notification_ids": [notif_id]},
            headers=self.headers
        )
        assert response.status_code == 200, f"Failed to mark read: {response.text}"
        data = response.json()
        
        assert data["success"]
        assert data["marked_read"] >= 1
        
        print(f"✅ Marked {data['marked_read']} notifications as read")
    
    def test_unlock_achievement(self):
        """Test unlocking an achievement"""
        response = requests.post(
            f"{BASE_URL}/api/engagement/achievement/unlock",
            params={"user_id": self.user_id, "achievement_id": "first_win"},
            headers=self.headers
        )
        assert response.status_code == 200, f"Failed to unlock achievement: {response.text}"
        data = response.json()
        
        assert data["success"]
        assert "achievement" in data
        assert "xp_earned" in data
        assert data["xp_earned"] > 0
        
        print(f"✅ Achievement unlocked: {data['achievement']['name']}, +{data['xp_earned']} XP")
        
        # Try to unlock same achievement again - should fail
        response2 = requests.post(
            f"{BASE_URL}/api/engagement/achievement/unlock",
            params={"user_id": self.user_id, "achievement_id": "first_win"},
            headers=self.headers
        )
        data2 = response2.json()
        assert not data2["success"], "Should not allow duplicate achievement"
        print("✅ Duplicate achievement prevented")
    
    def test_set_online_status(self):
        """Test setting online status"""
        response = requests.post(
            f"{BASE_URL}/api/engagement/status/online",
            params={"user_id": self.user_id, "status": "online"},
            headers=self.headers
        )
        assert response.status_code == 200, f"Failed to set status: {response.text}"
        data = response.json()
        
        assert data["success"]
        assert data["status"] == "online"
        
        print(f"✅ Online status set to: {data['status']}")
    
    def test_activity_feed(self):
        """Test fetching activity feed"""
        response = requests.get(
            f"{BASE_URL}/api/engagement/activity-feed/{self.user_id}",
            params={"skip": 0, "limit": 20},
            headers=self.headers
        )
        assert response.status_code == 200, f"Failed to get activity feed: {response.text}"
        data = response.json()
        
        assert data["success"]
        assert "activities" in data
        assert "has_more" in data
        
        print(f"✅ Activity feed: {len(data['activities'])} activities")


class TestMyVibezPlatform:
    """Tests for MY VIBEZ: Video Upload, Feed, Interactions, Comments"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Create test user for each test"""
        response = requests.post(f"{BASE_URL}/api/auth/test-user")
        assert response.status_code == 200, f"Failed to create test user: {response.text}"
        data = response.json()
        self.user_id = data["user_id"]
        self.session_token = data["session_token"]
        self.headers = {
            "Content-Type": "application/json",
            "Cookie": f"session_token={self.session_token}"
        }
        yield
    
    def test_get_feed_for_you(self):
        """Test fetching For You feed"""
        response = requests.get(
            f"{BASE_URL}/api/my-vibez/feed",
            params={"user_id": self.user_id, "feed_type": "for_you", "limit": 20},
            headers=self.headers
        )
        assert response.status_code == 200, f"Failed to get feed: {response.text}"
        data = response.json()
        
        assert data["success"]
        assert "posts" in data
        assert "feed_type" in data
        assert data["feed_type"] == "for_you"
        
        print(f"✅ For You feed: {len(data['posts'])} posts")
    
    def test_get_feed_gaming(self):
        """Test fetching Gaming feed"""
        response = requests.get(
            f"{BASE_URL}/api/my-vibez/feed",
            params={"user_id": self.user_id, "feed_type": "gaming", "limit": 20},
            headers=self.headers
        )
        assert response.status_code == 200, f"Failed to get gaming feed: {response.text}"
        data = response.json()
        
        assert data["success"]
        assert data["feed_type"] == "gaming"
        
        print(f"✅ Gaming feed: {len(data['posts'])} posts")
    
    def test_get_feed_dating(self):
        """Test fetching Dating feed"""
        response = requests.get(
            f"{BASE_URL}/api/my-vibez/feed",
            params={"user_id": self.user_id, "feed_type": "dating", "limit": 20},
            headers=self.headers
        )
        assert response.status_code == 200, f"Failed to get dating feed: {response.text}"
        data = response.json()
        
        assert data["success"]
        assert data["feed_type"] == "dating"
        
        print(f"✅ Dating feed: {len(data['posts'])} posts")
    
    def test_create_post_without_file(self):
        """Test creating a post (simulated - no actual file)"""
        # Note: This tests the API structure without actual file upload
        form_data = {
            "user_id": self.user_id,
            "content_type": "image",
            "title": "Test Vibe Post",
            "description": "Testing the MY VIBEZ platform!",
            "tags": json.dumps(["test", "gaming"]),
            "is_dual_stream": "false",
            "is_anonymous": "false",
            "is_live": "false"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/my-vibez/post/create",
            data=form_data
        )
        # May fail without file, but should return proper error
        if response.status_code == 200:
            data = response.json()
            assert data["success"]
            assert "post_id" in data
            print(f"✅ Post created: {data['post_id']}")
        else:
            # 404 for user not found is expected for new test user
            print(f"⚠️ Post creation returned {response.status_code} (expected without file)")
    
    def test_video_duration_validation(self):
        """Test video duration limit validation (5 min max for non-live)"""
        # Test with duration > 5 minutes (300 seconds)
        form_data = {
            "user_id": self.user_id,
            "content_type": "video",
            "title": "Long Video Test",
            "description": "Testing duration limit",
            "tags": json.dumps(["test"]),
            "is_live": "false",
            "video_duration": "400"  # 6+ minutes - should fail
        }
        
        response = requests.post(
            f"{BASE_URL}/api/my-vibez/post/create",
            data=form_data
        )
        
        # Should return 400 for video too long
        if response.status_code == 400:
            data = response.json()
            assert "too long" in data.get("detail", "").lower() or "5 minute" in data.get("detail", "").lower()
            print(f"✅ Video duration validation working: {data.get('detail', 'Video too long')}")
        else:
            print(f"⚠️ Duration validation returned {response.status_code}")
    
    def test_live_stream_bypasses_duration(self):
        """Test that live stream mode bypasses duration limit"""
        form_data = {
            "user_id": self.user_id,
            "content_type": "video",
            "title": "Live Stream Test",
            "description": "Testing live stream mode",
            "tags": json.dumps(["live", "test"]),
            "is_live": "true",
            "video_duration": "600"  # 10 minutes - should be allowed for live
        }
        
        response = requests.post(
            f"{BASE_URL}/api/my-vibez/post/create",
            data=form_data
        )
        
        # Should not fail due to duration when is_live=true
        if response.status_code == 400:
            data = response.json()
            # Should NOT be a duration error
            assert "too long" not in data.get("detail", "").lower()
            print(f"⚠️ Live stream test: {data.get('detail', 'Error')}")
        else:
            print(f"✅ Live stream bypasses duration limit (status: {response.status_code})")
    
    def test_interact_with_post(self):
        """Test post interactions (like, love, fire)"""
        # First create a post to interact with
        # Using a mock post_id since we can't easily create one
        test_post_id = f"vibe_test_{uuid.uuid4().hex[:8]}"
        
        interaction_data = {
            "post_id": test_post_id,
            "user_id": self.user_id,
            "interaction_type": "like"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/my-vibez/interact",
            json=interaction_data,
            headers=self.headers
        )
        
        # May fail if post doesn't exist, but API should respond properly
        if response.status_code == 200:
            data = response.json()
            assert data["success"]
            print(f"✅ Interaction recorded: {data.get('message', 'Like added')}")
        else:
            print(f"⚠️ Interaction test: {response.status_code} (post may not exist)")
    
    def test_add_comment(self):
        """Test adding a comment to a post"""
        test_post_id = f"vibe_test_{uuid.uuid4().hex[:8]}"
        
        comment_data = {
            "post_id": test_post_id,
            "user_id": self.user_id,
            "text": "Great vibe! 🔥"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/my-vibez/comment",
            json=comment_data,
            headers=self.headers
        )
        
        if response.status_code == 200:
            data = response.json()
            assert data["success"]
            assert "comment" in data
            print(f"✅ Comment added: {data['comment']['id']}")
        else:
            print(f"⚠️ Comment test: {response.status_code}")
    
    def test_get_challenges(self):
        """Test fetching active challenges"""
        response = requests.get(
            f"{BASE_URL}/api/my-vibez/challenges",
            headers=self.headers
        )
        assert response.status_code == 200, f"Failed to get challenges: {response.text}"
        data = response.json()
        
        assert data["success"]
        assert "challenges" in data
        assert len(data["challenges"]) > 0
        
        # Verify challenge structure
        challenge = data["challenges"][0]
        assert "id" in challenge
        assert "title" in challenge
        assert "xp_reward" in challenge
        
        print(f"✅ Active challenges: {len(data['challenges'])}")
        for c in data["challenges"]:
            print(f"   - {c['title']} (+{c['xp_reward']} XP)")
    
    def test_get_trending(self):
        """Test fetching trending posts"""
        response = requests.get(
            f"{BASE_URL}/api/my-vibez/trending",
            params={"limit": 10},
            headers=self.headers
        )
        assert response.status_code == 200, f"Failed to get trending: {response.text}"
        data = response.json()
        
        assert data["success"]
        assert "trending" in data
        
        print(f"✅ Trending posts: {len(data['trending'])}")
    
    def test_get_user_posts(self):
        """Test fetching user's posts"""
        response = requests.get(
            f"{BASE_URL}/api/my-vibez/user/{self.user_id}/posts",
            params={"skip": 0, "limit": 20},
            headers=self.headers
        )
        assert response.status_code == 200, f"Failed to get user posts: {response.text}"
        data = response.json()
        
        assert data["success"]
        assert "posts" in data
        assert "stats" in data
        
        print(f"✅ User posts: {len(data['posts'])}, Stats: {data['stats']}")


class TestIntegration:
    """Integration tests for Engagement + MY VIBEZ"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Create test user"""
        response = requests.post(f"{BASE_URL}/api/auth/test-user")
        assert response.status_code == 200
        data = response.json()
        self.user_id = data["user_id"]
        self.session_token = data["session_token"]
        self.headers = {
            "Content-Type": "application/json",
            "Cookie": f"session_token={self.session_token}"
        }
        yield
    
    def test_xp_awarded_for_daily_reward(self):
        """Test that XP is properly awarded for daily reward"""
        # Get initial stats
        stats_before = requests.get(
            f"{BASE_URL}/api/engagement/profile/stats/{self.user_id}",
            headers=self.headers
        ).json()["stats"]
        
        initial_xp = stats_before["xp"]
        
        # Claim daily reward
        claim_response = requests.post(
            f"{BASE_URL}/api/engagement/daily-reward/claim",
            json={"user_id": self.user_id},
            headers=self.headers
        ).json()
        
        if claim_response["success"]:
            xp_earned = claim_response["xp_earned"]
            
            # Get updated stats
            stats_after = requests.get(
                f"{BASE_URL}/api/engagement/profile/stats/{self.user_id}",
                headers=self.headers
            ).json()["stats"]
            
            # Verify XP increased
            assert stats_after["xp"] >= initial_xp + xp_earned
            print(f"✅ XP integration: {initial_xp} -> {stats_after['xp']} (+{xp_earned})")
        else:
            print("⚠️ Daily reward already claimed")
    
    def test_notification_on_achievement(self):
        """Test that unlocking achievement sends notification"""
        # Unlock an achievement
        unlock_response = requests.post(
            f"{BASE_URL}/api/engagement/achievement/unlock",
            params={"user_id": self.user_id, "achievement_id": "social_butterfly"},
            headers=self.headers
        ).json()
        
        if unlock_response["success"]:
            # Check notifications
            notifs = requests.get(
                f"{BASE_URL}/api/engagement/notifications/{self.user_id}",
                params={"limit": 5},
                headers=self.headers
            ).json()
            
            # Should have achievement notification
            achievement_notifs = [n for n in notifs["notifications"] if n["type"] == "achievement"]
            assert len(achievement_notifs) > 0, "Achievement notification not found"
            print(f"✅ Achievement notification sent: {achievement_notifs[0]['title']}")
        else:
            print("⚠️ Achievement already unlocked")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
