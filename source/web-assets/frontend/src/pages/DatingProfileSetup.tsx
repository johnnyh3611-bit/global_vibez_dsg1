import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  Heart, Camera, MapPin, Sparkles, Gamepad2, 
  Target, Users, Check, Upload, X, Loader2 
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const INTERESTS_OPTIONS = [
  'Gaming', 'Movies', 'Music', 'Sports', 'Travel',
  'Cooking', 'Reading', 'Art', 'Fitness', 'Photography',
  'Dancing', 'Hiking', 'Anime', 'Technology', 'Fashion'
];

const GAME_OPTIONS = [
  'UNO', 'Poker', 'Chess', 'Checkers', 'Hearts',
  'Blackjack', 'Go Fish', 'Crazy Eights', 'Tic-Tac-Toe',
  'Connect 4', 'Reversi'
];

const PERSONALITY_TRAITS = [
  'Adventurous', 'Creative', 'Funny', 'Intelligent', 'Kind',
  'Outgoing', 'Romantic', 'Spontaneous', 'Ambitious', 'Chill',
  'Loyal', 'Honest', 'Caring', 'Confident', 'Mysterious'
];

const GAMING_STYLES = [
  { value: 'competitive', label: 'Competitive 🏆', desc: 'I play to win' },
  { value: 'casual', label: 'Casual 🎮', desc: 'Just for fun' },
  { value: 'strategic', label: 'Strategic 🧠', desc: 'I love planning moves' },
  { value: 'social', label: 'Social 💬', desc: 'Games are about connection' }
];

const RELATIONSHIP_GOALS = [
  { value: 'casual', label: 'Casual Dating', emoji: '✨' },
  { value: 'serious', label: 'Serious Relationship', emoji: '💕' },
  { value: 'marriage', label: 'Marriage', emoji: '💍' },
  { value: 'friends', label: 'Just Friends', emoji: '🤝' }
];

