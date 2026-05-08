import React, { useState, useEffect } from 'react';
import { Crown, Check, Zap, Eye, Users, MessageSquare, TrendingUp, Sparkles, Star } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const EliteSubscriptionPage = () => {
  const [tiers, setTiers] = useState([]);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);

  useEffect(() => {
    fetchEliteData();
  }, []);

  const fetchEliteData = async () => {
    try {
      const [tiersRes, statusRes] = await Promise.all([
        fetch(`${API_URL}/api/elite/tiers`),
        fetch(`${API_URL}/api/elite/status`, { })
      ]);

      const tiersData = await tiersRes.json();
      const statusData = await statusRes.json();

      setTiers(tiersData.tiers || []);
      setStatus(statusData);
    } catch (error) {
      // console.error('Error fetching Elite data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async (tierId) => {
    setPurchasing(true);

    try {
      const response = await fetch(`${API_URL}/api/elite/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        
        body: JSON.stringify({ tier_id: tierId })
      });

      const data = await response.json();

      if (data.success && data.checkout_url) {
        window.location.href = data.checkout_url;
      } else {
        throw new Error('Failed to create checkout');
      }
    } catch (error) {
      // console.error('Error subscribing:', error);
      alert('Failed to subscribe. Please try again.');
      setPurchasing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-black flex items-center justify-center">
        <div className="text-cyan-400 text-xl">Loading Elite...</div>
      </div>
    );
  }

  const isElite = status?.is_elite || false;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-black py-12 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-yellow-500/20 border border-yellow-500 rounded-full px-4 py-2 mb-4">
            <Crown className="w-5 h-5 text-yellow-400" />
            <span className="text-yellow-300 font-bold text-sm uppercase tracking-wider">Elite Membership</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-black bg-gradient-to-r from-yellow-400 via-orange-500 to-red-600 bg-clip-text text-transparent mb-4">
            Unlock Elite Features
          </h1>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            Get exclusive access to premium features, priority support, and the ultimate Global Vibez experience
          </p>
        </div>

        {/* Current Status Banner */}
        {isElite && (
          <div className="bg-gradient-to-r from-yellow-900/30 to-orange-900/30 border border-yellow-500 rounded-2xl p-6 mb-8 text-center">
            <Crown className="w-12 h-12 text-yellow-400 mx-auto mb-3" />
            <h2 className="text-2xl font-bold text-yellow-400 mb-2">You're Elite!</h2>
            <p className="text-gray-300">Enjoying {status.tier} membership</p>
            {status.expires_at && (
              <p className="text-gray-400 text-sm mt-2">
                Renews: {new Date(status.expires_at).toLocaleDateString()}
              </p>
            )}
          </div>
        )}

        {/* Pricing Tiers */}
        <div className="grid md:grid-cols-2 gap-8 mb-12">
          {tiers.map((tier, index) => {
            const isAnnual = tier.tier_id === 'elite_annual';
            
            return (
              <div
                key={tier.tier_id}
                className={`relative bg-gradient-to-br ${
                  isAnnual
                    ? 'from-yellow-900/40 to-orange-900/40 border-yellow-500'
                    : 'from-purple-900/40 to-pink-900/40 border-purple-500'
                } border-2 rounded-2xl p-8 backdrop-blur-xl transform transition-all hover:scale-105`}
              >
                {isAnnual && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <div className="bg-gradient-to-r from-yellow-500 to-orange-500 text-black font-bold text-xs px-4 py-1 rounded-full flex items-center gap-1">
                      <Star className="w-3 h-3" />
                      BEST VALUE
                    </div>
                  </div>
                )}

                <div className="text-center mb-6">
                  <h3 className="text-2xl font-bold text-white mb-2">{tier.name}</h3>
                  <div className="text-5xl font-black text-white mb-2">
                    ${tier.price_usd}
                  </div>
                  <p className="text-gray-400">per {tier.billing_period}</p>
                  {tier.savings && (
                    <p className="text-green-400 text-sm mt-2 font-semibold">{tier.savings}</p>
                  )}
                </div>

                <ul className="space-y-3 mb-8">
                  {tier.features.map((feature, idx) => (
                    <li key={`features-${idx}`} className="flex items-start gap-2 text-gray-300">
                      <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="font-semibold text-white">{feature.name}</div>
                        <div className="text-sm text-gray-400">{feature.description}</div>
                      </div>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleSubscribe(tier.tier_id)}
                  disabled={purchasing || isElite}
                  className={`w-full ${
                    isAnnual
                      ? 'bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-black'
                      : 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400 text-white'
                  } font-bold py-4 rounded-xl transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg flex items-center justify-center gap-2`}
                >
                  {isElite ? (
                    <>
                      <Check className="w-5 h-5" />
                      Active
                    </>
                  ) : (
                    <>
                      <Zap className="w-5 h-5" />
                      {purchasing ? 'Processing...' : 'Upgrade Now'}
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {/* Feature Highlights */}
        <div className="bg-gray-800/50 backdrop-blur-xl border border-gray-600 rounded-2xl p-8">
          <h3 className="text-2xl font-bold text-white mb-6 text-center">
            What Makes Elite Special?
          </h3>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-black/30 rounded-lg p-6 text-center">
              <Eye className="w-12 h-12 text-purple-400 mx-auto mb-3" />
              <h4 className="text-white font-bold mb-2">Ghost Mode</h4>
              <p className="text-gray-400 text-sm">
                Browse profiles invisibly. Only people you like can see you viewed them.
              </p>
            </div>

            <div className="bg-black/30 rounded-lg p-6 text-center">
              <MessageSquare className="w-12 h-12 text-cyan-400 mx-auto mb-3" />
              <h4 className="text-white font-bold mb-2">AI Date Coach</h4>
              <p className="text-gray-400 text-sm">
                GPT-5.1 powered conversation suggestions and dating advice in real-time.
              </p>
            </div>

            <div className="bg-black/30 rounded-lg p-6 text-center">
              <TrendingUp className="w-12 h-12 text-green-400 mx-auto mb-3" />
              <h4 className="text-white font-bold mb-2">Priority Matchmaking</h4>
              <p className="text-gray-400 text-sm">
                Jump to the front of multiplayer lobbies and get matched faster.
              </p>
            </div>

            <div className="bg-black/30 rounded-lg p-6 text-center">
              <Users className="w-12 h-12 text-pink-400 mx-auto mb-3" />
              <h4 className="text-white font-bold mb-2">See Who Liked You</h4>
              <p className="text-gray-400 text-sm">
                View everyone who liked your profile before swiping.
              </p>
            </div>

            <div className="bg-black/30 rounded-lg p-6 text-center">
              <Sparkles className="w-12 h-12 text-yellow-400 mx-auto mb-3" />
              <h4 className="text-white font-bold mb-2">Daily Profile Boost</h4>
              <p className="text-gray-400 text-sm">
                Automatically boost your profile to the top of discovery once per day.
              </p>
            </div>

            <div className="bg-black/30 rounded-lg p-6 text-center">
              <Crown className="w-12 h-12 text-orange-400 mx-auto mb-3" />
              <h4 className="text-white font-bold mb-2">Exclusive Badge</h4>
              <p className="text-gray-400 text-sm">
                Show off your Elite status with a premium badge on your profile.
              </p>
            </div>
          </div>
        </div>

        {/* FAQ */}
        <div className="mt-12 text-center">
          <p className="text-gray-400 text-sm">
            Cancel anytime • No hidden fees • Powered by Stripe
          </p>
        </div>
      </div>
    </div>
  );
};

export default EliteSubscriptionPage;
