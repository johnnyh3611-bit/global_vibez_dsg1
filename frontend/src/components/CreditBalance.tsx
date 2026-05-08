import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Coins, TrendingUp } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

export default function CreditBalance() {
  const navigate = useNavigate();
  const [balance, setBalance] = useState(0);
  const [tier, setTier] = useState('free');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBalance();
  }, []);

  const fetchBalance = async () => {
    try {
      const response = await fetch(`${API}/api/subscriptions/me`, {
      });
      if (response.ok) {
        const data = await response.json();
        setBalance(data.credits_balance);
        setTier(data.tier);
      }
    } catch (err) {
      // console.error('Error fetching balance:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return null;

  return (
    <button
      onClick={() => navigate('/pricing')}
      className="flex items-center gap-2 bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 text-white px-4 py-2 rounded-full font-semibold shadow-lg transition-all hover:scale-105"
    >
      <Coins className="w-5 h-5" />
      <span>{balance}</span>
      {tier === 'free' && (
        <TrendingUp className="w-4 h-4" />
      )}
    </button>
  );
}
