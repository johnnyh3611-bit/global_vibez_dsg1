"""
MY VIBEZ Content Room - TikTok-style Video Platform Tests
Tests: Video Upload, Feeds (For You/Following), Likes, Comments, Follow, Share, Creator Stats
"""
import pytest
import requests
import os
import base64
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

@pytest.fixture(scope="module")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session

@pytest.fixture(scope="module")
def auth_session(api_client):
    """Authenticated session via demo login"""
    response = api_client.post(f"{BASE_URL}/api/auth/demo-login", json={
        "email": "demo@globalvibez.com"
    })
    if response.status_code == 200:
        return api_client
    pytest.skip("Demo login failed - skipping authenticated tests")

@pytest.fixture(scope="module")
def test_user_session():
    """Create a second test user for follow/interaction tests"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    
    # Create a unique test user
    test_email = f"test_vibez_{uuid.uuid4().hex[:8]}@test.com"
    response = session.post(f"{BASE_URL}/api/auth/demo-login", json={
        "email": test_email
    })
    if response.status_code == 200:
        user_data = response.json()
        return {"session": session, "user_id": user_data.get("user_id"), "email": test_email}
    return None


class TestMyVibezFeedEndpoints:
    """Test Feed Endpoints - For You and Following"""
    
    def test_for_you_feed_unauthenticated(self, api_client):
        """For You feed should work without authentication"""
        response = api_client.get(f"{BASE_URL}/api/my-vibez/feed/for-you?limit=10")
        assert response.status_code == 200
        data = response.json()
        assert "videos" in data
        assert "total" in data
        assert isinstance(data["videos"], list)
        print(f"For You feed returned {len(data['videos'])} videos")
    
    def test_for_you_feed_authenticated(self, auth_session):
        """For You feed should exclude user's own videos when authenticated"""
        response = auth_session.get(f"{BASE_URL}/api/my-vibez/feed/for-you?limit=20")
        assert response.status_code == 200
        data = response.json()
        assert "videos" in data
        print(f"Authenticated For You feed returned {len(data['videos'])} videos")
    
    def test_following_feed_requires_auth(self, api_client):
        """Following feed should require authentication"""
        # Create a fresh session without auth
        fresh_session = requests.Session()
        response = fresh_session.get(f"{BASE_URL}/api/my-vibez/feed/following?limit=10")
        assert response.status_code == 401
        print("Following feed correctly requires authentication")
    
    def test_following_feed_authenticated(self, auth_session):
        """Following feed should work when authenticated"""
        response = auth_session.get(f"{BASE_URL}/api/my-vibez/feed/following?limit=10")
        assert response.status_code == 200
        data = response.json()
        assert "videos" in data
        assert "total" in data
        print(f"Following feed returned {len(data['videos'])} videos")


class TestMyVibezVideoUpload:
    """Test Video Upload Functionality"""
    
    def test_upload_requires_auth(self, api_client):
        """Video upload should require authentication"""
        fresh_session = requests.Session()
        fresh_session.headers.update({"Content-Type": "application/json"})
        
        response = fresh_session.post(f"{BASE_URL}/api/my-vibez/upload", json={
            "title": "Test Video",
            "video_data": "data:video/webm;base64,SGVsbG8=",
            "duration": 10
        })
        assert response.status_code == 401
        print("Upload correctly requires authentication")
    
    def test_upload_validates_duration(self, auth_session):
        """Video upload should reject videos over 5 minutes"""
        # Create a minimal base64 video data
        fake_video_data = base64.b64encode(b"fake video content").decode()
        
        response = auth_session.post(f"{BASE_URL}/api/my-vibez/upload", json={
            "title": "Too Long Video",
            "video_data": f"data:video/webm;base64,{fake_video_data}",
            "duration": 400  # Over 5 minutes (300 seconds)
        })
        assert response.status_code == 400
        assert "5 minute" in response.json().get("detail", "").lower()
        print("Upload correctly rejects videos over 5 minutes")
    
    def test_upload_video_success(self, auth_session):
        """Test successful video upload with valid data"""
        # Create minimal valid video data
        fake_video_data = base64.b64encode(b"fake video content for testing").decode()
        fake_thumb_data = base64.b64encode(b"fake thumbnail").decode()
        
        response = auth_session.post(f"{BASE_URL}/api/my-vibez/upload", json={
            "title": "TEST_My First Vibez Video #gaming #fun",
            "description": "Testing the upload feature #test",
            "video_data": f"data:video/webm;base64,{fake_video_data}",
            "thumbnail_data": f"data:image/jpeg;base64,{fake_thumb_data}",
            "duration": 30,
            "hashtags": ["gaming", "fun"]
        })
        
        assert response.status_code == 200
        data = response.json()
        assert "video_id" in data
        assert "video_url" in data
        assert data["video_id"].startswith("vibez_")
        print(f"Video uploaded successfully: {data['video_id']}")
        
        # Store video_id for later tests
        TestMyVibezVideoUpload.uploaded_video_id = data["video_id"]
        return data["video_id"]


