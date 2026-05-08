import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Crown, Zap, Shield, Users, Gamepad2, Heart, Sparkles, Lock, Check } from 'lucide-react';
import TrialCountdown from '../components/TrialCountdown';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const EntryFeePaywall = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);

  useEffect(() => {
    fetchEntryFeeStatus();
  }, []);

  const fetchEntryFeeStatus = async () => {
    try {
      const response = await fetch(`${API_URL}/api/entry-fee/status`, {
      });

      if (!response.ok) {
        throw new Error('Failed to fetch status');
      }

      const data = await response.json();
      setStatus(data);

      // If already paid, redirect to dashboard
      if (data.entry_fee_paid) {
        navigate('/games');
      }
    } catch (error) {
      // console.error('Error fetching entry fee status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async () => {
    setPurchasing(true);

    try {
      const response = await fetch(`${API_URL}/api/entry-fee/purchase`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to create checkout session');
      }

      const data = await response.json();

      if (data.success && data.checkout_url) {
        // Redirect to Stripe checkout
        window.location.href = data.checkout_url;
      } else {
        throw new Error('Invalid checkout response');
      }
    } catch (error) {
      // console.error('Error purchasing entry fee:', error);
      alert('Failed to start checkout. Please try again.');
      setPurchasing(false);
    }
  };

  const handleTrialExpired = () => {
    fetchEntryFeeStatus();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-black flex items-center justify-center">
        <div className="text-cyan-400 text-xl">Loading...</div>
      </div>
    );
  }

  const hasAccess = status?.has_access || status?.entry_fee_paid;
  const trialActive = status?.trial_active || status?.access_tier === 'trial';

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-black py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-cyan-500/20 border border-cyan-500 rounded-full px-4 py-2 mb-4">
            <Crown className="w-5 h-5 text-yellow-400" />
            <span className="text-cyan-300 font-bold text-sm uppercase tracking-wider">Premium Access</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-black bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent mb-4">
            Global Vibez DSG
          </h1>
          <p className="text-xl text-gray-300">The Elite Social Gaming & Dating Experience</p>
        </div>

        {/* Trial Countdown (if active) */}
        {trialActive && status?.trial_expires_at && (
          <div className="mb-8">
            <TrialCountdown 
              trialExpiresAt={status.trial_expires_at} 
              onExpired={handleTrialExpired}
            />
          </div>
        )}

        {/* Access Locked Banner (if trial expired) */}
        {!hasAccess && (
          <div className="bg-red-900/30 border border-red-500 rounded-lg p-6 mb-8 text-center">
            <Lock className="w-12 h-12 text-red-400 mx-auto mb-3" />
            <h2 className="text-2xl font-bold text-red-300 mb-2">Access Locked</h2>
            <p className="text-red-200">Your trial has expired. Unlock full access to continue your journey.</p>
          </div>
        )}

        {/* Main Card */}
        <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-xl border border-cyan-500/30 rounded-2xl p-8 md:p-12 shadow-2xl">
          {/* Pricing */}
          <div className="text-center mb-8">
            <div className="text-6xl md:text-7xl font-black text-white mb-2">
              $50
            </div>
            <div className="text-cyan-400 text-lg font-semibold mb-1">One-Time Entry Fee</div>
            <div className="text-gray-400 text-sm">Lifetime Access • No Subscriptions</div>
          </div>

          {/* Value Propositions */}
          <div className="grid md:grid-cols-2 gap-4 mb-8">
            <div className="bg-black/30 rounded-lg p-4 border border-purple-500/30">
              <div className="flex items-start gap-3">
                <Shield className="w-6 h-6 text-purple-400 mt-1" />
                <div>
                  <h3 className="text-white font-bold mb-1">Bot-Free Community</h3>
                  <p className="text-gray-400 text-sm">Premium entry fee ensures authentic, high-quality members only</p>
                </div>
              </div>
            </div>

            <div className="bg-black/30 rounded-lg p-4 border border-cyan-500/30">
              <div className="flex items-start gap-3">
                <Gamepad2 className="w-6 h-6 text-cyan-400 mt-1" />
                <div>
                  <h3 className="text-white font-bold mb-1">34+ AAA Games</h3>
                  <p className="text-gray-400 text-sm">Casino tables, card games, tournaments with real prizes</p>
                </div>
              </div>
            </div>

            <div className="bg-black/30 rounded-lg p-4 border border-pink-500/30">
              <div className="flex items-start gap-3">
                <Heart className="w-6 h-6 text-pink-400 mt-1" />
                <div>
                  <h3 className="text-white font-bold mb-1">Elite Dating</h3>
                  <p className="text-gray-400 text-sm">Match with verified members, AI dating coach, VR dates</p>
                </div>
              </div>
            </div>

            <div className="bg-black/30 rounded-lg p-4 border border-yellow-500/30">
              <div className="flex items-start gap-3">
                <Users className="w-6 h-6 text-yellow-400 mt-1" />
                <div>
                  <h3 className="text-white font-bold mb-1">Social Hubs</h3>
                  <p className="text-gray-400 text-sm">Vibe Ridez, live streaming, exclusive events & lounges</p>
                </div>
              </div>
            </div>
          </div>

          {/* What's Included */}
          <div className="bg-black/40 rounded-lg p-6 mb-8">
            <h3 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-cyan-400" />
              What You Get:
            </h3>
            <div className="grid md:grid-cols-2 gap-3">
              {[
                'Full access to all 34+ games',
                'Unlimited dating swipes',
                'Tournament participation',
                'Vibe Ridez booking',
                'Live streaming access',
                'Battle Pass progression',
                '3 Guest passes to invite friends',
                'Premium support',
                'Exclusive community access',
                'Monthly coin bonuses'
              ].map((feature, index) => (
                <div key={`item-${index}`} className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-400 flex-shrink-0" />
                  <span className="text-gray-300 text-sm">{feature}</span>
                </div>
              ))}
            </div>
          </div>

          {/* CTA Button */}
          <button
            onClick={handlePurchase}
            disabled={purchasing || hasAccess}
            className="w-full bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-600 hover:from-cyan-400 hover:via-blue-400 hover:to-purple-500 text-white font-black text-xl py-5 rounded-xl transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-cyan-500/50 flex items-center justify-center gap-3"
          >
            {purchasing ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Processing...
              </>
            ) : hasAccess ? (
              <>
                <Check className="w-6 h-6" />
                Access Granted
              </>
            ) : (
              <>
                <Zap className="w-6 h-6" />
                Unlock Global Vibez DSG - $50
              </>
            )}
          </button>

          {/* Trust Badges */}
          <div className="mt-6 flex items-center justify-center gap-4 text-gray-400 text-xs">
            <div className="flex items-center gap-1">
              <Shield className="w-4 h-4" />
              Secure Payment
            </div>
            <div className="text-gray-600">•</div>
            <div>Money-Back Guarantee</div>
            <div className="text-gray-600">•</div>
            <div>Powered by Stripe</div>
          </div>
        </div>

        {/* Additional Info */}
        <div className="mt-8 text-center">
          <p className="text-gray-400 text-sm mb-2">
            {trialActive ? 'Enjoying your trial?' : 'Questions?'} Join the exclusive Global Vibez community today.
          </p>
          <p className="text-gray-500 text-xs">
            By purchasing, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </div>
    </div>
  );
};

export default EntryFeePaywall;
