
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Search, Filter, Sparkles, Users, Coins, Lock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import JFTNTeaser from "@/components/just-for-the-night/JFTNTeaser";
import PurchaseJFTNPassModal from "@/components/just-for-the-night/PurchaseJFTNPassModal";
import { authFetch } from "@/utils/secureAuth";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export const RoomDiscovery = () => {
  const navigate = useNavigate();
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [dealerFilter, setDealerFilter] = useState("all");
  const [priceFilter, setPriceFilter] = useState({ min: 0, max: 1000 });

  // Solana-pass state. Highlight the FIRST room as the featured "Get 24hr Pass"
  // teaser at the top of the discovery feed.
  const [activePass, setActivePass] = useState<any>(null);
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [featuredRoom, setFeaturedRoom] = useState<any>(null);

  // Fetch active pass on mount so the teaser flips to "Unlocked" if one exists.
  useEffect(() => {
    (async () => {
      try {
        const res = await authFetch(`${BACKEND_URL}/api/jftn/passes/active`);
        if (res.ok) {
          const data = await res.json();
          if (data.has_active_pass) setActivePass(data.pass);
        }
      } catch {
        // anonymous users will hit 401; just ignore — the teaser stays locked.
      }
    })();
  }, []);

  useEffect(() => {
    fetchRooms();
  }, [dealerFilter, priceFilter]);

  // Promote the first discovered room to the JFTN teaser slot (best-effort).
  useEffect(() => {
    if (rooms.length > 0 && !featuredRoom) {
      setFeaturedRoom(rooms[0]);
    }
  }, [rooms, featuredRoom]);

  const fetchRooms = async () => {
    try {
      const params = new URLSearchParams({
        limit: "20"
      });
      
      if (dealerFilter !== "all") {
        params.append("dealer_type", dealerFilter);
      }
      
      if (priceFilter.min > 0) {
        params.append("min_tokens", String(priceFilter.min));
      }
      
      if (priceFilter.max < 1000) {
        params.append("max_tokens", String(priceFilter.max));
      }

      const response = await fetch(
        `${BACKEND_URL}/api/just-for-the-night/rooms/discover?${params}`,
        { }
      );
      
      const data = await response.json();
      
      if (data.success) {
        setRooms(data.rooms);
      }
    } catch (error) {
      // console.error("Failed to fetch rooms:", error);
    } finally {
      setLoading(false);
    }
  };

  const getDealerBadge = (dealerType) => {
    switch (dealerType) {
      case "founder_ai":
        return (
          <div className="flex items-center gap-1 px-2 py-1 bg-yellow-500/20 border border-yellow-500/30 rounded-full">
            <Sparkles className="w-3 h-3 text-yellow-400" />
            <span className="text-xs font-bold text-yellow-300">FOUNDER</span>
          </div>
        );
      case "personal_avatar":
        return (
          <div className="px-2 py-1 bg-purple-500/20 border border-purple-500/30 rounded-full">
            <span className="text-xs font-bold text-purple-300">PERSONAL</span>
          </div>
        );
      default:
        return null;
    }
  };

  const filteredRooms = rooms.filter(room =>
    room.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    room.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-purple-900/10 to-gray-900 py-20 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <motion.h1
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-5xl md:text-6xl font-black tracking-tighter uppercase italic bg-gradient-to-r from-pink-400 via-purple-400 to-pink-400 text-transparent bg-clip-text mb-4"
          >
            Just For The Night
          </motion.h1>
          <p className="text-xl text-gray-400">
            Premium rooms. Exclusive experiences. Beat the challenge to unlock.
          </p>
        </div>

        {/* Search & Filters */}
        <div className="bg-gray-800/50 rounded-2xl p-6 mb-8 backdrop-blur-sm">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search rooms..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-purple-500"
              />
            </div>

            {/* Dealer Filter */}
            <select
              value={dealerFilter}
              onChange={(e) => setDealerFilter(e.target.value)}
              className="px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white focus:outline-none focus:border-purple-500"
            >
              <option value="all">All Dealers</option>
              <option value="founder_ai">Founder AI</option>
              <option value="personal_avatar">Personal Avatar</option>
              <option value="ghost_dealer">Ghost Dealer</option>
            </select>

            {/* Price Filter */}
            <select
              onChange={(e) => {
                const value = e.target.value;
                if (value === "all") setPriceFilter({ min: 0, max: 1000 });
                else if (value === "low") setPriceFilter({ min: 0, max: 100 });
                else if (value === "mid") setPriceFilter({ min: 100, max: 300 });
                else if (value === "high") setPriceFilter({ min: 300, max: 1000 });
              }}
              className="px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white focus:outline-none focus:border-purple-500"
            >
              <option value="all">All Prices</option>
              <option value="low">₵0–100</option>
              <option value="mid">₵100–300</option>
              <option value="high">₵300+</option>
            </select>
          </div>
        </div>

        {/* Room Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="bg-gray-800 rounded-2xl h-80 animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            {/* JFTN Solana Pass Teaser — featured room */}
            {featuredRoom && (
              <div
                className="mb-10 flex flex-col md:flex-row items-start gap-6 rounded-2xl bg-gradient-to-r from-cyan-950/40 via-slate-950/60 to-purple-950/40 border border-cyan-500/20 p-6"
                data-testid="jftn-featured-strip"
              >
                <JFTNTeaser
                  videoSrc={featuredRoom.preview_video_url}
                  posterSrc={featuredRoom.preview_image_url}
                  isUnlocked={
                    !!activePass && activePass.room_id === featuredRoom.room_id
                  }
                  feeCoins={featuredRoom.settings?.entry_tokens ?? 1000}
                  onUnlock={() => setPurchaseOpen(true)}
                />
                <div className="flex-1">
                  <h2 className="text-2xl font-['Cinzel'] font-bold text-cyan-300 mb-1">
                    {featuredRoom.title}
                  </h2>
                  <p className="text-sm text-white/60 mb-4 line-clamp-3">
                    {featuredRoom.description ||
                      "A private inner-circle experience. 24-hour pass, then it's gone."}
                  </p>
                  {activePass && activePass.room_id === featuredRoom.room_id ? (
                    <button
                      onClick={() =>
                        navigate(`/just-for-the-night/room/${featuredRoom.room_id}`)
                      }
                      className="px-5 py-2 rounded-full bg-emerald-600/30 border border-emerald-400/50 text-emerald-200 font-bold hover:bg-emerald-600/40"
                      data-testid="jftn-featured-enter"
                    >
                      Enter Room →
                    </button>
                  ) : (
                    <button
                      onClick={() => setPurchaseOpen(true)}
                      className="px-5 py-2 rounded-full bg-gradient-to-r from-purple-600 to-cyan-500 hover:from-purple-500 hover:to-cyan-400 font-bold text-white shadow-lg shadow-cyan-500/30"
                      data-testid="jftn-featured-cta"
                    >
                      Unlock for ₵{(featuredRoom.settings?.entry_tokens ?? 1000).toLocaleString()}
                    </button>
                  )}
                </div>
              </div>
            )}

            <div data-testid="jftn-rails">
              {(() => {
                // Founder ask 2026-05-09: split discovery into two
                // rails so first-time visitors immediately see both
                // PG-13 and 18+ vibes, with the age-gate as a clear
                // shimmer divider between them.
                const pg13Rooms = filteredRooms.filter((r) => (r.tier || 'PG-13') !== '18+');
                const adultRooms = filteredRooms.filter((r) => r.tier === '18+');
                const renderCard = (room, index) => (
                  <motion.div
                    key={room.room_id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => navigate(`/just-for-the-night/room/${room.room_id}`)}
                    data-testid={`jftn-room-card-${room.room_id}`}
                    className="bg-gray-800 rounded-2xl overflow-hidden cursor-pointer hover:ring-2 hover:ring-purple-500 transition-all group"
                  >
                    <div className="relative h-48 bg-gradient-to-br from-purple-900 via-pink-900 to-purple-900 overflow-hidden">
                      {room.preview_image_url ? (
                        <img
                          src={room.preview_image_url}
                          alt={room.title}
                          className="w-full h-full object-cover blur-xl scale-110 group-hover:scale-125 transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full animate-pulse" />
                      )}
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                        <Lock className="w-12 h-12 text-pink-400 animate-pulse" />
                      </div>
                      <div className="absolute top-3 right-3 flex items-center gap-2">
                        {room.tier === '18+' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500/30 border border-rose-400/60 text-rose-100">
                            18+
                          </span>
                        )}
                        {getDealerBadge(room.settings?.dealer_type)}
                      </div>
                    </div>
                    <div className="p-5">
                      <h3 className="text-xl font-bold text-white mb-2 line-clamp-1">{room.title}</h3>
                      <p className="text-gray-400 text-sm mb-4 line-clamp-2">{room.description || 'Mystery awaits...'}</p>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-gray-500 text-sm">
                          <Users className="w-4 h-4" />
                          <span>{room.total_visits || 0} visits</span>
                        </div>
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-500/20 border border-purple-500/30 rounded-full">
                          <Coins className="w-4 h-4 text-purple-400" />
                          <span className="font-bold text-purple-300">{room.settings?.entry_tokens || 100}</span>
                        </div>
                      </div>
                      <div className="mt-3 pt-3 border-t border-gray-700">
                        <span className="text-xs text-gray-500">
                          Challenge: <span className="text-purple-400 font-semibold">{room.settings?.challenge_game?.toUpperCase() || 'UNKNOWN'}</span>
                        </span>
                      </div>
                    </div>
                  </motion.div>
                );
                return (
                  <>
                    {/* Rail 1 — Tonight (PG-13) */}
                    <div data-testid="jftn-rail-pg13" className="mb-10">
                      <div className="flex items-baseline gap-3 mb-4">
                        <h2 className="text-2xl sm:text-3xl font-black bg-gradient-to-r from-cyan-300 via-purple-300 to-pink-300 bg-clip-text text-transparent">
                          Tonight
                        </h2>
                        <span className="text-[10px] uppercase tracking-[0.4em] font-bold text-cyan-300/80">PG-13 · open to all</span>
                        <span className="ml-auto text-xs text-gray-500">{pg13Rooms.length} rooms</span>
                      </div>
                      {pg13Rooms.length === 0 ? (
                        <div className="text-center text-gray-500 py-10 italic">No PG-13 rooms match your filters.</div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                          {pg13Rooms.map(renderCard)}
                        </div>
                      )}
                    </div>

                    {/* Shimmer divider — telegraphs the age gate */}
                    <div data-testid="jftn-tier-divider" className="my-10 relative">
                      <div className="h-px bg-gradient-to-r from-transparent via-rose-500/60 to-transparent" />
                      <div className="absolute left-1/2 -translate-x-1/2 -top-3 px-4 py-1 rounded-full text-[10px] uppercase tracking-[0.4em] font-black bg-black border border-rose-400/40 text-rose-200">
                        After Dark · age verified
                      </div>
                    </div>

                    {/* Rail 2 — After Dark (18+) */}
                    <div data-testid="jftn-rail-18plus" className="mb-6">
                      <div className="flex items-baseline gap-3 mb-4">
                        <h2 className="text-2xl sm:text-3xl font-black bg-gradient-to-r from-rose-300 via-fuchsia-300 to-amber-300 bg-clip-text text-transparent">
                          After Dark
                        </h2>
                        <span className="text-[10px] uppercase tracking-[0.4em] font-bold text-rose-300/80">18+ · Global Vibez Guard required</span>
                        <span className="ml-auto text-xs text-gray-500">{adultRooms.length} rooms</span>
                      </div>
                      {adultRooms.length === 0 ? (
                        <div className="text-center text-gray-500 py-10 italic">No 18+ rooms match your filters.</div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                          {adultRooms.map(renderCard)}
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>
          </>
        )}

        {/* Empty State */}
        {!loading && filteredRooms.length === 0 && (
          <div className="text-center py-20">
            <Lock className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-gray-400 mb-2">No rooms found</h3>
            <p className="text-gray-500">Try adjusting your filters</p>
          </div>
        )}

        {/* Create Room CTA */}
        <div className="mt-12 text-center">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate("/just-for-the-night/create")}
            className="px-8 py-4 bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 rounded-xl font-bold text-white shadow-lg shadow-pink-500/50 transition-all"
          >
            Create Your Room
          </motion.button>
        </div>
      </div>

      {/* Vibez Coin Pass Purchase Modal */}
      {featuredRoom && (
        <PurchaseJFTNPassModal
          open={purchaseOpen}
          onClose={() => setPurchaseOpen(false)}
          onPurchased={(p) => setActivePass(p)}
          creatorId={featuredRoom.creator_id || "creator_unknown"}
          creatorWallet={
            featuredRoom.settings?.creator_wallet ||
            "5xfP7G5sQzNdC8kFqW2tLp8YNxVkZj9rH4XbCmEy3Ry"
          }
          roomId={featuredRoom.room_id}
          feeCoins={featuredRoom.settings?.entry_tokens ?? 1000}
          feeSol={featuredRoom.settings?.entry_sol ?? 0.5}
        />
      )}
    </div>
  );
};

export default RoomDiscovery;
