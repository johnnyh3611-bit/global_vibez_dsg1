import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Users, Eye, TrendingUp, Gamepad2, Heart, Radio } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const CATEGORY_ICONS = {
  gaming: Gamepad2,
  dating: Heart,
  social: Users,
  tournaments: TrendingUp
};

const StreamBrowser = () => {
  const navigate = useNavigate();
  const [streams, setStreams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('all');

  useEffect(() => {
    fetchLiveStreams();
    const interval = setInterval(fetchLiveStreams, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, [category]);

  const fetchLiveStreams = async () => {
    try {
      const url = category === 'all' 
        ? `${API_URL}/api/streaming/live-streams`
        : `${API_URL}/api/streaming/live-streams?category=${category}`;

      const response = await fetch(url);
      const data = await response.json();

      setStreams(data.streams || []);
    } catch (error) {
      // console.error('Error fetching streams:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleWatchStream = (streamId) => {
    navigate(`/stream/${streamId}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-black flex items-center justify-center">
        <div className="text-cyan-400 text-xl">Loading streams...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-black py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Radio className="w-8 h-8 text-red-500 animate-pulse" />
              <h1 className="text-5xl font-black bg-gradient-to-r from-red-400 via-pink-400 to-purple-500 bg-clip-text text-transparent">
                Live Streams
              </h1>
            </div>
            <p className="text-gray-300">Watch & support your favorite streamers</p>
          </div>

          <button
            onClick={() => navigate('/my-streams')}
            className="bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-400 hover:to-pink-400 text-white font-bold px-6 py-3 rounded-xl transition-all transform hover:scale-105 flex items-center gap-2"
          >
            <Play className="w-5 h-5" />
            Start Streaming
          </button>
        </div>

        {/* Category Filter */}
        <div className="flex flex-wrap gap-3 mb-8">
          {['all', 'gaming', 'dating', 'social', 'tournaments'].map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-6 py-3 rounded-lg font-bold transition-all ${
                category === cat
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {cat.charAt(0).toUpperCase() + cat.slice(1)}
            </button>
          ))}
        </div>

        {/* Live Indicator */}
        <div className="bg-red-500/20 border border-red-500 rounded-lg p-4 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
            <span className="text-red-400 font-bold">{streams.length} Live Streams</span>
          </div>
          <span className="text-gray-400 text-sm">Updates every 10 seconds</span>
        </div>

        {/* Streams Grid */}
        {streams.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {streams.map((stream) => {
              const CategoryIcon = CATEGORY_ICONS[stream.category] || Radio;

              return (
                <div
                  key={stream.stream_id}
                  onClick={() => handleWatchStream(stream.stream_id)}
                  className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl overflow-hidden hover:border-cyan-500 transition-all cursor-pointer transform hover:scale-105"
                >
                  {/* Thumbnail */}
                  <div className="relative h-48 bg-gradient-to-br from-purple-900 to-pink-900 flex items-center justify-center">
                    <Play className="w-16 h-16 text-white/50" />
                    
                    {/* Live Badge */}
                    <div className="absolute top-3 left-3 bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                      <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                      LIVE
                    </div>

                    {/* Viewer Count */}
                    <div className="absolute bottom-3 left-3 bg-black/70 text-white text-sm font-semibold px-3 py-1 rounded-full flex items-center gap-1">
                      <Eye className="w-4 h-4" />
                      {stream.viewer_count}
                    </div>

                    {/* Category */}
                    <div className="absolute top-3 right-3 bg-black/70 text-white text-xs font-semibold px-3 py-1 rounded-full flex items-center gap-1">
                      <CategoryIcon className="w-3 h-3" />
                      {stream.category}
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-4">
                    <h3 className="text-white font-bold text-lg mb-1 truncate">
                      {stream.title}
                    </h3>
                    <p className="text-gray-400 text-sm mb-3">
                      by {stream.streamer_name}
                    </p>

                    {stream.description && (
                      <p className="text-gray-500 text-xs mb-3 line-clamp-2">
                        {stream.description}
                      </p>
                    )}

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-green-400 font-semibold">
                        ${stream.total_earnings.toFixed(2)} earned
                      </span>
                      <span className="text-gray-400">
                        {stream.total_gifts_received} gifts
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-20">
            <Radio className="w-20 h-20 text-gray-600 mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-white mb-2">No Live Streams</h3>
            <p className="text-gray-400 mb-6">
              {category === 'all' 
                ? 'Be the first to go live!'
                : `No ${category} streams right now`}
            </p>
            <button
              onClick={() => navigate('/my-streams')}
              className="bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-400 hover:to-pink-400 text-white font-bold px-8 py-4 rounded-xl transition-all transform hover:scale-105 flex items-center gap-2 mx-auto"
            >
              <Play className="w-5 h-5" />
              Start Your Stream
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default StreamBrowser;
