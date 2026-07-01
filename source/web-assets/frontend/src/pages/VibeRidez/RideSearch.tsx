
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search, Calendar, Users, ArrowLeft, MapPin, DollarSign, Clock, Star, Car, Coins, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import SwipeToUnlock from '@/components/SwipeToUnlock';
import LocationPicker from '@/components/vibe-ridez/LocationPicker';
import MapComponent from '@/components/vibe-ridez/MapComponent';
import LiveRideTracking from '@/components/vibe-ridez/LiveRideTracking';
import TopUpVibezCoinsModal from '@/components/wallet/TopUpVibezCoinsModal';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function RideSearch() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useState({
    from_city: '',
    to_city: '',
    departure_date: '',
    min_seats: 1
  });
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedRide, setSelectedRide] = useState(null);
  const [showTracking, setShowTracking] = useState(false);
  const [trackingData, setTrackingData] = useState(null);
  const [bookingInProgress, setBookingInProgress] = useState(false);
  // Payment method picker — default to ₵ since the unified-market wallet
  // is the headline UX. Card path remains for users without enough coins.
  const [paymentMethod, setPaymentMethod] = useState<'coins' | 'card'>('coins');
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [topUpRecommended, setTopUpRecommended] = useState<string>('popular');
  const [topUpContext, setTopUpContext] = useState<string>('');

  const handleSearch = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (searchParams.from_city) queryParams.append('from_city', searchParams.from_city);
      if (searchParams.to_city) queryParams.append('to_city', searchParams.to_city);
      if (searchParams.departure_date) queryParams.append('departure_date', searchParams.departure_date);
      queryParams.append('min_seats', String(searchParams.min_seats));

      const response = await fetch(`${API_URL}/api/vibe-ridez/rides/search?${queryParams}`, {
      });
      const data = await response.json();
      
      if (data.success) {
        setRides(data.rides || []);
      }
    } catch (error) {
      // console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    handleSearch();
  }, []);

  const handleBookRide = async (ride) => {
    setBookingInProgress(true);
    setSelectedRide(ride);

    try {
      // ─── Pay with ₵ Vibez Coins ──────────────────────────────
      if (paymentMethod === 'coins') {
        const token = localStorage.getItem('auth_token');
        if (!token) {
          navigate('/login');
          return;
        }
        const res = await fetch(`${API_URL}/api/vibe-ridez/ride/book`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            ride_id: ride.ride_id,
            seats_requested: 1,
            payment_method: 'coins',
          }),
        });
        const data = await res.json();
        if (res.status === 402 || /insufficient/i.test(data.detail || '')) {
          // Pop top-up modal pre-targeting the smallest pack that
          // clears the rider's shortfall.
          const m = /need\s*₵?(\d+).*have\s*₵?(\d+)/i.exec(data.detail || '');
          const need = m ? parseInt(m[1], 10) : 0;
          const have = m ? parseInt(m[2], 10) : 0;
          const gap = Math.max(0, need - have);
          setTopUpRecommended(gap <= 10000 ? 'starter' : gap <= 20000 ? 'popular' : gap <= 50000 ? 'pro' : 'vip');
          setTopUpContext(`You need ₵${need.toLocaleString()} for this seat — your wallet has ₵${have.toLocaleString()}.`);
          setTopUpOpen(true);
          setBookingInProgress(false);
          return;
        }
        if (!res.ok) {
          alert(data.detail || 'Booking failed');
          setBookingInProgress(false);
          return;
        }
        alert(`🎉 Seat booked! ₵${data.coins_paid?.toLocaleString() || (ride.price_per_seat * 2000).toLocaleString()} debited from your wallet.`);
        // Refresh search so this ride's seat count drops
        handleSearch();
        setBookingInProgress(false);
        return;
      }

      // ─── Pay with Card (Stripe) — original flow ──────────────
      const response = await fetch(`${API_URL}/api/vibe-ridez/payment/create-checkout?ride_id=${ride.ride_id}&seats_requested=1`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();

      if (data.success && data.checkout_url) {
        // Redirect to Stripe checkout
        window.location.href = data.checkout_url;
      } else {
        alert(data.detail || 'Failed to create payment session');
        setBookingInProgress(false);
      }
    } catch (error) {
      // console.error('Payment error:', error);
      alert('Failed to initiate payment');
      setBookingInProgress(false);
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

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-bold text-white mb-2">
            Find Your <span className="bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent">Ride</span>
          </h1>
          <p className="text-gray-300">Search for rides going your way</p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Search Sidebar */}
          <div className="lg:col-span-1">
            <Card className="bg-slate-800/50 border-slate-700 p-6 sticky top-6">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Search className="w-5 h-5 text-cyan-400" />
                Search Filters
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-semibold text-white mb-2 block">From City</label>
                  <Input
                    type="text"
                    value={searchParams.from_city}
                    onChange={(e) => setSearchParams({...searchParams, from_city: e.target.value})}
                    placeholder="New York"
                    className="bg-slate-800/50 border-slate-700 text-white"
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold text-white mb-2 block">To City</label>
                  <Input
                    type="text"
                    value={searchParams.to_city}
                    onChange={(e) => setSearchParams({...searchParams, to_city: e.target.value})}
                    placeholder="Boston"
                    className="bg-slate-800/50 border-slate-700 text-white"
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold text-white mb-2 block">Departure Date</label>
                  <Input
                    type="date"
                    value={searchParams.departure_date}
                    onChange={(e) => setSearchParams({...searchParams, departure_date: e.target.value})}
                    className="bg-slate-800/50 border-slate-700 text-white"
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold text-white mb-2 block">Seats Needed</label>
                  <Input
                    type="number"
                    min="1"
                    max="8"
                    value={searchParams.min_seats}
                    onChange={(e) => setSearchParams({...searchParams, min_seats: parseInt(e.target.value)})}
                    className="bg-slate-800/50 border-slate-700 text-white"
                  />
                </div>

                <Button
                  onClick={handleSearch}
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700"
                >
                  {loading ? 'Searching...' : 'Search Rides'}
                </Button>
              </div>

              <div className="mt-6 p-4 bg-cyan-900/20 border border-cyan-700/50 rounded-lg">
                <p className="text-xs text-cyan-300 mb-2 font-semibold">💡 Pro Tip</p>
                <p className="text-xs text-gray-300">Book early to get the best prices and availability!</p>
              </div>
            </Card>
          </div>

          {/* Results */}
          <div className="lg:col-span-2">
            {loading ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-cyan-400 border-t-transparent"></div>
                <p className="text-white mt-4">Searching for rides...</p>
              </div>
            ) : rides.length === 0 ? (
              <div className="text-center py-12">
                <Car className="w-24 h-24 text-gray-600 mx-auto mb-4" />
                <h3 className="text-2xl font-bold text-white mb-2">No Rides Found</h3>
                <p className="text-gray-400">Try adjusting your search criteria</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="text-white mb-4">
                  Found <span className="font-bold text-cyan-400">{rides.length}</span> ride{rides.length !== 1 ? 's' : ''}
                </div>

                {rides.map((ride) => (
                  <motion.div
                    key={ride.ride_id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <Card className="bg-slate-800/50 border-slate-700 p-6 hover:bg-slate-800/70 transition-colors">
                      <div className="flex flex-col md:flex-row justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-start gap-4 mb-4">
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center text-2xl">
                              {ride.driver_username[0]}
                            </div>
                            <div>
                              <h3 className="text-lg font-bold text-white">{ride.driver_username}</h3>
                              <div className="flex items-center gap-1 text-yellow-400">
                                <Star className="w-4 h-4 fill-current" />
                                <span className="text-sm font-semibold">{ride.driver_rating.toFixed(1)}</span>
                              </div>
                              <p className="text-sm text-gray-400">{ride.vehicle_info}</p>
                            </div>
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
                              <span>{ride.available_seats} seat{ride.available_seats !== 1 ? 's' : ''} available</span>
                            </div>
                          </div>

                          {ride.notes && (
                            <p className="text-sm text-gray-400 mt-3 italic">"{ride.notes}"</p>
                          )}
                        </div>

                        <div className="flex flex-col justify-between items-end">
                          <div className="text-right mb-3">
                            <div className="text-3xl font-bold text-white">
                              ${ride.price_per_seat}
                            </div>
                            <div className="text-sm text-gray-400">per seat</div>
                            <div className="text-xs text-yellow-300/80 mt-1">
                              or ₵{(ride.price_per_seat * 2000).toLocaleString()}
                            </div>
                          </div>

                          {/* Payment-method toggle (per ride card so it
                              doesn't accidentally apply to the wrong row) */}
                          <div className="flex gap-1 mb-3 p-1 rounded-lg bg-slate-900/60 border border-slate-700/60">
                            <button
                              onClick={() => setPaymentMethod('coins')}
                              data-testid={`book-pay-coins-${ride.ride_id}`}
                              className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1 transition-all ${
                                paymentMethod === 'coins'
                                  ? 'bg-yellow-500 text-slate-950'
                                  : 'text-slate-300 hover:text-white'
                              }`}
                            >
                              <Coins className="w-3 h-3" />
                              ₵
                            </button>
                            <button
                              onClick={() => setPaymentMethod('card')}
                              data-testid={`book-pay-card-${ride.ride_id}`}
                              className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1 transition-all ${
                                paymentMethod === 'card'
                                  ? 'bg-purple-500 text-white'
                                  : 'text-slate-300 hover:text-white'
                              }`}
                            >
                              <CreditCard className="w-3 h-3" />
                              Card
                            </button>
                          </div>

                          <Button
                            onClick={() => handleBookRide(ride)}
                            disabled={ride.available_seats === 0 || bookingInProgress}
                            className="bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700 mb-3"
                            data-testid={`book-btn-${ride.ride_id}`}
                          >
                            {bookingInProgress && selectedRide?.ride_id === ride.ride_id ? 'Processing...' :
                             ride.available_seats === 0 ? 'Fully Booked' :
                             paymentMethod === 'coins' ? `Book — ₵${(ride.price_per_seat * 2000).toLocaleString()}` : 'Book Now'}
                          </Button>

                          {ride.available_seats > 0 && (
                            <SwipeToUnlock
                              label={paymentMethod === 'coins'
                                ? `Swipe to pay ₵${(ride.price_per_seat * 2000).toLocaleString()}`
                                : `Swipe to Confirm — $${ride.price_per_seat}`}
                              onUnlock={() => handleBookRide(ride)}
                              disabled={bookingInProgress}
                              testId={`swipe-confirm-${ride.ride_id}`}
                              width={260}
                            />
                          )}
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

      <TopUpVibezCoinsModal
        open={topUpOpen}
        onClose={() => setTopUpOpen(false)}
        recommendedPackId={topUpRecommended}
        contextMessage={topUpContext}
      />
    </div>
  );
}