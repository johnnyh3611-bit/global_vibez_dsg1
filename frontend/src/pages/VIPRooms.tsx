import React, { useState, useEffect } from 'react';
import { Crown, Users, Lock, Star, DollarSign } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import BackButton from '@/components/BackButton';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function VIPRooms() {
  const navigate = useNavigate();
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchVIPRooms();
  }, []);

  const fetchVIPRooms = async () => {
    try {
      const response = await fetch(`${API_URL}/api/private-suites/list`);
      const data = await response.json();
      setRooms(data.suites || []);
    } catch (error) {
      // console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const joinRoom = async (roomId, price) => {
    try {
      const token = localStorage.getItem('auth_token');
      const userRes = await fetch(`${API_URL}/api/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const userData = await userRes.json();

      const response = await fetch(`${API_URL}/api/private-suites/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userData.user_id,
          suite_id: roomId
        })
      });
      const data = await response.json();
      if (data.success) {
        navigate(`/vip-room/${roomId}`);
      }
    } catch (error) {
      alert('Failed to join VIP room');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-pink-900 to-black py-8 px-4">
      <BackButton to="/dashboard" label="Back" />
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-black bg-gradient-to-r from-yellow-400 via-pink-400 to-purple-500 bg-clip-text text-transparent mb-4">
            👑 VIP Rooms
          </h1>
          <p className="text-gray-300 text-lg">Exclusive premium gaming experiences</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {rooms.map((room) => (
            <Card key={room.suite_id} className="bg-gradient-to-br from-purple-800 to-pink-900 border-yellow-500 p-6 hover:shadow-xl hover:shadow-yellow-500/30 transition-all">
              <div className="flex items-center justify-between mb-4">
                <Crown className="w-10 h-10 text-yellow-400" />
                <span className="bg-yellow-500 text-black text-xs font-bold px-3 py-1 rounded-full">VIP</span>
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">{room.name}</h3>
              <p className="text-gray-300 text-sm mb-4">{room.description}</p>
              
              <div className="space-y-2 mb-6">
                <div className="flex items-center gap-2 text-gray-300">
                  <Users className="w-4 h-4 text-cyan-400" />
                  <span className="text-sm">{room.current_players}/{room.max_players} Players</span>
                </div>
                <div className="flex items-center gap-2 text-gray-300">
                  <DollarSign className="w-4 h-4 text-yellow-400" />
                  <span className="text-sm">Entry: ${room.entry_price}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-300">
                  <Star className="w-4 h-4 text-purple-400" />
                  <span className="text-sm">{room.features?.join(', ')}</span>
                </div>
              </div>

              <Button 
                onClick={() => joinRoom(room.suite_id, room.entry_price)}
                className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-black font-bold"
              >
                Enter VIP Room
              </Button>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
