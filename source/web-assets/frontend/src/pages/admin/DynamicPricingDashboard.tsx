
import React, { useState, useEffect } from 'react';
import { DollarSign, TrendingUp, TrendingDown, Clock, Users, Zap } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function DynamicPricingDashboard() {
  const [pricingData, setPricingData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingService, setEditingService] = useState(null);

  const SERVICES = [
    { id: 'vip_room_entry', name: 'VIP Room Entry', basePrice: 100 },
    { id: 'tournament_entry', name: 'Tournament Entry', basePrice: 50 },
    { id: 'private_table', name: 'Private Table', basePrice: 25 },
    { id: 'speed_dating_slot', name: 'Speed Dating Slot', basePrice: 10 }
  ];

  useEffect(() => {
    fetchPricingData();
  }, []);

  const fetchPricingData = async () => {
    try {
      const token = sessionStorage.getItem('admin_token') || localStorage.getItem('auth_token');
      const promises = SERVICES.map(service =>
        fetch(`${API_URL}/api/dynamic-pricing/price/${service.id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }).then(res => res.json())
      );

      const results = await Promise.all(promises);
      setPricingData(results);
    } catch (error) {
      // // console.error('Error fetching pricing:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateMultiplier = async (serviceType, newMultiplier) => {
    try {
      const token = sessionStorage.getItem('admin_token') || localStorage.getItem('auth_token');
      const response = await fetch(`${API_URL}/api/dynamic-pricing/update-multiplier`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          service_type: serviceType,
          multiplier: parseFloat(newMultiplier)
        })
      });

      const data = await response.json();
      if (data.success) {
        alert(`✅ Price multiplier updated to ${newMultiplier}x`);
        fetchPricingData();
        setEditingService(null);
      }
    } catch (error) {
      // // console.error('Error updating multiplier:', error);
      alert('Failed to update multiplier');
    }
  };

  const getTrendIcon = (change) => {
    if (change > 0) return <TrendingUp className="w-5 h-5 text-green-400" />;
    if (change < 0) return <TrendingDown className="w-5 h-5 text-red-400" />;
    return <TrendingUp className="w-5 h-5 text-gray-400" />;
  };

  const getDemandColor = (demand) => {
    if (demand >= 80) return 'text-red-400';
    if (demand >= 50) return 'text-yellow-400';
    return 'text-green-400';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-black flex items-center justify-center">
        <div className="text-cyan-400 text-xl">Loading Dynamic Pricing...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-black py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-black bg-gradient-to-r from-yellow-400 via-orange-400 to-red-500 bg-clip-text text-transparent mb-2">
            Dynamic Pricing Control
          </h1>
          <p className="text-gray-300">Manage real-time pricing based on demand</p>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {pricingData.map((item, idx) => {
            const service = SERVICES[idx];
            const priceChange = ((item.current_price - service.basePrice) / service.basePrice) * 100;

            return (
              <Card key={service.id} className="bg-gray-800/50 border-gray-600 p-6">
                {/* Service Header */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-white mb-1">{service.name}</h3>
                    <p className="text-gray-400 text-sm">Base Price: ${service.basePrice}</p>
                  </div>
                  {getTrendIcon(priceChange)}
                </div>

                {/* Current Price */}
                <div className="mb-6">
                  <p className="text-gray-400 text-sm mb-1">Current Price</p>
                  <div className="flex items-baseline gap-2">
                    <p className="text-4xl font-black text-white">${item.current_price}</p>
                    <span className={`text-lg font-semibold ${
                      priceChange > 0 ? 'text-green-400' : priceChange < 0 ? 'text-red-400' : 'text-gray-400'
                    }`}>
                      {priceChange > 0 ? '+' : ''}{priceChange.toFixed(1)}%
                    </span>
                  </div>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Users className="w-4 h-4 text-cyan-400" />
                      <span className="text-gray-400 text-sm">Demand</span>
                    </div>
                    <p className={`text-xl font-bold ${getDemandColor(item.demand_level)}`}>
                      {item.demand_level}%
                    </p>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Zap className="w-4 h-4 text-yellow-400" />
                      <span className="text-gray-400 text-sm">Multiplier</span>
                    </div>
                    <p className="text-xl font-bold text-white">{item.multiplier}x</p>
                  </div>
                </div>

                {/* Controls */}
                {editingService === service.id ? (
                  <div className="space-y-3">
                    <Input
                      type="number"
                      step="0.1"
                      min="0.5"
                      max="5.0"
                      defaultValue={item.multiplier}
                      placeholder="New multiplier"
                      className="bg-gray-700 border-gray-600 text-white"
                      id={`multiplier-${service.id}`}
                    />
                    <div className="flex gap-2">
                      <Button
                        onClick={() => {
                          const input = document.getElementById(`multiplier-${service.id}`) as HTMLInputElement | null;
                          if (input) updateMultiplier(service.id, input.value);
                        }}
                        className="flex-1 bg-green-500 hover:bg-green-600"
                      >
                        Save
                      </Button>
                      <Button
                        onClick={() => setEditingService(null)}
                        variant="outline"
                        className="flex-1"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    onClick={() => setEditingService(service.id)}
                    className="w-full bg-cyan-500 hover:bg-cyan-600"
                  >
                    Adjust Multiplier
                  </Button>
                )}

                {/* Reason */}
                {item.reason && (
                  <div className="mt-4 flex items-start gap-2 text-xs text-gray-400">
                    <Clock className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>{item.reason}</span>
                  </div>
                )}
              </Card>
            );
          })}
        </div>

        {/* Info Section */}
        <Card className="bg-gray-800/50 border-gray-600 p-6">
          <h2 className="text-xl font-bold text-white mb-4">How Dynamic Pricing Works</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div>
              <div className="bg-cyan-500/20 w-10 h-10 rounded-lg flex items-center justify-center mb-3">
                <Users className="w-5 h-5 text-cyan-400" />
              </div>
              <h3 className="text-white font-semibold mb-2">Demand-Based</h3>
              <p className="text-gray-400 text-sm">
                Prices automatically adjust based on real-time demand and activity levels
              </p>
            </div>
            <div>
              <div className="bg-yellow-500/20 w-10 h-10 rounded-lg flex items-center justify-center mb-3">
                <Clock className="w-5 h-5 text-yellow-400" />
              </div>
              <h3 className="text-white font-semibold mb-2">Time-Based</h3>
              <p className="text-gray-400 text-sm">
                Peak hours (evenings/weekends) may have higher pricing multipliers
              </p>
            </div>
            <div>
              <div className="bg-purple-500/20 w-10 h-10 rounded-lg flex items-center justify-center mb-3">
                <Zap className="w-5 h-5 text-purple-400" />
              </div>
              <h3 className="text-white font-semibold mb-2">Manual Override</h3>
              <p className="text-gray-400 text-sm">
                Admins can manually adjust multipliers for special events or promotions
              </p>
            </div>
          </div>

          {/* Multiplier Guide */}
          <div className="mt-6 bg-gray-700/50 rounded-lg p-4">
            <h3 className="text-white font-semibold mb-3">Multiplier Guide</h3>
            <div className="grid md:grid-cols-4 gap-3 text-sm">
              <div>
                <p className="text-gray-400">0.5x - 0.9x</p>
                <p className="text-green-400 font-semibold">Off-Peak Discount</p>
              </div>
              <div>
                <p className="text-gray-400">1.0x</p>
                <p className="text-gray-300 font-semibold">Standard Price</p>
              </div>
              <div>
                <p className="text-gray-400">1.1x - 1.5x</p>
                <p className="text-yellow-400 font-semibold">High Demand</p>
              </div>
              <div>
                <p className="text-gray-400">1.6x+</p>
                <p className="text-red-400 font-semibold">Premium/Peak</p>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
