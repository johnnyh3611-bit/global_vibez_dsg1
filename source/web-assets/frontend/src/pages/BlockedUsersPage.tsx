import { useState, useEffect } from "react";
import { Shield, UserX, Unlock } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

export default function BlockedUsersPage() {
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBlockedUsers();
  }, []);

  const fetchBlockedUsers = async () => {
    try {
      const res = await fetch(`${API}/api/reports/blocked`, {
        
      });
      if (res.ok) {
        const data = await res.json();
        setBlockedUsers(data.blocked_users || []);
      }
    } catch (err) {
      // console.error("Failed to fetch blocked users:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleUnblock = async (userId) => {
    try {
      const res = await fetch(`${API}/api/reports/unblock/${userId}`, {
        method: "POST",
        
      });

      if (res.ok) {
        setBlockedUsers((prev) => prev.filter((u) => u.user_id !== userId));
      }
    } catch (err) {
      // console.error("Failed to unblock user:", err);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-black to-pink-900 p-4">
      <div className="max-w-4xl mx-auto pt-20">
        <div className="bg-black/40 backdrop-blur-xl rounded-3xl border border-purple-500/30 p-8">
          <div className="flex items-center gap-3 mb-6">
            <Shield className="w-8 h-8 text-red-400" />
            <h1 className="text-3xl font-bold text-white">Blocked Users</h1>
          </div>

          {loading ? (
            <div className="text-center text-gray-400 py-8">Loading...</div>
          ) : blockedUsers.length === 0 ? (
            <div className="text-center py-12">
              <UserX className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">You haven't blocked anyone yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {blockedUsers.map((user) => (
                <div
                  key={user.user_id}
                  className="bg-black/30 border border-gray-700 rounded-xl p-4 flex items-center justify-between"
                >
                  <div className="flex items-center gap-4">
                    {user.photos && user.photos[0] ? (
                      <img
                        src={user.photos[0]}
                        alt={user.name}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold">
                        {user.name?.[0] || "?"}
                      </div>
                    )}
                    <div>
                      <p className="text-white font-semibold">{user.name || "Unknown"}</p>
                      <p className="text-gray-400 text-sm">Blocked</p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleUnblock(user.user_id)}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                  >
                    <Unlock className="w-4 h-4" />
                    Unblock
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
