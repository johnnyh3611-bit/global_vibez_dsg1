import { motion } from 'framer-motion';
import { Play, Heart, MessageCircle, Eye } from 'lucide-react';

export function VideoGrid({ videos, onVideoClick }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {videos.map((video, idx) => (
        <motion.div
          key={video.video_id}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: idx * 0.05 }}
          whileHover={{ scale: 1.05, y: -5 }}
          onClick={() => onVideoClick(video.video_id)}
          className="group cursor-pointer relative backdrop-blur-xl bg-white/5 rounded-2xl overflow-hidden border border-white/10 hover:border-fuchsia-400/60 transition-all duration-300"
        >
          {/* Thumbnail */}
          <div className="aspect-[9/16] relative overflow-hidden bg-gradient-to-br from-gray-800 to-gray-900">
            {video.thumbnail_url ? (
              <img
                src={`${process.env.REACT_APP_BACKEND_URL}${video.thumbnail_url}`}
                alt={video.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Play className="w-16 h-16 text-white/40" />
              </div>
            )}

            {/* Play Overlay on Hover */}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <motion.div
                initial={{ scale: 0.8 }}
                whileHover={{ scale: 1.2 }}
                className="w-16 h-16 rounded-full bg-fuchsia-600 flex items-center justify-center shadow-[0_0_30px_rgba(232,121,249,0.8)]"
              >
                <Play className="w-8 h-8 text-white ml-1" fill="white" />
              </motion.div>
            </div>

            {/* Duration Badge */}
            <div className="absolute top-2 right-2 px-2 py-1 bg-black/80 backdrop-blur-sm rounded-lg text-white text-xs font-bold">
              {formatDuration(video.duration)}
            </div>
          </div>

          {/* Video Info */}
          <div className="p-3">
            {/* Creator */}
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-fuchsia-500 to-pink-500 flex items-center justify-center text-white font-bold text-sm">
                {video.creator_avatar ? (
                  <img
                    src={video.creator_avatar}
                    alt={video.creator_name}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  video.creator_name[0]
                )}
              </div>
              <span className="text-white/80 text-sm font-medium truncate">
                {video.creator_name}
              </span>
            </div>

            {/* Title */}
            <h3 className="text-white font-bold text-sm mb-2 line-clamp-2">
              {video.title}
            </h3>

            {/* Hashtags */}
            {video.hashtags && video.hashtags.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {video.hashtags.slice(0, 2).map((tag, i) => (
                  <span
                    key={`item-${i}`}
                    className="text-cyan-400 text-xs font-medium"
                  >
                    #{tag}
                  </span>
                ))}
                {video.hashtags.length > 2 && (
                  <span className="text-white/40 text-xs">
                    +{video.hashtags.length - 2}
                  </span>
                )}
              </div>
            )}

            {/* Stats */}
            <div className="flex items-center gap-3 text-white/60 text-xs">
              <div className="flex items-center gap-1">
                <Eye size={14} />
                {formatNumber(video.views_count)}
              </div>
              <div className="flex items-center gap-1">
                <Heart size={14} />
                {formatNumber(video.likes_count)}
              </div>
              <div className="flex items-center gap-1">
                <MessageCircle size={14} />
                {formatNumber(video.comments_count)}
              </div>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatNumber(num) {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}
