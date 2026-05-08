import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, Car, Users, MapPin, Calendar, DollarSign, Star, ArrowLeft, Edit, Trash2, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function DriverDashboard() {
  const navigate = useNavigate();
  const [driverData, setDriverData] = useState(null);
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true);

  const userId = localStorage.getItem('user_id') || 'demo_user';

  useEffect(() => {
    loadDriverData();
  }, []);

  const loadDriverData = async () => {
    setLoading(true);
    try {
      // Get driver profile
      const driverResponse = await fetch(`${API_URL}/api/vibe-ridez/driver/${userId}`, {
      });
      const driverData = await driverResponse.json();

      // User isn't a registered driver yet — don't redirect away
      // silently; the empty-state render below exposes the Payout
      // Wallet and Register-Driver CTAs so nothing is hidden.
      if (!driverData.success) {
        setDriverData(null);
        return;
      }

      setDriverData(driverData.driver);

      // Get driver's rides
      const ridesResponse = await fetch(`${API_URL}/api/vibe-ridez/rides/driver/${driverData.driver.driver_id}`, {
      });
      const ridesData = await ridesResponse.json();
      
      if (ridesData.success) {
        setRides(ridesData.rides || []);
      }
    } catch (error) {
      // console.error('Error loading driver data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-16 w-16 border-4 border-cyan-400 border-t-transparent mb-4"></div>
          <p className="text-white text-lg">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!driverData) {
    // Empty-state: user is signed in but hasn't registered as a
    // driver yet. Expose the Payout Wallet and Earnings shortcuts so
    // they can set those up ahead of registration, and a prominent
    // "Register as Driver" CTA.
    return (
      <div
        className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900"
        data-testid="driver-dashboard-empty-state"
      >
        <div className="container mx-auto px-4 py-8">
          <Button
            variant="ghost"
            onClick={() => navigate('/vibe-ridez')}
            className="text-white hover:bg-white/10 mb-6"
          >
            <ArrowLeft className="mr-2 h-5 w-5" />
            Back
          </Button>

          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">
                Driver <span className="bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent">Dashboard</span>
              </h1>
              <p className="text-gray-300">You're not a registered driver yet — setup in under 60s.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => navigate('/driver/wallet')}
                variant="outline"
                className="border-amber-500/50 text-amber-200 hover:bg-amber-500/10"
                data-testid="dashboard-wallet-link"
              >
                <Wallet className="mr-2 h-4 w-4" />
                Payout Wallet
              </Button>
              <Button
                onClick={() => navigate('/driver/earnings')}
                variant="outline"
                className="border-cyan-500/50 text-cyan-200 hover:bg-cyan-500/10"
                data-testid="dashboard-earnings-link"
              >
                <DollarSign className="mr-2 h-4 w-4" />
                Earnings
              </Button>
              <Button
                onClick={() => navigate('/vibe-ridez/driver-registration')}
                className="bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700"
                data-testid="dashboard-register-cta"
              >
                <Plus className="mr-2 h-5 w-5" />
                Register as Driver
              </Button>
            </div>
          </div>

          <Card className="bg-white/5 border-white/10 p-6">
            <p className="text-gray-300 text-sm">
              Set up your <span className="text-amber-300">payout wallet</span> first so every ride you complete queues USDC automatically. Register as a driver when you're ready to start earning.
            </p>
          </Card>
        </div>
      </div>
    );
  }

  const stats = [
    { label: 'Total Rides', value: driverData.total_rides, icon: Car, color: 'from-cyan-500 to-blue-500' },
    { label: 'Rating', value: driverData.rating.toFixed(1), icon: Star, color: 'from-yellow-500 to-orange-500' },
    { label: 'Active Rides', value: rides.filter(r => r.status === 'scheduled').length, icon: MapPin, color: 'from-green-500 to-emerald-500' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="container mx-auto px-4 py-8">
        <Button
          variant="ghost"
          onClick={() => navigate('/vibe-ridez')}
          className="text-white hover:bg-white/10 mb-6"
        >
          <ArrowLeft className="mr-2 h-5 w-5" />
          Back
        </Button>

        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">
              Driver <span className="bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent">Dashboard</span>
            </h1>
            <p className="text-gray-300">Welcome back, {driverData.username}!</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => navigate('/driver/wallet')}
              variant="outline"
              className="border-amber-500/50 text-amber-200 hover:bg-amber-500/10"
              data-testid="dashboard-wallet-link"
            >
              <Wallet className="mr-2 h-4 w-4" />
              Payout Wallet
            </Button>
            <Button
              onClick={() => navigate('/driver/earnings')}
              variant="outline"
              className="border-cyan-500/50 text-cyan-200 hover:bg-cyan-500/10"
              data-testid="dashboard-earnings-link"
            >
              <DollarSign className="mr-2 h-4 w-4" />
              Earnings
            </Button>
            <Button
              onClick={() => navigate('/vibe-ridez/post-ride')}
              className="bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700"
            >
              <Plus className="mr-2 h-5 w-5" />
              Post New Ride
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {stats.map((stat, index) => (
            <motion.div
              key={`stats-${index}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="bg-slate-800/50 border-slate-700 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-sm mb-1">{stat.label}</p>
                    <p className="text-3xl font-bold text-white">{stat.value}</p>
                  </div>
                  <div className={`w-14 h-14 rounded-full bg-gradient-to-br ${stat.color} flex items-center justify-center`}>
                    <stat.icon className="w-7 h-7 text-white" />
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Driver Profile */}
        <Card className="bg-slate-800/50 border-slate-700 p-6 mb-8">
          <div className="flex flex-col md:flex-row gap-6">
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-white mb-4">Your Profile</h2>
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-gray-300">
                  <Car className="w-5 h-5 text-cyan-400" />
                  <span className="font-semibold">Vehicle:</span>
                  <span>{driverData.vehicle.year} {driverData.vehicle.make} {driverData.vehicle.model}</span>
                </div>
                <div className="flex items-center gap-3 text-gray-300">
                  <Users className="w-5 h-5 text-purple-400" />
                  <span className="font-semibold">Seats:</span>
                  <span>{driverData.vehicle.seats}</span>
                </div>
                <div className="flex items-center gap-3 text-gray-300">
                  <span className="font-semibold">License Plate:</span>
                  <span className="font-mono bg-slate-700 px-2 py-1 rounded">{driverData.vehicle.plate_number}</span>
                </div>
                {driverData.bio && (
                  <div className="pt-3 border-t border-slate-700">
                    <p className="text-gray-300 italic">"{driverData.bio}"</p>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-start">
              <div className={`px-4 py-2 rounded-lg ${driverData.license_verified ? 'bg-green-900/30 border border-green-700/50 text-green-400' : 'bg-yellow-900/30 border border-yellow-700/50 text-yellow-400'}`}>
                {driverData.license_verified ? '✓ Verified Driver' : '⏳ Verification Pending'}
              </div>
            </div>
          </div>
        </Card>

        {/* Posted Rides */}
        <div>
          <h2 className="text-2xl font-bold text-white mb-6">Your Posted Rides</h2>
          
          {rides.length === 0 ? (
            <Card className="bg-slate-800/50 border-slate-700 p-12 text-center">
              <Car className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">No Rides Posted</h3>
              <p className="text-gray-400 mb-6">Start earning by posting your first ride!</p>
              <Button
                onClick={() => navigate('/vibe-ridez/post-ride')}
                className="bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700"
              >
                <Plus className="mr-2 h-5 w-5" />
                Post Your First Ride
              </Button>
            </Card>
          ) : (
            <div className="space-y-4">
              {rides.map((ride) => (
                <motion.div
                  key={ride.ride_id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <Card className="bg-slate-800/50 border-slate-700 p-6 hover:bg-slate-800/70 transition-colors">
                    <div className="flex flex-col md:flex-row justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-3">
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            ride.status === 'scheduled' ? 'bg-green-900/30 text-green-400 border border-green-700/50' :
                            ride.status === 'active' ? 'bg-blue-900/30 text-blue-400 border border-blue-700/50' :
                            ride.status === 'completed' ? 'bg-gray-900/30 text-gray-400 border border-gray-700/50' :
                            'bg-red-900/30 text-red-400 border border-red-700/50'
                          }`}>
                            {ride.status.toUpperCase()}
                          </span>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-gray-300">
                            <MapPin className="w-4 h-4 text-green-400" />
                            <span className="font-semibold">From:</span>
                            <span>{ride.pickup_location.city}, {ride.pickup_location.state}</span>
                          </div>
                          <div className="flex items-center gap-2 text-gray-300">
                            <MapPin className="w-4 h-4 text-red-400" />
                            <span className="font-semibold">To:</span>
                            <span>{ride.dropoff_location.city}, {ride.dropoff_location.state}</span>
                          </div>
                          <div className="flex items-center gap-2 text-gray-300">
                            <Calendar className="w-4 h-4 text-cyan-400" />
                            <span>{formatDate(ride.departure_time)}</span>
                          </div>
                          <div className="flex items-center gap-2 text-gray-300">
                            <Users className="w-4 h-4 text-purple-400" />
                            <span>{ride.available_seats} / {ride.max_passengers} seats available</span>
                          </div>
                          {ride.passenger_usernames.length > 0 && (
                            <div className="pt-2 border-t border-slate-700">
                              <p className="text-sm text-gray-400">Passengers:</p>
                              <div className="flex flex-wrap gap-2 mt-1">
                                {ride.passenger_usernames.map((name, i) => (
                                  <span key={name.id || `passenger_usernames-${i}`} className="text-xs bg-cyan-900/30 text-cyan-300 px-2 py-1 rounded">
                                    {name}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col justify-between items-end">
                        <div className="text-right">
                          <div className="text-3xl font-bold text-white">
                            ${ride.price_per_seat}
                          </div>
                          <div className="text-sm text-gray-400">per seat</div>
                          {ride.passenger_usernames.length > 0 && (
                            <div className="text-sm text-green-400 mt-2">
                              Earning: ${ride.price_per_seat * ride.passenger_usernames.length}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
