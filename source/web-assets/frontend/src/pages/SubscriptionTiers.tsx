
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Crown, Check, Zap, Star, Shield, Sparkles, ArrowRight } from 'lucide-react';
import BackButton from '@/components/BackButton';
import DynamicPremiumPriceBanner from '@/components/subscription/DynamicPremiumPriceBanner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function SubscriptionTiers() {
  const navigate = useNavigate();
  interface SubscriptionTier {
    name: string;
    price_monthly?: number;
    price_yearly?: number;
    perks?: string[];
    [k: string]: any;
  }
  const [tiers, setTiers] = useState<Record<string, SubscriptionTier>>({});
  const [currentSubscription, setCurrentSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState(false);

  useEffect(() => {
    fetchSubscriptionData();
  }, []);

  const fetchSubscriptionData = async () => {
    try {
      // Get current user
      const userRes = await fetch(`${API_URL}/api/auth/me`, { });
      const userData = await userRes.json();
      
      // Fetch all tiers
      const tiersRes = await fetch(`${API_URL}/api/subscriptions/tiers`);
      const tiersData = await tiersRes.json();
      
      // Fetch user's current subscription
      const subRes = await fetch(`${API_URL}/api/subscriptions/my-subscription/${userData.user_id}`);
      const subData = await subRes.json();
      
      if (tiersData.success) {
        setTiers(tiersData.tiers);
      }
      
      if (subData.success) {
        setCurrentSubscription(subData.subscription);
      }
    } catch (error) {
      // console.error('Error fetching subscription data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async (tierKey, billingCycle) => {
    setSubscribing(true);
    
    try {
      const userRes = await fetch(`${API_URL}/api/auth/me`, { });
      const userData = await userRes.json();
      
      const response = await fetch(`${API_URL}/api/subscriptions/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userData.user_id,
          tier: tierKey,
          billing_cycle: billingCycle,
          payment_method_id: null // TODO: Integrate with Stripe
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        alert(`✅ ${data.message}`);
        fetchSubscriptionData();
      } else {
        throw new Error(data.detail || 'Failed to subscribe');
      }
    } catch (error) {
      // console.error('Error subscribing:', error);
      alert('Failed to subscribe: ' + error.message);
    } finally {
      setSubscribing(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!confirm('Are you sure you want to cancel your subscription?')) return;
    
    try {
      const userRes = await fetch(`${API_URL}/api/auth/me`, { });
      const userData = await userRes.json();
      
      const response = await fetch(`${API_URL}/api/subscriptions/cancel/${userData.user_id}`, {
        method: 'POST'
      });
      
      const data = await response.json();
      
      if (data.success) {
        alert(`✅ ${data.message}`);
        fetchSubscriptionData();
      }
    } catch (error) {
      // console.error('Error cancelling:', error);
      alert('Failed to cancel subscription');
    }
  };

  const getTierIcon = (tierKey) => {
    const icons = {
      free: <Shield className="w-8 h-8" />,
      bronze: <Star className="w-8 h-8" />,
      silver: <Sparkles className="w-8 h-8" />,
      gold: <Zap className="w-8 h-8" />,
      diamond: <Crown className="w-8 h-8" />
    };
    return icons[tierKey] || <Shield className="w-8 h-8" />;
  };

  const getTierColor = (tierKey) => {
    const colors = {
      free: 'from-gray-700 to-gray-800',
      bronze: 'from-orange-700 to-orange-900',
      silver: 'from-slate-400 to-slate-600',
      gold: 'from-yellow-500 to-yellow-700',
      diamond: 'from-cyan-400 to-blue-600'
    };
    return colors[tierKey] || 'from-gray-700 to-gray-800';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-black flex items-center justify-center">
        <div className="text-cyan-400 text-xl">Loading Subscriptions...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-black py-8 px-4">
      <BackButton to="/dashboard" label="Back to Hub" variant="default" />
      
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-black bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-500 bg-clip-text text-transparent mb-4">
            VIP Memberships
          </h1>
          <p className="text-gray-300 text-lg">
            Unlock exclusive perks, lower fees, and premium features
          </p>
          
          {currentSubscription && currentSubscription.tier !== 'free' && (
            <div className="mt-4 inline-block bg-green-500/20 border border-green-500 rounded-lg px-6 py-3">
              <p className="text-green-400 font-bold">
                Currently subscribed to: {currentSubscription.tier_name}
              </p>
            </div>
          )}
        </div>

        <DynamicPremiumPriceBanner />

        {/* Tier Cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {Object.entries(tiers).map(([tierKey, tier]) => {
            const isCurrentTier = currentSubscription?.tier === tierKey;
            const isFree = tierKey === 'free';
            
            return (
              <div
                key={tierKey}
                className={`relative bg-gradient-to-br ${getTierColor(tierKey)} rounded-2xl p-8 border-2 transition-all duration-300 ${
                  isCurrentTier 
                    ? 'border-green-500 shadow-xl shadow-green-500/30 scale-105' 
                    : 'border-white/10 hover:border-white/30 hover:scale-105'
                }`}
              >
                {/* Tier Icon */}
                <div className="flex items-center justify-between mb-6">
                  <div className="bg-white/10 p-4 rounded-xl">
                    {getTierIcon(tierKey)}
                  </div>
                  {isCurrentTier && (
                    <div className="bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                      ACTIVE
                    </div>
                  )}
                </div>

                {/* Tier Name & Price */}
                <h3 className="text-2xl font-black text-white mb-2">{tier.name}</h3>
                <div className="mb-6">
                  {isFree ? (
                    <p className="text-4xl font-black text-white">Free</p>
                  ) : (
                    <>
                      <p className="text-4xl font-black text-white">
                        ${tier.price_monthly}
                        <span className="text-lg font-normal text-gray-300">/mo</span>
                      </p>
                      <p className="text-sm text-gray-300">
                        or ${tier.price_yearly}/year (save {Math.round((1 - tier.price_yearly / (tier.price_monthly * 12)) * 100)}%)
                      </p>
                    </>
                  )}
                </div>

                {/* Perks */}
                <div className="space-y-3 mb-8">
                  {(tier.perks || []).map((perk, index) => (
                    <div key={`perk-${tier.name}-${perk.slice(0, 20)}-${index}`} className="flex items-start gap-2">
                      <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-200 text-sm">{perk}</span>
                    </div>
                  ))}
                </div>

                {/* Action Button */}
                {!isFree && !isCurrentTier && (
                  <button
                    onClick={() => handleSubscribe(tierKey, 'monthly')}
                    disabled={subscribing}
                    className="w-full bg-white text-black font-bold py-3 rounded-lg hover:bg-gray-100 transition-colors flex items-center justify-center gap-2"
                  >
                    {subscribing ? 'Processing...' : 'Subscribe Now'}
                    <ArrowRight className="w-5 h-5" />
                  </button>
                )}
                
                {isCurrentTier && !isFree && (
                  <button
                    onClick={handleCancelSubscription}
                    className="w-full bg-red-500/20 border border-red-500 text-red-400 font-bold py-3 rounded-lg hover:bg-red-500/30 transition-colors"
                  >
                    Cancel Subscription
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Feature Comparison Table */}
        <div className="bg-gray-800/50 backdrop-blur-xl border border-gray-600 rounded-2xl p-8">
          <h2 className="text-3xl font-bold text-white mb-6">Compare All Features</h2>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-600">
                  <th className="pb-4 text-gray-400 font-semibold">Feature</th>
                  <th className="pb-4 text-center text-gray-400 font-semibold">Free</th>
                  <th className="pb-4 text-center text-gray-400 font-semibold">Bronze</th>
                  <th className="pb-4 text-center text-gray-400 font-semibold">Silver</th>
                  <th className="pb-4 text-center text-gray-400 font-semibold">Gold</th>
                  <th className="pb-4 text-center text-gray-400 font-semibold">Diamond</th>
                </tr>
              </thead>
              <tbody className="text-gray-300">
                <tr className="border-b border-gray-700">
                  <td className="py-4">Platform Fee</td>
                  <td className="py-4 text-center">5%</td>
                  <td className="py-4 text-center">4%</td>
                  <td className="py-4 text-center">3%</td>
                  <td className="py-4 text-center">2%</td>
                  <td className="py-4 text-center">1%</td>
                </tr>
                <tr className="border-b border-gray-700">
                  <td className="py-4">Daily Games</td>
                  <td className="py-4 text-center">10</td>
                  <td className="py-4 text-center">20</td>
                  <td className="py-4 text-center">50</td>
                  <td className="py-4 text-center">∞</td>
                  <td className="py-4 text-center">∞</td>
                </tr>
                <tr className="border-b border-gray-700">
                  <td className="py-4">Monthly Bonus Vibez Coins</td>
                  <td className="py-4 text-center">-</td>
                  <td className="py-4 text-center">-</td>
                  <td className="py-4 text-center">500</td>
                  <td className="py-4 text-center">1,500</td>
                  <td className="py-4 text-center">3,000</td>
                </tr>
                <tr>
                  <td className="py-4">Exclusive Rooms</td>
                  <td className="py-4 text-center">❌</td>
                  <td className="py-4 text-center">❌</td>
                  <td className="py-4 text-center">✅</td>
                  <td className="py-4 text-center">✅</td>
                  <td className="py-4 text-center">✅</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
