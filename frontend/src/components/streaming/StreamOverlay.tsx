import React, { useState, useEffect } from 'react';
import { Flame, Sparkles, TrendingUp } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const StreamOverlay = ({ streamerName, streamId }) => {
  const [vibeCredits, setVibeCredits] = useState(500);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    // Fetch user's Vibe Credits balance
    fetchCreditsBalance();
  }, []);

  const fetchCreditsBalance = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_URL}/api/auth/me`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (response.ok) {
        const userData = await response.json();
        setVibeCredits(userData.vibe_credits || 500);
      }
    } catch (error) {
      // console.error('Error fetching credits:', error);
    }
  };

  const sendInteractiveVibe = async (giftType, cost, name) => {
    if (sending) return;
    
    if (vibeCredits < cost) {
      alert('Insufficient Vibe Credits! Purchase more in your profile.');
      return;
    }

    setSending(true);

    try {
      const response = await fetch(`${API_URL}/api/streaming/send-gift`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        
        body: JSON.stringify({
          stream_id: streamId,
          gift_type: giftType,
          message: null
        })
      });

      if (!response.ok) {
        throw new Error('Failed to send gift');
      }

      const data = await response.json();

      if (data.success) {
        setVibeCredits(data.new_balance);
        
        // Show success notification
        alert(`✨ Sent ${name} to ${streamerName}!`);
      } else {
        throw new Error(data.message || 'Failed to send gift');
      }

    } catch (error) {
      // console.error('Error sending gift:', error);
      alert('Failed to send gift. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="absolute bottom-5 right-5 flex flex-col gap-3 p-4 bg-black/60 rounded-xl border border-blue-500/50 backdrop-blur-md shadow-2xl z-50 max-w-xs">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-blue-300 font-bold uppercase tracking-widest flex items-center gap-1">
          <Sparkles className="w-4 h-4" />
          Interactive Vibez
        </p>
        <TrendingUp className="w-4 h-4 text-green-400" />
      </div>
      
      {/* Game Influence Button */}
      <button 
        onClick={() => sendInteractiveVibe('LAVA_BOARD', 50, '🔥 Lava Chess Floor')}
        disabled={sending || vibeCredits < 50}
        className="bg-gradient-to-r from-orange-600 to-red-600 px-4 py-3 rounded-lg text-white font-bold hover:scale-105 transition-transform disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-orange-500/30"
      >
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Flame className="w-5 h-5" />
            Lava Chess Floor
          </span>
          <span className="text-sm opacity-80">50c</span>
        </div>
      </button>

      {/* Social Gift Buttons */}
      <button 
        onClick={() => sendInteractiveVibe('CHAMPAGNE_POP', 100, '🍾 Champagne Pop')}
        disabled={sending || vibeCredits < 100}
        className="bg-gradient-to-r from-yellow-400 to-yellow-600 px-4 py-3 rounded-lg text-black font-bold hover:scale-105 transition-transform disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-yellow-500/30"
      >
        <div className="flex items-center justify-between">
          <span>🍾 Champagne Pop</span>
          <span className="text-sm opacity-80">100c</span>
        </div>
      </button>

      <button 
        onClick={() => sendInteractiveVibe('GOLDEN_AURA', 200, '✨ Golden Aura')}
        disabled={sending || vibeCredits < 200}
        className="bg-gradient-to-r from-yellow-500 to-orange-500 px-4 py-3 rounded-lg text-white font-bold hover:scale-105 transition-transform disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-yellow-500/30"
      >
        <div className="flex items-center justify-between">
          <span>✨ Golden Aura</span>
          <span className="text-sm opacity-80">200c</span>
        </div>
      </button>

      <button 
        onClick={() => sendInteractiveVibe('NEON_BOMB', 150, '💥 Neon Bomb')}
        disabled={sending || vibeCredits < 150}
        className="bg-gradient-to-r from-pink-500 to-purple-600 px-4 py-3 rounded-lg text-white font-bold hover:scale-105 transition-transform disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-pink-500/30"
      >
        <div className="flex items-center justify-between">
          <span>💥 Neon Bomb</span>
          <span className="text-sm opacity-80">150c</span>
        </div>
      </button>

      {/* Credits Balance */}
      <div className="mt-2 pt-3 border-t border-blue-500/30">
        <div className="flex items-center justify-between">
          <span className="text-gray-400 text-xs">Your Balance:</span>
          <span className="text-cyan-400 text-lg font-mono font-bold">{vibeCredits} Credits</span>
        </div>
        {vibeCredits < 100 && (
          <p className="text-red-400 text-xs mt-1">Low balance! Purchase more credits</p>
        )}
      </div>

      {sending && (
        <div className="absolute inset-0 bg-black/50 rounded-xl flex items-center justify-center">
          <div className="text-white text-sm">Sending...</div>
        </div>
      )}
    </div>
  );
};

export default StreamOverlay;
