import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { RoomLayout } from '@/components/RoomLayout';
import { GlassCard } from '@/components/GlassCard';
import { NeonButton } from '@/components/NeonButton';
import { Button } from '@/components/ui/button';
import { 
  Heart, X, Star, MapPin, Briefcase, GraduationCap,
  MessageCircle, Sparkles, ArrowLeft, Zap, Info
} from 'lucide-react';
import AppFooter from '@/components/AppFooter';

const API = process.env.REACT_APP_BACKEND_URL;

export default function DiscoverNew() {
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [swipesLeft, setSwipesLeft] = useState(20);
  const [showMatchAnimation, setShowMatchAnimation] = useState(false);

  useEffect(() => {
    fetchProfiles();
  }, []);

  const fetchProfiles = async () => {
    try {
      const response = await fetch(`${API}/api/discover`, {
      });
      
      if (response.ok) {
        const data = await response.json();
        setProfiles(data.profiles || []);
        setSwipesLeft(data.swipes_remaining || 20);
      }
    } catch (error) {
      // console.error('Error fetching profiles:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSwipe = async (action) => {
    if (currentIndex >= profiles.length) return;
    
    const currentProfile = profiles[currentIndex];
    
    try {
      const response = await fetch(`${API}/api/swipe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        
        body: JSON.stringify({
          target_user_id: currentProfile.user_id,
          action
        })
      });

      if (response.ok) {
        const data = await response.json();
        
        if (data.match) {
          setShowMatchAnimation(true);
          setTimeout(() => setShowMatchAnimation(false), 3000);
        }
        
        setSwipesLeft(prev => prev - 1);
        setCurrentIndex(prev => prev + 1);
      }
    } catch (error) {
      // console.error('Error swiping:', error);
    }
  };

  const currentProfile = profiles[currentIndex];

  if (loading) {
    return (
      <RoomLayout theme="dating" showStars={true}>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-white text-xl">Loading profiles...</div>
        </div>
      </RoomLayout>
    );
  }

  return (
    <RoomLayout theme="dating" showStars={true}>
      {/* Header */}
      <header className="relative z-50 bg-black/20 backdrop-blur-lg border-b border-white/10">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Button
            variant="ghost"
            onClick={() => navigate('/dashboard')}
            className="text-white hover:bg-white/10"
          >
            <ArrowLeft className="mr-2 h-5 w-5" />
            Back to Hub
          </Button>
          
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Heart className="w-8 h-8 text-pink-400" />
            Dating Universe
          </h1>
          
          <Button
            variant="ghost"
            onClick={() => navigate('/matches')}
            className="text-white hover:bg-white/10"
          >
            <MessageCircle className="mr-2 h-5 w-5" />
            Matches
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 min-h-screen flex items-center justify-center">
        {/* Match Animation */}
        <AnimatePresence>
          {showMatchAnimation && (
            <motion.div
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-lg"
            >
              <div className="text-center">
                <motion.div
                  animate={{ scale: [1, 1.2, 1], rotate: [0, 360] }}
                  transition={{ duration: 1, repeat: 2 }}
                >
                  <Sparkles className="w-32 h-32 text-pink-400 mx-auto mb-4" />
                </motion.div>
                <h2 className="text-6xl font-bold text-white mb-4">It's a Match!</h2>
                <p className="text-2xl text-pink-300">You can now start chatting</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Swipes Counter */}
        <div className="absolute top-24 left-1/2 transform -translate-x-1/2 z-40">
          <GlassCard className="px-4 py-2" hoverable={false}>
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-yellow-400" />
              <span className="text-white font-semibold">{swipesLeft} swipes left</span>
            </div>
          </GlassCard>
        </div>

        {/* Profile Card */}
        {currentProfile ? (
          <motion.div
            key={currentProfile.user_id}
            initial={{ opacity: 0, scale: 0.9, rotateY: -10 }}
            animate={{ opacity: 1, scale: 1, rotateY: 0 }}
            exit={{ opacity: 0, scale: 0.9, rotateY: 10 }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
            className="relative w-full max-w-md"
          >
            <GlassCard className="overflow-hidden" hoverable={false}>
              {/* Profile Image */}
              <div className="relative h-96">
                {currentProfile.photos && currentProfile.photos.length > 0 ? (
                  <img
                    src={currentProfile.photos[0]}
                    alt={currentProfile.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center">
                    <span className="text-9xl font-bold text-white">
                      {currentProfile.name?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                
                {/* Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

                {/* Info Badge */}
                <div className="absolute top-4 right-4 bg-pink-500 text-white px-3 py-1 rounded-full text-sm font-bold flex items-center gap-1">
                  <Star className="w-4 h-4" />
                  {currentProfile.age || '25'}
                </div>
              </div>

              {/* Profile Info */}
              <div className="p-6">
                <h2 className="text-4xl font-bold text-white mb-2">
                  {currentProfile.name || 'Anonymous'}
                </h2>

                {/* Bio */}
                {currentProfile.bio && (
                  <p className="text-slate-300 mb-4 line-clamp-3">
                    {currentProfile.bio}
                  </p>
                )}

                {/* Details */}
                <div className="space-y-2 mb-6">
                  {currentProfile.location && (
                    <div className="flex items-center gap-2 text-slate-300">
                      <MapPin className="w-4 h-4 text-pink-400" />
                      <span className="text-sm">{currentProfile.location}</span>
                    </div>
                  )}
                  
                  {currentProfile.occupation && (
                    <div className="flex items-center gap-2 text-slate-300">
                      <Briefcase className="w-4 h-4 text-pink-400" />
                      <span className="text-sm">{currentProfile.occupation}</span>
                    </div>
                  )}
                  
                  {currentProfile.education && (
                    <div className="flex items-center gap-2 text-slate-300">
                      <GraduationCap className="w-4 h-4 text-pink-400" />
                      <span className="text-sm">{currentProfile.education}</span>
                    </div>
                  )}
                </div>

                {/* Interests */}
                {currentProfile.interests && currentProfile.interests.length > 0 && (
                  <div className="mb-6">
                    <p className="text-sm text-slate-400 mb-2">Interests</p>
                    <div className="flex flex-wrap gap-2">
                      {currentProfile.interests.slice(0, 6).map((interest, idx) => (
                        <span
                          key={`item-${idx}`}
                          className="px-3 py-1 bg-pink-500/20 border border-pink-500/30 rounded-full text-sm text-pink-300"
                        >
                          {interest}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-4 justify-center">
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => handleSwipe('pass')}
                    className="w-16 h-16 rounded-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center shadow-2xl border-2 border-slate-600 hover:border-slate-500 transition-all"
                  >
                    <X className="w-8 h-8 text-slate-300" />
                  </motion.button>

                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => navigate(`/profile/${currentProfile.user_id}`)}
                    className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center shadow-2xl"
                  >
                    <Info className="w-6 h-6 text-white" />
                  </motion.button>

                  <motion.button
                    whileHover={{ scale: 1.1, rotate: 5 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => handleSwipe('like')}
                    className="w-16 h-16 rounded-full bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center shadow-2xl shadow-pink-500/50"
                  >
                    <Heart className="w-8 h-8 text-white fill-white" />
                  </motion.button>
                </div>
              </div>
            </GlassCard>
          </motion.div>
        ) : (
          <GlassCard className="p-12 text-center">
            <Sparkles className="w-16 h-16 text-pink-400 mx-auto mb-4" />
            <h2 className="text-3xl font-bold text-white mb-4">
              No More Profiles
            </h2>
            <p className="text-slate-300 mb-6">
              {swipesLeft === 0 
                ? "You've used all your daily swipes. Upgrade to Premium for unlimited swipes!"
                : "Check back later for more profiles"}
            </p>
            <div className="flex gap-4 justify-center">
              <NeonButton
                onClick={() => navigate('/dashboard')}
                variant="ghost"
              >
                Back to Hub
              </NeonButton>
              {swipesLeft === 0 && (
                <NeonButton
                  onClick={() => navigate('/pricing')}
                  variant="gradient"
                >
                  Upgrade to Premium
                </NeonButton>
              )}
            </div>
          </GlassCard>
        )}
      </div>

      <AppFooter />
    </RoomLayout>
  );
}
