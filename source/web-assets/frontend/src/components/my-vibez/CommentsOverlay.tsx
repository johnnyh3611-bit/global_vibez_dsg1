
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

export function CommentsOverlay({ isOpen, onClose, videoId, onCommentAdded }) {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchComments();
    }
  }, [isOpen, videoId]);

  const fetchComments = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API}/api/my-vibez/video/${videoId}/comments`, {
      });
      if (!response.ok) throw new Error('Failed to fetch comments');
      const data = await response.json();
      setComments(data.comments || []);
    } catch (error) {
      // console.error('Error fetching comments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendComment = async () => {
    if (!newComment.trim()) return;

    setSending(true);
    try {
      const response = await fetch(`${API}/api/my-vibez/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        
        body: JSON.stringify({
          video_id: videoId,
          text: newComment.trim()
        })
      });

      if (!response.ok) throw new Error('Failed to post comment');

      const comment = await response.json();
      setComments([comment, ...comments]);
      setNewComment('');
      onCommentAdded?.();
    } catch (error) {
      // console.error('Error posting comment:', error);
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendComment();
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed inset-0 z-[100] flex items-end"
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Comments Panel */}
        <div className="relative w-full max-h-[80vh] bg-gradient-to-b from-gray-900 to-black rounded-t-3xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-white/10">
            <h3 className="text-white font-bold text-lg">
              {comments.length} {comments.length === 1 ? 'Comment' : 'Comments'}
            </h3>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-all"
            >
              <X size={18} />
            </button>
          </div>

          {/* Comments List */}
          <div className="overflow-y-auto max-h-[calc(80vh-140px)] p-4 space-y-4">
            {loading ? (
              <div className="text-center py-8 text-white/60">Loading comments...</div>
            ) : comments.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-5xl mb-2">💬</div>
                <p className="text-white/60">No comments yet. Be the first!</p>
              </div>
            ) : (
              comments.map((comment) => (
                <div key={comment.comment_id} className="flex gap-3">
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-fuchsia-500 to-pink-500 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {comment.user_avatar ? (
                      <img src={comment.user_avatar} alt={comment.username} className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <span className="text-white font-bold">{comment.username[0]}</span>
                    )}
                  </div>

                  {/* Comment Content */}
                  <div className="flex-1">
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="text-white font-bold text-sm">{comment.username}</span>
                      <span className="text-white/40 text-xs">{formatTimeAgo(comment.created_at)}</span>
                    </div>
                    <p className="text-white/90 text-sm">{comment.text}</p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Input Box */}
          <div className="p-4 border-t border-white/10 bg-black/40 backdrop-blur-xl">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Add a comment..."
                maxLength={500}
                disabled={sending}
                className="flex-1 bg-white/10 border-2 border-white/20 rounded-2xl px-4 py-3 text-white placeholder-white/40 focus:border-fuchsia-400 focus:outline-none transition-all disabled:opacity-50"
              />
              <button
                onClick={handleSendComment}
                disabled={!newComment.trim() || sending}
                className="w-12 h-12 rounded-full bg-gradient-to-br from-fuchsia-600 to-pink-600 flex items-center justify-center text-white disabled:opacity-50 disabled:cursor-not-allowed hover:from-fuchsia-500 hover:to-pink-500 transition-all shadow-[0_0_20px_rgba(232,121,249,0.6)]"
              >
                {sending ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                  />
                ) : (
                  <Send size={18} />
                )}
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

function formatTimeAgo(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
}
