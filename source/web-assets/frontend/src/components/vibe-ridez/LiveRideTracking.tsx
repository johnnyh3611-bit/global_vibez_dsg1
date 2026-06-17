import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { io } from 'socket.io-client';
import { motion, AnimatePresence } from 'framer-motion';
import { Navigation, MessageCircle, X, Send, MapPin, Clock } from 'lucide-react';

const MAPBOX_TOKEN = process.env.REACT_APP_MAPBOX_TOKEN;
const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function LiveRideTracking({ 
  rideId, 
  userId, 
  role, // 'driver' or 'passenger'
  pickupLocation,
  dropoffLocation,
  onClose
}) {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const driverMarker = useRef(null);
  const socket = useRef(null);

  const [driverLocation, setDriverLocation] = useState(null);
  const [rideStatus, setRideStatus] = useState('scheduled');
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [showChat, setShowChat] = useState(false);
  const [eta, setEta] = useState(null);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [pickupLocation.longitude, pickupLocation.latitude],
      zoom: 13
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    // Add pickup marker (green)
    new mapboxgl.Marker({ color: '#22c55e' })
      .setLngLat([pickupLocation.longitude, pickupLocation.latitude])
      .setPopup(new mapboxgl.Popup().setHTML(`<strong>Pickup</strong><br/>${pickupLocation.address}`))
      .addTo(map.current);

    // Add dropoff marker (red)
    new mapboxgl.Marker({ color: '#ef4444' })
      .setLngLat([dropoffLocation.longitude, dropoffLocation.latitude])
      .setPopup(new mapboxgl.Popup().setHTML(`<strong>Dropoff</strong><br/>${dropoffLocation.address}`))
      .addTo(map.current);

    // Add driver marker (blue, initially hidden)
    driverMarker.current = new mapboxgl.Marker({ color: '#3b82f6' })
      .setLngLat([pickupLocation.longitude, pickupLocation.latitude])
      .addTo(map.current);

    // Fit bounds to show both pickup and dropoff
    const bounds = new mapboxgl.LngLatBounds()
      .extend([pickupLocation.longitude, pickupLocation.latitude])
      .extend([dropoffLocation.longitude, dropoffLocation.latitude]);
    
    map.current.fitBounds(bounds, { padding: 100 });

  }, []);

  // Initialize Socket.IO
  useEffect(() => {
    socket.current = io(`${API_URL}`, {
      path: '/api/socket.io',
      transports: ['websocket', 'polling']
    });

    // Join ride room
    socket.current.emit('vibe_ridez_join_ride', {
      ride_id: rideId,
      user_id: userId,
      role: role
    });

    // Listen for driver location updates
    socket.current.on('driver_location', (data) => {
      setDriverLocation(data);
      
      if (driverMarker.current && map.current) {
        driverMarker.current.setLngLat([data.longitude, data.latitude]);
        
        // Calculate ETA (simple estimation)
        if (role === 'passenger') {
          const distance = calculateDistance(
            data.latitude, data.longitude,
            pickupLocation.latitude, pickupLocation.longitude
          );
          const etaMinutes = Math.round((distance / (data.speed || 30)) * 60); // Assume 30 mph if no speed
          setEta(etaMinutes);
        }
      }
    });

    // Listen for ride status changes
    socket.current.on('ride_started', () => {
      setRideStatus('active');
    });

    socket.current.on('ride_completed', () => {
      setRideStatus('completed');
    });

    // Listen for messages
    socket.current.on('ride_message', (data) => {
      setMessages(prev => [...prev, data]);
    });

    // Get message history
    socket.current.emit('vibe_ridez_get_messages', { ride_id: rideId });

    socket.current.on('ride_messages_history', (data) => {
      setMessages(data.messages || []);
    });

    return () => {
      socket.current.emit('vibe_ridez_leave_ride', { ride_id: rideId });
      socket.current.disconnect();
    };
  }, [rideId, userId, role]);

  // Share location if driver
  useEffect(() => {
    if (role !== 'driver') return;

    let watchId;

    if ('geolocation' in navigator) {
      watchId = navigator.geolocation.watchPosition(
        (position) => {
          const location = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            heading: position.coords.heading || 0,
            speed: position.coords.speed || 0
          };

          socket.current.emit('vibe_ridez_location_update', location);
        },
        (error) => {
          // console.error('Geolocation error:', error);
        },
        {
          enableHighAccuracy: true,
          maximumAge: 5000,
          timeout: 10000
        }
      );
    }

    return () => {
      if (watchId) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [role]);

  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 3959; // Earth radius in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const sendMessage = () => {
    if (!newMessage.trim()) return;

    socket.current.emit('vibe_ridez_send_message', {
      ride_id: rideId,
      message: newMessage
    });

    setNewMessage('');
  };

  const handleStartRide = () => {
    socket.current.emit('vibe_ridez_start_ride', { ride_id: rideId });
  };

  const handleCompleteRide = () => {
    socket.current.emit('vibe_ridez_complete_ride', { ride_id: rideId });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/80 to-transparent p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-white text-xl font-bold">Live Ride Tracking</h2>
            <p className="text-gray-300 text-sm">
              Status: <span className="text-cyan-400 font-semibold">{rideStatus}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/10 rounded-full p-2 transition"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* ETA Badge for Passengers */}
        {role === 'passenger' && eta !== null && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="mt-3 inline-flex items-center gap-2 bg-cyan-500 text-black px-4 py-2 rounded-full font-bold"
          >
            <Clock className="w-5 h-5" />
            ETA: {eta} min
          </motion.div>
        )}

        {/* Driver Controls */}
        {role === 'driver' && (
          <div className="mt-3 flex gap-2">
            {rideStatus === 'scheduled' && (
              <button
                onClick={handleStartRide}
                className="bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded-full font-bold transition"
              >
                Start Ride
              </button>
            )}
            {rideStatus === 'active' && (
              <button
                onClick={handleCompleteRide}
                className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-full font-bold transition"
              >
                Complete Ride
              </button>
            )}
          </div>
        )}
      </div>

      {/* Map */}
      <div ref={mapContainer} className="absolute inset-0" />

      {/* Chat Button */}
      <button
        onClick={() => setShowChat(!showChat)}
        className="absolute bottom-6 right-6 z-10 bg-cyan-500 hover:bg-cyan-600 text-white rounded-full p-4 shadow-lg transition"
      >
        <MessageCircle className="w-6 h-6" />
      </button>

      {/* Chat Panel */}
      <AnimatePresence>
        {showChat && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            className="absolute top-0 right-0 bottom-0 w-full sm:w-96 bg-slate-900 border-l border-slate-700 z-20 flex flex-col"
          >
            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
              <h3 className="text-white font-bold">Ride Chat</h3>
              <button onClick={() => setShowChat(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((msg, i) => (
                <div
                  key={msg.id || `messages-${i}`}
                  className={`flex ${msg.user_id === userId ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                    msg.user_id === userId
                      ? 'bg-cyan-500 text-white'
                      : 'bg-slate-700 text-white'
                  }`}>
                    <div className="text-xs opacity-70 mb-1">
                      {msg.role === 'driver' ? '🚗 Driver' : '👤 Passenger'}
                    </div>
                    <div>{msg.message}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Input */}
            <div className="p-4 border-t border-slate-700">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                  placeholder="Type a message..."
                  className="flex-1 bg-slate-800 text-white rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
                <button
                  onClick={sendMessage}
                  className="bg-cyan-500 hover:bg-cyan-600 text-white rounded-full p-2 transition"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
