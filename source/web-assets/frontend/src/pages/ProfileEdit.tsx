import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Globe, ArrowLeft, Save } from 'lucide-react';
import VideoUpload from '@/components/VideoUpload';
import { VibeScoreBadge } from '@/components/VibeScoreBadge';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function ProfileEdit() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);
  const [vibeScores, setVibeScores] = useState(null);
  const [formData, setFormData] = useState({
    bio: '',
    age: '',
    gender: '',
    location: '',
    interests: '',
    relationship_intent: '',
    interest_categories: []
  });
  const [categories, setCategories] = useState(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await fetch(`${API}/auth/me`, {
        });
        
        if (!response.ok) throw new Error('Not authenticated');
        
        const userData = await response.json();
        setUser(userData);
        setFormData({
          bio: userData.bio || '',
          age: userData.age || '',
          gender: userData.gender || '',
          location: userData.location || '',
          interests: userData.interests?.join(', ') || '',
          relationship_intent: userData.relationship_intent || '',
          interest_categories: userData.interest_categories || []
        });
      } catch (error) {
        navigate('/');
      }
    };
    
    const fetchCategories = async () => {
      try {
        const response = await fetch(`${API}/categories/all`);
        const data = await response.json();
        setCategories(data);
      } catch (error) {
        // console.error('Failed to fetch categories:', error);
      }
    };
    
    const fetchVibeScores = async () => {
      try {
        const response = await fetch(`${API}/vibe-score/me`, {
        });
        if (response.ok) {
          const data = await response.json();
          setVibeScores(data);
        }
      } catch (error) {
        // console.error('Failed to fetch Vibe Scores:', error);
      }
    };
    
    fetchUser();
    fetchCategories();
    fetchVibeScores();
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const updateData = {
        bio: formData.bio,
        age: parseInt(formData.age),
        gender: formData.gender,
        location: formData.location,
        interests: formData.interests.split(',').map(i => i.trim()).filter(i => i),
        relationship_intent: formData.relationship_intent,
        interest_categories: formData.interest_categories
      };

      const response = await fetch(`${API}/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        
        body: JSON.stringify(updateData)
      });

      if (!response.ok) throw new Error('Failed to update profile');

      navigate('/dashboard');
    } catch (error) {
      // console.error('Profile update error:', error);
      alert('Failed to update profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-pink-500 via-purple-500 to-indigo-500">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-500 via-purple-500 to-indigo-500 p-4">
      <div className="container mx-auto max-w-2xl py-8">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="flex items-center justify-between mb-6">
            <Button 
              variant="ghost" 
              onClick={() => navigate('/dashboard')}
              data-testid="back-btn"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Back
            </Button>
            <div className="flex items-center gap-2">
              <Globe className="w-6 h-6 text-purple-600" />
              <h1 className="text-xl font-bold text-purple-600">Global Vibez DSG</h1>
            </div>
          </div>
          
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Edit Profile</h2>

          {/* Vibe Score Display */}
          {vibeScores && (
            <div className="mb-6">
              <VibeScoreBadge
                vibeScore={vibeScores.vibe_score}
                gameElo={vibeScores.game_elo}
                size="lg"
                showBreakdown={true}
                breakdown={vibeScores.breakdown}
              />
              <div className="mt-2 text-center text-sm text-gray-600">
                🏆 Vibe Rank: #{vibeScores.vibe_rank?.toLocaleString()} • Game Rank: #{vibeScores.elo_rank?.toLocaleString()}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6" data-testid="profile-edit-form">
            <div>
              <Label htmlFor="bio">Bio</Label>
              <Textarea 
                id="bio"
                placeholder="Tell us about yourself..."
                value={formData.bio}
                onChange={(e) => setFormData({...formData, bio: e.target.value})}
                rows={4}
                data-testid="bio-input"
              />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="age">Age</Label>
                <Input 
                  id="age"
                  type="number"
                  placeholder="25"
                  value={formData.age}
                  onChange={(e) => setFormData({...formData, age: e.target.value})}
                  min="18"
                  max="99"
                  data-testid="age-input"
                />
              </div>

              <div>
                <Label htmlFor="gender">Gender</Label>
                <Select 
                  value={formData.gender} 
                  onValueChange={(value) => setFormData({...formData, gender: value})}
                >
                  <SelectTrigger data-testid="gender-select">
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="non-binary">Non-binary</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="location">Location</Label>
              <Input 
                id="location"
                type="text"
                placeholder="City, Country"
                value={formData.location}
                onChange={(e) => setFormData({...formData, location: e.target.value})}
                data-testid="location-input"
              />
            </div>

            <div>
              <Label htmlFor="interests">Interests (comma separated)</Label>
              <Input 
                id="interests"
                type="text"
                placeholder="Travel, Music, Photography, Cooking"
                value={formData.interests}
                onChange={(e) => setFormData({...formData, interests: e.target.value})}
                data-testid="interests-input"
              />
            </div>

            {/* Dating Categories Section */}
            {categories && (
              <div className="space-y-4 border-t pt-6">
                <h3 className="text-lg font-semibold text-gray-800">Dating Preferences</h3>
                
                {/* Relationship Intent */}
                <div>
                  <Label htmlFor="relationship_intent">What are you looking for?</Label>
                  <Select 
                    value={formData.relationship_intent} 
                    onValueChange={(value) => setFormData({...formData, relationship_intent: value})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select relationship intent" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.relationship_intents?.map(intent => (
                        <SelectItem key={intent.id} value={intent.id}>
                          {intent.emoji} {intent.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Interest Categories */}
                <div>
                  <Label>Interest Categories (select all that apply)</Label>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {categories.interest_categories?.map(category => (
                      <button
                        key={category.id}
                        type="button"
                        onClick={() => {
                          const isSelected = formData.interest_categories.includes(category.id);
                          setFormData({
                            ...formData,
                            interest_categories: isSelected
                              ? formData.interest_categories.filter(c => c !== category.id)
                              : [...formData.interest_categories, category.id]
                          });
                        }}
                        className={`p-3 rounded-lg border-2 transition-all text-sm ${
                          formData.interest_categories.includes(category.id)
                            ? 'border-purple-500 bg-purple-50 text-purple-700 font-semibold'
                            : 'border-gray-200 hover:border-purple-300'
                        }`}
                      >
                        <span className="text-lg mr-1">{category.emoji}</span>
                        {category.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Profile Videos Section */}
            <div className="space-y-6 bg-gradient-to-br from-pink-500/10 to-purple-500/10 p-6 rounded-2xl border border-pink-500/20">
              <h3 className="text-xl font-bold text-white mb-4">📹 Profile Videos</h3>
              <p className="text-sm text-gray-300 mb-4">
                Tell others what you're looking for! Record a short video to help people understand your preferences better.
              </p>
              
              <div className="space-y-6">
                <VideoUpload
                  videoType="friends"
                  currentVideoUrl={user?.looking_for_video_friends}
                  onUploadSuccess={(url) => {
                    setUser({ ...user, looking_for_video_friends: url });
                  }}
                />

                <VideoUpload
                  videoType="dating"
                  currentVideoUrl={user?.looking_for_video_dating}
                  onUploadSuccess={(url) => {
                    setUser({ ...user, looking_for_video_dating: url });
                  }}
                />
              </div>
            </div>

            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <p className="text-sm text-purple-800">
                <strong>Membership:</strong> {user.membership_type.toUpperCase()}
              </p>
              <p className="text-sm text-purple-600 mt-2">
                {user.membership_type === 'free' 
                  ? `Swipes today: ${user.swipes_today}/${user.swipes_limit}` 
                  : 'Unlimited swipes ✨'}
              </p>
            </div>

            <Button 
              type="submit" 
              className="w-full bg-purple-600 hover:bg-purple-700 text-white text-lg py-6"
              disabled={loading}
              data-testid="save-profile-btn"
            >
              {loading ? 'Saving...' : 'Save Changes'}
              <Save className="w-5 h-5 ml-2" />
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}