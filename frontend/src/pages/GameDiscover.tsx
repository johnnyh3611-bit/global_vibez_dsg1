import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Heart, X, Zap, Star, Trophy, Target, Camera } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const TRIVIA_QUESTIONS = [
  {
    category: "Adventure",
    question: "What's your dream vacation?",
    options: ["Beach Paradise 🏖️", "Mountain Hiking ⛰️", "City Explorer 🏙️", "Safari Adventure 🦁"]
  },
  {
    category: "Food",
    question: "Perfect date meal?",
    options: ["Fancy Restaurant 🍽️", "Street Food 🌮", "Home Cooked 🍝", "Dessert Only 🍰"]
  },
  {
    category: "Personality",
    question: "On a Friday night, you're...",
    options: ["Party Animal 🎉", "Netflix Chiller 📺", "Gym Warrior 💪", "Book Worm 📚"]
  },
  {
    category: "Romance",
    question: "Ideal first date?",
    options: ["Coffee & Talk ☕", "Adventure Activity 🎢", "Movie Night 🎬", "Cooking Together 👨‍🍳"]
  },
  {
    category: "Lifestyle",
    question: "Morning person or night owl?",
    options: ["Early Bird 🌅", "Night Owl 🌙", "Flexible 🔄", "Always Tired 😴"]
  },
  {
    category: "Fun",
    question: "Superpower choice?",
    options: ["Flying ✈️", "Invisibility 👻", "Time Travel ⏰", "Mind Reading 🧠"]
  },
  {
    category: "Music",
    question: "Music vibe?",
    options: ["Pop Hits 🎵", "Rock On 🎸", "Hip Hop 🎤", "Classical 🎻"]
  },
  {
    category: "Travel",
    question: "Travel style?",
    options: ["Luxury Resort 🏨", "Backpacking 🎒", "Road Trip 🚗", "Cruise Ship 🚢"]
  }
];

