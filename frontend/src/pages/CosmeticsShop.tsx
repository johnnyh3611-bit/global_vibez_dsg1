import React, { useState, useEffect } from 'react';
import { ShoppingBag, Star, Lock, Check, Sparkles, Filter, Grid3x3 } from 'lucide-react';
import BackButton from '@/components/BackButton';
import TableStylePicker from '@/components/cosmetics/TableStylePicker';
import SpadesRulesetPicker from '@/components/games/SpadesRulesetPicker';
import { useSpadesRuleset } from '@/hooks/useSpadesRuleset';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const RARITY_COLORS = {
  common: 'border-gray-500 bg-gray-900/30',
  rare: 'border-blue-500 bg-blue-900/30',
  epic: 'border-purple-500 bg-purple-900/30',
  legendary: 'border-yellow-500 bg-yellow-900/30',
  mythic: 'border-pink-500 bg-pink-900/30'
};

const RARITY_BADGES = {
  common: 'bg-gray-500 text-white',
  rare: 'bg-blue-500 text-white',
  epic: 'bg-purple-500 text-white',
  legendary: 'bg-yellow-500 text-black',
  mythic: 'bg-gradient-to-r from-pink-500 to-purple-600 text-white'
};

const CosmeticsShop = () => {
  const [activeTab, setActiveTab] = useState('shop');
  const [catalog, setCatalog] = useState([]);
  const [myCollection, setMyCollection] = useState({ owned_cosmetics: [], equipped_cosmetics: {} });
  const [filterType, setFilterType] = useState('all');
  const [filterRarity, setFilterRarity] = useState('all');
  const [loading, setLoading] = useState(true);
  const [userCoins, setUserCoins] = useState(0);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [catalogRes, collectionRes, userRes] = await Promise.all([
        fetch(`${API_URL}/api/cosmetics/catalog`, { }),
        fetch(`${API_URL}/api/cosmetics/my-collection`, { }),
        fetch(`${API_URL}/api/auth/me`, { })
      ]);

      const catalogData = await catalogRes.json();
      const collectionData = await collectionRes.json();
      const userData = await userRes.json();

      setCatalog(catalogData.cosmetics || []);
      setMyCollection(collectionData);
      setUserCoins(userData.coins || 0);
    } catch (error) {
      // console.error('Error fetching cosmetics:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async (cosmeticId) => {
    try {
      const response = await fetch(`${API_URL}/api/cosmetics/purchase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        
        body: JSON.stringify({ cosmetic_id: cosmeticId })
      });

      const data = await response.json();

      if (data.success) {
        alert(`✅ ${data.message}`);
        fetchData();
      } else {
        throw new Error(data.message || 'Purchase failed');
      }
    } catch (error) {
      alert('Failed to purchase: ' + error.message);
    }
  };

  const handleEquip = async (cosmeticId, slot) => {
    try {
      const response = await fetch(`${API_URL}/api/cosmetics/equip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        
        body: JSON.stringify({ cosmetic_id: cosmeticId, slot })
      });

      const data = await response.json();

      if (data.success) {
        alert(`✅ Equipped!`);
        fetchData();
      } else {
        throw new Error(data.message || 'Failed to equip');
      }
    } catch (error) {
      alert('Failed to equip: ' + error.message);
    }
  };

  const filteredCatalog = catalog.filter(item => {
    if (filterType !== 'all' && item.type !== filterType) return false;
    if (filterRarity !== 'all' && item.rarity !== filterRarity) return false;
    return true;
  });

  const ownedCosmetics = myCollection.owned_cosmetics || [];

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-black flex items-center justify-center">
        <div className="text-cyan-400 text-xl">Loading shop...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-black py-8 px-4">
      {/* Back Button */}
      <BackButton to="/dashboard" label="Back to Hub" variant="default" />
      
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <ShoppingBag className="w-8 h-8 text-cyan-400" />
              <h1 className="text-5xl font-black bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-500 bg-clip-text text-transparent">
                Digital Twin Boutique
              </h1>
            </div>
            <p className="text-gray-300">Customize your avatar with exclusive cosmetics</p>
          </div>

          <div className="bg-yellow-500/20 border border-yellow-500 rounded-lg px-6 py-3">
            <div className="text-yellow-400 font-bold text-sm mb-1">Your Balance</div>
            <div className="text-3xl font-black text-white">{userCoins} Coins</div>
          </div>
        </div>

        {/* Per-table style picker — free cosmetic pref */}
        <div className="mb-6 grid lg:grid-cols-2 gap-4">
          <TableStylePicker />
          <SpadesRulesetPickerWrapper />
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-6">
          <button
            onClick={() => setActiveTab('shop')}
            className={`px-6 py-3 rounded-lg font-bold transition-all ${
              activeTab === 'shop'
                ? 'bg-cyan-500 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            <ShoppingBag className="w-5 h-5 inline mr-2" />
            Shop
          </button>
          <button
            onClick={() => setActiveTab('collection')}
            className={`px-6 py-3 rounded-lg font-bold transition-all ${
              activeTab === 'collection'
                ? 'bg-purple-500 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            <Grid3x3 className="w-5 h-5 inline mr-2" />
            My Collection ({ownedCosmetics.length})
          </button>
        </div>

        {/* Filters (Shop Tab Only) */}
        {activeTab === 'shop' && (
          <div className="bg-gray-800/50 rounded-lg p-4 mb-6 flex flex-wrap gap-4">
            <div>
              <label className="text-gray-400 text-sm mb-2 block">Type</label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600"
              >
                <option value="all">All Types</option>
                <option value="profile_frame">Profile Frames</option>
                <option value="badge">Badges</option>
                <option value="card_back">Card Backs</option>
                <option value="emote">Emotes</option>
              </select>
            </div>

            <div>
              <label className="text-gray-400 text-sm mb-2 block">Rarity</label>
              <select
                value={filterRarity}
                onChange={(e) => setFilterRarity(e.target.value)}
                className="bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600"
              >
                <option value="all">All Rarities</option>
                <option value="common">Common</option>
                <option value="rare">Rare</option>
                <option value="epic">Epic</option>
                <option value="legendary">Legendary</option>
                <option value="mythic">Mythic</option>
              </select>
            </div>
          </div>
        )}

        {/* Shop Grid */}
        {activeTab === 'shop' && (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {filteredCatalog.map((item) => {
              const isOwned = ownedCosmetics.includes(item.cosmetic_id);
              const canAfford = userCoins >= (item.price_coins || 0);
              const isLocked = item.battle_pass_season || item.requires_elite;

              return (
                <div
                  key={item.cosmetic_id}
                  className={`rounded-xl p-4 border-2 ${RARITY_COLORS[item.rarity]} backdrop-blur-sm transition-transform hover:scale-105`}
                >
                  {/* Image Placeholder */}
                  <div className="w-full h-40 bg-gradient-to-br from-gray-700 to-gray-800 rounded-lg mb-3 flex items-center justify-center">
                    <Sparkles className="w-16 h-16 text-gray-500" />
                  </div>

                  {/* Info */}
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-white font-bold truncate">{item.name}</h3>
                      <span className={`text-xs px-2 py-1 rounded ${RARITY_BADGES[item.rarity]} font-semibold uppercase`}>
                        {item.rarity}
                      </span>
                    </div>
                    <p className="text-gray-400 text-sm mb-2">{item.description}</p>
                    <p className="text-gray-500 text-xs capitalize">{item.type.replace('_', ' ')}</p>
                  </div>

                  {/* Action */}
                  {isOwned ? (
                    <button
                      onClick={() => handleEquip(item.cosmetic_id, item.type)}
                      className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                      <Check className="w-4 h-4" />
                      Equip
                    </button>
                  ) : isLocked ? (
                    <button
                      disabled
                      className="w-full bg-gray-700 text-gray-500 font-bold py-2 rounded-lg cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      <Lock className="w-4 h-4" />
                      {item.battle_pass_season ? 'Battle Pass' : 'Elite Only'}
                    </button>
                  ) : (
                    <button
                      onClick={() => handlePurchase(item.cosmetic_id)}
                      disabled={!canAfford}
                      className={`w-full font-bold py-2 rounded-lg transition-colors flex items-center justify-center gap-2 ${
                        canAfford
                          ? 'bg-cyan-500 hover:bg-cyan-400 text-white'
                          : 'bg-red-900/30 border border-red-500 text-red-400 cursor-not-allowed'
                      }`}
                    >
                      <ShoppingBag className="w-4 h-4" />
                      {item.price_coins} Coins
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* My Collection */}
        {activeTab === 'collection' && (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {myCollection.owned_cosmetics && myCollection.owned_cosmetics.length > 0 ? (
              catalog
                .filter(item => myCollection.owned_cosmetics.includes(item.cosmetic_id))
                .map((item) => {
                  const isEquipped = myCollection.equipped_cosmetics?.[item.type] === item.cosmetic_id;

                  return (
                    <div
                      key={item.cosmetic_id}
                      className={`rounded-xl p-4 border-2 ${RARITY_COLORS[item.rarity]} backdrop-blur-sm`}
                    >
                      <div className="w-full h-40 bg-gradient-to-br from-gray-700 to-gray-800 rounded-lg mb-3 flex items-center justify-center">
                        <Sparkles className="w-16 h-16 text-gray-500" />
                      </div>

                      <div className="mb-3">
                        <h3 className="text-white font-bold mb-1">{item.name}</h3>
                        <span className={`text-xs px-2 py-1 rounded ${RARITY_BADGES[item.rarity]} font-semibold uppercase`}>
                          {item.rarity}
                        </span>
                      </div>

                      {isEquipped ? (
                        <div className="bg-green-500/20 border border-green-500 text-green-400 font-bold py-2 rounded-lg text-center flex items-center justify-center gap-2">
                          <Check className="w-4 h-4" />
                          Equipped
                        </div>
                      ) : (
                        <button
                          onClick={() => handleEquip(item.cosmetic_id, item.type)}
                          className="w-full bg-cyan-500 hover:bg-cyan-400 text-white font-bold py-2 rounded-lg transition-colors"
                        >
                          Equip
                        </button>
                      )}
                    </div>
                  );
                })
            ) : (
              <div className="col-span-full text-center py-20">
                <ShoppingBag className="w-20 h-20 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400 text-lg">No cosmetics owned yet</p>
                <button
                  onClick={() => setActiveTab('shop')}
                  className="mt-4 bg-cyan-500 hover:bg-cyan-400 text-white font-bold px-6 py-3 rounded-lg transition-colors"
                >
                  Browse Shop
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CosmeticsShop;

/**
 * Tiny wrapper component so we can use the useSpadesRuleset hook within
 * the CosmeticsShop layout without restructuring the whole file.
 */
function SpadesRulesetPickerWrapper() {
  const { ruleset, setRuleset } = useSpadesRuleset();
  return <SpadesRulesetPicker value={ruleset} onChange={(r) => setRuleset(r as 'CLASSIC' | 'BIG_WHEEL')} />;
}
