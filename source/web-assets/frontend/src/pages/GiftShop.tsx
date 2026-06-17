import React, { useState, useEffect } from 'react';
import { Gift, Heart, Star, Zap, ShoppingCart } from 'lucide-react';
import BackButton from '@/components/BackButton';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function GiftShop() {
  const [gifts, setGifts] = useState([]);
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchGifts();
  }, []);

  const fetchGifts = async () => {
    try {
      const response = await fetch(`${API_URL}/api/cosmetics-shop/items`);
      const data = await response.json();
      setGifts(data.items || []);
    } catch (error) {
      // console.error('Error fetching gifts:', error);
    } finally {
      setLoading(false);
    }
  };

  const addToCart = (gift) => {
    setCart([...cart, gift]);
  };

  const purchaseGift = async (recipientId) => {
    try {
      const token = localStorage.getItem('auth_token');
      const userRes = await fetch(`${API_URL}/api/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const userData = await userRes.json();

      for (const item of cart) {
        await fetch(`${API_URL}/api/cosmetics-shop/purchase`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            user_id: userData.user_id,
            item_id: item.item_id,
            gift_to: recipientId
          })
        });
      }
      alert(`✅ Gift sent successfully!`);
      setCart([]);
    } catch (error) {
      alert('Failed to send gift');
    }
  };

  const getIcon = (type) => {
    if (type.includes('heart')) return <Heart className="w-8 h-8" />;
    if (type.includes('star')) return <Star className="w-8 h-8" />;
    if (type.includes('boost')) return <Zap className="w-8 h-8" />;
    return <Gift className="w-8 h-8" />;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-900 via-purple-900 to-black py-8 px-4">
      <BackButton to="/dashboard" label="Back" variant="default" />
      
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-black bg-gradient-to-r from-pink-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent mb-4">
            🎁 Gift Shop
          </h1>
          <p className="text-gray-300 text-lg">Send gifts to show your appreciation</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {gifts.map((gift) => (
            <Card key={gift.item_id} className="bg-gray-800/50 border-gray-600 p-6 hover:shadow-xl hover:shadow-pink-500/20 transition-all">
              <div className="text-pink-400 mb-4">{getIcon(gift.item_type)}</div>
              <h3 className="text-xl font-bold text-white mb-2">{gift.name}</h3>
              <p className="text-gray-400 text-sm mb-4">{gift.description}</p>
              <div className="flex items-center justify-between">
                <span className="text-2xl font-black text-yellow-400">₵{(gift.price || 0).toLocaleString()}</span>
                <Button onClick={() => addToCart(gift)} className="bg-pink-500 hover:bg-pink-600">
                  <ShoppingCart className="w-4 h-4 mr-2" />
                  Add
                </Button>
              </div>
            </Card>
          ))}
        </div>

        {cart.length > 0 && (
          <Card className="mt-8 bg-gray-800/50 border-gray-600 p-6">
            <h2 className="text-xl font-bold text-white mb-4">Cart ({cart.length} items)</h2>
            <Button onClick={() => purchaseGift('recipient_id')} className="bg-green-500 hover:bg-green-600">
              Send Gifts
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
}
