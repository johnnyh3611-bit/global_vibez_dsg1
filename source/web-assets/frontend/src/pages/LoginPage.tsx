import { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Eye, EyeOff, Mail, Lock, ArrowLeft, AlertCircle } from 'lucide-react';
import { getBackendUrl } from '@/config/backendUrl';
import { setBearerToken } from '@/utils/secureAuth';
import { consumeReturnTo } from '@/hubs/hubRegistry';
import SocialAuthButtons from '@/components/web3/SocialAuthButtons';

const API = getBackendUrl();
const BRAND_LOGO = '/assets/logo.png';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const returnFrom = (location.state && location.state.from) || '';
  const postLoginPath = (fallback = '/dashboard') => {
    if (typeof returnFrom === 'string' && returnFrom.startsWith('/') && !returnFrom.startsWith('//')) {
      return returnFrom;
    }
    return consumeReturnTo(fallback);
  };
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice] = useState(() => location.state?.notice || '');
  const [needsAgeVerification, setNeedsAgeVerification] = useState(false);
  const [userId, setUserId] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setError('');
    setLoading(true);
    localStorage.setItem('auth_in_progress', '1');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(`${API}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email.trim().toLowerCase(),
          password: formData.password,
        }),
        signal: controller.signal,
      });

      const raw = await response.text();
      const data = raw ? JSON.parse(raw) : {};

      if (!response.ok) {
        throw new Error(data.detail || 'Login failed');
      }

      if (data.requires_age_verification) {
        setNeedsAgeVerification(true);
        setUserId(data.user_id);
        setError('Please provide your date of birth to continue');
        setLoading(false);
        return;
      }

      if (data.token) {
        setBearerToken(data.token);
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
        navigate(postLoginPath('/dashboard'));
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
          date_of_birth: dateOfBirth,
        }),
      });

      const raw = await response.text();
      const data = raw ? JSON.parse(raw) : {};

      if (!response.ok) {
        throw new Error(data.detail || 'Age verification failed');
      }

      if (data.token) {
        localStorage.setItem('auth_token', data.token);
      }
      if (data.user) {
        localStorage.setItem('username', data.user.name || data.user.email);
        localStorage.setItem('user_id', data.user.user_id || data.user.id);
      }

      navigate(postLoginPath('/dashboard'));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async (evt) => {
    evt.preventDefault();
    evt.stopPropagation();
    if (loading) return;
    setLoading(true);
    setError('');
    localStorage.setItem('auth_in_progress', '1');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(`${API}/api/auth/demo-login`, {
        method: 'POST',
        signal: controller.signal,
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok && data.token && data.user_id) {
        setBearerToken(data.token);
        localStorage.setItem('user_id', data.user_id);
        if (data.name) localStorage.setItem('username', data.name);
        window.location.href = postLoginPath('/dashboard');
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
  };

  return (
    <div
      className="relative min-h-screen overflow-hidden bg-[#070a12] text-slate-100"
      data-testid="login-page"
    >
      {/* Atmosphere — soft brand wash, not casino neon */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(34,211,238,0.14), transparent 55%), radial-gradient(ellipse 60% 40% at 80% 100%, rgba(99,102,241,0.1), transparent 50%)',
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
        <Button
          variant="ghost"
          onClick={() => navigate('/')}
          className="mb-6 w-fit text-slate-300 hover:bg-white/5 hover:text-white"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Home
        </Button>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="rounded-2xl border border-white/10 bg-black/45 p-8 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl"
        >
          {!needsAgeVerification ? (
            <>
              <div className="mb-8 text-center">
                <img
                  src={BRAND_LOGO}
                  alt="Global Vibez DSG"
                  className="mx-auto mb-5 h-16 w-auto object-contain drop-shadow-[0_0_24px_rgba(34,211,238,0.35)]"
                  draggable={false}
                />
                <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                  Sign in
                </h1>
                <p className="mt-2 text-sm text-slate-400">
                  Welcome back to Global Vibez DSG
                </p>
              </div>

              {notice && !error && (
                <Alert className="mb-5 border-cyan-500/30 bg-cyan-500/10 text-cyan-50">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{notice}</AlertDescription>
                </Alert>
              )}

              {error && (
                <Alert className="mb-5 border-rose-500/35 bg-rose-500/10 text-rose-50">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="email" className="mb-2 block text-sm text-slate-200">
                    Email
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
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
                      className="h-11 border-white/10 bg-white/[0.04] pl-10 text-white placeholder:text-slate-500 focus-visible:border-cyan-400/60 focus-visible:ring-cyan-400/20"
                      placeholder="you@example.com"
                      required
                      data-testid="login-email"
                    />
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <Label htmlFor="password" className="block text-sm text-slate-200">
                      Password
                    </Label>
                    <Link
                      to="/forgot-password"
                      className="text-xs font-medium text-cyan-300/90 hover:text-cyan-200"
                      data-testid="login-forgot-password-link"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    <Input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      value={formData.password}
                      onChange={handleChange}
                      className="h-11 border-white/10 bg-white/[0.04] pl-10 pr-10 text-white placeholder:text-slate-500 focus-visible:border-cyan-400/60 focus-visible:ring-cyan-400/20"
                      placeholder="••••••••"
                      required
                      data-testid="login-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-200"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  data-testid="login-signin-btn"
                  className="h-11 w-full rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-500 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
                >
                  {loading ? 'Signing in…' : 'Sign in with email'}
                </button>
              </form>

              <SocialAuthButtons
                postLoginPath={postLoginPath}
                onError={(msg) => setError(msg)}
              />

              <button
                type="button"
                onClick={handleDemoLogin}
                disabled={loading}
                data-testid="login-demo-btn"
                className="mt-3 h-11 w-full rounded-xl border border-white/15 bg-white/[0.03] text-sm font-medium text-slate-200 transition hover:border-cyan-400/35 hover:bg-cyan-500/10 hover:text-cyan-100 disabled:opacity-60"
              >
                Continue with demo account
              </button>

              <p className="mt-6 text-center text-sm text-slate-400">
                New here?{' '}
                <button
                  type="button"
                  onClick={() => navigate('/signup')}
                  className="font-semibold text-cyan-300 hover:text-cyan-200"
                >
                  Create an account
                </button>
              </p>

              <p className="mt-4 text-center text-[11px] leading-relaxed text-slate-500">
                Adults 18+ only.{' '}
                <Link to="/terms" className="text-slate-400 underline hover:text-cyan-300">
                  Terms
                </Link>
                {' · '}
                <Link to="/privacy" className="text-slate-400 underline hover:text-cyan-300">
                  Privacy
                </Link>
              </p>
            </>
          ) : (
            <>
              <div className="mb-8 text-center">
                <h1 className="text-2xl font-semibold text-white">Age verification</h1>
                <p className="mt-2 text-sm text-slate-400">Confirm you are 18 or older</p>
              </div>

              {error && (
                <Alert className="mb-5 border-amber-500/35 bg-amber-500/10 text-amber-50">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <form onSubmit={handleAgeUpdate} className="space-y-5">
                <div>
                  <Label htmlFor="dateOfBirth" className="mb-2 block text-sm text-slate-200">
                    Date of birth
                  </Label>
                  <Input
                    id="dateOfBirth"
                    type="date"
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    className="h-11 border-white/10 bg-white/[0.04] text-white focus-visible:border-cyan-400/60 focus-visible:ring-cyan-400/20"
                    max={new Date(new Date().setFullYear(new Date().getFullYear() - 18))
                      .toISOString()
                      .split('T')[0]}
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="h-11 w-full rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-500 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
                >
                  {loading ? 'Verifying…' : 'Continue'}
                </button>
              </form>
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}
