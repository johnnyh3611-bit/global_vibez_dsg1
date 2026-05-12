
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { RoomLayout } from '@/components/RoomLayout';
import { GlassCard } from '@/components/GlassCard';
import { NeonButton } from '@/components/NeonButton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Eye, EyeOff, Mail, Lock, User, Calendar, ArrowLeft, AlertCircle, CheckCircle, Crown } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

export default function SignupPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get('invite');
  const refCode = (searchParams.get('ref') || '').toUpperCase().trim();
  const [inviteValid, setInviteValid] = useState<boolean | null>(null);
  const [inviteName, setInviteName] = useState<string>('');
  const [refReferrerName, setRefReferrerName] = useState<string | null>(null);
  const [refValid, setRefValid] = useState<boolean | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    date_of_birth: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [passwordStrength, setPasswordStrength] = useState({ score: 0, message: '' });

  // ── Magic-link invite redemption (Feb 2026) ────────────────────────────
  useEffect(() => {
    if (!inviteToken) return;
    fetch(`${API}/api/beta-waitlist/redeem?token=${encodeURIComponent(inviteToken)}`)
      .then(async (r) => {
        const body = await r.json();
        if (r.ok) {
          setInviteValid(true);
          setInviteName(body.name || '');
          setFormData((prev) => ({
            ...prev,
            email: body.email || prev.email,
            name: prev.name || body.name || '',
          }));
        } else {
          setInviteValid(false);
          setError(body.detail || 'This invite link is invalid or expired.');
        }
      })
      .catch(() => {
        setInviteValid(false);
        setError('Could not verify your invite link — please try again.');
      });
  }, [inviteToken]);

  // ── Streamer Referral Program (P3) ────────────────────────────────────
  // Validate `?ref=VIBE-XXXXXXXX` against the lookup endpoint so we can
  // show a "You were invited by Beta Tester 1 — earn rewards together"
  // banner before the user finishes signing up.
  useEffect(() => {
    if (!refCode || !refCode.startsWith('VIBE-')) return;
    fetch(`${API}/api/streamer-referral/lookup/${encodeURIComponent(refCode)}`)
      .then(async (r) => {
        if (!r.ok) {
          setRefValid(false);
          return;
        }
        const body = await r.json();
        setRefValid(true);
        setRefReferrerName(body.referrer_display_name || 'a Vibez streamer');
      })
      .catch(() => setRefValid(false));
  }, [refCode]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    if (name === 'password') {
      checkPasswordStrength(value);
    }
  };

  const checkPasswordStrength = (password) => {
    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score++;

    const messages = {
      0: 'Too weak',
      1: 'Weak',
      2: 'Fair',
      3: 'Good',
      4: 'Strong',
      5: 'Very Strong'
    };

    setPasswordStrength({ score, message: messages[score] });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!formData.name || !formData.email || !formData.password || !formData.date_of_birth) {
      setError('All fields are required');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (passwordStrength.score < 4) {
      setError('Password is too weak. Please use a stronger password.');
      return;
    }

    // Check age (client-side)
    const dob = new Date(formData.date_of_birth);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      age--;
    }

    if (age < 18) {
      setError('You must be at least 18 years old to sign up');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // NOTE: no credentials:'include' — edge gateway returns
        // Allow-Origin:* which blocks credentialed requests. Auth uses
        // Bearer tokens stored in localStorage instead.
        body: JSON.stringify({
          name: formData.name,
          email: formData.email.trim().toLowerCase(),
          password: formData.password,
          date_of_birth: formData.date_of_birth
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Signup failed');
      }

      // Store Bearer token + user info so ProtectedRoute can authorize
      // /profile/setup even when the SameSite=None cookie is blocked.
      if (data.token) {
        localStorage.setItem('auth_token', data.token);
      }
      const userObj = data.user || data;
      if (userObj?.user_id || userObj?.id) {
        localStorage.setItem('user_id', userObj.user_id || userObj.id);
      }
      if (userObj?.name || userObj?.email) {
        localStorage.setItem('username', userObj.name || userObj.email);
      }

      // Mark the magic-link invite as redeemed so it can't be reused.
      if (inviteToken && inviteValid) {
        try {
          await fetch(`${API}/api/beta-waitlist/redeem-confirm`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: inviteToken }),
          });
        } catch {
          // Best-effort — don't block signup on this.
        }
      }

      // Streamer Referral Program (P3) — if the user landed with a valid
      // `?ref=CODE` link, record the redemption so the referrer gets
      // paid the moment this account goes live for the first time.
      const newUserId = userObj?.user_id || userObj?.id;
      if (refCode && refValid && newUserId) {
        try {
          await fetch(`${API}/api/streamer-referral/redeem`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              code: refCode,
              new_user_id: newUserId,
            }),
          });
        } catch {
          // Best-effort — don't block signup on referral plumbing.
        }
      }

      // Success! Redirect to profile setup
      navigate('/profile/setup');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const passwordStrengthColor = {
    0: 'bg-red-500',
    1: 'bg-red-400',
    2: 'bg-yellow-500',
    3: 'bg-blue-500',
    4: 'bg-green-500',
    5: 'bg-green-600'
  };

  return (
    <RoomLayout theme="dating" showStars={true}>
      <div className="min-h-screen flex items-center justify-center px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-md"
        >
          <Button
            variant="ghost"
            onClick={() => navigate('/')}
            className="text-white hover:bg-white/10 mb-6"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Button>

          <GlassCard className="p-8">
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold text-white mb-2">Join Global Vibez DSG</h1>
              <p className="text-slate-300">Create your account and start connecting</p>
            </div>

            {/* Founder invite banner — shown when /signup?invite=TOKEN is valid. */}
            {inviteToken && inviteValid === true && (
              <div
                data-testid="signup-invite-banner"
                className="mb-6 rounded-2xl border-2 border-amber-400/50 bg-gradient-to-r from-amber-500/15 to-orange-500/15 p-5 text-center"
              >
                <Crown className="w-8 h-8 mx-auto mb-2 text-amber-300" />
                <div className="text-[10px] uppercase tracking-[0.4em] text-amber-300 font-black mb-1">
                  Founder Invite Verified
                </div>
                <p className="text-white text-sm">
                  Welcome{inviteName ? `, ${inviteName}` : ''}! Your seat is locked in — finish creating your account below.
                </p>
              </div>
            )}
            {inviteToken && inviteValid === false && (
              <div
                data-testid="signup-invite-banner-invalid"
                className="mb-6 rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200"
              >
                Your invite link is invalid or expired. You can still sign up below — just join the regular waitlist.
              </div>
            )}

            {/* Streamer Referral banner — shown when /signup?ref=VIBE-XXXX is valid. */}
            {refCode && refValid === true && (
              <div
                data-testid="signup-ref-banner"
                className="mb-6 rounded-2xl border-2 border-emerald-400/50 bg-gradient-to-r from-emerald-500/15 to-cyan-500/15 p-5 text-center"
              >
                <div className="text-[10px] uppercase tracking-[0.4em] text-emerald-300 font-black mb-1">
                  Referred Streamer
                </div>
                <p className="text-white text-sm">
                  You were invited by <b>{refReferrerName}</b>. Go live for the
                  first time after signing up and they earn <b>1,000 ₵</b> + 5 days Featured.
                </p>
                <p className="text-[10px] text-emerald-300/70 mt-2 font-mono">
                  CODE: {refCode}
                </p>
              </div>
            )}
            {refCode && refValid === false && (
              <div
                data-testid="signup-ref-banner-invalid"
                className="mb-6 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200"
              >
                The referral code <b>{refCode}</b> isn't recognized — you can still create an account below.
              </div>
            )}

            {error && (
              <Alert className="mb-6 bg-red-500/20 border-red-500/50 text-white">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Name */}
              <div>
                <Label htmlFor="name" className="text-white mb-2 block">
                  Full Name
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
                  <Input
                    id="name"
                    name="name"
                    type="text"
                    value={formData.name}
                    onChange={handleChange}
                    className="pl-10 bg-slate-950/50 border-white/10 focus:border-pink-500 text-white"
                    placeholder="John Doe"
                    required
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <Label htmlFor="email" className="text-white mb-2 block">
                  Email Address
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    inputMode="email"
                    value={formData.email}
                    onChange={handleChange}
                    className="pl-10 bg-slate-950/50 border-white/10 focus:border-pink-500 text-white"
                    placeholder="you@example.com"
                    required
                  />
                </div>
              </div>

              {/* Date of Birth */}
              <div>
                <Label htmlFor="date_of_birth" className="text-white mb-2 block">
                  Date of Birth <span className="text-xs text-slate-400">(Must be 18+)</span>
                </Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
                  <Input
                    id="date_of_birth"
                    name="date_of_birth"
                    type="date"
                    value={formData.date_of_birth}
                    onChange={handleChange}
                    className="pl-10 bg-slate-950/50 border-white/10 focus:border-pink-500 text-white"
                    max={new Date(new Date().setFullYear(new Date().getFullYear() - 18)).toISOString().split('T')[0]}
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <Label htmlFor="password" className="text-white mb-2 block">
                  Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={handleChange}
                    className="pl-10 pr-10 bg-slate-950/50 border-white/10 focus:border-pink-500 text-white"
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                {formData.password && (
                  <div className="mt-2">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${passwordStrengthColor[passwordStrength.score]}`}
                          style={{ width: `${(passwordStrength.score / 5) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-slate-300">{passwordStrength.message}</span>
                    </div>
                    <p className="text-xs text-slate-400">Use 8+ characters with uppercase, lowercase, numbers & symbols</p>
                  </div>
                )}
              </div>

              {/* Confirm Password */}
              <div>
                <Label htmlFor="confirmPassword" className="text-white mb-2 block">
                  Confirm Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    className="pl-10 pr-10 bg-slate-950/50 border-white/10 focus:border-pink-500 text-white"
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                {formData.confirmPassword && formData.password === formData.confirmPassword && (
                  <div className="flex items-center gap-1 mt-1 text-green-400 text-xs">
                    <CheckCircle className="h-3 w-3" />
                    <span>Passwords match</span>
                  </div>
                )}
              </div>

              <NeonButton
                type="submit"
                variant="gradient"
                className="w-full"
                disabled={loading}
              >
                {loading ? 'Creating Account...' : 'Sign Up'}
              </NeonButton>
            </form>

            <div className="mt-6 text-center">
              <p className="text-slate-300">
                Already have an account?{' '}
                <button
                  onClick={() => navigate('/login')}
                  className="text-pink-400 hover:text-pink-300 font-semibold"
                >
                  Sign In
                </button>
              </p>
            </div>

            <div className="mt-6">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/10" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-slate-900/40 text-slate-400">Or continue with</span>
                </div>
              </div>

              <NeonButton
                variant="ghost"
                onClick={() => {
                  const redirectUrl = `${window.location.origin}/auth-callback`;
                  window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
                }}
                className="w-full mt-4"
              >
                <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5 mr-2" />
                Sign up with Google
              </NeonButton>
            </div>
          </GlassCard>
        </motion.div>
      </div>
    </RoomLayout>
  );
}
