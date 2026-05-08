import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, MessageCircle, Share2, Play, Pause, Volume2, VolumeX, User, Plus, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import VibezComments from '@/components/VibezComments';

const API = process.env.REACT_APP_BACKEND_URL;

/**
 * My Vibez Feed - Global Vibez style vertical content discovery
 * Unique social content platform for dating and connection
 */
export default function MyVibezFeed() {
  const navigate = useNavigate();
  const [feedType, setFeedType] = useState('trending'); // trending, for-you, following
  const [content, setContent] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef(null);
  const userId = localStorage.getItem('user_id') || 'demo_user';

  useEffect(() => {
    loadFeed();
  }, [feedType]);

  const loadFeed = async () => {
    setLoading(true);
    try {
      let endpoint;
      switch (feedType) {
        case 'trending':
          endpoint = `${API}/api/vibez/feed/trending?limit=20`;
          break;
        case 'for-you':
          endpoint = `${API}/api/vibez/feed/for-you?user_id=${userId}&limit=20`;
          break;
        case 'following':
          endpoint = `${API}/api/vibez/feed/following?user_id=${userId}&limit=20`;
          break;
        default:
          endpoint = `${API}/api/vibez/feed/trending?limit=20`;
      }

      const response = await fetch(endpoint);
      const data = await response.json();
      
      if (data.success) {
        setContent(data.content);
        setCurrentIndex(0);
      }
    } catch (err) {
      // console.error('Failed to load feed:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleScroll = (direction) => {
    if (direction === 'up' && currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    } else if (direction === 'down' && currentIndex < content.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.key === 'ArrowUp') handleScroll('up');
      if (e.key === 'ArrowDown') handleScroll('down');
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [currentIndex, content]);

  if (loading) {
    return (
      <div className="h-screen bg-black flex items-center justify-center">
        <div className="text-white text-xl">Loading Vibez...</div>
      </div>
    );
  }

  if (content.length === 0) {
    return (
      <div className="h-screen bg-black flex flex-col items-center justify-center text-white">
        <h2 className="text-2xl font-bold mb-4">No Content Yet</h2>
        <p className="text-gray-400 mb-6">Be the first to post!</p>
        <button
          onClick={() => navigate('/vibez/upload')}
          className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-purple-500 rounded-full font-bold"
        >
          <Plus className="w-5 h-5 inline mr-2" />
          Create Content
        </button>
      </div>
    );
  }

  const currentContent = content[currentIndex];

  return (
    <div className="h-screen bg-black overflow-hidden relative" ref={containerRef}>
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-50 p-4 flex items-center justify-between bg-gradient-to-b from-black/60 to-transparent">
        <button
          onClick={() => navigate('/games')}
          className="p-2 rounded-full bg-black/30 backdrop-blur-sm text-white hover:bg-black/50 transition-all"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        
        {/* Feed Type Selector */}
        <div className="flex gap-2">
          {['trending', 'for-you', 'following'].map(type => (
            <button
              key={type}
              onClick={() => setFeedType(type)}
              className={`px-4 py-2 rounded-full font-semibold text-sm transition-all ${
                feedType === type
                  ? 'bg-white text-black'
                  : 'bg-black/30 backdrop-blur-sm text-white hover:bg-black/50'
              }`}
            >
              {type === 'for-you' ? 'For You' : type.charAt(0).toUpperCase() + type.slice(1)}
            </button>
          ))}
        </div>

        <button
          onClick={() => navigate('/vibez/upload')}
          className="p-2 rounded-full bg-black/30 backdrop-blur-sm text-white hover:bg-black/50 transition-all"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {/* Content Container */}
      <div className="h-full relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -100 }}
            transition={{ duration: 0.3 }}
            className="h-full w-full absolute inset-0"
          >
            <VibezContent 
              content={currentContent} 
              userId={userId}
              onNext={() => handleScroll('down')}
              onPrev={() => handleScroll('up')}
            />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Progress Indicator */}
      <div className="absolute bottom-24 left-1/2 transform -translate-x-1/2 z-50 flex gap-1">
        {content.slice(Math.max(0, currentIndex - 2), currentIndex + 3).map((_, i) => (
          <div
            key={_.id || _.name || `item-${i}`}
            className={`w-1 h-1 rounded-full ${
              i === 2 ? 'bg-white w-6' : 'bg-white/50'
            }`}
          />
        ))}
      </div>
    </div>
  );
}

