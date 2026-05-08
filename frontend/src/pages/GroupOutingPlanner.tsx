import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Sparkles, Users, MapPin, Clock, DollarSign, Heart, ArrowLeft, Loader2, Calendar, CheckCircle, Utensils, Star } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

export default function GroupOutingPlanner() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedRestaurant = searchParams.get('restaurant');
  
  const [mode, setMode] = useState('friends'); // 'friends' or 'date'
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState(null);
  const [mySuggestions, setMySuggestions] = useState([]);
  const [groupSize, setGroupSize] = useState(4);
  const [location, setLocation] = useState('');
  const [budget, setBudget] = useState('moderate');
  const [cuisine, setCuisine] = useState('');
  const [ambiance, setAmbiance] = useState('');
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState(null);
  const [restaurants, setRestaurants] = useState([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);
  const [userLocation, setUserLocation] = useState(null);

  useEffect(() => {
    fetchMySuggestions();
    
    // Get user location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        }
      );
    }

    // If preselected restaurant, fetch it
    if (preselectedRestaurant) {
      setMode('date');
      fetchPreselectedRestaurant(preselectedRestaurant);
    }
  }, []);

  const fetchPreselectedRestaurant = async (restaurantId) => {
    try {
      const response = await fetch(`${API}/api/restaurants/${restaurantId}`);
      if (response.ok) {
        const data = await response.json();
        setSelectedRestaurant(data);
        setLocation(data.city);
      }
    } catch (err) {
      // console.error('Error fetching restaurant:', err);
    }
  };

  const fetchRestaurants = async () => {
    try {
      const params = new URLSearchParams();
      if (location) params.append('city', location);
      if (cuisine) params.append('cuisine_type', cuisine);
      if (ambiance) params.append('ambiance', ambiance);
      if (userLocation) {
        params.append('user_lat', userLocation.lat);
        params.append('user_lng', userLocation.lng);
      }

      const response = await fetch(`${API}/api/restaurants/list?${params}&limit=20`);
      if (response.ok) {
        const data = await response.json();
        setRestaurants(data.restaurants || []);
      }
    } catch (err) {
      // console.error('Error fetching restaurants:', err);
    }
  };

  useEffect(() => {
    if (mode === 'date' && location && !preselectedRestaurant) {
      fetchRestaurants();
    }
  }, [mode, location, cuisine, ambiance, userLocation]);

  const fetchMySuggestions = async () => {
    try {
      const response = await fetch(`${API}/api/group-planner/my-suggestions?limit=5`, {
      });

      if (response.ok) {
        const data = await response.json();
        setMySuggestions(data);
      }
    } catch (err) {
      // console.error('Error fetching suggestions:', err);
    }
  };

  const generateSuggestion = async () => {
    setLoading(true);
    setError(null);

    try {
      // For date mode with restaurant, generate date itinerary
      if (mode === 'date' && selectedRestaurant) {
        const response = await fetch(`${API}/api/planner/generate-date-plan`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          
          body: JSON.stringify({
            restaurant_id: selectedRestaurant.restaurant_id,
            budget: budget,
            location: location || selectedRestaurant.city
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || 'Failed to generate date plan');
        }

        const data = await response.json();
        setSuggestion({ ...data, mode: 'date' });
      } else {
        // Original group outing logic
        const response = await fetch(`${API}/api/group-planner/generate-suggestion`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          
          body: JSON.stringify({
            group_size: groupSize,
            location: location || null
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || 'Failed to generate suggestion');
        }

        const data = await response.json();
        setSuggestion({ ...data, mode: 'friends' });
      }
      
      fetchMySuggestions();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const acceptSuggestion = async (activityIndex) => {
    setAccepting(true);

    try {
      const response = await fetch(
        `${API}/api/group-planner/accept-suggestion/${suggestion.suggestion_id}?activity_index=${activityIndex}`,
        {
          method: 'POST',
        }
      );

      if (!response.ok) {
        throw new Error('Failed to accept suggestion');
      }

      const result = await response.json();
      alert(`🎉 ${result.message}\n\nInvited ${result.invited_count} friends to: ${result.activity.name}`);
      
      // Reset and refresh
      setSuggestion(null);
      fetchMySuggestions();
    } catch (err) {
      setError(err.message);
    } finally {
      setAccepting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-pink-900 to-purple-900 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Button
            onClick={() => navigate('/dashboard')}
            variant="ghost"
            className="text-white hover:bg-white/10 mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          
          <div className="text-center mb-6">
            <h1 className="text-5xl font-bold text-white mb-4">
              {mode === 'date' ? '💕 AI Date Planner' : '🎉 AI Group Outing Planner'}
            </h1>
            <p className="text-xl text-gray-200 mb-6">
              {mode === 'date' 
                ? 'Let AI create the perfect romantic date itinerary with restaurant recommendations'
                : 'Let AI automatically pair your compatible friends and suggest perfect activities!'}
            </p>
            
            {/* Mode Toggle */}
            <div className="inline-flex rounded-lg bg-white/10 p-1 backdrop-blur-lg">
              <button
                onClick={() => setMode('date')}
                className={`px-6 py-2 rounded-lg transition-all ${
                  mode === 'date'
                    ? 'bg-gradient-to-r from-pink-500 to-red-500 text-white'
                    : 'text-white hover:bg-white/10'
                }`}
              >
                💕 Date Mode
              </button>
              <button
                onClick={() => setMode('friends')}
                className={`px-6 py-2 rounded-lg transition-all ${
                  mode === 'friends'
                    ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                    : 'text-white hover:bg-white/10'
                }`}
              >
                👥 Friends Mode
              </button>
            </div>
          </div>
        </div>

        {/* Generator Section */}
        {!suggestion && (
          <Card className="p-8 bg-white shadow-2xl mb-8">
            <div className="text-center mb-6">
              <Sparkles className="w-16 h-16 mx-auto mb-4 text-purple-500" />
              <h2 className="text-3xl font-bold text-gray-800 mb-2">
                Generate Your Perfect Group Outing
              </h2>
              <p className="text-gray-600">
                Our AI will analyze your friend matches and create personalized activity suggestions
              </p>
            </div>

            <div className="max-w-md mx-auto space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Users className="inline w-4 h-4 mr-1" />
                  Group Size
                </label>
                <select
                  value={groupSize}
                  onChange={(e) => setGroupSize(parseInt(e.target.value))}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                >
                  <option value={3}>3 people (small & intimate)</option>
                  <option value={4}>4 people (balanced)</option>
                  <option value={5}>5 people (social)</option>
                  <option value={6}>6 people (party!)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <MapPin className="inline w-4 h-4 mr-1" />
                  Location (optional)
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g., New York, Los Angeles..."
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <Button
                onClick={generateSuggestion}
                disabled={loading}
                className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white py-6 text-lg"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    AI is creating magic...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-5 w-5" />
                    Generate Group Outing
                  </>
                )}
              </Button>

              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-700 text-sm">{error}</p>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Generated Suggestion */}
        {suggestion && (
          <div className="space-y-6">
            {/* Group Info */}
            <Card className="p-6 bg-white shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-2xl font-bold text-gray-800">Your Suggested Group</h3>
                <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-4 py-2 rounded-full">
                  <span className="font-bold">{suggestion.group.avg_compatibility}% Compatible</span>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                {suggestion.group.members.map((member, idx) => (
                  <div key={`members-${idx}`} className="text-center">
                    <div className="w-20 h-20 mx-auto mb-2 rounded-full bg-gradient-to-br from-purple-200 to-pink-200 flex items-center justify-center overflow-hidden">
                      {member.photo ? (
                        <img src={member.photo} alt={member.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-3xl">👤</span>
                      )}
                    </div>
                    <p className="font-semibold text-sm text-gray-800">{member.name}</p>
                    <p className="text-xs text-purple-600">{member.compatibility_score}% match</p>
                  </div>
                ))}
              </div>

              {suggestion.group.common_interests && suggestion.group.common_interests.length > 0 && (
                <div className="bg-purple-50 rounded-lg p-4">
                  <p className="text-sm font-semibold text-gray-700 mb-2">Common Interests:</p>
                  <div className="flex flex-wrap gap-2">
                    {suggestion.group.common_interests.map((interest, idx) => (
                      <span key={`common_interests-${idx}`} className="bg-white text-purple-700 px-3 py-1 rounded-full text-sm">
                        {interest}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </Card>

            {/* Activity Suggestions */}
            <div>
              <h3 className="text-3xl font-bold text-white mb-4 text-center">
                🎯 AI-Generated Activity Suggestions
              </h3>
              <div className="grid md:grid-cols-3 gap-6">
                {suggestion.activity_suggestions.map((activity, idx) => (
                  <Card key={`activity_suggestions-${idx}`} className="p-6 bg-white shadow-2xl hover:shadow-3xl transition-shadow">
                    <div className="mb-4">
                      <div className="inline-block bg-gradient-to-r from-purple-500 to-pink-500 text-white px-3 py-1 rounded-full text-sm mb-3">
                        {activity.vibe}
                      </div>
                      <h4 className="text-2xl font-bold text-gray-800 mb-2">
                        {activity.name}
                      </h4>
                      <p className="text-gray-600 mb-4">{activity.description}</p>
                    </div>

                    <div className="space-y-3 mb-6">
                      <div className="flex items-start gap-2 text-sm">
                        <Heart className="w-4 h-4 text-pink-500 mt-0.5 flex-shrink-0" />
                        <p className="text-gray-700">
                          <strong>Why it's perfect:</strong> {activity.why_perfect}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 text-sm text-gray-700">
                        <MapPin className="w-4 h-4 text-purple-500" />
                        <span>{activity.venue_type}</span>
                      </div>

                      <div className="flex items-center gap-2 text-sm text-gray-700">
                        <Clock className="w-4 h-4 text-purple-500" />
                        <span>{activity.best_time} • {activity.duration}</span>
                      </div>

                      <div className="flex items-center gap-2 text-sm text-gray-700">
                        <DollarSign className="w-4 h-4 text-purple-500" />
                        <span>{activity.cost_per_person}</span>
                      </div>
                    </div>

                    <Button
                      onClick={() => acceptSuggestion(idx)}
                      disabled={accepting}
                      className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                    >
                      {accepting ? 'Creating Event...' : 'Choose This Activity'}
                    </Button>
                  </Card>
                ))}
              </div>

              <div className="text-center mt-6">
                <Button
                  onClick={() => setSuggestion(null)}
                  variant="outline"
                  className="bg-white/10 text-white border-white/30 hover:bg-white/20"
                >
                  Generate New Suggestion
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Previous Suggestions */}
        {mySuggestions.length > 0 && !suggestion && (
          <div className="mt-12">
            <h3 className="text-3xl font-bold text-white mb-6 text-center">
              📋 Your Previous Suggestions
            </h3>
            <div className="grid md:grid-cols-2 gap-6">
              {mySuggestions.map((sug) => (
                <Card key={sug.suggestion_id} className="p-6 bg-white/10 backdrop-blur-lg border-white/20 text-white">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Users className="w-5 h-5" />
                      <span className="font-semibold">{sug.group_size} people</span>
                    </div>
                    {sug.status === 'accepted' && (
                      <div className="bg-green-500 text-white px-3 py-1 rounded-full text-sm flex items-center gap-1">
                        <CheckCircle className="w-4 h-4" />
                        Accepted
                      </div>
                    )}
                  </div>
                  
                  <p className="text-sm text-gray-300 mb-4">
                    {sug.avg_compatibility}% group compatibility • {sug.activity_suggestions?.length || 0} activities
                  </p>

                  <div className="flex flex-wrap gap-2">
                    {sug.members_info?.slice(0, 4).map((member, idx) => (
                      <div key={`item-${idx}`} className="text-xs bg-white/20 px-2 py-1 rounded">
                        {member.name}
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 text-xs text-gray-400">
                    {new Date(sug.created_at).toLocaleDateString()}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
