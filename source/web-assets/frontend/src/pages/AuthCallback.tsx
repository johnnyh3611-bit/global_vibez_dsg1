import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH

export default function AuthCallback() {
  const navigate = useNavigate();
  const hasProcessed = useRef(false);

  useEffect(() => {
    // CRITICAL: Prevent double processing in React StrictMode
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const processAuth = async () => {
      try {
        // Extract session_id from URL fragment (Emergent Auth puts it there).
        const hash = window.location.hash;
        const params = new URLSearchParams(hash.substring(1));
        const sessionId = params.get('session_id');

        if (!sessionId) {
          navigate('/');
          return;
        }

        // Exchange session_id for session_token. We intentionally do NOT
        // pass ```` — on the production custom-domain
        // deploy the K8s ingress responds to OPTIONS preflight with
        // ``Access-Control-Allow-Origin: *``, which the browser refuses to
        // accept alongside credentials. The backend returns the bearer
        // token in the JSON body anyway, and we persist it to localStorage
        // below — that's the source of truth used by every authFetch call.
        const response = await fetch(`${API}/auth/session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: sessionId }),
        });

        if (!response.ok) {
          throw new Error('Failed to create session');
        }

        const data = await response.json();
        const user = data.user;
        const sessionToken = data.session_token;

        // Belt-and-suspenders auth: persist the Bearer token to localStorage
        // alongside the cookie. The rest of the app (authFetch, ProtectedRoute,
        // every <ProtectedRoute>-gated page) reads ``localStorage.auth_token``
        // first; the cookie is the fallback. Saving both means the user stays
        // logged in even on browsers that strip cross-origin cookies (Safari ITP).
        if (sessionToken) {
          localStorage.setItem('auth_token', sessionToken);
        }
        if (user) {
          localStorage.setItem('user_data', JSON.stringify(user));
          if (user.user_id) localStorage.setItem('user_id', user.user_id);
          if (user.name) localStorage.setItem('username', user.name);
          if (user.email) localStorage.setItem('user_email', user.email);
        }

        // Redirect based on profile completion
        if (user?.profile_completed) {
          navigate('/dashboard', { state: { user }, replace: true });
        } else {
          navigate('/profile/setup', { state: { user }, replace: true });
        }
      } catch (error) {
        navigate('/');
      }
    };

    processAuth();
  }, [navigate]);

  return (
    <div
      className="flex items-center justify-center min-h-screen bg-gradient-to-br from-pink-500 via-purple-500 to-indigo-500"
      data-testid="auth-callback-loader"
    >
      <div className="text-white text-xl">Completing sign in...</div>
    </div>
  );
}