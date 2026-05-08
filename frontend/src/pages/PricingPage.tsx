import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Check, Crown, Star, Zap, Gift, Users, Heart, Sparkles, TrendingUp, ArrowLeft } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

export default function PricingPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [currentTier, setCurrentTier] = useState('free');
  const [creditsBalance, setCreditsBalance] = useState(0);
  const [billingPeriod, setBillingPeriod] = useState('monthly'); // monthly or annual

  useEffect(() => {
    fetchSubscriptionInfo();
  }, []);

  const fetchSubscriptionInfo = async () => {
    try {
      const response = await fetch(`${API}/api/subscriptions/me`, {
      });
      if (response.ok) {
        const data = await response.json();
        setCurrentTier(data.tier);
        setCreditsBalance(data.credits_balance);
      }
    } catch (err) {
      // console.error('Error fetching subscription:', err);
    }
  };

  const handleSubscribe = async (tier, period) => {
    setLoading(true);
    try {
      const response = await fetch(`${API}/api/subscriptions/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        
        body: JSON.stringify({
          tier: tier,
          billing_period: period
        })
      });

      if (response.ok) {
        const data = await response.json();
        window.location.href = data.checkout_url;
      } else {
        alert('Failed to start subscription. Please try again.');
      }
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBuyCredits = async (packageType) => {
    setLoading(true);
    try {
      const response = await fetch(`${API}/api/subscriptions/purchase-credits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        
        body: JSON.stringify({
          package: packageType
        })
      });

      if (response.ok) {
        const data = await response.json();
        window.location.href = data.checkout_url;
      } else {
        alert('Failed to purchase credits. Please try again.');
      }
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const tiers = [
    {
      name: 'Free',
      price: 0,
      icon: Gift,
      color: 'from-gray-500 to-gray-600',
      current: currentTier === 'free',
      features: [
        '20 dating swipes per day',
        'Basic profile & photos',
        'View and chat with matches',
        'All 2D games',
        'Safety features',
        'Basic tournament entry (3/month)',
        '50 credits/month'
      ],
      locked: [
        'Friend matching',
        'Compatibility quizzes',
        'Profile videos',
        '3D games',
        'AI group planner'
      ]
    },
    {
      name: 'Plus',
      price: billingPeriod === 'monthly' ? 12.99 : 124,
      icon: Star,
      color: 'from-purple-500 to-pink-500',
      popular: true,
      current: currentTier === 'plus',
      features: [
        '✨ Unlimited dating swipes',
        '✨ Friend matching (unlimited)',
        '✨ Both compatibility quizzes',
        '✨ Profile videos (both types)',
        '✨ All 3D games access',
        '✨ AI Group Planner (2/week)',
        '✨ Unlimited tournaments',
        '✨ 200 credits/month',
        '✨ 20% tournament discount',
        '✨ 2 profile boosts/week',
        '✨ 5 rewinds/week',
        '✨ Priority support'
      ]
    },
    {
      name: 'Premium',
      price: billingPeriod === 'monthly' ? 24.99 : 239,
      icon: Crown,
      color: 'from-yellow-400 to-orange-500',
      current: currentTier === 'premium',
      features: [
        '👑 Everything in Plus',
        '👑 See who liked you',
        '👑 Unlimited rewinds',
        '👑 Unlimited profile boosts',
        '👑 Unlimited AI group outings',
        '👑 500 credits/month',
        '👑 50% tournament discount',
        '👑 $15 ride credits/month',
        '👑 Priority matching algorithm',
        '👑 Ad-free experience',
        '👑 Premium badge on profile',
        '👑 Early access to features'
      ]
    }
  ];

  const creditPackages = [
    {
      name: 'Starter',
      credits: 100,
      price: 2.99,
      bonus: 0,
      package: 'starter'
    },
    {
      name: 'Popular',
      credits: 250,
      price: 4.99,
      bonus: 25,
      package: 'popular',
      popular: true
    },
    {
      name: 'Mega',
      credits: 1500,
      price: 19.99,
      bonus: 87,
      package: 'mega'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-pink-900 to-purple-900 py-12 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <Button
            onClick={() => navigate('/dashboard')}
            variant="ghost"
            className="text-white hover:bg-white/10 mb-6"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
          
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-4">
            Choose Your Plan
          </h1>
          <p className="text-xl text-gray-200 mb-8">
            Unlock the full Global Vibez DSG experience
          </p>

          {/* Current Credits */}
          {currentTier !== 'free' && (
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-lg px-6 py-3 rounded-full">
              <Zap className="w-5 h-5 text-yellow-400" />
              <span className="text-white font-semibold">{creditsBalance} Credits Available</span>
            </div>
          )}

          {/* Billing Toggle */}
          <div className="mt-8 inline-flex items-center gap-4 bg-white/10 backdrop-blur-lg p-2 rounded-full">
            <button
              onClick={() => setBillingPeriod('monthly')}
              className={`px-6 py-2 rounded-full font-semibold transition-all ${
                billingPeriod === 'monthly'
                  ? 'bg-white text-purple-600'
                  : 'text-white'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingPeriod('annual')}
              className={`px-6 py-2 rounded-full font-semibold transition-all ${
                billingPeriod === 'annual'
                  ? 'bg-white text-purple-600'
                  : 'text-white'
              }`}
            >
              Annual
              <span className="ml-2 text-sm text-green-400">Save 20%</span>
            </button>
          </div>
        </div>

        {/* Subscription Tiers */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          {tiers.map((tier, index) => {
            const Icon = tier.icon;
            const isFree = tier.name === 'Free';
            
            return (
              <Card
                key={`item-${index}`}
                className={`relative overflow-hidden ${
                  tier.popular ? 'ring-4 ring-yellow-400 scale-105' : ''
                } ${tier.current ? 'ring-2 ring-white' : ''}`}
              >
                {tier.popular && (
                  <div className="absolute top-0 right-0 bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-4 py-1 text-sm font-bold">
                    MOST POPULAR
                  </div>
                )}
                
                {tier.current && (
                  <div className="absolute top-0 left-0 bg-white text-purple-600 px-4 py-1 text-sm font-bold">
                    CURRENT PLAN
                  </div>
                )}

                <div className={`bg-gradient-to-br ${tier.color} p-6 text-white`}>
                  <Icon className="w-12 h-12 mb-4" />
                  <h3 className="text-3xl font-bold mb-2">{tier.name}</h3>
                  <div className="flex items-baseline gap-2">
                    <span className="text-5xl font-bold">
                      ${tier.price}
                    </span>
                    {!isFree && (
                      <span className="text-lg opacity-80">
                        /{billingPeriod === 'monthly' ? 'mo' : 'yr'}
                      </span>
                    )}
                  </div>
                  {billingPeriod === 'annual' && !isFree && (
                    <p className="text-sm mt-2 opacity-90">
                      ${(tier.price / 12).toFixed(2)}/month billed annually
                    </p>
                  )}
                </div>

                <div className="p-6">
                  <ul className="space-y-3 mb-6">
                    {tier.features.map((feature, idx) => (
                      <li key={`features-${idx}`} className="flex items-start gap-3">
                        <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                        <span className="text-gray-700">{feature}</span>
                      </li>
                    ))}
                    {tier.locked && tier.locked.map((feature, idx) => (
                      <li key={`locked-${idx}`} className="flex items-start gap-3 opacity-50">
                        <span className="w-5 h-5 flex-shrink-0 mt-0.5">❌</span>
                        <span className="text-gray-500">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {!tier.current && !isFree && (
                    <Button
                      onClick={() => handleSubscribe(tier.name.toLowerCase(), billingPeriod)}
                      disabled={loading}
                      className={`w-full bg-gradient-to-r ${tier.color} hover:opacity-90 text-white py-6 text-lg font-bold`}
                    >
                      {loading ? 'Processing...' : `Upgrade to ${tier.name}`}
                    </Button>
                  )}

                  {tier.current && !isFree && (
                    <div className="w-full bg-gray-200 text-gray-700 py-6 text-lg font-bold text-center rounded-lg">
                      Current Plan
                    </div>
                  )}

                  {isFree && currentTier === 'free' && (
                    <div className="w-full bg-gray-100 text-gray-600 py-4 text-center rounded-lg">
                      Your Current Plan
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>

        {/* Credit Packages */}
        <div className="mb-16">
          <div className="text-center mb-8">
            <h2 className="text-4xl font-bold text-white mb-4">
              💰 Buy Credits
            </h2>
            <p className="text-xl text-gray-200">
              Pay as you go! Use credits for tournaments, boosts, and premium features
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-6">
            {creditPackages.map((pkg, index) => (
              <Card
                key={`creditPackages-${index}`}
                className={`relative overflow-hidden hover:scale-105 transition-transform ${
                  pkg.popular ? 'ring-4 ring-green-400' : ''
                }`}
              >
                {pkg.popular && (
                  <div className="absolute top-0 right-0 bg-green-500 text-white px-3 py-1 text-xs font-bold">
                    BEST DEAL
                  </div>
                )}

                <div className="p-6">
                  <div className="text-center mb-4">
                    <Zap className="w-12 h-12 mx-auto mb-3 text-yellow-500" />
                    <h3 className="text-2xl font-bold text-gray-800 mb-2">
                      {pkg.name}
                    </h3>
                    <div className="text-4xl font-bold text-purple-600 mb-1">
                      {pkg.credits}
                    </div>
                    <div className="text-sm text-gray-600">Credits</div>
                    
                    {pkg.bonus > 0 && (
                      <div className="mt-2 inline-block bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-semibold">
                        +{pkg.bonus}% Bonus!
                      </div>
                    )}
                  </div>

                  <div className="text-center mb-4">
                    <div className="text-3xl font-bold text-gray-800">
                      ${pkg.price}
                    </div>
                  </div>

                  <Button
                    onClick={() => handleBuyCredits(pkg.package)}
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                  >
                    Buy Now
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Credit Usage Guide */}
        <Card className="p-8 bg-white/95 backdrop-blur-lg mb-16">
          <h3 className="text-3xl font-bold text-gray-800 mb-6 text-center">
            💎 What Can You Do With Credits?
          </h3>
          
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-4xl mb-3">🏆</div>
              <h4 className="font-bold text-lg mb-2">Tournament Entry</h4>
              <p className="text-gray-600 text-sm">25-100 credits per tournament</p>
              <p className="text-purple-600 font-semibold text-sm mt-1">
                Win prizes & earn credits back!
              </p>
            </div>

            <div className="text-center">
              <div className="text-4xl mb-3">🤖</div>
              <h4 className="font-bold text-lg mb-2">AI Group Outings</h4>
              <p className="text-gray-600 text-sm">40 credits per suggestion</p>
              <p className="text-purple-600 font-semibold text-sm mt-1">
                Unlimited for Premium!
              </p>
            </div>

            <div className="text-center">
              <div className="text-4xl mb-3">⚡</div>
              <h4 className="font-bold text-lg mb-2">Profile Boosts</h4>
              <p className="text-gray-600 text-sm">50 credits per boost</p>
              <p className="text-purple-600 font-semibold text-sm mt-1">
                Get 2x more visibility!
              </p>
            </div>

            <div className="text-center">
              <div className="text-4xl mb-3">👁️</div>
              <h4 className="font-bold text-lg mb-2">See Who Liked You</h4>
              <p className="text-gray-600 text-sm">30 credits per reveal</p>
              <p className="text-purple-600 font-semibold text-sm mt-1">
                Free for Premium!
              </p>
            </div>

            <div className="text-center">
              <div className="text-4xl mb-3">⏪</div>
              <h4 className="font-bold text-lg mb-2">Rewind Swipes</h4>
              <p className="text-gray-600 text-sm">20 credits for 5 rewinds</p>
              <p className="text-purple-600 font-semibold text-sm mt-1">
                Undo mistakes!
              </p>
            </div>

            <div className="text-center">
              <div className="text-4xl mb-3">🎮</div>
              <h4 className="font-bold text-lg mb-2">3D Games Access</h4>
              <p className="text-gray-600 text-sm">15 credits for 24 hours</p>
              <p className="text-purple-600 font-semibold text-sm mt-1">
                Permanent for Plus+!
              </p>
            </div>
          </div>
        </Card>

        {/* Feature Comparison */}
        <Card className="p-8 bg-white/95 backdrop-blur-lg">
          <h3 className="text-3xl font-bold text-gray-800 mb-8 text-center">
            📊 Feature Comparison
          </h3>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2">
                  <th className="text-left py-4 px-4">Feature</th>
                  <th className="text-center py-4 px-4">Free</th>
                  <th className="text-center py-4 px-4 bg-purple-50">Plus</th>
                  <th className="text-center py-4 px-4 bg-yellow-50">Premium</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="py-3 px-4">Daily Swipes</td>
                  <td className="text-center py-3 px-4">20</td>
                  <td className="text-center py-3 px-4 bg-purple-50">♾️ Unlimited</td>
                  <td className="text-center py-3 px-4 bg-yellow-50">♾️ Unlimited</td>
                </tr>
                <tr className="border-b">
                  <td className="py-3 px-4">Friend Matching</td>
                  <td className="text-center py-3 px-4">❌</td>
                  <td className="text-center py-3 px-4 bg-purple-50">✅</td>
                  <td className="text-center py-3 px-4 bg-yellow-50">✅</td>
                </tr>
                <tr className="border-b">
                  <td className="py-3 px-4">Compatibility Quizzes</td>
                  <td className="text-center py-3 px-4">❌</td>
                  <td className="text-center py-3 px-4 bg-purple-50">✅ Both</td>
                  <td className="text-center py-3 px-4 bg-yellow-50">✅ Both</td>
                </tr>
                <tr className="border-b">
                  <td className="py-3 px-4">3D Games</td>
                  <td className="text-center py-3 px-4">❌</td>
                  <td className="text-center py-3 px-4 bg-purple-50">✅</td>
                  <td className="text-center py-3 px-4 bg-yellow-50">✅</td>
                </tr>
                <tr className="border-b">
                  <td className="py-3 px-4">AI Group Planner</td>
                  <td className="text-center py-3 px-4">❌</td>
                  <td className="text-center py-3 px-4 bg-purple-50">2/week</td>
                  <td className="text-center py-3 px-4 bg-yellow-50">♾️ Unlimited</td>
                </tr>
                <tr className="border-b">
                  <td className="py-3 px-4">Monthly Credits</td>
                  <td className="text-center py-3 px-4">50</td>
                  <td className="text-center py-3 px-4 bg-purple-50">200</td>
                  <td className="text-center py-3 px-4 bg-yellow-50">500</td>
                </tr>
                <tr className="border-b">
                  <td className="py-3 px-4">See Who Liked You</td>
                  <td className="text-center py-3 px-4">30 credits</td>
                  <td className="text-center py-3 px-4 bg-purple-50">30 credits</td>
                  <td className="text-center py-3 px-4 bg-yellow-50">✅ Free</td>
                </tr>
                <tr>
                  <td className="py-3 px-4">Tournament Discount</td>
                  <td className="text-center py-3 px-4">0%</td>
                  <td className="text-center py-3 px-4 bg-purple-50">20%</td>
                  <td className="text-center py-3 px-4 bg-yellow-50">50%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
