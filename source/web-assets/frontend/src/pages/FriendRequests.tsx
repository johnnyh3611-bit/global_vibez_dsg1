import React, { useState, useEffect } from 'react';
import { UserPlus, Check, X, Users } from 'lucide-react';
import BackButton from '@/components/BackButton';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function FriendRequests() {
  const [requests, setRequests] = useState([]);
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const userRes = await fetch(`${API_URL}/api/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const userData = await userRes.json();

      const [reqRes, friendsRes] = await Promise.all([
        fetch(`${API_URL}/api/friends/requests/${userData.user_id}`),
        fetch(`${API_URL}/api/friends/list/${userData.user_id}`)
      ]);

      const reqData = await reqRes.json();
      const friendsData = await friendsRes.json();

      setRequests(reqData.requests || []);
      setFriends(friendsData.friends || []);
    } catch (error) {
      // console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const acceptRequest = async (requestId) => {
    try {
      const response = await fetch(`${API_URL}/api/friends/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id: requestId })
      });
      if (response.ok) {
        alert('✅ Friend request accepted!');
        fetchData();
      }
    } catch (error) {
      alert('Failed to accept request');
    }
  };

  const rejectRequest = async (requestId) => {
    try {
      const response = await fetch(`${API_URL}/api/friends/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id: requestId })
      });
      if (response.ok) {
        fetchData();
      }
    } catch (error) {
      alert('Failed to reject request');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-black py-8 px-4">
      <BackButton to="/dashboard" label="Back" />
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-black bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent mb-4">
            👥 Friend Requests
          </h1>
        </div>

        {requests.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-white mb-4">Pending Requests</h2>
            <div className="space-y-4">
              {requests.map((req) => (
                <Card key={req.request_id} className="bg-gray-800/50 border-gray-600 p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <UserPlus className="w-10 h-10 text-cyan-400" />
                    <div>
                      <p className="text-white font-bold">{req.from_user_name}</p>
                      <p className="text-gray-400 text-sm">{req.timestamp}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={() => acceptRequest(req.request_id)} className="bg-green-500 hover:bg-green-600">
                      <Check className="w-4 h-4" />
                    </Button>
                    <Button onClick={() => rejectRequest(req.request_id)} variant="outline">
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
              <Card key={friend.user_id} className="bg-gray-800/50 border-gray-600 p-4">
                <div className="flex items-center gap-3">
                  <Users className="w-8 h-8 text-cyan-400" />
                  <div>
                    <p className="text-white font-bold">{friend.name}</p>
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
