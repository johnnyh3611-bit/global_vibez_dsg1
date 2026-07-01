
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Heart, X, Sparkles, ArrowLeft, Award, Users, Crown, Coins } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

export default function FindFriends() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [swiping, setSwiping] = useState(false);
  const [showMatch, setShowMatch] = useState(false);
  const [matchData, setMatchData] = useState(null);
  const [needsQuiz, setNeedsQuiz] = useState(false);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [swipesRemaining, setSwipesRemaining] = useState(null);

  useEffect(() => {
    fetchPotentialFriends();
  }, []);

  const fetchPotentialFriends = async () => {
    try {
      const response = await fetch(`${API}/api/matching/friends/discover?limit=20`, {
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (errorData.detail && errorData.detail.includes('Quiz')) {
          setNeedsQuiz(true);
        }
        throw new Error(errorData.detail || 'Failed to load matches');
      }

      const data = await response.json();
      setUsers(data);
    } catch (err) {
      // console.error('Error fetching friends:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSwipe = async (action) => {
    if (swiping || currentIndex >= users.length) return;

    setSwiping(true);
    const currentUser = users[currentIndex];

    try {
      const response = await fetch(`${API}/api/matching/friends/swipe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        
        body: JSON.stringify({
          target_user_id: currentUser.user_id,
          action: action
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        
        // Check if it's a swipe limit error
        if (errorData.detail && errorData.detail.includes('daily swipe limit')) {
          setShowLimitModal(true);
          setSwiping(false);
          return;
        }
        
        throw new Error('Swipe failed');
      }

      const result = await response.json();

      // Update swipes remaining if provided
      if (result.swipes_remaining !== undefined) {
        setSwipesRemaining(result.swipes_remaining);
      }

      if (result.is_match) {
        setMatchData(result.match_data);
        setShowMatch(true);
      } else {
        setCurrentIndex(currentIndex + 1);
      }
    } catch (err) {
      // console.error('Error swiping:', err);
    } finally {
      setSwiping(false);
    }
  };

  const handleMatchClose = () => {
    setShowMatch(false);
    setCurrentIndex(currentIndex + 1);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-purple-900 via-pink-900 to-purple-900">
        <div className="text-white text-2xl">Finding your perfect friends...</div>
      </div>
    );
  }

  if (needsQuiz) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-purple-900 via-pink-900 to-purple-900 p-6">
        <Card className="p-8 max-w-lg text-center bg-white shadow-2xl">
          <Sparkles className="w-16 h-16 mx-auto mb-4 text-purple-500" />
          <h2 className="text-3xl font-bold text-gray-800 mb-4">
            Take the Friend Compatibility Quiz!
          </h2>
          <p className="text-gray-600 mb-6">
            To find your perfect friend matches with high compatibility scores, 
            please complete the Friend Compatibility Quiz first.
          </p>
          <div className="flex gap-4 justify-center">
            <Button
              onClick={() => navigate('/dashboard')}
              variant="outline"
            >
              Back to Dashboard
            </Button>
            <Button
              onClick={() => navigate('/quiz/friends')}
              className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
            >
              Take Quiz Now
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (currentIndex >= users.length) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-purple-900 via-pink-900 to-purple-900 p-6">
        <Card className="p-8 max-w-lg text-center bg-white shadow-2xl">
          <Users className="w-16 h-16 mx-auto mb-4 text-purple-500" />
          <h2 className="text-3xl font-bold text-gray-800 mb-4">
            No More Friends to Discover
          </h2>
          <p className="text-gray-600 mb-6">
            You've seen all available friend matches for now. Check back later for new people!
          </p>
          <div className="flex gap-4 justify-center">
            <Button
              onClick={() => navigate('/dashboard')}
              variant="outline"
            >
              Dashboard
            </Button>
            <Button
              onClick={() => navigate('/matches')}
              className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
            >
              View Friend Matches
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const currentUser = users[currentIndex];
  const compatibilityScore = currentUser.compatibility_score || 0;

  // Match Modal
  if (showMatch && matchData) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-purple-900 via-pink-900 to-purple-900 p-6">
        <Card className="p-12 max-w-xl text-center bg-white shadow-2xl animate-bounce-in">
          <Award className="w-24 h-24 mx-auto mb-6 text-yellow-500 animate-pulse" />
          <h1 className="text-5xl font-bold text-gray-800 mb-4">
            It's a Friend Match! 🎉
          </h1>
          <p className="text-2xl text-purple-600 mb-6">
            {compatibilityScore}% Compatible!
          </p>
          <p className="text-gray-600 mb-8">
            You both liked each other! Start chatting and plan your first hangout.
          </p>
          <Button
            onClick={handleMatchClose}
            className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-xl py-6"
          >
            Keep Swiping
          </Button>
        </Card>
      </div>
    );
  }

  // Swipe Limit Modal
  if (showLimitModal) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-purple-900 via-pink-900 to-purple-900 p-6">
        <Card className="p-12 max-w-xl text-center bg-white shadow-2xl">
          <Crown className="w-24 h-24 mx-auto mb-6 text-yellow-500" />
          <h1 className="text-4xl font-bold text-gray-800 mb-4">
            Daily Swipe Limit Reached
          </h1>
          <p className="text-xl text-gray-600 mb-6">
            You've used all your daily swipes as a free user.
          </p>
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Upgrade to Premium for:</h3>
            <ul className="text-left space-y-2 text-gray-700">
              <li className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-500" />
                <span>Unlimited swipes every day</span>
              </li>
              <li className="flex items-center gap-2">
                <Heart className="w-5 h-5 text-pink-500" />
                <span>Priority in match suggestions</span>
              </li>
              <li className="flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-500" />
                <span>See who liked you first</span>
              </li>
            </ul>
          </div>
          <div className="flex gap-4">
            <Button
              onClick={() => navigate('/dashboard')}
              variant="outline"
              className="flex-1"
            >
              Back to Dashboard
            </Button>
            <Button
              onClick={() => navigate('/pricing')}
              className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold"
            >
              <Crown className="w-5 h-5 mr-2" />
              Upgrade Now
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-pink-900 to-purple-900 p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <Button
            onClick={() => navigate('/dashboard')}
            variant="ghost"
            className="text-white hover:bg-white/10"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <h1 className="text-3xl font-bold text-white">Find Friends</h1>
          <div className="w-24"></div>
        </div>

        {/* Progress */}
        <div className="mb-6 flex items-center justify-between">
          <p className="text-white text-sm">
            {currentIndex + 1} / {users.length}
          </p>
          {swipesRemaining !== null && (
            <div className="flex items-center gap-2 bg-white/10 px-3 py-1 rounded-full">
              <Heart className="w-4 h-4 text-pink-300" />
              <span className="text-white text-sm font-semibold">
                {swipesRemaining} swipes left today
              </span>
            </div>
          )}
        </div>

        {/* Profile Card */}
        <Card className="overflow-hidden shadow-2xl bg-white mb-6">
          {/* Compatibility Badge */}
          <div className="absolute top-4 right-4 z-10 bg-gradient-to-r from-purple-500 to-pink-500 text-white px-4 py-2 rounded-full shadow-lg">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              <span className="font-bold text-lg">{compatibilityScore}% Match</span>
            </div>
          </div>

          {/* Profile Photo */}
          <div className="relative h-96 bg-gradient-to-br from-purple-200 to-pink-200">
            {currentUser.photos && currentUser.photos[0] ? (
              <img
                src={currentUser.photos[0]}
                alt={currentUser.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="flex items-center justify-center h-full text-6xl">
                👤
              </div>
            )}
          </div>

          {/* Profile Info */}
          <div className="p-6">
            <h2 className="text-3xl font-bold text-gray-800 mb-2">
              {currentUser.name}, {currentUser.age}
            </h2>
            <p className="text-gray-600 mb-4">{currentUser.location}</p>
            
            {currentUser.bio && (
              <p className="text-gray-700 mb-4">{currentUser.bio}</p>
            )}

            {/* Profile Video */}
            {currentUser.looking_for_video_friends && (
              <div className="mb-4">
                <p className="text-sm font-semibold text-gray-700 mb-2">
                  What I'm looking for in friends:
                </p>
                <video
                  src={`${API}${currentUser.looking_for_video_friends}`}
                  controls
                  className="w-full rounded-lg"
                />
              </div>
            )}

            {/* Interests */}
            {currentUser.interests && currentUser.interests.length > 0 && (
              <div className="mb-4">
                <p className="text-sm font-semibold text-gray-700 mb-2">Interests:</p>
                <div className="flex flex-wrap gap-2">
                  {currentUser.interests.map((interest, idx) => (
                    <span
                      key={`interests-${idx}`}
                      className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-sm"
                    >
                      {interest}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Compatibility Breakdown */}
            {currentUser.compatibility_breakdown && (
              <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg p-4">
                <p className="text-sm font-semibold text-gray-700 mb-3">
                  Compatibility Breakdown:
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {(Object.entries(currentUser.compatibility_breakdown) as Array<[string, number]>).map(([category, score]) => (
                    <div key={category} className="flex justify-between items-center">
                      <span className="text-sm text-gray-600 capitalize">
                        {category.replace('_', ' ')}:
                      </span>
                      <span className="font-bold text-purple-600">{score}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Action Buttons */}
        <div className="flex justify-center gap-8">
          <button
            onClick={() => handleSwipe('dislike')}
            disabled={swiping}
            className="w-20 h-20 rounded-full bg-white shadow-lg flex items-center justify-center hover:scale-110 transition-transform disabled:opacity-50"
          >
            <X className="w-10 h-10 text-red-500" />
          </button>
          <button
            onClick={() => handleSwipe('like')}
            disabled={swiping}
            className="w-20 h-20 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 shadow-lg flex items-center justify-center hover:scale-110 transition-transform disabled:opacity-50"
          >
            <Heart className="w-10 h-10 text-white fill-current" />
          </button>
        </div>
      </div>
    </div>
  );
}
