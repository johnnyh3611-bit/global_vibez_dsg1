import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { TrendingUp, Coins, Users, Eye, Settings, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export const CreatorDashboard = () => {
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = useCallback(async () => {
    try {
      const response = await fetch(
        `${BACKEND_URL}/api/just-for-the-night/revenue/dashboard`,
        { }
      );
      
      const data = await response.json();
      
      if (data.success) {
        setDashboard(data.dashboard);
      }
    } catch (error) {
      console.error("Failed to fetch dashboard:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-purple-900/10 to-gray-900 py-20 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-12">
          <div>
            <h1 className="text-5xl font-black tracking-tighter uppercase italic bg-gradient-to-r from-pink-400 via-purple-400 to-pink-400 text-transparent bg-clip-text mb-2">
              Creator Dashboard
            </h1>
            <p className="text-gray-400 text-lg">Track your earnings and room performance</p>
          </div>
          
          <button
            onClick={() => navigate("/just-for-the-night/create")}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-pink-500 to-purple-500 rounded-xl font-bold text-white shadow-lg hover:shadow-pink-500/50 transition-all"
          >
            <Plus className="w-5 h-5" />
            Create Room
          </button>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <StatCard
            icon={<Coins className="w-8 h-8 text-yellow-400" />}
            label="Total Earnings"
            value={dashboard?.total_earnings || 0}
            suffix=" Vibez Coins"
            color="yellow"
          />
          <StatCard
            icon={<Users className="w-8 h-8 text-blue-400" />}
            label="Total Visits"
            value={dashboard?.total_visits || 0}
            color="blue"
          />
          <StatCard
            icon={<Eye className="w-8 h-8 text-green-400" />}
            label="Active Rooms"
            value={dashboard?.active_rooms || 0}
            color="green"
          />
          <StatCard
            icon={<TrendingUp className="w-8 h-8 text-purple-400" />}
            label="Total Rooms"
            value={dashboard?.total_rooms || 0}
            color="purple"
          />
        </div>

        {/* Room Breakdown */}
        <div className="bg-gray-800/50 rounded-2xl p-6 backdrop-blur-sm mb-8">
          <h2 className="text-2xl font-bold text-white mb-6">Your Rooms</h2>
          
          <div className="space-y-4">
            {dashboard?.room_breakdown?.map((room) => (
              <div
                key={room.room_id}
                className="bg-gray-700/50 rounded-xl p-5 hover:bg-gray-700 transition-colors cursor-pointer"
                onClick={() => navigate(`/just-for-the-night/room/${room.room_id}`)}
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-bold text-white">{room.title}</h3>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/just-for-the-night/room/${room.room_id}/settings`);
                    }}
                    className="p-2 hover:bg-gray-600 rounded-lg transition-colors"
                  >
                    <Settings className="w-5 h-5 text-gray-400" />
                  </button>
                </div>
                
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Visits</span>
                    <p className="text-white font-semibold">{room.total_visits}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Revenue</span>
                    <p className="text-white font-semibold">₵{(room.total_revenue || 0).toLocaleString()}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Your Earnings</span>
                    <p className="text-green-400 font-semibold">₵{(room.creator_earnings || 0).toLocaleString()} (70%)</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {dashboard?.room_breakdown?.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <p>No rooms yet. Create your first room to start earning!</p>
            </div>
          )}
        </div>

        {/* Recent Transactions */}
        <div className="bg-gray-800/50 rounded-2xl p-6 backdrop-blur-sm">
          <h2 className="text-2xl font-bold text-white mb-6">Recent Transactions</h2>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-gray-700">
                <tr className="text-left text-gray-400 text-sm">
                  <th className="pb-3 font-semibold">Date</th>
                  <th className="pb-3 font-semibold">Visitor</th>
                  <th className="pb-3 font-semibold">Amount</th>
                  <th className="pb-3 font-semibold">Your Cut</th>
                  <th className="pb-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="text-white">
                {dashboard?.recent_transactions?.slice(0, 10).map((txn) => (
                  <tr key={txn.transaction_id} className="border-b border-gray-700/50">
                    <td className="py-3 text-sm text-gray-400">
                      {new Date(txn.timestamp).toLocaleDateString()}
                    </td>
                    <td className="py-3 text-sm">{txn.visitor_id.slice(0, 12)}...</td>
                    <td className="py-3 text-sm">₵{(txn.amount || 0).toLocaleString()}</td>
                    <td className="py-3 text-sm text-green-400 font-semibold">
                      ₵{(txn.creator_payout || 0).toLocaleString()}
                    </td>
                    <td className="py-3">
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        txn.challenge_completed 
                          ? "bg-green-500/20 text-green-400"
                          : "bg-yellow-500/20 text-yellow-400"
                      }`}>
                        {txn.challenge_completed ? "Completed" : "In Progress"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {dashboard?.recent_transactions?.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <p>No transactions yet.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ icon, label, value, suffix = "", color }) => {
  const colorClasses = {
    yellow: "from-yellow-500/20 to-orange-500/20 border-yellow-500/30",
    blue: "from-blue-500/20 to-cyan-500/20 border-blue-500/30",
    green: "from-green-500/20 to-emerald-500/20 border-green-500/30",
    purple: "from-purple-500/20 to-pink-500/20 border-purple-500/30"
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-gradient-to-br ${colorClasses[color]} border rounded-2xl p-6 backdrop-blur-sm`}
    >
      <div className="flex items-start justify-between mb-4">
        {icon}
      </div>
      <div>
        <p className="text-gray-400 text-sm mb-1">{label}</p>
        <p className="text-3xl font-bold text-white">
          {value.toLocaleString()}{suffix}
        </p>
      </div>
    </motion.div>
  );
};

export default CreatorDashboard;