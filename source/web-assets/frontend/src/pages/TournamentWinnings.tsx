import React, { useState, useEffect } from 'react';
import { Trophy, DollarSign, Clock, Award } from 'lucide-react';
import BackButton from '@/components/BackButton';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function TournamentWinnings() {
  const [winnings, setWinnings] = useState([]);
  const [totalEarned, setTotalEarned] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWinnings();
  }, []);

  const fetchWinnings = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const userRes = await fetch(`${API_URL}/api/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const userData = await userRes.json();

      const response = await fetch(`${API_URL}/api/tournament-winnings/my-winnings/${userData.user_id}`);
      const data = await response.json();
      setWinnings(data.winnings || []);
      setTotalEarned(data.total_earned || 0);
    } catch (error) {
      // console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const claimWinnings = async (winningId) => {
    try {
      const response = await fetch(`${API_URL}/api/tournament-winnings/claim/${winningId}`, {
        method: 'POST'
      });
      const data = await response.json();
      if (data.success) {
        alert(`✅ Claimed $${data.amount}!`);
        fetchWinnings();
      }
    } catch (error) {
      alert('Failed to claim winnings');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-yellow-900 to-black py-8 px-4">
      <BackButton to="/tournaments" label="Back to Tournaments" />
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-black bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent mb-4">
            🏆 Tournament Winnings
          </h1>
        </div>

        <Card className="bg-gradient-to-r from-yellow-600 to-orange-600 p-8 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-yellow-100 text-sm">Total Earned</p>
              <p className="text-5xl font-black text-white">₵{totalEarned.toLocaleString()}</p>
            </div>
            <Trophy className="w-20 h-20 text-yellow-200" />
          </div>
        </Card>

        <div className="space-y-4">
          {winnings.map((win) => (
            <Card key={win.winning_id} className="bg-gray-800/50 border-gray-600 p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <Award className="w-6 h-6 text-yellow-400" />
                    <h3 className="text-xl font-bold text-white">{win.tournament_name}</h3>
                  </div>
                  <div className="flex items-center gap-6 mb-3">
                    <div className="flex items-center gap-2">
                      <Trophy className="w-4 h-4 text-yellow-400" />
                      <span className="text-gray-300 text-sm">Position: {win.position}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-blue-400" />
                      <span className="text-gray-300 text-sm">{new Date(win.date).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <p className="text-3xl font-black text-yellow-400">₵{(win.amount || 0).toLocaleString()}</p>
                </div>

                <div>
                  {win.claimed ? (
                    <div className="bg-gray-700 text-gray-400 px-6 py-3 rounded-lg">
                      Claimed
                    </div>
                  ) : (
                    <Button onClick={() => claimWinnings(win.winning_id)} className="bg-green-500 hover:bg-green-600">
                      Claim Prize
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
