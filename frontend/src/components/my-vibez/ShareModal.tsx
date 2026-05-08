import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Copy, Check, Facebook, Twitter, MessageCircle } from 'lucide-react';
import { GlassCard } from '../GlassCard';

export function ShareModal({ isOpen, onClose, videoId, videoTitle }) {
  const [copied, setCopied] = useState(false);

  const shareUrl = `${window.location.origin}/my-vibez/watch/${videoId}`;

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      // console.error('Failed to copy:', error);
    }
  };

  const shareToSocial = (platform) => {
    const encodedUrl = encodeURIComponent(shareUrl);
    const encodedTitle = encodeURIComponent(videoTitle);

    const urls = {
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      twitter: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`,
      whatsapp: `https://wa.me/?text=${encodedTitle}%20${encodedUrl}`
    };

    window.open(urls[platform], '_blank', 'width=600,height=400');
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 backdrop-blur-xl flex items-center justify-center z-[200] p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="max-w-md w-full"
        >
          <GlassCard variant="gaming" className="p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-black text-white">Share Video</h2>
              <button
                onClick={onClose}
                className="text-white/60 hover:text-white transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            {/* Copy Link */}
            <div className="mb-6">
              <label className="text-white/70 text-sm mb-2 block">Video Link</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={shareUrl}
                  readOnly
                  className="flex-1 bg-white/5 border-2 border-white/20 rounded-xl px-4 py-3 text-white text-sm focus:outline-none"
                />
                <button
                  onClick={copyToClipboard}
                  className={`px-6 py-3 rounded-xl font-bold transition-all flex items-center gap-2 ${
                    copied
                      ? 'bg-gradient-to-r from-green-600 to-emerald-600'
                      : 'bg-gradient-to-r from-fuchsia-600 to-pink-600 hover:from-fuchsia-500 hover:to-pink-500'
                  }`}
                >
                  {copied ? (
                    <>
                      <Check size={18} className="text-white" />
                      <span className="text-white">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={18} className="text-white" />
                      <span className="text-white">Copy</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Social Share Buttons */}
            <div>
              <label className="text-white/70 text-sm mb-3 block">Share to Social Media</label>
              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={() => shareToSocial('facebook')}
                  className="backdrop-blur-xl bg-white/5 border-2 border-white/20 rounded-xl p-4 hover:border-blue-400/60 hover:bg-blue-500/10 transition-all flex flex-col items-center gap-2"
                >
                  <Facebook className="w-8 h-8 text-blue-400" />
                  <span className="text-white text-xs font-bold">Facebook</span>
                </button>

                <button
                  onClick={() => shareToSocial('twitter')}
                  className="backdrop-blur-xl bg-white/5 border-2 border-white/20 rounded-xl p-4 hover:border-cyan-400/60 hover:bg-cyan-500/10 transition-all flex flex-col items-center gap-2"
                >
                  <Twitter className="w-8 h-8 text-cyan-400" />
                  <span className="text-white text-xs font-bold">Twitter</span>
                </button>

                <button
                  onClick={() => shareToSocial('whatsapp')}
                  className="backdrop-blur-xl bg-white/5 border-2 border-white/20 rounded-xl p-4 hover:border-green-400/60 hover:bg-green-500/10 transition-all flex flex-col items-center gap-2"
                >
                  <MessageCircle className="w-8 h-8 text-green-400" />
                  <span className="text-white text-xs font-bold">WhatsApp</span>
                </button>
              </div>
            </div>
          </GlassCard>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
