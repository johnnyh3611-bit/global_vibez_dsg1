import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Video, VideoOff, Mic, MicOff, PhoneOff, Heart, X, Clock } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function SpeedDatingRoom() {
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [otherUser, setOtherUser] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showFeedback, setShowFeedback] = useState(false);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const iframeRef = useRef(null);

  useEffect(() => {
    fetchCurrentSession();
    const interval = setInterval(fetchCurrentSession, 5000); // Check for new session every 5s
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (timeRemaining > 0) {
      const timer = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            setShowFeedback(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [timeRemaining]);

  const fetchCurrentSession = async () => {
    try {
      const response = await fetch(`${API_URL}/api/speed-dating/sessions/my-current`, {
        
      });

      if (response.ok) {
        const data = await response.json();
        if (data.session) {
          setSession(data.session);
          setOtherUser(data.other_user);
          setTimeRemaining(data.time_remaining || 0);
        } else {
          setSession(null);
          setOtherUser(null);
        }
      }
    } catch (error) {
      // console.error('Error fetching session:', error);
    } finally {
      setLoading(false);
    }
  };

  const submitFeedback = async (liked) => {
    if (!session) return;

    try {
      const response = await fetch(`${API_URL}/api/speed-dating/sessions/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        
        body: JSON.stringify({
          session_id: session.session_id,
          liked: liked,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.matched) {
          alert('🎉 It\'s a match! You can now chat with each other!');
          navigate('/matches');
        } else {
          alert('Feedback submitted! Waiting for your next session...');
          setShowFeedback(false);
          setSession(null);
          fetchCurrentSession();
        }
      }
    } catch (error) {
      // console.error('Error submitting feedback:', error);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-orange-600 flex items-center justify-center">
        <div className="text-white text-xl">Loading session...</div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-orange-600 flex items-center justify-center p-4">
        <Card className="p-12 max-w-md text-center">
          <Clock className="w-16 h-16 mx-auto text-gray-400 mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-4">No Active Session</h2>
          <p className="text-gray-600 mb-6">
            You don't have any active speed dating sessions right now. Join an event to start meeting people!
          </p>
          <Button
            onClick={() => navigate('/speed-dating')}
            className="bg-gradient-to-r from-purple-600 to-pink-600 text-white"
          >
            Browse Events
          </Button>
        </Card>
      </div>
    );
  }

  if (showFeedback) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-orange-600 flex items-center justify-center p-4">
        <Card className="p-12 max-w-md text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            How was your conversation with {otherUser?.name}?
          </h2>
          <p className="text-gray-600 mb-8">
            If you both like each other, you'll get a match and can continue chatting!
          </p>

          <div className="flex gap-4 justify-center">
            <Button
              onClick={() => submitFeedback(false)}
              className="flex-1 bg-gray-200 text-gray-700 hover:bg-gray-300 py-8 text-lg"
            >
              <X className="w-8 h-8 mr-2" />
              Pass
            </Button>
            <Button
              onClick={() => submitFeedback(true)}
              className="flex-1 bg-gradient-to-r from-pink-500 to-red-500 text-white hover:from-pink-600 hover:to-red-600 py-8 text-lg"
            >
              <Heart className="w-8 h-8 mr-2" />
              Like
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold">
                {otherUser?.name?.[0] || '?'}
              </div>
              <div>
                <h2 className="text-white font-semibold">{otherUser?.name}</h2>
                <p className="text-gray-400 text-sm">
                  {otherUser?.age && `${otherUser.age} • `}Speed Dating Session
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <div className="bg-red-500 text-white px-4 py-2 rounded-full font-bold flex items-center">
                <Clock className="w-4 h-4 mr-2" />
                {formatTime(timeRemaining)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Video Area */}
      <div className="relative h-[calc(100vh-140px)]">
        {session.room_url ? (
          <iframe
            ref={iframeRef}
            src={session.room_url}
            allow="camera; microphone; fullscreen; display-capture; autoplay"
            className="w-full h-full"
            title="Speed Dating Video Call"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-800">
            <div className="text-center text-white">
              <Video className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="text-xl">Connecting to video room...</p>
              <p className="text-sm text-gray-400 mt-2">
                Note: Video chat requires Daily.co API key to be configured
              </p>
            </div>
          </div>
        )}

        {/* Quick Profile Overlay */}
        {otherUser && (
          <div className="absolute top-4 right-4 bg-black/70 backdrop-blur-sm rounded-xl p-4 max-w-xs text-white">
            <p className="text-sm mb-1">
              <strong>{otherUser.name}</strong>
              {otherUser.age && `, ${otherUser.age}`}
            </p>
            {otherUser.bio && (
              <p className="text-xs text-gray-300">{otherUser.bio}</p>
            )}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="bg-gray-800 border-t border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-center space-x-4">
            <Button
              onClick={() => setAudioEnabled(!audioEnabled)}
              className={`rounded-full w-14 h-14 ${
                audioEnabled ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-500 hover:bg-red-600'
              }`}
            >
              {audioEnabled ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
            </Button>

            <Button
              onClick={() => setVideoEnabled(!videoEnabled)}
              className={`rounded-full w-14 h-14 ${
                videoEnabled ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-500 hover:bg-red-600'
              }`}
            >
              {videoEnabled ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
            </Button>

            <Button
              onClick={() => {
                if (window.confirm('Are you sure you want to end the session early?')) {
                  setShowFeedback(true);
                }
              }}
              className="rounded-full w-14 h-14 bg-red-600 hover:bg-red-700"
            >
              <PhoneOff className="w-6 h-6" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
