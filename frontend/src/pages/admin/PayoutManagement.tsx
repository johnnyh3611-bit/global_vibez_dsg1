import React, { useState, useEffect } from 'react';
import { DollarSign, Calendar, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function PayoutManagement() {
  const [payouts, setPayouts] = useState([]);
  const [stats, setStats] = useState({ pending: 0, completed: 0, total_amount: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPayouts();
  }, []);

  const fetchPayouts = async () => {
    try {
      const token = sessionStorage.getItem('admin_token') || localStorage.getItem('auth_token');
      const response = await fetch(`${API_URL}/api/monetization/payouts/list`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setPayouts(data.payouts || []);
      setStats(data.stats || stats);
    } catch (error) {
      // // console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const processPayout = async (payoutId) => {
    try {
      const token = sessionStorage.getItem('admin_token') || localStorage.getItem('auth_token');
      const response = await fetch(`${API_URL}/api/monetization/payouts/process/${payoutId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        alert('✅ Payout processed!');
        fetchPayouts();
      }
    } catch (error) {
      alert('Failed to process payout');
    }
  };

  const getStatusIcon = (status) => {
    if (status === 'completed') return <CheckCircle className="w-5 h-5 text-green-400" />;
    if (status === 'pending') return <Clock className="w-5 h-5 text-yellow-400" />;
    return <AlertCircle className="w-5 h-5 text-red-400" />;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-green-900 to-black py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-black bg-gradient-to-r from-green-400 to-cyan-500 bg-clip-text text-transparent mb-8">
          💸 Payout Management
        </h1>

        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card className="bg-gray-800/50 border-gray-600 p-6">
            <p className="text-gray-400 text-sm mb-1">Pending Payouts</p>
            <p className="text-3xl font-black text-yellow-400">{stats.pending}</p>
          </Card>
          <Card className="bg-gray-800/50 border-gray-600 p-6">
            <p className="text-gray-400 text-sm mb-1">Completed</p>
            <p className="text-3xl font-black text-green-400">{stats.completed}</p>
          </Card>
          <Card className="bg-gray-800/50 border-gray-600 p-6">
            <p className="text-gray-400 text-sm mb-1">Total Amount</p>
            <p className="text-3xl font-black text-white">${stats.total_amount.toLocaleString()}</p>
          </Card>
        </div>

        <div className="space-y-4">
          {payouts.map((payout) => (
            <Card key={payout.payout_id} className="bg-gray-800/50 border-gray-600 p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    {getStatusIcon(payout.status)}
                    <h3 className="text-xl font-bold text-white">{payout.recipient_name}</h3>
                  </div>
                  <div className="flex items-center gap-6 mb-2">
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-green-400" />
                      <span className="text-white font-semibold">${payout.amount}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-blue-400" />
                      <span className="text-gray-400 text-sm">{new Date(payout.requested_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <p className="text-gray-400 text-sm">{payout.method}</p>
                </div>

                {payout.status === 'pending' && (
                  <Button onClick={() => processPayout(payout.payout_id)} className="bg-green-500 hover:bg-green-600">
                    Process Payout
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
