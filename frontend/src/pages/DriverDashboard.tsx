import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Car, DollarSign, Star, MapPin, Navigation, Clock, TrendingUp, Award, Users } from 'lucide-react';
import DriverRatingsDisplay from '@/components/DriverRatingsDisplay';

const API = process.env.REACT_APP_BACKEND_URL;

export default function DriverDashboard() {
  const [driverProfile, setDriverProfile] = useState(null);
  const [availableRides, setAvailableRides] = useState([]);
  const [activeRide, setActiveRide] = useState(null);
  const [earnings, setEarnings] = useState({ today: 0, week: 0, total: 0 });
  const [isOnline, setIsOnline] = useState(false);
  const userId = localStorage.getItem('user_id');

  useEffect(() => {
    fetchDriverProfile();
    if (isOnline) {
      fetchAvailableRides();
      const interval = setInterval(fetchAvailableRides, 10000);
      return () => clearInterval(interval);
    }
  }, [isOnline]);

  const fetchDriverProfile = async () => {
    try {
      const response = await fetch(`${API}/api/drivers/${userId}`);
      if (response.ok) {
        const data = await response.json();
        setDriverProfile(data.driver);
        setIsOnline(data.driver?.available || false);
      }
    } catch (error) {
      // console.error('Error fetching driver profile:', error);
    }
  };

  const fetchAvailableRides = async () => {
    try {
      const response = await fetch(`${API}/api/rides/available`);
      if (response.ok) {
        const data = await response.json();
        setAvailableRides(data.rides || []);
      }
    } catch (error) {
      // console.error('Error fetching available rides:', error);
    }
  };

  const toggleOnline = async () => {
    try {
      const response = await fetch(`${API}/api/drivers/toggle-availability`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driver_id: driverProfile?.driver_id, available: !isOnline })
      });
      
      if (response.ok) {
        setIsOnline(!isOnline);
      }
    } catch (error) {
      // console.error('Error toggling online status:', error);
    }
  };

  const acceptRide = async (rideId) => {
    try {
      const response = await fetch(`${API}/api/rides/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ride_id: rideId })
      });
      
      if (response.ok) {
        const data = await response.json();
        setActiveRide(data.ride);
        fetchAvailableRides();
      }
    } catch (error) {
      // console.error('Error accepting ride:', error);
    }
  };

  const updateRideStatus = async (status) => {
    try {
      const response = await fetch(`${API}/api/rides/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ride_id: activeRide.ride_id, status })
      });
      
      if (response.ok) {
        if (status === 'completed') {
          setActiveRide(null);
          fetchDriverProfile();
        } else {
          const updatedRide = { ...activeRide, status };
          setActiveRide(updatedRide);
        }
      }
    } catch (error) {
      // console.error('Error updating ride status:', error);
    }
  };

  if (!driverProfile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-950 via-black to-blue-950 flex items-center justify-center">
        <div className="text-white text-center">
          <Car className="w-16 h-16 mx-auto mb-4 animate-pulse" />
          <p className="text-xl">Loading driver dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-950 via-black to-blue-950 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Driver Dashboard</h1>
            <p className="text-gray-400">Welcome back, {driverProfile.name}! 🚗</p>
          </div>
          
          {/* Online Toggle */}
          <motion.button
            onClick={toggleOnline}
            className={`px-6 py-3 rounded-xl font-bold text-white transition-all ${
              isOnline
                ? 'bg-green-600 hover:bg-green-700'
                : 'bg-gray-600 hover:bg-gray-700'
            }`}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            {isOnline ? '🟢 Online' : '⚫ Offline'}
          </motion.button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-black/40 backdrop-blur-xl border border-cyan-500/50 rounded-2xl p-6">
            <DollarSign className="w-8 h-8 text-green-400 mb-2" />
            <p className="text-gray-400 text-sm">Today's Earnings</p>
            <p className="text-2xl font-bold text-white">${earnings.today.toFixed(2)}</p>
          </div>
          
          <div className="bg-black/40 backdrop-blur-xl border border-cyan-500/50 rounded-2xl p-6">
            <TrendingUp className="w-8 h-8 text-blue-400 mb-2" />
            <p className="text-gray-400 text-sm">This Week</p>
            <p className="text-2xl font-bold text-white">${earnings.week.toFixed(2)}</p>
          </div>
          
          <div className="bg-black/40 backdrop-blur-xl border border-cyan-500/50 rounded-2xl p-6">
            <Star className="w-8 h-8 text-yellow-400 mb-2" />
            <p className="text-gray-400 text-sm">Rating</p>
            <p className="text-2xl font-bold text-white">{driverProfile.rating?.toFixed(1) || '5.0'} ⭐</p>
          </div>
          
          <div className="bg-black/40 backdrop-blur-xl border border-cyan-500/50 rounded-2xl p-6">
            <Users className="w-8 h-8 text-purple-400 mb-2" />
            <p className="text-gray-400 text-sm">Total Rides</p>
            <p className="text-2xl font-bold text-white">{driverProfile.total_rides || 0}</p>
          </div>
        </div>

        {/* Active Ride */}
        {activeRide && (
          <div className="mb-6 bg-gradient-to-r from-green-900/40 to-blue-900/40 backdrop-blur-xl border-2 border-green-500/50 rounded-2xl p-6">
            <h2 className="text-2xl font-bold text-white mb-4">🚗 Active Ride</h2>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <div className="mb-4">
                  <p className="text-gray-400 text-sm">Pickup</p>
                  <p className="text-white font-bold flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-green-400" />
                    {activeRide.pickup_location.address}
                  </p>
                </div>
                
                <div className="mb-4">
                  <p className="text-gray-400 text-sm">Dropoff</p>
                  <p className="text-white font-bold flex items-center gap-2">
                    <Navigation className="w-4 h-4 text-red-400" />
                    {activeRide.dropoff_location.address}
                  </p>
                </div>
                
                <div>
                  <p className="text-gray-400 text-sm">Passenger</p>
                  <p className="text-white font-bold">{activeRide.rider?.name || 'Rider'}</p>
                </div>
              </div>
              
              <div>
                <div className="mb-4">
                  <p className="text-gray-400 text-sm">Distance</p>
                  <p className="text-white font-bold">{activeRide.distance_miles} miles</p>
                </div>
                
                <div className="mb-4">
                  <p className="text-gray-400 text-sm">You'll Earn</p>
                  <p className="text-2xl font-bold text-green-400">${activeRide.driver_earning.toFixed(2)}</p>
                </div>
              </div>
            </div>
            
            {/* Status Actions */}
            <div className="mt-6 flex gap-3">
              {activeRide.status === 'accepted' && (
                <motion.button
                  onClick={() => updateRideStatus('arriving')}
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 rounded-xl font-bold text-white"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Arriving at Pickup
                </motion.button>
              )}
              
              {activeRide.status === 'arriving' && (
                <motion.button
                  onClick={() => updateRideStatus('in_progress')}
                  className="flex-1 py-3 bg-green-600 hover:bg-green-700 rounded-xl font-bold text-white"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Start Trip
                </motion.button>
              )}
              
              {activeRide.status === 'in_progress' && (
                <motion.button
                  onClick={() => updateRideStatus('completed')}
                  className="flex-1 py-3 bg-purple-600 hover:bg-purple-700 rounded-xl font-bold text-white"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Complete Ride
                </motion.button>
              )}
            </div>
          </div>
        )}

        {/* Available Rides */}
        {isOnline && !activeRide && (
          <div>
            <h2 className="text-2xl font-bold text-white mb-4">
              📍 Available Rides ({availableRides.length})
            </h2>
            
            {availableRides.length === 0 ? (
              <div className="bg-black/40 backdrop-blur-xl border border-cyan-500/50 rounded-2xl p-12 text-center">
                <Car className="w-16 h-16 mx-auto text-gray-600 mb-4" />
                <p className="text-gray-400 text-lg">No rides available right now</p>
                <p className="text-gray-500 text-sm">We'll notify you when a new ride request comes in!</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {availableRides.map((ride) => (
                  <motion.div
                    key={ride.ride_id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-black/40 backdrop-blur-xl border border-cyan-500/50 rounded-2xl p-6 hover:border-cyan-400 transition-all"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-4 mb-4">
                          <div>
                            <p className="text-gray-400 text-sm">Pickup</p>
                            <p className="text-white font-bold">{ride.pickup_location.address}</p>
                          </div>
                          <Navigation className="w-4 h-4 text-cyan-400" />
                          <div>
                            <p className="text-gray-400 text-sm">Dropoff</p>
                            <p className="text-white font-bold">{ride.dropoff_location.address}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-6 text-sm">
                          <span className="text-gray-400">
                            <Clock className="w-4 h-4 inline mr-1" />
                            {ride.estimated_duration_minutes} min
                          </span>
                          <span className="text-gray-400">
                            <MapPin className="w-4 h-4 inline mr-1" />
                            {ride.distance_miles} miles
                          </span>
                          <span className="text-green-400 font-bold">
                            <DollarSign className="w-4 h-4 inline mr-1" />
                            ${ride.driver_earning.toFixed(2)} earnings
                          </span>
                        </div>
                      </div>
                      
                      <motion.button
                        onClick={() => acceptRide(ride.ride_id)}
                        className="px-6 py-3 bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 rounded-xl font-bold text-white"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        Accept Ride
                      </motion.button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Driver Ratings & Reviews */}
        <div className="mt-6 bg-black/40 backdrop-blur-xl border border-yellow-500/50 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <Star className="w-6 h-6 text-yellow-400" />
            <h2 className="text-2xl font-bold text-white">Your Ratings & Reviews</h2>
          </div>
          
          <DriverRatingsDisplay driverId={userId} />
        </div>

        {/* Gamification - Driver Level */}
        <div className="mt-6 bg-gradient-to-r from-purple-900/40 to-pink-900/40 backdrop-blur-xl border border-purple-500/50 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-xl font-bold text-white">Driver Level</h3>
              <p className="text-gray-400">Complete rides to level up and earn bonuses!</p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-purple-300">Level {Math.floor((driverProfile.total_rides || 0) / 10) + 1}</p>
              <p className="text-sm text-gray-400">{(driverProfile.total_rides || 0) % 10}/10 rides</p>
            </div>
          </div>
          
          <div className="w-full bg-gray-700 rounded-full h-3">
            <div
              className="bg-gradient-to-r from-purple-500 to-pink-500 h-3 rounded-full transition-all"
              style={{ width: `${((driverProfile.total_rides || 0) % 10) * 10}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