export function DatingProfileSetup() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  interface ProfileFormData {
    bio: string;
    age: string;
    gender: string;
    looking_for: string;
    location: string;
    interests: string[];
    favorite_games: string[];
    personality_traits: string[];
    gaming_style: string;
    relationship_goals: string;
    photos: string[];
  }

  const [formData, setFormData] = useState<ProfileFormData>({
    bio: '',
    age: '',
    gender: '',
    looking_for: '',
    location: '',
    interests: [],
    favorite_games: [],
    personality_traits: [],
    gaming_style: '',
    relationship_goals: '',
    photos: []
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    loadExistingProfile();
  }, []);

  const loadExistingProfile = async () => {
    try {
      const response = await fetch(`${API_URL}/api/dating/profile/me`, {
      });

      if (response.ok) {
        const data = await response.json();
        if (data.is_complete && data.profile) {
          // Pre-fill form with existing data
          setFormData({
            bio: data.profile.bio || '',
            age: data.profile.age || '',
            gender: data.profile.gender || '',
            looking_for: data.profile.looking_for || '',
            location: data.profile.location || '',
            interests: data.profile.interests || [],
            favorite_games: data.profile.favorite_games || [],
            personality_traits: data.profile.personality_traits || [],
            gaming_style: data.profile.gaming_style || '',
            relationship_goals: data.profile.relationship_goals || '',
            photos: data.profile.photos || []
          });
        }
      }
    } catch (error) {
      // console.error('Failed to load profile:', error);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setUploadingPhoto(true);
    setUploadProgress(0);

    try {
      const uploadedUrls: string[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i] as File;
        const uploadBody = new FormData();
        uploadBody.append('file', file);

        const response = await fetch(`${API_URL}/api/uploads/dating-photo`, {
          method: 'POST',
          
          headers: {
          },
          body: uploadBody
        });

        if (response.ok) {
          const data = await response.json();
          uploadedUrls.push(data.file_url);
          setUploadProgress(((i + 1) / files.length) * 100);
        }
      }

      setFormData(prev => ({
        ...prev,
        photos: [...prev.photos, ...uploadedUrls]
      }));
    } catch (error) {
      // console.error('Upload failed:', error);
      alert('Failed to upload photos. Please try again.');
    } finally {
      setUploadingPhoto(false);
      setUploadProgress(0);
    }
  };

  const removePhoto = (index) => {
    setFormData(prev => ({
      ...prev,
      photos: prev.photos.filter((_, i) => i !== index)
    }));
  };

  const toggleSelection = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].includes(value)
        ? prev[field].filter(item => item !== value)
        : [...prev[field], value]
    }));
  };

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};

    if (step === 1) {
      if (!formData.bio || formData.bio.length < 20) {
        newErrors.bio = 'Bio must be at least 20 characters';
      }
      const ageNum = Number(formData.age);
      if (!formData.age || ageNum < 18 || ageNum > 99) {
        newErrors.age = 'Age must be between 18 and 99';
      }
      if (!formData.gender) {
        newErrors.gender = 'Please select your gender';
      }
      if (!formData.looking_for) {
        newErrors.looking_for = 'Please select who you\'re looking for';
      }
    }

    if (step === 2) {
      if (formData.interests.length === 0) {
        newErrors.interests = 'Select at least one interest';
      }
      if (formData.favorite_games.length === 0) {
        newErrors.favorite_games = 'Select at least one favorite game';
      }
    }

    if (step === 3) {
      if (formData.personality_traits.length === 0) {
        newErrors.personality_traits = 'Select at least 3 personality traits';
      }
      if (!formData.gaming_style) {
        newErrors.gaming_style = 'Select your gaming style';
      }
      if (!formData.relationship_goals) {
        newErrors.relationship_goals = 'Select your relationship goals';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      if (currentStep < 4) {
        setCurrentStep(currentStep + 1);
      } else {
        handleSubmit();
      }
    }
  };

  const handleSubmit = async () => {
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/dating/profile/update`, {
        method: 'POST',
        
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...formData,
          age: parseInt(formData.age)
        })
      });

      if (response.ok) {
        navigate('/dating/discover');
      } else {
        alert('Failed to save profile. Please try again.');
      }
    } catch (error) {
      // console.error('Failed to save profile:', error);
      alert('Failed to save profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#080C16] via-[#0F1628] to-[#080C16] p-4 flex items-center justify-center">
      <div className="w-full max-w-3xl">
        {/* Header */}
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="text-center mb-8"
        >
          <h1 className="text-4xl md:text-5xl font-black text-transparent bg-gradient-to-r from-fuchsia-400 via-pink-400 to-cyan-400 bg-clip-text mb-2">
            💕 Create Your Dating Profile
          </h1>
          <p className="text-white/60">Step {currentStep} of 4</p>
        </motion.div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            {[1, 2, 3, 4].map((step) => (
              <div
                key={step}
                className={`w-1/4 h-2 rounded-full mx-1 transition-all ${
                  step <= currentStep
                    ? 'bg-gradient-to-r from-fuchsia-500 to-pink-500'
                    : 'bg-white/10'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Form Container */}
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="bg-black/60 backdrop-blur-xl rounded-3xl border-2 border-fuchsia-500/30 p-8"
        >
          {/* Step 1: Basic Info */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-black text-white mb-4 flex items-center gap-2">
                <Heart className="w-6 h-6 text-pink-500" />
                Basic Information
              </h2>

              {/* Bio */}
              <div>
                <label className="block text-white font-bold mb-2">Tell us about yourself *</label>
                <textarea
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  placeholder="I love gaming and meeting new people..."
                  className="w-full px-4 py-3 bg-white/5 border-2 border-white/10 rounded-xl text-white placeholder-white/40 focus:border-fuchsia-500 outline-none resize-none"
                  rows={4}
                />
                {errors.bio && <p className="text-red-400 text-sm mt-1">{errors.bio}</p>}
              </div>

              {/* Age */}
              <div>
                <label className="block text-white font-bold mb-2">Age *</label>
                <input
                  type="number"
                  value={formData.age}
                  onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                  placeholder="25"
                  className="w-full px-4 py-3 bg-white/5 border-2 border-white/10 rounded-xl text-white placeholder-white/40 focus:border-fuchsia-500 outline-none"
                />
                {errors.age && <p className="text-red-400 text-sm mt-1">{errors.age}</p>}
              </div>

              {/* Gender & Looking For */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-white font-bold mb-2">Gender *</label>
                  <select
                    value={formData.gender}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                    className="w-full px-4 py-3 bg-white/5 border-2 border-white/10 rounded-xl text-white focus:border-fuchsia-500 outline-none"
                  >
                    <option value="">Select</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="non-binary">Non-Binary</option>
                    <option value="other">Other</option>
                  </select>
                  {errors.gender && <p className="text-red-400 text-sm mt-1">{errors.gender}</p>}
                </div>

                <div>
                  <label className="block text-white font-bold mb-2">Looking For *</label>
                  <select
                    value={formData.looking_for}
                    onChange={(e) => setFormData({ ...formData, looking_for: e.target.value })}
                    className="w-full px-4 py-3 bg-white/5 border-2 border-white/10 rounded-xl text-white focus:border-fuchsia-500 outline-none"
                  >
                    <option value="">Select</option>
                    <option value="male">Men</option>
                    <option value="female">Women</option>
                    <option value="everyone">Everyone</option>
                  </select>
                  {errors.looking_for && <p className="text-red-400 text-sm mt-1">{errors.looking_for}</p>}
                </div>
              </div>

              {/* Location */}
              <div>
                <label className="block text-white font-bold mb-2 flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Location (Optional)
                </label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="New York, USA"
                  className="w-full px-4 py-3 bg-white/5 border-2 border-white/10 rounded-xl text-white placeholder-white/40 focus:border-fuchsia-500 outline-none"
                />
              </div>
            </div>
          )}

          {/* Step 2: Interests & Games */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-black text-white mb-4 flex items-center gap-2">
                <Sparkles className="w-6 h-6 text-cyan-500" />
                Interests & Favorite Games
              </h2>

              {/* Interests */}
              <div>
                <label className="block text-white font-bold mb-3">Your Interests *</label>
                <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                  {INTERESTS_OPTIONS.map((interest) => (
                    <motion.button
                      key={interest}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => toggleSelection('interests', interest)}
                      className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                        formData.interests.includes(interest)
                          ? 'bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white border-2 border-white/30'
                          : 'bg-white/5 text-white/60 border-2 border-white/10 hover:border-white/30'
                      }`}
                    >
                      {interest}
                    </motion.button>
                  ))}
                </div>
                {errors.interests && <p className="text-red-400 text-sm mt-2">{errors.interests}</p>}
              </div>

              {/* Favorite Games */}
              <div>
                <label className="block text-white font-bold mb-3 flex items-center gap-2">
                  <Gamepad2 className="w-5 h-5 text-cyan-400" />
                  Favorite Games *
                </label>
                <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                  {GAME_OPTIONS.map((game) => (
                    <motion.button
                      key={game}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => toggleSelection('favorite_games', game)}
                      className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                        formData.favorite_games.includes(game)
                          ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white border-2 border-white/30'
                          : 'bg-white/5 text-white/60 border-2 border-white/10 hover:border-white/30'
                      }`}
                    >
                      {game}
                    </motion.button>
                  ))}
                </div>
                {errors.favorite_games && <p className="text-red-400 text-sm mt-2">{errors.favorite_games}</p>}
              </div>
            </div>
          )}

          {/* Step 3: Personality & Goals */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-black text-white mb-4 flex items-center gap-2">
                <Target className="w-6 h-6 text-purple-500" />
                Personality & Relationship Goals
              </h2>

              {/* Personality Traits */}
              <div>
                <label className="block text-white font-bold mb-3">Your Personality Traits * (Select at least 3)</label>
                <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                  {PERSONALITY_TRAITS.map((trait) => (
                    <motion.button
                      key={trait}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => toggleSelection('personality_traits', trait)}
                      className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                        formData.personality_traits.includes(trait)
                          ? 'bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white border-2 border-white/30'
                          : 'bg-white/5 text-white/60 border-2 border-white/10 hover:border-white/30'
                      }`}
                    >
                      {trait}
                    </motion.button>
                  ))}
                </div>
                {errors.personality_traits && <p className="text-red-400 text-sm mt-2">{errors.personality_traits}</p>}
              </div>

              {/* Gaming Style */}
              <div>
                <label className="block text-white font-bold mb-3">Gaming Style *</label>
                <div className="space-y-3">
                  {GAMING_STYLES.map((style) => (
                    <motion.button
                      key={style.value}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setFormData({ ...formData, gaming_style: style.value })}
                      className={`w-full px-6 py-4 rounded-xl text-left transition-all ${
                        formData.gaming_style === style.value
                          ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white border-2 border-white/30'
                          : 'bg-white/5 text-white border-2 border-white/10 hover:border-white/30'
                      }`}
                    >
                      <div className="font-bold mb-1">{style.label}</div>
                      <div className="text-sm opacity-80">{style.desc}</div>
                    </motion.button>
                  ))}
                </div>
                {errors.gaming_style && <p className="text-red-400 text-sm mt-2">{errors.gaming_style}</p>}
              </div>

              {/* Relationship Goals */}
              <div>
                <label className="block text-white font-bold mb-3">Relationship Goals *</label>
                <div className="grid grid-cols-2 gap-4">
                  {RELATIONSHIP_GOALS.map((goal) => (
                    <motion.button
                      key={goal.value}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setFormData({ ...formData, relationship_goals: goal.value })}
                      className={`px-6 py-4 rounded-xl font-bold transition-all ${
                        formData.relationship_goals === goal.value
                          ? 'bg-gradient-to-r from-pink-600 to-fuchsia-600 text-white border-2 border-white/30'
                          : 'bg-white/5 text-white border-2 border-white/10 hover:border-white/30'
                      }`}
                    >
                      <div className="text-2xl mb-2">{goal.emoji}</div>
                      <div className="text-sm">{goal.label}</div>
                    </motion.button>
                  ))}
                </div>
                {errors.relationship_goals && <p className="text-red-400 text-sm mt-2">{errors.relationship_goals}</p>}
              </div>
            </div>
          )}

          {/* Step 4: Photos */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-black text-white mb-4 flex items-center gap-2">
                <Camera className="w-6 h-6 text-pink-500" />
                Add Your Photos
              </h2>

              <p className="text-white/60">Upload photos or videos to make your profile stand out!</p>

              {/* Photo Grid */}
              <div className="grid grid-cols-3 gap-4">
                {formData.photos.map((photo, index) => (
                  <div key={`photos-${index}`} className="relative aspect-square rounded-xl overflow-hidden border-2 border-fuchsia-500/30">
                    <img
                      src={`${API_URL}${photo}`}
                      alt={`Photo ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <button
                      onClick={() => removePhoto(index)}
                      className="absolute top-2 right-2 w-8 h-8 bg-red-600 rounded-full flex items-center justify-center shadow-lg hover:bg-red-700 transition-all"
                    >
                      <X className="w-4 h-4 text-white" />
                    </button>
                  </div>
                ))}

                {/* Upload Button */}
                {formData.photos.length < 6 && (
                  <label className="aspect-square rounded-xl border-2 border-dashed border-white/20 hover:border-fuchsia-500 flex flex-col items-center justify-center cursor-pointer transition-all bg-white/5 hover:bg-white/10">
                    <input
                      type="file"
                      accept="image/*,video/*"
                      multiple
                      onChange={handlePhotoUpload}
                      className="hidden"
                      disabled={uploadingPhoto}
                    />
                    {uploadingPhoto ? (
                      <>
                        <Loader2 className="w-8 h-8 text-fuchsia-500 animate-spin mb-2" />
                        <p className="text-xs text-white/60">{Math.round(uploadProgress)}%</p>
                      </>
                    ) : (
                      <>
                        <Upload className="w-8 h-8 text-white/40 mb-2" />
                        <p className="text-xs text-white/40">Add Photo</p>
                      </>
                    )}
                  </label>
                )}
              </div>

              <p className="text-sm text-white/40 text-center">
                You can upload up to 6 photos or videos (max 50MB each)
              </p>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t-2 border-white/10">
            {currentStep > 1 && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setCurrentStep(currentStep - 1)}
                className="px-6 py-3 bg-white/10 backdrop-blur-sm text-white font-bold rounded-xl border-2 border-white/20"
              >
                Back
              </motion.button>
            )}

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleNext}
              disabled={loading}
              className="ml-auto px-8 py-3 bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white font-bold rounded-xl flex items-center gap-2 shadow-xl shadow-fuchsia-500/30 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Saving...
                </>
              ) : currentStep === 4 ? (
                <>
                  <Check className="w-5 h-5" />
                  Complete Profile
                </>
              ) : (
                <>
                  Next
                  <Sparkles className="w-5 h-5" />
                </>
              )}
            </motion.button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
