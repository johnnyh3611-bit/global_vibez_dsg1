import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Heart } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

/**
 * Comments Modal for My Vibez content
 */
export default function VibezComments({ contentId, isOpen, onClose, initialCount }) {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  
  const userId = localStorage.getItem('user_id') || 'demo_user';
  const username = localStorage.getItem('username') || 'Player';

  useEffect(() => {
    if (isOpen && contentId) {
      loadComments();
    }
  }, [isOpen, contentId]);

  const loadComments = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API}/api/vibez/comments/${contentId}`);
      const data = await response.json();
      
      if (data.success) {
        setComments(data.comments);
      }
    } catch (err) {
      // console.error('Failed to load comments:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSendComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim() || sending) return;

    setSending(true);
    try {
      const response = await fetch(`${API}/api/vibez/comment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content_id: contentId,
          user_id: userId,
          username: username,
          comment_text: newComment.trim()
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setComments([data.comment, ...comments]);
        setNewComment('');
      }
    } catch (err) {
      // console.error('Failed to send comment:', err);
    } finally {
      setSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end md:items-center justify-center"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-gray-900 w-full md:max-w-2xl md:rounded-2xl max-h-[80vh] flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-700">
            <h3 className="text-xl font-bold text-white">
              Comments ({comments.length})
            </h3>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-800 rounded-full transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          {/* Comments List */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {loading ? (
              <div className="text-center py-12">
                <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-gray-400 mt-4">Loading comments...</p>
              </div>
            ) : comments.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-400">No comments yet</p>
                <p className="text-gray-500 text-sm mt-2">Be the first to comment!</p>
              </div>
            ) : (
              comments.map((comment) => (
                <motion.div
                  key={comment.comment_id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex gap-3"
                >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-purple-500 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-white font-semibold">{comment.username}</p>
                      <p className="text-gray-500 text-xs">
                        {new Date(comment.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <p className="text-gray-300">{comment.comment_text}</p>
                    <button className="text-gray-500 text-sm mt-2 hover:text-cyan-400 transition-colors flex items-center gap-1">
                      <Heart className="w-4 h-4" />
                      {comment.likes_count > 0 && comment.likes_count}
                    </button>
                  </div>
                </motion.div>
              ))
            )}
          </div>

          {/* Comment Input */}
          <form onSubmit={handleSendComment} className="p-6 border-t border-gray-700">
            <div className="flex gap-3">
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add a comment..."
                className="flex-1 px-4 py-3 rounded-full bg-gray-800 border-2 border-gray-700 text-white focus:border-cyan-500 focus:outline-none"
                maxLength={200}
              />
              <button
                type="submit"
                disabled={!newComment.trim() || sending}
                className="px-6 py-3 rounded-full bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-bold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