// Individual Content Component
function VibezContent({ content, userId, onNext, onPrev }) {
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(content.likes_count);
  const [commentsCount, setCommentsCount] = useState(content.comments_count);
  const [showComments, setShowComments] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && content.content_type === 'video') {
      videoRef.current.play();
    }
  }, [content]);

  const handleLike = async () => {
    try {
      const response = await fetch(`${API}/api/vibez/like?content_id=${content.content_id}&user_id=${userId}`, {
        method: 'POST'
      });
      const data = await response.json();
      
      if (data.success) {
        if (data.action === 'liked') {
          setLiked(true);
          setLikesCount(likesCount + 1);
        } else {
          setLiked(false);
          setLikesCount(likesCount - 1);
        }
      }
    } catch (err) {
      // console.error('Failed to like:', err);
    }
  };

  const handleShare = async () => {
    try {
      await fetch(`${API}/api/vibez/share?content_id=${content.content_id}`, {
        method: 'POST'
      });
      
      if (navigator.share) {
        navigator.share({
          title: `Check out ${content.username}'s post`,
          text: content.caption,
          url: window.location.href
        });
      }
    } catch (err) {
      // console.error('Failed to share:', err);
    }
  };

  const togglePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  return (
    <div className="h-full w-full relative flex items-center justify-center bg-black">
      {/* Media Content */}
      {content.content_type === 'video' && content.media_url ? (
        <video
          ref={videoRef}
          src={content.media_url}
          className="h-full w-full object-contain"
          loop
          playsInline
          onClick={togglePlayPause}
        />
      ) : content.content_type === 'image' && content.media_url ? (
        <img
          src={content.media_url}
          alt={content.caption}
          className="h-full w-full object-contain"
        />
      ) : (
        <div className="h-full w-full flex items-center justify-center p-8">
          <p className="text-white text-2xl text-center max-w-2xl">{content.caption}</p>
        </div>
      )}

      {/* User Info Overlay */}
      <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500 to-purple-500 flex items-center justify-center">
            {content.user_avatar ? (
              <img src={content.user_avatar} alt={content.username} className="w-full h-full rounded-full" />
            ) : (
              <User className="w-6 h-6 text-white" />
            )}
          </div>
          <div>
            <p className="text-white font-bold">{content.username}</p>
            <p className="text-gray-300 text-sm">
              {new Date(content.created_at).toLocaleDateString()}
            </p>
          </div>
          <button className="ml-auto px-4 py-2 bg-white text-black rounded-full font-bold text-sm hover:bg-gray-200 transition-colors">
            Follow
          </button>
        </div>

        <p className="text-white mb-2">{content.caption}</p>
        
        {content.hashtags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {content.hashtags.map((tag, i) => (
              <span key={`hashtags-${i}`} className="text-cyan-400 text-sm">#{tag}</span>
            ))}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="absolute right-4 bottom-32 flex flex-col gap-6">
        {/* Like */}
        <button
          onClick={handleLike}
          className="flex flex-col items-center gap-1 transition-transform hover:scale-110"
        >
          <motion.div
            animate={{ scale: liked ? [1, 1.3, 1] : 1 }}
            transition={{ duration: 0.3 }}
            className={`w-12 h-12 rounded-full flex items-center justify-center ${
              liked ? 'bg-red-500' : 'bg-black/50 backdrop-blur-sm'
            }`}
          >
            <Heart className={`w-6 h-6 ${liked ? 'fill-white' : ''} text-white`} />
          </motion.div>
          <span className="text-white text-sm font-semibold">{likesCount}</span>
        </button>

        {/* Comments */}
        <button
          onClick={() => setShowComments(!showComments)}
          className="flex flex-col items-center gap-1 transition-transform hover:scale-110"
        >
          <div className="w-12 h-12 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center">
            <MessageCircle className="w-6 h-6 text-white" />
          </div>
          <span className="text-white text-sm font-semibold">{content.comments_count}</span>
        </button>

        {/* Share */}
        <button
          onClick={handleShare}
          className="flex flex-col items-center gap-1 transition-transform hover:scale-110"
        >
          <div className="w-12 h-12 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center">
            <Share2 className="w-6 h-6 text-white" />
          </div>
          <span className="text-white text-sm font-semibold">{content.shares_count}</span>
        </button>
      </div>

      {/* Video Controls */}
      {content.content_type === 'video' && (
        <div className="absolute top-1/2 right-4 flex flex-col gap-4">
          <button
            onClick={togglePlayPause}
            className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/70 transition-all"
          >
            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
          </button>
          <button
            onClick={toggleMute}
            className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/70 transition-all"
          >
            {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </button>
        </div>
      )}

      {/* Swipe hints */}
      <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 text-white/50 text-sm">
        ↑ ↓ Swipe or use arrow keys
      </div>
    </div>
  );
}
