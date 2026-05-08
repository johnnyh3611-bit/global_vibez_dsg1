import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, TrendingUp, Users, Video } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { VideoGrid } from '@/components/my-vibez/VideoGrid';
import { VideoRecorder } from '@/components/my-vibez/VideoRecorder';
import { useToast } from '@/hooks/useToast';
import { ToastContainer } from '@/components/ToastNotification';

const API = process.env.REACT_APP_BACKEND_URL;

export function MyVibez() {
  const [activeTab, setActiveTab] = useState('for-you'); // for-you | following
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showRecorder, setShowRecorder] = useState(false);
  const { toasts, removeToast, success } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    fetchFeed();
  }, [activeTab]);

  const fetchFeed = async () => {
    setLoading(true);
    try {
      const endpoint = activeTab === 'for-you' ? '/api/my-vibez/feed/for-you' : '/api/my-vibez/feed/following';
      const response = await fetch(`${API}${endpoint}?limit=20`, {
      });

      if (!response.ok) throw new Error('Failed to fetch feed');

      const data = await response.json();
      setVideos(data.videos || []);
    } catch (error) {
      // console.error('Error fetching feed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleVideoClick = (videoId) => {
    navigate(`/my-vibez/watch/${videoId}`);
  };

  const handleVideoUploaded = (videoData) => {
    success('Video uploaded successfully! 🎬', 'Upload Complete');
    setShowRecorder(false);
    fetchFeed(); // Refresh feed
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 pt-20 pb-8 px-4">
      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {/* Video Recorder Modal */}
      {showRecorder && (
        <VideoRecorder
          isOpen={showRecorder}
          onClose={() => setShowRecorder(false)}
          onVideoUploaded={handleVideoUploaded}
        />
      )}

      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <motion.h1
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-5xl font-black text-white mb-2 flex items-center gap-3"
          >
            <Video className="w-12 h-12 text-fuchsia-400" />
            MY VIBEZ
          </motion.h1>
          <p className="text-white/70 text-lg">Share your moments • Connect with creators • Discover content</p>
        </div>

        {/* Tabs + Create Button */}
        <div className="flex items-center justify-between mb-6">
          {/* Feed Tabs */}
          <div className="flex gap-2 backdrop-blur-xl bg-white/5 p-1 rounded-2xl border border-white/10">
            <button
              onClick={() => setActiveTab('for-you')}
              className={`
                px-6 py-3 rounded-xl font-bold transition-all flex items-center gap-2
                ${activeTab === 'for-you'
                  ? 'bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white shadow-[0_0_20px_rgba(232,121,249,0.6)]'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
                }
              `}
            >
              <TrendingUp size={18} />
              For You
            </button>
            <button
              onClick={() => setActiveTab('following')}
              className={`
                px-6 py-3 rounded-xl font-bold transition-all flex items-center gap-2
                ${activeTab === 'following'
                  ? 'bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white shadow-[0_0_20px_rgba(232,121,249,0.6)]'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
                }
              `}
            >
              <Users size={18} />
              Following
            </button>
          </div>

          {/* Create Video Button */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowRecorder(true)}
            className="px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-bold rounded-2xl shadow-[0_0_30px_rgba(16,185,129,0.6)] flex items-center gap-2"
          >
            <Plus size={20} />
            Create Video
          </motion.button>
        </div>

        {/* Video Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-6xl mb-4 animate-pulse">🎬</div>
            <div className="text-white/70">Loading videos...</div>
          </div>
        ) : videos.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-8xl mb-4">📹</div>
            <h3 className="text-2xl font-bold text-white mb-2">
              {activeTab === 'following' ? 'No videos from people you follow' : 'No videos yet'}
            </h3>
            <p className="text-white/60 mb-6">
              {activeTab === 'following' 
                ? 'Start following creators to see their content here'
                : 'Be the first to share a video!'}
            </p>
            <button
              onClick={() => setShowRecorder(true)}
              className="px-8 py-4 bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white font-bold rounded-xl hover:from-fuchsia-500 hover:to-pink-500 transition-all"
            >
              Create First Video
            </button>
          </div>
        ) : (
          <VideoGrid videos={videos} onVideoClick={handleVideoClick} />
        )}
      </div>
    </div>
  );
}
