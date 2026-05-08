import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Globe, ArrowRight } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function ProfileSetup() {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    bio: '',
    age: '',
    gender: '',
    location: '',
    interests: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const updateData = {
        bio: formData.bio,
        age: parseInt(formData.age),
        gender: formData.gender,
        location: formData.location,
        interests: formData.interests.split(',').map(i => i.trim()).filter(i => i)
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-500 via-purple-500 to-indigo-500 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-8">
        <div className="flex items-center justify-center gap-2 mb-6">
          <Globe className="w-8 h-8 text-purple-600" />
          <h1 className="text-3xl font-bold text-purple-600">Global Vibez DSG</h1>
        </div>
        
        <h2 className="text-2xl font-bold text-gray-800 mb-2 text-center">Complete Your Profile</h2>
        <p className="text-gray-600 mb-6 text-center">Tell us about yourself to get started!</p>

        <form onSubmit={handleSubmit} className="space-y-6" data-testid="profile-setup-form">
          <div>
            <Label htmlFor="bio">Bio *</Label>
            <Textarea 
              id="bio"
              placeholder="Tell us about yourself..."
              value={formData.bio}
              onChange={(e) => setFormData({...formData, bio: e.target.value})}
              required
              rows={4}
              data-testid="bio-input"
            />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="age">Age *</Label>
              <Input 
                id="age"
                type="number"
                placeholder="25"
                value={formData.age}
                onChange={(e) => setFormData({...formData, age: e.target.value})}
                required
                min="18"
                max="99"
                data-testid="age-input"
              />
            </div>

            <div>
              <Label htmlFor="gender">Gender *</Label>
              <Select 
                value={formData.gender} 
                onValueChange={(value) => setFormData({...formData, gender: value})}
                required
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
            <Label htmlFor="location">Location *</Label>
            <Input 
              id="location"
              type="text"
              placeholder="City, Country"
              value={formData.location}
              onChange={(e) => setFormData({...formData, location: e.target.value})}
              required
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

          <Button 
            type="submit" 
            className="w-full bg-purple-600 hover:bg-purple-700 text-white text-lg py-6"
            disabled={loading}
            data-testid="submit-profile-btn"
          >
            {loading ? 'Saving...' : 'Complete Profile'}
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </form>
      </div>
    </div>
  );
}