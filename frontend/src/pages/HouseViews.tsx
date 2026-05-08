
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

const API = process.env.REACT_APP_BACKEND_URL;

export function HouseViews() {
  const navigate = useNavigate();
  const [houses, setHouses] = useState([]);
  interface HouseColor { hex: string; name: string }
  const [colorOptions, setColorOptions] = useState<{ felt: Record<string, HouseColor>; border: Record<string, HouseColor> }>({ felt: {}, border: {} });
  const [userCoins, setUserCoins] = useState(2500);
  const [ownedHouses, setOwnedHouses] = useState([]);
  const [selectedHouse, setSelectedHouse] = useState('classic');
  const [customColors, setCustomColors] = useState({ felt: 'green', border: 'walnut' });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, traditional, cyberpunk
  const [showColorCustomizer, setShowColorCustomizer] = useState(false);
  const [purchaseMessage, setPurchaseMessage] = useState(null);

  useEffect(() => {
    loadHouseViews();
    loadUserData();
  }, []);

  const loadHouseViews = async () => {
    try {
      const response = await fetch(`${API}/api/tables/available`, {
      });
      const data = await response.json();
      setHouses(data.houses || []);
      setColorOptions(data.color_options || { felt: {}, border: {} });
    } catch (error) {
      // console.error('Failed to load house views:', error);
    }
  };

  const loadUserData = async () => {
    try {
      const response = await fetch(`${API}/api/profile`, {
      });
      const data = await response.json();
      setUserCoins(data.coins || 2500);
      setOwnedHouses(data.owned_houses || ['classic', 'emerald_elite', 'cyber_terminal']);
      setSelectedHouse(data.selected_house || 'classic');
      setCustomColors(data.custom_colors || { felt: 'green', border: 'walnut' });
      setLoading(false);
    } catch (error) {
      // console.error('Failed to load user data:', error);
      setLoading(false);
    }
  };

  const purchaseHouse = async (houseId, cost) => {
    try {
      const response = await fetch(`${API}/api/tables/purchase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        
        body: JSON.stringify({ house_id: houseId })
      });
      
      if (response.ok) {
        const data = await response.json();
        setUserCoins(data.coins_remaining);
        setOwnedHouses([...ownedHouses, houseId]);
        setPurchaseMessage({ type: 'success', text: `🎉 ${data.message}` });
        setTimeout(() => setPurchaseMessage(null), 3000);
      } else {
        const error = await response.json();
        setPurchaseMessage({ type: 'error', text: `❌ ${error.detail}` });
        setTimeout(() => setPurchaseMessage(null), 3000);
      }
    } catch (error) {
      // console.error('Purchase failed:', error);
      setPurchaseMessage({ type: 'error', text: '❌ Purchase failed' });
      setTimeout(() => setPurchaseMessage(null), 3000);
    }
  };

  const selectHouse = async (houseId) => {
    try {
      const response = await fetch(`${API}/api/tables/select`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        
        body: JSON.stringify({ table_id: houseId })
      });
      
      if (response.ok) {
        setSelectedHouse(houseId);
        setPurchaseMessage({ type: 'success', text: '✅ House view selected!' });
        setTimeout(() => setPurchaseMessage(null), 2000);
      }
    } catch (error) {
      // console.error('Selection failed:', error);
    }
  };

  const updateColors = async (newColors) => {
    try {
      const response = await fetch(`${API}/api/tables/colors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        
        body: JSON.stringify(newColors)
      });
      
      if (response.ok) {
        setCustomColors(newColors);
        setPurchaseMessage({ type: 'success', text: '🎨 Colors updated!' });
        setTimeout(() => setPurchaseMessage(null), 2000);
      }
    } catch (error) {
      // console.error('Color update failed:', error);
    }
  };

  const filteredHouses = houses.filter(house => {
    if (filter === 'all') return true;
    return house.category === filter;
  });

  const freeHouses = filteredHouses.filter(h => h.is_free);
  const premiumHouses = filteredHouses.filter(h => !h.is_free);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black flex items-center justify-center">
        <div className="text-white text-xl">Loading House Views...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-purple-900/20 to-black">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-black/80 backdrop-blur-md border-b border-purple-500/30">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="text-white hover:text-purple-400 transition-colors"
            >
              ← Back
            </button>
            <h1 className="text-3xl font-black text-transparent bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text">
              🏛️ House Views Gallery
            </h1>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="bg-gradient-to-r from-yellow-600 to-yellow-500 px-6 py-2 rounded-full">
              <span className="text-white font-black text-lg">💰 {userCoins.toLocaleString()} Coins</span>
            </div>
            <button
              onClick={() => setShowColorCustomizer(!showColorCustomizer)}
              className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white font-bold px-6 py-2 rounded-full transition-all"
            >
              🎨 Customize Colors
            </button>
          </div>
        </div>
      </div>

      {/* Purchase Message */}
      <AnimatePresence>
        {purchaseMessage && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-24 left-1/2 -translate-x-1/2 z-50"
          >
            <div className={`px-8 py-4 rounded-2xl shadow-2xl font-bold text-lg ${
              purchaseMessage.type === 'success' 
                ? 'bg-green-600 text-white' 
                : 'bg-red-600 text-white'
            }`}>
              {purchaseMessage.text}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Color Customizer Modal */}
      <AnimatePresence>
        {showColorCustomizer && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm"
            onClick={() => setShowColorCustomizer(false)}
          >
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.8 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-gradient-to-br from-gray-900 to-gray-800 p-8 rounded-3xl border-4 border-cyan-500 shadow-2xl max-w-2xl w-full mx-4"
            >
              <h2 className="text-3xl font-black text-white mb-6">🎨 Customize Colors (FREE)</h2>
              
              {/* Felt Colors */}
              <div className="mb-8">
                <p className="text-white font-bold mb-3">Felt Color:</p>
                <div className="grid grid-cols-3 gap-3">
                  {Object.entries(colorOptions.felt || {}).map(([key, color]) => (
                    <button
                      key={key}
                      onClick={() => setCustomColors({ ...customColors, felt: key })}
                      className={`p-4 rounded-xl border-4 transition-all ${
                        customColors.felt === key 
                          ? 'border-white scale-105' 
                          : 'border-transparent hover:border-gray-500'
                      }`}
                      style={{ backgroundColor: color.hex }}
                    >
                      <span className="text-white font-bold text-sm drop-shadow-lg">
                        {color.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Border Colors */}
              <div className="mb-8">
                <p className="text-white font-bold mb-3">Border Color:</p>
                <div className="grid grid-cols-3 gap-3">
                  {Object.entries(colorOptions.border || {}).map(([key, color]) => (
                    <button
                      key={key}
                      onClick={() => setCustomColors({ ...customColors, border: key })}
                      className={`p-4 rounded-xl border-4 transition-all ${
                        customColors.border === key 
                          ? 'border-white scale-105' 
                          : 'border-transparent hover:border-gray-500'
                      }`}
                      style={{ backgroundColor: color.hex }}
                    >
                      <span className="text-white font-bold text-sm drop-shadow-lg">
                        {color.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => updateColors(customColors)}
                  className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-black py-4 rounded-xl transition-all"
                >
                  ✅ Apply Colors
                </button>
                <button
                  onClick={() => setShowColorCustomizer(false)}
                  className="px-8 bg-gray-700 hover:bg-gray-600 text-white font-bold py-4 rounded-xl transition-all"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filter Tabs */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="flex gap-4 justify-center">
          {['all', 'traditional', 'cyberpunk'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-8 py-3 rounded-full font-bold transition-all ${
                filter === f
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}
            >
              {f === 'all' ? '🏛️ All Houses' : f === 'traditional' ? '🎰 Traditional' : '🎮 Cyberpunk'}
            </button>
          ))}
        </div>
      </div>

      {/* House Grid */}
      <div className="max-w-7xl mx-auto px-6 pb-12">
        {/* Free Houses */}
        {freeHouses.length > 0 && (
          <div className="mb-12">
            <h2 className="text-2xl font-black text-white mb-6">🎁 FREE House Views</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {freeHouses.map((house) => (
                <HouseCard
                  key={house.id}
                  house={house}
                  isOwned={true}
                  isSelected={selectedHouse === house.id}
                  onSelect={() => selectHouse(house.id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Premium Houses */}
        {premiumHouses.length > 0 && (
          <div>
            <h2 className="text-2xl font-black text-white mb-6">💎 Premium House Views</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {premiumHouses.map((house) => (
                <HouseCard
                  key={house.id}
                  house={house}
                  isOwned={ownedHouses.includes(house.id)}
                  isSelected={selectedHouse === house.id}
                  userCoins={userCoins}
                  onPurchase={() => purchaseHouse(house.id, house.cost)}
                  onSelect={() => selectHouse(house.id)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function HouseCard({ house, isOwned, isSelected, userCoins, onPurchase, onSelect }: { house: any; isOwned?: any; isSelected?: any; userCoins?: any; onPurchase?: any; onSelect?: any }) {
  const canAfford = userCoins >= house.cost;
  
  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -5 }}
      className={`relative bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl overflow-hidden border-4 ${
        isSelected 
          ? 'border-green-500 shadow-2xl shadow-green-500/50' 
          : 'border-gray-700 hover:border-purple-500'
      } transition-all`}
    >
      {/* Preview Image Placeholder */}
      <div className="h-48 bg-gradient-to-br from-purple-900/50 to-pink-900/50 flex items-center justify-center">
        <span className="text-6xl">
          {house.category === 'traditional' ? '🎰' : '🎮'}
        </span>
      </div>

      {/* Content */}
      <div className="p-6">
        <div className="flex items-start justify-between mb-2">
          <h3 className="text-xl font-black text-white">{house.name}</h3>
          {house.is_free && (
            <span className="bg-green-600 text-white text-xs font-bold px-2 py-1 rounded-full">
              FREE
            </span>
          )}
        </div>
        
        <p className="text-gray-400 text-sm mb-4">{house.description}</p>

        {/* Price */}
        {!house.is_free && (
          <div className="mb-4">
            <span className={`text-2xl font-black ${canAfford ? 'text-yellow-400' : 'text-red-400'}`}>
              💰 {house.cost.toLocaleString()} Coins
            </span>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          {isOwned ? (
            <button
              onClick={onSelect}
              className={`flex-1 font-bold py-3 rounded-xl transition-all ${
                isSelected
                  ? 'bg-green-600 text-white cursor-default'
                  : 'bg-purple-600 hover:bg-purple-700 text-white'
              }`}
            >
              {isSelected ? '✓ Selected' : 'Select'}
            </button>
          ) : (
            <button
              onClick={onPurchase}
              disabled={!canAfford}
              className={`flex-1 font-bold py-3 rounded-xl transition-all ${
                canAfford
                  ? 'bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-700 hover:to-orange-700 text-white'
                  : 'bg-gray-700 text-gray-500 cursor-not-allowed'
              }`}
            >
              {canAfford ? '🛒 Buy Now' : '🔒 Need More Coins'}
            </button>
          )}
        </div>
      </div>

      {/* Selected Badge */}
      {isSelected && (
        <div className="absolute top-4 right-4 bg-green-600 text-white px-3 py-1 rounded-full font-bold text-sm">
          ✓ ACTIVE
        </div>
      )}
    </motion.div>
  );
}
