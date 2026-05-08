
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Radio, Users, Eye, TrendingUp, Play, Maximize2, Volume2, Heart, MessageCircle, Share2, Filter, Loader } from 'lucide-react';
import UnifiedNavigation from '../components/hub/UnifiedNavigation';
import { useStreamSocket } from '../hooks/useStreamSocket';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const LiveStreamingPage = () => {
  const navigate = useNavigate();
  const [selectedStream, setSelectedStream] = useState(null);
  const [filter, setFilter] = useState('all'); // all, gaming, music, social
  const [liveStreams, setLiveStreams] = useState([]);
  const [categories, setCategories] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  // WebSocket for real-time stream updates
  const { 
    isConnected: socketConnected, 
    viewerCount, 
    joinStream, 
    leaveStream,
    onViewerJoined,
    onViewerLeft 
  } = useStreamSocket('current_user', 'Demo User');

  // Fetch live streams from backend
  useEffect(() => {
    fetchLiveStreams();
  }, [filter]);

  // Real-time viewer count updates
  useEffect(() => {
    const unsubJoin = onViewerJoined((data) => {
      // Update viewer count in real-time
      if (selectedStream) {
        setSelectedStream(prev => ({
          ...prev,
          viewers: data.viewer_count
        }));
      }
    });

    const unsubLeave = onViewerLeft((data) => {
      if (selectedStream) {
        setSelectedStream(prev => ({
          ...prev,
          viewers: data.viewer_count
        }));
      }
    });

    return () => {
      unsubJoin();
      unsubLeave();
    };
  }, [onViewerJoined, onViewerLeft, selectedStream]);

  // Handle stream selection and WebSocket join
  const handleStreamClick = async (stream) => {
    setSelectedStream(stream);
    
    try {
      await joinStream(stream.id);
    } catch (error) {
      // console.error('Failed to join stream:', error);
    }
  };

  // Handle closing stream modal
  const handleCloseStream = async () => {
    if (selectedStream) {
      try {
        await leaveStream(selectedStream.id);
      } catch (error) {
        // console.error('Failed to leave stream:', error);
      }
    }
    setSelectedStream(null);
  };

  const fetchLiveStreams = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/api/streaming/live-feeds?category=${filter}&limit=20`);
      const data = await response.json();
      
      if (data.streams) {
        setLiveStreams(data.streams);
        setCategories(data.categories || {});
      }
    } catch (error) {
      // console.error('Failed to fetch streams:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredStreams = liveStreams;

  const categoryList = [
    { id: 'all', label: 'All', icon: Radio, count: categories.all || 0 },
    { id: 'gaming', label: 'Gaming', icon: Play, count: categories.gaming || 0 },
    { id: 'music', label: 'Music', icon: Volume2, count: categories.music || 0 },
    { id: 'social', label: 'Social', icon: MessageCircle, count: categories.social || 0 }
  ];

  return (
    <div className="min-h-screen bg-[#0A0A0A]">
      <UnifiedNavigation />

      {/* Featured Stream Banner */}
      {selectedStream ? (
        <div className="fixed inset-0 z-40 bg-black/95 flex items-center justify-center p-4" onClick={handleCloseStream}>
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-[#0A0A0A] border-2 border-white/20 rounded-3xl overflow-hidden max-w-6xl w-full"
          >
            {/* Stream Player */}
            <div className="relative aspect-video bg-gradient-to-br from-purple-900 to-blue-900 flex items-center justify-center">
              <div className="text-9xl">{selectedStream.thumbnail}</div>
              
              {/* Live Indicator */}
              <div className="absolute top-4 left-4 bg-red-600 px-4 py-2 rounded-full flex items-center gap-2">
                <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                <span className="text-white text-sm font-bold">LIVE</span>
              </div>

              {/* Viewer Count (Real-time) */}
              <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md px-4 py-2 rounded-full flex items-center gap-2">
                <Eye className="w-4 h-4 text-white" />
                <span className="text-white text-sm font-bold">
                  {(socketConnected && viewerCount > 0 ? viewerCount : selectedStream.viewers).toLocaleString()}
                </span>
              </div>

              {/* Controls */}
              <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    className="w-12 h-12 bg-white/20 hover:bg-white/30 backdrop-blur-md rounded-full flex items-center justify-center transition-all"
                  >
                    <Play className="w-6 h-6 text-white" />
                  </motion.button>
                  <div className="text-white text-sm font-bold">{selectedStream.duration}</div>
                </div>

                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  className="w-12 h-12 bg-white/20 hover:bg-white/30 backdrop-blur-md rounded-full flex items-center justify-center transition-all"
                >
                  <Maximize2 className="w-6 h-6 text-white" />
                </motion.button>
              </div>
            </div>

            {/* Stream Info */}
            <div className="p-6 border-t border-white/10">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-16 h-16 bg-gradient-to-br from-cyan-500 to-purple-500 rounded-full flex items-center justify-center text-3xl">
                  {selectedStream.hostAvatar}
                </div>
                <div className="flex-1">
                  <h2 className="text-white font-black text-2xl mb-2">{selectedStream.title}</h2>
                  <p className="text-white/60 text-sm">{selectedStream.host}</p>
                </div>
              </div>

              <div className="flex gap-3">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="flex-1 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all"
                >
                  <Heart className="w-5 h-5" />
                  Follow
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="px-6 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl flex items-center gap-2 transition-all"
                >
                  <Share2 className="w-5 h-5" />
                </motion.button>
              </div>
            </div>
          </motion.div>
        </div>
      ) : null}

      {/* Main Content */}
      <div className="pt-20 sm:pt-24 pb-12 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto">
          
          {/* Header */}
          <div className="mb-8">
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-4xl sm:text-5xl lg:text-6xl font-black text-white mb-4 bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent"
            >
              Live Now
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-white/60 text-lg sm:text-xl"
            >
              Watch live gameplay, DJ sets, and social hangouts.
            </motion.p>
          </div>

          {/* Category Filters */}
          <div className="mb-8">
            <div className="flex items-center gap-3 overflow-x-auto pb-2">
              {categoryList.map(cat => {
                const Icon = cat.icon;
                const isActive = filter === cat.id;
                
                return (
                  <motion.button
                    key={cat.id}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setFilter(cat.id)}
                    className={`flex items-center gap-2 px-6 py-3 rounded-full font-bold text-sm transition-all whitespace-nowrap ${
                      isActive
                        ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                        : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {cat.label}
                    <span className={`px-2 py-0.5 rounded-full text-xs ${
                      isActive ? 'bg-white/20' : 'bg-white/10'
                    }`}>
                      {cat.count}
                    </span>
                  </motion.button>
                );
              })}
            </div>
          </div>

          {/* Live Streams Grid */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <Loader className="w-12 h-12 text-purple-400 animate-spin mx-auto mb-4" />
                <p className="text-white/60 text-lg">Loading live streams...</p>
              </div>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredStreams.map((stream, index) => (
              <motion.div
                key={stream.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                whileHover={{ scale: 1.02 }}
                onClick={() => handleStreamClick(stream)}
                className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden cursor-pointer group"
              >
                {/* Thumbnail */}
                <div className="relative aspect-video bg-gradient-to-br from-purple-900 to-blue-900 flex items-center justify-center">
                  <div className="text-7xl">{stream.thumbnail}</div>
                  
                  {/* Live Badge */}
                  <div className="absolute top-3 left-3 bg-red-600 px-3 py-1 rounded-full flex items-center gap-2">
                    <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                    <span className="text-white text-xs font-bold">LIVE</span>
                  </div>

                  {/* Viewers */}
                  <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full flex items-center gap-1">
                    <Eye className="w-3 h-3 text-white" />
                    <span className="text-white text-xs font-bold">{stream.viewers.toLocaleString()}</span>
                  </div>

                  {/* Duration */}
                  <div className="absolute bottom-3 right-3 bg-black/60 backdrop-blur-md px-2 py-1 rounded">
                    <span className="text-white text-xs font-bold">{stream.duration}</span>
                  </div>

                  {/* Play Overlay */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center">
                      <Play className="w-8 h-8 text-white" />
                    </div>
                  </div>
                </div>

                {/* Stream Info */}
                <div className="p-4">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-purple-500 rounded-full flex items-center justify-center text-lg flex-shrink-0">
                      {stream.hostAvatar}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-white font-bold text-sm mb-1 line-clamp-2 leading-tight">
                        {stream.title}
                      </h3>
                      <p className="text-white/60 text-xs">{stream.host}</p>
                    </div>
                  </div>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-2">
                    {stream.tags.slice(0, 2).map(tag => (
                      <span 
                        key={tag}
                        className="bg-white/10 px-2 py-1 rounded text-white/70 text-xs"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </motion.div>
            ))}
            </div>
          )}

          {/* Empty State */}
          {filteredStreams.length === 0 && (
            <div className="text-center py-20">
              <Radio className="w-16 h-16 text-white/20 mx-auto mb-4" />
              <h3 className="text-white/60 text-lg font-bold mb-2">No live streams in this category</h3>
              <p className="text-white/40 text-sm">Check back later or try another category!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LiveStreamingPage;
