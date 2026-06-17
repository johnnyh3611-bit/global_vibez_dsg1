import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { MapPin, Navigation, DollarSign, Star, Calendar, Clock } from 'lucide-react';
import RateDriverModal from '@/components/RateDriverModal';

const API = process.env.REACT_APP_BACKEND_URL;

export default function RideHistory() {
  const [rides, setRides] = useState([]);
  const [filter, setFilter] = useState('all'); // all, completed, cancelled
  const [loading, setLoading] = useState(true);
  const [selectedRideForRating, setSelectedRideForRating] = useState(null);

  useEffect(() => {
    fetchRideHistory();
  }, [filter]);

  const fetchRideHistory = async () => {
    try {
      const response = await fetch(`${API}/api/rides/my-rides?limit=50`);
      if (response.ok) {
        const data = await response.json();
        let filteredRides = data.rides || [];
        
        if (filter !== 'all') {
          filteredRides = filteredRides.filter(r => r.status === filter);
        }
        
        setRides(filteredRides);
      }
    } catch (error) {
      // console.error('Error fetching ride history:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (isoString) => {
    return new Date(isoString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-950 via-black to-blue-950 p-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-white mb-6">🚗 Ride History</h1>
        
        {/* Filters */}
        <div className="mb-6 flex gap-3">
          {['all', 'completed', 'cancelled'].map((f) => (
            <motion.button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-6 py-2 rounded-xl font-semibold transition-all ${
                filter === f
                  ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white'
                  : 'bg-black/40 text-gray-400 border border-cyan-500/50 hover:border-cyan-400'
              }`}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </motion.button>
          ))}
        </div>

        {/* Rides List */}
        {loading ? (
          <div className="text-center py-20">
            <div className="text-white text-xl">Loading rides...</div>
          </div>
        ) : rides.length === 0 ? (
          <div className="bg-black/40 backdrop-blur-xl border border-cyan-500/50 rounded-2xl p-12 text-center">
            <p className="text-gray-400 text-lg">No rides found</p>
          </div>
        ) : (
          <div className="space-y-4">
            {rides.map((ride) => (
              <motion.div
                key={ride.ride_id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-black/40 backdrop-blur-xl border border-cyan-500/50 rounded-2xl p-6 hover:border-cyan-400 transition-all"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-400 text-sm">
                        {formatDate(ride.requested_at)}
                      </span>
                      
                      <span className={`ml-4 px-3 py-1 rounded-full text-xs font-bold ${
                        ride.status === 'completed' ? 'bg-green-600/20 text-green-300' :
                        ride.status === 'cancelled' ? 'bg-red-600/20 text-red-300' :
                        'bg-blue-600/20 text-blue-300'
                      }`}>
                        {ride.status.toUpperCase()}
                      </span>
                    </div>
                    
                    <div className="space-y-2 mb-3">
                      <div className="flex items-start gap-2">
                        <MapPin className="w-5 h-5 text-green-400 mt-1" />
                        <div>
                          <p className="text-gray-400 text-xs">Pickup</p>
                          <p className="text-white font-semibold">{ride.pickup_location.address}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-start gap-2">
                        <Navigation className="w-5 h-5 text-red-400 mt-1" />
                        <div>
                          <p className="text-gray-400 text-xs">Dropoff</p>
                          <p className="text-white font-semibold">{ride.dropoff_location.address}</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-gray-400">
                        <Clock className="w-4 h-4 inline mr-1" />
                        {ride.estimated_duration_minutes} min
                      </span>
                      <span className="text-gray-400">{ride.distance_miles} miles</span>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <p className="text-2xl font-bold text-white mb-2">
                      ${ride.credit_cost.toFixed(2)}
                    </p>
                    
                    {ride.rider_rating && (
                      <div className="flex items-center gap-1 text-yellow-400">
                        <Star className="w-4 h-4 fill-yellow-400" />
                        <span className="font-bold">{ride.rider_rating}</span>
                      </div>
                    )}
                  </div>
                </div>
                
                {ride.tip_amount > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-700">
                    <p className="text-green-400 text-sm">
                      💵 Tip: ${ride.tip_amount.toFixed(2)}
                    </p>
                  </div>
                )}
                
                {/* Rate Driver Button for Completed Rides */}
                {ride.status === 'completed' && !ride.has_rating && (
                  <div className="mt-4">
                    <motion.button
                      onClick={() => setSelectedRideForRating(ride)}
                      className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-bold py-3 rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Star className="w-5 h-5" />
                      Rate Driver
                    </motion.button>
                  </div>
                )}
                
                {ride.status === 'completed' && ride.has_rating && (
                  <div className="mt-4 text-center">
                    <p className="text-green-400 text-sm">✓ You rated this ride</p>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>
      
      {/* Rate Driver Modal */}
      {selectedRideForRating && (
        <RateDriverModal
          ride={selectedRideForRating}
          onClose={() => setSelectedRideForRating(null)}
          onSuccess={() => {
            setSelectedRideForRating(null);
            // Refresh ride history to show rating was submitted
            fetchRideHistory();
          }}
        />
      )}
    </div>
  );
}
