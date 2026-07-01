import React, { useState, useEffect } from 'react';
import { Sparkles, Calendar, Gift, Trophy } from 'lucide-react';
import BackButton from '@/components/BackButton';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function SeasonalEvents() {
  const [events, setEvents] = useState([]);
  const [activeEvent, setActiveEvent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      const response = await fetch(`${API_URL}/api/progression/seasonal-events`);
      const data = await response.json();
      setEvents(data.events || []);
      setActiveEvent(data.active_event);
    } catch (error) {
      // console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const joinEvent = async (eventId) => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_URL}/api/progression/join-event`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ event_id: eventId })
      });
      if (response.ok) {
        alert('✅ Joined event!');
        fetchEvents();
      }
    } catch (error) {
      alert('Failed to join event');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-pink-900 to-black py-8 px-4">
      <BackButton to="/dashboard" label="Back" />
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-black bg-gradient-to-r from-pink-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent mb-4">
            ✨ Seasonal Events
          </h1>
          <p className="text-gray-300 text-lg">Limited-time events with exclusive rewards</p>
        </div>

        {activeEvent && (
          <Card className="bg-gradient-to-r from-pink-600 to-purple-600 p-8 mb-8">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-6 h-6 text-yellow-300" />
                  <span className="bg-yellow-400 text-black text-xs font-bold px-3 py-1 rounded-full">ACTIVE NOW</span>
                </div>
                <h2 className="text-3xl font-black text-white mb-2">{activeEvent.name}</h2>
                <p className="text-pink-100 mb-4">{activeEvent.description}</p>
                <div className="flex items-center gap-2 text-pink-100">
                  <Calendar className="w-4 h-4" />
                  <span className="text-sm">Ends: {activeEvent.end_date}</span>
                </div>
              </div>
              <Trophy className="w-20 h-20 text-yellow-300" />
            </div>
          </Card>
        )}

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {events.map((event) => (
            <Card key={event.event_id} className="bg-gray-800/50 border-purple-600 p-6">
              <Sparkles className="w-10 h-10 text-purple-400 mb-4" />
              <h3 className="text-2xl font-bold text-white mb-2">{event.name}</h3>
              <p className="text-gray-300 text-sm mb-4">{event.description}</p>
              
              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-gray-400 text-sm">
                  <Calendar className="w-4 h-4" />
                  <span>{event.start_date} - {event.end_date}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-400 text-sm">
                  <Gift className="w-4 h-4 text-yellow-400" />
                  <span>{event.rewards?.length || 0} exclusive rewards</span>
                </div>
              </div>

              <Button 
                onClick={() => joinEvent(event.event_id)}
                className="w-full bg-purple-500 hover:bg-purple-600"
                disabled={event.status === 'ended'}
              >
                {event.status === 'ended' ? 'Event Ended' : 'Join Event'}
              </Button>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
