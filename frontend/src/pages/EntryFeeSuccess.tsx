import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, Sparkles, ArrowRight, Gift } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const EntryFeeSuccess = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [verifying, setVerifying] = useState(true);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const sessionId = searchParams.get('session_id');

    if (!sessionId) {
      setError('No session ID found');
      setVerifying(false);
      return;
    }

    verifyPayment(sessionId);
  }, [searchParams]);

  const verifyPayment = async (sessionId) => {
    try {
      const response = await fetch(`${API_URL}/api/entry-fee/verify-payment?session_id=${sessionId}`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Payment verification failed');
      }

      const data = await response.json();

      if (data.success) {
        setVerified(true);
      } else {
        setError(data.message || 'Verification failed');
      }
    } catch (err) {
      // console.error('Error verifying payment:', err);
      setError('Failed to verify payment. Please contact support.');
    } finally {
      setVerifying(false);
    }
  };

  const handleContinue = () => {
    navigate('/games');
  };

  if (verifying) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-cyan-400 text-xl">Verifying your payment...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-red-900 to-black flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-red-900/30 border border-red-500 rounded-2xl p-8 text-center">
          <div className="text-red-400 text-6xl mb-4">⚠️</div>
          <h1 className="text-3xl font-bold text-red-300 mb-4">Verification Error</h1>
          <p className="text-red-200 mb-6">{error}</p>
          <button
            onClick={() => navigate('/entry-fee')}
            className="bg-red-600 hover:bg-red-500 text-white font-bold py-3 px-6 rounded-lg transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-black flex items-center justify-center px-4">
      <div className="max-w-2xl w-full">
        {/* Success Animation */}
        <div className="text-center mb-8">
          <div className="relative inline-block">
            <CheckCircle className="w-24 h-24 text-green-400 mx-auto animate-bounce" />
            <Sparkles className="w-8 h-8 text-yellow-400 absolute -top-2 -right-2 animate-pulse" />
          </div>
        </div>

        {/* Main Success Card */}
        <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-xl border border-green-500/30 rounded-2xl p-8 md:p-12 shadow-2xl text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-black bg-gradient-to-r from-green-400 via-cyan-400 to-blue-500 bg-clip-text text-transparent mb-4">
            Welcome to Global Vibez DSG!
          </h1>
          
          <p className="text-xl text-gray-300 mb-8">
            🎉 Your payment was successful. You now have full access to the platform!
          </p>

          {/* Access Granted Features */}
          <div className="bg-black/40 rounded-lg p-6 mb-8">
            <h2 className="text-white font-bold text-lg mb-4 flex items-center justify-center gap-2">
              <Gift className="w-5 h-5 text-cyan-400" />
              You've Unlocked:
            </h2>
            <div className="grid md:grid-cols-2 gap-3 text-left">
              {[
                { icon: '🎮', text: 'All 34+ Casino & Card Games' },
                { icon: '💙', text: 'Unlimited Dating Swipes' },
                { icon: '🏆', text: 'Tournament Access' },
                { icon: '🚗', text: 'Vibe Ridez Booking' },
                { icon: '🎁', text: '3 Guest Passes' },
                { icon: '⚡', text: 'Battle Pass Progression' },
                { icon: '🎨', text: 'Cosmetics Shop Access' },
                { icon: '👑', text: 'Elite Community Membership' }
              ].map((item, index) => (
                <div key={`item-${index}`} className="flex items-center gap-3 bg-green-900/20 rounded-lg p-3">
                  <span className="text-2xl">{item.icon}</span>
                  <span className="text-gray-300 text-sm font-semibold">{item.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Guest Passes Info */}
          <div className="bg-gradient-to-r from-purple-900/30 to-pink-900/30 border border-purple-500/30 rounded-lg p-6 mb-8">
            <h3 className="text-purple-300 font-bold mb-2 flex items-center justify-center gap-2">
              <Gift className="w-5 h-5" />
              Bonus: 3 Guest Passes Granted
            </h3>
            <p className="text-gray-400 text-sm">
              Invite 3 friends to try Global Vibez DSG with 24-hour trial passes. 
              Find them in your profile settings!
            </p>
          </div>

          {/* CTA Button */}
          <button
            onClick={handleContinue}
            className="w-full bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-600 hover:from-cyan-400 hover:via-blue-400 hover:to-purple-500 text-white font-black text-xl py-5 rounded-xl transition-all transform hover:scale-[1.02] shadow-lg shadow-cyan-500/50 flex items-center justify-center gap-3"
          >
            <span>Start Your Journey</span>
            <ArrowRight className="w-6 h-6" />
          </button>
        </div>

        {/* Next Steps */}
        <div className="text-center">
          <p className="text-gray-400 text-sm">
            Need help getting started? Check out our{' '}
            <span className="text-cyan-400 cursor-pointer hover:underline">Quick Start Guide</span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default EntryFeeSuccess;
