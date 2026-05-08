
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { RoomLayout } from '@/components/RoomLayout';
import { GlassCard } from '@/components/GlassCard';
import { NeonButton } from '@/components/NeonButton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Eye, EyeOff, Mail, Lock, ArrowLeft, AlertCircle } from 'lucide-react';
import PrivyLoginButton from '@/components/web3/PrivyLoginButton';

const API = process.env.REACT_APP_BACKEND_URL;

export default function LoginPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [needsAgeVerification, setNeedsAgeVerification] = useState(false);
  const [userId, setUserId] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setError('');
    setLoading(true);

    // Tell versionManager not to hard-reload while this request is in flight.
    localStorage.setItem('auth_in_progress', '1');

    // Abort after 15s so the button can never spin forever on a stalled request.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(`${API}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // NOTE: do NOT use credentials:'include' here. The platform's edge
        // gateway returns Access-Control-Allow-Origin:* which the browser
        // blocks when combined with credentials. Auth uses Bearer tokens
        // in localStorage — cookies are not required for this flow.
        body: JSON.stringify({
          email: formData.email.trim().toLowerCase(),
          password: formData.password
        }),
        signal: controller.signal,
      });

      const raw = await response.text();
      const data = raw ? JSON.parse(raw) : {};

      if (!response.ok) {
        throw new Error(data.detail || 'Login failed');
      }

      // Check if age verification is needed
      if (data.requires_age_verification) {
        setNeedsAgeVerification(true);
        setUserId(data.user_id);
        setError('Please provide your date of birth to continue');
        setLoading(false);
        return;
      }

      // Clear any stale token first, then store the fresh Bearer fallback.
      localStorage.removeItem('auth_token');
      if (data.token) {
        localStorage.setItem('auth_token', data.token);
      }
      const userObj = data.user || data;
      if (userObj) {
        if (userObj.name || userObj.email) {
          localStorage.setItem('username', userObj.name || userObj.email);
        }
        if (userObj.user_id || userObj.id) {
          localStorage.setItem('user_id', userObj.user_id || userObj.id);
        }
      }

      if (userObj?.profile_completed) {
        navigate('/dashboard');
      } else {
        navigate('/profile/setup');
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        setError('Login timed out — please check your connection and try again.');
      } else {
        setError(err.message);
      }
    } finally {
      clearTimeout(timeoutId);
      localStorage.removeItem('auth_in_progress');
      setLoading(false);
    }
  };

  const handleAgeUpdate = async (e) => {
    e.preventDefault();
    if (loading) return;
    setError('');
    setLoading(true);

    try {
      const response = await fetch(`${API}/api/auth/update-age`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          date_of_birth: dateOfBirth
        })
      });

      const raw = await response.text();
      const data = raw ? JSON.parse(raw) : {};

      if (!response.ok) {
        throw new Error(data.detail || 'Age verification failed');
      }

      // Store token + user for Bearer fallback if cookies are dropped
      if (data.token) {
        localStorage.setItem('auth_token', data.token);
      }
      if (data.user) {
        localStorage.setItem('username', data.user.name || data.user.email);
        localStorage.setItem('user_id', data.user.user_id || data.user.id);
      }

      // Success! Redirect to dashboard
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
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

          <GlassCard className="p-8" hoverable={false}>
            {!needsAgeVerification ? (
              <>
                <div className="text-center mb-8">
                  <h1 className="text-4xl font-bold text-white mb-2">Welcome Back</h1>
                  <p className="text-slate-300">Sign in to your Global Vibez DSG account</p>
                </div>

                {error && (
                  <Alert className="mb-6 bg-red-500/20 border-red-500/50 text-white">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
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

                  {/* Password */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label htmlFor="password" className="text-white block">
                        Password
                      </Label>
                      <Link
                        to="/forgot-password"
                        className="text-xs text-fuchsia-400 hover:text-fuchsia-300 font-semibold"
                        data-testid="login-forgot-password-link"
                      >
                        Forgot password?
                      </Link>
                    </div>
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
                  </div>

                  <NeonButton
                    type="submit"
                    variant="gradient"
                    className="w-full hover:shadow-[0_0_24px_rgba(236,72,153,0.6)] hover:scale-[1.02] transition-all duration-200"
                    disabled={loading}
                    data-testid="login-signin-btn"
                  >
                    {loading ? 'Signing In...' : 'Sign In'}
                  </NeonButton>
                </form>

                <div className="mt-6 text-center">
                  <p className="text-slate-300">
                    Don't have an account?{' '}
                    <button
                      onClick={() => navigate('/signup')}
                      className="text-pink-400 hover:text-pink-300 font-semibold"
                    >
                      Sign Up
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
                    className="w-full mt-4 hover:shadow-[0_0_24px_rgba(34,211,238,0.55)] hover:scale-[1.02] transition-all duration-200"
                    data-testid="login-google-btn"
                  >
                    <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5 mr-2" />
                    Sign in with Google
                  </NeonButton>

                  {/* Privy hybrid auth — social + embedded Solana wallets */}
                  <div className="w-full mt-3 flex justify-center" data-testid="privy-login-slot">
                    <PrivyLoginButton />
                  </div>
                  
                  {/* Demo Login Button */}
                  <Button
                    variant="outline"
                    type="button"
                    onClick={async (evt) => {
                      // Stop Privy/other parent overlays from eating the click.
                      evt.preventDefault();
                      evt.stopPropagation();
                      if (loading) return;
                      setLoading(true);
                      setError('');
                      // Block versionManager from reloading mid-login.
                      localStorage.setItem('auth_in_progress', '1');
                      const controller = new AbortController();
                      const timeoutId = setTimeout(() => controller.abort(), 15000);
                      try {
                        const response = await fetch(`${API}/api/auth/demo-login`, {
                          method: 'POST',
                          // NOTE: do NOT use credentials:'include'. The edge
                          // gateway returns Access-Control-Allow-Origin:*
                          // which browsers block when combined with credentials,
                          // causing demo-login to fail on globalvibezdsg.com.
                          signal: controller.signal,
                        });
                        const data = await response.json().catch(() => ({}));
                        if (response.ok && data.token && data.user_id) {
                          // Clear stale state, then store fresh credentials.
                          localStorage.removeItem('auth_token');
                          localStorage.setItem('auth_token', data.token);
                          localStorage.setItem('user_id', data.user_id);
                          if (data.name) localStorage.setItem('username', data.name);
                          // Hard-redirect (not navigate) so any half-mounted
                          // Privy/SDK modal can't intercept React's transition.
                          window.location.href = '/dashboard';
                          return;
                        }
                        setError(data.detail || 'Demo login failed — please retry.');
                      } catch (err) {
                        if (err.name === 'AbortError') {
                          setError('Demo login timed out — please try again.');
                        } else {
                          setError('Demo login failed — check your connection and retry.');
                        }
                      } finally {
                        clearTimeout(timeoutId);
                        localStorage.removeItem('auth_in_progress');
                        setLoading(false);
                      }
                    }}
                    className="w-full mt-3 border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10 hover:shadow-[0_0_24px_rgba(34,211,238,0.55)] hover:scale-[1.02] transition-all duration-200"
                    data-testid="login-demo-btn"
                  >
                    🎮 Demo Login (Quick Access)
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="text-center mb-8">
                  <h1 className="text-4xl font-bold text-white mb-2">Age Verification</h1>
                  <p className="text-slate-300">Please confirm your date of birth</p>
                </div>

                {error && (
                  <Alert className="mb-6 bg-yellow-500/20 border-yellow-500/50 text-white">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <form onSubmit={handleAgeUpdate} className="space-y-5">
                  <div>
                    <Label htmlFor="dateOfBirth" className="text-white mb-2 block">
                      Date of Birth <span className="text-xs text-slate-400">(Must be 18+)</span>
                    </Label>
                    <Input
                      id="dateOfBirth"
                      type="date"
                      value={dateOfBirth}
                      onChange={(e) => setDateOfBirth(e.target.value)}
                      className="bg-slate-950/50 border-white/10 focus:border-pink-500 text-white"
                      max={new Date(new Date().setFullYear(new Date().getFullYear() - 18)).toISOString().split('T')[0]}
                      required
                    />
                  </div>

                  <NeonButton
                    type="submit"
                    variant="gradient"
                    className="w-full"
                    disabled={loading}
                  >
                    {loading ? 'Verifying...' : 'Continue'}
                  </NeonButton>
                </form>
              </>
            )}
          </GlassCard>
        </motion.div>
      </div>
    </RoomLayout>
  );
}
