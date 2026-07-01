import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Heart, 
  Sparkles, 
  MapPin, 
  DollarSign, 
  Clock, 
  Calendar,
  Star,
  RefreshCw,
  Trash2,
  Share2,
  ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function AIDatePlannerPage() {
  const [step, setStep] = useState(1); // 1: Form, 2: Generating, 3: Result
  const [userId] = useState(() => localStorage.getItem('user_id') || 'demo_user');
  
  // Form state
  const [location, setLocation] = useState('');
  const [selectedInterests, setSelectedInterests] = useState([]);
  const [budget, setBudget] = useState('medium');
  const [dateType, setDateType] = useState('romantic');
  const [duration, setDuration] = useState('half_day');
  const [timeOfDay, setTimeOfDay] = useState('evening');
  
  // Results state
  const [currentPlan, setCurrentPlan] = useState(null);
  const [savedPlans, setSavedPlans] = useState([]);
  const [loading, setLoading] = useState(false);

  const interests = [
    { id: 'food', label: '🍕 Food & Dining', emoji: '🍕' },
    { id: 'adventure', label: '🏔️ Adventure', emoji: '🏔️' },
    { id: 'culture', label: '🎭 Arts & Culture', emoji: '🎭' },
    { id: 'nature', label: '🌳 Nature & Outdoors', emoji: '🌳' },
    { id: 'entertainment', label: '🎬 Entertainment', emoji: '🎬' },
    { id: 'sports', label: '⚽ Sports & Fitness', emoji: '⚽' },
    { id: 'music', label: '🎵 Music & Concerts', emoji: '🎵' },
    { id: 'shopping', label: '🛍️ Shopping', emoji: '🛍️' }
  ];

  useEffect(() => {
    fetchSavedPlans();
  }, []);

  const fetchSavedPlans = async () => {
    try {
      const response = await fetch(`${API_URL}/api/ai-date-planner/plans/${userId}`);
      const data = await response.json();
      if (data.success) {
        setSavedPlans(data.plans);
      }
    } catch (error) {
      // console.error('Failed to fetch saved plans:', error);
    }
  };

  const toggleInterest = (interestId) => {
    setSelectedInterests(prev =>
      prev.includes(interestId)
        ? prev.filter(id => id !== interestId)
        : [...prev, interestId]
    );
  };

  const generatePlan = async () => {
    if (!location || selectedInterests.length === 0) {
      alert('Please fill in location and select at least one interest');
      return;
    }

    setStep(2);
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/ai-date-planner/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          interests: selectedInterests,
          location,
          budget,
          date_type: dateType,
          duration,
          time_of_day: timeOfDay
        })
      });

      const data = await response.json();
      if (data.success) {
        setCurrentPlan(data.plan);
        setStep(3);
        fetchSavedPlans(); // Refresh saved plans
      } else {
        alert('Failed to generate date plan');
        setStep(1);
      }
    } catch (error) {
      // console.error('Error generating plan:', error);
      alert('Failed to generate date plan');
      setStep(1);
    } finally {
      setLoading(false);
    }
  };

  const toggleFavorite = async (planId) => {
    try {
      await fetch(`${API_URL}/api/ai-date-planner/plan/${planId}/favorite`, {
        method: 'POST'
      });
      fetchSavedPlans();
      if (currentPlan?.id === planId) {
        setCurrentPlan({ ...currentPlan, is_favorite: !currentPlan.is_favorite });
      }
    } catch (error) {
      // console.error('Failed to toggle favorite:', error);
    }
  };

  const deletePlan = async (planId) => {
    if (!window.confirm('Are you sure you want to delete this date plan?')) return;

    try {
      await fetch(`${API_URL}/api/ai-date-planner/plan/${planId}`, {
        method: 'DELETE'
      });
      fetchSavedPlans();
      if (currentPlan?.id === planId) {
        setCurrentPlan(null);
        setStep(1);
      }
    } catch (error) {
      // console.error('Failed to delete plan:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-950 via-slate-900 to-purple-950 text-white p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="flex items-center justify-center mb-4">
            <Heart className="w-16 h-16 text-pink-400 mr-4 animate-pulse" />
            <h1 className="text-6xl font-black text-transparent bg-gradient-to-r from-pink-400 via-purple-400 to-blue-400 bg-clip-text">
              AI Date Planner
            </h1>
            <Sparkles className="w-16 h-16 text-blue-400 ml-4 animate-pulse" />
          </div>
          <p className="text-xl text-gray-300">Let AI craft the perfect date experience for you ✨</p>
        </motion.div>

        <AnimatePresence mode="wait">
          {/* Step 1: Form */}
          {step === 1 && (
            <motion.div
              key="form"
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 50 }}
            >
              <Card className="bg-slate-900/90 border-pink-500/30 p-8">
                <h2 className="text-3xl font-bold mb-6 text-center">Tell us about your perfect date 💕</h2>

                {/* Location */}
                <div className="mb-6">
                  <label className="block text-lg font-semibold mb-2 flex items-center">
                    <MapPin className="w-5 h-5 mr-2 text-pink-400" />
                    Location
                  </label>
                  <Input
                    type="text"
                    placeholder="e.g., San Francisco, CA"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="bg-slate-800 border-slate-700 text-white text-lg"
                  />
                </div>

                {/* Interests */}
                <div className="mb-6">
                  <label className="block text-lg font-semibold mb-3">Select Interests (1+)</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {interests.map((interest) => (
                      <Button
                        key={interest.id}
                        onClick={() => toggleInterest(interest.id)}
                        className={`p-4 text-sm font-medium transition-all ${
                          selectedInterests.includes(interest.id)
                            ? 'bg-gradient-to-r from-pink-600 to-purple-600 text-white'
                            : 'bg-slate-800 text-gray-400 hover:bg-slate-700'
                        }`}
                      >
                        {interest.emoji} {interest.label.split(' ')[1]}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Budget */}
                <div className="mb-6">
                  <label className="block text-lg font-semibold mb-3 flex items-center">
                    <DollarSign className="w-5 h-5 mr-2 text-green-400" />
                    Budget
                  </label>
                  <div className="grid grid-cols-4 gap-3">
                    {['low', 'medium', 'high', 'luxury'].map((b) => (
                      <Button
                        key={b}
                        onClick={() => setBudget(b)}
                        className={`capitalize ${
                          budget === b
                            ? 'bg-gradient-to-r from-green-600 to-emerald-600'
                            : 'bg-slate-800 hover:bg-slate-700'
                        }`}
                      >
                        {b}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Date Type */}
                <div className="mb-6">
                  <label className="block text-lg font-semibold mb-3">Date Vibe</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {['first_date', 'romantic', 'fun', 'adventurous'].map((type) => (
                      <Button
                        key={type}
                        onClick={() => setDateType(type)}
                        className={`capitalize ${
                          dateType === type
                            ? 'bg-gradient-to-r from-pink-600 to-rose-600'
                            : 'bg-slate-800 hover:bg-slate-700'
                        }`}
                      >
                        {type.replace('_', ' ')}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Duration & Time */}
                <div className="grid grid-cols-2 gap-6 mb-8">
                  <div>
                    <label className="block text-lg font-semibold mb-3 flex items-center">
                      <Clock className="w-5 h-5 mr-2 text-blue-400" />
                      Duration
                    </label>
                    <div className="space-y-2">
                      {['2_hours', 'half_day', 'full_day'].map((d) => (
                        <Button
                          key={d}
                          onClick={() => setDuration(d)}
                          className={`w-full ${
                            duration === d
                              ? 'bg-gradient-to-r from-blue-600 to-cyan-600'
                              : 'bg-slate-800 hover:bg-slate-700'
                          }`}
                        >
                          {d.replace('_', ' ')}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-lg font-semibold mb-3 flex items-center">
                      <Calendar className="w-5 h-5 mr-2 text-purple-400" />
                      Time
                    </label>
                    <div className="space-y-2">
                      {['morning', 'afternoon', 'evening'].map((t) => (
                        <Button
                          key={t}
                          onClick={() => setTimeOfDay(t)}
                          className={`w-full capitalize ${
                            timeOfDay === t
                              ? 'bg-gradient-to-r from-purple-600 to-indigo-600'
                              : 'bg-slate-800 hover:bg-slate-700'
                          }`}
                        >
                          {t}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Generate Button */}
                <Button
                  onClick={generatePlan}
                  disabled={!location || selectedInterests.length === 0}
                  className="w-full py-6 text-xl font-bold bg-gradient-to-r from-pink-600 via-purple-600 to-blue-600 hover:from-pink-700 hover:via-purple-700 hover:to-blue-700 disabled:opacity-50"
                >
                  <Sparkles className="w-6 h-6 mr-2" />
                  Generate My Perfect Date ✨
                </Button>
              </Card>

              {/* Saved Plans */}
              {savedPlans.length > 0 && (
                <div className="mt-8">
                  <h3 className="text-2xl font-bold mb-4">Your Saved Date Plans 📋</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {savedPlans.slice(0, 4).map((plan) => (
                      <Card
                        key={plan.id}
                        className="bg-slate-900/90 border-cyan-500/30 p-4 hover:border-cyan-500/60 transition-all cursor-pointer"
                        onClick={() => {
                          setCurrentPlan(plan);
                          setStep(3);
                        }}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-bold text-lg">{plan.title}</h4>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFavorite(plan.id);
                            }}
                          >
                            <Star className={`w-5 h-5 ${plan.is_favorite ? 'fill-yellow-400 text-yellow-400' : 'text-gray-400'}`} />
                          </Button>
                        </div>
                        <p className="text-sm text-gray-400 line-clamp-2">{plan.description}</p>
                        <div className="flex justify-between items-center mt-3 text-xs text-gray-500">
                          <span>{plan.estimated_cost}</span>
                          <ChevronRight className="w-4 h-4" />
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* Step 2: Generating */}
          {step === 2 && (
            <motion.div
              key="generating"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="text-center py-20"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="inline-block mb-6"
              >
                <Sparkles className="w-24 h-24 text-pink-400" />
              </motion.div>
              <h2 className="text-4xl font-bold mb-4">Crafting Your Perfect Date... ✨</h2>
              <p className="text-xl text-gray-400">AI is personalizing the experience just for you</p>
            </motion.div>
          )}

          {/* Step 3: Result */}
          {step === 3 && currentPlan && (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -50 }}
            >
              <Card className="bg-slate-900/90 border-pink-500/30 p-8">
                {/* Header */}
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h2 className="text-4xl font-bold mb-2 text-transparent bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text">
                      {currentPlan.title}
                    </h2>
                    <p className="text-lg text-gray-300">{currentPlan.description}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toggleFavorite(currentPlan.id)}
                    >
                      <Star className={`w-5 h-5 ${currentPlan.is_favorite ? 'fill-yellow-400 text-yellow-400' : ''}`} />
                    </Button>
                    <Button size="sm" variant="outline">
                      <Share2 className="w-5 h-5" />
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => deletePlan(currentPlan.id)}>
                      <Trash2 className="w-5 h-5" />
                    </Button>
                  </div>
                </div>

                {/* Cost & Duration */}
                <div className="flex gap-6 mb-8 text-sm">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-green-400" />
                    <span className="font-semibold">{currentPlan.estimated_cost}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-blue-400" />
                    <span className="font-semibold">{currentPlan.duration.replace('_', ' ')}</span>
                  </div>
                </div>

                {/* Activities */}
                <div className="mb-8">
                  <h3 className="text-2xl font-bold mb-4">Itinerary 📍</h3>
                  <div className="space-y-4">
                    {currentPlan.activities.map((activity, index) => (
                      <Card key={`activities-${index}`} className="bg-slate-800/90 border-cyan-500/30 p-5">
                        <div className="flex gap-4">
                          <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-pink-600 to-purple-600 flex items-center justify-center font-bold text-xl">
                            {index + 1}
                          </div>
                          <div className="flex-1">
                            <h4 className="text-xl font-bold mb-1">{activity.name}</h4>
                            <p className="text-gray-400 mb-2">{activity.description}</p>
                            <div className="flex gap-4 text-sm text-gray-500">
                              <span>📍 {activity.location}</span>
                              <span>⏰ {activity.time}</span>
                              <span>💰 {activity.cost_estimate}</span>
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>

                {/* Tips */}
                {currentPlan.tips && currentPlan.tips.length > 0 && (
                  <div className="mb-8">
                    <h3 className="text-2xl font-bold mb-4">Pro Tips 💡</h3>
                    <ul className="space-y-2">
                      {currentPlan.tips.map((tip, index) => (
                        <li key={`tips-${index}`} className="flex items-start gap-3">
                          <Sparkles className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                          <span className="text-gray-300">{tip}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-4">
                  <Button
                    onClick={() => setStep(1)}
                    variant="outline"
                    className="flex-1 border-cyan-500/50 hover:border-cyan-500"
                  >
                    Create Another Date
                  </Button>
                  <Button
                    onClick={generatePlan}
                    className="flex-1 bg-gradient-to-r from-pink-600 to-purple-600"
                  >
                    <RefreshCw className="w-5 h-5 mr-2" />
                    Generate Different Ideas
                  </Button>
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