const GameDiscover = () => {
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showTrivia, setShowTrivia] = useState(false);
  const [currentTrivia, setCurrentTrivia] = useState(null);
  const [triviaAnswer, setTriviaAnswer] = useState(null);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [swipeDirection, setSwipeDirection] = useState(null);
  const [powerUps, setPowerUps] = useState({
    hints: 3,
    rewinds: 2,
    superLikes: 5
  });

  useEffect(() => {
    loadProfiles();
  }, []);

  const loadProfiles = async () => {
    try {
      const response = await fetch(`${API}/api/discover`, {
        
      });
      
      if (response.ok) {
        const data = await response.json();
        // Add trivia questions to each profile
        const profilesWithTrivia = (data.profiles || []).map(profile => ({
          ...profile,
          triviaQuestions: TRIVIA_QUESTIONS.sort(() => Math.random() - 0.5).slice(0, 3)
        }));
        setProfiles(profilesWithTrivia);
      }
    } catch (error) {
      // console.error('Error loading profiles:', error);
    } finally {
      setLoading(false);
    }
  };

  const currentProfile = profiles[currentIndex];

  const handleSwipe = async (action) => {
    if (animating || !currentProfile) return;

    setAnimating(true);
    setSwipeDirection(action);

    // Show trivia before final decision
    if (!showTrivia && action === 'like') {
      setTimeout(() => {
        setShowTrivia(true);
        setCurrentTrivia(currentProfile.triviaQuestions[0]);
        setAnimating(false);
        setSwipeDirection(null);
      }, 300);
      return;
    }

    try {
      await fetch(`${API}/api/swipe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        
        body: JSON.stringify({
          swiped_user_id: currentProfile.user_id,
          action: action
        }),
      });

      // Update score
      if (action === 'like') {
        setScore(score + 10);
        setStreak(streak + 1);
      }

      setTimeout(() => {
        setCurrentIndex(currentIndex + 1);
        setShowTrivia(false);
        setTriviaAnswer(null);
        setAnimating(false);
        setSwipeDirection(null);
        
        if (currentIndex + 1 >= profiles.length) {
          loadProfiles();
          setCurrentIndex(0);
        }
      }, 500);
    } catch (error) {
      // console.error('Error:', error);
      setAnimating(false);
    }
  };

  const handleTriviaAnswer = (answer) => {
    setTriviaAnswer(answer);
    
    // Bonus points for answering trivia
    setScore(score + 5);
    
    setTimeout(() => {
      handleSwipe('like');
    }, 1000);
  };

  const activatePowerUp = (type) => {
    if (powerUps[type] > 0) {
      setPowerUps({ ...powerUps, [type]: powerUps[type] - 1 });
      
      if (type === 'rewinds' && currentIndex > 0) {
        setCurrentIndex(currentIndex - 1);
        setShowTrivia(false);
      }
      
      if (type === 'superLikes') {
        setScore(score + 50);
        handleSwipe('super_like');
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-rose-600 via-red-700 to-black">
        <div className="text-white text-2xl">Loading profiles...</div>
      </div>
    );
  }

  if (!currentProfile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-rose-600 via-red-700 to-black text-white p-8">
        <Trophy className="w-24 h-24 mb-6 text-yellow-400" />
        <h2 className="text-4xl font-bold mb-4">Great Job!</h2>
        <p className="text-xl mb-2">Final Score: {score} points</p>
        <p className="text-lg mb-6">Streak: {streak} 🔥</p>
        <Button 
          onClick={() => {
            loadProfiles();
            setCurrentIndex(0);
            setScore(0);
            setStreak(0);
          }}
          className="bg-white text-rose-600 hover:bg-rose-50"
        >
          Play Again
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-600 via-red-700 to-black p-4">
      {/* Score Header */}
      <div className="container mx-auto max-w-2xl mb-4">
        <div className="flex justify-between items-center bg-black/30 backdrop-blur-md rounded-2xl p-4 border border-rose-500/30">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Star className="w-6 h-6 text-yellow-400" />
              <span className="text-white font-bold text-xl">{score}</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="w-6 h-6 text-orange-400" />
              <span className="text-white font-bold">{streak}🔥</span>
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => activatePowerUp('hints')}
              disabled={powerUps.hints === 0}
              className="bg-blue-500 hover:bg-blue-600 text-white"
            >
              💡 {powerUps.hints}
            </Button>
            <Button
              size="sm"
              onClick={() => activatePowerUp('rewinds')}
              disabled={powerUps.rewinds === 0}
              className="bg-purple-500 hover:bg-purple-600 text-white"
            >
              ⏮️ {powerUps.rewinds}
            </Button>
            <Button
              size="sm"
              onClick={() => activatePowerUp('superLikes')}
              disabled={powerUps.superLikes === 0}
              className="bg-rose-500 hover:bg-rose-600 text-white"
            >
              ⭐ {powerUps.superLikes}
            </Button>
          </div>
        </div>
      </div>

      {/* Main Card */}
      <div className="container mx-auto max-w-2xl">
        <Card 
          className={`relative overflow-hidden border-4 border-rose-500/50 shadow-2xl transition-all duration-500 ${
            swipeDirection === 'like' ? 'rotate-6 translate-x-96 opacity-0' : ''
          } ${
            swipeDirection === 'dislike' ? '-rotate-6 -translate-x-96 opacity-0' : ''
          }`}
          style={{
            background: 'linear-gradient(135deg, rgba(225, 29, 72, 0.1) 0%, rgba(0, 0, 0, 0.8) 100%)',
          }}
        >
          {/* Profile Image with Overlay */}
          <div className="relative h-[600px]">
            <img
              src={currentProfile.picture || '/default-avatar.png'}
              alt={currentProfile.name}
              className="w-full h-full object-cover"
            />
            
            {/* Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
            
            {/* Profile Info Overlay */}
            <div className="absolute bottom-0 left-0 right-0 p-8 text-white">
              <div className="flex items-center gap-3 mb-3">
                <h2 className="text-4xl font-bold">{currentProfile.name}</h2>
                <span className="text-2xl">{currentProfile.age}</span>
              </div>
              
              {currentProfile.bio && (
                <p className="text-lg mb-4 line-clamp-2">{currentProfile.bio}</p>
              )}
              
              {currentProfile.preferences?.interests && (
                <div className="flex flex-wrap gap-2">
                  {currentProfile.preferences.interests.slice(0, 5).map((interest, idx) => (
                    <span
                      key={`item-${idx}`}
                      className="px-3 py-1 bg-rose-500/80 backdrop-blur-sm rounded-full text-sm"
                    >
                      {interest}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Photo Counter */}
            <div className="absolute top-4 right-4 bg-black/50 backdrop-blur-md px-4 py-2 rounded-full">
              <div className="flex items-center gap-2 text-white">
                <Camera className="w-4 h-4" />
                <span className="text-sm font-semibold">1 of 3</span>
              </div>
            </div>
          </div>

          {/* Trivia Section */}
          {showTrivia && currentTrivia && (
            <div className="absolute inset-0 bg-black/90 backdrop-blur-lg flex items-center justify-center p-8 animate-fade-in">
              <div className="max-w-lg w-full">
                <div className="text-center mb-8">
                  <Target className="w-16 h-16 mx-auto mb-4 text-rose-400" />
                  <h3 className="text-2xl font-bold text-white mb-2">Quick Question!</h3>
                  <p className="text-rose-300">{currentTrivia.category}</p>
                </div>

                <div className="bg-gradient-to-br from-rose-500/20 to-black/40 backdrop-blur-md rounded-2xl p-6 mb-6 border border-rose-500/30">
                  <p className="text-xl text-white font-semibold text-center">
                    {currentTrivia.question}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {currentTrivia.options.map((option, idx) => (
                    <button
                      key={`options-${idx}`}
                      onClick={() => handleTriviaAnswer(option)}
                      disabled={triviaAnswer !== null}
                      className={`p-4 rounded-xl text-white font-semibold transition-all duration-300 ${
                        triviaAnswer === option
                          ? 'bg-green-500 scale-105 shadow-lg'
                          : 'bg-gradient-to-br from-rose-500/30 to-black/50 hover:from-rose-500/50 hover:scale-105'
                      } border border-white/20`}
                    >
                      {option}
                    </button>
                  ))}
                </div>

                <p className="text-center text-rose-300 text-sm mt-4">
                  Answer to continue • +5 points
                </p>
              </div>
            </div>
          )}
        </Card>

        {/* Action Buttons */}
        <div className="flex justify-center items-center gap-6 mt-8">
          <button
            onClick={() => handleSwipe('dislike')}
            disabled={animating}
            className="w-20 h-20 rounded-full bg-gradient-to-br from-gray-600 to-gray-800 hover:from-gray-700 hover:to-gray-900 flex items-center justify-center shadow-2xl transform hover:scale-110 transition-all duration-300 border-4 border-white/20 disabled:opacity-50"
          >
            <X className="w-10 h-10 text-white" />
          </button>

          <button
            onClick={() => activatePowerUp('superLikes')}
            disabled={animating || powerUps.superLikes === 0}
            className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800 flex items-center justify-center shadow-2xl transform hover:scale-110 transition-all duration-300 border-4 border-white/20 disabled:opacity-50"
          >
            <Star className="w-8 h-8 text-white" />
          </button>

          <button
            onClick={() => handleSwipe('like')}
            disabled={animating}
            className="w-20 h-20 rounded-full bg-gradient-to-br from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 flex items-center justify-center shadow-2xl transform hover:scale-110 transition-all duration-300 border-4 border-white/20 disabled:opacity-50"
          >
            <Heart className="w-10 h-10 text-white" fill="currentColor" />
          </button>

          <button
            onClick={() => activatePowerUp('rewinds')}
            disabled={animating || powerUps.rewinds === 0 || currentIndex === 0}
            className="w-16 h-16 rounded-full bg-gradient-to-br from-yellow-500 to-orange-600 hover:from-yellow-600 hover:to-orange-700 flex items-center justify-center shadow-2xl transform hover:scale-110 transition-all duration-300 border-4 border-white/20 disabled:opacity-50"
          >
            <Zap className="w-8 h-8 text-white" />
          </button>
        </div>

        {/* Instructions */}
        <div className="mt-8 text-center">
          <div className="inline-block bg-black/30 backdrop-blur-md rounded-full px-6 py-3 border border-rose-500/30">
            <p className="text-white text-sm">
              ❤️ Like to see trivia • ❌ Pass • ⭐ Super Like • ⏮️ Rewind
            </p>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};

export default GameDiscover;
