import { useState } from 'react';
import { motion } from 'framer-motion';
import { Car, Calendar, Users, MapPin, Trophy, Heart, DollarSign } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const API = process.env.REACT_APP_BACKEND_URL;

// Integration with tournaments, dates, and events
export default function RideIntegration() {
  const navigate = useNavigate();
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [carpoolMode, setCarpoolMode] = useState(false);

  const upcomingEvents = [
    {
      id: 'tournament_1',
      type: 'tournament',
      title: 'Friday Night Poker Championship',
      location: 'Downtown Gaming Arena',
      time: 'Tonight at 8 PM',
      participants: 32,
      icon: <Trophy className="w-6 h-6" />
    },
    {
      id: 'date_1',
      type: 'date',
      title: 'Date with Sarah',
      location: 'Riverside Cafe',
      time: 'Tomorrow at 7 PM',
      match: 'Sarah M.',
      icon: <Heart className="w-6 h-6" />
    },
    {
      id: 'event_1',
      type: 'event',
      title: 'MY VIBEZ Meetup',
      location: 'Central Park',
      time: 'Saturday at 2 PM',
      attendees: 15,
      icon: <Users className="w-6 h-6" />
    }
  ];

  const requestRideToEvent = async (event) => {
    try {
      // In real implementation, fetch event location coords
      const response = await fetch(`${API}/api/rides/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pickup_location: {
            address: 'Current Location',
            latitude: 40.7128,
            longitude: -74.0060
          },
          dropoff_location: {
            address: event.location,
            latitude: 40.7589,
            longitude: -73.9851
          },
          use_trusted_contact: true,
          event_id: event.id,
          event_type: event.type
        })
      });

      if (response.ok) {
        const data = await response.json();
        navigate(`/ride/${data.ride.ride_id}`);
      }
    } catch (error) {
      // console.error('Error requesting ride:', error);
    }
  };

  const findCarpool = async (event) => {
    // Find other users going to same event
    try {
      const response = await fetch(`${API}/api/rides/carpool/find`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: event.id,
          event_type: event.type,
          max_passengers: 3
        })
      });

      if (response.ok) {
        const data = await response.json();
        // Show carpool options
      }
    } catch (error) {
      // console.error('Error finding carpool:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-950 via-black to-blue-950 p-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-white mb-2">🚗 Vibe Ridez</h1>
        <p className="text-gray-400 mb-6">Get rides to your gaming tournaments, dates, and events!</p>

        {/* Quick Actions */}
        <div className="grid md:grid-cols-3 gap-4 mb-8">
          <motion.button
            onClick={() => navigate('/ride/book')}
            className="bg-gradient-to-r from-cyan-600 to-blue-600 p-6 rounded-2xl text-white text-left hover:shadow-2xl transition-all"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Car className="w-10 h-10 mb-3" />
            <h3 className="font-bold text-lg">Book a Ride</h3>
            <p className="text-sm opacity-80">Go anywhere, anytime</p>
          </motion.button>

          <motion.button
            onClick={() => setCarpoolMode(!carpoolMode)}
            className="bg-gradient-to-r from-purple-600 to-pink-600 p-6 rounded-2xl text-white text-left hover:shadow-2xl transition-all"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Users className="w-10 h-10 mb-3" />
            <h3 className="font-bold text-lg">Find Carpool</h3>
            <p className="text-sm opacity-80">Share rides, save money</p>
          </motion.button>

          <motion.button
            onClick={() => navigate('/driver/dashboard')}
            className="bg-gradient-to-r from-green-600 to-teal-600 p-6 rounded-2xl text-white text-left hover:shadow-2xl transition-all"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <DollarSign className="w-10 h-10 mb-3" />
            <h3 className="font-bold text-lg">Earn as Driver</h3>
            <p className="text-sm opacity-80">60% earnings + tips</p>
          </motion.button>
        </div>

        {/* Upcoming Events */}
        <div>
          <h2 className="text-2xl font-bold text-white mb-4">📅 Upcoming Events & Rides</h2>
          <p className="text-gray-400 mb-4">Book rides to your scheduled events</p>

          <div className="space-y-4">
            {upcomingEvents.map((event) => (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-black/40 backdrop-blur-xl border border-cyan-500/50 rounded-2xl p-6 hover:border-cyan-400 transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="flex gap-4 flex-1">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      event.type === 'tournament' ? 'bg-yellow-600/20 text-yellow-400' :
                      event.type === 'date' ? 'bg-pink-600/20 text-pink-400' :
                      'bg-blue-600/20 text-blue-400'
                    }`}>
                      {event.icon}
                    </div>

                    <div className="flex-1">
                      <h3 className="text-white font-bold text-lg mb-1">{event.title}</h3>
                      
                      <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
                        <MapPin className="w-4 h-4" />
                        <span>{event.location}</span>
                      </div>
                      
                      <div className="flex items-center gap-2 text-gray-400 text-sm">
                        <Calendar className="w-4 h-4" />
                        <span>{event.time}</span>
                      </div>
                      
                      {event.participants && (
                        <p className="text-cyan-400 text-sm mt-2">
                          <Users className="w-4 h-4 inline mr-1" />
                          {event.participants} participants
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <motion.button
                      onClick={() => requestRideToEvent(event)}
                      className="px-6 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 rounded-xl text-white font-semibold text-sm"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      🚗 Book Ride
                    </motion.button>
                    
                    {carpoolMode && (
                      <motion.button
                        onClick={() => findCarpool(event)}
                        className="px-6 py-2 bg-purple-600/20 border border-purple-500 rounded-xl text-purple-300 font-semibold text-sm"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        👥 Find Carpool
                      </motion.button>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Gamification Benefits */}
        <div className="mt-8 bg-gradient-to-r from-yellow-900/40 to-orange-900/40 backdrop-blur-xl border border-yellow-500/50 rounded-2xl p-6">
          <h3 className="text-xl font-bold text-white mb-4">✨ Ride Rewards</h3>
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <p className="text-yellow-400 font-bold">+50 XP</p>
              <p className="text-gray-400 text-sm">Per completed ride</p>
            </div>
            <div>
              <p className="text-yellow-400 font-bold">2x Coins</p>
              <p className="text-gray-400 text-sm">Carpooling to events</p>
            </div>
            <div>
              <p className="text-yellow-400 font-bold">Streak Bonus</p>
              <p className="text-gray-400 text-sm">5+ rides per week</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
