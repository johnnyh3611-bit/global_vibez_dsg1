
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, MapPin, Calendar, DollarSign, Users, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import LocationPicker from '@/components/vibe-ridez/LocationPicker';
import MapComponent from '@/components/vibe-ridez/MapComponent';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function PostRide() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [pickupLocation, setPickupLocation] = useState(null);
  const [dropoffLocation, setDropoffLocation] = useState(null);
  const [rideData, setRideData] = useState({
    departure_time: '',
    available_seats: 2,
    price_per_seat: 15,
    notes: ''
  });

  const handleSubmit = async () => {
    if (!pickupLocation || !dropoffLocation) {
      alert('Please select both pickup and dropoff locations');
      return;
    }

    setLoading(true);
    try {
      // First, get driver info
      const userId = localStorage.getItem('user_id') || 'demo_user';
      const driverResponse = await fetch(`${API_URL}/api/vibe-ridez/driver/${userId}`, {
      });
      const driverData = await driverResponse.json();
      
      if (!driverData.success) {
        alert('You must register as a driver first');
        navigate('/vibe-ridez/driver-registration');
        return;
      }

      // Create ride
      const response = await fetch(`${API_URL}/api/vibe-ridez/ride/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        
        body: JSON.stringify({
          driver_id: driverData.driver.driver_id,
          pickup_location: {
            address: pickupLocation.address,
            latitude: pickupLocation.lat,
            longitude: pickupLocation.lng,
            city: pickupLocation.city || '',
            state: pickupLocation.state || ''
          },
          dropoff_location: {
            address: dropoffLocation.address,
            latitude: dropoffLocation.lat,
            longitude: dropoffLocation.lng,
            city: dropoffLocation.city || '',
            state: dropoffLocation.state || ''
          },
          departure_time: new Date(rideData.departure_time).toISOString(),
          available_seats: rideData.available_seats,
          price_per_seat: rideData.price_per_seat,
          notes: rideData.notes
        })
      });

      const data = await response.json();
      
      if (data.success) {
        alert('Ride posted successfully!');
        navigate('/vibe-ridez/driver-dashboard');
      } else {
        alert(data.detail || 'Failed to post ride');
      }
    } catch (error) {
      // console.error('Post ride error:', error);
      alert('Failed to post ride');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
      <div className="container mx-auto py-8">
        <Button
          variant="ghost"
          onClick={() => navigate('/vibe-ridez/driver-dashboard')}
          className="text-white hover:bg-white/10 mb-6"
        >
          <ArrowLeft className="mr-2 h-5 w-5" />
          Back to Dashboard
        </Button>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-bold text-white mb-2">
            Post a <span className="bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent">Ride</span>
          </h1>
          <p className="text-gray-300">Share your journey and help riders reach their destination</p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Form */}
          <div>
            <Card className="bg-slate-800/50 border-slate-700 p-6">
              <h2 className="text-2xl font-bold text-white mb-6">Ride Details</h2>

              <div className="space-y-6">
                <LocationPicker
                  label="Pickup Location"
                  onLocationSelected={setPickupLocation}
                  selectedLocation={pickupLocation}
                  placeholder="Where will you pick up passengers?"
                />

                <LocationPicker
                  label="Dropoff Location"
                  onLocationSelected={setDropoffLocation}
                  selectedLocation={dropoffLocation}
                  placeholder="Where are you heading?"
                />

                <div>
                  <label className="text-sm font-semibold text-white mb-2 block flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-cyan-400" />
                    Departure Time
                  </label>
                  <Input
                    type="datetime-local"
                    value={rideData.departure_time}
                    onChange={(e) => setRideData({...rideData, departure_time: e.target.value})}
                    className="bg-slate-800/50 border-slate-700 text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-semibold text-white mb-2 block flex items-center gap-2">
                      <Users className="w-4 h-4 text-purple-400" />
                      Available Seats
                    </label>
                    <Input
                      type="number"
                      min="1"
                      max="8"
                      value={rideData.available_seats}
                      onChange={(e) => setRideData({...rideData, available_seats: parseInt(e.target.value)})}
                      className="bg-slate-800/50 border-slate-700 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-white mb-2 block flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-green-400" />
                      Price per Seat
                    </label>
                    <Input
                      type="number"
                      min="1"
                      step="0.5"
                      value={rideData.price_per_seat}
                      onChange={(e) => setRideData({...rideData, price_per_seat: parseFloat(e.target.value)})}
                      className="bg-slate-800/50 border-slate-700 text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-semibold text-white mb-2 block flex items-center gap-2">
                    <FileText className="w-4 h-4 text-cyan-400" />
                    Additional Notes (Optional)
                  </label>
                  <textarea
                    value={rideData.notes}
                    onChange={(e) => setRideData({...rideData, notes: e.target.value})}
                    placeholder="Any preferences or requirements for passengers?"
                    rows={3}
                    className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-md text-white placeholder:text-gray-400"
                  />
                </div>

                <div className="pt-4 border-t border-slate-700">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-white font-semibold">Estimated Earnings:</span>
                    <span className="text-2xl font-bold text-green-400">
                      ${(rideData.price_per_seat * rideData.available_seats).toFixed(2)}
                    </span>
                  </div>

                  <Button
                    onClick={handleSubmit}
                    disabled={loading || !pickupLocation || !dropoffLocation || !rideData.departure_time}
                    className="w-full bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700"
                  >
                    {loading ? 'Posting Ride...' : 'Post Ride'}
                  </Button>
                </div>
              </div>
            </Card>
          </div>

          {/* Map Preview */}
          <div>
            <Card className="bg-slate-800/50 border-slate-700 p-6">
              <h2 className="text-2xl font-bold text-white mb-4">Route Preview</h2>
              <p className="text-gray-400 text-sm mb-4">Click on the map to select pickup and dropoff locations</p>
              
              <MapComponent
                pickupLocation={pickupLocation}
                dropoffLocation={dropoffLocation}
                height="500px"
                zoom={pickupLocation ? 10 : 4}
                center={pickupLocation ? [pickupLocation.lng, pickupLocation.lat] : undefined}
              />

              {pickupLocation && dropoffLocation && (
                <div className="mt-4 p-4 bg-cyan-900/20 border border-cyan-700/50 rounded-lg">
                  <div className="flex items-center gap-2 text-cyan-300 mb-2">
                    <MapPin className="w-4 h-4" />
                    <span className="font-semibold">Route Summary</span>
                  </div>
                  <div className="text-sm text-gray-300 space-y-1">
                    <div>🟢 From: {pickupLocation.city || pickupLocation.address}</div>
                    <div>🔴 To: {dropoffLocation.city || dropoffLocation.address}</div>
                  </div>
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}