import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Video, Clock, Heart, Users, Sparkles } from 'lucide-react';
import SpeedDatingVideo from './SpeedDatingVideo';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function SpeedDating() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [inSession, setInSession] = useState(false);
  const [sessionData, setSessionData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUser();
  }, []);

  const fetchUser = async () => {
    try {
      const response = await fetch(`${API_URL}/api/auth/me`, {
      });
      if (response.ok) {
        const data = await response.json();
        setUser(data);
      }
    } catch (error) {
      // console.error('Error fetching user:', error);
    } finally {
      setLoading(false);
    }
  };

  const startSpeedDating = async (durationMinutes) => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/api/speed-dating/create-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        
        body: JSON.stringify({ duration_minutes: durationMinutes })
      });

      if (response.ok) {
        const data = await response.json();
        
        // Get room info with partner details
        const roomResponse = await fetch(`${API_URL}/api/speed-dating/room/${data.room_id}`, {
        });
        
        if (roomResponse.ok) {
          const roomData = await roomResponse.json();
          setSessionData({
            roomId: data.room_id,
            partnerId: data.partner_id,
            partnerName: roomData.partner.name,
            durationMinutes: data.duration_minutes
          });
          setInSession(true);
        }
      } else {
        const error = await response.json();
        alert(error.detail || 'Failed to create session');
      }
    } catch (error) {
      // console.error('Error starting speed dating:', error);
      alert('Failed to start speed dating. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-rose-600 mx-auto mb-4"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (inSession && sessionData) {
    return (
      <SpeedDatingVideo
        roomId={sessionData.roomId}
        userId={user.user_id}
        partnerName={sessionData.partnerName}
        durationMinutes={sessionData.durationMinutes}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow-lg">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Video className="w-8 h-8" />
              <div>
                <h1 className="text-3xl font-bold">Speed Dating</h1>
                <p className="text-pink-100">Connect face-to-face with your matches!</p>
              </div>
            </div>
            <Button
              onClick={() => navigate('/dashboard')}
              variant="outline"
              className="bg-white/20 border-white/30 text-white hover:bg-white/30"
            >
              ← Back
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="absolute inset-0 bg-pink-400 rounded-full blur-3xl opacity-30 animate-pulse"></div>
              <div className="relative bg-gradient-to-br from-pink-500 to-purple-600 p-6 rounded-full">
                <Video className="w-16 h-16 text-white" />
              </div>
            </div>
          </div>
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Meet Your Match Face-to-Face
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Jump into quick video chats with your matches. No awkward first dates—just genuine connections in minutes.
          </p>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <Card className="p-6 text-center hover:shadow-xl transition-shadow">
            <Clock className="w-12 h-12 mx-auto text-blue-600 mb-4" />
            <h3 className="font-bold text-lg mb-2">Timed Sessions</h3>
            <p className="text-sm text-gray-600">
              3 or 5-minute video dates keep things exciting and efficient
            </p>
          </Card>

          <Card className="p-6 text-center hover:shadow-xl transition-shadow">
            <Users className="w-12 h-12 mx-auto text-purple-600 mb-4" />
            <h3 className="font-bold text-lg mb-2">1-on-1 Private</h3>
            <p className="text-sm text-gray-600">
              Completely private video rooms for genuine connections
            </p>
          </Card>

          <Card className="p-6 text-center hover:shadow-xl transition-shadow">
            <Heart className="w-12 h-12 mx-auto text-rose-600 mb-4" />
            <h3 className="font-bold text-lg mb-2">Rate & Match</h3>
            <p className="text-sm text-gray-600">
              Both interested? You'll be notified and can connect further!
            </p>
          </Card>
        </div>

        {/* Start Options */}
        <div className="space-y-6">
          <h3 className="text-2xl font-bold text-center text-gray-900">Choose Your Duration</h3>
          
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="p-8 hover:shadow-2xl transition-all cursor-pointer border-2 hover:border-pink-500"
              onClick={() => startSpeedDating(3)}>
              <div className="text-center">
                <Clock className="w-16 h-16 mx-auto text-pink-600 mb-4" />
                <h3 className="text-2xl font-bold mb-2">Quick Chat</h3>
                <p className="text-5xl font-bold text-pink-600 mb-2">3</p>
                <p className="text-lg text-gray-600 mb-6">minutes</p>
                <Button className="w-full bg-gradient-to-r from-pink-500 to-rose-600 text-white py-6 text-lg">
                  Start Quick Chat
                </Button>
              </div>
            </Card>

            <Card className="p-8 hover:shadow-2xl transition-all cursor-pointer border-2 hover:border-purple-500"
              onClick={() => startSpeedDating(5)}>
              <div className="text-center">
                <Clock className="w-16 h-16 mx-auto text-purple-600 mb-4" />
                <h3 className="text-2xl font-bold mb-2">Deep Dive</h3>
                <p className="text-5xl font-bold text-purple-600 mb-2">5</p>
                <p className="text-lg text-gray-600 mb-6">minutes</p>
                <div className="flex items-center justify-center mb-4">
                  <Sparkles className="w-4 h-4 text-yellow-500 mr-1" />
                  <span className="text-sm font-medium text-yellow-600">POPULAR</span>
                </div>
                <Button className="w-full bg-gradient-to-r from-purple-500 to-indigo-600 text-white py-6 text-lg">
                  Start Deep Dive
                </Button>
              </div>
            </Card>
          </div>
        </div>

        {/* Info */}
        <div className="mt-12 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h4 className="font-bold text-blue-900 mb-3">How It Works:</h4>
          <ol className="space-y-2 text-blue-800">
            <li className="flex items-start">
              <span className="font-bold mr-2">1.</span>
              <span>Choose your preferred session length (3 or 5 minutes)</span>
            </li>
            <li className="flex items-start">
              <span className="font-bold mr-2">2.</span>
              <span>We'll match you with one of your connections for a video chat</span>
            </li>
            <li className="flex items-start">
              <span className="font-bold mr-2">3.</span>
              <span>Chat naturally—video ends automatically when time is up</span>
            </li>
            <li className="flex items-start">
              <span className="font-bold mr-2">4.</span>
              <span>Rate your experience and indicate if you're interested</span>
            </li>
            <li className="flex items-start">
              <span className="font-bold mr-2">5.</span>
              <span>If both people are interested, you'll be notified and can connect more!</span>
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
}
