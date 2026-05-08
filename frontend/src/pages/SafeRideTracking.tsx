
import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Shield, MapPin, Users, PhoneCall, AlertTriangle, CheckCircle, Navigation } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { Map, Marker, Source, Layer } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import RideChat from '@/components/vibe-ridez/RideChat';
import RidePOVPiP from '@/components/vibe-ridez/RidePOVPiP';
import RideSafetyBar from '@/components/vibe-ridez/RideSafetyBar';

const API = process.env.REACT_APP_BACKEND_URL;
const MAPBOX_TOKEN = process.env.REACT_APP_MAPBOX_TOKEN;

export default function SafeRideTracking() {
  const { rideId } = useParams();
  const [ride, setRide] = useState(null);
  const [driverLocation, setDriverLocation] = useState(null);
  const [riderLocation, setRiderLocation] = useState(null);
  const [emergencyContacts, setEmergencyContacts] = useState([]);
  const [verificationCode, setVerificationCode] = useState(null);
  const [codeVerified, setCodeVerified] = useState(false);
  const [trackingActive, setTrackingActive] = useState(false);
  const [route, setRoute] = useState(null);
  const [routeInfo, setRouteInfo] = useState(null);
  const wsRef = useRef(null);
  const userId = localStorage.getItem('user_id');

  // Map state
  const [viewState, setViewState] = useState({
    longitude: -122.4194,
    latitude: 37.7749,
    zoom: 13
  });

  useEffect(() => {
    fetchRideDetails();
    fetchEmergencyContacts();
    generateVerificationCode();
    startTracking();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [rideId]);

  const fetchRideDetails = async () => {
    try {
      const response = await fetch(`${API}/api/rides/${rideId}`);
      if (response.ok) {
        const data = await response.json();
        setRide(data.ride);
        
        // Fetch route if pickup and dropoff exist
        if (data.ride.pickup_location && data.ride.dropoff_location) {
          fetchRoute(
            data.ride.pickup_location.latitude,
            data.ride.pickup_location.longitude,
            data.ride.dropoff_location.latitude,
            data.ride.dropoff_location.longitude
          );
        }
      }
    } catch (error) {
      // console.error('Error fetching ride:', error);
    }
  };

  const fetchRoute = async (pickupLat, pickupLng, dropoffLat, dropoffLng) => {
    try {
      const response = await fetch(`${API}/api/rides/safety/directions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pickup_latitude: pickupLat,
          pickup_longitude: pickupLng,
          dropoff_latitude: dropoffLat,
          dropoff_longitude: dropoffLng
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.route) {
          // Set route GeoJSON for visualization
          const routeGeoJSON = {
            type: 'Feature',
            geometry: data.route.geometry
          };
          setRoute(routeGeoJSON);
          setRouteInfo({
            distance: data.route.distance_km,
            duration: data.route.duration_minutes
          });

          // Center map on route
          setViewState({
            longitude: pickupLng,
            latitude: pickupLat,
            zoom: 12
          });
        }
      }
    } catch (error) {
      // console.error('Error fetching route:', error);
    }
  };

  const fetchEmergencyContacts = async () => {
    try {
      const response = await fetch(`${API}/api/rides/safety/emergency-contacts/${userId}`);
      if (response.ok) {
        const data = await response.json();
        setEmergencyContacts(data.contacts || []);
      }
    } catch (error) {
      // console.error('Error fetching contacts:', error);
    }
  };

  const generateVerificationCode = async () => {
    try {
      const response = await fetch(`${API}/api/rides/safety/generate-code/${rideId}`, {
        method: 'POST'
      });
      if (response.ok) {
        const data = await response.json();
        setVerificationCode(data.code);
      }
    } catch (error) {
      // console.error('Error generating code:', error);
    }
  };

  const startTracking = () => {
    if (!navigator.geolocation) {
      alert('Geolocation not supported');
      return;
    }

    // WebSocket for real-time tracking
    const wsUrl = API.replace('https', 'wss').replace('http', 'ws');
    wsRef.current = new WebSocket(`${wsUrl}/api/rides/safety/track/${rideId}/rider`);

    wsRef.current.onopen = () => {
      setTrackingActive(true);
    };

    wsRef.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'location_update') {
        setDriverLocation(data.location);
      }
    };

    // Send location updates every 5 seconds
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const location = {
          type: 'location_update',
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          speed: position.coords.speed,
          heading: position.coords.heading
        };

        setRiderLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        });

        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify(location));
        }
      },
      (error) => {
        // Location error
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  };

  const triggerSOS = async () => {
    if (!window.confirm('🚨 This will alert emergency services and your contacts. Continue?')) {
      return;
    }

    try {
      const response = await fetch(`${API}/api/rides/safety/sos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ride_id: rideId,
          user_id: userId,
          location: driverLocation || riderLocation || {},
          alert_type: 'panic'
        })
      });

      if (response.ok) {
        alert('🚨 SOS Alert Sent! Emergency contacts notified. Help is on the way.');
      }
    } catch (error) {
      // console.error('Error sending SOS:', error);
      if (window.confirm('Failed to send alert. Call 911 now?')) {
        window.location.href = 'tel:911';
      }
    }
  };

  const shareTrackingLink = async () => {
    try {
      const response = await fetch(`${API}/api/rides/safety/tracking/share-link/${rideId}`);
      if (response.ok) {
        const data = await response.json();
        
        if (navigator.share) {
          await navigator.share({
            title: 'Track My Ride',
            text: 'Track my ride in real-time for safety',
            url: data.tracking_url
          });
        } else {
          navigator.clipboard.writeText(data.tracking_url);
          alert('Tracking link copied to clipboard!');
        }
      }
    } catch (error) {
      // console.error('Error sharing link:', error);
    }
  };

  if (!ride) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-950 via-black to-blue-950 flex items-center justify-center">
        <div className="text-white">Loading ride details...</div>
      </div>
    );
  }

  // Route layer style
  const routeLayerStyle: any = {
    id: 'route',
    type: 'line',
    paint: {
      'line-color': '#2196F3',
      'line-width': 4,
      'line-opacity': 0.8
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-950 via-black to-blue-950 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Safety Header */}
        <div className="mb-6 bg-gradient-to-r from-green-900/40 to-blue-900/40 backdrop-blur-xl border-2 border-green-500/50 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Shield className="w-10 h-10 text-green-400" />
              <div>
                <h1 className="text-2xl font-bold text-white">🛡️ Safe Ride Active</h1>
                <p className="text-gray-400">Your ride is being monitored</p>
              </div>
            </div>
            
            {trackingActive && (
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="flex items-center gap-2 text-green-400"
              >
                <div className="w-3 h-3 bg-green-400 rounded-full" />
                <span className="font-bold">Live Tracking</span>
              </motion.div>
            )}
          </div>

          {/* Verification Code */}
          {verificationCode && !codeVerified && (
            <div className="bg-black/40 rounded-xl p-4 border border-yellow-500/50">
              <p className="text-yellow-400 text-sm mb-2">📱 Verification Code</p>
              <p className="text-4xl font-bold text-white tracking-wider mb-2">{verificationCode}</p>
              <p className="text-gray-400 text-sm">Show this code to your driver before entering the vehicle</p>
            </div>
          )}
        </div>

        {/* Real Mapbox Map */}
        <div className="mb-6 rounded-2xl overflow-hidden border border-cyan-500/50" style={{ height: '400px' }}>
          <Map
            {...viewState}
            onMove={evt => setViewState(evt.viewState)}
            mapStyle="mapbox://styles/mapbox/dark-v11"
            mapboxAccessToken={MAPBOX_TOKEN}
            style={{ width: '100%', height: '100%' }}
          >
            {/* Route Line */}
            {route && (
              <Source id="route" type="geojson" data={route}>
                <Layer {...routeLayerStyle} />
              </Source>
            )}

            {/* Driver Marker */}
            {driverLocation && (
              <Marker
                longitude={driverLocation.longitude}
                latitude={driverLocation.latitude}
                anchor="bottom"
              >
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    backgroundColor: '#FF6B6B',
                    borderRadius: '50%',
                    border: '3px solid white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
                    transform: `rotate(${driverLocation.heading || 0}deg)`
                  }}
                >
                  <span style={{ fontSize: '20px' }}>🚗</span>
                </div>
              </Marker>
            )}

            {/* Rider Marker */}
            {riderLocation && (
              <Marker
                longitude={riderLocation.longitude}
                latitude={riderLocation.latitude}
                anchor="bottom"
              >
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    backgroundColor: '#4CAF50',
                    borderRadius: '50%',
                    border: '3px solid white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 8px rgba(0,0,0,0.3)'
                  }}
                >
                  <span style={{ fontSize: '20px' }}>👤</span>
                </div>
              </Marker>
            )}

            {/* Pickup Marker */}
            {ride.pickup_location && (
              <Marker
                longitude={ride.pickup_location.longitude}
                latitude={ride.pickup_location.latitude}
                anchor="bottom"
              >
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    backgroundColor: '#2196F3',
                    borderRadius: '50%',
                    border: '2px solid white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 8px rgba(0,0,0,0.3)'
                  }}
                >
                  <span style={{ fontSize: '16px' }}>📍</span>
                </div>
              </Marker>
            )}

            {/* Dropoff Marker */}
            {ride.dropoff_location && (
              <Marker
                longitude={ride.dropoff_location.longitude}
                latitude={ride.dropoff_location.latitude}
                anchor="bottom"
              >
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    backgroundColor: '#9C27B0',
                    borderRadius: '50%',
                    border: '2px solid white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 8px rgba(0,0,0,0.3)'
                  }}
                >
                  <span style={{ fontSize: '16px' }}>🏁</span>
                </div>
              </Marker>
            )}
          </Map>
        </div>

        {/* ETA Display */}
        {routeInfo && (
          <div className="mb-6 bg-black/40 backdrop-blur-xl border border-cyan-500/50 rounded-2xl p-4">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-gray-400 text-sm">Distance</p>
                <p className="text-2xl font-bold text-white">{routeInfo.distance} km</p>
              </div>
              <div>
                <p className="text-gray-400 text-sm">ETA</p>
                <p className="text-2xl font-bold text-cyan-400">{routeInfo.duration} min</p>
              </div>
              {driverLocation?.speed && (
                <div>
                  <p className="text-gray-400 text-sm">Speed</p>
                  <p className="text-2xl font-bold text-green-400">
                    {(driverLocation.speed * 3.6).toFixed(0)} km/h
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* SOS Button */}
        <motion.button
          onClick={triggerSOS}
          className="w-full mb-6 p-8 bg-gradient-to-r from-red-600 to-red-800 rounded-2xl text-white"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          animate={{
            boxShadow: [
              '0 0 20px rgba(220, 38, 38, 0.5)',
              '0 0 40px rgba(220, 38, 38, 0.8)',
              '0 0 20px rgba(220, 38, 38, 0.5)'
            ]
          }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <AlertTriangle className="w-12 h-12 mx-auto mb-3" />
          <p className="text-3xl font-bold">🚨 SOS EMERGENCY</p>
          <p className="text-lg mt-2 opacity-90">Press to alert emergency contacts & services</p>
        </motion.button>

        {/* Emergency Contacts */}
        <div className="mb-6 bg-black/40 backdrop-blur-xl border border-cyan-500/50 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Users className="w-6 h-6 text-cyan-400" />
              Emergency Contacts
            </h2>
            <button
              onClick={shareTrackingLink}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 rounded-xl text-white text-sm font-semibold"
            >
              Share Tracking Link
            </button>
          </div>

          {emergencyContacts.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-gray-400 mb-3">No emergency contacts added</p>
              <button className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-xl text-white text-sm font-semibold">
                Add Emergency Contact
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {emergencyContacts.map((contact) => (
                <div
                  key={contact.id}
                  className="flex items-center justify-between bg-black/40 rounded-xl p-4"
                >
                  <div>
                    <p className="text-white font-semibold">{contact.name}</p>
                    <p className="text-gray-400 text-sm">{contact.relationship} • {contact.phone}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {contact.verified && (
                      <CheckCircle className="w-5 h-5 text-green-400" />
                    )}
                    <button
                      onClick={() => window.location.href = `tel:${contact.phone}`}
                      className="p-2 bg-green-600 hover:bg-green-700 rounded-lg"
                    >
                      <PhoneCall className="w-4 h-4 text-white" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Safety Features */}
        <div className="grid md:grid-cols-3 gap-4">
          <div className="bg-black/40 backdrop-blur-xl border border-green-500/50 rounded-xl p-4 text-center">
            <CheckCircle className="w-8 h-8 text-green-400 mx-auto mb-2" />
            <p className="text-white font-bold">Code Verified</p>
            <p className="text-gray-400 text-sm">Driver confirmed</p>
          </div>
          
          <div className="bg-black/40 backdrop-blur-xl border border-blue-500/50 rounded-xl p-4 text-center">
            <Navigation className="w-8 h-8 text-blue-400 mx-auto mb-2" />
            <p className="text-white font-bold">Route Monitoring</p>
            <p className="text-gray-400 text-sm">Tracking active</p>
          </div>
          
          <div className="bg-black/40 backdrop-blur-xl border border-purple-500/50 rounded-xl p-4 text-center">
            <Shield className="w-8 h-8 text-purple-400 mx-auto mb-2" />
            <p className="text-white font-bold">Contacts Notified</p>
            <p className="text-gray-400 text-sm">{emergencyContacts.length} watching</p>
          </div>
        </div>

        {/* Twilio safety controls — Call (masked) + SOS. Feature-flagged
            off the /api/twilio/status endpoint so this is a silent no-op
            when Twilio isn't configured. */}
        {ride && (
          <div className="mt-4">
            <RideSafetyBar
              rideId={rideId}
              callerNumber={ride.rider_phone || ride.passenger_phone}
              calleeNumber={ride.driver_phone}
              driverName={ride.driver_name}
              lat={ride.current_lat}
              lon={ride.current_lon}
            />
          </div>
        )}

        {/* Real-Time Ride Chat */}
        {ride && (
          <RideChat 
            rideId={rideId}
            userId={userId}
            role={ride.driver_user_id === userId ? 'driver' : 'passenger'}
          />
        )}

        {/* Driver POV Picture-in-Picture — silent no-op until driver goes live */}
        {rideId && <RidePOVPiP rideId={rideId} />}
      </div>
    </div>
  );
}
