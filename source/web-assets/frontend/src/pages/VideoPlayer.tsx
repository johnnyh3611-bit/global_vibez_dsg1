import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import { Heart, MessageCircle, Share2, UserPlus, UserCheck, ArrowLeft, Eye, ChevronUp, ChevronDown } from 'lucide-react';
import { CommentsOverlay } from '@/components/my-vibez/CommentsOverlay';
import { ShareModal } from '@/components/my-vibez/ShareModal';
import { useToast } from '@/hooks/useToast';
import { ToastContainer } from '@/components/ToastNotification';

const API = process.env.REACT_APP_BACKEND_URL;

export function VideoPlayer() {
  const { videoId } = useParams();
  const navigate = useNavigate();
  
  const [video, setVideo] = useState(null);
  const [allVideos, setAllVideos] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [liked, setLiked] = useState(false);
  const [following, setFollowing] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const { toasts, removeToast, success, error: showError } = useToast();
  const videoRef = useRef(null);
  const y = useMotionValue(0);
  const opacity = useTransform(y, [-100, 0, 100], [0.5, 1, 0.5]);

  useEffect(() => {
    fetchVideo();
    fetchAllVideos();
  }, [videoId]);

  useEffect(() => {
    if (video) {
      checkLikedStatus();
      checkFollowingStatus();
    }
  }, [video]);

  const fetchVideo = async () => {
    try {
      const response = await fetch(`${API}/api/my-vibez/video/${videoId}`, {
      });
      if (!response.ok) throw new Error('Video not found');
      const data = await response.json();
      setVideo(data);
    } catch (error) {
      // console.error('Error fetching video:', error);
      showError('Failed to load video');
      navigate('/my-vibez');
    } finally {
      setLoading(false);
    }
  };

  const fetchAllVideos = async () => {
    try {
      const response = await fetch(`${API}/api/my-vibez/feed/for-you?limit=50`, {
      });
      if (!response.ok) throw new Error('Failed to fetch feed');
      const data = await response.json();
      setAllVideos(data.videos || []);
      
      // Find current video index
      const index = data.videos.findIndex(v => v.video_id === videoId);
      setCurrentIndex(index >= 0 ? index : 0);
    } catch (error) {
      // console.error('Error fetching feed:', error);
    }
  };

  const checkLikedStatus = async () => {
    try {
      const response = await fetch(`${API}/api/my-vibez/video/${video.video_id}/liked`, {
      });
      const data = await response.json();
      setLiked(data.liked);
    } catch (error) {
      // console.error('Error checking like status:', error);
    }
  };

  const checkFollowingStatus = async () => {
    try {
      const response = await fetch(`${API}/api/my-vibez/following/${video.creator_id}`, {
      });
      const data = await response.json();
      setFollowing(data.following);
    } catch (error) {
      // console.error('Error checking follow status:', error);
    }
  };

  const toggleLike = async () => {
    try {
      const method = liked ? 'DELETE' : 'POST';
      const response = await fetch(`${API}/api/my-vibez/video/${video.video_id}/like`, {
        method,
      });

      if (!response.ok) throw new Error('Failed to toggle like');

      setLiked(!liked);
      setVideo(prev => ({
        ...prev,
        likes_count: prev.likes_count + (liked ? -1 : 1)
      }));

      if (!liked) {
        success('Liked! ❤️');
      }
    } catch (error) {
      // console.error('Error toggling like:', error);
      showError('Failed to like video');
    }
  };

  const toggleFollow = async () => {
    try {
      const method = following ? 'DELETE' : 'POST';
      const response = await fetch(`${API}/api/my-vibez/follow/${video.creator_id}`, {
        method,
      });

      if (!response.ok) throw new Error('Failed to toggle follow');

      setFollowing(!following);
      success(following ? 'Unfollowed' : 'Following! 👤');
    } catch (error) {
      // console.error('Error toggling follow:', error);
      showError('Failed to follow creator');
    }
  };

  const handleShare = async () => {
    setShowShare(true);
    
    try {
      await fetch(`${API}/api/my-vibez/video/${video.video_id}/share`, {
        method: 'POST',
      });
      
      setVideo(prev => ({
        ...prev,
        shares_count: prev.shares_count + 1
      }));
    } catch (error) {
      // console.error('Error tracking share:', error);
    }
  };

  const navigateVideo = (direction) => {
    if (!allVideos.length) return;

    let newIndex = currentIndex + direction;
    if (newIndex < 0) newIndex = 0;
    if (newIndex >= allVideos.length) newIndex = allVideos.length - 1;

    if (newIndex !== currentIndex) {
      const nextVideo = allVideos[newIndex];
      navigate(`/my-vibez/watch/${nextVideo.video_id}`);
    }
  };

  const handleDragEnd = (event, info) => {
    const threshold = 100;
    if (info.offset.y < -threshold) {
      navigateVideo(1); // Swipe up = next video
    } else if (info.offset.y > threshold) {
      navigateVideo(-1); // Swipe down = previous video
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="text-6xl animate-pulse">🎬</div>
      </div>
    );
  }

  if (!video) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black overflow-hidden">
      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {/* Comments Overlay */}
      <CommentsOverlay
        isOpen={showComments}
        onClose={() => setShowComments(false)}
        videoId={video.video_id}
        onCommentAdded={() => {
          setVideo(prev => ({ ...prev, comments_count: prev.comments_count + 1 }));
        }}
      />

      {/* Share Modal */}
      <ShareModal
        isOpen={showShare}
        onClose={() => setShowShare(false)}
        videoId={video.video_id}
        videoTitle={video.title}
      />

      {/* Video Player */}
      <motion.div
        className="relative w-full h-full flex items-center justify-center"
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0.2}
        onDragEnd={handleDragEnd}
        style={{ y, opacity }}
      >
        <video
          ref={videoRef}
          src={`${API}${video.video_url}`}
          className="w-full h-full object-contain"
          autoPlay
          loop
          playsInline
          onClick={() => {
            if (videoRef.current) {
              videoRef.current.paused ? videoRef.current.play() : videoRef.current.pause();
            }
          }}
        />

        {/* Swipe Hints */}
        <AnimatePresence>
          {currentIndex < allVideos.length - 1 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              className="absolute top-8 left-1/2 -translate-x-1/2 flex flex-col items-center text-white pointer-events-none"
            >
              <ChevronUp size={32} />
              <span className="text-sm">Swipe up for next</span>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {currentIndex > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              className="absolute bottom-24 left-1/2 -translate-x-1/2 flex flex-col items-center text-white pointer-events-none"
            >
              <span className="text-sm">Swipe down for previous</span>
              <ChevronDown size={32} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Top Bar */}
        <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/60 to-transparent">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate('/my-vibez')}
              className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-xl flex items-center justify-center text-white hover:bg-white/20 transition-all"
            >
              <ArrowLeft size={20} />
            </button>
            <div className="text-white text-sm font-bold">
              {currentIndex + 1} / {allVideos.length}
            </div>
          </div>
        </div>

        {/* Video Info + Actions */}
        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
          <div className="flex items-end justify-between">
            {/* Left: Video Info */}
            <div className="flex-1 pr-4">
              {/* Creator */}
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-fuchsia-500 to-pink-500 flex items-center justify-center overflow-hidden">
                  {video.creator_avatar ? (
                    <img src={video.creator_avatar} alt={video.creator_name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-white font-bold text-xl">{video.creator_name[0]}</span>
                  )}
                </div>
                <div>
                  <div className="text-white font-bold">{video.creator_name}</div>
                  <button
                    onClick={toggleFollow}
                    className="text-fuchsia-300 text-sm font-bold hover:text-fuchsia-200 transition-colors"
                  >
                    {following ? 'Following' : 'Follow'}
                  </button>
                </div>
              </div>

              {/* Title */}
              <h2 className="text-white text-lg font-bold mb-2 line-clamp-2">
                {video.title}
              </h2>

              {/* Description */}
              {video.description && (
                <p className="text-white/80 text-sm mb-2 line-clamp-2">
                  {video.description}
                </p>
              )}

              {/* Hashtags */}
              {video.hashtags && video.hashtags.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {video.hashtags.map((tag, i) => (
                    <span key={`hashtags-${i}`} className="text-cyan-400 text-sm font-medium">
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Views */}
              <div className="flex items-center gap-2 text-white/60 text-sm">
                <Eye size={16} />
                {formatNumber(video.views_count)} views
              </div>
            </div>

            {/* Right: Action Buttons */}
            <div className="flex flex-col gap-6 items-center">
              {/* Like */}
              <motion.button
                whileTap={{ scale: 0.8 }}
                onClick={toggleLike}
                className="flex flex-col items-center gap-1"
              >
                <motion.div
                  animate={liked ? { scale: [1, 1.3, 1] } : {}}
                  transition={{ duration: 0.3 }}
                  className={`w-14 h-14 rounded-full flex items-center justify-center ${
                    liked 
                      ? 'bg-gradient-to-br from-red-500 to-pink-600 shadow-[0_0_30px_rgba(239,68,68,0.8)]' 
                      : 'bg-white/10 backdrop-blur-xl'
                  }`}
                >
                  <Heart size={28} className={liked ? 'text-white fill-white' : 'text-white'} />
                </motion.div>
                <span className="text-white text-xs font-bold">{formatNumber(video.likes_count)}</span>
              </motion.button>

              {/* Comment */}
              <button
                onClick={() => setShowComments(true)}
                className="flex flex-col items-center gap-1"
              >
                <div className="w-14 h-14 rounded-full bg-white/10 backdrop-blur-xl flex items-center justify-center hover:bg-white/20 transition-all">
                  <MessageCircle size={28} className="text-white" />
                </div>
                <span className="text-white text-xs font-bold">{formatNumber(video.comments_count)}</span>
              </button>

              {/* Share */}
              <button
                onClick={handleShare}
                className="flex flex-col items-center gap-1"
              >
                <div className="w-14 h-14 rounded-full bg-white/10 backdrop-blur-xl flex items-center justify-center hover:bg-white/20 transition-all">
                  <Share2 size={28} className="text-white" />
                </div>
                <span className="text-white text-xs font-bold">{formatNumber(video.shares_count)}</span>
              </button>

              {/* Follow */}
              <motion.button
                whileTap={{ scale: 0.8 }}
                onClick={toggleFollow}
                className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
                  following
                    ? 'bg-white/10 backdrop-blur-xl'
                    : 'bg-gradient-to-br from-fuchsia-600 to-pink-600 shadow-[0_0_30px_rgba(232,121,249,0.8)]'
                }`}
              >
                {following ? (
                  <UserCheck size={28} className="text-white" />
                ) : (
                  <UserPlus size={28} className="text-white" />
                )}
              </motion.button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function formatNumber(num) {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}