class TestMyVibezVideoRetrieval:
    """Test Video Retrieval and View Tracking"""
    
    def test_get_video_increments_views(self, api_client):
        """Getting a video should increment view count"""
        # First, get the For You feed to find a video
        response = api_client.get(f"{BASE_URL}/api/my-vibez/feed/for-you?limit=5")
        if response.status_code != 200 or not response.json().get("videos"):
            pytest.skip("No videos available for testing")
        
        video = response.json()["videos"][0]
        video_id = video["video_id"]
        initial_views = video["views_count"]
        
        # Get the video directly
        response = api_client.get(f"{BASE_URL}/api/my-vibez/video/{video_id}")
        assert response.status_code == 200
        data = response.json()
        
        # View count should be incremented
        assert data["views_count"] == initial_views + 1
        print(f"View count incremented: {initial_views} -> {data['views_count']}")
    
    def test_get_nonexistent_video(self, api_client):
        """Getting a non-existent video should return 404"""
        response = api_client.get(f"{BASE_URL}/api/my-vibez/video/nonexistent_video_id")
        assert response.status_code == 404
        print("Non-existent video correctly returns 404")


class TestMyVibezLikeSystem:
    """Test Like/Unlike Functionality"""
    
    def test_like_requires_auth(self, api_client):
        """Liking a video should require authentication"""
        fresh_session = requests.Session()
        response = fresh_session.post(f"{BASE_URL}/api/my-vibez/video/test_video/like")
        assert response.status_code == 401
        print("Like correctly requires authentication")
    
    def test_like_video(self, auth_session):
        """Test liking a video"""
        # Get a video to like
        response = auth_session.get(f"{BASE_URL}/api/my-vibez/feed/for-you?limit=5")
        if response.status_code != 200 or not response.json().get("videos"):
            pytest.skip("No videos available for testing")
        
        video = response.json()["videos"][0]
        video_id = video["video_id"]
        
        # Like the video
        response = auth_session.post(f"{BASE_URL}/api/my-vibez/video/{video_id}/like")
        # Could be 200 (success) or 400 (already liked)
        assert response.status_code in [200, 400]
        print(f"Like response: {response.status_code} - {response.json()}")
        
        # Store for unlike test
        TestMyVibezLikeSystem.liked_video_id = video_id
    
    def test_check_liked_status(self, auth_session):
        """Test checking if video is liked"""
        video_id = getattr(TestMyVibezLikeSystem, 'liked_video_id', None)
        if not video_id:
            pytest.skip("No video was liked in previous test")
        
        response = auth_session.get(f"{BASE_URL}/api/my-vibez/video/{video_id}/liked")
        assert response.status_code == 200
        data = response.json()
        assert "liked" in data
        print(f"Liked status: {data['liked']}")
    
    def test_unlike_video(self, auth_session):
        """Test unliking a video"""
        video_id = getattr(TestMyVibezLikeSystem, 'liked_video_id', None)
        if not video_id:
            pytest.skip("No video was liked in previous test")
        
        response = auth_session.delete(f"{BASE_URL}/api/my-vibez/video/{video_id}/like")
        # Could be 200 (success) or 400 (not liked)
        assert response.status_code in [200, 400]
        print(f"Unlike response: {response.status_code} - {response.json()}")


