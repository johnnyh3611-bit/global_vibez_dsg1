import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Globe, Heart, X, MapPin, Sparkles, ArrowLeft, Crown, Flag } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import AppFooter from '@/components/AppFooter';
import { useVoiceCommands, VoiceCommandUI } from '@/hooks/useVoiceCommands';
import ReportUserModal from '@/components/ReportUserModal';
import VerifiedBadge from '@/components/VerifiedBadge';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function Discover() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [matchModal, setMatchModal] = useState(false);
  const [matchedUser, setMatchedUser] = useState(null);
  const [swipeDirection, setSwipeDirection] = useState(null);
  const [showReportModal, setShowReportModal] = useState(false);

  // Voice Commands Integration
  const handleVoiceCommand = (command) => {
    if (command.type === 'swipe') {
      handleSwipe(command.action);
    } else if (command.type === 'navigate') {
      navigate(command.to);
    }
  };

  const { isListening, lastCommand, toggleListening } = useVoiceCommands(handleVoiceCommand);

  useEffect(() => {
    fetchCurrentUser();
    fetchProfiles();
  }, []);

  const fetchCurrentUser = async () => {
    try {
      const response = await fetch(`${API}/auth/me`, {
      });
      if (!response.ok) throw new Error('Not authenticated');
      const userData = await response.json();
      setUser(userData);
    } catch (error) {
      navigate('/');
    }
  };

  const fetchProfiles = async () => {
    try {
      const response = await fetch(`${API}/discover?limit=20`, {
      });
      
      if (!response.ok) throw new Error('Failed to fetch profiles');
      
      const data = await response.json();
      setProfiles(data);
    } catch (error) {
      // console.error('Error fetching profiles:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSwipe = async (action) => {
    if (currentIndex >= profiles.length) return;

    const currentProfile = profiles[currentIndex];
    setSwipeDirection(action === 'like' ? 'right' : 'left');

    setTimeout(async () => {
      try {
        const response = await fetch(`${API}/swipe`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          
          body: JSON.stringify({
            target_user_id: currentProfile.user_id,
            action: action
          })
        });

        if (response.status === 403) {
          // Swipe limit reached
          const error = await response.json();
          alert(error.detail);
          return;
        }

        if (!response.ok) throw new Error('Swipe failed');

        const result = await response.json();

        // Check for match
        if (result.is_match) {
          setMatchedUser(result.matched_user);
          setMatchModal(true);
        }

        // Move to next profile
        setCurrentIndex(currentIndex + 1);
        setSwipeDirection(null);

        // Refresh user data (to update swipe count)
        fetchCurrentUser();
      } catch (error) {
        // console.error('Error swiping:', error);
        alert('Failed to swipe. Please try again.');
      }
    }, 300);
  };

  const currentProfile = profiles[currentIndex];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-pink-500 via-purple-500 to-indigo-500">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-500 via-purple-500 to-indigo-500">
      {/* Header */}
      <header className="bg-white/10 backdrop-blur-lg border-b border-white/20">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Button
            variant="ghost"
            onClick={() => navigate('/dashboard')}
            className="text-white hover:bg-white/20"
            data-testid="back-to-dashboard-btn"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back
          </Button>
          <div className="flex items-center gap-2">
            <Globe className="w-8 h-8 text-white" />
            <h1 className="text-2xl font-bold text-white">Global Vibez DSG</h1>
          </div>
          <div className="text-white text-sm">
            {user?.membership_type === 'free' ? (
              <span>Swipes: {user?.swipes_today}/{user?.swipes_limit}</span>
            ) : (
              <span className="flex items-center gap-1">
                <Crown className="w-4 h-4" />
                Unlimited
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-12">
        <div className="max-w-md mx-auto">
          {!currentProfile || currentIndex >= profiles.length ? (
            <Card className="p-12 text-center bg-white/10 backdrop-blur-lg border-white/20 text-white">
              <Sparkles className="w-16 h-16 mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-4">No More Profiles</h2>
              <p className="mb-6">You've seen everyone nearby! Check back later for new matches.</p>
              <Button
                onClick={() => navigate('/matches')}
                className="bg-white text-purple-600 hover:bg-gray-100"
                data-testid="view-matches-btn"
              >
                View Matches
              </Button>
            </Card>
          ) : (
            <div>
              {/* Profile Card */}
              <Card 
                className={`relative overflow-hidden bg-white shadow-2xl transition-all duration-300 ${
                  swipeDirection === 'right' ? 'translate-x-[1000px] opacity-0' : 
                  swipeDirection === 'left' ? '-translate-x-[1000px] opacity-0' : ''
                }`}
                data-testid="profile-card"
              >
                {/* Profile Image */}
                <div className="relative h-96 bg-gradient-to-br from-purple-400 to-pink-400">
                  {currentProfile.photos && currentProfile.photos.length > 0 ? (
                    <img
                      src={currentProfile.photos[0]}
                      alt={currentProfile.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white text-6xl font-bold">
                      {currentProfile.name.charAt(0)}
                    </div>
                  )}
                  {/* Gradient Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                  
                  {/* Name and Age */}
                  <div className="absolute bottom-4 left-4 text-white">
                    <div className="flex items-center gap-2 mb-1">
                      <h2 className="text-3xl font-bold">
                        {currentProfile.name}, {currentProfile.age}
                      </h2>
                      <VerifiedBadge verified={currentProfile.age_verified || currentProfile.verification_status === 'approved'} size="lg" />
                    </div>
                    {currentProfile.location && (
                      <p className="flex items-center gap-1 text-white/90">
                        <MapPin className="w-4 h-4" />
                        {currentProfile.location}
                      </p>
                    )}
                  </div>
                </div>

                {/* Profile Details */}
                <div className="p-6">
                  {currentProfile.bio && (
                    <div className="mb-4">
                      <h3 className="font-semibold text-gray-700 mb-2">About</h3>
                      <p className="text-gray-600">{currentProfile.bio}</p>
                    </div>
                  )}

                  {currentProfile.interests && currentProfile.interests.length > 0 && (
                    <div>
                      <h3 className="font-semibold text-gray-700 mb-2">Interests</h3>
                      <div className="flex flex-wrap gap-2">
                        {currentProfile.interests.map((interest, index) => (
                          <span
                            key={`interests-${index}`}
                            className="px-3 py-1 bg-purple-100 text-purple-600 rounded-full text-sm"
                          >
                            {interest}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </Card>

              {/* Action Buttons */}
              <div className="flex justify-center gap-4 mt-8">
                <Button
                  size="sm"
                  variant="outline"
                  className="border-gray-400 text-gray-600 hover:bg-gray-100"
                  onClick={() => setShowReportModal(true)}
                >
                  <Flag className="w-4 h-4 mr-2" />
                  Report
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="w-16 h-16 rounded-full border-4 border-red-500 text-red-500 hover:bg-red-50"
                  onClick={() => handleSwipe('dislike')}
                  data-testid="dislike-btn"
                >
                  <X className="w-8 h-8" />
                </Button>
                <Button
                  size="lg"
                  className="w-16 h-16 rounded-full bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 shadow-lg"
                  onClick={() => handleSwipe('like')}
                  data-testid="like-btn"
                >
                  <Heart className="w-8 h-8" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Match Modal */}
      <Dialog open={matchModal} onOpenChange={setMatchModal}>
        <DialogContent className="sm:max-w-md bg-gradient-to-br from-pink-500 to-purple-500 text-white border-none">
          <DialogHeader>
            <DialogTitle className="text-3xl font-bold text-center">It's a Match! 🎉</DialogTitle>
            <DialogDescription className="text-white/90 text-center">
              You and {matchedUser?.name} liked each other!
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center py-6">
            <div className="relative">
              <div className="w-24 h-24 rounded-full bg-white/20 backdrop-blur-lg flex items-center justify-center text-4xl font-bold">
                {matchedUser?.name?.charAt(0)}
              </div>
              <Heart className="absolute -top-2 -right-2 w-8 h-8 fill-red-500 text-red-500" />
            </div>
          </div>
          <div className="flex gap-4">
            <Button
              variant="outline"
              className="flex-1 bg-white/20 text-white border-white/40 hover:bg-white/30"
              onClick={() => {
                setMatchModal(false);
              }}
              data-testid="keep-swiping-btn"
            >
              Keep Swiping
            </Button>
            <Button
              className="flex-1 bg-white text-purple-600 hover:bg-gray-100"
              onClick={() => navigate('/matches')}
              data-testid="view-match-btn"
            >
              View Matches
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Report User Modal */}
      {showReportModal && currentProfile && (
        <ReportUserModal
          userId={currentProfile.user_id}
          userName={currentProfile.name}
          onClose={() => setShowReportModal(false)}
          onSuccess={() => {
            setShowReportModal(false);
            // Optionally skip this user after reporting
            setSwipeDirection('left');
            setTimeout(() => {
              setCurrentIndex(currentIndex + 1);
              setSwipeDirection(null);
            }, 300);
          }}
        />
      )}
      
      {/* Voice Command UI */}
      <VoiceCommandUI 
        isListening={isListening}
        lastCommand={lastCommand}
        onToggle={toggleListening}
      />

      {/* Footer */}
      <AppFooter />
    </div>
  );
}