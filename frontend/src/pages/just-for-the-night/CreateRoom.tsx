import { useState } from "react";
import { motion } from "framer-motion";
import { Upload, Sparkles, Save } from "lucide-react";
import { useNavigate } from "react-router-dom";
import DirectUpload from "@/components/uploads/DirectUpload";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export const CreateRoom = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    preview_image_url: "",
    stream_url: "",
    settings: {
      dealer_type: "founder_ai",
      challenge_game: "blackjack",
      entry_tokens: 100,
      challenge_difficulty: "medium",
      room_theme: "neon_nights",
      enable_watermark: true
    }
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch(
        `${BACKEND_URL}/api/just-for-the-night/rooms/create`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          
          body: JSON.stringify(formData)
        }
      );

      const data = await response.json();

      if (data.success) {
        alert("Room created successfully!");
        navigate(`/just-for-the-night/room/${data.room_id}`);
      } else {
        alert("Failed to create room");
      }
    } catch (error) {
      // console.error("Error creating room:", error);
      alert("Error creating room");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-purple-900/10 to-gray-900 py-20 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-5xl font-black tracking-tighter uppercase italic bg-gradient-to-r from-pink-400 via-purple-400 to-pink-400 text-transparent bg-clip-text mb-8 text-center">
          Create Your Room
        </h1>

        <form onSubmit={handleSubmit} className="bg-gray-800/50 rounded-2xl p-8 backdrop-blur-sm space-y-6">
          {/* Basic Info */}
          <div>
            <label className="block text-white font-semibold mb-2">Room Title</label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white focus:outline-none focus:border-purple-500"
              placeholder="My Exclusive Room"
            />
          </div>

          <div>
            <label className="block text-white font-semibold mb-2">Description</label>
            <textarea
              required
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white focus:outline-none focus:border-purple-500 h-24"
              placeholder="Describe your room experience..."
            />
          </div>

          {/* Media uploads — direct in-app, no external URLs */}
          <div>
            <label className="block text-white font-semibold mb-2">Preview Image</label>
            <DirectUpload
              kind="cover"
              accept="image"
              cameraCapture
              value={formData.preview_image_url}
              onChange={(u) => setFormData({ ...formData, preview_image_url: u })}
              testid="jftn-preview-upload"
            />
          </div>

          <div>
            <label className="block text-white font-semibold mb-2">Stream / Video *</label>
            <DirectUpload
              kind="walkthrough"
              accept="video"
              cameraCapture
              value={formData.stream_url}
              onChange={(u) => setFormData({ ...formData, stream_url: u })}
              testid="jftn-stream-upload"
            />
            <p className="text-sm text-gray-400 mt-1">Video file (will be blurred until challenge completed)</p>
          </div>

          {/* Settings */}
          <div className="border-t border-gray-700 pt-6">
            <h3 className="text-xl font-bold text-white mb-4">Room Settings</h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-white font-semibold mb-2">Dealer Type</label>
                <select
                  value={formData.settings.dealer_type}
                  onChange={(e) => setFormData({
                    ...formData,
                    settings: { ...formData.settings, dealer_type: e.target.value }
                  })}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white focus:outline-none focus:border-purple-500"
                >
                  <option value="founder_ai">🌟 Founder AI (Bonus Vibez Coins)</option>
                  <option value="personal_avatar">👤 Personal Avatar</option>
                  <option value="ghost_dealer">👻 Ghost Dealer</option>
                </select>
              </div>

              <div>
                <label className="block text-white font-semibold mb-2">Challenge Game</label>
                <select
                  value={formData.settings.challenge_game}
                  onChange={(e) => setFormData({
                    ...formData,
                    settings: { ...formData.settings, challenge_game: e.target.value }
                  })}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white focus:outline-none focus:border-purple-500"
                >
                  <option value="blackjack">🎴 Blackjack</option>
                  <option value="poker">♠️ Poker</option>
                  <option value="roulette">🎰 Roulette</option>
                </select>
              </div>

              <div>
                <label className="block text-white font-semibold mb-2">Entry Price (Vibez Coins)</label>
                <select
                  value={formData.settings.entry_tokens}
                  onChange={(e) => setFormData({
                    ...formData,
                    settings: { ...formData.settings, entry_tokens: parseInt(e.target.value) }
                  })}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white focus:outline-none focus:border-purple-500"
                  data-testid="create-room-coin-tier"
                >
                  <option value={100}>₵100 · Lounge</option>
                  <option value={500}>₵500 · VIP</option>
                  <option value={1000}>₵1,000 · Inner Circle</option>
                  <option value={2500}>₵2,500 · Black Card</option>
                  <option value={5000}>₵5,000 · Founder Tier</option>
                </select>
                <p className="text-xs text-gray-400 mt-1">
                  You'll receive 70% (₵{Math.floor(formData.settings.entry_tokens * 0.7).toLocaleString()}) per visit · 72h escrow before payout
                </p>
              </div>

              <div>
                <label className="block text-white font-semibold mb-2">Difficulty</label>
                <select
                  value={formData.settings.challenge_difficulty}
                  onChange={(e) => setFormData({
                    ...formData,
                    settings: { ...formData.settings, challenge_difficulty: e.target.value }
                  })}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white focus:outline-none focus:border-purple-500"
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2">
              <input
                type="checkbox"
                id="watermark"
                checked={formData.settings.enable_watermark}
                onChange={(e) => setFormData({
                  ...formData,
                  settings: { ...formData.settings, enable_watermark: e.target.checked }
                })}
                className="w-5 h-5 rounded border-gray-600 text-purple-500 focus:ring-purple-500"
              />
              <label htmlFor="watermark" className="text-white">
                Enable anti-recording watermark
              </label>
            </div>
          </div>

          {/* Submit */}
          <div className="flex gap-4 pt-6">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex-1 px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-xl font-semibold text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 rounded-xl font-bold text-white shadow-lg shadow-pink-500/50 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                "Creating..."
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Create Room
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateRoom;