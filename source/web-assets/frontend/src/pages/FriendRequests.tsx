import React, { useState, useEffect } from 'react';
import { UserPlus, Check, X, Users } from 'lucide-react';
import BackButton from '@/components/BackButton';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { authFetch, getUserId } from '@/utils/secureAuth';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function FriendRequests() {
  const [requests, setRequests] = useState([]);
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setError(null);
      const userRes = await authFetch(`${API_URL}/api/auth/me`);
      const userData = userRes.ok ? await userRes.json() : {};
      const userId = userData.user_id || getUserId();
      if (!userId) {
        setError('Please log in to view friend requests');
        return;
      }

      const [reqRes, friendsRes] = await Promise.all([
        authFetch(`${API_URL}/api/friends/requests/pending/${userId}`),
        authFetch(`${API_URL}/api/friends/list/${userId}`),
      ]);

      const reqData = reqRes.ok ? await reqRes.json() : { requests: [] };
      const friendsData = friendsRes.ok ? await friendsRes.json() : { friends: [] };

      setRequests(reqData.requests || []);
      setFriends(friendsData.friends || []);
    } catch (err) {
      setError('Failed to load friend requests');
    } finally {
      setLoading(false);
    }
  };

  const respond = async (requestId, action) => {
    try {
      const response = await authFetch(`${API_URL}/api/friends/request/respond`, {
        method: 'POST',
        body: JSON.stringify({ request_id: requestId, action }),
      });
      if (response.ok) {
        if (action === 'accept') alert('Friend request accepted!');
        fetchData();
      } else {
        const data = await response.json().catch(() => ({}));
        alert(data.detail || `Failed to ${action} request`);
      }
    } catch {
      alert(`Failed to ${action} request`);
    }
  };

  const requestKey = (req) => req.id || req.request_id;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-black py-8 px-4">
      <BackButton to="/dashboard" label="Back" />
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-black bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent mb-4">
            Friend Requests
          </h1>
        </div>

        {loading && <p className="text-white/70 text-center">Loading...</p>}
        {error && <p className="text-rose-300 text-center mb-4">{error}</p>}

        {requests.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-white mb-4">Pending Requests</h2>
            <div className="space-y-4">
              {requests.map((req) => (
                <Card key={requestKey(req)} className="bg-gray-800/50 border-gray-600 p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <UserPlus className="w-10 h-10 text-cyan-400" />
                    <div>
                      <p className="text-white font-bold">{req.from_user_name}</p>
                      <p className="text-gray-400 text-sm">{req.created_at || req.timestamp}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={() => respond(requestKey(req), 'accept')} className="bg-green-500 hover:bg-green-600">
                      <Check className="w-4 h-4" />
                    </Button>
                    <Button onClick={() => respond(requestKey(req), 'reject')} variant="outline">
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        <div>
          <h2 className="text-2xl font-bold text-white mb-4">Friends ({friends.length})</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {friends.map((friend) => (
              <Card key={friend.user_id || friend.friend_id} className="bg-gray-800/50 border-gray-600 p-4">
                <div className="flex items-center gap-3">
                  <Users className="w-8 h-8 text-cyan-400" />
                  <div>
                    <p className="text-white font-bold">{friend.name || friend.friend_name}</p>
                    <p className="text-gray-400 text-sm">{friend.status || 'Offline'}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
