import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Crown, Zap, Gift, TrendingUp, Check, Play, Sparkles } from 'lucide-react';
import BackButton from '../components/BackButton';
import RewardedVideoAd from '../components/monetization/RewardedVideoAd';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function PremiumStore() {
  const [activeTab, setActiveTab] = useState('subscriptions');
  const [creditPackages, setCreditPackages] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [userBalance, setUserBalance] = useState(0);
  const [showAdModal, setShowAdModal] = useState(false);
  const [adRewardType, setAdRewardType] = useState('credits');

  useEffect(() => {
    fetchCreditPackages();
    fetchSubscriptions();
    fetchBalance();
  }, []);

  const fetchCreditPackages = async () => {
    try {
      const response = await fetch(`${API_URL}/api/monetization/credits/packages`);
      const data = await response.json();
      setCreditPackages(data.packages || []);
    } catch (error) {
      // console.error('Failed to fetch credit packages:', error);
    }
  };

  const fetchSubscriptions = async () => {
    try {
      const response = await fetch(`${API_URL}/api/monetization/subscriptions/tiers`);
      const data = await response.json();
      setSubscriptions(data.tiers || []);
    } catch (error) {
      // console.error('Failed to fetch subscriptions:', error);
    }
  };

  const fetchBalance = async () => {
    try {
      const response = await fetch(`${API_URL}/api/monetization/credits/balance`, {
      });
      const data = await response.json();
      setUserBalance(data.credits || 0);
    } catch (error) {
      // console.error('Failed to fetch balance:', error);
    }
  };

  const handleWatchAd = (rewardType) => {
    setAdRewardType(rewardType);
    setShowAdModal(true);
  };

  const handleAdComplete = (data) => {
    // fetchBalance(); // Refresh balance
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 text-white p-4">
      <BackButton />

      <div className="max-w-7xl mx-auto pt-16">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-yellow-400 to-pink-500 bg-clip-text text-transparent">
            💎 Premium Store
          </h1>
          <p className="text-xl text-purple-200">Unlock exclusive features and earn rewards</p>

          {/* User Balance */}
          <div className="mt-8 inline-flex items-center gap-3 bg-white/10 backdrop-blur-lg rounded-full px-6 py-3 border border-white/20">
            <Sparkles className="text-yellow-400" size={24} />
            <div>
              <div className="text-sm text-purple-200">Your Balance</div>
              <div className="text-2xl font-bold text-yellow-400">{userBalance.toLocaleString()} Credits</div>
            </div>
          </div>
        </motion.div>

        {/* Tabs */}
        <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
          {[
            { id: 'subscriptions', label: 'Subscriptions', icon: Crown },
            { id: 'credits', label: 'Buy Credits', icon: Sparkles },
            { id: 'ads', label: 'Watch & Earn', icon: Play }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg font-semibold whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'bg-purple-600 text-white'
                  : 'bg-white/10 text-purple-200 hover:bg-white/20'
              }`}
            >
              <tab.icon size={20} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div>
          {activeTab === 'subscriptions' && (
            <SubscriptionsTab subscriptions={subscriptions} />
          )}

          {activeTab === 'credits' && (
            <CreditsTab packages={creditPackages} onPurchase={fetchBalance} />
          )}

          {activeTab === 'ads' && (
            <AdsTab onWatchAd={handleWatchAd} />
          )}
        </div>
      </div>

      {/* Rewarded Video Ad Modal */}
      {showAdModal && (
        <RewardedVideoAd
          rewardType={adRewardType}
          onComplete={handleAdComplete}
          onClose={() => setShowAdModal(false)}
        />
      )}
    </div>
  );
}

// Subscriptions Tab
function SubscriptionsTab({ subscriptions }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
      {subscriptions.map((sub) => (
        <SubscriptionCard key={sub.id} subscription={sub} />
      ))}
    </div>
  );
}

function SubscriptionCard({ subscription }) {
  const isFree = subscription.price === 0;
  const isPopular = subscription.id === 'elite';

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      className={`relative bg-gradient-to-br ${
        isFree 
          ? 'from-gray-700 to-gray-800'
          : subscription.id === 'vip'
          ? 'from-purple-600 to-pink-600'
          : 'from-blue-600 to-cyan-600'
      } rounded-2xl p-8 border-2 ${
        isPopular ? 'border-yellow-400' : 'border-white/20'
      }`}
    >
      {isPopular && (
        <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-yellow-400 text-black px-4 py-1 rounded-full text-sm font-bold">
          MOST POPULAR
        </div>
      )}

      <div className="text-center mb-6">
        <div className="text-4xl mb-3">
          {isFree ? '🆓' : subscription.id === 'vip' ? '👑' : '⭐'}
        </div>
        <h3 className="text-2xl font-bold mb-2">{subscription.name}</h3>
        <div className="text-4xl font-bold mb-1">${subscription.price}</div>
        <div className="text-white/70 text-sm">per month</div>
      </div>

      <div className="space-y-3 mb-8">
        {subscription.features.map((feature, idx) => (
          <div key={`feature-${subscription.name}-${feature.slice(0, 20)}-${idx}`} className="flex items-start gap-2">
            <Check className="text-green-400 flex-shrink-0 mt-0.5" size={18} />
            <span className="text-sm">{feature.replace(/_/g, ' ')}</span>
          </div>
        ))}

        {subscription.credits_monthly > 0 && (
          <div className="flex items-start gap-2 text-yellow-300">
            <Sparkles className="flex-shrink-0 mt-0.5" size={18} />
            <span className="text-sm font-semibold">{subscription.credits_monthly} Credits Monthly</span>
          </div>
        )}
      </div>

      <button
        disabled={isFree}
        className={`w-full py-3 rounded-xl font-bold transition-all ${
          isFree
            ? 'bg-gray-600 cursor-not-allowed'
            : 'bg-white text-gray-900 hover:bg-gray-100'
        }`}
      >
        {isFree ? 'Current Plan' : 'Upgrade Now'}
      </button>
    </motion.div>
  );
}

// Credits Tab
function CreditsTab({ packages, onPurchase }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {packages.map((pkg) => (
        <CreditPackageCard key={pkg.id} package={pkg} onPurchase={onPurchase} />
      ))}
    </div>
  );
}

function CreditPackageCard({ package: pkg, onPurchase }) {
  const isBestValue = pkg.id === 'best_value';

  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      className={`relative bg-white/10 backdrop-blur-lg rounded-2xl p-6 border-2 ${
        isBestValue ? 'border-green-400' : 'border-white/20'
      }`}
    >
      {isBestValue && (
        <div className="absolute -top-3 right-4 bg-green-400 text-black px-3 py-1 rounded-full text-xs font-bold">
          BEST VALUE
        </div>
      )}

      {pkg.bonus > 0 && (
        <div className="absolute -top-3 left-4 bg-yellow-400 text-black px-3 py-1 rounded-full text-xs font-bold">
          +{pkg.bonus} BONUS
        </div>
      )}

      <div className="text-center mb-4">
        <div className="text-4xl mb-2">💎</div>
        <div className="text-3xl font-bold text-yellow-400">{pkg.total.toLocaleString()}</div>
        <div className="text-sm text-purple-200">Credits</div>
        {pkg.bonus > 0 && (
          <div className="text-xs text-green-300 mt-1">
            ({pkg.credits} + {pkg.bonus} bonus)
          </div>
        )}
      </div>

      <div className="bg-black/30 rounded-lg p-3 mb-4 text-center">
        <div className="text-2xl font-bold">${pkg.price}</div>
        <div className="text-xs text-purple-300">
          {pkg.value_per_dollar.toFixed(0)} credits per $
        </div>
      </div>

      <button className="w-full py-3 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 font-bold">
        Buy Now
      </button>
    </motion.div>
  );
}

// Ads Tab
function AdsTab({ onWatchAd }) {
  const adOptions = [
    {
      type: 'credits',
      title: 'Earn 100 Credits',
      description: 'Watch a 30-second video',
      icon: '💰',
      color: 'from-yellow-500 to-orange-500'
    },
    {
      type: 'boost',
      title: 'Dating Boost',
      description: '24-hour profile boost',
      icon: '✨',
      color: 'from-pink-500 to-purple-500'
    },
    {
      type: 'continue',
      title: 'Game Continue',
      description: 'Continue your game',
      icon: '🎮',
      color: 'from-green-500 to-emerald-500'
    }
  ];

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 mb-8 border border-white/20">
        <div className="text-center">
          <div className="text-5xl mb-4">📺</div>
          <h2 className="text-3xl font-bold mb-2">Watch Ads, Earn Rewards!</h2>
          <p className="text-purple-200">
            Support the platform and earn rewards, boosts, and more
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {adOptions.map((option) => (
          <motion.div
            key={option.type}
            whileHover={{ scale: 1.05 }}
            className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20"
          >
            <div className="text-center mb-6">
              <div className="text-5xl mb-3">{option.icon}</div>
              <h3 className="text-xl font-bold mb-2">{option.title}</h3>
              <p className="text-sm text-purple-200">{option.description}</p>
            </div>

            <button
              onClick={() => onWatchAd(option.type)}
              className={`w-full py-3 rounded-xl font-bold bg-gradient-to-r ${option.color} hover:opacity-90 transition-opacity flex items-center justify-center gap-2`}
            >
              <Play size={20} />
              Watch Ad
            </button>

            <div className="mt-3 text-center text-xs text-purple-300">
              Available every 30 minutes
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
