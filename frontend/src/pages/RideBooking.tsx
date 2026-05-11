import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Car, MapPin, Navigation, DollarSign, Clock, Shield } from 'lucide-react';
import NearbyDriversMap from '@/components/vibe-ridez/NearbyDriversMap';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function RideBooking() {
  const navigate = useNavigate();
  const [pickupAddress, setPickupAddress] = useState('');
  const [dropoffAddress, setDropoffAddress] = useState('');
  const [pickupLat, setPickupLat] = useState(null);
  const [pickupLng, setPickupLng] = useState(null);
  const [dropoffLat, setDropoffLat] = useState(null);
  const [dropoffLng, setDropoffLng] = useState(null);
  const [estimatedCost, setEstimatedCost] = useState(null);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(false);
  const [activeRides, setActiveRides] = useState([]);

  useEffect(() => {
    fetchBalance();
    fetchActiveRides();
    getCurrentLocation();
  }, []);

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setPickupLat(position.coords.latitude);
          setPickupLng(position.coords.longitude);
          setPickupAddress('Current Location');
        },
        (error) => {
          // Error getting location
        }
      );
    }
  };

  const fetchBalance = async () => {
    try {
      const response = await fetch(`${API_URL}/api/wallet/balance`, { });
      if (response.ok) {
        const data = await response.json();
        setBalance(data.credit_balance);
      }
    } catch (error) {
      // console.error('Error fetching balance:', error);
    }
  };

  const fetchActiveRides = async () => {
    try {
      const response = await fetch(`${API_URL}/api/rides/my-rides?limit=5`, { });
      if (response.ok) {
        const data = await response.json();
        setActiveRides(data.rides.filter(r => ['requested', 'accepted', 'arriving', 'in_progress'].includes(r.status)));
      }
    } catch (error) {
      // console.error('Error fetching rides:', error);
    }
  };

  const requestRide = async () => {
    if (!pickupLat || !dropoffLat) {
      alert('Please enter both pickup and dropoff locations');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/rides/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        
        body: JSON.stringify({
          pickup_location: {
            address: pickupAddress,
            latitude: pickupLat,
            longitude: pickupLng
          },
          dropoff_location: {
            address: dropoffAddress,
            latitude: dropoffLat,
            longitude: dropoffLng
          },
          use_trusted_contact: true
        })
      });

      if (response.ok) {
        const data = await response.json();
        alert('Ride requested successfully! A driver will accept soon.');
        navigate(`/ride/${data.ride.ride_id}`);
      } else {
        const error = await response.json();
        alert(error.detail || 'Failed to request ride');
      }
    } catch (error) {
      // console.error('Error requesting ride:', error);
      alert('Failed to request ride');
    } finally {
      setLoading(false);
    }
  };

  // Simple geocoding placeholder - in production use Google Maps API
  const geocodeAddress = async (address, isPickup) => {
    // For demo: use random coordinates near a city center
    const lat = 37.7749 + (Math.random() - 0.5) * 0.1;
    const lng = -122.4194 + (Math.random() - 0.5) * 0.1;
    
    if (isPickup) {
      setPickupLat(lat);
      setPickupLng(lng);
    } else {
      setDropoffLat(lat);
      setDropoffLng(lng);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 pb-20">
      {/* Header */}
      <div className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <button onClick={() => navigate('/dashboard')} className="text-gray-600 hover:text-gray-900">
              ← Back
            </button>
            <div className="flex items-center space-x-2">
              <Car className="w-6 h-6 text-blue-600" />
              <h1 className="text-xl font-bold text-gray-900">Book a Ride</h1>
            </div>
            <div className="text-sm font-medium">
              <span className="text-gray-600">Balance:</span>
              <span className="text-blue-600 ml-1 font-bold">{balance.toFixed(1)} credits</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Active Rides */}
        {activeRides.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-4">Active Rides</h2>
            {activeRides.map(ride => (
              <Card key={ride.ride_id} className="p-4 mb-4 cursor-pointer hover:shadow-lg"
                onClick={() => navigate(`/ride/${ride.ride_id}`)}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{ride.status.toUpperCase()}</p>
                    <p className="text-sm text-gray-600">{ride.pickup_location.address} → {ride.dropoff_location.address}</p>
                  </div>
                  <Button size="sm">View</Button>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Booking Form */}
        <Card className="p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Where to?</h2>
          
          <div className="space-y-6">
            {/* Pickup */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <MapPin className="w-4 h-4 inline mr-1" />
                Pickup Location
              </label>
              <input
                type="text"
                value={pickupAddress}
                onChange={(e) => setPickupAddress(e.target.value)}
                onBlur={() => geocodeAddress(pickupAddress, true)}
                placeholder="Enter pickup address"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 outline-none"
              />
            </div>

            {/* Dropoff */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Navigation className="w-4 h-4 inline mr-1" />
                Dropoff Location
              </label>
              <input
                type="text"
                value={dropoffAddress}
                onChange={(e) => setDropoffAddress(e.target.value)}
                onBlur={() => geocodeAddress(dropoffAddress, false)}
                placeholder="Enter destination address"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 outline-none"
              />
            </div>

            {/* Geo-proximity preview map — shows nearby AVAILABLE drivers
                around the rider's pickup before they commit to a request. */}
            <div data-testid="ride-booking-nearby-map-wrapper">
              <p className="text-xs uppercase tracking-widest text-gray-500 font-bold mb-2">
                Drivers near you
              </p>
              <NearbyDriversMap
                lat={pickupLat}
                lng={pickupLng}
                radiusKm={8}
                pickupLabel={pickupAddress}
              />
            </div>

            {/* Info */}
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                <Shield className="w-5 h-5 text-blue-600" />
                <p className="font-semibold text-blue-900">Safety First</p>
              </div>
              <p className="text-sm text-blue-700">
                Your trusted contact will be notified when you request a ride.
              </p>
            </div>

            {/* Pricing Info */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm text-gray-700 mb-2">
                <DollarSign className="w-4 h-4 inline" /> Pricing: Base $1.50 + $1.20/mile + $0.25/min
              </p>
              <p className="text-sm text-gray-700">
                <Clock className="w-4 h-4 inline" /> Average rides: 3 miles = 9 credits | 10 miles = 16 credits
              </p>
            </div>

            <Button
              onClick={requestRide}
              disabled={loading || !dropoffAddress}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-6 text-lg font-semibold"
            >
              {loading ? 'Requesting...' : 'Request Ride'}
            </Button>
          </div>
        </Card>

        {/* Info Cards */}
        <div className="grid md:grid-cols-3 gap-4 mt-8">
          <Card className="p-6 text-center">
            <DollarSign className="w-12 h-12 mx-auto text-green-600 mb-2" />
            <h3 className="font-bold">15% Cheaper</h3>
            <p className="text-sm text-gray-600">Than legacy rideshare</p>
          </Card>
          <Card className="p-6 text-center">
            <Shield className="w-12 h-12 mx-auto text-blue-600 mb-2" />
            <h3 className="font-bold">Safe & Verified</h3>
            <p className="text-sm text-gray-600">Trusted contact notified</p>
          </Card>
          <Card className="p-6 text-center">
            <Car className="w-12 h-12 mx-auto text-purple-600 mb-2" />
            <h3 className="font-bold">Date-Friendly</h3>
            <p className="text-sm text-gray-600">Perfect for dates</p>
          </Card>
        </div>
      </div>
    </div>
  );
}
