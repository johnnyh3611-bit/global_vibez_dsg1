import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Video, Clock, Users, Calendar, Plus } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function SpeedDating() {
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [myEvents, setMyEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('browse'); // browse, my-events, create

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      const response = await fetch(`${API_URL}/api/speed-dating/events/list?status=upcoming`, {
        
      });
      if (response.ok) {
        const data = await response.json();
        setEvents(data.events || []);
      }
    } catch (error) {
      // console.error('Error fetching events:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinEvent = async (eventId) => {
    try {
      const response = await fetch(`${API_URL}/api/speed-dating/events/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        
        body: JSON.stringify({ event_id: eventId }),
      });

      if (response.ok) {
        alert('Successfully joined the event!');
        fetchEvents();
      } else {
        const error = await response.json();
        alert(error.detail || 'Failed to join event');
      }
    } catch (error) {
      // console.error('Error joining event:', error);
      alert('Failed to join event');
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50 pb-20">
      {/* Header */}
      <div className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate('/dashboard')}
              className="text-gray-600 hover:text-gray-900"
            >
              ← Back
            </button>
            <div className="flex items-center space-x-2">
              <Video className="w-6 h-6 text-purple-600" />
              <h1 className="text-xl font-bold text-gray-900">Speed Dating</h1>
            </div>
            <Button
              onClick={() => navigate('/speed-dating/room')}
              className="bg-gradient-to-r from-purple-600 to-pink-600 text-white"
            >
              Join Session
            </Button>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white shadow-sm border-b sticky top-[73px] z-10">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex space-x-4">
            <button
              onClick={() => setActiveTab('browse')}
              className={`py-3 px-4 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'browse'
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Browse Events
            </button>
            <button
              onClick={() => setActiveTab('create')}
              className={`py-3 px-4 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'create'
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Plus className="w-4 h-4 inline mr-1" />
              Create Event
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        {activeTab === 'browse' && (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Upcoming Speed Dating Events</h2>
              <p className="text-gray-600">
                Meet multiple people in quick video sessions and find instant connections!
              </p>
            </div>

            {loading ? (
              <div className="text-center py-12">Loading events...</div>
            ) : events.length === 0 ? (
              <Card className="p-12 text-center">
                <Video className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No events available</h3>
                <p className="text-gray-600 mb-4">Be the first to create a speed dating event!</p>
                <Button
                  onClick={() => setActiveTab('create')}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  Create Event
                </Button>
              </Card>
            ) : (
              <div className="grid md:grid-cols-2 gap-6">
                {events.map((event) => (
                  <Card key={event.event_id} className="p-6 hover:shadow-lg transition-shadow">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-xl font-bold text-gray-900 mb-1">{event.title}</h3>
                        <p className="text-sm text-gray-600">{event.description}</p>
                      </div>
                      <Video className="w-8 h-8 text-purple-600" />
                    </div>

                    <div className="space-y-3 mb-4">
                      <div className="flex items-center text-sm text-gray-700">
                        <Calendar className="w-4 h-4 mr-2 text-gray-400" />
                        {formatDate(event.scheduled_time)}
                      </div>
                      <div className="flex items-center text-sm text-gray-700">
                        <Clock className="w-4 h-4 mr-2 text-gray-400" />
                        {event.session_duration_minutes} min sessions • {event.duration_minutes} min total
                      </div>
                      <div className="flex items-center text-sm text-gray-700">
                        <Users className="w-4 h-4 mr-2 text-gray-400" />
                        {event.participants?.length || 0} / {event.max_participants} participants
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t">
                      <span className="text-sm font-medium text-purple-600">
                        {event.max_participants - (event.participants?.length || 0)} spots left
                      </span>
                      <Button
                        onClick={() => handleJoinEvent(event.event_id)}
                        disabled={event.participants?.length >= event.max_participants}
                        className="bg-gradient-to-r from-purple-600 to-pink-600 text-white disabled:opacity-50"
                      >
                        Join Event
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'create' && (
          <div>
            <CreateEventForm onSuccess={() => {
              fetchEvents();
              setActiveTab('browse');
            }} />
          </div>
        )}
      </div>
    </div>
  );
}

function CreateEventForm({ onSuccess }) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    scheduled_time: '',
    duration_minutes: 60,
    session_duration_minutes: 5,
    max_participants: 10,
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/speed-dating/events/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        
        body: JSON.stringify({
          ...formData,
          scheduled_time: new Date(formData.scheduled_time).toISOString(),
        }),
      });

      if (response.ok) {
        alert('Event created successfully!');
        onSuccess();
      } else {
        const error = await response.json();
        alert(error.detail || 'Failed to create event');
      }
    } catch (error) {
      // console.error('Error creating event:', error);
      alert('Failed to create event');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-8 max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Create Speed Dating Event</h2>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Event Title</label>
          <input
            type="text"
            required
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
            placeholder="Friday Night Speed Dating"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
          <textarea
            required
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
            rows={3}
            placeholder="Join us for an exciting speed dating experience!"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Scheduled Time</label>
          <input
            type="datetime-local"
            required
            value={formData.scheduled_time}
            onChange={(e) => setFormData({ ...formData, scheduled_time: e.target.value })}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Session Duration (minutes)
            </label>
            <input
              type="number"
              required
              min="3"
              max="15"
              value={formData.session_duration_minutes}
              onChange={(e) => setFormData({ ...formData, session_duration_minutes: parseInt(e.target.value) })}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Max Participants
            </label>
            <input
              type="number"
              required
              min="4"
              max="20"
              value={formData.max_participants}
              onChange={(e) => setFormData({ ...formData, max_participants: parseInt(e.target.value) })}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
            />
          </div>
        </div>

        <Button
          type="submit"
          disabled={loading}
          className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 text-lg"
        >
          {loading ? 'Creating...' : 'Create Event'}
        </Button>
      </form>
    </Card>
  );
}
