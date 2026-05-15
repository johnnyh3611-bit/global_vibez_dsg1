import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Heart, 
  Flame, 
  MessageCircle, 
  Share2, 
  Gamepad2,
  Sparkles,
  Play,
  Pause,
  Volume2,
  VolumeX,
  MoreVertical,
  Trophy,
  Users,
  TrendingUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function MyVibezPage() {
  const [posts, setPosts] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [feedType, setFeedType] = useState('for_you'); // for_you, following, gaming, dating
  const [loading, setLoading] = useState(false);
  const [userId] = useState(() => localStorage.getItem('user_id') || 'demo_user');
  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(true);
  
  const containerRef = useRef(null);
  const videoRefs = useRef({});

  useEffect(() => {
    fetchFeed();
  }, [feedType]);

  useEffect(() => {
    // Auto-play current video
    if (videoRefs.current[currentIndex]) {
      videoRefs.current[currentIndex].play();
    }
  }, [currentIndex]);

  const fetchFeed = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${API_URL}/api/my-vibez/feed?user_id=${userId}&feed_type=${feedType}&limit=20`
      );
      const data = await response.json();
      if (data.success) {
        setPosts(data.posts);
      }
    } catch (error) {
      // console.error('Failed to fetch feed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInteraction = async (postId, type) => {
    try {
      const response = await fetch(`${API_URL}/api/my-vibez/interact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          post_id: postId,
          user_id: userId,
          interaction_type: type
        })
      });
      
      const data = await response.json();
      if (data.success) {
        // Update local state
        setPosts(prev => prev.map(post => 
          post.id === postId 
            ? { ...post, [`${type}s`]: (post[`${type}s`] || 0) + 1, user_has_liked: true }
            : post
        ));
      }
    } catch (error) {
      // console.error('Failed to interact:', error);
    }
  };

  const handleScroll = (e) => {
    const { scrollTop, clientHeight } = e.target;
    const index = Math.round(scrollTop / clientHeight);
    if (index !== currentIndex && index < posts.length) {
      setCurrentIndex(index);
    }
  };

  const currentPost = posts[currentIndex];

  const InteractionButton = ({ icon: Icon, count, onClick, active, color }) => (
    <motion.button
      whileTap={{ scale: 0.9 }}
      onClick={onClick}
      className="flex flex-col items-center gap-1"
    >
      <div className={`w-12 h-12 rounded-full ${active ? color : 'bg-slate-800/50'} backdrop-blur-sm flex items-center justify-center`}>
        <Icon className={`w-6 h-6 ${active ? 'text-white' : 'text-gray-300'}`} />
      </div>
      <span className="text-xs text-white font-semibold">{count > 0 ? count : ''}</span>
    </motion.button>
  );

  return (
    <div className="h-screen bg-black overflow-hidden">
      {/* Top Navigation */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-b from-black/80 to-transparent p-4">
        <div className="flex items-center justify-between max-w-md mx-auto">
          <h1 className="text-2xl font-black text-transparent bg-gradient-to-r from-pink-400 via-purple-400 to-blue-400 bg-clip-text">
            MY VIBEZ
          </h1>
          
          {/* Feed Type Selector */}
          <div className="flex gap-2">
            {[
              { id: 'for_you', label: 'For You', icon: Sparkles },
              { id: 'following', label: 'Following', icon: Users },
              { id: 'gaming', label: 'Gaming', icon: Gamepad2 },
              { id: 'dating', label: 'Dating', icon: Heart }
            ].map(({ id, label, icon: Icon }) => (
              <Button
                key={id}
                size="sm"
                onClick={() => setFeedType(id)}
                className={`${
                  feedType === id
                    ? 'bg-gradient-to-r from-pink-600 to-purple-600'
                    : 'bg-slate-800/50 backdrop-blur-sm'
                } px-3 py-1 text-xs`}
              >
                <Icon className="w-3 h-3 mr-1" />
                {label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Video Feed - TikTok Style Vertical Scroll */}
      <div 
        ref={containerRef}
        onScroll={handleScroll}
        className="h-full overflow-y-scroll snap-y snap-mandatory scroll-smooth"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {posts.map((post, index) => (
          <div
            key={post.id}
            className="h-screen w-full snap-start relative flex items-center justify-center"
          >
            {/* Video/Image Content */}
            {post.content_type === 'video' && post.content_url ? (
              <video
                ref={el => { videoRefs.current[index] = el; }}
                src={post.content_url}
                className="w-full h-full object-cover"
                loop
                muted={muted}
                playsInline
                autoPlay={index === currentIndex}
              />
            ) : (
              <div 
                className="w-full h-full bg-gradient-to-br from-pink-900 via-purple-900 to-blue-900"
                style={{
                  backgroundImage: post.thumbnail_url ? `url(${post.thumbnail_url})` : 'none',
                  backgroundSize: 'cover',
                  backgroundPosition: 'center'
                }}
              />
            )}

            {/* Gradient Overlays */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/80 pointer-events-none" />

            {/* Content Info - Bottom Left */}
            <div className="absolute bottom-20 left-0 right-20 p-6 text-white space-y-3">
              {/* User Info */}
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-pink-500 to-purple-500 flex items-center justify-center">
                  {post.user_avatar ? (
                    <img src={post.user_avatar} alt={post.username} className="w-full h-full rounded-full" loading="lazy" />
                  ) : (
                    <span className="text-xl font-bold">{post.username[0]}</span>
                  )}
                </div>
                <div>
                  <p className="font-bold text-lg">{post.username}</p>
                  {post.game_id && (
                    <p className="text-sm text-gray-300 flex items-center gap-1">
                      <Gamepad2 className="w-3 h-3" />
                      Playing {post.game_id}
                    </p>
                  )}
                </div>
                <Button size="sm" className="ml-auto bg-pink-600 hover:bg-pink-700">
                  Follow
                </Button>
              </div>

              {/* Title & Description */}
              {post.title && (
                <h3 className="text-xl font-bold">{post.title}</h3>
              )}
              {post.description && (
                <p className="text-sm text-gray-200 line-clamp-2">{post.description}</p>
              )}

              {/* Tags */}
              {post.tags && post.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {post.tags.map((tag, i) => (
                    <span key={`tags-${i}`} className="text-xs bg-white/20 backdrop-blur-sm px-2 py-1 rounded-full">
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Game Stats Badge */}
              {post.game_stats && (
                <div className="inline-flex items-center gap-2 bg-gradient-to-r from-yellow-600/80 to-orange-600/80 backdrop-blur-sm px-3 py-1 rounded-full">
                  <Trophy className="w-4 h-4" />
                  <span className="text-xs font-bold">
                    {post.game_stats.wins}W | {post.game_stats.win_rate}% WR
                  </span>
                </div>
              )}

              {/* Dual Stream Indicator */}
              {post.is_dual_stream && (
                <div className="inline-flex items-center gap-2 bg-gradient-to-r from-pink-600/80 to-purple-600/80 backdrop-blur-sm px-3 py-1 rounded-full">
                  <Users className="w-4 h-4" />
                  <span className="text-xs font-bold">Dual Stream</span>
                </div>
              )}

              {/* Challenge Badge */}
              {post.challenge_id && (
                <div className="inline-flex items-center gap-2 bg-gradient-to-r from-cyan-600/80 to-blue-600/80 backdrop-blur-sm px-3 py-1 rounded-full">
                  <Sparkles className="w-4 h-4" />
                  <span className="text-xs font-bold">Challenge Entry</span>
                </div>
              )}
            </div>

            {/* Interaction Buttons - Right Side */}
            <div className="absolute bottom-20 right-4 flex flex-col gap-4">
              <InteractionButton
                icon={Heart}
                count={post.likes}
                onClick={() => handleInteraction(post.id, 'like')}
                active={post.user_has_liked}
                color="bg-red-500"
              />
              <InteractionButton
                icon={Heart}
                count={post.loves}
                onClick={() => handleInteraction(post.id, 'love')}
                active={false}
                color="bg-pink-500"
              />
              <InteractionButton
                icon={Flame}
                count={post.fires}
                onClick={() => handleInteraction(post.id, 'fire')}
                active={false}
                color="bg-orange-500"
              />
              <InteractionButton
                icon={MessageCircle}
                count={post.comments_count}
                onClick={() => {/* Open comments */}}
                active={false}
                color="bg-blue-500"
              />
              <InteractionButton
                icon={Gamepad2}
                count={post.play_together_requests}
                onClick={() => handleInteraction(post.id, 'play_together')}
                active={false}
                color="bg-purple-500"
              />
              <InteractionButton
                icon={Share2}
                count={post.shares}
                onClick={() => {/* Share */}}
                active={false}
                color="bg-green-500"
              />
            </div>

            {/* Video Controls - Top Right */}
            <div className="absolute top-20 right-4 flex flex-col gap-2">
              <button
                onClick={() => setMuted(!muted)}
                className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center"
              >
                {muted ? <VolumeX className="w-5 h-5 text-white" /> : <Volume2 className="w-5 h-5 text-white" />}
              </button>
              <button
                className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center"
              >
                <MoreVertical className="w-5 h-5 text-white" />
              </button>
            </div>

            {/* Vibe Score Indicator */}
            {post.vibe_score > 0 && (
              <div className="absolute top-20 left-4 bg-gradient-to-r from-purple-600/80 to-pink-600/80 backdrop-blur-sm px-3 py-1 rounded-full">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-white" />
                  <span className="text-xs font-bold text-white">Vibe Score: {post.vibe_score}</span>
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Loading Indicator */}
        {loading && (
          <div className="h-screen flex items-center justify-center">
            <div className="text-white text-xl">Loading vibes...</div>
          </div>
        )}

        {/* End of Feed */}
        {!loading && posts.length === 0 && (
          <div className="h-screen flex flex-col items-center justify-center text-white p-8">
            <Sparkles className="w-24 h-24 text-purple-400 mb-4" />
            <h2 className="text-2xl font-bold mb-2">No Vibes Yet!</h2>
            <p className="text-gray-400 text-center">Be the first to post in {feedType.replace('_', ' ')}</p>
            <Button className="mt-6 bg-gradient-to-r from-pink-600 to-purple-600">
              Create Your First Vibe
            </Button>
          </div>
        )}
      </div>

      {/* Create Post Button - Floating */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => window.location.href = '/my-vibez/create'}
        className="fixed bottom-24 left-1/2 transform -translate-x-1/2 z-50"
      >
        <div className="w-16 h-16 rounded-full bg-gradient-to-r from-pink-600 via-purple-600 to-blue-600 flex items-center justify-center shadow-2xl">
          <span className="text-4xl">+</span>
        </div>
      </motion.button>
    </div>
  );
}