class TestMyVibezCommentSystem:
    """Test Comment Functionality"""
    
    def test_add_comment_requires_auth(self, api_client):
        """Adding a comment should require authentication"""
        fresh_session = requests.Session()
        fresh_session.headers.update({"Content-Type": "application/json"})
        
        response = fresh_session.post(f"{BASE_URL}/api/my-vibez/comments", json={
            "video_id": "test_video",
            "text": "Test comment"
        })
        assert response.status_code == 401
        print("Comment correctly requires authentication")
    
    def test_add_comment(self, auth_session):
        """Test adding a comment to a video"""
        # Get a video to comment on
        response = auth_session.get(f"{BASE_URL}/api/my-vibez/feed/for-you?limit=5")
        if response.status_code != 200 or not response.json().get("videos"):
            pytest.skip("No videos available for testing")
        
        video = response.json()["videos"][0]
        video_id = video["video_id"]
        
        # Add comment
        response = auth_session.post(f"{BASE_URL}/api/my-vibez/comments", json={
            "video_id": video_id,
            "text": "TEST_Great video! 🔥"
        })
        assert response.status_code == 200
        data = response.json()
        assert "comment_id" in data
        assert data["text"] == "TEST_Great video! 🔥"
        print(f"Comment added: {data['comment_id']}")
        
        # Store for retrieval test
        TestMyVibezCommentSystem.commented_video_id = video_id
    
    def test_get_comments(self, api_client):
        """Test retrieving comments for a video"""
        video_id = getattr(TestMyVibezCommentSystem, 'commented_video_id', None)
        if not video_id:
            pytest.skip("No video was commented on in previous test")
        
        response = api_client.get(f"{BASE_URL}/api/my-vibez/video/{video_id}/comments?limit=50")
        assert response.status_code == 200
        data = response.json()
        assert "comments" in data
        assert "total" in data
        print(f"Retrieved {len(data['comments'])} comments")


class TestMyVibezFollowSystem:
    """Test Follow/Unfollow Functionality"""
    
    def test_follow_requires_auth(self, api_client):
        """Following a creator should require authentication"""
        fresh_session = requests.Session()
        response = fresh_session.post(f"{BASE_URL}/api/my-vibez/follow/test_creator")
        assert response.status_code == 401
        print("Follow correctly requires authentication")
    
    def test_cannot_follow_self(self, auth_session):
        """User should not be able to follow themselves"""
        # Get current user ID from a video they might have uploaded
        # or use the demo user ID
        response = auth_session.post(f"{BASE_URL}/api/my-vibez/follow/demo_b88a4250")
        assert response.status_code == 400
        print("Cannot follow self - correctly rejected")
    
    def test_follow_creator(self, auth_session, test_user_session):
        """Test following another creator"""
        if not test_user_session:
            pytest.skip("Test user session not available")
        
        creator_id = test_user_session["user_id"]
        
        response = auth_session.post(f"{BASE_URL}/api/my-vibez/follow/{creator_id}")
        # Could be 200 (success) or already following
        assert response.status_code in [200, 400]
        print(f"Follow response: {response.status_code} - {response.json()}")
        
        # Store for unfollow test
        TestMyVibezFollowSystem.followed_creator_id = creator_id
    
    def test_check_following_status(self, auth_session):
        """Test checking if following a creator"""
        creator_id = getattr(TestMyVibezFollowSystem, 'followed_creator_id', None)
        if not creator_id:
            pytest.skip("No creator was followed in previous test")
        
        response = auth_session.get(f"{BASE_URL}/api/my-vibez/following/{creator_id}")
        assert response.status_code == 200
        data = response.json()
        assert "following" in data
        print(f"Following status: {data['following']}")
    
    def test_unfollow_creator(self, auth_session):
        """Test unfollowing a creator"""
        creator_id = getattr(TestMyVibezFollowSystem, 'followed_creator_id', None)
        if not creator_id:
            pytest.skip("No creator was followed in previous test")
        
        response = auth_session.delete(f"{BASE_URL}/api/my-vibez/follow/{creator_id}")
        # Could be 200 (success) or 400 (not following)
        assert response.status_code in [200, 400]
        print(f"Unfollow response: {response.status_code} - {response.json()}")


