import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Wallet, CreditCard, Gift, Send, ArrowRight, Sparkles } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function CreditsWallet() {
  const navigate = useNavigate();
  const [balance, setBalance] = useState(0);
  const [packages, setPackages] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showGiftCard, setShowGiftCard] = useState(false);
  const [giftAmount, setGiftAmount] = useState('');
  const [giftEmail, setGiftEmail] = useState('');
  const [redeemCode, setRedeemCode] = useState('');

  useEffect(() => {
    fetchWalletData();
  }, []);

  const fetchWalletData = async () => {
    try {
      const [balanceRes, packagesRes, transactionsRes] = await Promise.all([
        fetch(`${API_URL}/api/wallet/balance`, { }),
        fetch(`${API_URL}/api/wallet/packages`, { }),
        fetch(`${API_URL}/api/wallet/transactions?limit=10`, { })
      ]);

      if (balanceRes.ok) {
        const data = await balanceRes.json();
        setBalance(data.credit_balance);
      }

      if (packagesRes.ok) {
        const data = await packagesRes.json();
        setPackages(data.packages);
      }

      if (transactionsRes.ok) {
        const data = await transactionsRes.json();
        setTransactions(data.transactions);
      }
    } catch (error) {
      // console.error('Error fetching wallet data:', error);
    } finally {
      setLoading(false);
    }
  };

  const purchasePackage = async (packageId) => {
    try {
      const response = await fetch(`${API_URL}/api/wallet/purchase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        
        body: JSON.stringify({
          package_id: packageId,
          success_url: `${process.env.REACT_APP_FRONTEND_URL}/wallet?success=true`,
          cancel_url: `${process.env.REACT_APP_FRONTEND_URL}/wallet`
        })
      });

      if (response.ok) {
        const data = await response.json();
        window.location.href = data.checkout_url;
      }
    } catch (error) {
      // console.error('Error purchasing credits:', error);
    }
  };

  const createGiftCard = async () => {
    if (!giftAmount || parseFloat(giftAmount) <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/gift-cards/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        
        body: JSON.stringify({
          credit_amount: parseFloat(giftAmount),
          recipient_email: giftEmail || null,
          message: 'Enjoy your Global Vibez DSG credits!'
        })
      });

      if (response.ok) {
        const data = await response.json();
        alert(`Gift card created! Code: ${data.code}`);
        setShowGiftCard(false);
        setGiftAmount('');
        setGiftEmail('');
        fetchWalletData();
      } else {
        const error = await response.json();
        alert(error.detail || 'Failed to create gift card');
      }
    } catch (error) {
      // console.error('Error creating gift card:', error);
    }
  };

  const redeemGiftCard = async () => {
    if (!redeemCode) {
      alert('Please enter a gift card code');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/gift-cards/redeem`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        
        body: JSON.stringify({ code: redeemCode })
      });

      if (response.ok) {
        const data = await response.json();
        alert(`Success! ${data.credits_added} credits added to your wallet`);
        setRedeemCode('');
        fetchWalletData();
      } else {
        const error = await response.json();
        alert(error.detail || 'Failed to redeem gift card');
      }
    } catch (error) {
      // console.error('Error redeeming gift card:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <button onClick={() => navigate('/dashboard')} className="text-gray-600 hover:text-gray-900">
              ← Back
            </button>
            <div className="flex items-center space-x-2">
              <Wallet className="w-6 h-6 text-rose-600" />
              <h1 className="text-xl font-bold text-gray-900">My Wallet</h1>
            </div>
            <div className="w-16" />
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Balance Card */}
        <Card className="p-8 mb-8 bg-gradient-to-r from-rose-600 to-pink-600 text-white">
          <div className="text-center">
            <div className="flex items-center justify-center mb-2">
              <Sparkles className="w-6 h-6 mr-2" />
              <p className="text-lg opacity-90">Current Balance</p>
            </div>
            <h2 className="text-6xl font-bold mb-2">{balance.toFixed(1)}</h2>
            <p className="text-xl">Credits</p>
          </div>
        </Card>

        {/* Quick Actions */}
        <div className="grid md:grid-cols-2 gap-4 mb-8">
          <Button
            onClick={() => setShowGiftCard(!showGiftCard)}
            className="bg-gradient-to-r from-purple-600 to-pink-600 text-white py-6 text-lg"
          >
            <Gift className="w-5 h-5 mr-2" />
            Send Gift Card
          </Button>
          <div className="flex space-x-2">
            <input
              type="text"
              placeholder="Enter gift code"
              value={redeemCode}
              onChange={(e) => setRedeemCode(e.target.value)}
              className="flex-1 px-4 py-2 border rounded-lg"
            />
            <Button onClick={redeemGiftCard} className="bg-green-600 text-white">
              Redeem
            </Button>
          </div>
        </div>

        {/* Gift Card Creator */}
        {showGiftCard && (
          <Card className="p-6 mb-8 border-purple-200">
            <h3 className="text-xl font-bold mb-4">Create Gift Card</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Credit Amount</label>
                <input
                  type="number"
                  placeholder="10"
                  value={giftAmount}
                  onChange={(e) => setGiftAmount(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Recipient Email (Optional)</label>
                <input
                  type="email"
                  placeholder="friend@example.com"
                  value={giftEmail}
                  onChange={(e) => setGiftEmail(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg"
                />
              </div>
              <div className="flex space-x-2">
                <Button onClick={createGiftCard} className="flex-1 bg-purple-600 text-white">
                  Create Gift Card
                </Button>
                <Button onClick={() => setShowGiftCard(false)} variant="outline">
                  Cancel
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Credit Packages */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Buy Credits</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {packages.map((pkg) => (
              <Card
                key={pkg.package_id}
                className={`p-6 hover:shadow-xl transition-all cursor-pointer ${
                  pkg.popular ? 'border-2 border-rose-500 relative' : ''
                }`}
                onClick={() => purchasePackage(pkg.package_id)}
              >
                {pkg.popular && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <span className="bg-rose-600 text-white px-4 py-1 rounded-full text-sm font-bold">
                      POPULAR
                    </span>
                  </div>
                )}
                <div className="text-center">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">{pkg.name}</h3>
                  <div className="text-4xl font-bold text-rose-600 mb-2">
                    ${pkg.usd_amount}
                  </div>
                  <div className="text-2xl font-semibold text-gray-700 mb-1">
                    {pkg.credit_amount} Credits
                  </div>
                  {pkg.bonus_credits > 0 && (
                    <div className="text-sm text-green-600 font-medium">
                      +{pkg.bonus_credits} Bonus!
                    </div>
                  )}
                  <Button className="w-full mt-4 bg-rose-600 text-white">
                    Buy Now <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Recent Transactions */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Recent Transactions</h2>
          {transactions.length === 0 ? (
            <Card className="p-8 text-center text-gray-500">
              No transactions yet
            </Card>
          ) : (
            <div className="space-y-2">
              {transactions.map((txn) => (
                <Card key={txn.transaction_id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                        txn.amount > 0 ? 'bg-green-100' : 'bg-red-100'
                      }`}>
                        {txn.type === 'purchase' && <CreditCard className="w-6 h-6 text-green-600" />}
                        {txn.type === 'gift_sent' && <Send className="w-6 h-6 text-red-600" />}
                        {txn.type === 'gift_received' && <Gift className="w-6 h-6 text-green-600" />}
                        {txn.type === 'ride_payment' && <Wallet className="w-6 h-6 text-red-600" />}
                        {txn.type === 'driver_earning' && <Wallet className="w-6 h-6 text-green-600" />}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{txn.description}</p>
                        <p className="text-sm text-gray-500">
                          {new Date(txn.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className={`text-xl font-bold ${txn.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {txn.amount > 0 ? '+' : ''}{txn.amount.toFixed(1)}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
