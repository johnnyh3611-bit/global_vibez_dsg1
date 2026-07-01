import React, { useState, useEffect } from 'react';
import { Users, DollarSign, TrendingUp, Link2, Copy } from 'lucide-react';
import BackButton from '@/components/BackButton';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function AffiliateProgram() {
  const [affiliateData, setAffiliateData] = useState(null);
  const [referrals, setReferrals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAffiliateData();
  }, []);

  const fetchAffiliateData = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const userRes = await fetch(`${API_URL}/api/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const userData = await userRes.json();

      const response = await fetch(`${API_URL}/api/referrals/my-referrals/${userData.user_id}`);
      const data = await response.json();
      setAffiliateData(data);
      setReferrals(data.signups || []);
    } catch (error) {
      // console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyLink = () => {
    const link = `${window.location.origin}/signup?ref=${affiliateData?.referral_code?.code}`;
    navigator.clipboard.writeText(link);
    alert('✅ Affiliate link copied!');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-green-900 to-black py-8 px-4">
      <BackButton to="/dashboard" label="Back" />
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-black bg-gradient-to-r from-green-400 to-cyan-500 bg-clip-text text-transparent mb-4">
            💰 Affiliate Program
          </h1>
          <p className="text-gray-300 text-lg">Earn commissions by referring new users</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card className="bg-gradient-to-br from-green-600 to-cyan-600 p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-green-100 text-sm">Total Earnings</span>
              <DollarSign className="w-6 h-6 text-green-100" />
            </div>
            <p className="text-4xl font-black text-white">₵{(affiliateData?.total_earnings || 0).toLocaleString()}</p>
          </Card>
          <Card className="bg-gradient-to-br from-purple-600 to-pink-600 p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-purple-100 text-sm">Total Referrals</span>
              <Users className="w-6 h-6 text-purple-100" />
            </div>
            <p className="text-4xl font-black text-white">{affiliateData?.total_referrals || 0}</p>
          </Card>
          <Card className="bg-gradient-to-br from-blue-600 to-cyan-600 p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-blue-100 text-sm">Conversion Rate</span>
              <TrendingUp className="w-6 h-6 text-blue-100" />
            </div>
            <p className="text-4xl font-black text-white">{affiliateData?.conversion_rate || 0}%</p>
          </Card>
        </div>

        <Card className="bg-gray-800/50 border-gray-600 p-6 mb-8">
          <h2 className="text-xl font-bold text-white mb-4">Your Affiliate Link</h2>
          <div className="flex gap-2">
            <Input 
              value={`${window.location.origin}/signup?ref=${affiliateData?.referral_code?.code || 'LOADING'}`}
              readOnly
              className="bg-gray-700 border-gray-600 text-white font-mono"
            />
            <Button onClick={copyLink} className="bg-cyan-500 hover:bg-cyan-600">
              <Copy className="w-4 h-4 mr-2" />
              Copy
            </Button>
          </div>
        </Card>

        <Card className="bg-gray-800/50 border-gray-600 p-6">
          <h2 className="text-xl font-bold text-white mb-4">Recent Referrals</h2>
          <div className="space-y-3">
            {referrals.map((ref) => (
              <div key={ref.signup_id} className="flex items-center justify-between bg-gray-700/50 p-4 rounded-lg">
                <div>
                  <p className="text-white font-semibold">User #{ref.new_user_id.slice(0, 8)}</p>
                  <p className="text-gray-400 text-sm">{new Date(ref.created_at).toLocaleDateString()}</p>
                </div>
                <div className="text-right">
                  <p className="text-green-400 font-bold">+₵{(ref.commission || 5).toLocaleString()}</p>
                  <p className="text-gray-400 text-xs">Commission</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
