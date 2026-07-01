import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Users, Video, Play } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

export default function BrowseStreamsPage() {
  const navigate = useNavigate();
  const [streams, setStreams] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStreams();
    const interval = setInterval(loadStreams, 10000);
    return () => clearInterval(interval);
  }, [selectedCategory]);

  const loadStreams = async () => {
    try {
      const url = selectedCategory
        ? `${API}/api/live-streaming/streams/active?category=${selectedCategory}`
        : `${API}/api/live-streaming/streams/active`;
      
      const response = await fetch(url);
      const data = await response.json();

      if (data.success) {
        setStreams(data.streams);
      }
    } catch (error) {
      // console.error('Error loading streams:', error);
    } finally {
      setLoading(false);
    }
  };

  const categories = [
    { id: null, label: 'All', icon: '🌎' },
    { id: 'gaming', label: 'Gaming', icon: '🎮' },
    { id: 'dating', label: 'Dating', icon: '💕' },
    { id: 'casual', label: 'Casual', icon: '💬' },
    { id: 'music', label: 'Music', icon: '🎵' },
    { id: 'art', label: 'Art', icon: '🎨' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-950 via-black to-blue-950 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-red-400 via-pink-400 to-purple-400 bg-clip-text text-transparent">
            🔴 Live Now
          </h1>
          <p className="text-gray-400">Watch live streams from the community</p>
        </div>

        <div className="mb-8 flex gap-3 overflow-x-auto pb-2">
          {categories.map((cat) => (
            <motion.button
              key={cat.id || 'all'}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-6 py-3 rounded-xl font-semibold whitespace-nowrap transition-all ${
                selectedCategory === cat.id
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
                  : 'bg-black/40 border border-cyan-500/50 text-gray-300 hover:border-cyan-400'
              }`}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {cat.icon} {cat.label}
            </motion.button>
          ))}
        </div>

        <div className="mb-8">
          <motion.button
            onClick={() => navigate('/live-stream')}
            className="px-8 py-4 bg-gradient-to-r from-red-600 to-pink-600 rounded-xl font-bold text-white text-lg flex items-center gap-2"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            animate={{
              boxShadow: [
                '0 0 20px rgba(239, 68, 68, 0.5)',
                '0 0 40px rgba(239, 68, 68, 0.8)',
                '0 0 20px rgba(239, 68, 68, 0.5)'
              ]
            }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            <Video className="w-6 h-6" />
            Start Your Stream
          </motion.button>
        </div>

        {loading ? (
          <div className="text-center py-20">
            <div className="text-white text-xl">Loading streams...</div>
          </div>
        ) : streams.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-gray-400 text-xl mb-4">No live streams right now</div>
            <p className="text-gray-500">Be the first to go live!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {streams.map((stream) => (
              <motion.div
                key={stream.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ scale: 1.03 }}
                onClick={() => navigate(`/view-stream/${stream.id}`)}
                className="bg-black/40 backdrop-blur-xl border border-cyan-500/50 rounded-2xl overflow-hidden cursor-pointer group"
              >
                <div className="relative aspect-video bg-gradient-to-br from-purple-900 to-blue-900 flex items-center justify-center">
                  <motion.div
                    className="absolute top-3 left-3 px-3 py-1 bg-red-600 rounded-full font-bold text-white text-sm flex items-center gap-2"
                    animate={{ opacity: [1, 0.7, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    <div className="w-2 h-2 bg-white rounded-full" />
                    LIVE
                  </motion.div>

                  <div className="absolute top-3 right-3 px-3 py-1 bg-black/70 backdrop-blur rounded-full text-white text-sm flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    {stream.viewer_count}
                  </div>

                  <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur flex items-center justify-center">
                      <Play className="w-8 h-8 text-white" fill="white" />
                    </div>
                  </div>
                </div>

                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-purple-500 flex-shrink-0" />
                    
                    <div className="flex-1 min-w-0">
                      <h3 className="text-white font-bold line-clamp-2 mb-1">
                        {stream.title}
                      </h3>
                      <p className="text-gray-400 text-sm">{stream.streamer_name}</p>
                      <div className="mt-2 flex items-center gap-2">
                        <span className="px-2 py-1 bg-purple-600/20 border border-purple-500/50 rounded text-purple-300 text-xs">
                          {stream.category}
                        </span>
                        <span className="text-gray-500 text-xs">
                          {stream.total_messages || 0} messages
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}</div>
        )}
      </div>
    </div>
  );
}
