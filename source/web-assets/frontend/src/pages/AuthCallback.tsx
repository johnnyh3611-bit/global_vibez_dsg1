/**
 * Legacy Emergent OAuth callback route.
 *
 * Emergent no longer has access to this platform. Any bookmark / stale
 * redirect lands here and is sent to email login instead of calling
 * demobackend.emergentagent.com.
 */
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate('/login', {
      replace: true,
      state: {
        notice:
          'Google sign-in via Emergent is no longer available. Please use email login or Demo Login.',
      },
    });
  }, [navigate]);

  return (
    <div
      className="flex items-center justify-center min-h-screen bg-gradient-to-br from-pink-500 via-purple-500 to-indigo-500"
      data-testid="auth-callback-retired"
    >
      <div className="text-white text-xl">Redirecting to login…</div>
    </div>
  );
}
