import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, PhoneOff, Video } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

export default function IncomingCallModal({ call, onAccept, onReject }) {
  const [ringing, setRinging] = useState(true);
  const audioRef = useRef(null);

  useEffect(() => {
    // Play ringtone (optional)
    if (audioRef.current) {
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  const handleAccept = async () => {
    setRinging(false);
    try {
      const response = await fetch(`${API}/api/video-call/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          call_id: call.call_id,
          user_id: localStorage.getItem('user_id')
        })
      });

      const data = await response.json();
      if (data.success) {
        onAccept(call);
      }
    } catch (error) {
      // console.error('Error accepting call:', error);
    }
  };

  const handleReject = async () => {
    setRinging(false);
    try {
      await fetch(`${API}/api/video-call/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          call_id: call.call_id,
          user_id: localStorage.getItem('user_id')
        })
      });

      onReject();
    } catch (error) {
      // console.error('Error rejecting call:', error);
      onReject();
    }
  };

  return (
    <AnimatePresence>
      {ringing && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            className="bg-gradient-to-br from-purple-900 via-black to-cyan-900 rounded-3xl p-8 max-w-md w-full border-2 border-cyan-500/50 shadow-2xl"
          >
            {/* Avatar */}
            <div className="flex justify-center mb-6">
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="w-24 h-24 rounded-full bg-gradient-to-br from-cyan-500 to-purple-500 flex items-center justify-center"
              >
                <Video className="w-12 h-12 text-white" />
              </motion.div>
            </div>

            {/* Caller Info */}
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-white mb-2">
                {call.caller_name || 'Unknown User'}
              </h2>
              <p className="text-cyan-300 text-lg">
                Incoming {call.call_type === 'video' ? 'Video' : 'Audio'} Call
              </p>
              <motion.p
                animate={{ opacity: [1, 0.5, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="text-gray-400 mt-2"
              >
                Ringing...
              </motion.p>
            </div>

            {/* Call Actions */}
            <div className="flex items-center justify-center gap-8" data-testid="incoming-call-actions">
              {/* Reject */}
              <motion.button
                onClick={handleReject}
                data-testid="reject-call-btn"
                className="w-20 h-20 rounded-full bg-red-600 flex items-center justify-center shadow-lg"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <PhoneOff className="w-8 h-8 text-white" />
              </motion.button>

              {/* Accept */}
              <motion.button
                onClick={handleAccept}
                data-testid="accept-call-btn"
                className="w-20 h-20 rounded-full bg-green-600 flex items-center justify-center shadow-lg"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                animate={{
                  boxShadow: [
                    '0 0 20px rgba(34, 197, 94, 0.5)',
                    '0 0 40px rgba(34, 197, 94, 0.8)',
                    '0 0 20px rgba(34, 197, 94, 0.5)'
                  ]
                }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                <Phone className="w-8 h-8 text-white" />
              </motion.button>
            </div>

            {/* Ringtone Audio (optional) */}
            <audio ref={audioRef} loop>
              <source src="/ringtone.mp3" type="audio/mpeg" />
            </audio>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
