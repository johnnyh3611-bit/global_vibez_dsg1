import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Sparkles } from "lucide-react";
import JustForTheNightRoom from "@/components/just-for-the-night/JustForTheNightRoom";
import PurchaseJFTNPassModal from "@/components/just-for-the-night/PurchaseJFTNPassModal";
import { authFetch } from "@/utils/secureAuth";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export const RoomPage = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [paid, setPaid] = useState(false);
  const [paidRoomData, setPaidRoomData] = useState(null);
  const [processing, setProcessing] = useState(false);

  // Solana-pass state for the alternative unlock path.
  const [solanaPass, setSolanaPass] = useState<any>(null);
  const [purchaseOpen, setPurchaseOpen] = useState(false);

  const fetchRoom = useCallback(async () => {
    try {
      const response = await fetch(
        `${BACKEND_URL}/api/just-for-the-night/rooms/${roomId}`,
        { }
      );
      
      const data = await response.json();
      
      if (data.success) {
        setRoom(data.room);
      }
    } catch (error) {
      console.error("Failed to fetch room:", error);
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  // Check for an active Solana pass for THIS room. If present, treat the user
  // as already paid so they can bypass the token-payment screen.
  const fetchSolanaPass = useCallback(async () => {
    if (!roomId) return;
    try {
      const res = await authFetch(
        `${BACKEND_URL}/api/jftn/passes/active?room_id=${roomId}`
      );
      if (!res.ok) return;
      const data = await res.json();
      if (data.has_active_pass) {
        setSolanaPass(data.pass);
        // Auto-unlock the room view since they're already paid via Solana.
        setPaid(true);
        setPaidRoomData((prev) =>
          prev || { ...(room || {}), unlocked_via: "solana_pass" }
        );
      }
    } catch {
      // Anonymous users hit 401 — silently ignore.
    }
  }, [roomId, room]);

  useEffect(() => {
    fetchRoom();
  }, [fetchRoom]);

  useEffect(() => {
    fetchSolanaPass();
  }, [fetchSolanaPass]);

  const handlePayAndEnter = async () => {
    setProcessing(true);
    
    try {
      const response = await fetch(
        `${BACKEND_URL}/api/just-for-the-night/rooms/join-transaction`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          
          body: JSON.stringify({
            room_id: roomId
          })
        }
      );

      const data = await response.json();

      if (response.ok && data.status === "paid") {
        setPaid(true);
        setPaidRoomData({
          ...room,
          stream_url: data.room.stream_url,
          watermark_id: data.room.watermark_id,
          challenge: data.challenge,
          transaction_id: data.transaction_id
        });
      } else {
        alert(data.detail || "Payment failed");
      }
    } catch (error) {
      // console.error("Payment error:", error);
      alert("Payment failed. Please try again.");
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
      </div>
    );
  }

  if (!room) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Room not found</h2>
          <button
            onClick={() => navigate("/just-for-the-night")}
            className="px-6 py-3 bg-purple-500 hover:bg-purple-600 rounded-xl text-white font-semibold transition-colors"
          >
            Back to Discovery
          </button>
        </div>
      </div>
    );
  }

  if (!paid) {
    // Payment/Preview Page
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 via-purple-900/10 to-gray-900 py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => navigate("/just-for-the-night")}
            className="flex items-center gap-2 text-gray-400 hover:text-white mb-8 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Discovery
          </button>

          <div className="bg-gray-800/50 rounded-3xl overflow-hidden backdrop-blur-sm">
            {/* Preview */}
            <div className="relative h-96 bg-gradient-to-br from-purple-900 via-pink-900 to-purple-900">
              {room.preview_image_url ? (
                <img 
                  src={room.preview_image_url} 
                  alt={room.title}
                  className="w-full h-full object-cover blur-2xl scale-110"
                />
              ) : (
                <div className="w-full h-full animate-pulse" />
              )}
              <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                <div className="text-center">
                  <h2 className="text-4xl font-black text-white mb-2">{room.title}</h2>
                  <p className="text-gray-300 text-lg">Unlock to reveal</p>
                </div>
              </div>
            </div>

            {/* Info */}
            <div className="p-8">
              <p className="text-gray-400 text-lg mb-6">{room.description}</p>

              <div className="grid grid-cols-2 gap-4 mb-8 p-4 bg-gray-700/50 rounded-xl">
                <div>
                  <p className="text-gray-500 text-sm">Entry Price</p>
                  <p className="text-2xl font-bold text-purple-400">₵{(room.settings.entry_tokens || 0).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-sm">Challenge</p>
                  <p className="text-xl font-semibold text-white">{room.settings.challenge_game.toUpperCase()}</p>
                </div>
              </div>

              <button
                onClick={() => setPurchaseOpen(true)}
                disabled={processing}
                className="w-full py-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 rounded-xl font-bold text-white text-lg shadow-lg shadow-cyan-500/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                data-testid="jftn-unlock-coins-btn"
              >
                <Sparkles className="w-5 h-5" />
                Unlock for ₵{(room.settings.entry_tokens ?? 1000).toLocaleString()}
              </button>
              <p className="text-[11px] text-white/40 mt-2 text-center">
                Vibez Coins · or pay with Solana SOL inside the unlock modal
              </p>
            </div>
          </div>
        </div>

        {/* Vibez Coin Pass Purchase Modal */}
        <PurchaseJFTNPassModal
          open={purchaseOpen}
          onClose={() => setPurchaseOpen(false)}
          onPurchased={(p) => {
            setSolanaPass(p);
            setPaid(true);
            setPaidRoomData({ ...room, unlocked_via: p.payment_method });
          }}
          creatorId={room.creator_id || "creator_unknown"}
          creatorWallet={
            room.settings?.creator_wallet ||
            "5xfP7G5sQzNdC8kFqW2tLp8YNxVkZj9rH4XbCmEy3Ry"
          }
          roomId={roomId}
          feeCoins={room.settings?.entry_tokens ?? 1000}
          feeSol={room.settings?.entry_sol ?? 0.5}
        />
      </div>
    );
  }

  // Paid - Show Room
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-purple-900/10 to-gray-900 py-20 px-4">
      <div className="max-w-6xl mx-auto">
        <JustForTheNightRoom
          roomData={paidRoomData}
          onChallengeStart={() => {

          }}
          onExit={() => navigate("/just-for-the-night")}
        />
      </div>
    </div>
  );
};

export default RoomPage;
