import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Globe, ArrowRight } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

/**
 * Profile Setup — post-signup onboarding.
 *
 * 2026-05-12 bug fix: previously rendered shadcn <Input>/<Textarea>/<Label>
 * against a WHITE card. Those primitives inherit `text-foreground` which the
 * global dark theme sets to near-white, so every keystroke was invisible
 * (white-on-white). Founder reported "input fields don't type over."
 *
 * Fix: explicit text-slate-900 on inputs + text-slate-800 on labels.
 * Card stays white (brand) — text now reads cleanly. Labels were also
 * already-styled `text-gray-800` via parent text-* — we make it explicit
 * on each Label so a future theme change can't break visibility again.
 */
export default function ProfileSetup() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    bio: '',
    age: '',
    gender: '',
    location: '',
    interests: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('gv_auth_token') || '';
      const updateData = {
        bio: formData.bio,
        age: parseInt(formData.age, 10),
        gender: formData.gender,
        location: formData.location,
        interests: formData.interests
          .split(',')
          .map((i) => i.trim())
          .filter((i) => i),
      };

      const response = await fetch(`${API}/profile`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        throw new Error(`Profile update failed (${response.status})`);
      }
      navigate('/dashboard');
    } catch (err: any) {
      setError(err?.message || 'Failed to update profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Shared input class — high-contrast text on white card. Fixes the
  // invisibility bug by overriding the theme-inherited foreground.
  const inputCls =
    'text-slate-900 placeholder:text-slate-400 bg-white border-slate-300 focus-visible:ring-purple-500';
  const labelCls = 'text-slate-800 font-semibold';

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-pink-500 via-purple-500 to-indigo-500 flex items-center justify-center p-4"
      data-testid="profile-setup-page"
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-8">
        <div className="flex items-center justify-center gap-2 mb-6">
          <Globe className="w-8 h-8 text-purple-600" />
          <h1 className="text-3xl font-bold text-purple-600">Global Vibez DSG</h1>
        </div>

        <h2 className="text-2xl font-bold text-slate-900 mb-2 text-center">
          Complete Your Profile
        </h2>
        <p className="text-slate-600 mb-6 text-center">
          Tell us about yourself to get started!
        </p>

        {error && (
          <div
            className="mb-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700"
            data-testid="profile-setup-error"
          >
            {error}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="space-y-6"
          data-testid="profile-setup-form"
        >
          <div>
            <Label htmlFor="bio" className={labelCls}>
              Bio *
            </Label>
            <Textarea
              id="bio"
              placeholder="Tell us about yourself..."
              value={formData.bio}
              onChange={(e) =>
                setFormData({ ...formData, bio: e.target.value })
              }
              required
              rows={4}
              className={inputCls}
              data-testid="bio-input"
            />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="age" className={labelCls}>
                Age *
              </Label>
              <Input
                id="age"
                type="number"
                placeholder="25"
                value={formData.age}
                onChange={(e) =>
                  setFormData({ ...formData, age: e.target.value })
                }
                required
                min="18"
                max="99"
                className={inputCls}
                data-testid="age-input"
              />
            </div>

            <div>
              <Label htmlFor="gender" className={labelCls}>
                Gender *
              </Label>
              <Select
                value={formData.gender}
                onValueChange={(value) =>
                  setFormData({ ...formData, gender: value })
                }
                required
              >
                <SelectTrigger
                  className="text-slate-900 bg-white border-slate-300"
                  data-testid="gender-select"
                >
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
            <Label htmlFor="location" className={labelCls}>
              Location *
            </Label>
            <Input
              id="location"
              type="text"
              placeholder="City, Country"
              value={formData.location}
              onChange={(e) =>
                setFormData({ ...formData, location: e.target.value })
              }
              required
              className={inputCls}
              data-testid="location-input"
            />
          </div>

          <div>
            <Label htmlFor="interests" className={labelCls}>
              Interests (comma separated)
            </Label>
            <Input
              id="interests"
              type="text"
              placeholder="Travel, Music, Photography, Cooking"
              value={formData.interests}
              onChange={(e) =>
                setFormData({ ...formData, interests: e.target.value })
              }
              className={inputCls}
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