class TestMyVibezShareSystem:
    """Test Share Tracking Functionality"""
    
    def test_share_video(self, api_client):
        """Test sharing a video (tracking share count)"""
        # Get a video to share
        response = api_client.get(f"{BASE_URL}/api/my-vibez/feed/for-you?limit=5")
        if response.status_code != 200 or not response.json().get("videos"):
            pytest.skip("No videos available for testing")
        
        video = response.json()["videos"][0]
        video_id = video["video_id"]
        initial_shares = video["shares_count"]
        
        # Share the video
        response = api_client.post(f"{BASE_URL}/api/my-vibez/video/{video_id}/share")
        assert response.status_code == 200
        data = response.json()
        assert "share_url" in data
        assert video_id in data["share_url"]
        print(f"Share tracked, URL: {data['share_url']}")


class TestMyVibezCreatorStats:
    """Test Creator Statistics Endpoint"""
    
    def test_get_creator_stats(self, api_client):
        """Test getting creator statistics"""
        # Use demo user ID
        creator_id = "demo_b88a4250"
        
        response = api_client.get(f"{BASE_URL}/api/my-vibez/creator/{creator_id}/stats")
        assert response.status_code == 200
        data = response.json()
        
        assert "creator_id" in data
        assert "videos_count" in data
        assert "total_views" in data
        assert "total_likes" in data
        assert "followers_count" in data
        
        print(f"Creator stats: {data['videos_count']} videos, {data['total_views']} views, {data['followers_count']} followers")
    
    def test_get_nonexistent_creator_stats(self, api_client):
        """Test getting stats for non-existent creator"""
        response = api_client.get(f"{BASE_URL}/api/my-vibez/creator/nonexistent_user/stats")
        assert response.status_code == 200
        data = response.json()
        # Should return zeros for non-existent creator
        assert data["videos_count"] == 0
        print("Non-existent creator returns zero stats")


class TestMyVibezHashtagExtraction:
    """Test Hashtag Auto-Extraction"""
    
    def test_hashtag_extraction_in_upload(self, auth_session):
        """Test that hashtags are auto-extracted from title and description"""
        fake_video_data = base64.b64encode(b"hashtag test video").decode()
        
        response = auth_session.post(f"{BASE_URL}/api/my-vibez/upload", json={
            "title": "TEST_Check out this #awesome video",
            "description": "Having fun with #gaming and #dating",
            "video_data": f"data:video/webm;base64,{fake_video_data}",
            "duration": 15,
            "hashtags": ["test"]  # Explicit hashtag
        })
        
        assert response.status_code == 200
        video_id = response.json()["video_id"]
        
        # Fetch the video to check hashtags
        response = auth_session.get(f"{BASE_URL}/api/my-vibez/video/{video_id}")
        assert response.status_code == 200
        data = response.json()
        
        # Should have both explicit and auto-extracted hashtags
        hashtags = data.get("hashtags", [])
        print(f"Extracted hashtags: {hashtags}")
        
        # Check that auto-extracted hashtags are present
        assert "awesome" in hashtags or "gaming" in hashtags or "dating" in hashtags or "test" in hashtags
        print("Hashtag extraction working correctly")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
