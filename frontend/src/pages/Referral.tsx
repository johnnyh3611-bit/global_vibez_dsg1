import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Globe, ArrowLeft, Copy, Share2, Gift, Users, Check } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function Referral() {
  const navigate = useNavigate();
  const [referralInfo, setReferralInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [applyCode, setApplyCode] = useState('');
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    fetchReferralInfo();
  }, []);

  const fetchReferralInfo = async () => {
    try {
      // Get current user ID from session/localStorage
      const userResponse = await fetch(`${BACKEND_URL}/api/auth/me`, {
      });
      
      if (!userResponse.ok) throw new Error('Not authenticated');
      
      const userData = await userResponse.json();
      const userId = userData.user_id;

      // Fetch referral data using new backend endpoint
      const response = await fetch(`${API}/referrals/my-referrals/${userId}`);

      if (!response.ok) throw new Error('Failed to fetch referral info');

      const data = await response.json();
      
      // Transform backend response to match frontend expectations
      setReferralInfo({
        referral_code: data.referral_code?.code || 'LOADING',
        referral_count: data.total_referrals || 0,
        total_earnings: data.total_earnings || 0,
        reward_message: `Earn $${data.referral_code?.total_earnings || 0} by inviting friends!`,
        referred_users: data.signups?.map(s => ({
          id: s.signup_id,
          name: s.new_user_id,
          created_at: s.created_at
        })) || []
      });
    } catch (error) {
      // console.error('Error fetching referral info:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyReferralLink = () => {
    const referralLink = `${window.location.origin}/?ref=${referralInfo.referral_code}`;
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareOnSocial = (platform) => {
    const referralLink = `${window.location.origin}/?ref=${referralInfo.referral_code}`;
    const message = encodeURIComponent(`Join me on Global Vibez DSG - the dating app that breaks language barriers! 🌍💕 Use my code: ${referralInfo.referral_code}`);

    let url = '';
    switch (platform) {
      case 'whatsapp':
        url = `https://wa.me/?text=${message}%20${encodeURIComponent(referralLink)}`;
        break;
      case 'twitter':
        url = `https://twitter.com/intent/tweet?text=${message}&url=${encodeURIComponent(referralLink)}`;
        break;
      case 'facebook':
        url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(referralLink)}`;
        break;
    }

    window.open(url, '_blank');
  };

  const handleApplyCode = async (e) => {
    e.preventDefault();
    if (!applyCode.trim()) return;

    setApplying(true);

    try {
      // Get current user ID
      const userResponse = await fetch(`${BACKEND_URL}/api/auth/me`, {
      });
      
      if (!userResponse.ok) throw new Error('Not authenticated');
      
      const userData = await userResponse.json();
      
      // Use new backend endpoint
      const response = await fetch(`${API}/referrals/apply-referral`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          new_user_id: userData.user_id,
          referral_code: applyCode.trim().toUpperCase() 
        })
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.detail || 'Failed to apply referral code');
        return;
      }

      alert(data.message || 'Referral code applied successfully!');
      setApplyCode('');
      fetchReferralInfo();
    } catch (error) {
      // console.error('Error applying referral code:', error);
      alert('Failed to apply referral code. Please try again.');
    } finally {
      setApplying(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-pink-500 via-purple-500 to-indigo-500">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-500 via-purple-500 to-indigo-500">
      {/* Header */}
      <header className="bg-white/10 backdrop-blur-lg border-b border-white/20">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Button
            variant="ghost"
            onClick={() => navigate('/dashboard')}
            className="text-white hover:bg-white/20"
            data-testid="back-btn"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back
          </Button>
          <div className="flex items-center gap-2">
            <Globe className="w-8 h-8 text-white" />
            <h1 className="text-2xl font-bold text-white">Refer & Earn</h1>
          </div>
          <div className="w-20" />
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-12">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Reward Banner */}
          <Card className="p-8 bg-gradient-to-r from-yellow-400 to-orange-500 text-white border-none text-center">
            <Gift className="w-16 h-16 mx-auto mb-4" />
            <h2 className="text-3xl font-bold mb-2">Invite Friends, Get Premium!</h2>
            <p className="text-xl">{referralInfo?.reward_message}</p>
          </Card>

          {/* Your Referral Code */}
          <Card className="p-8 bg-white">
            <h3 className="text-2xl font-bold text-gray-800 mb-4">Your Referral Code</h3>
            <div className="bg-purple-50 border-2 border-purple-300 rounded-lg p-6 mb-4">
              <p className="text-sm text-purple-600 mb-2">Share this code with friends:</p>
              <div className="flex items-center gap-3">
                <div className="flex-1 bg-white px-4 py-3 rounded-lg border border-purple-200">
                  <code className="text-2xl font-bold text-purple-600">
                    {referralInfo?.referral_code}
                  </code>
                </div>
                <Button
                  onClick={copyReferralLink}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                  data-testid="copy-btn"
                >
                  {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                </Button>
              </div>
            </div>

            {/* Share Buttons */}
            <div className="grid grid-cols-3 gap-4">
              <Button
                onClick={() => shareOnSocial('whatsapp')}
                className="bg-green-500 hover:bg-green-600 text-white"
                data-testid="share-whatsapp"
              >
                <Share2 className="w-4 h-4 mr-2" />
                WhatsApp
              </Button>
              <Button
                onClick={() => shareOnSocial('twitter')}
                className="bg-blue-400 hover:bg-blue-500 text-white"
                data-testid="share-twitter"
              >
                <Share2 className="w-4 h-4 mr-2" />
                Twitter
              </Button>
              <Button
                onClick={() => shareOnSocial('facebook')}
                className="bg-blue-600 hover:bg-blue-700 text-white"
                data-testid="share-facebook"
              >
                <Share2 className="w-4 h-4 mr-2" />
                Facebook
              </Button>
            </div>
          </Card>

          {/* Stats */}
          <Card className="p-8 bg-white">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-gray-800">Your Stats</h3>
              <div className="flex items-center gap-2 text-purple-600">
                <Users className="w-6 h-6" />
                <span className="text-3xl font-bold">{referralInfo?.referral_count}</span>
              </div>
            </div>

            {referralInfo?.referred_users && referralInfo.referred_users.length > 0 ? (
              <div>
                <p className="text-gray-600 mb-4">Friends you've referred:</p>
                <div className="space-y-2">
                  {referralInfo.referred_users.map((user, index) => (
                    <div key={user.id || `referred_users-${index}`} className="flex items-center justify-between bg-purple-50 px-4 py-3 rounded-lg">
                      <span className="font-medium text-gray-800">{user.name}</span>
                      <span className="text-sm text-gray-500">
                        {new Date(user.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-gray-500 text-center py-6">
                No referrals yet. Share your code to start earning rewards!
              </p>
            )}
          </Card>

          {/* Apply Someone's Code */}
          <Card className="p-8 bg-white">
            <h3 className="text-2xl font-bold text-gray-800 mb-4">Have a Referral Code?</h3>
            <form onSubmit={handleApplyCode} className="flex gap-3">
              <Input
                type="text"
                placeholder="Enter code (e.g., GVUSER1234)"
                value={applyCode}
                onChange={(e) => setApplyCode(e.target.value.toUpperCase())}
                className="flex-1"
                data-testid="apply-code-input"
              />
              <Button
                type="submit"
                disabled={!applyCode.trim() || applying}
                className="bg-purple-600 hover:bg-purple-700 text-white"
                data-testid="apply-code-btn"
              >
                {applying ? 'Applying...' : 'Apply Code'}
              </Button>
            </form>
            <p className="text-sm text-gray-500 mt-3">
              Both you and your friend will get 1 month Premium free! 🎉
            </p>
          </Card>

          {/* How it Works */}
          <Card className="p-8 bg-white/10 backdrop-blur-lg border-white/20 text-white">
            <h3 className="text-2xl font-bold mb-4">How It Works</h3>
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white/20 flex items-center justify-center font-bold">
                  1
                </div>
                <div>
                  <h4 className="font-bold mb-1">Share Your Code</h4>
                  <p className="text-white/80">Send your referral code to friends via WhatsApp, social media, or in person.</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white/20 flex items-center justify-center font-bold">
                  2
                </div>
                <div>
                  <h4 className="font-bold mb-1">Friend Joins & Uses Code</h4>
                  <p className="text-white/80">They sign up and apply your referral code in their account.</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white/20 flex items-center justify-center font-bold">
                  3
                </div>
                <div>
                  <h4 className="font-bold mb-1">Both Get Premium Free!</h4>
                  <p className="text-white/80">You both instantly receive 1 month of Premium membership for free!</p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}
