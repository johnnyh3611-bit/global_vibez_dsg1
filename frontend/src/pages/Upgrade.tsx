import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Globe, Crown, Check, ArrowLeft, Loader2 } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function Upgrade() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleUpgrade = async () => {
    setLoading(true);

    try {
      const originUrl = process.env.REACT_APP_FRONTEND_URL;
      
      const response = await fetch(`${API}/payment/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        
        body: JSON.stringify({
          package_id: 'premium_monthly',
          origin_url: originUrl
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create checkout session');
      }

      const data = await response.json();
      
      // Redirect to Stripe Checkout
      window.location.href = data.url;
    } catch (error) {
      // console.error('Payment error:', error);
      alert('Failed to initiate payment. Please try again.');
      setLoading(false);
    }
  };

  const premiumFeatures = [
    'Unlimited swipes',
    'See who liked you',
    'Real-time translation everywhere',
    'Unlimited speed dating sessions',
    'Date planning tools',
    'GPS safety tracking',
    'Advanced games',
    'Advanced filters',
    'Rewind swipes',
    'Profile boost'
  ];

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
            <h1 className="text-2xl font-bold text-white">Global Vibez DSG</h1>
          </div>
          <div className="w-20" />
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-12">
        <div className="max-w-2xl mx-auto">
          <Card className="bg-white rounded-3xl shadow-2xl overflow-hidden">
            {/* Premium Badge */}
            <div className="bg-gradient-to-r from-yellow-400 to-orange-500 p-8 text-center">
              <Crown className="w-16 h-16 mx-auto mb-4 text-white" />
              <h2 className="text-4xl font-bold text-white mb-2">Go Premium</h2>
              <p className="text-white/90 text-lg">Unlock the full Global Vibez DSG experience</p>
            </div>

            {/* Pricing */}
            <div className="p-8 text-center border-b">
              <div className="text-5xl font-bold text-purple-600 mb-2">$9.99</div>
              <div className="text-gray-600 text-lg">per month</div>
            </div>

            {/* Features */}
            <div className="p-8">
              <h3 className="text-2xl font-bold text-gray-800 mb-6">Premium Features:</h3>
              <div className="grid gap-4">
                {premiumFeatures.map((feature, index) => (
                  <div key={`premiumFeatures-${index}`} className="flex items-center gap-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-gray-700 text-lg">{feature}</span>
                  </div>
                ))}
              </div>

              {/* CTA Button */}
              <Button
                onClick={handleUpgrade}
                disabled={loading}
                className="w-full mt-8 bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white text-lg py-6"
                data-testid="upgrade-btn"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Crown className="w-5 h-5 mr-2" />
                    Upgrade to Premium
                  </>
                )}
              </Button>

              <p className="text-center text-gray-500 text-sm mt-4">
                Cancel anytime. Secure payment powered by Stripe.
              </p>
            </div>
          </Card>

          {/* Money to your account note */}
          <div className="mt-6 text-center text-white/80 text-sm">
            <p>💳 All payments will be processed to your connected Stripe account</p>
            <p className="mt-2">🔒 Secure checkout · Instant activation · Cancel anytime</p>
          </div>
        </div>
      </main>
    </div>
  );
}